import {generateUniqueId} from '../../utils/utils'
import indexDBOverlay from './file_worker';
import config from '../../configs/config.json';
import { clearAllScenes } from '../../ui/graph_v2/create.js';


export async function createAndInitializeNewDatabaseInstance(customName = null) {
    try {
        // Step 1: Clear all scenes first
        clearAllScenes();
        
        // Step 2: Close current database connection first
        const currentDb = config.dbName;
        if (currentDb) {
            console.log(`Closing current database: ${currentDb}`);
            await indexDBOverlay.closeAllConnections(currentDb);
            // Add small delay to ensure connection is fully closed
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Step 3: Generate a unique name for the new database
        const randomCode = generateUniqueId().slice(-3);
        const newDbName = customName 
            ? `fileGraphDB_${randomCode}_${customName.trim()}`
            : `fileGraphDB_${randomCode}`;

        console.log(`Creating new database: ${newDbName}`);

        // Step 4: Update the configuration with the new database name
        config.dbName = newDbName;
        localStorage.setItem('latestDBName', newDbName);

        // Step 5: Initialize the new database
        await indexDBOverlay.worker.postMessage({
            type: 'INIT_CONFIG',
            config: { dbName: newDbName }
        });

        // Step 6: Open and initialize the new database
        await indexDBOverlay.openDB();
        const storeConfigs = Object.entries(config.dbStores).map(([storeName, storeConfig]) => ({
            storeName,
            keyPath: storeConfig.keyPath || null,
            vectorConfig: storeConfig.vectorConfig || null
        }));
        await indexDBOverlay.initializeDB(storeConfigs.map(config => config.storeName));

        // Step 7: Update databases list in localStorage
        const databases = JSON.parse(localStorage.getItem('databases')) || [];
        if (!databases.includes(newDbName)) {
            databases.push(newDbName);
            localStorage.setItem('databases', JSON.stringify(databases));
        }

        console.log(`New database "${newDbName}" created and initialized successfully.`);
        return newDbName;
    } catch (error) {
        console.error('Error in createAndInitializeNewDatabaseInstance:', error);
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
  