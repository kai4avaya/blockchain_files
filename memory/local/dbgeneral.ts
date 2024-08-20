let dbInstance: IDBDatabase | null = null;

export async function openDB(dbName: string = 'fileGraphDB', version: number = 1): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = function (event: IDBVersionChangeEvent) {
      const db = (event.target as IDBRequest).result as IDBDatabase;

      if (!db.objectStoreNames.contains('graph')) {
        db.createObjectStore('graph', { keyPath: 'id', autoIncrement: true });
      }

      // Add other object stores dynamically based on the needs
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
      if (event.target) {
        reject(new Error(`Error opening IndexedDB: ${(event.target as IDBRequest).error?.message || 'unknown error'}`));
      } else {
        reject(new Error('Error opening IndexedDB: unknown error'));
      }
    };
  });
}

export async function saveData(storeName: string, data: any, dbName: string = 'fileGraphDB'): Promise<void> {
  const db = await openDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);

    store.clear(); // Clear the store first
    if (Array.isArray(data)) {
      data.forEach(item => store.put(item));
    } else {
      store.put(data);
    }

    tx.oncomplete = function () {
      resolve();
    };

    tx.onerror = function (event: Event) {
      reject(new Error(`Error saving data to ${storeName}: ${(event.target as IDBRequest).error?.message || 'unknown error'}`));
    };
  });
}

export async function getData(storeName: string, dbName: string = 'fileGraphDB'): Promise<any[]> {
  const db = await openDB(dbName);
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
}
