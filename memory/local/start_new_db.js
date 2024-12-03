import {generateUniqueId} from '../../utils/utils'
import indexDBOverlay from './file_worker';
import config from '../../configs/config.json';
import { clearAllScenes, reconstructFromGraphData } from '../../ui/graph_v2/create.js';
import { p2pSync } from '../../network/peer2peer_simple';
import { initiate } from '../vectorDB/vectorDbGateway';
import { refreshFileTree } from '../../memory/fileHandler.js';
import { sceneState } from '../collaboration/scene_colab';

let tabManager = null;
export async function createAndInitializeNewDatabaseInstance(customName = null) {
    try {
        // Clear SceneState first
        sceneState.clearState();
        
        // Step 1: Clear all scenes first
        clearAllScenes();

              // Dynamically import the TabManager getter only when needed
              try {
                if(!tabManager) {
                  const { getTabManager } = await import('../../main.js');
                   tabManager = getTabManager();
                }
                  if (tabManager) {
                      await tabManager.saveCurrentTabState();
                      await tabManager.clearAllTabs();
                  }
              } catch (error) {
                  console.warn('TabManager not available:', error);
              }
        
        // Clear file metadata - Initialize as Map instead of object
        window.fileMetadata = new Map();

        p2pSync.disconnectFromAllPeers();
        
        // Step 2: Close current database connection first
        // const currentDb = config.dbName;
        const currentDb = localStorage.getItem('latestDBName');
        if (currentDb) {
            console.log(`Closing current database: ${currentDb}`);
            await indexDBOverlay.closeAllConnections(currentDb);
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

        indexDBOverlay.setIsInitialized(false);
        await indexDBOverlay.initialize(newDbName);

        // Step 5: Initialize the new database with ALL stores including vectors
        // await indexDBOverlay.worker.postMessage({
        //     type: 'INIT_CONFIG',
        //     config: { dbName: newDbName }
        // });

        // Step 6: Open and initialize the new database with explicit vector store initialization
        await indexDBOverlay.openDB();
        
        // Get store names from config
        const storeNames = Object.keys(config.dbStores || {});
        
        // Ensure vectors store is included if not already in config
        if (!storeNames.includes('vectors')) {
            storeNames.push('vectors');
        }

        // Initialize all stores
        await indexDBOverlay.initializeDB(storeNames);

        // Step 7: Update databases list in localStorage
        const databases = JSON.parse(localStorage.getItem('databases')) || [];
        if (!databases.includes(newDbName)) {
            databases.push(newDbName);
            localStorage.setItem('databases', JSON.stringify(databases));
        }

  

        refreshFileTree();
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
        
        // Initialize p2pSync after IndexDB is ready
        await p2pSync.initialize(localStorage.getItem('myPeerId'));
        await p2pSync.loadAndDisplayAllPeers();
        
        // Load the graph data for the initial database
        const graphData = await indexDBOverlay.getData("graph");
        if (graphData && graphData.length > 0) {
            reconstructScene(graphData);
        }
    
        console.log("All databases initialized successfully");
    } catch (error) {
        console.error("Error initializing databases:", error);
        throw error;
    }
  }
  

export async function openDatabase(dbName) {
    try {
        console.log(`Opening database: ${dbName}`);

        try {
          if(!tabManager) {
            const { getTabManager } = await import('../../main.js');
             tabManager = getTabManager();
          }
            if (tabManager) {
                await tabManager.saveCurrentTabState();
                // await tabManager.clearAllTabs();
            }
        } catch (error) {
            console.warn('TabManager not available:', error);
        }
        
        // Clear SceneState first
        sceneState.clearState();
        
        // Clear file metadata
        window.fileMetadata = new Map();
        
        // Step 1: Disconnect from all peers first
        await p2pSync.disconnectFromAllPeers();
        
        // Step 2: Close current database connections
        await indexDBOverlay.closeAllConnections(config.dbName);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Step 3: Update config and localStorage
        config.dbName = dbName;
        localStorage.setItem('latestDBName', dbName);

        await indexDBOverlay.setIsInitialized(false);
        await indexDBOverlay.initialize(dbName);
        
        // Step 4: Open and initialize stores
        await indexDBOverlay.openDB();
        const storeConfigs = Object.entries(config.dbStores).map(([storeName, storeConfig]) => ({
            storeName,
            keyPath: storeConfig.keyPath || null,
            vectorConfig: storeConfig.vectorConfig || null
        }));
        await indexDBOverlay.initializeDB(storeConfigs.map(config => config.storeName));
        
        // Step 5: Reinitialize p2pSync with new database
        // Add small delay to ensure previous connections are fully closed
        await new Promise(resolve => setTimeout(resolve, 100));
        await p2pSync.initialize(localStorage.getItem('myPeerId'));
        await p2pSync.loadAndDisplayAllPeers();

        await initiate(true)
        
        // Step 6: Load and reconstruct graph data
        clearAllScenes();
        const graphData = await indexDBOverlay.getData("graph");
        if (graphData && graphData.length > 0) {
            await reconstructFromGraphData();
        }

        // NEW STEP: Restore saved tab state for this database
        try {
          if (tabManager) {
            await tabManager.restoreSavedTabState(dbName);
          }
        } catch (error) {
          console.warn('Error restoring tab state:', error);
        }

        refreshFileTree();
        
        console.log(`Database "${dbName}" opened successfully`);
        return true;
        
    } catch (error) {
        console.error(`Failed to open database "${dbName}":`, error);
        throw error;
    }
}
  