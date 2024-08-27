// import { handleFileDrop } from './memory/fileHandler.js';
// import { share3dDat } from './graph.js';
// import * as THREE from 'three';
import { editor } from './quillEditor.js';
import fileStore from './memory/stores/fileStore';
import userActionStore from './memory/stores/userActionStore';
// import graphStore from './memory/stores/graphStore';
import { showPopup } from './ui/popup.js';
// import {getObjectUnderPointer} from './ui/graph/dragging_shapes'
import {getObjectUnderPointer} from './ui/graph_v2/move'
import { openDB, getData, saveData, initializeDB } from './memory/local/dbgeneral';

const TEMPLOGINNAME = "k.ai"
localStorage.setItem("login_block", TEMPLOGINNAME);

// Initialize Quill editor
editor();

async function initializeDatabaseAndStores() {
  try {
    // Initialize the database and create stores if they don't exist
    await initializeDB(["directories", "files", "graph"]);
    console.log("Database and stores initialized successfully");
  } catch (error) {
    console.error("Error initializing database and stores:", error);
    // Handle the error appropriately (e.g., show a user-friendly message)
  }
}

async function loadInitialState() {
  try {
    // Open the database connection
    const db = await openDB();
    
    // Load data from various stores
    const directories = await getData("directories");
    const files = await getData("files");
    const graphData = await getData("graph");
    
    // Process and use the loaded data
    console.log("Directories:", directories);
    console.log("Files:", files);
    console.log("Graph data:", graphData);
    
    // Update your application state with the loaded data
    // For example:
    // fileStore.setDirectories(directories);
    // fileStore.setFiles(files);
    // graphStore.setGraphData(graphData);
  } catch (error) {
    console.error("Error loading initial state:", error);
    // Handle the error appropriately
  }
}

async function main() {
  await initializeDatabaseAndStores();
  await loadInitialState();

    // Initialize Three.js scene and camera
    // scene = new THREE.Scene();
    // camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // camera.position.set(0, 0, 200); // Ensure the camera is placed correctly
    // camera.lookAt(new THREE.Vector3(0, 0, 0)); // Ensure the camera is looking at the origin

    // Ensure the renderer is set up correctly
    // const renderer = new THREE.WebGLRenderer();
    // renderer.setSize(window.innerWidth, window.innerHeight);
    // document.body.appendChild(renderer.domElement);

    // Pass the initialized scene, camera, and renderer to graph.js
    // graphInit(scene, camera, renderer);

    // Wait until the renderer is ready
    // await new Promise(resolve => {
    //     const interval = setInterval(() => {
    //         if (isRendererReady()) {
    //             clearInterval(interval);
    //             resolve();
    //         }
    //     }, 100);
    // });

    await fileStore.loadInitialState();
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

// Raycaster for detecting clicks on objects
// const raycaster = new THREE.Raycaster();
// const mouse = new THREE.Vector2();
const userId = 'defaultUser'; // Placeholder for user identification

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
        console.log("Object under click:", selectedObject); // Log the selected object
        // Perform operations on the selected object
        const nodeId = selectedObject.userData.id;
        await fileStore.selectFile(nodeId); // Fetch and update selected file in MobX store
        console.log("nodeId", nodeId)
        showPopup(fileStore.selectedFile, event.clientX, event.clientY); // Display the selected file's metadata
    } else {
        document.getElementById('popup').style.display = 'none';
        console.log("No object under click.");
    }
});

// document.addEventListener('pointerdown', (event) => {
    
// });


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
