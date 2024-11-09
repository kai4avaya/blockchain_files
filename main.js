// import { editor } from "./quillEditor.js";
import { showPopup } from "./ui/popup.js";
import { getObjectUnderPointer } from "./ui/graph_v2/move";
import {
  initializeFileSystem,
  getFileSystem,
} from "./memory/collaboration/file_colab";
import { sceneState } from "./memory/collaboration/scene_colab";
import { initializeGraph, share3dDat } from "./ui/graph_v2/create";
import { p2pSync } from "./network/peer2peer_simple"; // Import the P2PSync class
import embeddingWorker from "./ai/embeddings.js";
import { initiate } from "./memory/vectorDB/vectorDbGateway.js"; // Assuming your initiate function is exported
import { initiate_gui_controls } from "./ui/gui.listens.js";
import indexDBOverlay from "./memory/local/file_worker";
import { throttle } from "./utils/utils";
import { TabManager } from "./ui/components/codemirror_md copy/codemirror-rich-markdoc/editor/extensions/tabManager";
// import { initializeEditor } from './ui/components/codemirror_md copy/codemirror-rich-markdoc/editor/index.ts'
import { initializeWorker } from "./memory/fileHandler.js";
import config from './configs/config.json';
import { dbSyncManager } from "./memory/collaboration/dbState_sync";


let tabManager = null;
const userId = "kai";
localStorage.setItem("login_block", userId);

const p2pSync_instance = p2pSync;

async function main() {
  embeddingWorker.initialize();
  initializeWorker();
  await initializeDatabases();
  try {
    await setupMarkdownEditor();
    console.log("Markdown editor setup completed");
  } catch (error) {
    console.error("Error setting up Markdown editor:", error);
  }
  // await initiate();

  // Initialize a new database for summarizations
  // await initiate("summarizationDB", ["summaries"]);
  await initializeFileSystem();
  const fileSystem = getFileSystem();

  fileSystem.onReady(() => {
    // Perform operations that require the file system
  });

  // Initialize the graph and SceneState
  await initializeGraph();

  initiate_gui_controls();

  const { renderer, scene, nonBloomScene, mouseOverlay } = share3dDat();

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


export async function initializeDatabases() {
  try {
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

function addEventListeners(canvas) {
  // Add this new event listener for double-clicks
  canvas.addEventListener("dblclick", (event) => {
    handleQuickClick(event);
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
