let dbInstance = null;

export async function openDB() {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fileGraphDB', 1);

    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('islands')) {
        db.createObjectStore('islands', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('directories')) {
        db.createObjectStore('directories', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = function(event) {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = function(event) {
      reject(new Error(`Error opening IndexedDB: ${event.target.error}`));
    };
  });
}

export async function initializeDB() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['files', 'islands', 'directories'], 'readwrite');

    tx.oncomplete = function() {
      resolve();
    };

    tx.onerror = function(event) {
      reject(new Error(`Error initializing IndexedDB: ${event.target.error}`));
    };
  });
}

export async function saveData(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const dataArray = JSON.parse(JSON.stringify(data)); // Convert MobX observable to plain array
    dataArray.forEach(item => {
      store.put(item);
    });

    tx.oncomplete = function() {
      resolve();
    };

    tx.onerror = function(event) {
      reject(`Error saving data to ${storeName}`);
    };
  });
}

export async function getData(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = function(event) {
      resolve(event.target.result);
    };

    request.onerror = function(event) {
      reject(`Error fetching data from ${storeName}`);
    };
  });
}
