// memory_worker.js
let DEFAULT_DB_NAME;
const dbs = {}; // Map of dbName to dbInstance

// Initialize worker with config
self.addEventListener('message', function(e) {
  if (e.data.type === 'INIT_CONFIG') {
    DEFAULT_DB_NAME = e.data.config.dbName;
  }
});

async function openDB(storeConfigs, version = undefined, preserveExistingStores = false) {
  return new Promise((resolve, reject) => {
    const request = version
      ? indexedDB.open(DEFAULT_DB_NAME, version)
      : indexedDB.open(DEFAULT_DB_NAME);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;

      storeConfigs.forEach(({ storeName, keyPath }) => {
        if (db.objectStoreNames.contains(storeName)) {
          if (!preserveExistingStores) {
            db.deleteObjectStore(storeName);
            db.createObjectStore(storeName, { keyPath });
          }
          // If preserving existing stores, do nothing
        } else {
          db.createObjectStore(storeName, { keyPath });
        }
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


// async function initializeDB(storeConfigs) {
//   try {
//     // Ensure storeConfigs is present and valid
//     if (!storeConfigs || !Array.isArray(storeConfigs)) {
//       throw new Error('Store configs must be an array');
//     }

//     // Ensure the database is open
//     if (!dbs[DEFAULT_DB_NAME]) {
//       await openDB(storeConfigs); // Open without version
//     }

//     const db = dbs[DEFAULT_DB_NAME];
    
//     // Check for missing stores
//     const missingStores = storeConfigs.filter(
//       ({ storeName }) => !db.objectStoreNames.contains(storeName)
//     );

//     if (missingStores.length > 0) {
//       const newVersion = db.version + 1;
//       db.close();
//       delete dbs[DEFAULT_DB_NAME];
//       await openDB(storeConfigs, newVersion); // Trigger onupgradeneeded
//     }

//     return "Database initialized successfully";
//   } catch (error) {
//     console.error("Error initializing database:", error);
//     throw error;
//   }
// }

async function initializeDB(storeConfigs, preserveExistingStores = true) {
  try {
    if (!storeConfigs || !Array.isArray(storeConfigs)) {
      throw new Error('Store configs must be an array');
    }

    // Ensure the database is open
    if (!dbs[DEFAULT_DB_NAME]) {
      await openDB([], undefined, preserveExistingStores);
    }

    const db = dbs[DEFAULT_DB_NAME];

    // Identify missing stores
    const missingStores = storeConfigs.filter(
      ({ storeName }) => !db.objectStoreNames.contains(storeName)
    );

    if (missingStores.length > 0) {
      const newVersion = db.version + 1;
      db.close();
      delete dbs[DEFAULT_DB_NAME];
      await openDB(missingStores, newVersion, preserveExistingStores);
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

  console.log("deleting item from indexDB 0 day", key, storeName);
  try {
    if (!dbs[DEFAULT_DB_NAME]) {
      throw new Error(`Database "${DEFAULT_DB_NAME}" is not open`);
    }
    const db = dbs[DEFAULT_DB_NAME];
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction([storeName], "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      console.log("deleting item from indexDB", key, storeName); 

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

async function closeConnections(dbName) {
    return new Promise((resolve) => {
        const maxAttempts = 3;
        let attempts = 0;
        
        const tryClose = () => {
            attempts++;
            console.log(`Attempt ${attempts} to close connections for "${dbName}"`);

            if (dbs[dbName]) {
                const db = dbs[dbName];
                
                // Check for active transactions
                if (db.transaction && db.transaction.db === db) {
                    if (attempts < maxAttempts) {
                        console.log("Active transactions found, retrying in 300ms...");
                        setTimeout(tryClose, 300);
                        return;
                    }
                }

                // Close the connection
                db.close();
                delete dbs[dbName];
                
                // Add delay before confirming closure
                setTimeout(() => {
                    resolve(`Connections to "${dbName}" closed successfully`);
                }, 200);
            } else {
                console.warn(`Database "${dbName}" is not open, no connections to close.`);
                resolve(`No open connections for "${dbName}"`);
            }
        };

        // Start the close attempt process
        tryClose();
    });
}

async function deleteDatabase() {
    try {
        if (!DEFAULT_DB_NAME) {
            throw new Error("No default database specified");
        }

        // First ensure all connections are closed
        await closeConnections(DEFAULT_DB_NAME);
        
        // Add delay after closing connections
        await new Promise(resolve => setTimeout(resolve, 300));

        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(DEFAULT_DB_NAME);

            deleteRequest.onsuccess = function () {
                delete dbs[DEFAULT_DB_NAME];
                resolve(`Database "${DEFAULT_DB_NAME}" deleted successfully`);
            };

            deleteRequest.onerror = function (event) {
                reject(new Error(
                    `Error deleting database "${DEFAULT_DB_NAME}": ${event.target.error.message}`
                ));
            };

            deleteRequest.onblocked = function () {
                // Try one more time to close connections
                closeConnections(DEFAULT_DB_NAME).then(() => {
                    setTimeout(() => {
                        const retryDelete = indexedDB.deleteDatabase(DEFAULT_DB_NAME);
                        retryDelete.onsuccess = () => resolve(`Database "${DEFAULT_DB_NAME}" deleted successfully after retry`);
                        retryDelete.onerror = (e) => reject(new Error(`Final deletion attempt failed: ${e.target.error.message}`));
                    }, 300);
                });
            };
        });
    } catch (error) {
        console.error(`Failed to delete database: ${error.message}`);
        throw error;
    }
}


async function getAllDataFromStore(storeName) {
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
            `Error fetching all data from ${storeName}: ${event.target.error.message}`
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
          if(key) saveData.key = key;

          // Pass the key from the top-level event.data
          result = await saveDataMemoryWorker(storeName, saveData, event.data.key);
          break;
        }
        case "getAll":
        result = await getAllDataFromStore(data.storeName);
        break;
        
      case "getItem":
        result = await getItem(data.storeName, key);
        break;
      case "deleteItem":
        console.log("deleting item from indexDB 1 day", data.key, data.storeName);
        result = await deleteItem(data.storeName, data.key);
        break;
        case "closeConnections":
        result = await closeConnections(data.dbName);
        break;
        case "deleteDatabase":
        // First close connections
        await closeConnections(DEFAULT_DB_NAME);
        // Then actually delete the database
        result = await deleteDatabase();
        break;
      case "clearStore": {
        const { storeName } = data;
        const tx = db.transaction(storeName, 'readwrite');
        await tx.objectStore(storeName).clear();
        await tx.done;
        return { success: true };
      }
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
