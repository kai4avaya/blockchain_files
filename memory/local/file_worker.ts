
// class IndexDBWorkerOverlay {
//     private worker: Worker;
//     private callbacks: Map<string, (data: any) => void> = new Map();
  
//     constructor() {
//       this.worker = new Worker('../../workers/memory_worker');
//       this.worker.onmessage = this.handleWorkerMessage.bind(this);
//     }
  
//     private handleWorkerMessage(event: MessageEvent) {
//       const { id, data, error } = event.data;
//       const callback = this.callbacks.get(id);
//       if (callback) {
//         this.callbacks.delete(id);
//         if (error) {
//           console.error('IndexDB Worker Error:', error);
//         } else {
//           callback(data);
//         }
//       }
//     }
  
//     private sendToWorker(action: string, data: any): Promise<any> {
//       return new Promise((resolve) => {
//         const id = Date.now().toString();
//         this.callbacks.set(id, resolve);
//         this.worker.postMessage({ id, action, data });
//       });
//     }
  
//     async openDB(dbName: string = 'fileGraphDB', version: number = 1): Promise<void> {
//       await this.sendToWorker('openDB', { dbName, version });
//     }
  
//     async initializeDB(storeNames: string[]): Promise<void> {
//       await this.sendToWorker('initializeDB', { storeNames });
//     }
  
//     async getData(storeName: string, dbName: string = 'fileGraphDB'): Promise<any[]> {
//       const dataRetreived = await this.sendToWorker('getData', { storeName, dbName });
//       return dataRetreived;
//     }
  
//     async saveData(storeName: string, data: any, dbName: string = 'fileGraphDB'): Promise<void> {
//       await this.sendToWorker('saveData', { storeName, data, dbName });
//     }
    
//     async getItem(storeName: string, key: string, dbName: string = 'fileGraphDB'): Promise<any> {
//       const dataRetrieved = await this.sendToWorker('getItem', { storeName, key, dbName });
//       return dataRetrieved;
//     }

//     // TODO: this should be removed and replaced with the worker!
//     // async saveData(storeName: string, data: any[], dbName: string = 'fileGraphDB'): Promise<void> {
//     //   return new Promise((resolve, reject) => {
//     //     const request = indexedDB.open(dbName);
//     //     request.onerror = (event) => reject(`Error opening database: ${event}`);
//     //     request.onsuccess = (event) => {
//     //       const db = (event.target as IDBOpenDBRequest).result;
//     //       const transaction = db.transaction([storeName], 'readwrite');
//     //       const objectStore = transaction.objectStore(storeName);
    
//     //       data.forEach(item => {
//     //         console.log("i am put item in local item", item)
//     //         objectStore.put(item); // Use 'put' instead of 'add' to update existing records
//     //       });
    
//     //       transaction.oncomplete = () => resolve();
//     //       transaction.onerror = (event) => reject(`Error saving data: ${event}`);
//     //     };
//     //   });
//     // }

//   //   async saveData(storeName: string, data: any[], dbName: string = 'fileGraphDB'): Promise<void> {
//   //     return new Promise((resolve, reject) => {
//   //       const request = indexedDB.open(dbName);
//   //       request.onerror = (event) => reject(`Error opening database: ${event}`);
//   //       request.onsuccess = (event) => {
//   //         const db = (event.target as IDBOpenDBRequest).result;
//   //         const transaction = db.transaction([storeName], 'readwrite');
//   //         const objectStore = transaction.objectStore(storeName);
    
//   //         data.forEach(item => {
//   //           // Remove functions from item
//   //           const { cleanedItem, functionsFound } = removeFunctions(item);
    
//   //           // If any functions were removed, log a warning with the original item
//   //           if (functionsFound) {
//   //             console.warn('Item contains functions, which are not serializable. Original item:', item);
//   //           }
    
//   //           console.log("Saving cleaned item to IndexedDB:", cleanedItem);
//   //           objectStore.put(cleanedItem); // Use 'put' instead of 'add' to update existing records
//   //         });
    
//   //         transaction.oncomplete = () => resolve();
//   //         transaction.onerror = (event) => reject(`Error saving data: ${event}`);
//   //       };
//   //     });
//   //   }

//   }
  
//   const indexDBOverlay = new IndexDBWorkerOverlay();
//   export default indexDBOverlay;


class IndexDBWorkerOverlay {
  private worker: Worker;
  private callbacks: Map<string, (data: any) => void> = new Map();
  private isDBOpen: boolean = false;
  private dbName: string = 'fileGraphDB';
  private dbVersion: number = 1;

  constructor() {
      this.worker = new Worker('../../workers/memory_worker');
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
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

  private sendToWorker(action: string, data: any): Promise<any> {
      return new Promise((resolve, reject) => {
          const id = Date.now().toString();
          this.callbacks.set(id, (result) => {
              if (result && result.error) {
                  reject(result.error);
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
          await this.sendToWorker('openDB', { dbName, version: latestVersion });
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
      await this.sendToWorker('initializeDB', { storeNames });
  }

  async getData(storeName: string, dbName: string = this.dbName): Promise<any[]> {
      await this.ensureDBOpen();
      const dataRetrieved = await this.sendToWorker('getData', { storeName, dbName });
      return dataRetrieved;
  }

  async saveData(storeName: string, data: any, dbName: string = this.dbName): Promise<void> {
      await this.ensureDBOpen();
      await this.sendToWorker('saveData', { storeName, data, dbName });
  }

  async getItem(storeName: string, key: string, dbName: string = this.dbName): Promise<any> {
      await this.ensureDBOpen();
      const dataRetrieved = await this.sendToWorker('getItem', { storeName, key, dbName });
      return dataRetrieved;
  }
}

const indexDBOverlay = new IndexDBWorkerOverlay();
export default indexDBOverlay;