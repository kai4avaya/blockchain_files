// memory\local\file_worker.ts

class IndexDBWorkerOverlay {
  private worker: Worker;
  private callbacks: Map<string, (data: any) => void> = new Map();
  private isDBOpen: boolean = false;
  private dbName: string = 'fileGraphDB';
  private dbVersion: number = 1;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private pendingOperations: Map<string, Promise<any>> = new Map();

    constructor() {
      this.worker = new Worker('../../workers/memory_worker');
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }

    

    private async reopenDB(dbName: string): Promise<void> {
      this.isDBOpen = false;
      await this.closeAllConnections(dbName);
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.openDB(dbName, true); // Force refresh
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
      const operationKey = `${action}-${JSON.stringify(data)}`;

      // If there's already a pending operation, wait for it
      if (this.pendingOperations.has(operationKey)) {
          return this.pendingOperations.get(operationKey);
      }

      const operation = (async () => {
          try {
              const result = await this.sendToWorker(action, data);
              return result;
          } catch (error: any) {
              const isClosingError = error.message.includes('database connection is closing') ||
                                   error.message.includes('Failed to execute');
              const isVersionError = error.message.includes('existing version');

              if (retries < this.maxRetries) {
                  console.log(`Retrying ${action} (Attempt ${retries + 1}/${this.maxRetries})`);
                  await new Promise(resolve => setTimeout(resolve, this.retryDelay));

                  if (isClosingError || isVersionError) {
                      await this.reopenDB(data.dbName || this.dbName);
                      // Update the version in the data if it was a version error
                      if (isVersionError) {
                          data.version = this.dbVersion;
                      }
                  }

                  return this.sendToWorkerWithRetry(action, data, retries + 1);
              }
              throw error;
          } finally {
              this.pendingOperations.delete(operationKey);
          }
      })();

      this.pendingOperations.set(operationKey, operation);
      return operation;
  }
  
  private async sendToWorker(action: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        const timeoutId = setTimeout(() => {
            this.callbacks.delete(id);
            reject(new Error(`Worker ${action} operation timed out`));
        }, 5000); // 5 second timeout

        this.callbacks.set(id, (result) => {
            clearTimeout(timeoutId);
            if (result && result.error) {
                reject(new Error(`${result.error} | Action: ${action} | Data: ${JSON.stringify(data)}`));
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
  
    async openDB(dbName: string = 'fileGraphDB', forceRefresh: boolean = false): Promise<void> {
      const operationKey = `openDB-${dbName}`;
      
      // If there's already a pending operation for this DB, wait for it
      if (this.pendingOperations.has(operationKey)) {
          return this.pendingOperations.get(operationKey);
      }

      const operation = (async () => {
          try {
              if (forceRefresh) {
                  await this.closeAllConnections(dbName);
              }

              const latestVersion = await this.getLatestDBVersion(dbName);
              this.dbVersion = latestVersion;

              await this.sendToWorkerWithRetry('openDB', { 
                  dbName, 
                  version: latestVersion,
                  forceRefresh 
              });

              this.isDBOpen = true;
              this.dbName = dbName;
          } catch (error) {
              console.error('Error opening database:', error);
              throw error;
          } finally {
              this.pendingOperations.delete(operationKey);
          }
      })();

      this.pendingOperations.set(operationKey, operation);
      return operation;
  }
  
    private async getLatestDBVersion(dbName: string): Promise<number> {
      return new Promise((resolve, reject) => {
          const request = indexedDB.open(dbName);
          request.onsuccess = (event: Event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              const version = db.version;
              db.close();
              resolve(version);
          };
          request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
              const db = (event.target as IDBOpenDBRequest).result;
              db.close();
              resolve(event.newVersion || 1);
          };
          request.onerror = () => {
              console.error("Error getting DB version");
              resolve(1); // Default to version 1 if we can't get the current version
          };
      });
  }


     private async closeAllConnections(dbName: string): Promise<void> {
        return new Promise((resolve) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = (event: Event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                db.close();
                resolve();
            };
            request.onerror = () => resolve();
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
      const retryOperation = async (attempt: number = 0): Promise<void> => {
          try {
              await this.ensureDBOpen();
              await this.sendToWorkerWithRetry('saveData', { storeName, data, dbName });
          } catch (error) {
              if (attempt < this.maxRetries) {
                  console.log(`Retrying save operation (Attempt ${attempt + 1}/${this.maxRetries})`);
                  await this.reopenDB(dbName);
                  await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
                  return retryOperation(attempt + 1);
              }
              throw error;
          }
      };

      try {
          await retryOperation();
      } catch (error) {
          console.error(`Failed to save data to ${storeName}:`, error);
          throw error;
      }
  }
  
    async getItem(storeName: string, key: string, dbName: string = this.dbName): Promise<any> {
      await this.ensureDBOpen();
      return this.sendToWorkerWithRetry('getItem', { storeName, key, dbName });
    }

    
  }
  
  const indexDBOverlay = new IndexDBWorkerOverlay();
  export default indexDBOverlay;