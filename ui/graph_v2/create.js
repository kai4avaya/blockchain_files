import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {} from "./move.js";
import { makeObjectWritable, convertToThreeJSFormat } from "../../utils/utils";
import { createSceneSnapshot, findSpheresInCube, getCubeContainingSphere } from "./snapshot.js";


import { Frustum, Matrix4 } from 'three';
const frustum = new Frustum();
const projScreenMatrix = new Matrix4();


const BLOOM_SCENE = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);
const SCALEFACTOR = 0.05

export const scene = new THREE.Scene();
export const nonBloomScene = new THREE.Scene();

const params = {
  threshold: 0,
  strength: 1,
  radius: 0.5,
  exposure: 1,
};

// Create nonBloomRT once
const nonBloomRT = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  }
);
const darkMaterial = new THREE.MeshBasicMaterial({ color: "black" });
const materials = {};
// const renderer = new THREE.WebGLRenderer( { antialias: true } );
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);
// const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  1,
  200
);
camera.position.set(0, 0, 20);
camera.lookAt(0, 0, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI * 0.5;
controls.minDistance = 1;
controls.maxDistance = 100;
let needsRender = false;
let renderCount = 0;

// At the top of your file
let ghostCube = null;

const renderScene = new RenderPass(scene, camera);
// const nonBloomScene = new THREE.Scene();
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,
  0.4,
  0.85
);
bloomPass.threshold = params.threshold;
bloomPass.strength = params.strength;
bloomPass.radius = params.radius;
const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);
const mixPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: document.getElementById("vertexshader").textContent,
    fragmentShader: document.getElementById("fragmentshader").textContent,
    defines: {},
  }),
  "baseTexture"
);
mixPass.needsSwap = true;
const outputPass = new OutputPass();
const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(renderScene);
finalComposer.addPass(mixPass);
finalComposer.addPass(outputPass);
const bloomTexturePass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
    fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          vec4 baseColor = texture2D(baseTexture, vUv);
          vec4 bloomColor = texture2D(bloomTexture, vUv);
          gl_FragColor = baseColor + bloomColor;
        }
      `,
    defines: {},
  }),
  "baseTexture"
);
const nonBloomTexturePass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      nonBloomTexture: { value: nonBloomRT.texture },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
    fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D nonBloomTexture;
        varying vec2 vUv;
        void main() {
          vec4 baseColor = texture2D(baseTexture, vUv);
          vec4 nonBloomColor = texture2D(nonBloomTexture, vUv);
          gl_FragColor = baseColor + nonBloomColor;
        }
      `,
    defines: {},
  }),
  "baseTexture"
);
bloomTexturePass.uniforms["bloomTexture"].value =
  bloomComposer.renderTarget2.texture;
nonBloomTexturePass.uniforms["nonBloomTexture"].value = nonBloomRT.texture;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
// setupScene();
let cubes = [];
const updateMiniMap = createMiniMap(scene, nonBloomScene, camera, renderer);

// Add this function to your code
function addGridHelper() {
  const size = 100;
  const divisions = 100;
  const gridHelper = new THREE.GridHelper(size, divisions);
  scene.add(gridHelper);
  
}
function createEnvironment() {
  // Create a large grid
  const gridSize = 1000;
  const gridDivisions = 100;
  const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x444444);
  scene.add(gridHelper);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Add directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(1, 1, 1).normalize();
  scene.add(directionalLight);

}

function loadTerrain(file, callback) {
  const xhr = new XMLHttpRequest();
  xhr.responseType = 'arraybuffer';
  xhr.open('GET', file, true);
  xhr.onload = function(evt) {    
    if (xhr.response) {
      callback(new Uint16Array(xhr.response));
    }
  };  
  xhr.send(null);
}

function createEnvironmentTerrain() {
  // Set the background to black
  scene.background = new THREE.Color(0x000000);

  loadTerrain('../../assets/besseggen.bin', function(data) {
    const width = 199;
    const height = 199;
    const geometry = new THREE.PlaneGeometry(60, 60, width - 1, height - 1);

    for (let i = 0, l = geometry.attributes.position.count; i < l; i++) {
      geometry.attributes.position.setZ(i, data[i] / 65535 * 10);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
      color: 0xdddddd,
      wireframe: true
    });

    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;  // Rotate to lay flat
    scene.add(terrain);

    markNeedsRender();
  });

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(1, 1, 1).normalize();
  scene.add(directionalLight);
}

controls.addEventListener("change", () => {
  markNeedsRender();
});

export async function initializeGraph() {
  setupScene();
}

export function randomColorGenerator() {
  // Generate bright fluorescent colors
  const r = Math.floor(Math.random() * 128 + 128); // 128-255 range for bright colors
  const g = Math.floor(Math.random() * 128 + 128); // 128-255 range for bright colors
  const b = Math.floor(Math.random() * 128 + 128); // 128-255 range for bright colors
  return `rgb(${r}, ${g}, ${b})`;
}

// Define global variables for geometry and materials
const geometry = new THREE.BoxGeometry(1, 1, 1);
const edges = new THREE.EdgesGeometry(geometry);
let wireMaterial;
let solidMaterial;


export function resizeCubeToFitSpheres(cube, minSizeAllowed = false, buffer = 5) {
  // Instead of using cubeGroups, we'll find spheres within the cube
  const spheres = findSpheresInCube(cube);
  if (spheres.length === 0) return;

  // Calculate the bounding box that fits all spheres
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  spheres.forEach((sphere) => {
    const spherePosition = sphere.position;
    const sphereRadius = sphere.scale.x / 2; // Assuming uniform scale

    minX = Math.min(minX, spherePosition.x - sphereRadius);
    minY = Math.min(minY, spherePosition.y - sphereRadius);
    minZ = Math.min(minZ, spherePosition.z - sphereRadius);
    maxX = Math.max(maxX, spherePosition.x + sphereRadius);
    maxY = Math.max(maxY, spherePosition.y + sphereRadius);
    maxZ = Math.max(maxZ, spherePosition.z + sphereRadius);
  });

  // Add buffer to the bounding box dimensions
  minX -= buffer;
  minY -= buffer;
  minZ -= buffer;
  maxX += buffer;
  maxY += buffer;
  maxZ += buffer;

  // Calculate the new size of the cube based on the bounding box
  const newCubeSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ);

  // Get the current size of the cube
  const currentCubeSize = cube.scale.x; // Assuming uniform scale

  // Determine the final cube size
  const finalCubeSize = minSizeAllowed ? newCubeSize : Math.max(newCubeSize, currentCubeSize);

  // Set the cube size to the final calculated size
  cube.scale.set(finalCubeSize, finalCubeSize, finalCubeSize);

  // Center the cube on the spheres
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  cube.position.set(centerX, centerY, centerZ);
}

export function createWireframeCube(convertedData) {
  // Update materials with the new color
  wireMaterial = new THREE.LineBasicMaterial({ color: convertedData.color, linewidth: 2 });
  solidMaterial = new THREE.MeshBasicMaterial({ color: convertedData.color, transparent: true, opacity: 0 });

  // Create wireframe and solid cubes using the global geometry and updated materials
  const wireframeCube = new THREE.LineSegments(edges, wireMaterial);
  const solidCube = new THREE.Mesh(geometry, solidMaterial);

  // Make entire object writable
  makeObjectWritable(wireframeCube);
  makeObjectWritable(solidCube);

  // Set position and scale
  [wireframeCube, solidCube].forEach(cube => {
    if (convertedData.position) cube.position.copy(convertedData.position);
    cube.scale.setScalar(convertedData.size);
  });

  Object.assign(wireframeCube, {
    ...convertedData,
    shape: "wireframeCube",
  });

  const uuid = wireframeCube.uuid;

  Object.assign(solidCube, {
    ...convertedData,
    userData: { id: convertedData?.userData?.id + "_solid" },
    shape: "solidCube",
    uuid: uuid + "-solid",
  });

  resizeCubeToFitSpheres(wireframeCube);
  resizeCubeToFitSpheres(solidCube);

  nonBloomScene.add(wireframeCube);
  nonBloomScene.add(solidCube);


  return { wireframeCube, solidCube };
}


export function resetSphereScales(spheres, defaultScale = 1) {
  spheres.forEach((sphere) => {
    sphere.scale.set(defaultScale, defaultScale, defaultScale);
  });
}

window.onresize = function () {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  bloomComposer.setSize(width, height);
  finalComposer.setSize(width, height);

  // render();
  markNeedsRender();
};


function saveCameraState() {
  const cameraState = {
    position: camera.position.toArray(),
    rotation: camera.rotation.toArray(),
    zoom: camera.zoom,
  };
  localStorage.setItem("cameraState", JSON.stringify(cameraState));
}

function loadCameraState() {
  const savedState = localStorage.getItem("cameraState");
  if (savedState) {
    const cameraState = JSON.parse(savedState);
    camera.position.fromArray(cameraState.position);
    camera.rotation.fromArray(cameraState.rotation);
    camera.zoom = cameraState.zoom;
    camera.updateProjectionMatrix();
  }
}

// Modify your setupScene function
function setupScene() {
  scene.traverse(disposeMaterial);
  scene.children.length = 0;
  nonBloomScene.traverse(disposeMaterial);
  nonBloomScene.children.length = 0;
// 
  loadCameraState();

  createEnvironment();

  markNeedsRender();
}

// Add an event listener to save camera state when the window is about to unload
window.addEventListener("beforeunload", saveCameraState);

// Modify your controls event listener to save camera state after changes
controls.addEventListener("change", () => {
  markNeedsRender();
  saveCameraState();
});

// Define global variables for geometry and material
const sphereGeometry = new THREE.IcosahedronGeometry(1, 15);
let sphereMaterial;

export function createSphere(convertedData) {

  // Update material with the new color
  const color = convertedData.color || new THREE.Color().setHSL(
    Math.random(),
    0.7,
    Math.random() * 0.2 + 0.05
  );
  sphereMaterial = new THREE.MeshBasicMaterial({ color });

  // Create sphere using the global geometry and updated material
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  // Make entire object writable
  makeObjectWritable(sphere);

  // Set position
  if (convertedData.position) sphere.position.copy(convertedData.position);

  // Set scale (size)
  const scaleFactor = convertedData.size * SCALEFACTOR; // scaling
  sphere.scale.setScalar(scaleFactor);

  // Assign other properties, but don't overwrite the scale
  Object.assign(sphere, {
    ...convertedData,
    scale: sphere.scale, // Preserve the scale we just set
    shape: "sphere",
  });

  // Store the original size as a separate property
  sphere.originalSize = convertedData.size;

  scene.add(sphere);

  if (Math.random() < 0.25) sphere.layers.enable(BLOOM_SCENE);

  markNeedsRender();

  return { sphere };
}

function disposeMaterial(obj) {
  if (obj.material) {
    obj.material.dispose();
  }
}

// Combine the bloom and non-bloom scenes
finalComposer.addPass(new RenderPass(scene, camera)); // Add a render pass for the main scene
finalComposer.addPass(bloomTexturePass); // Add a texture pass for the bloom scene
finalComposer.addPass(nonBloomTexturePass); // Add a texture pass for the non-bloom scene

export function render() {

  projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreenMatrix);

  scene.traverse(object => {
    if (object.isMesh) {
      if (frustum.intersectsObject(object)) {
        darkenNonBloomed(object);
      } else {
        object.visible = false;
      }
    }
  });
  bloomComposer.render();
  scene.traverse(restoreMaterial);

  nonBloomScene.traverse(object => {
    if (object.isMesh) {
      object.visible = frustum.intersectsObject(object);
    }
  });
  renderer.setRenderTarget(nonBloomRT);
  renderer.clear();
  renderer.render(nonBloomScene, camera);

  finalComposer.render();

}

function darkenNonBloomed(obj) {
  if (obj.isMesh && !bloomLayer.test(obj.layers)) {
    if (!materials[obj.uuid]) {
      materials[obj.uuid] = obj.material;
      obj.material = darkMaterial;
    }
  }
}

function restoreMaterial(obj) {
  if (materials[obj.uuid]) {
    obj.material = materials[obj.uuid];
    delete materials[obj.uuid];
  }
}

export function markNeedsRender() {
  needsRender = true;
  renderCount = 1; // Render for the next 2 frames
  updateMiniMap();
}

function animate() {
  requestAnimationFrame(animate);
  if (needsRender || renderCount > 0) {
    render();
    if (renderCount > 0) {
      renderCount--;
    } else {
      needsRender = false;
    }
  }
}

animate();

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

export function addNode(
  id,
  name = "",
  size = 1,
  x = Math.random() * 100 - 50,
  y = Math.random() * 100 - 50,
  z = Math.random() * 100 - 50,
  color = Math.random() * 0xffffff
) {
  // Placeholder implementation
}
export function share3dDat() {
  return {
    camera: typeof camera !== "undefined" ? camera : null,
    nonBloomScene: typeof nonBloomScene !== "undefined" ? nonBloomScene : null,
    renderer: typeof renderer !== "undefined" ? renderer : null,
    mouse: typeof mouse !== "undefined" ? mouse : null,
    raycaster: typeof raycaster !== "undefined" ? raycaster : null,
    scene: typeof scene !== "undefined" ? scene : null,
    cubes: typeof cubes !== "undefined" ? cubes : null,
    controls: typeof controls !== "undefined" ? controls : null,
    ghostCube: typeof ghostCube !== "undefined" ? ghostCube : null,
  };
}
// export function removeEmptyCubes(scene, nonBloomScene) {
//   // Create a snapshot of the current scene
//   const snapshot = createSceneSnapshot([scene, nonBloomScene]);

//   // Array to store cubes that need to be removed
//   const cubesToRemove = [];
//   const removedCubes = [];

//   console.log("i am snapshot to remove", snapshot)
//   // Check each cube in the snapshot
//   snapshot.boxes.forEach((box) => {
//     const containedSpheres = snapshot.containment[box.id];

//     // If the cube contains no spheres, add it to the removal list
//     if (!containedSpheres || containedSpheres.length <= 1) {
//       cubesToRemove.push(box);
//     }
//   });

//   // Remove the empty cubes from the scenes
//   cubesToRemove.forEach((box) => {
//     if (box.wireframe) {
//       nonBloomScene.remove(box.wireframe);
//       box.wireframe.geometry.dispose();
//       box.wireframe.material.dispose();
//     }
//     if (box.solid) {
//       nonBloomScene.remove(box.solid);
//       box.solid.geometry.dispose();
//       box.solid.material.dispose();
//     }

//     // Remove from the snapshot as well
//     const boxIndex = snapshot.boxes.findIndex((b) => b.id === box.id);
//     if (boxIndex !== -1) {
//       snapshot.boxes.splice(boxIndex, 1);
//     }
//     delete snapshot.containment[box.id];

//     // Add to the removedCubes array
//     removedCubes.push(box);
//   });

//   markNeedsRender();
//   // Return the removed cubes
//   return removedCubes;
// }

export function removeEmptyCubes(scene, nonBloomScene) {
  const snapshot = createSceneSnapshot([scene, nonBloomScene]);
  const cubesToRemove = [];
  const removedCubes = [];

  console.log("Initial snapshot:", JSON.parse(JSON.stringify(snapshot)));

  // Identify cubes to remove
  snapshot.boxes.forEach((box) => {
    const boxId = box.wireframe.userData.id;
    const containedSpheres = snapshot.containment[boxId];

    if (!containedSpheres || containedSpheres.length < 2) {
      cubesToRemove.push(box);
    }
  });

  console.log("Cubes to remove:", cubesToRemove);

  // Remove the identified cubes
  cubesToRemove.forEach((box) => {
    const boxId = box.wireframe.userData.id;

    // Remove wireframe
    if (box.wireframe) {
      console.log(`Removing wireframe cube: ${boxId}`);
      nonBloomScene.remove(box.wireframe);
      box.wireframe.geometry.dispose();
      box.wireframe.material.dispose();
    }

    // Remove solid
    if (box.solid) {
      console.log(`Removing solid cube: ${boxId}`);
      nonBloomScene.remove(box.solid);
      box.solid.geometry.dispose();
      box.solid.material.dispose();
    }

    // Remove from the snapshot
    const boxIndex = snapshot.boxes.findIndex((b) => b.wireframe.userData.id === boxId);
    if (boxIndex !== -1) {
      snapshot.boxes.splice(boxIndex, 1);
    }
    delete snapshot.containment[boxId];

    removedCubes.push(box);
  });

  console.log("i is snapshot! after REMOVE", snapshot)
  // Remove any cubes not present in the containment list
  snapshot.boxes.forEach((box) => {
    const boxId = box.wireframe.userData.id;
    if (!snapshot.containment.hasOwnProperty(boxId)) {
      console.log(`Removing cube not in containment: ${boxId}`);
      nonBloomScene.remove(box.wireframe);
      nonBloomScene.remove(box.solid);
      box.wireframe.geometry.dispose();
      box.wireframe.material.dispose();
      box.solid.geometry.dispose();
      box.solid.material.dispose();
      removedCubes.push(box);
    }
  });

  console.log("Final snapshot:", JSON.parse(JSON.stringify(snapshot)));
  console.log("Removed cubes:", removedCubes);

  // Ensure immediate update
  nonBloomScene.updateMatrixWorld(true);
  markNeedsRender();
  
  // Force an immediate render
  // const { renderer, camera } = share3dDat();
  // renderer.render(nonBloomScene, camera);

  return removedCubes;
}

export function createGhostCube(position, size, existingCube = null) {
  if (ghostCube) return; // Prevent multiple ghost cubes

  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    opacity: 0.5,
    transparent: true,
  });

  ghostCube = new THREE.Mesh(geometry, material);
  ghostCube.position.copy(position);

  // **Store reference to existing cube, if any**
  ghostCube.existingCube = existingCube;

  const { scene } = share3dDat();
  scene.add(ghostCube);
  markNeedsRender();
}


export function removeGhostCube() {
  if (ghostCube) {
    const { scene } = share3dDat();
    scene.remove(ghostCube);
    ghostCube.geometry.dispose();
    ghostCube.material.dispose();
    ghostCube = null;
    markNeedsRender();
  }
}


export function reconstructScene(snapshot) {
  console.log("Reconstructing scene with snapshot:", snapshot);
  snapshot.forEach((objectState) => {
    const existingObject = scene.getObjectByProperty('uuid', objectState.uuid) || 
                             nonBloomScene.getObjectByProperty('uuid', objectState.uuid);
     if (objectState.isDeleted) {
      console.log("Removing deleting reconstruct object", objectState)
                  removeObject(existingObject);
                            }
     else if (existingObject) {
        objectState.isUpdated && updateObjectProperties(existingObject, objectState);
      } 
     else {
        createObject(objectState);
      }
  });
  markNeedsRender();
}

function updateObjectProperties(object, objectState) {
  objectState.isUpdated = false;

  if (objectState.position) object.position.fromArray(objectState.position);
  // if (objectState.scale) object.scale.fromArray(objectState.scale);
  if (objectState.color !== undefined && object.material) {
    object.material.color.setHex(objectState.color);
  }
  if (objectState.version !== undefined) object.version = objectState.version;

  // Update size for cubes
  if ((object.shape === "wireframeCube" || object.shape === "solidCube") && objectState.size !== undefined) {
    object.scale.setScalar(objectState.size);
  }
}

function createObject(objectState) {
  if (objectState.shape === "sphere") {
    createSphereWrapper(objectState);
  } else if (objectState.shape === "wireframeCube") {
    createCubeWrapper(objectState);
  }
}

function removeObject(entry) {
  if (!entry?.object) return;

  if (entry.inScene) {
    scene.remove(entry.object);
  } else {
    nonBloomScene.remove(entry.object);
  }

  if (entry.object.material) entry.object.material.dispose();
  if (entry.object.geometry) entry.object.geometry.dispose();
}

function createCubeWrapper(objectState) {
  if (objectState.shape === "wireframeCube") {
    const objData = convertToThreeJSFormat(objectState);
    createWireframeCube(objData);
  }
}

// function createSphereWrapper(objectState) {
//   const { sphere } = createSphere(
//     objectState.position[0],
//     objectState.position[1],
//     objectState.position[2],
//     objectState.scale[0] * 20,
//     objectState.version,
//     objectState.uuid,
//     objectState.color
//   );
//   sphere.uuid = objectState.uuid;
// }

function createSphereWrapper(objectState) {
  const convertedData = convertToThreeJSFormat(objectState);
  const { sphere } = createSphere(convertedData);
  // sphere.uuid = objectState.uuid;
}


// // mini-map.js

// export function createMiniMap(scene, nonBloomScene, camera, renderer) {
// const mapSize = 150; // Size of the mini-map
//   const padding = 10; // Padding from the edges of the screen
//   const borderWidth = 2; // Width of the border

//   // Create container div for border
//   const container = document.createElement('div');
//   container.style.position = 'absolute';
//   container.style.right = `${padding}px`;
//   container.style.bottom = `${padding}px`;
//   container.style.width = `${mapSize + 2 * borderWidth}px`;
//   container.style.height = `${mapSize + 2 * borderWidth}px`;
//   container.style.backgroundColor = 'rgba(211, 211, 211, 0.5)'; // Light gray, semi-transparent
//   container.style.padding = `${borderWidth}px`;
//   document.body.appendChild(container);

//   // Create canvas element
//   const canvas = document.createElement('canvas');
//   canvas.width = mapSize;
//   canvas.height = mapSize;
//   canvas.style.display = 'block'; // Removes tiny gap between canvas and border
//   canvas.style.backgroundColor = 'rgba(0,0,0,0.5)';
//   container.appendChild(canvas);

//   const ctx = canvas.getContext('2d');

//   // Create viewport indicator
//   const viewportIndicator = document.createElement('div');
//   viewportIndicator.style.position = 'absolute';
//   viewportIndicator.style.border = '1px solid yellow';
//   viewportIndicator.style.pointerEvents = 'none';
//   document.body.appendChild(viewportIndicator);
//   function updateMiniMap() {
//     ctx.clearRect(0, 0, mapSize, mapSize);

//     // Function to draw objects from a scene
//     function drawSceneObjects(sceneToRender) {
//       sceneToRender.traverse((object) => {
//         if (object.isMesh) {
//           let x, y, color;

//           if (object.geometry.type === "IcosahedronGeometry") {
//             // Sphere (from main scene)
//             x = (object.position.x + 50) * (mapSize / 100);
//             y = (object.position.z + 50) * (mapSize / 100);
//             color = 'red';
//           } else if (object.geometry.type === "BoxGeometry") {
//             // Cube (from nonBloomScene)
//             x = (object.position.x + 50) * (mapSize / 100);
//             y = (object.position.z + 50) * (mapSize / 100);
//             color = object.material.color.getStyle(); // Use the cube's actual color
//           } else {
//             return; // Skip other object types
//           }

//           ctx.fillStyle = color;
//           ctx.beginPath();
//           ctx.arc(x, y, 2, 0, Math.PI * 2);
//           ctx.fill();
//         }
//       });
//     }

//     // Draw objects from both scenes
//     drawSceneObjects(scene);
//     drawSceneObjects(nonBloomScene);

//     // Draw camera viewport
//     const aspect = camera.aspect;
//     const vFov = camera.fov * Math.PI / 180;
//     const height = 2 * Math.tan(vFov / 2) * camera.position.y;
//     const width = height * aspect;

//     const vpX = (camera.position.x + 50) * (mapSize / 100);
//     const vpY = (camera.position.z + 50) * (mapSize / 100);
//     const vpWidth = width * (mapSize / 100);
//     const vpHeight = height * (mapSize / 100);

//     ctx.strokeStyle = 'green';
//     ctx.strokeRect(vpX - vpWidth/2, vpY - vpHeight/2, vpWidth, vpHeight);

//     // Update viewport indicator
//     viewportIndicator.style.left = `${canvas.offsetLeft + vpX - vpWidth/2}px`;
//     viewportIndicator.style.top = `${canvas.offsetTop + vpY - vpHeight/2}px`;
//     viewportIndicator.style.width = `${vpWidth}px`;
//     viewportIndicator.style.height = `${vpHeight}px`;
//   }

//   // Initial update
//   updateMiniMap();

//   // Return the update function so it can be called in the animation loop
//   return updateMiniMap;
// }

// export function createMiniMap(scene, nonBloomScene, camera, renderer) {
//   const mapSize = 150; // Size of the mini-map
//   const padding = 10; // Padding from the edges of the screen
//   const borderWidth = 2; // Width of the border

//   // Create container div for border
//   const container = document.createElement('div');
//   container.style.position = 'absolute';
//   container.style.right = `${padding}px`;
//   container.style.bottom = `${padding}px`;
//   container.style.width = `${mapSize + 2 * borderWidth}px`;
//   container.style.height = `${mapSize + 2 * borderWidth}px`;
//   container.style.backgroundColor = 'rgba(211, 211, 211, 0.5)'; // Light gray, semi-transparent
//   container.style.padding = `${borderWidth}px`;
//   document.body.appendChild(container);

//   // Create canvas element
//   const canvas = document.createElement('canvas');
//   canvas.width = mapSize;
//   canvas.height = mapSize;
//   canvas.style.display = 'block'; // Removes tiny gap between canvas and border
//   canvas.style.backgroundColor = 'rgba(0,0,0,0.5)';
//   container.appendChild(canvas);

//   const ctx = canvas.getContext('2d');

//   function updateMiniMap() {
//     ctx.clearRect(0, 0, mapSize, mapSize);

//     // Function to draw objects from a scene
//     function drawSceneObjects(sceneToRender) {
//       sceneToRender.traverse((object) => {
//         if (object.isMesh) {
//           let x, y, color;

//           if (object.geometry.type === "IcosahedronGeometry") {
//             // Sphere (from main scene)
//             x = (object.position.x + 50) * (mapSize / 100);
//             y = (object.position.z + 50) * (mapSize / 100);
//             color = 'red';
//           } else if (object.geometry.type === "BoxGeometry") {
//             // Cube (from nonBloomScene)
//             x = (object.position.x + 50) * (mapSize / 100);
//             y = (object.position.z + 50) * (mapSize / 100);
//             color = object.material.color.getStyle(); // Use the cube's actual color
//           } else {
//             return; // Skip other object types
//           }

//           ctx.fillStyle = color;
//           ctx.beginPath();
//           ctx.arc(x, y, 2, 0, Math.PI * 2);
//           ctx.fill();
//         }
//       });
//     }

//     // Draw objects from both scenes
//     drawSceneObjects(scene);
//     drawSceneObjects(nonBloomScene);

//     // Calculate camera position on mini-map
//     const cameraX = (camera.position.x + 50) * (mapSize / 100);
//     const cameraZ = (camera.position.z + 50) * (mapSize / 100);

//     // Calculate viewport rectangle
//     const fov = camera.fov * Math.PI / 180;
//     const aspectRatio = camera.aspect;
//     const distance = Math.abs(camera.position.y); // Distance from camera to ground plane
//     const vFov = 2 * Math.atan(Math.tan(fov / 2) / aspectRatio);
    
//     // Adjust for zoom
//     const zoomFactor = 1 / camera.zoom;
//     const viewportWidth = 2 * distance * Math.tan(fov / 2) * (mapSize / 100) * zoomFactor;
//     const viewportHeight = 2 * distance * Math.tan(vFov / 2) * (mapSize / 100) * zoomFactor;

//     // Ensure viewport doesn't exceed mini-map bounds
//     const maxSize = mapSize * 0.9; // 90% of mini-map size
//     const scale = Math.min(1, maxSize / Math.max(viewportWidth, viewportHeight));
//     const scaledWidth = viewportWidth * scale;
//     const scaledHeight = viewportHeight * scale;

//     // Rotate the viewport rectangle
//     ctx.save();
//     ctx.translate(cameraX, cameraZ);
//     ctx.rotate(-camera.rotation.y);

//     // Draw viewport rectangle
//     ctx.strokeStyle = 'yellow';
//     ctx.strokeRect(-scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);

//     // Draw direction indicator
//     ctx.beginPath();
//     ctx.moveTo(0, 0);
//     ctx.lineTo(0, -scaledHeight / 2);
//     ctx.stroke();

//     ctx.restore();
//   }

//   // Initial update
//   updateMiniMap();

//   // Return the update function so it can be called in the animation loop
//   return updateMiniMap;
// }


export function createMiniMap(scene, nonBloomScene, camera, renderer) {
  const mapSize = 150;
  const padding = 10;
  const borderWidth = 2;

  // Create container div for border
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.right = `${padding}px`;
  container.style.bottom = `${padding}px`;
  container.style.width = `${mapSize + 2 * borderWidth}px`;
  container.style.height = `${mapSize + 2 * borderWidth}px`;
  container.style.backgroundColor = 'rgba(211, 211, 211, 0.5)';
  container.style.padding = `${borderWidth}px`;
  document.body.appendChild(container);

  // Create canvas element
  const canvas = document.createElement('canvas');
  canvas.width = mapSize;
  canvas.height = mapSize;
  canvas.style.display = 'block';
  canvas.style.backgroundColor = 'rgba(0,0,0,0.5)';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // Add click event listener to the canvas
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert mini-map coordinates to world coordinates
    const worldX = (x / mapSize - 0.5) * 100;
    const worldZ = (y / mapSize - 0.5) * 100;

    // Set camera position
    camera.position.x = worldX;
    camera.position.z = worldZ;

    // Update controls target if you're using OrbitControls
    if (controls) {
      controls.target.set(worldX, 0, worldZ);
      controls.update();
    }

    markNeedsRender();
  });

  function updateMiniMap() {
    ctx.clearRect(0, 0, mapSize, mapSize);

    // Function to draw objects from a scene
    function drawSceneObjects(sceneToRender) {
      sceneToRender.traverse((object) => {
        if (object.isMesh) {
          let x, y, color;

          if (object.geometry.type === "IcosahedronGeometry") {
            x = (object.position.x + 50) * (mapSize / 100);
            y = (object.position.z + 50) * (mapSize / 100);
            color = 'red';
          } else if (object.geometry.type === "BoxGeometry") {
            x = (object.position.x + 50) * (mapSize / 100);
            y = (object.position.z + 50) * (mapSize / 100);
            color = object.material.color.getStyle();
          } else {
            return;
          }

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Draw objects from both scenes
    drawSceneObjects(scene);
    drawSceneObjects(nonBloomScene);

    // Calculate camera position on mini-map
    const cameraX = (camera.position.x + 50) * (mapSize / 100);
    const cameraZ = (camera.position.z + 50) * (mapSize / 100);

    // Calculate viewport rectangle
    const fov = camera.fov * Math.PI / 180;
    const aspectRatio = camera.aspect;
    const distance = Math.abs(camera.position.y); // Distance from camera to ground plane
    const vFov = 2 * Math.atan(Math.tan(fov / 2) / aspectRatio);
    
    // Adjust for zoom
    const zoomFactor = 1 / camera.zoom;
    const viewportWidth = 2 * distance * Math.tan(fov / 2) * (mapSize / 100) * zoomFactor;
    const viewportHeight = 2 * distance * Math.tan(vFov / 2) * (mapSize / 100) * zoomFactor;

    // Ensure viewport doesn't exceed mini-map bounds
    const maxSize = mapSize * 0.9; // 90% of mini-map size
    const scale = Math.min(1, maxSize / Math.max(viewportWidth, viewportHeight));
    const scaledWidth = viewportWidth * scale;
    const scaledHeight = viewportHeight * scale;

    // Rotate the viewport rectangle
    ctx.save();
    ctx.translate(cameraX, cameraZ);
    ctx.rotate(-camera.rotation.y);

    // Draw viewport rectangle
    ctx.strokeStyle = 'yellow';
    ctx.strokeRect(-scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);

    // Draw direction indicator
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -scaledHeight / 2);
    ctx.stroke();

    ctx.restore();

    // Draw camera position
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(cameraX, cameraZ, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Initial update
  updateMiniMap();

  // Return the update function
  return updateMiniMap;
}
