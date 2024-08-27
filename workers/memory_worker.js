let dbInstance = null;

async function openDB(dbName, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      const stores = ["directories", "files", "graph"];
      
      stores.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
        }
      });
    };

    request.onsuccess = function (event) {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = function (event) {
      reject(new Error(`Error opening IndexedDB: ${event.target.error.message}`));
    };
  });
}

async function initializeDB(storeNames) {
  try {
    let db = await openDB('fileGraphDB');
    
    const missingStores = storeNames.filter(store => !db.objectStoreNames.contains(store));
    
    if (missingStores.length > 0) {
      db.close();
      const newVersion = db.version + 1;
      db = await openDB('fileGraphDB', newVersion);
    }

    return 'Database initialized successfully';
  } catch (error) {
    throw error;
  }
}

async function getData(storeName, dbName) {
  try {
    const db = await openDB(dbName);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function (event) {
        reject(new Error(`Error fetching data from ${storeName}: ${event.target.error.message}`));
      };
    });
  } catch (error) {
    throw error;
  }
}

async function saveData(storeName, data, dbName) {
  try {
    let db = await openDB(dbName);

    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      const newVersion = db.version + 1;
      db = await openDB(dbName, newVersion);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);

      if (Array.isArray(data)) {
        data.forEach(item => store.put(item));
      } else {
        store.put(data);
      }

      tx.oncomplete = () => resolve("Data saved successfully");
      tx.onerror = () => reject(new Error(`Error saving data to ${storeName}`));
    });
  } catch (error) {
    throw error;
  }
}

self.onmessage = async function(event) {
  const { id, action, data } = event.data;

  try {
    let result;
    switch (action) {
      case 'openDB':
        result = await openDB(data.dbName, data.version);
        break;
      case 'initializeDB':
        result = await initializeDB(data.storeNames);
        break;
      case 'getData':
        console.log("just recieved that yummy data im the getdata memory_worker", data);
        result = await getData(data.storeName, data.dbName);

        console.log("im dat sweet getData result in the worker ", result);
        break;
      case 'saveData':
        console.log("just recieved that yummy data im the savedata memory_worker", data);
        result = await saveData(data.storeName, data.data, data.dbName);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    self.postMessage({ id, data: result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};