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
// import {state} from './ui/components/codemirror_md/codemirror-rich-markdoc/editor/index'
// import { initializeBlockSuiteEditor, getBlockSuiteEditor } from './ui/components/blocksSuiteText/blockSuiteEditor.js';

// import { initializeMarkdownEditor, getMarkdownEditor, getMarkdownContent, setMarkdownContent } from './ui/components/codemirror_md/markdownEditor.js';
import { initializeEditor } from './ui/components/codemirror_md/codemirror-rich-markdoc/editor/index.ts'

const userId = "kai";
localStorage.setItem("login_block", userId);
// let editorInitialized = false;
// Initialize Quill editor
// editor();
// initializeBlockSuiteEditor()
// getBlockSuiteEditor()
const p2pSync_instance = p2pSync;

async function main() {
  embeddingWorker.initialize();
  // Preload the BlockSuite editor
  // await preloadBlockSuiteEditor();

  
  try {
    await setupMarkdownEditor();
    console.log("Markdown editor setup completed");
  } catch (error) {
    console.error("Error setting up Markdown editor:", error);
  }
  // setupBlockSuiteEditor();
  // Initialize the default database (vectorDB_new)
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
    // camera,
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

  // initializeDatabases()
// setupBlockSuiteEditor()
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
  // let pointerDownTime = null;
  // const DRAG_THRESHOLD = 10; // pixels


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


  // // Key events can remain on the window object
  // window.addEventListener("keydown", (event) => {
  //   // userActionStore.addKeyPressed(userId, event.key);
  // });
  // window.addEventListener("keyup", (event) => {
  //   // userActionStore.removeKeyPressed(userId, event.key);
  // });
}

main().catch((error) => {
  console.error("Error in main function:", error);
});



// function setupBlockSuiteEditor() {
//   // const pencilIcon = document.querySelector('.sidebar-icon:nth-child(7)'); // Adjust this selector if needed
//   const toggleButton = document.getElementById('toggleButton');
        
//   // toggleButton.addEventListener('click', async () => {
//         //     chatSlideout.classList.toggle('active');
//         //     if (chatSlideout.classList.contains('active')) {
//         //         editorContainer.classList.add('active');
//         //         fileTree.classList.remove('active');
//         //         await initializeBlockSuiteEditor();
//         //     } else {
//         //         editorContainer.classList.remove('active');
//         //     }
//         // });
  
//   const chatSlideout = document.getElementById('chatSlideout');

//   toggleButton.addEventListener('click', async () => {
//     chatSlideout.innerHTML = '<div id="editor-container"></div>';
//     console.log("toggleButton clicked");
//     chatSlideout.classList.toggle('active');
//     if (chatSlideout.classList.contains('active')) {
//       // Initialize BlockSuite editor when the slideout is opened
//       await initializeBlockSuiteEditor();
//     }
//   });
// }


async function preloadBlockSuiteEditor() {
  console.log("Preloading BlockSuite editor");
  try {
    await initializeBlockSuiteEditor();
    editorInitialized = true;
    console.log("BlockSuite editor preloaded successfully");
  } catch (error) {
    console.error("Failed to preload BlockSuite editor:", error);
  }
}

function setupBlockSuiteEditor() {
  const toggleButton = document.getElementById('toggleButton');
  const chatSlideout = document.getElementById('chatSlideout');

  toggleButton.addEventListener('click', () => {
    console.log("Toggle button clicked");
    chatSlideout.classList.toggle('active');

    if (chatSlideout.classList.contains('active')) {
      console.log("Slideout is active, showing BlockSuite editor");
      if (editorInitialized) {
        const editorInstance = getBlockSuiteEditor();
        if (editorInstance) {
          chatSlideout.innerHTML = '<div id="editor-container"></div>';
          const editorContainer = document.getElementById('editor-container');
          editorContainer.appendChild(editorInstance);
          console.log("BlockSuite editor displayed");
        } else {
          console.warn("BlockSuite editor instance not available");
          chatSlideout.innerHTML = '<div>Editor not available. Please refresh the page.</div>';
        }
      } else {
        console.warn("BlockSuite editor not initialized");
        chatSlideout.innerHTML = '<div>Editor not initialized. Please refresh the page.</div>';
      }
    } else {
      console.log("Slideout is inactive, hiding BlockSuite editor");
      chatSlideout.innerHTML = ''; // Clear the content when hiding
    }
  });
}


// async function setupMarkdownEditor() {
//   const toggleButton = document.getElementById('toggleButton');
//   const chatSlideout = document.getElementById('chatSlideout');

//   toggleButton.addEventListener('click', () => {
//     console.log("Toggle button clicked");
//     chatSlideout.innerHTML = '<div id="editor-container"></div>';
//     chatSlideout.classList.toggle('active');

//     if (chatSlideout.classList.contains('active')) {
//       console.log("Slideout is active, initializing Markdown editor");
//       try {
//         const editorContainer = document.getElementById('editor-container');
//         if (!editorContainer) {
//           throw new Error("Editor container not found");
//         }

//         // Use the imported initializeEditor function
//         const editorView = initializeEditor(editorContainer);
//         console.log("Markdown editor initialized successfully", editorView);
//       } catch (error) {
//         console.error("Failed to initialize Markdown editor:", error);
//         chatSlideout.innerHTML = '<div>Failed to load editor. Please try again.</div>';
//       }
//     } else {
//       console.log("Slideout is inactive");
//     }
//   });
// }


function setupMarkdownEditor() {
  const toggleButton = document.getElementById('toggleButton');
  const chatSlideout = document.getElementById('chatSlideout');
  let tabManager = null;

  toggleButton.addEventListener('click', () => {
    console.log("Toggle button clicked");
    chatSlideout.classList.toggle('active');

    if (chatSlideout.classList.contains('active')) {
      console.log("Slideout is active, initializing or showing Markdown editor");
      if (!tabManager) {
        chatSlideout.innerHTML = `
          <div id="editor-app">
            <div id="editor-tabs">
              <div id="tab-list"></div>
              <button id="add-tab">+</button>
            </div>
            <div id="editor-container"></div>
          </div>
        `;
        const editorApp = document.getElementById('editor-app');
        tabManager = initializeEditor(editorApp);
      }
      chatSlideout.style.transform = 'translateX(0)';
    } else {
      console.log("Slideout is inactive, hiding editor");
      chatSlideout.style.transform = 'translateX(100%)';
    }
  });
}
