// memory_worker.js
let DEFAULT_DB_NAME;
const dbs = {}; // Map of dbName to dbInstance

// Initialize worker with config
self.addEventListener('message', function(e) {
  if (e.data.type === 'INIT_CONFIG') {
    DEFAULT_DB_NAME = e.data.config.dbName;
  }
});

async function openDB(storeConfigs, version = undefined) {
  return new Promise((resolve, reject) => {
    const request = version
      ? indexedDB.open(DEFAULT_DB_NAME, version)
      : indexedDB.open(DEFAULT_DB_NAME);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      
      // Delete and recreate all stores defined in storeConfigs
      storeConfigs.forEach(({ storeName, keyPath }) => {
        if (db.objectStoreNames.contains(storeName)) {
          console.log(`Deleting existing object store: ${storeName}`);
          db.deleteObjectStore(storeName);
        }
        db.createObjectStore(storeName, { keyPath });
      });
    };

    request.onsuccess = function (event) {
      const db = event.target.result;
      dbs[DEFAULT_DB_NAME] = db;

      // Listen for close events
      db.onclose = () => {
        delete dbs[DEFAULT_DB_NAME];
      };

      resolve({ message: "Database opened successfully", version: db.version });
    };

    request.onerror = function (event) {
      console.error(
        `Error opening IndexedDB: ${event.target.error.message} | Database: ${DEFAULT_DB_NAME}`
      );
      reject(
        new Error(
          `Error opening IndexedDB: ${event.target.error.message} | Database: ${DEFAULT_DB_NAME}`
        )
      );
    };
  });
}
async function initializeDB(storeConfigs) {
  try {
    // Ensure storeConfigs is present and valid
    if (!storeConfigs || !Array.isArray(storeConfigs)) {
      throw new Error('Store configs must be an array');
    }

    // Ensure the database is open
    if (!dbs[DEFAULT_DB_NAME]) {
      await openDB(storeConfigs); // Open without version
    }

    const db = dbs[DEFAULT_DB_NAME];
    
    // Check for missing stores
    const missingStores = storeConfigs.filter(
      ({ storeName }) => !db.objectStoreNames.contains(storeName)
    );

    if (missingStores.length > 0) {
      console.log('Missing stores detected:', missingStores.map(s => s.storeName));
      const newVersion = db.version + 1;
      db.close();
      delete dbs[DEFAULT_DB_NAME];
      await openDB(storeConfigs, newVersion); // Trigger onupgradeneeded
    }

    return "Database initialized successfully";
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

async function getData(storeName) {
  try {
    if (!dbs[DEFAULT_DB_NAME]) {
      throw new Error(`Database "${DEFAULT_DB_NAME}" is not open`);
    }
    
    const db = dbs[DEFAULT_DB_NAME];
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store "${storeName}" not found in database`);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function (event) {
        reject(
          new Error(
            `Error fetching data from ${storeName}: ${event.target.error.message}`
          )
        );
      };
    });
  } catch (error) {
    throw error;
  }
}

async function saveDataMemoryWorker(storeName, data, key = null, retries = 3) {
  try {
    if (!dbs[DEFAULT_DB_NAME] || dbs[DEFAULT_DB_NAME].closePending) {
      throw new Error(`Database "${DEFAULT_DB_NAME}" is not open`);
    }

    const db = dbs[DEFAULT_DB_NAME];

    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction([storeName], "readwrite");
      } catch (error) {
        if (error.name === "InvalidStateError" && retries > 0) {
          setTimeout(() => {
            saveDataMemoryWorker(storeName, data, key, retries - 1)
              .then(resolve)
              .catch(reject);
          }, 1000);
          return;
        }
        reject(error);
        return;
      }

      const store = tx.objectStore(storeName);

      if (Array.isArray(data)) {
        data.forEach((item) => {
          if (key !== null) {
            store.put(item, key);
          } else {
            store.put(item);
          }
        });
      } else {
        if (key !== null) {
          store.put(data, key);
        } else {
          store.put(data);
        }
      }

      tx.oncomplete = () => resolve("Data saved successfully");
      tx.onerror = () => reject(new Error(`Error saving data to ${storeName}`));
    });
  } catch (error) {
    console.error("Error in saveDataMemoryWorker:", error);
    throw error;
  }
}



async function deleteItem(storeName, key) {
  try {
    if (!dbs[DEFAULT_DB_NAME]) {
      throw new Error(`Database "${DEFAULT_DB_NAME}" is not open`);
    }
    const db = dbs[DEFAULT_DB_NAME];
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction([storeName], "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(new Error(`Error deleting item from ${storeName}`));
    });
  } catch (error) {
    throw error;
  }
}

async function getItem(storeName, key) {
  try {
    if (!dbs[DEFAULT_DB_NAME]) {
      throw new Error(`Database "${DEFAULT_DB_NAME}" is not open`);
    }
    const db = dbs[DEFAULT_DB_NAME];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function (event) {
        reject(
          new Error(
            `Error fetching item from ${storeName}: ${event.target.error.message}`
          )
        );
      };
    });
  } catch (error) {
    throw error;
  }
}

self.onmessage = async function (event) {
  const { id, action, data, key, type } = event.data;

  console.log("onmessage .. id, action, data, type = ", id, action, data, type, key,)

  // Handle config initialization separately
  if (type === 'INIT_CONFIG') {
    DEFAULT_DB_NAME = event.data.config.dbName;  // Get dbName from the config message
    return;
  }

  try {
    let result;
    switch (action) {
      case "openDB":
        result = await openDB(data.storeConfigs, data.version);
        break;
      case "initializeDB":
        result = await initializeDB(data.storeConfigs);
        break;
      case "getData":
        result = await getData(data.storeName);
        break;
      case 'saveData': {
          const { storeName, data: saveData } = data;
          // Pass the key from the top-level event.data
          result = await saveDataMemoryWorker(storeName, saveData, event.data.key);
          break;
        }
        
      case "getItem":
        console.log("memory worker getItem", data, data.storeName, key, data.key)
        result = await getItem(data.storeName, key);
        break;
      case "deleteItem":
        result = await deleteItem(data.storeName, data.key);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    self.postMessage({ id, data: result });
  } catch (error) {
    self.postMessage({
      id,
      error: `${error.message} | Action: ${action} | Data: ${JSON.stringify(
        data
      )}`,
    });
  }
};