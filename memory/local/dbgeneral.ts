let dbInstance: IDBDatabase | null = null;

export async function openDB(dbName: string = 'fileGraphDB', version: number = 1): Promise<IDBDatabase> {
  if (dbInstance && dbInstance.name === dbName && dbInstance.version === version) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = function (event: IDBVersionChangeEvent) {
      const db = (event.target as IDBRequest).result as IDBDatabase;
      const stores = ["directories", "files", "graph"];
      
      stores.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
        }
      });
    };

    request.onsuccess = function (event: Event) {
      if (event.target) {
        dbInstance = (event.target as IDBRequest).result as IDBDatabase;
        resolve(dbInstance);
      } else {
        reject(new Error('Error opening IndexedDB: event target is null'));
      }
    };

    request.onerror = function (event: Event) {
      reject(new Error(`Error opening IndexedDB: ${(event.target as IDBRequest).error?.message || 'unknown error'}`));
    };
  });
}

export async function initializeDB(storeNames: string[]): Promise<void> {
  try {
    let db = await openDB();
    
    // Check if all required stores exist
    const missingStores = storeNames.filter(store => !db.objectStoreNames.contains(store));
    
    if (missingStores.length > 0) {
      // Close the current connection
      db.close();
      
      // Increment the version number
      const newVersion = db.version + 1;
      
      // Open a new connection with the incremented version
      db = await openDB('fileGraphDB', newVersion);
    }

  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

export async function getData(storeName: string, dbName: string = 'fileGraphDB'): Promise<any[]> {
  try {
    const db = await openDB(dbName);

    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Object store ${storeName} does not exist in database ${dbName}`);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = function (event: Event) {
        resolve((event.target as IDBRequest).result);
      };

      request.onerror = function (event: Event) {
        reject(new Error(`Error fetching data from ${storeName}: ${(event.target as IDBRequest).error?.message || 'unknown error'}`));
      };
    });
  } catch (error) {
    console.error(`Error in getData for store ${storeName}:`, error);
    throw error;
  }
}

export async function saveData(storeName: string, data: any, dbName: string = 'fileGraphDB'): Promise<void> {
  const db = await openDB(dbName);

  // Check if the store exists, recreate the database with a new version if it doesn't
  if (!db.objectStoreNames.contains(storeName)) {
    db.close();
    const newVersion = db.version + 1;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, newVersion);

      request.onupgradeneeded = function (event: IDBVersionChangeEvent) {
        const newDb = (event.target as IDBRequest).result as IDBDatabase;
        newDb.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
      };

      request.onsuccess = function (event: Event) {
        const newDb = (event.target as IDBRequest).result as IDBDatabase;
        const tx = newDb.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);

        try {
          if (Array.isArray(data)) {
            data.forEach(item => store.put(item));
          } else {
            store.put(data);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(new Error(`Error saving data to ${storeName}`));
        } catch (err) {
          reject(new Error(`Failed to save data to ${storeName}: ${err.message}`));
        }
      };

      request.onerror = function (event: Event) {
        reject(new Error(`Error opening IndexedDB: ${(event.target as IDBRequest).error?.message || 'unknown error'}`));
      };
    });
  } else {
    // Proceed as usual if the store exists
    return new Promise((resolve, reject) => {
      const tx = db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);

      try {
        if (Array.isArray(data)) {
          data.forEach(item => store.put(item));
        } else {
          store.put(data);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new Error(`Error saving data to ${storeName}`));
      } catch (err) {
        reject(new Error(`Failed to save data to ${storeName}: ${err.message}`));
      }
    });
  }
}
