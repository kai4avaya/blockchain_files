// memory\local\file_worker.ts

class IndexDBWorkerOverlay {
    private worker: Worker;
    private callbacks: Map<string, (data: any) => void> = new Map();
    private isDBOpen: boolean = false;
    private dbName: string = 'fileGraphDB';
    private dbVersion: number = 1;
    private maxRetries: number = 3;
    private retryDelay: number = 1000; // 1 second
  
    constructor() {
      this.worker = new Worker('../../workers/memory_worker');
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }

    async deleteItem(storeName: string, key: string, dbName: string = this.dbName): Promise<void> {
      await this.ensureDBOpen();
      return this.sendToWorkerWithRetry('deleteItem', { storeName, key, dbName });
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
        try {
          return await this.sendToWorker(action, data);
        } catch (error: any) {
          if (retries < this.maxRetries) {
            console.log(`Retrying ${action} (Attempt ${retries + 1}/${this.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            if (error.message.includes('database connection is closing')) {
              // If the database was closing, try to reopen it before retrying
              await this.openDB(data.dbName);
            }
            return this.sendToWorkerWithRetry(action, data, retries + 1);
          } else {
            throw error;
          }
        }
    }
  
    private sendToWorker(action: string, data: any): Promise<any> {
      return new Promise((resolve, reject) => {
        const id = Date.now().toString();
        this.callbacks.set(id, (result) => {
          if (result && result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        });
        this.worker.postMessage({ id, action, data });
      });
    }
  
    private async ensureDBOpen(): Promise<void> {
      if (!this.isDBOpen) {
        await this.openDB(this.dbName);
      }
    }
  
    async openDB(dbName: string = 'fileGraphDB'): Promise<void> {
      try {
        const latestVersion = await this.getLatestDBVersion(dbName);
        await this.sendToWorkerWithRetry('openDB', { dbName, version: latestVersion });
        this.isDBOpen = true;
        this.dbName = dbName;
        this.dbVersion = latestVersion;
      } catch (error) {
        console.error('Error opening database:', error);
        throw error;
      }
    }
  
    private async getLatestDBVersion(dbName: string): Promise<number> {
      return new Promise((resolve) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const version = db.version;
          db.close();
          resolve(version);
        };
        request.onerror = () => resolve(1); // If the database doesn't exist, start with version 1
      });
    }
  
    async initializeDB(storeNames: string[]): Promise<void> {
      await this.ensureDBOpen();
      await this.sendToWorkerWithRetry('initializeDB', { storeNames });
    }
  
    async getData(storeName: string, dbName: string = this.dbName): Promise<any[]> {
      await this.ensureDBOpen();
      return this.sendToWorkerWithRetry('getData', { storeName, dbName });
    }
  
    async saveData(storeName: string, data: any, dbName: string = this.dbName): Promise<void> {
      await this.ensureDBOpen();
      await this.sendToWorkerWithRetry('saveData', { storeName, data, dbName });
    }
  
    async getItem(storeName: string, key: string, dbName: string = this.dbName): Promise<any> {
      await this.ensureDBOpen();
      return this.sendToWorkerWithRetry('getItem', { storeName, key, dbName });
    }

    
  }
  
  const indexDBOverlay = new IndexDBWorkerOverlay();
  export default indexDBOverlay;