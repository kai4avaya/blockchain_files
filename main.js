// import { handleFileDrop } from './memory/fileHandler.js';
// import { share3dDat } from './graph.js';
// import * as THREE from 'three';
import { editor } from './quillEditor.js';
// import fileStore from './memory/stores/fileStore';
import userActionStore from './memory/stores/userActionStore';
// import graphStore from './memory/stores/graphStore';
import { showPopup } from './ui/popup.js';
// import {getObjectUnderPointer} from './ui/graph/dragging_shapes'
import {getObjectUnderPointer} from './ui/graph_v2/move'
// import { openDB, getData, saveData, initializeDB } from './memory/local/dbgeneral';
import { initializeFileSystem, getFileSystem } from './memory/collaboration/file_colab';
import { sceneState } from './memory/collaboration/scene_colab';
import { scene, nonBloomScene, initializeGraph } from './ui/graph_v2/create';


const userId = "k.ai"
localStorage.setItem("login_block", userId);

// Initialize Quill editor
editor();

async function main() {
//   await loadInitialState();
  await initializeFileSystem();
  const fileSystem = getFileSystem();

  fileSystem.onReady(() => {
    // Perform operations that require the file system
  });

  // Initialize the graph and SceneState
  await initializeGraph();
  await sceneState.initialize(scene, nonBloomScene);

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

window.addEventListener('click', async event => {
    userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
    userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target);

    const selectedObject = getObjectUnderPointer(event);
    if (selectedObject) {
      const nodeId = selectedObject.userData.id;
      const fileSystem = getFileSystem();
      const fileMetadata = fileSystem.getMetadata(nodeId);
      if (fileMetadata) {
        showPopup(fileMetadata, event.clientX, event.clientY);
      }
    } else {
      document.getElementById('popup').style.display = 'none';
    }

    userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target);
  });
window.addEventListener('click', async event => {
    // Log user action
    userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
    userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target); // Log mouse down

    // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
    // mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    // mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // // Update the picking ray with the camera and mouse position
    // raycaster.setFromCamera(mouse, camera);

    // // Calculate objects intersecting the picking ray
    // const intersects = raycaster.intersectObjects(scene.children);

    // if (intersects.length > 0) {
    //     const nodeId = intersects[0].object.userData.id;
    //     await fileStore.selectFile(nodeId); // Fetch and update selected file in MobX store
    //     showPopup(fileStore.selectedFile, event.clientX, event.clientY); // Display the selected file's metadata
    // } else {
    //     document.getElementById('popup').style.display = 'none';
    // }

    userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target); // Log mouse up

    const selectedObject = getObjectUnderPointer(event);
    if (selectedObject) {
        // Perform operations on the selected object
        // const nodeId = selectedObject.userData.id;
        // await fileStore.selectFile(nodeId); // Fetch and update selected file in MobX store
        // console.log("nodeId LETS SHOW POPUP!", nodeId)
        const nodeId = selectedObject.userData.id;
      const fileSystem = getFileSystem();
      const fileMetadata = fileSystem.getMetadata(nodeId, "file");
        showPopup(fileMetadata, event.clientX, event.clientY); // Display the selected file's metadata
    } else {
        document.getElementById('popup').style.display = 'none';
        console.log("No object under click.");
    }
});


// Track mouse movements
window.addEventListener('mousemove', event => {
    userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
});

// Track mouse down and up events
window.addEventListener('mousedown', event => {
    userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target);
});
window.addEventListener('mouseup', event => {
    userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target);
});

// Track key press and release events
window.addEventListener('keydown', event => {
    userActionStore.addKeyPressed(userId, event.key);
});
window.addEventListener('keyup', event => {
    userActionStore.removeKeyPressed(userId, event.key);
});

main().catch(console.error);
