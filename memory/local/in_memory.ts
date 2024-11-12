interface InMemoryData {
    id?: string;
    key?: string;
    version?: number; // Added version field for CRDT handling
    globalTimestamp?: number; // Added global timestamp field for CRDT handling
    [key: string]: any;
  }
  
  class InMemory {
    private inMemoryStore: Record<string, InMemoryData[]>;
  
    constructor() {
      this.inMemoryStore = {}; // Initialize the in-memory store
      this.loadFromLocalStorage(); // Load existing data from localStorage
    }
  
    async createTableIfNotExists(tableName: string): Promise<void> {
      if (this.inMemoryStore[tableName]) {
        console.log(`Table "${tableName}" already exists in memory.`);
        return; // Table already exists
      }
  
      this.inMemoryStore[tableName] = [];
      console.log(`Table "${tableName}" created in memory.`);
      this.saveToLocalStorage();
    }
  
    private loadFromLocalStorage(): void {
      const storedData = localStorage.getItem('inMemoryStore');
      if (storedData) {
        this.inMemoryStore = JSON.parse(storedData);
        console.log("In-memory store loaded from localStorage:", this.inMemoryStore);
      }
    }
  
    private saveToLocalStorage(): void {
      localStorage.setItem('inMemoryStore', JSON.stringify(this.inMemoryStore));
    }
  
    async getAll(tableName: string): Promise<InMemoryData[]> {
      if (!this.inMemoryStore[tableName]) {
        console.warn(`Table "${tableName}" does not exist in memory.`);
        return [];
      }
      return this.inMemoryStore[tableName];
    }
  
    async saveData(tableName: string, data: InMemoryData, key?: string): Promise<void> {
      if (!this.inMemoryStore[tableName]) {
        console.warn(`Table "${tableName}" does not exist. Creating table "${tableName}".`);
        await this.createTableIfNotExists(tableName);
      }
  
      // Check if the item already exists
      const existingIndex = this.inMemoryStore[tableName].findIndex(item => item.id === key || item.key === key);
      if (existingIndex !== -1) {
        const existingItem = this.inMemoryStore[tableName][existingIndex];
  
        // Only update if the new item has a higher version or a greater globalTimestamp
        if ((data.version && existingItem.version && data.version > existingItem.version) ||
            (data.globalTimestamp && existingItem.globalTimestamp && data.globalTimestamp > existingItem.globalTimestamp)) {
          this.inMemoryStore[tableName][existingIndex] = data;
          console.log(`Updated item in table "${tableName}" with higher version or globalTimestamp.`);
        } else {
          console.log(`Skipped updating item in table "${tableName}" due to lower version or globalTimestamp.`);
        }
      } else {
        // Add new item if it doesn't already exist
        this.inMemoryStore[tableName].push(data);
        console.log(`Inserted new item into table "${tableName}".`);
      }
  
      // Save changes to localStorage
      this.saveToLocalStorage();
    }
  
    async checkIfTableExists(tableName: string): Promise<boolean> {
      return !!this.inMemoryStore[tableName];
    }
  
    async deleteData(tableName: string, key: string): Promise<void> {
      if (!this.inMemoryStore[tableName]) {
        console.warn(`Table "${tableName}" does not exist.`);
        return;
      }
  
      this.inMemoryStore[tableName] = this.inMemoryStore[tableName].filter(item => item.id !== key && item.key !== key);
      this.saveToLocalStorage();
    }
  }
  
  const inMemoryStore = new InMemory();
  export default inMemoryStore;
  