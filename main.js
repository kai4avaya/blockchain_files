// import { editor } from "./quillEditor.js";

// import { sceneState } from "./memory/collaboration/scene_colab";
// import { initializeGraph, share3dDat } from "./ui/graph_v2/create";
import { share3dDat } from "./ui/graph_v2/create";
import { getObjectUnderPointer, initiateMove} from "./ui/graph_v2/move";
import {
  initializeFileSystem,
  getFileSystem,
} from "./memory/collaboration/file_colab";
import { showPopup } from "./ui/popup.js";
import { sceneState } from "./memory/collaboration/scene_colab";
import { p2pSync } from "./network/peer2peer_simple"; // Import the P2PSync class
import embeddingWorker from "./ai/embeddings.js";
import { initiate } from "./memory/vectorDB/vectorDbGateway.js"; // Assuming your initiate function is exported
import { initiate_gui_controls } from "./ui/gui.listens.js";
import indexDBOverlay from "./memory/local/file_worker";
import { throttle, generateUniqueId } from "./utils/utils";
import { TabManager } from "./ui/components/codemirror_md_copy/codemirror-rich-markdoc/editor/extensions/tabManager";
import { initializeWorker, updateFileTreeUI } from "./memory/fileHandler.js";
import config from './configs/config.json';
import { dbSyncManager } from "./memory/collaboration/dbState_sync"; // need this so it activates!
import { setupDatabaseModal } from './ui/components/database_modal/modalHandler.js';
import in_memory_store from './memory/local/in_memory'; // Adjust the import path as necessary
// import settingsHandler from './ui/components/se/ttings_modal_handler.js';
import {settingsPills} from './ui/components/settings_pills.js';
import { eventBus } from './ui/eventBus.js';
import { ShareManager } from "./network/share_manager";
// import {createMiniMap} from './ui/graph_v2/createMiniMap.js';
import { initializeSearchHandler } from './ui/components/search/searchHandler.js';

// Call the function to set up the search handler

let tabManager = null;
const userId = "kai";
localStorage.setItem("login_block", userId);

const p2pSync_instance = p2pSync;

// Create a global instance holder
let tabManagerInstance = null;

// Function to initialize and get the TabManager instance
export function getTabManager() {
    if (!tabManagerInstance) {
        const editorApp = document.getElementById("editor-app");
        if (editorApp) {
            tabManagerInstance = new TabManager(editorApp);
        }
    }
    return tabManagerInstance;
}

async function main() {
  embeddingWorker.initialize();
  initializeWorker();
  setupDatabaseModal(); 
  initializeDatabases();
  in_memory_store.loadFromLocalStorage();
  initiateMove();

  settingsPills.setupEventListeners();
  ShareManager.handleIncomingShareLink();
  
  initializeSearchHandler();


  
  try {
    await setupMarkdownEditor();
    console.log("Markdown editor setup completed");
  } catch (error) {
    console.error("Error setting up Markdown editor:", error);
  }
 
  await initializeFileSystem();
  const fileSystem = getFileSystem();

  fileSystem.onReady(() => {
    // Perform operations that require the file system
  });

  updateFileTreeUI()

  // Initialize the graph and SceneState
  // await initializeGraph();

  initiate_gui_controls();

  const { renderer, scene, nonBloomScene, mouseOverlay } = share3dDat();
  // const updateMiniMap = createMiniMap()


  await sceneState.initialize(scene, nonBloomScene);


  if (!renderer) {
    console.error("Renderer is not initialized.");
    return;
  }

  // Get the canvas element from the renderer
  const canvas = renderer.domElement;

  p2pSync_instance.setMouseOverlay(mouseOverlay);

  addEventListeners(canvas);
}
const handleQuickClick = throttle(async (event) => {
  const selectedObject = getObjectUnderPointer(event, "sphere");
  if (selectedObject) {
    console.log("GOT ME A double QUICK CLICK main.js");
    const nodeId = selectedObject.userData.id;
    const fileSystem = getFileSystem();
    const fileMetadata = await fileSystem.getMetadata(nodeId, "file");

    if (fileMetadata) {
      console.log(
        "GOT ME A QUICK  DBL fileMetadata CLICK in main.js",
        fileMetadata
      );
      showPopup(fileMetadata, event.clientX, event.clientY);
    }
  }
}, 300);




// export async function initializeDatabases() {
//   try {
//     const storeConfigs = Object.entries(config.dbStores).map(([storeName, storeConfig]) => ({
//       storeName,
//       keyPath: storeConfig.keyPath || null,
//       vectorConfig: storeConfig.vectorConfig || null
//     }));

//     await indexDBOverlay.openDB();
//     await indexDBOverlay.initializeDB(storeConfigs.map(config => config.storeName));
    
//     // Initialize vectorDB gateway after IndexDB is ready
//     await initiate();

//     console.log("All databases initialized successfully");
//   } catch (error) {
//     console.error("Error initializing databases:", error);
//     throw error;
//   }
// }
// export async function initializeDatabases() {
//   try {
//     if (!config.dbName) {
//       // Check if this is the first time initialization
//       if (!localStorage.getItem('latestDBName')) {
//         config.dbName = `fileGraphDB_${generateUniqueId().slice(-3)}_initial`;
//       } else {
//         config.dbName = localStorage.getItem('latestDBName') || `fileGraphDB_${generateUniqueId().slice(-3)}`;
//       }
//     }

//     const storeConfigs = Object.entries(config.dbStores).map(([storeName, storeConfig]) => ({
//       storeName,
//       keyPath: storeConfig.keyPath || null,
//       vectorConfig: storeConfig.vectorConfig || null
//     }));

//     // await indexDBOverlay.openDB();
//     await indexDBOverlay.initialize(config.dbName + `_${generateUniqueId()}_first`)
//     await indexDBOverlay.initializeDB(storeConfigs.map(config => config.storeName));
    
//     // Initialize vectorDB gateway after IndexDB is ready
//     await initiate();

//     console.log("All databases initialized successfully");
//   } catch (error) {
//     console.error("Error initializing databases:", error);
//     throw error;
//   }
// }


export async function initializeDatabases() {
  try {
    // Determine the database name from config or localStorage
    if (!localStorage.getItem('latestDBName')) {
      config.dbName = `fileGraphDB_${generateUniqueId().slice(-3)}_initial`;
    } else {
      config.dbName = localStorage.getItem('latestDBName');
    }

    const storeConfigs = Object.entries(config.dbStores).map(([storeName, storeConfig]) => ({
      storeName,
      keyPath: storeConfig.keyPath || null,
      vectorConfig: storeConfig.vectorConfig || null,
    }));

    console.log("DB initiatelize!!! ", config.dbName)

    // Initialize database using `indexDBOverlay`
    await indexDBOverlay.initialize(config.dbName);
    await indexDBOverlay.initializeDB(storeConfigs.map(config => config.storeName));

    // Save the last opened database name
    localStorage.setItem('latestDBName', config.dbName);

    // Initialize vectorDB gateway after IndexDB is ready
    await initiate();

    console.log("All databases initialized successfully");
  } catch (error) {
    console.error("Error initializing databases:", error);
    throw error;
  }
}

function addEventListeners(canvas) {
  // Add this new event listener for double-clicks
  canvas.addEventListener("dblclick", (event) => {
    handleQuickClick(event);
  });

  // Add document-level listeners for popup closing
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const popup = document.getElementById('popup');
      const overlay = document.getElementById('overlay');
      if (popup && popup.style.display === 'block') {
        popup.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
      }
    }
  });

  document.addEventListener('mousedown', (event) => {
    const popup = document.getElementById('popup');
    const overlay = document.getElementById('overlay');
    if (popup && popup.style.display === 'block' && !popup.contains(event.target)) {
      popup.style.display = 'none';
      if (overlay) overlay.style.display = 'none';
    }
  });

  const throttledPointerMove = throttle((event) => {
    if (p2pSync.isConnected()) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      p2pSync.updateMousePosition(x, y);
    }
  }, 16); // Throttle to roughly 60fps

  canvas.addEventListener("pointermove", throttledPointerMove);
}

main().catch((error) => {
  console.error("Error in main function:", error);
});

async function setupMarkdownEditor() {
  const toggleButton = document.getElementById("toggleButton");
  const chatSlideout = document.getElementById("chatSlideout");

  async function getCurrentVersion() {
    return new Promise((resolve) => {
      const request = indexedDB.open(config.dbName);
      request.onsuccess = (event) => {
        const version = event.target.result.version;
        event.target.result.close();
        resolve(version);
      };
      request.onerror = () => resolve(1);
    });
  }

  async function initializeEditor(containerElement) {
    if (!containerElement) {
      throw new Error("Editor container element not found");
    }

    // Initialize TabManager
    const tabManager = new TabManager(containerElement);
    await tabManager.initialize();

    return { tabManager };
  }

  async function initEditorDB() {
    try {
      // Get current version first
      const currentVersion = await getCurrentVersion();
      console.log("Current database version:", currentVersion);

      // Initialize single database with all required stores
      await indexDBOverlay.openDB();

      console.log("Editor database initialized");
    } catch (error) {
      console.error("Failed to initialize editor database:", error);
      throw error;
    }
  }
  toggleButton.addEventListener("click", async () => {
    console.log("Toggle button clicked");
    chatSlideout.classList.toggle("active");

    if (chatSlideout.classList.contains("active")) {
      if (!tabManager) {
        try {
          // Initialize database
          await initEditorDB();

          // Update only the content container
          const slideoutContent = document.getElementById("slideoutContent");
          slideoutContent.innerHTML = `
            <div id="editor-app">
              <div id="editor-tabs">
                <div id="tab-list"></div>
                <button id="add-tab">+</button>
              </div>
              <div id="editor-container"></div>
            </div>
          `;

          // Small delay to ensure DOM is ready
          await new Promise((resolve) => setTimeout(resolve, 100));

          const editorApp = document.getElementById("editor-app");
          const { tabManager: newTabManager } = await initializeEditor(
            editorApp
          );
          tabManager = newTabManager;

          console.log("Editor initialized successfully");

          // Pass TabManager to P2PSync
          p2pSync_instance.setTabManager(tabManager);
        } catch (error) {
          console.error("Error initializing editor:", error);
          const slideoutContent = document.getElementById("slideoutContent");
          slideoutContent.innerHTML = `<div class="error">Error loading editor: ${error.message}. Please try again.</div>`;
        }
      } else if (p2pSync_instance.isConnected()) {
        console.log("Re-syncing TabManager with peers...");
        await tabManager.requestResync();
      }

      chatSlideout.style.transform = "translateX(0)";
    } else {
      chatSlideout.style.transform = "translateX(100%)";
    }
  });
}

// async function initializeSettings() {
//   try {
//     // Wait for DOM to be ready
//     if (document.readyState === 'loading') {
//       await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
//     }

//     // Initialize settings handler
//     // if (!window.settingsHandler) {
//     //   window.settingsHandler = settingsHandler;
//     // }

//     // Add event listener for settings updates
//     window.addEventListener('settingsUpdated', (event) => {
//       console.log('Settings updated:', event.detail);
//     });

//     // Add event listener for settings cleared
//     window.addEventListener('settingsCleared', () => {
//       console.log('Settings cleared');
//     });

//     const settings = settingsHandler.getSettings();
//     console.log('Current settings:', {
//       hasProvider: !!settings.provider,
//       hasKey: !!settings.apiKey,
//       hasModel: !!settings.model
//     });

//   } catch (error) {
//     console.error('Error initializing settings:', error);
//     throw error;
//   }
// }

