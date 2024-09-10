
// import { editor } from './quillEditor.js';
// import userActionStore from './memory/stores/userActionStore';
// import { showPopup } from './ui/popup.js';
// import {getObjectUnderPointer} from './ui/graph_v2/move'
// import { initializeFileSystem, getFileSystem } from './memory/collaboration/file_colab';
// import { sceneState } from './memory/collaboration/scene_colab';
// import { scene, nonBloomScene, initializeGraph } from './ui/graph_v2/create';


// const userId = "kai"
// localStorage.setItem("login_block", userId);

// // Initialize Quill editor
// editor();

// async function main() {
// //   await loadInitialState();
//   await initializeFileSystem();
//   const fileSystem = getFileSystem();

//   fileSystem.onReady(() => {
//     // Perform operations that require the file system
//   });

//   // Initialize the graph and SceneState
//   await initializeGraph();
//   await sceneState.initialize(scene, nonBloomScene);
  

// }

// // Set up drag-and-drop file handling
// document.body.addEventListener('dragover', event => {
//     event.preventDefault();
// });

// document.body.addEventListener('drop', event => {
//     event.preventDefault();
//     console.log('File(s) dropped');
//     // handleFileDrop(event);
// });

// window.addEventListener('click', async event => {
//     userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
//     userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target);

//     const selectedObject = getObjectUnderPointer(event);
//     if (selectedObject) {
//       const nodeId = selectedObject.userData.id;
//       const fileSystem = getFileSystem();
//       console.log("fileSystem", fileSystem,"nodeId", nodeId)
//       const fileMetadata = fileSystem.getMetadata(nodeId, 'file');
//       if (fileMetadata) {
//         showPopup(fileMetadata, event.clientX, event.clientY);
//       }
//     } else {
//       document.getElementById('popup').style.display = 'none';
//     }

//     userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target);

//     // Log user action
//     userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
//     userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target); // Log mouse down

//     userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target); // Log mouse up

//     if (selectedObject) {

//         const nodeId = selectedObject.userData.id;
//       const fileSystem = getFileSystem();
//       const fileMetadata = fileSystem.getMetadata(nodeId, "file");
//         showPopup(fileMetadata, event.clientX, event.clientY); // Display the selected file's metadata
//     } else {
//         document.getElementById('popup').style.display = 'none';
//         console.log("No object under click.");
//     }
// });


// // Track mouse movements
// window.addEventListener('mousemove', event => {
//     userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
// });

// // Track mouse down and up events
// window.addEventListener('mousedown', event => {
//     userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target);
// });
// window.addEventListener('mouseup', event => {
//     userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target);
// });

// // Track key press and release events
// window.addEventListener('keydown', event => {
//     userActionStore.addKeyPressed(userId, event.key);
// });
// window.addEventListener('keyup', event => {
//     userActionStore.removeKeyPressed(userId, event.key);
// });

// main().catch(console.error);


import { editor } from './quillEditor.js';
import userActionStore from './memory/stores/userActionStore';
import { showPopup } from './ui/popup.js';
import { getObjectUnderPointer } from './ui/graph_v2/move';
import { initializeFileSystem, getFileSystem } from './memory/collaboration/file_colab';
import { sceneState } from './memory/collaboration/scene_colab';
import { scene, nonBloomScene, initializeGraph } from './ui/graph_v2/create';

const userId = "kai";
localStorage.setItem("login_block", userId);

// Initialize Quill editor
editor();

async function main() {
  console.log("Main function started");
  await initializeFileSystem();
  const fileSystem = getFileSystem();

  fileSystem.onReady(() => {
    console.log("File system is ready");
  });

  // Initialize the graph and SceneState
  await initializeGraph();
  await sceneState.initialize(scene, nonBloomScene);
  console.log("Graph and SceneState initialized");

  // Add event listeners after initialization
  addEventListeners();
}

function addEventListeners() {
  console.log("Adding event listeners");

  let pointerDownTime = 0;
  const CLICK_DURATION_THRESHOLD = 200; // milliseconds

  window.addEventListener('pointerdown', event => {
    pointerDownTime = Date.now();
    console.log('Pointer down at:', pointerDownTime);
    userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target);
  });

  window.addEventListener('pointerup', event => {
    const clickDuration = Date.now() - pointerDownTime;
    console.log('Pointer up. Click duration:', clickDuration);
    userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target);
    console.log("Click duration:", clickDuration, "<=", CLICK_DURATION_THRESHOLD);
    if (clickDuration <= CLICK_DURATION_THRESHOLD) {
      console.log('Quick click detected');
      handleQuickClick(event);
    } else {
      console.log('Long click detected, not showing popup');
    }

    // Log user action
    userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
  });

  // Track pointer movements
  window.addEventListener('pointermove', event => {
    userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
  });

  // Track key press and release events
  window.addEventListener('keydown', event => {
    userActionStore.addKeyPressed(userId, event.key);
  });
  window.addEventListener('keyup', event => {
    userActionStore.removeKeyPressed(userId, event.key);
  });

  console.log("Event listeners added");
}

function handleQuickClick(event) {
  console.log('Handling quick click');
  const selectedObject = getObjectUnderPointer(event);
  console.log('Selected object:', selectedObject);

  if (selectedObject) {
    const nodeId = selectedObject.userData.id;
    console.log('Node ID:', nodeId);
    const fileSystem = getFileSystem();
    console.log('File system:', fileSystem);
    const fileMetadata = fileSystem.getMetadata(nodeId, 'file');
    console.log('File metadata:', fileMetadata);

    if (fileMetadata) {
      console.log('Showing popup');
      showPopup(fileMetadata, event.clientX, event.clientY);
    } else {
      console.log('No file metadata found');
    }
  } else {
    console.log('No object under pointer');
    const popup = document.getElementById('popup');
    if (popup) {
      popup.style.display = 'none';
      console.log('Popup hidden');
    } else {
      console.log('Popup element not found');
    }
  }
}

// Set up drag-and-drop file handling
document.body.addEventListener('dragover', event => {
  event.preventDefault();
});

document.body.addEventListener('drop', event => {
  event.preventDefault();
  console.log('File(s) dropped');
  // handleFileDrop(event);
});

main().catch(error => {
  console.error("Error in main function:", error);
});