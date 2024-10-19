import { editor } from "./quillEditor.js";
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
const userId = "kai";
localStorage.setItem("login_block", userId);

// Initialize Quill editor
editor();

const p2pSync_instance = p2pSync;

async function main() {
  embeddingWorker.initialize();

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

  addEventListeners(canvas);
}

// function handleQuickClick(event) {
//   const selectedObject = getObjectUnderPointer(event, "sphere");
//   if (selectedObject) {
//     console.log("GOT ME A QUICK CLICK main.js");
//     const nodeId = selectedObject.userData.id;
//     const fileSystem = getFileSystem();
//     const fileMetadata = fileSystem.getMetadata(nodeId, "file");

//     if (fileMetadata) {
//       console.log(
//         "GOT ME A QUICK  fileMetadata CLICK in main.js",
//         fileMetadata
//       );
//       showPopup(fileMetadata, event.clientX, event.clientY);
//     }
//   }
// }
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
  let pointerDownTime = null;
  const DRAG_THRESHOLD = 10; // pixels

  // let startX = 0;
  // let startY = 0;

  // canvas.addEventListener(
  //   "pointerdown",
  //   (event) => {
  //     console.log("he done clicky in main.js");
  //     pointerDownTime = Date.now();
  //     startX = event.clientX;
  //     startY = event.clientY;
  //     // userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target);
  //   },
  //   { capture: true }
  // );

  // canvas.addEventListener(
  //   "pointerup",
  //   (event) => {
  //     if (pointerDownTime === null) {
  //       return;
  //     }

  //     const pointerUpTime = Date.now();
  //     const clickDuration = pointerUpTime - pointerDownTime;

  //     // userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target);

  //     if (!isDragging && clickDuration <= CLICK_DURATION_THRESHOLD) {
  //       handleQuickClick(event);
  //     } else {
  //       if (isDragging) {
  //       } else {
  //       }
  //     }

  //     // Log user action
  //     // userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);

  //     // Reset pointerDownTime
  //     pointerDownTime = null;
  //   },
  //   { capture: true }
  // );

  // Add this new event listener for double-clicks
canvas.addEventListener("dblclick", (event) => {
  handleQuickClick(event);
});


  // canvas.addEventListener("pointermove", (event) => {
  //   if (pointerDownTime !== null) {
  //     const moveX = event.clientX - startX;
  //     const moveY = event.clientY - startY;
  //     const distance = Math.sqrt(moveX * moveX + moveY * moveY);

  //     if (distance > DRAG_THRESHOLD) {
  //       // isDragging = true;
  //     }
  //   }
  //   if (p2pSync.isConnected()) {
  //     const rect = canvas.getBoundingClientRect();
  //     const x = event.clientX - rect.left;
  //     const y = event.clientY - rect.top;
  //     p2pSync.updateMousePosition(x, y);
  //   }

  //   // userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
  // });

  
  const throttledPointerMove = throttle((event) => {
    // if (pointerDownTime !== null) {
    //   const moveX = event.clientX - startX;
    //   const moveY = event.clientY - startY;
    //   const distance = Math.sqrt(moveX * moveX + moveY * moveY);

    //   if (distance > DRAG_THRESHOLD) {
    //     // isDragging = true;
    //   }
    // }
    if (p2pSync.isConnected()) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      p2pSync.updateMousePosition(x, y);
    }
  }, 16); // Throttle to roughly 60fps

  canvas.addEventListener("pointermove", throttledPointerMove);


  // Key events can remain on the window object
  window.addEventListener("keydown", (event) => {
    // userActionStore.addKeyPressed(userId, event.key);
  });
  window.addEventListener("keyup", (event) => {
    // userActionStore.removeKeyPressed(userId, event.key);
  });
}

main().catch((error) => {
  console.error("Error in main function:", error);
});

