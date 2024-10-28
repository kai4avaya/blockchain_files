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
import {initiate_gui_controls} from './ui/gui.listens.js'
import indexDBOverlay from './memory/local/file_worker'
import {throttle} from './utils/utils'
import { initializeEditor } from './ui/components/codemirror_md copy/codemirror-rich-markdoc/editor/index.ts'

const userId = "kai";
localStorage.setItem("login_block", userId);

const p2pSync_instance = p2pSync;

async function main() {
  embeddingWorker.initialize();

  
  try {
    await setupMarkdownEditor();
    console.log("Markdown editor setup completed");
  } catch (error) {
    console.error("Error setting up Markdown editor:", error);
  }
  await initiate();

  // Initialize a new database for summarizations
  await initiate("summarizationDB", ["summaries"]);
  await initializeFileSystem();
  const fileSystem = getFileSystem();

  fileSystem.onReady(() => {
    // Perform operations that require the file system
  });

  // Initialize the graph and SceneState
  await initializeGraph();

  initiate_gui_controls()

  const {
    renderer,
    scene,
    nonBloomScene,
    mouseOverlay,
  } = share3dDat();

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
      console.log("GOT ME A QUICK  DBL fileMetadata CLICK in main.js", fileMetadata);
      showPopup(fileMetadata, event.clientX, event.clientY);
    }
  }
}, 300);

export async function initializeDatabases() {
  try {
    // Initialize 'fileGraphDB' with version 2
    await indexDBOverlay.openDB('fileGraphDB', 2);
    await indexDBOverlay.initializeDB(['directories', 'files', 'graph'], 'fileGraphDB');

    // Initialize 'summarizationDB' with version 1
    await indexDBOverlay.openDB('summarizationDB', 1);
    await indexDBOverlay.initializeDB(['summaries'], 'summarizationDB');

    console.log('Databases initialized successfully');
  } catch (error) {
    console.error('Error initializing databases:', error);
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


// function setupMarkdownEditor() {
//   const toggleButton = document.getElementById('toggleButton');
//   const chatSlideout = document.getElementById('chatSlideout');
//   let tabManager = null;

//   toggleButton.addEventListener('click', () => {
//     console.log("Toggle button clicked");
//     chatSlideout.classList.toggle('active');

//     if (chatSlideout.classList.contains('active')) {
//       console.log("Slideout is active, initializing or showing Markdown editor");
//       if (!tabManager) {
//         chatSlideout.innerHTML = `
//           <div id="editor-app">
//             <div id="editor-tabs">
//               <div id="tab-list"></div>
//               <button id="add-tab">+</button>
//             </div>
//             <div id="editor-container"></div>
//           </div>
//         `;
//         const editorApp = document.getElementById('editor-app');
//         tabManager = initializeEditor(editorApp);
//       }
//       chatSlideout.style.transform = 'translateX(0)';
//     } else {
//       console.log("Slideout is inactive, hiding editor");
//       chatSlideout.style.transform = 'translateX(100%)';
//     }
//   });
// }
async function setupMarkdownEditor() {
  const toggleButton = document.getElementById('toggleButton');
  const chatSlideout = document.getElementById('chatSlideout');
  let tabManager = null;

  async function getCurrentVersion() {
    return new Promise((resolve) => {
      const request = indexedDB.open('editorDB');
      request.onsuccess = (event) => {
        const version = event.target.result.version;
        event.target.result.close();
        resolve(version);
      };
      request.onerror = () => resolve(1); // Default to 1 if database doesn't exist
    });
  }

  async function initEditorDB() {
    try {
      // Get current version first
      const currentVersion = await getCurrentVersion();
      console.log('Current database version:', currentVersion);

      // First, ensure the database is created with proper stores
      const request = indexedDB.open('editorDB', currentVersion);
      
      await new Promise((resolve, reject) => {
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('tabs')) {
            db.createObjectStore('tabs', { keyPath: 'docId' });
            console.log('Created tabs store');
          }
          if (!db.objectStoreNames.contains('docs')) {
            db.createObjectStore('docs', { keyPath: 'docId' });
            console.log('Created docs store');
          }
        };

        request.onsuccess = () => {
          // Check if we need stores but didn't get an upgrade
          const db = request.result;
          const needsStores = !db.objectStoreNames.contains('tabs') || 
                            !db.objectStoreNames.contains('docs');
          
          db.close();
          
          if (needsStores) {
            // If we need stores but didn't get an upgrade, try again with a new version
            resolve(false);
          } else {
            resolve(true);
          }
        };

        request.onerror = () => reject(request.error);
      });

      // If we need to create stores, try again with a new version
      const storesCreated = await new Promise((resolve, reject) => {
        const newRequest = indexedDB.open('editorDB', currentVersion + 1);
        
        newRequest.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('tabs')) {
            db.createObjectStore('tabs', { keyPath: 'docId' });
            console.log('Created tabs store in upgrade');
          }
          if (!db.objectStoreNames.contains('docs')) {
            db.createObjectStore('docs', { keyPath: 'docId' });
            console.log('Created docs store in upgrade');
          }
        };

        newRequest.onsuccess = () => {
          newRequest.result.close();
          resolve(true);
        };

        newRequest.onerror = () => reject(newRequest.error);
      });

      // Now initialize through the worker with the current version
      await indexDBOverlay.openDB('editorDB');
      console.log('Editor database initialized');
    } catch (error) {
      console.error('Failed to initialize editor database:', error);
      throw error;
    }
  }

  toggleButton.addEventListener('click', async () => {
    console.log("Toggle button clicked");
    chatSlideout.classList.toggle('active');

    if (chatSlideout.classList.contains('active')) {
      if (!tabManager) {
        try {
          // Initialize database
          await initEditorDB();

          // Create DOM structure
          chatSlideout.innerHTML = `
            <div id="editor-app">
              <div id="editor-tabs">
                <div id="tab-list"></div>
                <button id="add-tab">+</button>
              </div>
              <div id="editor-container"></div>
            </div>
          `;

          // Small delay to ensure DOM is ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const editorApp = document.getElementById('editor-app');
          tabManager = await initializeEditor(editorApp);
          
          console.log('Editor initialized successfully');
        } catch (error) {
          console.error('Error initializing editor:', error);
          chatSlideout.innerHTML = `<div class="error">Error loading editor: ${error.message}. Please try again.</div>`;
        }
      }
      chatSlideout.style.transform = 'translateX(0)';
    } else {
      chatSlideout.style.transform = 'translateX(100%)';
    }
  });
}