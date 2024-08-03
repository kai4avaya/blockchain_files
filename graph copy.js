// import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// import { DragControls } from 'three/examples/jsm/controls/DragControls';
// import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
// import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

// let scene, camera, controls, renderer, dragControls;
// const nodes = [];

// // Initialize the scene, camera, controls, and renderer
// export function graphInit(initScene, initCamera) {
//     scene = initScene;
//     camera = initCamera;

//     // Initialize controls
//     controls = new OrbitControls(camera, renderer.domElement);
//     camera.position.set(0, 0, 200); // Position the camera further away on the Z axis
//     camera.lookAt(new THREE.Vector3(0, 0, 0)); // Ensure the camera is looking at the origin

//     // Initialize drag controls
//     initDragControls();

//     // Start the animation loop after initialization
//     animate();
// }

// // Set up the renderer
// renderer = new THREE.WebGLRenderer();
// renderer.setSize(window.innerWidth, window.innerHeight);
// document.body.appendChild(renderer.domElement);

// // Initialize drag controls
// function initDragControls() {
//     dragControls = new DragControls(nodes.map(node => node.mesh), camera, renderer.domElement);
//     dragControls.addEventListener('dragstart', function (event) {
//         controls.enabled = false;
//     });
//     dragControls.addEventListener('dragend', function (event) {
//         controls.enabled = true;
//     });
// }

// // Function to add a node to the graph
// export function addNode(id, file) {
//     console.log(`Adding node for file: ${file.name}`);

//     const size = Math.cbrt(file.size) / 10; // Increase size scaling for better visibility
//     const color = Math.random() * 0xffffff;
//     const geometry = new THREE.SphereGeometry(size, 32, 32);
//     const material = new THREE.MeshBasicMaterial({ color: color });
//     const node = {
//         id,
//         file,
//         size,
//         geometry,
//         material,
//         x: Math.random() * 100 - 50, // Initialize x position within a reasonable range
//         y: Math.random() * 100 - 50, // Initialize y position within a reasonable range
//         z: Math.random() * 100 - 50  // Initialize z position within a reasonable range
//     };

//     const mesh = new THREE.Mesh(geometry, material);
//     mesh.position.set(node.x, node.y, node.z);
//     mesh.userData = { id };

//     scene.add(mesh);
//     node.mesh = mesh;

//     // Add text label
//     const loader = new FontLoader();
//     loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font) {
//         const textGeometry = new TextGeometry(file.name, {
//             font: font,
//             size: size / 2, // Adjust size relative to node size
//             height: 0.1,
//         });
//         const textMaterial = new THREE.MeshBasicMaterial({ color: color }); // Use the node's color
//         const textMesh = new THREE.Mesh(textGeometry, textMaterial);
//         textMesh.position.set(node.x, node.y + size, node.z); // Position above the node
//         scene.add(textMesh);
//     });

//     nodes.push(node);

//     // Re-initialize drag controls with the new node
//     initDragControls();

//     console.log(`Node added: ${id}, Position: (${node.x}, ${node.y}, ${node.z})`);
// }

// // Update graph function (empty if no simulation is needed)
// export function updateGraph() {
//     // No-op if no simulation is needed
// }

// // Display metadata in popup
// export function showPopup(metadata) {
//     const popup = document.getElementById('popup');
//     popup.innerHTML = `
//       <p><strong>Name:</strong> ${metadata.name}</p>
//       <p><strong>Type:</strong> ${metadata.type}</p>
//       <p><strong>Size:</strong> ${metadata.size} bytes</p>
//       <p><strong>Last Modified:</strong> ${new Date(metadata.lastModified).toLocaleString()}</p>
//       <p><strong>Content:</strong> <pre>${metadata.content}</pre></p>
//     `;
//     popup.style.display = 'block';
// }

// // Animation loop
// function animate() {
//     requestAnimationFrame(animate);
//     if (controls) {
//         controls.update();
//     }
//     if (scene && camera) {
//         renderer.render(scene, camera);
//     }

//     // Debugging camera position and direction
//     // console.log(`Camera position: (${camera.position.x}, ${camera.position.y}, ${camera.position.z})`);
//     const vector = new THREE.Vector3();
//     camera.getWorldDirection(vector);
//     // console.log(`Camera direction: (${vector.x}, ${vector.y}, ${vector.z})`);
// }

// // Debugging function to log node positions
// export function debugNodes() {
//     nodes.forEach(node => {
//         console.log(`Node ${node.id}: (${node.x.toFixed(2)}, ${node.y.toFixed(2)}, ${node.z.toFixed(2)})`);
//     });
// }


import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import graphStore from './memory/stores/graphStore';
import fileStore from './memory/stores/fileStore';

let scene, camera, controls, renderer, dragControls;
const nodes = [];


// // Set up the renderer
renderer = new THREE.WebGLRenderer();
// renderer.setClearColor(0x000000); // Black background

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

export function graphInit(initScene, initCamera) {
    scene = initScene;
    camera = initCamera;

    // Initialize controls
    controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(0, 0, 200); // Position the camera further away on the Z axis
    camera.lookAt(new THREE.Vector3(0, 0, 0)); // Ensure the camera is looking at the origin

    // Set up the renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Initialize drag controls
    initDragControls();

    // Load and add nodes from graph store
    loadAndAddNodes();

    // Start the animation loop after initialization
    animate();
}

// Initialize drag controls
function initDragControls() {
    dragControls = new DragControls(nodes.map(node => node.mesh), camera, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) {
        controls.enabled = false;
    });
    dragControls.addEventListener('dragend', function (event) {
        controls.enabled = true;
    });
}

// Load nodes from graph store and add them to the scene
function loadAndAddNodes() {
    graphStore.nodes.forEach(node => {
        addNode(node.id, fileStore.files.find(file => file.id === node.fileId));
    });
}

// Function to add a node to the graph
export function addNode(id, file) {
    console.log(`Adding node for file: ${file.name}`);

    const size = Math.cbrt(file.size) / 10; // Increase size scaling for better visibility
    const color = Math.random() * 0xffffff;
    const geometry = new THREE.SphereGeometry(size, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const node = {
        id,
        file,
        size,
        geometry,
        material,
        x: Math.random() * 100 - 50, // Initialize x position within a reasonable range
        y: Math.random() * 100 - 50, // Initialize y position within a reasonable range
        z: Math.random() * 100 - 50  // Initialize z position within a reasonable range
    };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(node.x, node.y, node.z);
    mesh.userData = { id };

    scene.add(mesh);
    node.mesh = mesh;

    // Add text label
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font) {
        const textGeometry = new TextGeometry(file.name, {
            font: font,
            size: size / 2, // Adjust size relative to node size
            depth: 0.1,
        });
        const textMaterial = new THREE.MeshBasicMaterial({ color: color }); // Use the node's color
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(node.x, node.y + size, node.z); // Position above the node
        scene.add(textMesh);
    });

    nodes.push(node);

    // Re-initialize drag controls with the new node
    initDragControls();

    console.log(`Node added: ${id}, Position: (${node.x}, ${node.y}, ${node.z})`);
}

// Update graph function (empty if no simulation is needed)
export function updateGraph() {
    // No-op if no simulation is needed
}

// Display metadata in popup
export function showPopup(metadata) {
    const popup = document.getElementById('popup');
    popup.innerHTML = `
      <p><strong>Name:</strong> ${metadata.name}</p>
      <p><strong>Type:</strong> ${metadata.type}</p>
      <p><strong>Size:</strong> ${metadata.size} bytes</p>
      <p><strong>Last Modified:</strong> ${new Date(metadata.lastModified).toLocaleString()}</p>
      <p><strong>Content:</strong> <pre>${metadata.content}</pre></p>
    `;
    popup.style.display = 'block';
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    if (controls) {
        controls.update();
    }
    if (scene && camera) {
        renderer.render(scene, camera);
    }

    // Debugging camera position and direction
    // console.log(`Camera position: (${camera.position.x}, ${camera.position.y}, ${camera.position.z})`);
    const vector = new THREE.Vector3();
    camera.getWorldDirection(vector);
    // console.log(`Camera direction: (${vector.x}, ${vector.y}, ${vector.z})`);
}

// Debugging function to log node positions
export function debugNodes() {
    nodes.forEach(node => {
        console.log(`Node ${node.id}: (${node.x.toFixed(2)}, ${node.y.toFixed(2)}, ${node.z.toFixed(2)})`);
    });
}
