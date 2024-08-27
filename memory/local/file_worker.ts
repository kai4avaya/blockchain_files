class IndexDBWorkerOverlay {
    private worker: Worker;
    private callbacks: Map<string, (data: any) => void> = new Map();
  
    constructor() {
      this.worker = new Worker('../../workers/memory_worker');
      console.log("this.worker", this.worker);
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
      return new Promise((resolve) => {
        const id = Date.now().toString();
        this.callbacks.set(id, resolve);
        this.worker.postMessage({ id, action, data });
      });
    }
  
    async openDB(dbName: string = 'fileGraphDB', version: number = 1): Promise<void> {
      await this.sendToWorker('openDB', { dbName, version });
    }
  
    async initializeDB(storeNames: string[]): Promise<void> {
      await this.sendToWorker('initializeDB', { storeNames });
    }
  
    async getData(storeName: string, dbName: string = 'fileGraphDB'): Promise<any[]> {
      const dataRetreived = await this.sendToWorker('getData', { storeName, dbName });
      console.log("i have retrieved the data storeName, data",storeName, dataRetreived);
      return dataRetreived;
    }
  
    async saveData(storeName: string, data: any, dbName: string = 'fileGraphDB'): Promise<void> {
      console.log("sending data to worker see ya storeName, data!",storeName, data)
      await this.sendToWorker('saveData', { storeName, data, dbName });
    }
  }
  
  const indexDBOverlay = new IndexDBWorkerOverlay();
  export default indexDBOverlay;