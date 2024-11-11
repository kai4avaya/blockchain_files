// memory\local\file_worker.ts


import config from '../../configs/config.json';
import {generateVersionNonce} from '../../utils/utils';
import { p2pSync } from '../../network/peer2peer_simple';

class IndexDBWorkerOverlay {
  private worker: Worker;
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
  // constructor() {
  //   this.worker = new Worker(new URL('../../workers/memory_worker.js', import.meta.url));
  //   this.worker.onmessage = this.handleWorkerMessage.bind(this);
    
  //   this.worker.postMessage({
  //     type: 'INIT_CONFIG',
  //     config: {
  //       dbName: config.dbName || this.dbName
  //     }
  //   });
  // }

  constructor() {
    this.worker = new Worker(new URL('../../workers/memory_worker.js', import.meta.url));
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.isInitialized = false; // Add a flag to track initialization
  }
  
//   public async initialize(dbName?: string): Promise<void> {
//     if (this.isInitialized) return; // Prevent multiple initializations

//     this.dbName = dbName || config.dbName; // Use the provided dbName or default config
//     this.worker.postMessage({
//       type: 'INIT_CONFIG',
//       config: {
//         dbName: this.dbName,
//       },
//     });

//     // Save the dbName to localStorage if not already present
//     const databases = JSON.parse(localStorage.getItem('databases') ?? '[]');
//     if (!databases.includes(this.dbName)) {
//         databases.push(this.dbName);
//         localStorage.setItem('databases', JSON.stringify(databases));
//     }

//     localStorage.setItem('last_opened_db', JSON.stringify(databases));

//     this.isInitialized = true;
// }

public async initialize(dbName?: string): Promise<void> {
  if (this.isInitialized) return; // Prevent multiple initializations

  // Determine the database name to use
  const lastOpenedDB = localStorage.getItem('last_opened_db');
  this.dbName = dbName || lastOpenedDB || config.dbName;

  // Post initial config to the worker
  this.worker.postMessage({
      type: 'INIT_CONFIG',
      config: {
          dbName: this.dbName,
      },
  });

  // Save the dbName to localStorage if not already present in the databases list
  const databases = JSON.parse(localStorage.getItem('databases') ?? '[]');
  if (!databases.includes(this.dbName)) {
      databases.push(this.dbName);
      localStorage.setItem('databases', JSON.stringify(databases));
  }

  // Update localStorage with the last opened database
  localStorage.setItem('last_opened_db', this.dbName);

  this.isInitialized = true;
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
          request.removeEventListener('success', successHandler);
          request.removeEventListener('error', errorHandler);
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
        
        request.addEventListener('success', successHandler, { once: true });
        request.addEventListener('error', errorHandler, { once: true });
  
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

        const storeConfigs = Object.entries(config.dbStores).map(([storeName, storeConfig]) => ({
          storeName,
          keyPath: 'keyPath' in storeConfig ? storeConfig.keyPath : undefined
        }));

        await this.sendToWorkerWithRetry('openDB', { 
          storeConfigs,
          version: latestVersion,
          forceRefresh 
        });

        this.isDBOpen = true;
      } catch (error) {
        console.error('Error opening database:', error);
        // Don't throw here - let the operation continue with default values
        this.isDBOpen = true; // Set to true to prevent endless retry loops
      } finally {
        this.pendingOperations.delete(operationKey);
      }
    })();

    this.pendingOperations.set(operationKey, operation);
    return operation;
  }

  async getAll(storeName: string): Promise<any[]> {
    await this.ensureDBOpen();
    return this.sendToWorkerWithRetry('getAll', { storeName });
}

async deleteDatabase(dbName: string) {
  try {
    const deleteRequest = indexedDB.deleteDatabase(dbName);
    deleteRequest.onsuccess = () => {
      console.log(`Database "${dbName}" deleted successfully`);
      // Update localStorage
      const databases = JSON.parse(localStorage.getItem('databases') || '[]');
      const index = databases.indexOf(dbName);
      if (index > -1) {
        databases.splice(index, 1);
        localStorage.setItem('databases', JSON.stringify(databases));
      }
    };
    deleteRequest.onerror = (event) => {
      console.error(`Failed to delete database "${dbName}":`, event.target.error);
    };
    deleteRequest.onblocked = () => {
      console.warn(`Deletion of database "${dbName}" is blocked. Please close all open connections.`);
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
    await this.ensureDBOpen();
    return this.sendToWorkerWithRetry('deleteItem', { storeName, key });
  }
  
    private handleWorkerMessage(event: MessageEvent) {
      const { id, data, error } = event.data;
      const callback = this.callbacks.get(id);
      if (callback) {
        this.callbacks.delete(id);
        if (error) {
          console.error('IndexDB Worker Error:', error);
        } else {
          callback(data);
        }
      }
    }
    private async sendToWorkerWithRetry(action: string, data: any, retries: number = 0): Promise<any> {
      return this.queueRequest(async () => {
          const operationKey = `${action}-${JSON.stringify(data)}`;
  
          while (this.isReopening) {
              await new Promise(resolve => setTimeout(resolve, 100));
          }
  
          if (this.pendingOperations.has(operationKey)) {
              return this.pendingOperations.get(operationKey);
          }
  
          const operation = (async () => {
              try {
                  return await this.sendToWorker(action, data);
              } catch (error: any) {
                  if (retries < this.maxRetries) {
                      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
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
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        const timeoutId = setTimeout(() => {
            this.callbacks.delete(id);
            reject(new Error(`Worker ${action} operation timed out`));
        }, 5000);

        this.callbacks.set(id, (result) => {
            clearTimeout(timeoutId);
            if (result && result.error) {
                // If we get a "not found" error, try reinitializing
                if (result.error.includes('not found')) {
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


        if (!data.key) {
          this.worker.postMessage({ id, action, data });
      } else {

          const { key, ...dataWithoutKey } = data;
          this.worker.postMessage({ id, action, data: dataWithoutKey, key });
      }
    });
  }

private async ensureDBOpen(): Promise<void> {
  if (!this.isDBOpen) {
    // Get all store configs from config file
    const storeConfigs = Object.entries(config.dbStores).map(([storeName, storeConfig]) => ({
      storeName,
      keyPath: 'keyPath' in storeConfig ? storeConfig.keyPath : 'id'
    }));

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
  

private async closeAllConnections(dbName: string): Promise<void> {
  return new Promise((resolve) => {
    const closeRequest = indexedDB.open(dbName);
    closeRequest.addEventListener('success', (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.close();
      resolve();
    }, { once: true });
    
    closeRequest.addEventListener('error', () => {
      resolve(); // Resolve even on error to continue operation
    }, { once: true });
  });
}
async initializeDB(storeNames: string[]): Promise<void> {
  if (!this.isInitialized) {
    await this.initialize(); // Ensure the worker is initialized
  }

  const storeConfigs = storeNames.map(storeName => {
    const storeConfig = config.dbStores[storeName as keyof typeof config.dbStores];
    return {
      storeName,
      keyPath: 'keyPath' in storeConfig ? storeConfig.keyPath : null // Allow null keyPath for stores that need explicit keys
    };
  });
  
  try {
    await this.sendToWorkerWithRetry('initializeDB', { storeConfigs });
  } catch (error) {
    console.error('Failed to initialize stores:', error);
    throw error;
  }
}

    private async reopenDB(): Promise<void> {
      this.isReopening = true;
      this.isDBOpen = false;
  
      // Wait for all pending operations to complete
      await Promise.all(this.pendingOperations.values());
  
      await this.closeAllConnections(this.dbName);
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.openDB(true); // Force refresh
  
      this.isReopening = false;
    }

    async getData(storeName: string): Promise<any[]> {
        await this.ensureDBOpen();
        return this.sendToWorkerWithRetry('getData', { storeName });
      }
  
      
      async saveData(storeName: string, data: any, key?: string): Promise<void> {
        try {
          await this.ensureDBOpen();
      
          // Get the store configuration
          const storeConfig = config.dbStores[storeName as keyof typeof config.dbStores];
      
          // If the store uses a keyPath (in-line keys), do not include the 'key' parameter
          if (storeConfig && 'keyPath' in storeConfig) {
            await this.sendToWorkerWithRetry('saveData', { 
              storeName, 
              data
            });
          } else {
            // If the store does not use a keyPath, include the 'key' parameter
            await this.sendToWorkerWithRetry('saveData', { 
              storeName, 
              data,
              key
            });
          }
      
          console.log("saveData pre peer", data, "data?.isFromPeer", data?.isFromPeer);
      
          // Check if `isFromPeer` is not present in data before broadcasting
          if (!data?.isFromPeer && p2pSync.isConnected() && !config.excludedSyncTables.includes(storeName)) {
            p2pSync.broadcastCustomMessage({
              type: 'db_sync',
              data: {
                tableName: storeName,
                data: data,
                key: key,
                isFromPeer: true,
                version: Date.now(),
                versionNonce: generateVersionNonce(),
                lastEditedBy: localStorage.getItem('login_block') || 'no_login'
              }
            });
          }
        } catch (error) {
          console.error(`Failed to save data to ${storeName}:`, error);
          throw error;
        }
      }
      
  
      async getItem(storeName: string, key: string): Promise<any> {
        await this.ensureDBOpen();
        return this.sendToWorkerWithRetry('getItem', { storeName, key });
      }
    
  }
  
  const indexDBOverlay = new IndexDBWorkerOverlay();
  export default indexDBOverlay;