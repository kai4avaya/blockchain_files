// memory_worker.js
const dbs = {}; // Map of dbName to dbInstance
async function openDB(dbName, version = undefined) {
  return new Promise((resolve, reject) => {
    
    const request = version ? indexedDB.open(dbName, version) : indexedDB.open(dbName);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      
      // Define the object stores based on dbName
      if (dbName === 'fileGraphDB') {
        ['directories', 'files', 'graph'].forEach(storeName => {
          if (db.objectStoreNames.contains(storeName)) {
            console.log(`Deleting existing object store: ${storeName}`);
            db.deleteObjectStore(storeName);
          }
        });
        db.createObjectStore('directories', { keyPath: 'id' });
        db.createObjectStore('files', { keyPath: 'id' });
        db.createObjectStore('graph', { keyPath: 'uuid' });
      } else if (dbName === 'summarizationDB') {
        if (db.objectStoreNames.contains('summaries')) {
          db.deleteObjectStore('summaries');
        }
        db.createObjectStore('summaries', { keyPath: 'fileId' }); // Assuming 'fileId' as keyPath
      }
      // Add other databases and their stores as needed
    };
    request.onsuccess = function (event) {
      const db = event.target.result;
      dbs[dbName] = db;
      
      // Listen for close events
      db.onclose = () => {
        delete dbs[dbName];
      };
      
      resolve({ message: 'Database opened successfully', version: db.version });
    };

    request.onerror = function (event) {
      console.error(`Error opening IndexedDB: ${event.target.error.message} | Database: ${dbName}`);
      reject(new Error(`Error opening IndexedDB: ${event.target.error.message} | Database: ${dbName}`));
    };
  });
}

async function initializeDB(storeNames, dbName = 'fileGraphDB') {
  try {
    // Ensure the database is open
    if (!dbs[dbName]) {
      await openDB(dbName); // Open without version
    }

    const db = dbs[dbName];
    const missingStores = storeNames.filter(store => !db.objectStoreNames.contains(store));

    if (missingStores.length > 0) {
      const newVersion = db.version + 1;
      db.close();
      await openDB(dbName, newVersion); // Trigger onupgradeneeded
    }

    return 'Database initialized successfully';
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

async function getData(storeName, dbName = 'fileGraphDB') {
  try {
    if (!dbs[dbName]) {
      throw new Error(`Database "${dbName}" is not open`);
    }
    const db = dbs[dbName];
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

// async function saveData(storeName, data, dbName = 'fileGraphDB') {
//   try {
//     if (!dbs[dbName]) {
//       throw new Error(`Database "${dbName}" is not open`);
//     }
//     const db = dbs[dbName];

//     return new Promise((resolve, reject) => {
//       const tx = db.transaction([storeName], 'readwrite');
//       const store = tx.objectStore(storeName);

//       if (Array.isArray(data)) {
//         data.forEach(item => {
//           console.log("PUT i am put item from memory_worker", item);
//           store.put(item);
//         });
//       } else {
//         store.put(data);
//       }

//       tx.oncomplete = () => resolve("Data saved successfully");
//       tx.onerror = () => reject(new Error(`Error saving data to ${storeName}`));
//     });
//   } catch (error) {
//     throw error;
//   }
// }


async function saveData(storeName, data, dbName = 'fileGraphDB', retries = 3) {
  try {
    if (!dbs[dbName] || dbs[dbName].closePending) {
      await openDB(dbName);
    }
    
    const db = dbs[dbName];

    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction([storeName], 'readwrite');
      } catch (error) {
        if (error.name === 'InvalidStateError' && retries > 0) {
          setTimeout(() => {
            saveData(storeName, data, dbName, retries - 1).then(resolve).catch(reject);
          }, 1000); // Wait for 1 second before retrying
          return;
        } else if (error.name === 'NotFoundError') {
          // Attempt to create the missing object store
          const version = db.version + 1;
          db.close();
          openDB(dbName, version).then(() => {
            // Retry the save operation after creating the store
            saveData(storeName, data, dbName).then(resolve).catch(reject);
          }).catch(reject);
          return;
        } else {
          reject(error);
          return;
        }
      }

      const store = tx.objectStore(storeName);

      if (Array.isArray(data)) {
        data.forEach(item => {
          store.put(item);
        });
      } else {
        store.put(data);
      }

      tx.oncomplete = () => resolve("Data saved successfully");
      tx.onerror = () => reject(new Error(`Error saving data to ${storeName}`));
    });
  } catch (error) {
    console.error('Error in saveData:', error);
    throw error;
  }
}

async function getItem(storeName, key, dbName = 'fileGraphDB') {
  try {
    if (!dbs[dbName]) {
      throw new Error(`Database "${dbName}" is not open`);
    }
    const db = dbs[dbName];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function (event) {
        reject(new Error(`Error fetching item from ${storeName}: ${event.target.error.message}`));
      };
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
        result = await initializeDB(data.storeNames, data.dbName);
        break;
      case 'getData':
        result = await getData(data.storeName, data.dbName);
        break;
      case 'saveData':
        result = await saveData(data.storeName, data.data, data.dbName);
        break;
      case 'getItem':
        result = await getItem(data.storeName, data.key, data.dbName);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    self.postMessage({ id, data: result });
  } catch (error) {
    // Enhanced error message including database and store information
    self.postMessage({ id, error: `${error.message} | Action: ${action} | Data: ${JSON.stringify(data)}` });
  }
};
