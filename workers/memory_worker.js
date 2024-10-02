let dbInstance = null;

async function openDB(dbName, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      
      // Re-create the object stores with the new keyPath
      // First, delete existing stores if they exist
      ['directories', 'files', 'graph'].forEach(storeName => {
        if (db.objectStoreNames.contains(storeName)) {
          db.deleteObjectStore(storeName);
        }
      });

      // Now create the stores with the correct keyPath
      db.createObjectStore('directories', { keyPath: 'id' });
      db.createObjectStore('files', { keyPath: 'id' });
      db.createObjectStore('graph', { keyPath: 'uuid' });
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



async function openDB_new(dbName, version, storeConfigs=storeConfigs) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      
      // Delete existing stores if they exist
      Array.from(db.objectStoreNames).forEach(storeName => {
        db.deleteObjectStore(storeName);
      });

      // Create new stores based on the provided configurations
      storeConfigs.forEach(config => {
        const store = db.createObjectStore(config.name, { keyPath: config.keyPath });
        
        // Add indexes if specified
        if (config.indexes) {
          config.indexes.forEach(index => {
            store.createIndex(index.name, index.keyPath, index.options);
          });
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

async function initializeDB_new(dbName, storeConfigs) {
  try {
    // Open the database with version 1
    let db = await openDB(dbName, 1, storeConfigs);

    // Check if all required stores exist
    const missingStores = storeConfigs.filter(config => 
      !db.objectStoreNames.contains(config.name)
    );

    // If there are missing stores, upgrade the database
    if (missingStores.length > 0) {
      const newVersion = db.version + 1;
      db.close();
      db = await openDB(dbName, newVersion, storeConfigs);
    }

    return 'Database initialized successfully';
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Example usage
const storeConfigs = [
  { 
    name: 'directories', 
    keyPath: 'id',
    indexes: [
      { name: 'nameIndex', keyPath: 'name', options: { unique: false } }
    ]
  },
  { 
    name: 'files', 
    keyPath: 'id',
    indexes: [
      { name: 'nameIndex', keyPath: 'name', options: { unique: false } },
      { name: 'typeIndex', keyPath: 'type', options: { unique: false } }
    ]
  },
  { 
    name: 'graph', 
    keyPath: 'uuid'
  }
];

async function initializeDB(storeNames) {
  try {
    const dbName = 'fileGraphDB';

    // Open the database with a higher version to trigger onupgradeneeded
    let db = await openDB(dbName);

    const missingStores = storeNames.filter(store => !db.objectStoreNames.contains(store));

    if (missingStores.length > 0) {
      const newVersion = db.version + 1;
      db.close();
      db = await openDB(dbName, newVersion);
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
        result = await getData(data.storeName, data.dbName);

        break;
      case 'saveData':
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