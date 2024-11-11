
import * as THREE from 'three';

let renderer, scene, camera;
let width, height;
let canvas;

// Objects in the scene
const objects = {};

// Variables for camera control
let rotationX = 0;
let rotationY = 0;

// Handle incoming messages
self.onmessage = function(event) {
  const msg = event.data;
  console.log("Worker received message:", msg);

  switch (msg.type) {
    case 'init':
      canvas = msg.canvas;
      width = msg.width;
      height = msg.height;
      console.log(`Initializing renderer with dimensions: ${width}x${height}`);
      initRenderer();
      break;
    case 'resize':
      handleResize(msg.width, msg.height);
      break;
    case 'rotate':
      
      handleRotate(msg.deltaX, msg.deltaY);
      break;
    case 'createObject':
      handleCreateObject(msg.object);
      break;
    default:
      console.warn("Unknown message type:", msg.type);
  }
};


// Initialize Three.js renderer, scene, and camera
function initRenderer() {
  try {
    // Verify that the canvas is an OffscreenCanvas
    if (!(canvas instanceof OffscreenCanvas)) {
      throw new Error("Provided canvas is not an OffscreenCanvas.");
    }

    // Mock the style property to prevent errors in Three.js
    canvas.style = {
      width: `${width}px`,
      height: `${height}px`
    };

    // Initialize WebGLRenderer with OffscreenCanvas
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1); // OffscreenCanvas does not have a device pixel ratio
    renderer.setClearColor(0x000000, 1); // Set background color
    console.log("WebGLRenderer initialized:", renderer);

    // Initialize scene
    scene = new THREE.Scene();

    // Initialize camera
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    console.log("Scene and camera initialized.");

    // Start the render loop
    animate();

    // Notify main thread that initialization is complete
    self.postMessage({ type: 'initialized' });
  } catch (error) {
    console.error("Error initializing renderer:", error);
    self.postMessage({ type: 'error', message: error.message, stack: error.stack });
  }
}

// Handle resize messages
function handleResize(newWidth, newHeight) {
  try {
    width = newWidth;
    height = newHeight;

    // Update renderer size
    renderer.setSize(width, height);
    console.log(`Renderer resized to: ${width}x${height}`);

    // Update camera aspect ratio
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    console.log("Camera aspect ratio updated.");

    // Re-render the scene after resize
    renderer.render(scene, camera);
  } catch (error) {
    console.error("Error handling resize:", error);
    self.postMessage({ type: 'error', message: error.message, stack: error.stack });
  }
}

function handleRotate(deltaX, deltaY) {
    rotationY += deltaX;
    rotationX += deltaY;
  
    // Clamp rotationX to prevent flipping
    rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationX));
  
    console.log(`Received rotation: deltaX=${deltaX}, deltaY=${deltaY}`);
    console.log(`Updated rotations: rotationX=${rotationX}, rotationY=${rotationY}`);
  }
  

// Handle createObject messages
function handleCreateObject(objectType) {
  try {
    let geometry, material, mesh;

    switch (objectType) {
      case 'cube':
        geometry = new THREE.BoxGeometry();
        material = new THREE.MeshNormalMaterial();
        mesh = new THREE.Mesh(geometry, material);
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.5, 32, 32);
        material = new THREE.MeshNormalMaterial();
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = 2; // Position the sphere to the side of the cube
        break;
      default:
        console.warn(`Unknown object type: ${objectType}`);
        return;
    }

    // Assign a unique identifier to the mesh
    const id = THREE.MathUtils.generateUUID();
    mesh.userData.id = id;

    // Add mesh to scene and objects dictionary
    scene.add(mesh);
    objects[id] = mesh;

    console.log(`Added ${objectType} with ID: ${id}`);
  } catch (error) {
    console.error(`Error creating object '${objectType}':`, error);
    self.postMessage({ type: 'error', message: error.message, stack: error.stack });
  }
}
// Animation loop using requestAnimationFrame

  
  // Animation loop using requestAnimationFrame
// Animation loop
function animate() {
    // Apply camera rotations
    const radius = 5; // Distance from the center
    camera.position.x = radius * Math.sin(rotationY) * Math.cos(rotationX);
    camera.position.y = radius * Math.sin(rotationX);
    camera.position.z = radius * Math.cos(rotationY) * Math.cos(rotationX);
    camera.lookAt(scene.position);
  
    // console.log(`Camera position: x=${camera.position.x.toFixed(2)}, y=${camera.position.y.toFixed(2)}, z=${camera.position.z.toFixed(2)}`);
    // console.log(`Rotation values: rotationX=${rotationX.toFixed(2)}, rotationY=${rotationY.toFixed(2)}`);
  
    renderer.render(scene, camera);
    self.requestAnimationFrame(animate);
  }