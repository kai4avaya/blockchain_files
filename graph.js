import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000); // Adjusted far clipping plane
camera.position.set(500, 500, 500); // Set an initial position that can see all objects
camera.lookAt(new THREE.Vector3(0, 0, 0));

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
renderer.domElement.addEventListener('click', onClick, false);
// Variables to store file information
let files = [];
let filePoints = [];
let cubes = [];
// JUST FAKE FOR STORE
const sampleData = [
  { id: 1, name: 'Cube 1', size: 100, x: 100, y: 88, z: 100, color: getBrightColor() },
  { id: 2, name: 'Cube 2', size: 200, x: -10, y: 100, z: -100, color: getBrightColor() },
  { id: 3, name: 'Cube 3', size: 300, x: 100, y: -100, z: 11, color: getBrightColor() },
  { id: 4, name: 'Cube 4', size: 100, x: -100, y: -100, z: -100, color: getBrightColor() }
];
// Initialize the graph with the sample data
initiateGraph(sampleData);

function getBrightColor() {
  const colors = [0xff00ff, 0x00ffff, 0xffff00, 0xffa500, 0x00ff00, 0x0000ff]; // Example bright and fluorescent colors
  return colors[Math.floor(Math.random() * colors.length)];
}

function initiateGraph(data) {
  data.forEach((cubeData) => {
    let { id, name, size, x, y, z, color } = cubeData;

    // Create the initial cube
    const cube = createWireframeCube(size, x, y, z, color);
    let isColliding = true;

    console.log("i am cube", cube);

    // Loop to resolve collisions
    while (isColliding) {
      isColliding = false;
      for (const existingCube of cubes) {
        const cubeBoundingBox = new THREE.Box3().setFromObject(cube.wireframeCube);
        const existingCubeBoundingBox = new THREE.Box3().setFromObject(existingCube.wireframeCube);

        if (cubeBoundingBox.intersectsBox(existingCubeBoundingBox)) {
          // Adjust position to resolve collision
          x += (Math.random() * 40 - 20);
          y += (Math.random() * 40 - 20);
          z += (Math.random() * 40 - 20);
          cube.wireframeCube.position.set(x, y, z);
          cube.solidCube.position.set(x, y, z);
          isColliding = true;
          break;
        }
      }
    }

    // Finally, add the cube to the scene and the array
    cubes.push(cube);
  });
}

function getColorForFileType(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  switch(extension) {
    case 'pdf': return 0xff0000; // Red for PDFs
    case 'jpg':
    case 'png':
    case 'gif': return 0x00ff00; // Green for images
    default: return 0xffff00; // Yellow for other types
  }
}

let INTERSECTED;

function createWireframeCube(size, x, y, z, color) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
  const wireframeCube = new THREE.LineSegments(edges, material);
  wireframeCube.position.set(x, y, z);

  // const solidCubeMaterial = new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: 0.5 });
  const solidCubeMaterial = new THREE.MeshBasicMaterial( {color: color,  transparent: true, opacity: 0} ); 
  const solidCube = new THREE.Mesh(geometry, solidCubeMaterial);
  solidCube.position.set(x, y, z);

  const cube = {
    wireframeCube: wireframeCube,
    solidCube: solidCube
  };

  scene.add(wireframeCube);
  scene.add(solidCube);

  return cube;
}


function onClick() {

  console.log(" CLICKY mouse x,y", mouse.x, mouse.y);
  event.preventDefault();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  var intersects = raycaster.intersectObject(scene, true);

  console.log("intersects Clikcy", intersects);
  if (intersects.length > 0) {
	
		var object = intersects[0].object;

    object.material.color.set( Math.random() * 0xffffff );

  }
	
	render();

}


function render() {

  renderer.render(scene, camera);

}


function checkIntersections() {
  console.log("mouse x,y", mouse.x, mouse.y);
  // addMouseTrail(mouse.x, mouse.y)
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(cubes.map(cube => cube.solidCube), false);
  console.log("intersects", intersects);

  if (intersects.length > 0) {
    if (INTERSECTED != intersects[0].object) {
      if (INTERSECTED) {
        INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
        INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
      }

      INTERSECTED = intersects[0].object;
      INTERSECTED.currentHex = INTERSECTED.material.color.getHex();
      INTERSECTED.currentOpacity = INTERSECTED.material.opacity;
      INTERSECTED.material.color.setHex(0xffff00); // Yellow color
      INTERSECTED.material.opacity = 0.5; // Set opacity to 0.5
    }
  } else {
    if (INTERSECTED) {
      INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
      INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
    }
    INTERSECTED = null;
  }
  
  renderer.render(scene, camera);
}

// Function to create a sphere for a file
// Function to create a sphere for a file
// Function to create a sphere for a file
function createFilePoint(data) {
  const { file, position, cube } = data;

  // Calculate point size based on file size
  const minSize = 5;
  const maxSize = 30;
  const pointSize = Math.max(minSize, Math.min(maxSize, Math.log2(file.size)));

  // Sphere geometry
  const geometry = new THREE.SphereGeometry(pointSize, 32, 32);

  // Basic material with transparency
  const material = new THREE.MeshBasicMaterial({
    color: getColorForFileType(file),
    transparent: true,
    opacity: 0.7,
    depthTest: false // Ensure the sphere is always visible
  });

  // Create the mesh
  const sphere = new THREE.Mesh(geometry, material);

  // Random position within the cube's bounds
  const halfSize = cube.geometry.parameters.width / 2;
  sphere.position.set(
    cube.position.x + (Math.random() * halfSize - halfSize / 2),
    cube.position.y + (Math.random() * halfSize - halfSize / 2),
    cube.position.z + (Math.random() * halfSize - halfSize / 2)
  );

  scene.add(sphere);
  filePoints.push(sphere);
  console.log(`Added sphere for ${file.name} with size ${pointSize} inside cube at position: ${sphere.position.x}, ${sphere.position.y}, ${sphere.position.z}`);
  return sphere;
}


// for debugging mouse position
function addMouseTrail(x, y) {
  console.log("addMouseTrail", x, y);
  // Set raycaster from camera and mouse position
  raycaster.setFromCamera({ x, y }, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  let point;
  if (intersects.length > 0) {
    point = intersects[0].point;
  } else {
    // If no intersection, set a point far away in the direction of the ray
    const direction = raycaster.ray.direction.clone().multiplyScalar(1000);
    point = raycaster.ray.origin.clone().add(direction);
  }

  // Sphere geometry
  const geometry = new THREE.SphereGeometry(2, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.copy(point);

  scene.add(sphere);
}


function animate() {
  requestAnimationFrame(animate);
  // checkIntersections();
  controls.update();
  renderer.render(scene, camera);
}


animate(); // Start the animation loop

// Track mouse movement
// Adjust mouse coordinates considering the offset of the overlaying div
window.addEventListener('mousemove', (event) => {
  const offset = 0 // document.getElementById('innerSlideout').offsetWidth;
  const adjustedX = event.clientX - offset;
  
  mouse.x = (adjustedX / (window.innerWidth - offset)) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  addMouseTrail(mouse.x, mouse.y);
});


// Handle file drag-and-drop
window.addEventListener('dragover', (event) => {
  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  checkIntersections(); // Check for intersections
});

// Handle file drag-and-drop
window.addEventListener('dragleave', (event) => {
  event.preventDefault();
  if (INTERSECTED) {
    INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
    INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
    INTERSECTED = null;
  }
});

// Add event listener for file drop
window.addEventListener('drop', (event) => {
  event.preventDefault();
  const dt = event.dataTransfer;
  const fileList = dt.files;

  // Convert mouse position to normalized device coordinates (-1 to +1) for both components.
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

  // Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);

  // Calculate objects intersecting the picking ray
  const intersects = raycaster.intersectObjects(cubes.map(cube => cube.solidCube), false);

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];

    if (intersects.length > 0) {
      const cube = intersects[0].object;
      const data = { file, position: cube.position, cube };
      createFilePoint(data);
    } else {
      const dropPosition = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(400),
        THREE.MathUtils.randFloatSpread(400),
        THREE.MathUtils.randFloatSpread(400)
      );
      const data = { file, position: dropPosition };
      createFilePoint(data);
    }
  }

  if (INTERSECTED) {
    INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
    INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
    INTERSECTED = null;
  }
});

// // Add event listener for file drop
// window.addEventListener('drop', (event) => {
//   event.preventDefault();
//   const dt = event.dataTransfer;
//   const fileList = dt.files;

//   const mouse = new THREE.Vector2();
//   const raycaster = new THREE.Raycaster();

//   // Convert mouse position to normalized device coordinates (-1 to +1) for both components.
//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

//   // Update the picking ray with the camera and mouse position
//   raycaster.setFromCamera(mouse, camera);

//   // Calculate objects intersecting the picking ray
//   const intersects = raycaster.intersectObjects(scene.children);

//   // If intersecting objects are found, use the intersection point as the drop position
//   let dropPosition = new THREE.Vector3();
//   if (intersects.length > 0) {
//     dropPosition = intersects[0].point;
//   } else {
//     // If no intersection, drop at a default or random position
//     dropPosition.set(
//       THREE.MathUtils.randFloatSpread(400),
//       THREE.MathUtils.randFloatSpread(400),
//       THREE.MathUtils.randFloatSpread(400)
//     );
//   }

//   for (let i = 0; i < fileList.length; i++) {
//     const file = fileList[i];
//     files.push(file);
//     const position = { x: dropPosition.x, y: dropPosition.y, z: dropPosition.z };
//     const data = { file, position };
//     createFilePoint(data);
//   }
//   if (INTERSECTED) {
//     const prevCube = cubes.find(cube => cube.wireframeCube === INTERSECTED);
//     prevCube.solidCube.material.opacity = 0;
//     INTERSECTED = null;
//   }
// });

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Placeholder functions for exporting
export function isRendererReady() {
  return true;
}

export function graphInit(initScene, initCamera, initRenderer) {
  // Placeholder implementation
}

export function updateGraph(newNodes, newLinks) {
  // Placeholder implementation
}

export function addNode(id, name = '', size = 1, x = Math.random() * 100 - 50, y = Math.random() * 100 - 50, z = Math.random() * 100 - 50, color = Math.random() * 0xffffff) {
  // Placeholder implementation
}
