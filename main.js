import { editor } from './quillEditor.js';
// import userActionStore from './memory/stores/userActionStore';
import { showPopup } from './ui/popup.js';
import { getObjectUnderPointer } from './ui/graph_v2/move';
import { initializeFileSystem, getFileSystem } from './memory/collaboration/file_colab';
import { sceneState } from './memory/collaboration/scene_colab';
import { initializeGraph, share3dDat } from './ui/graph_v2/create';
import { p2pSync } from './network/peer2peer_simple'; // Import the P2PSync class
// import MousePositionManager  from "./memory/collaboration/mouse_colab";

const userId = "kai";
localStorage.setItem("login_block", userId);

// Initialize Quill editor
editor();

const p2pSync_instance = p2pSync



async function main() {
  await initializeFileSystem();
  const fileSystem = getFileSystem();

  fileSystem.onReady(() => {
    // Perform operations that require the file system
  });

  // Initialize the graph and SceneState
  await initializeGraph();

  const {
    renderer,
    scene,
    // camera,
    nonBloomScene,
    mouseOverlay,
  } = share3dDat();


  await sceneState.initialize(scene, nonBloomScene);


  if (!renderer) {
    console.error('Renderer is not initialized.');
    return;
  }


  // Get the canvas element from the renderer
  const canvas = renderer.domElement;

  p2pSync_instance.setMouseOverlay(mouseOverlay);

  // Add event listeners after initialization
  addEventListeners(canvas);
  // addEventListeners(renderer.domElement, mouseOverlay);
}


function handleQuickClick(event) {
  const selectedObject = getObjectUnderPointer(event, "sphere");

  if (selectedObject) {
    const nodeId = selectedObject.userData.id;
    const fileSystem = getFileSystem();
    const fileMetadata = fileSystem.getMetadata(nodeId, 'file');

    if (fileMetadata) {
      showPopup(fileMetadata, event.clientX, event.clientY);
    } 
}
}

function addEventListeners(canvas) {
  let pointerDownTime = null;
  let isDragging = false;
  const CLICK_DURATION_THRESHOLD = 300; // milliseconds
  const DRAG_THRESHOLD = 10; // pixels

  let startX = 0;
  let startY = 0;

  canvas.addEventListener('pointerdown', event => {
    pointerDownTime = Date.now();
    startX = event.clientX;
    startY = event.clientY;
    isDragging = false;
    // userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target);
  }, { capture: true });

  canvas.addEventListener('pointerup', event => {
    if (pointerDownTime === null) {
      return;
    }

    const pointerUpTime = Date.now();
    const clickDuration = pointerUpTime - pointerDownTime;

    // userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target);

    if (!isDragging && clickDuration <= CLICK_DURATION_THRESHOLD) {
      handleQuickClick(event);
    } else {
      if (isDragging) {
      } else {
      }
    }

    // Log user action
    // userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);

    // Reset pointerDownTime
    pointerDownTime = null;
  }, { capture: true });

  canvas.addEventListener('pointermove', event => {
    if (pointerDownTime !== null) {
      const moveX = event.clientX - startX;
      const moveY = event.clientY - startY;
      const distance = Math.sqrt(moveX * moveX + moveY * moveY);

      if (distance > DRAG_THRESHOLD) {
        isDragging = true;
      }
    }
    if (p2pSync.isConnected()) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      console.log(`Local mouse move: (${x}, ${y})`);
      p2pSync.updateMousePosition(x, y);
    }
 

    // userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
  });

  // Key events can remain on the window object
  window.addEventListener('keydown', event => {
    // userActionStore.addKeyPressed(userId, event.key);
  });
  window.addEventListener('keyup', event => {
    // userActionStore.removeKeyPressed(userId, event.key);
  });
}


main().catch(error => {
  console.error("Error in main function:", error);
});

