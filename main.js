import { handleFileDrop } from './memory/fileHandler.js';
import { graphInit, isRendererReady } from './graph.js';
import * as THREE from 'three';
import { editor } from './quillEditor.js';
import fileStore from './memory/stores/fileStore';
import userActionStore from './memory/stores/userActionStore';
// import graphStore from './memory/stores/graphStore';
import { showPopup } from './ui/popup.js';
import { initializeDB } from './memory/local/db.js'; // Initialize the database and create stores if they don't exist

// Initialize Quill editor
editor();
let camera;
let scene;
async function main() {
    await initializeDB(); // Initialize the database and create stores if they don't exist

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
    handleFileDrop(event);
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
