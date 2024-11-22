// memory\local\file_worker.ts

import config from "../../configs/config.json";
import { generateVersionNonce, generateUniqueId } from "../../utils/utils";
import { p2pSync } from "../../network/peer2peer_simple";
import { generateGlobalTimestamp, incrementVersion } from "../../utils/utils";
import in_memory_store from "./in_memory";

interface VectorConfig {
  dimensions: number;
  hyperplanes: number;
  numPlanes: number;
  vectorPath: string;
  hashIndexSuffix: string;
}

interface StoreConfig {
  keyPath?: string;
  vectorConfig?: VectorConfig;
}

interface IndexDBOverlay {
  getAllTables(): Promise<string[]>;
  getAll(tableName: string): Promise<any>;
  saveData(tableName: string, data: any): Promise<void>;
  // ... other methods ...
}

class IndexDBWorkerOverlay {
  private worker: Worker;
  private db: IDBDatabase | null = null;
  private callbacks: Map<string, (data: any) => void> = new Map();
  private isDBOpen: boolean = false;
  private dbName: string = config.dbName;
  private dbVersion: number = 1;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private pendingOperations: Map<string, Promise<any>> = new Map();
  private isReopening: boolean = false;
  private isLocked: boolean = false;
  private requestQueue: Array<() => Promise<any>> = [];
  private connectionTimeout: number = 5000; // 5 second timeout for version check
  private isInitialized: boolean;

  constructor() {
    this.worker = new Worker(
      new URL("../../workers/memory_worker.js", import.meta.url)
    );
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.isInitialized = false; // Add a flag to track initialization
  }

  public async initialize(dbName?: string): Promise<void> {
    if (this.isInitialized) return; // Prevent multiple initializations

    // Determine the database name to use
    // const lastOpenedDB = localStorage.getItem('last_opened_db');
    const lastOpenedDB = localStorage.getItem("latestDBName");
    this.dbName = dbName || lastOpenedDB || config.dbName;

    // Post initial config to the worker
    this.worker.postMessage({
      type: "INIT_CONFIG",
      config: {
        dbName: this.dbName,
      },
    });

    // Save the dbName to localStorage if not already present in the databases list
    const databases = JSON.parse(localStorage.getItem("databases") ?? "[]");
    if (!databases.includes(this.dbName)) {
      databases.push(this.dbName);
      localStorage.setItem("databases", JSON.stringify(databases));
    }

    // Update localStorage with the last opened database
    // localStorage.setItem('last_opened_db', this.dbName);
    localStorage.setItem("latestDBName", this.dbName);

    this.isInitialized = true;
  }

  async updateItem(storeName: string, data: any, key?: string): Promise<void> {
    try {
      await this.ensureDBOpen();

      // Always ensure these CRDT fields are set
      const updatedData = {
        ...data,
        version: data.version ? data.version + 1 : incrementVersion(),
        globalTimestamp: generateGlobalTimestamp(),
        versionNonce: generateVersionNonce(),
        lastEditedBy: localStorage.getItem("login_block") || "no_login",
        isDeleted: data.isDeleted ?? false, // Ensure isDeleted is always present
      };

      // Use existing saveData logic which already handles CRDT conflicts
      await this.saveData(storeName, updatedData, key);
    } catch (error) {
      console.error(`Failed to update data in ${storeName}:`, error);
      throw error;
    }
  }

  async getAllTables(): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize(); // Ensure the worker is initialized
    }

    // Retrieve all the table names from the configuration
    return Object.keys(config.dbStores);
  }

  async getAllTablesAsync(): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize(); // Ensure the worker is initialized
    }

    // Retrieve all store names using the existing function
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);

      request.onerror = (event) => {
        reject(new Error("Error opening database: " + event.target));
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const storeNames = Array.from(db.objectStoreNames);
        db.close(); // Always close the database when done
        resolve(storeNames);
      };
    });
  }

  async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      const allTables = await indexDBOverlay.getAllTablesAsync();
      if (allTables.includes(tableName)) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Error checking table existence:", error);
      return false;
    }
  }

  private async getLatestDBVersion(): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize(); // Ensure the worker is initialized
    }
    let timeoutId: number;

    return new Promise((resolve, reject) => {
      // let timeoutId: number;
      try {
        const request = indexedDB.open(this.dbName);

        // Set timeout for the entire operation
        timeoutId = window.setTimeout(() => {
          request.removeEventListener("success", successHandler);
          request.removeEventListener("error", errorHandler);
          if (request.result) {
            request.result.close();
          }
          resolve(1); // Default to version 1 on timeout
        }, this.connectionTimeout);

        const successHandler = (event: Event) => {
          clearTimeout(timeoutId);
          const db = (event.target as IDBOpenDBRequest).result;
          const version = db.version;
          db.close();
          resolve(version);
        };

        const errorHandler = (event: Event) => {
          clearTimeout(timeoutId);
          const error = (event.target as IDBOpenDBRequest).error;
          console.warn("Error getting DB version:", error);
          resolve(1); // Default to version 1 on error
        };

        request.addEventListener("success", successHandler, { once: true });
        request.addEventListener("error", errorHandler, { once: true });

        request.onblocked = async (event: Event) => {
          clearTimeout(timeoutId);
          console.warn("Database operation blocked. Closing connections...");
          await this.closeAllConnections(this.dbName);
          resolve(1);
        };
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("Critical error accessing IndexedDB:", error);
        resolve(1); // Default to version 1 on critical error
      }
    });
  }

  async openDB(forceRefresh: boolean = false): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(); // Ensure the worker is initialized
    }
    const operationKey = `openDB-${this.dbName}`;

    if (this.pendingOperations.has(operationKey)) {
      return this.pendingOperations.get(operationKey);
    }

    const operation = (async () => {
      if (forceRefresh) {
        await this.closeAllConnections(this.dbName);
      }

      try {
        const latestVersion = await this.getLatestDBVersion();
        this.dbVersion = latestVersion;

        const storeConfigs = Object.entries(config.dbStores).map(
          ([storeName, storeConfig]) => ({
            storeName,
            keyPath:
              "keyPath" in storeConfig ? storeConfig?.keyPath : undefined,
          })
        );

        await this.sendToWorkerWithRetry("openDB", {
          storeConfigs,
          version: latestVersion,
          forceRefresh,
          preserveExistingStores: true, // Ensure existing stores are preserved
        });

        this.isDBOpen = true;
      } catch (error) {
        console.error("Error opening database:", error);
        this.isDBOpen = true; // Set to true to prevent endless retry loops
      } finally {
        this.pendingOperations.delete(operationKey);
      }
    })();

    this.pendingOperations.set(operationKey, operation);
    return operation;
  }

  async getAll(storeName: string): Promise<any[]> {
    const res = await this.isMemoryOp(storeName, "get all"); // this may hijack all of vectors_hashIndex
    if (res) return res;

    await this.ensureDBOpen();
    return this.sendToWorkerWithRetry("getAll", { storeName });
  }

  async deleteDatabase(dbName: string) {
    try {
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      deleteRequest.onsuccess = () => {
        // Update localStorage
        const databases = JSON.parse(localStorage.getItem("databases") || "[]");
        const index = databases.indexOf(dbName);
        if (index > -1) {
          databases.splice(index, 1);
          localStorage.setItem("databases", JSON.stringify(databases));
        }
      };
      deleteRequest.onerror = (event) => {
        console.error(
          `Failed to delete database "${dbName}":`,
          (event.target as IDBRequest).error
        );
      };
      deleteRequest.onblocked = () => {
        console.warn(
          `Deletion of database "${dbName}" is blocked. Please close all open connections.`
        );
      };
    } catch (error) {
      console.error(`Error deleting database "${dbName}":`, error);
    }
  }

  private async queueRequest(request: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          resolve(await request());
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isLocked || !this.requestQueue.length) return;

    this.isLocked = true;
    const request = this.requestQueue.shift();
    if (request) await request();
    this.isLocked = false;

    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), 0); // Schedule next item in the queue
    }
  }

  async deleteItem(storeName: string, key: string): Promise<void> {

    if (await this.isMemoryOp("delete data", storeName))
      // this might hijack all hashIndex
      return;

 
    await this.ensureDBOpen();
 
    return this.sendToWorkerWithRetry("deleteItem", { storeName, key });
  }

  async deleteItem_field(storeName: string, key: string): Promise<void> {

    if (await this.isMemoryOp("delete data", storeName)) {
      return;
    }

    try {
      await this.ensureDBOpen();

      // Get the existing item
      const existingItem = await this.getItem(storeName, key);
      if (existingItem) {
        // Mark as deleted and update
        existingItem.isDeleted = true;
        await this.updateItem(storeName, existingItem, key);
      }
    } catch (error) {
      console.error(`Failed to mark item as deleted in ${storeName}:`, error);
      throw error;
    }
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { id, data, error } = event.data;
    const callback = this.callbacks.get(id);
    if (callback) {
      this.callbacks.delete(id);
      if (error) {
        console.error("IndexDB Worker Error:", error);
      } else {
        callback(data);
      }
    }
  }

  private async sendToWorkerWithRetry(
    action: string,
    data: any,
    retries: number = 0
  ): Promise<any> {
    return this.queueRequest(async () => {
      const operationKey = `${action}-${JSON.stringify(data)}`;

      while (this.isReopening) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (this.pendingOperations.has(operationKey)) {
        return this.pendingOperations.get(operationKey);
      }

      const operation = (async () => {
        try {
          return await this.sendToWorker(action, data);
        } catch (error: any) {
          if (retries < this.maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.retryDelay)
            );
            return this.sendToWorkerWithRetry(action, data, retries + 1);
          }
          throw error;
        } finally {
          this.pendingOperations.delete(operationKey);
        }
      })();

      this.pendingOperations.set(operationKey, operation);
      return operation;
    });
  }

  private async sendToWorker(action: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id =
        Date.now().toString() + Math.random().toString(36).substr(2, 9);

      const timeoutId = setTimeout(() => {
        this.callbacks.delete(id);
        reject(new Error(`Worker ${action} operation timed out`));
      }, 5000);

      this.callbacks.set(id, (result) => {
        clearTimeout(timeoutId);
        if (result && result.error) {
          // If we get a "not found" error, try reinitializing
          if (result.error.includes("not found")) {
            this.reopenDB()
              .then(() => this.sendToWorker(action, data))
              .then(resolve)
              .catch(reject);
            return;
          }
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      });

      // Extract the key but keep it in the data
      const { key } = data;

      if (!key) {
        this.worker.postMessage({ id, action, data });
      } else {
        // Send data without removing the key
        this.worker.postMessage({ id, action, data, key });
      }
    });
  }

  private async ensureDBOpen(): Promise<void> {
    if (!this.isDBOpen) {
      // Get all store configs from config file
      const storeConfigs = Object.entries(config.dbStores).map(
        ([storeName, storeConfig]) => ({
          storeName,
          keyPath: "keyPath" in storeConfig ? storeConfig?.keyPath : "id",
        })
      );

      try {
        // First try to open DB
        await this.openDB();

        // Then ensure all stores are created
        await this.initializeDB(Object.keys(config.dbStores));
      } catch (error) {
        console.error("Error ensuring database is open:", error);
        throw error;
      }
    }
  }

  public async closeAllConnections(dbName: string): Promise<void> {
    return new Promise(async (resolve) => {
      try {

        // First close our local connection if it exists
        if (this.db) {
          this.db.close();
          this.db = null;
        }

        // Reset internal state
        this.isDBOpen = false;
        this.isInitialized = false;

        // Add delay to ensure connections are properly closed
        await new Promise((resolve) => setTimeout(resolve, 1000));
        resolve();
      } catch (error) {
        console.error("Error in closeAllConnections:", error);
        resolve(); // Resolve anyway to allow deletion to proceed
      }
    });
  }

  async initializeDB(storeNames: string[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(); // Ensure the worker is initialized
    }

    const storeConfigs = storeNames.map((storeName) => {
      const storeConfig =
        config.dbStores[storeName as keyof typeof config.dbStores];
      // if (!storeConfig) {
      //   return {
      //     storeName,
      //     keyPath: null
      //   }
      // }
      return {
        storeName,
        keyPath: "keyPath" in storeConfig ? storeConfig?.keyPath : null, // Allow null keyPath for stores that need explicit keys
      };
    });

    try {
      await this.sendToWorkerWithRetry("initializeDB", { storeConfigs });
    } catch (error) {
      console.error("Failed to initialize stores:", error);
      throw error;
    }
  }

  private async reopenDB(): Promise<void> {
    this.isReopening = true;
    this.isDBOpen = false;

    // Wait for all pending operations to complete
    await Promise.all(this.pendingOperations.values());

    await this.closeAllConnections(this.dbName);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await this.openDB(true); // Force refresh

    this.isReopening = false;
  }

  async getData(storeName: string): Promise<any[]> {
    const res = await this.isMemoryOp(storeName, "get all");
    if (res) {
      return res;
    }

    await this.ensureDBOpen();
    return this.sendToWorkerWithRetry("getData", { storeName });
  }

  async createTableIfNotExists(tableName: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(); // Ensure the worker is initialized
    }

    // Check if the table already exists
    const tables = await this.getAllTablesAsync();
    if (tables.includes(tableName)) {
      return; // No need to create if it already exists
    }

    // Define the new store configuration
    const storeConfig = {
      storeName: tableName,
      keyPath: "id", // or whatever keyPath you need
    };

    try {
      // Initialize the new store without affecting existing stores
      await this.sendToWorkerWithRetry("initializeDB", {
        storeConfigs: [storeConfig],
        preserveExistingStores: true,
      });
    } catch (error) {
      console.error(`Failed to create table "${tableName}":`, error);
      throw error;
    }
  }

  private async isMemoryOp(
    operation: string,
    storeName: string,
    data?: any
  ): Promise<any> {
    let res: any;
    if (
      (data?.inFromPeer && storeName.includes("vectors_hashIndex")) ||
      (!data && storeName.includes("vectors_hashIndex_"))
    ) {
      storeName = `vector_hashIndex_${p2pSync.getCurrentPeerId()}`;
      // Ensure the table exists before saving data
      if (!(await this.checkIfTableExists(storeName))) {
        // await this.createTableIfNotExists(storeName);
        in_memory_store.createTableIfNotExists(storeName);
        //  case "save data":
        //   await this.saveData(tableName, data!, key);
        res = in_memory_store.route(operation, storeName, data);
      }

      return res || true;
    }
    return false;
  }

  async saveData(storeName: string, data: any, key?: string): Promise<void> {
    try {
      await this.ensureDBOpen();

      // Generate version and global timestamp if not present
      if (!data.version) {
        data.version = incrementVersion();
      } else {
        data.version += 1; // Increment version if already exists
      }
      data.globalTimestamp = generateGlobalTimestamp();

      // Only generate versionNonce if it doesn't exist
      if (!data.versionNonce) {
        data.versionNonce = generateVersionNonce();
      }

      // Ensure lastEditedBy is set
      data.lastEditedBy =
        data.lastEditedBy || localStorage.getItem("login_block") || "no_login";

      if (await this.isMemoryOp("save data", storeName, data)) return;
      // Conflict resolution logic for CRDT-like behavior
      const existingItem = key ? await this.getItem(storeName, key) : null;
      if (existingItem) {
        // Compare existing data with new data based on version and global timestamp
        if (
          data.version > existingItem.version ||
          (data.version === existingItem.version &&
            data.globalTimestamp > existingItem.globalTimestamp)
        ) {
       
        } else {
          // Existing data is newer or equally recent, skip saving
          return;
        }
      }

      // Save the data (overwrites if key is already present)
      const storeConfig =
        config.dbStores[storeName as keyof typeof config.dbStores];
      if (storeConfig && "keyPath" in storeConfig) {
        await this.sendToWorkerWithRetry("saveData", { storeName, data });
      } else {
        await this.sendToWorkerWithRetry("saveData", { storeName, data, key });
      }

      // Existing sync logic for broadcasting changes
      if (
        !data?.isFromPeer &&
        p2pSync.isConnected() &&
        !config.excludedSyncTables.includes(storeName)
      ) {
        const currentPeerId = p2pSync.getCurrentPeerId();


        if (storeName.includes("vectors_hashIndex") && currentPeerId) {
          storeName = `${storeName}_${currentPeerId}`;
        }
        p2pSync.broadcastCustomMessage({
          type: "db_sync",
          data: {
            tableName: storeName,
            data: data,
            key: key,
            isFromPeer: true,
            version: data.version || incrementVersion(),
            globalTimestamp: data.globalTimestamp || generateGlobalTimestamp(),
            versionNonce: data.versionNonce || generateVersionNonce(),
            lastEditedBy: localStorage.getItem("login_block") || "no_login",
          },
        });
      }
    } catch (error) {
      console.error(`Failed to save data to ${storeName}:`, error);
      throw error;
    }
  }

  async getTablesWithPrefix(prefix: string): Promise<string[]> {
    const allTables = await this.getAllTablesAsync(); // Fetch all table names
    return allTables.filter((tableName) => tableName.startsWith(prefix));
  }

  async getItem(storeName: string, key: string): Promise<any> {
    // Check if this is a vector hash index operation
    if (storeName.includes('vectors_hashIndex_')) {
        // Use in-memory store for vector hash indices
        in_memory_store.createTableIfNotExists(storeName);
        return in_memory_store.route('get item', storeName, { key });
    }

    // Regular IndexDB handling for non-vector hash index tables
    await this.ensureDBOpen();
    return this.sendToWorkerWithRetry("getItem", { storeName, key });
  }
}

const indexDBOverlay = new IndexDBWorkerOverlay();
export default indexDBOverlay;
