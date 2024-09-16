import { editor } from './quillEditor.js';
import userActionStore from './memory/stores/userActionStore';
import { showPopup } from './ui/popup.js';
import { getObjectUnderPointer } from './ui/graph_v2/move';
import { initializeFileSystem, getFileSystem } from './memory/collaboration/file_colab';
import { sceneState } from './memory/collaboration/scene_colab';
import { scene, nonBloomScene, initializeGraph, share3dDat } from './ui/graph_v2/create';
// import { P2PSync } from './network/peer2peer_simple'; // Import the P2PSync class

const userId = "kai";
localStorage.setItem("login_block", userId);

// Initialize Quill editor
editor();

// async function main() {
//   await initializeFileSystem();
//   const fileSystem = getFileSystem();

//   fileSystem.onReady(() => {
//     // Perform operations that require the file system
//   });

//   // Initialize the graph and SceneState
//   await initializeGraph();
//   await sceneState.initialize(scene, nonBloomScene);

 
//   // Initialize P2PSync with the userId
//   // Set up P2P UI elements

//   // Add event listeners after initialization
//   addEventListeners();
// }


// function addEventListeners() {
//   let pointerDownTime = null;
//   let isDragging = false;
//   const CLICK_DURATION_THRESHOLD = 300; // milliseconds
//   const DRAG_THRESHOLD = 10; // pixels

//   let startX = 0;
//   let startY = 0;

//   window.addEventListener('pointerdown', event => {
//     pointerDownTime = Date.now();
//     startX = event.clientX;
//     startY = event.clientY;
//     isDragging = false;
//     console.log(`Pointer down at: ${pointerDownTime} | Position: (${startX}, ${startY})`);
//     userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target);
//   }, { capture: true });

//   window.addEventListener('pointerup', event => {
//     if (pointerDownTime === null) {
//       return;
//     }

//     const pointerUpTime = Date.now();
//     const clickDuration = pointerUpTime - pointerDownTime;
//     console.log(`Pointer up at: ${pointerUpTime} | Duration: ${clickDuration}ms | isDragging: ${isDragging}`);

//     userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target);

//     if (!isDragging && clickDuration <= CLICK_DURATION_THRESHOLD) {
//       console.log('Quick click detected');
//       handleQuickClick(event);
//     } else {
//       if (isDragging) {
//         console.log('Drag detected, not showing popup');
//       } else {
//         console.log('Long click detected, not showing popup');
//       }
//     }

//     // Log user action
//     userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);

//     // Reset pointerDownTime
//     pointerDownTime = null;
//   }, { capture: true });

//   window.addEventListener('pointermove', event => {
//     if (pointerDownTime !== null) {
//       const moveX = event.clientX - startX;
//       const moveY = event.clientY - startY;
//       const distance = Math.sqrt(moveX * moveX + moveY * moveY);

//       if (distance > DRAG_THRESHOLD) {
//         isDragging = true;
//       }
//     }

//     userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
//   });

//   // Track key press and release events
//   window.addEventListener('keydown', event => {
//     userActionStore.addKeyPressed(userId, event.key);
//   });
//   window.addEventListener('keyup', event => {
//     userActionStore.removeKeyPressed(userId, event.key);
//   });
// }

// function handleQuickClick(event) {
//   const selectedObject = getObjectUnderPointer(event);

//   if (selectedObject) {
//     const nodeId = selectedObject.userData.id;
//     const fileSystem = getFileSystem();
//     const fileMetadata = fileSystem.getMetadata(nodeId, 'file');

//     if (fileMetadata) {
//       showPopup(fileMetadata, event.clientX, event.clientY);
//     } else {
//       console.log('File metadata not found for nodeId:', nodeId);
//     }
//   } else {
//     const popup = document.getElementById('popup');
//     if (popup) {
//       popup.style.display = 'none';
//     } else {
//       console.log('Popup element not found');
//     }
//   }
// }

// // // Set up drag-and-drop file handling
// // document.body.addEventListener('dragover', event => {
// //   event.preventDefault();
// // });

// // document.body.addEventListener('drop', event => {
// //   event.preventDefault();
// //   // handleFileDrop(event);
// // });

// main().catch(error => {
//   console.error("Error in main function:", error);
// });



async function main() {
  await initializeFileSystem();
  const fileSystem = getFileSystem();

  fileSystem.onReady(() => {
    // Perform operations that require the file system
  });

  // Initialize the graph and SceneState
  await initializeGraph();

  // Retrieve renderer and other Three.js objects
  const {
    renderer,
    scene,
    camera,
    // ...other objects you might need
    nonBloomScene,
  } = share3dDat();

  await sceneState.initialize(scene, nonBloomScene);


  if (!renderer) {
    console.error('Renderer is not initialized.');
    return;
  }

  // Get the canvas element from the renderer
  const canvas = renderer.domElement;

  // Add event listeners after initialization
  addEventListeners(canvas);
}


function handleQuickClick(event) {
  const selectedObject = getObjectUnderPointer(event);

  if (selectedObject) {
    const nodeId = selectedObject.userData.id;
    const fileSystem = getFileSystem();
    const fileMetadata = fileSystem.getMetadata(nodeId, 'file');

    if (fileMetadata) {
      showPopup(fileMetadata, event.clientX, event.clientY);
    } else {
      console.log('File metadata not found for nodeId:', nodeId);
    }
  } else {
    const popup = document.getElementById('popup');
    if (popup) {
      popup.style.display = 'none';
    } else {
      console.log('Popup element not found');
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
    console.log(`Pointer down at: ${pointerDownTime} | Position: (${startX}, ${startY})`);
    userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target);
  }, { capture: true });

  canvas.addEventListener('pointerup', event => {
    if (pointerDownTime === null) {
      return;
    }

    const pointerUpTime = Date.now();
    const clickDuration = pointerUpTime - pointerDownTime;
    console.log(`Pointer up at: ${pointerUpTime} | Duration: ${clickDuration}ms | isDragging: ${isDragging}`);

    userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target);

    if (!isDragging && clickDuration <= CLICK_DURATION_THRESHOLD) {
      console.log('Quick click detected');
      handleQuickClick(event);
    } else {
      if (isDragging) {
        console.log('Drag detected, not showing popup');
      } else {
        console.log('Long click detected, not showing popup');
      }
    }

    // Log user action
    userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);

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

    userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
  });

  // Key events can remain on the window object
  window.addEventListener('keydown', event => {
    userActionStore.addKeyPressed(userId, event.key);
  });
  window.addEventListener('keyup', event => {
    userActionStore.removeKeyPressed(userId, event.key);
  });
}


main().catch(error => {
  console.error("Error in main function:", error);
});

