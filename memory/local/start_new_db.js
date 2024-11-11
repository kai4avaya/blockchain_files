import {generateUniqueId} from '../../utils/utils'
import indexDBOverlay from './file_worker';


export async function createAndInitializeNewDatabaseInstance() {
    // Step 1: Ensure all pending operations are completed
    if (indexDBOverlay.isDBOpen) {
      await Promise.all(indexDBOverlay.pendingOperations.values());
      await indexDBOverlay.closeAllConnections(config.dbName);
    }
  
    // Step 2: Generate a unique name for the new database
    const randomCode = generateUniqueId();
    const newDbName = `fileGraphDB_${randomCode}`;
  
    // Step 3: Update the configuration with the new database name
    config.dbName = newDbName;
    localStorage.setItem('latestDBName', newDbName);
  
    // Step 4: Reopen and initialize the new database
    try {
      // Ensure the database worker is aware of the new database name
      indexDBOverlay.worker.postMessage({
        type: 'INIT_CONFIG',
        config: { dbName: newDbName }
      });
  
      // Reopen and initialize the database with the configured stores
      await indexDBOverlay.openDB(); // No need for forceRefresh if the old DB is closed
      const storeConfigs = Object.entries(config.dbStores).map(([storeName, storeConfig]) => ({
        storeName,
        keyPath: storeConfig.keyPath || null,
        vectorConfig: storeConfig.vectorConfig || null
      }));
      await indexDBOverlay.initializeDB(storeConfigs.map(config => config.storeName));
  
      console.log(`New database "${newDbName}" created and initialized successfully.`);
    } catch (error) {
      console.error(`Failed to create and initialize the new database "${newDbName}":`, error);
      throw error;
    }
  }
  

  function getOrCreateDatabaseName() {
    let dbName = localStorage.getItem('latestDBName');
    if (!dbName) {
      // Create a new database instance if none exists
      dbName = createNewDatabaseInstance();
    }
    return dbName;
  }
  
  
  export async function initializeDatabases() {
    try {
      // Set the dbName before initializing databases
      config.dbName = getOrCreateDatabaseName();
  
      const storeConfigs = Object.entries(config.dbStores).map(([storeName, storeConfig]) => ({
        storeName,
        keyPath: storeConfig.keyPath || null,
        vectorConfig: storeConfig.vectorConfig || null
      }));
  
      await indexDBOverlay.openDB();
      await indexDBOverlay.initializeDB(storeConfigs.map(config => config.storeName));
      
      // Initialize vectorDB gateway after IndexDB is ready
      await initiate();
  
      console.log("All databases initialized successfully");
    } catch (error) {
      console.error("Error initializing databases:", error);
      throw error;
    }
  }
  