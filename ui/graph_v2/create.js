// create

import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {} from "./move.js";
import { makeObjectWritable, convertToThreeJSFormat, getCurrentTimeOfDay, calculateDistance  } from "../../utils/utils";
import {labelListerners} from './move.js'
import { createSceneSnapshot, findSpheresInCube,findAllSpheres, findAllCubes} from "./snapshot.js";
import {sendSceneBoundingBoxToWorker} from '../../ai/umap.js'
import MouseOverlayCanvas from './MouseOverlayCanvas';

import { Frustum, Matrix4 } from 'three';
const frustum = new Frustum();
const projScreenMatrix = new Matrix4();

let mouseOverlay;
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
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);
// const scene = new THREE.Scene();
// const camera = new THREE.PerspectiveCamera(
//   40,
//   window.innerWidth / window.innerHeight,
//   1,
//   200
// );
const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  1,
  1000 // Increased Far Clipping Plane
);



camera.position.set(0, 0, 20);
camera.lookAt(0, 0, 0);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none'; // Allows mouse events to pass through
document.body.appendChild(labelRenderer.domElement);

// const controls = new OrbitControls(camera, renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement, labelRenderer.domElement);

controls.maxPolarAngle = Math.PI * 0.5;
controls.minDistance = 1;
// controls.maxDistance = 100;
controls.maxDistance = 500; // Increased Max Distance
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
let mousePositionManager;
// Cache for geometries and materials
// const geometryCache = {
//   sphere: null,
//   cube: null
// };

// const materialCache = {
//   sphere: {},
//   wireframe: {},
//   solid: {}
// };

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
function setLightingBasedOnTime(scene, nonBloomScene) {
  const timeOfDay = getCurrentTimeOfDay();

  // Remove existing lights from both scenes
  [scene, nonBloomScene].forEach((scn) => {
    scn.traverse((object) => {
      if (object.isLight) {
        scn.remove(object);
      }
    });
  });

  let ambientLight, directionalLight;

  if (timeOfDay === 'day') {
    // Daytime lights
    ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1).normalize();
  } else {
    // Nighttime lights
    ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    directionalLight = new THREE.DirectionalLight(0x8888ff, 0.2);
    directionalLight.position.set(1, 1, 1).normalize();
  }

  // Add lights to both scenes
  scene.add(ambientLight);
  scene.add(directionalLight);

  // Clone the lights for the nonBloomScene
  const ambientLightClone = ambientLight.clone();
  const directionalLightClone = directionalLight.clone();

  nonBloomScene.add(ambientLightClone);
  nonBloomScene.add(directionalLightClone);
}

function setBackgroundBasedOnTime(scene, nonBloomScene) {
  const timeOfDay = getCurrentTimeOfDay();
  let bgColor;

  if (timeOfDay === 'day') {
    bgColor = new THREE.Color(0x87CEEB); // Sky blue
  } else {
    bgColor = new THREE.Color(0x000000); // Black
  }

  scene.background = bgColor;
  nonBloomScene.background = bgColor;
  renderer.setClearColor(bgColor);
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

  wireframeCube.version = 0;
  solidCube.version = 0;
  resizeCubeToFitSpheres(wireframeCube);
  resizeCubeToFitSpheres(solidCube);

  nonBloomScene.add(wireframeCube);
  nonBloomScene.add(solidCube);

  console.log("CUBE CREATED! I have created wireframecube", wireframeCube, solidCube)
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

  sendSceneBoundingBoxToWorker()

  labelRenderer.setSize(width, height); // Add this line

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
  // const container = renderer.domElement.parentElement;
  // mouseOverlay = new MouseOverlayCanvas(container);
  loadCameraState();

  // setLightingBasedOnTime(scene, nonBloomScene);
  // setBackgroundBasedOnTime(scene, nonBloomScene);

  // createEnvironment();

  const container = renderer.domElement.parentElement;
  mouseOverlay = new MouseOverlayCanvas(container);

    // Add helpers
    addAxesHelper();
    // addGridHelper();

  // Ensure the Three.js canvas and overlay canvas have the same size
  function resizeCanvases() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
    mouseOverlay.resizeCanvas();
  }

  window.addEventListener('resize', resizeCanvases);
  resizeCanvases(); // Initial resize

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
// const sphereGeometry = new THREE.SphereGeometry(1, 16, 12); // Less detailed sphere
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
  // const composer = new EffectComposer(renderer);
  // const renderPass = new RenderPass(scene, camera);
  // Make entire object writable
  makeObjectWritable(sphere);

  sphere.version = 0;


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
 // Compute and store the bounding sphere
 sphere.geometry.computeBoundingSphere();
 sphere.boundingSphere = new THREE.Sphere().copy(sphere.geometry.boundingSphere);

 // Assume that the filename is stored in sphere.userData.filename
const filename = sphere.userData.filename || 'Unknown File';

 // Add label to the sphere
 const labelDiv = document.createElement('div');
 labelDiv.className = 'label';
 labelDiv.textContent = filename;
 labelDiv.style.color = 'white';
 labelDiv.style.fontFamily = 'sans-serif';
 labelDiv.style.fontSize = '16px';
 labelDiv.style.padding = '2px';
 labelDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
 labelDiv.style.pointerEvents = 'auto';
 labelListerners(labelDiv, sphere)
 const label = new CSS2DObject(labelDiv);

 // Position label to the right of the sphere
 const radius = sphere.geometry.boundingSphere.radius * sphere.scale.x;
 const padding = radius * 6; // Adjust this factor to fine-tune the distance
 label.position.set(radius + padding, 0, 0);
 
 sphere.add(label);
//  sphere.userData.label = label;


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


// kai render
export function render_cull() {
  // Increase the frustum size by scaling the projection matrix
  // const scaleFactor = 1.5; // Adjust this value as needed
  // const scaledProjectionMatrix = camera.projectionMatrix.clone().scale(new THREE.Vector3(1, 1, scaleFactor));
  // projScreenMatrix.multiplyMatrices(scaledProjectionMatrix, camera.matrixWorldInverse);
  // frustum.setFromProjectionMatrix(projScreenMatrix);

  projScreenMatrix.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreenMatrix);

  scene.traverse(object => {
    if (object.isMesh) {
      let isVisible;
      
      if (object.geometry && object.geometry.boundingSphere) {
        // Update the object's bounding sphere
        if (!object.boundingSphere) {
          object.boundingSphere = new THREE.Sphere();
        }
        object.boundingSphere.copy(object.geometry.boundingSphere).applyMatrix4(object.matrixWorld);
        
        // Add a small buffer to the bounding sphere radius
        const bufferFactor = 1.1; // Adjust this value as needed
        const bufferedRadius = object.boundingSphere.radius * bufferFactor;
        
        isVisible = frustum.intersectsSphere(new THREE.Sphere(object.boundingSphere.center, bufferedRadius));
      } else {
        // For large objects like cubes, use a more lenient culling method
        isVisible = frustum.intersectsObject(object) || 
                    object.position.distanceTo(camera.position) < (object.geometry.boundingSphere?.radius || 100);
      }
      
      object.visible = isVisible;

      if (isVisible && !object.layers.test(bloomLayer)) {
        darkenNonBloomed(object);
      }
    }
  });

  bloomComposer.render();
  scene.traverse(restoreMaterial);

  nonBloomScene.traverse(object => {
    if (object.isMesh) {
      if (object.geometry && object.geometry.boundingSphere) {
        // Update the object's bounding sphere
        if (!object.boundingSphere) {
          object.boundingSphere = new THREE.Sphere();
        }
        object.boundingSphere.copy(object.geometry.boundingSphere).applyMatrix4(object.matrixWorld);
        
        object.visible = frustum.intersectsSphere(object.boundingSphere);
      } else {
        // Fallback to using intersectsObject if boundingSphere is not available
        object.visible = frustum.intersectsObject(object);
      }
    }
  });

  renderer.setRenderTarget(nonBloomRT);
  renderer.clear();
  renderer.render(nonBloomScene, camera);
  labelRenderer.render(scene, camera);

  finalComposer.render();
}


// export function render() {
//   // Ensure all objects are visible
//   scene.traverse(object => {
//     if (object.isMesh) {
//       object.visible = true;
//       if (!object.layers.test(bloomLayer)) {
//         darkenNonBloomed(object);
//       }
//     }
//   });

//   // Render bloom scene
//   bloomComposer.render();
//   scene.traverse(restoreMaterial);

//   // Ensure all objects in nonBloomScene are visible
//   nonBloomScene.traverse(object => {
//     if (object.isMesh) {
//       object.visible = true;
//     }
//   });

//   // Render nonBloomScene
//   renderer.setRenderTarget(nonBloomRT);
//   renderer.clear();
//   renderer.render(nonBloomScene, camera);

//   labelRenderer.render(scene, camera);

//   // Final composite
//   finalComposer.render();
// }
// Kai new render
export function render() {
  // Update frustum
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

  // Cull objects
  scene.traverse(object => {
    if (object.isMesh) {
      object.visible = frustum.intersectsObject(object);
    }
  });

  // Render bloom scene
  bloomComposer.render();

  // Render non-bloom scene
  renderer.setRenderTarget(nonBloomRT);
  renderer.render(nonBloomScene, camera);

  // Final composite
  finalComposer.render();

  // Render labels
  labelRenderer.render(scene, camera);
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
  // color = Math.random() * 0xffffff
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
    sceneSnapshot: typeof sceneSnapshot !== "undefined" ? sceneSnapshot : null,
    mousePositionManager: mousePositionManager, // Add this line
    mouseOverlay: mouseOverlay,
    labelRenderer: labelRenderer,
  };
}

export function removeEmptyCubes(scene, nonBloomScene) {
  const snapshot = createSceneSnapshot([scene, nonBloomScene]);
  const cubesToRemove = [];
  const removedCubes = [];

  // Identify cubes to remove
  snapshot.boxes.forEach((box) => {
    const boxId = box.wireframe.userData.id;
    const containedSpheres = snapshot.containment[boxId];

    if (!containedSpheres || containedSpheres.length < 2) {
      cubesToRemove.push(box);
    }
  });


  // Remove the identified cubes
  cubesToRemove.forEach((box) => {
    const boxId = box.wireframe.userData.id;

    // // Remove wireframe
    // if (box.wireframe) {
    //   nonBloomScene.remove(box.wireframe);
    //   box.wireframe.geometry.dispose();
    //   box.wireframe.material.dispose();
    // }

    // // Remove solid
    // if (box.solid) {
    //   nonBloomScene.remove(box.solid);
    //   box.solid.geometry.dispose();
    //   box.solid.material.dispose();
    // }

    // Remove from the snapshot
    const boxIndex = snapshot.boxes.findIndex((b) => b.wireframe.userData.id === boxId);
    if (boxIndex !== -1) {
      snapshot.boxes.splice(boxIndex, 1);
    }
    delete snapshot.containment[boxId];

    removedCubes.push(box);
  });

  // Remove any cubes not present in the containment list
  snapshot.boxes.forEach((box) => {
    const boxId = box.wireframe.userData.id;
    if (!snapshot.containment.hasOwnProperty(boxId)) {
      removedCubes.push(box);
    }
  });

  nonBloomScene.updateMatrixWorld(true);
  markNeedsRender();

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



let sceneSnapshot = {};

function saveSceneSnapshot() {
  sceneSnapshot = {};

  // Function to capture simplified objects
  function captureObjects(sceneToCapture) {
    sceneToCapture.traverse((object) => {
      if (object.shape && object.isMesh && (object.shape === 'sphere' || object.shape.includes('Cube'))) {
        sceneSnapshot[object.uuid] = {
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone(),
          color: object.material?.color?.clone(),
          isDeleted: object.isDeleted || false,
          // Add other relevant properties if needed
        };
      }
    });
  }

  // Capture objects from both scenes
  captureObjects(scene);
  captureObjects(nonBloomScene);
}

export function reconstructScene(snapshot) {
  console.log("+++++ Reconstructing scene with snapshot:", snapshot);

  // Remove deleted objects from the scene
  snapshot.filter(objectState => objectState.isDeleted).forEach((objectState) => {
    const existingObject = scene.getObjectByProperty('uuid', objectState.uuid) || 
                             nonBloomScene.getObjectByProperty('uuid', objectState.uuid);
    if (existingObject) {
      removeObject(existingObject);
    }
  });
  
  // Create or update non-deleted objects
  snapshot.filter(objectState => !objectState.isDeleted).forEach((objectState) => {
    const existingObject = scene.getObjectByProperty('uuid', objectState.uuid) || 
                             nonBloomScene.getObjectByProperty('uuid', objectState.uuid);
    if (existingObject) {
      objectState.isUpdated && updateObjectProperties(existingObject, objectState);
    } else {
      createObject(objectState);
    }
  });
  markNeedsRender();
  saveSceneSnapshot() 
}


function updateObjectProperties(object, objectState) {
  objectState.isUpdated = false;

  if (objectState.position) object.position.fromArray(objectState.position);
  if (objectState.color !== undefined && object.material) {
    object.material.color.setHex(objectState.color);
  }
  if (objectState.version !== undefined) object.version = objectState.version;

}

function createObject(objectState) {
  if (objectState.shape === "sphere") {
    createSphereWrapper(objectState);
  } else if (objectState.shape === "wireframeCube") {
    createCubeWrapper(objectState);
  }
}

function removeObject(object) {
  if (!object) return;

  // Remove from main scene
  if (scene.getObjectByProperty('uuid', object.uuid)) {
    scene.remove(object);
  }

  // Remove from non-bloom scene
  if (nonBloomScene.getObjectByProperty('uuid', object.uuid)) {
    nonBloomScene.remove(object);
  }

  // If the object is a Line or LineSegments (for wireframe cubes)
  if (object.isLine || object.isLineSegments) {
    const solidCubeUuid = object.uuid + "-solid";
    const solidCube = nonBloomScene.getObjectByProperty('uuid', solidCubeUuid);
    if (solidCube) {
      nonBloomScene.remove(solidCube);
      if (solidCube.material) solidCube.material.dispose();
      if (solidCube.geometry) solidCube.geometry.dispose();
    }
  }

  // Dispose of materials and geometries
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach(material => material.dispose());
    } else {
      object.material.dispose();
    }
  }
  if (object.geometry) object.geometry.dispose();

  // Remove from the deletedObjects set if it's there
  deletedObjects.delete(object.uuid);

  // Force an update of the scene
  scene.updateMatrixWorld(true);
  nonBloomScene.updateMatrixWorld(true);

  // Mark for re-render
  markNeedsRender();
}

export function hideObject(object, scene, nonBloomScene) {
  // Function to recursively hide an object and its children
  function hideRecursively(obj) {
    obj.visible = false;
    if (obj.children) {
      obj.children.forEach(child => hideRecursively(child));
    }
  }

  // Hide the object
  hideRecursively(object);

  // Remove the object from the scenes, but keep a reference
  scene.remove(object);
  nonBloomScene.remove(object);

  // Store the original parent and scene information
  object.userData.originalParent = object.parent;
  object.userData.originalScene = scene;
  object.userData.originalNonBloomScene = nonBloomScene;

  // Force update of the scene graph
  scene.updateMatrixWorld(true);
  nonBloomScene.updateMatrixWorld(true);

  // Mark the scene for re-render
  markNeedsRender();
}

function createCubeWrapper(objectState) {
  if (objectState.shape === "wireframeCube") {
    const objData = convertToThreeJSFormat(objectState);
    createWireframeCube(objData);
  }
}

function createSphereWrapper(objectState) {
  const convertedData = convertToThreeJSFormat(objectState);
  const { _ } = createSphere(convertedData);
  // sphere.uuid = objectState.uuid;
}



// UMAP // ///////////////////////////


// // Function to calculate the scene's bounding box
// export function getSceneBoundingBox(scene) {
//   let minX = Infinity, minY = Infinity, minZ = Infinity;
//   let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

//   scene.traverse(function (object) {
//       if (object.isMesh) {
//           const boundingBox = new THREE.Box3().setFromObject(object);
//           minX = Math.min(minX, boundingBox.min.x);
//           minY = Math.min(minY, boundingBox.min.y);
//           minZ = Math.min(minZ, boundingBox.min.z);
//           maxX = Math.max(maxX, boundingBox.max.x);
//           maxY = Math.max(maxY, boundingBox.max.y);
//           maxZ = Math.max(maxZ, boundingBox.max.z);
//       }
//   });

//   // If scene is empty, use default bounds
//   if (minX === Infinity || maxX === -Infinity) {
//       const gridSize = 1000; // Replace with your actual grid size
//       minX = minY = minZ = -gridSize / 2;
//       maxX = maxY = maxZ = gridSize / 2;
//   }

//   return {
//       min: { x: minX, y: minY, z: minZ },
//       max: { x: maxX, y: maxY, z: maxZ }
//   };
// }
// // Define minimum and maximum scale factors
// const MIN_SCALE = 1; // Minimum scale to prevent spheres from becoming too small
// const MAX_SCALE = 5; // Maximum scale for distant spheres

// // Define minimum and maximum distances for scaling
// const MIN_DISTANCE = 20; // Distance below which scaling starts
// const MAX_DISTANCE = 800; // Distance beyond which scaling stops increasing

// // Function to map distance to scale factor
// // Function to map distance to scale factor
// function getScaleFactor(distance) {
//   // Clamp distance within min and max bounds
//   distance = THREE.MathUtils.clamp(distance, MIN_DISTANCE, MAX_DISTANCE);
  
//   // Linearly map distance to scale factor
//   const scale = ((distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) * (MAX_SCALE - MIN_SCALE) + MIN_SCALE;
  
//   return scale;
// }
// // export function updateSphereAndCubePositions(reducedData, labels) {
// //   const { scene, nonBloomScene } = share3dDat();

// //   // Create a mapping from fileId (label) to coordinates
// //   const idToCoordinates = {};
// //   for (let i = 0; i < labels.length; i++) {
// //       const fileId = labels[i];
// //       const coords = reducedData[i];
// //       idToCoordinates[fileId] = coords;
// //   }

// //   console.log("idToCoordinates", idToCoordinates);

// //   // Find all spheres
// //   const spheres = findAllSpheres([scene, nonBloomScene]);

// //   // Update sphere positions using userData.id (fileId)
// //   spheres.forEach(sphere => {
// //       const fileId = sphere.userData.id; // Get the fileId from userData.id
// //       console.log("Update sphere positions using userData", fileId);
// //       // Find the corresponding coordinates
// //       const coords = idToCoordinates[fileId];
// //       if (coords) {
// //           sphere.position.set(coords[0], coords[1], coords[2]);
// //           console.log(`Sphere ${fileId} position set to:`, sphere.position);
// //       } else {
// //           console.warn(`No coordinates found for sphere with fileId: ${fileId}`);
// //       }
// //   });

// //   // Find all cubes
// //   const cubes = findAllCubes([scene, nonBloomScene]);

// //   // Update cube positions and sizes to fit the spheres
// //   cubes.forEach(cube => {
// //       resizeCubeToFitSpheres(cube);
// //   });

// //   // Adjust camera to fit the updated scene
// //   adjustCameraToFitScene();

// //   // Log the scene's bounding box
// //   const sceneBoundingBox = getSceneBoundingBox(scene);
// //   console.log("Scene Bounding Box:", sceneBoundingBox);

// //   // Visualize the bounding box
// //   visualizeBoundingBox(sceneBoundingBox);

// //   // Log each sphere's position
// //   spheres.forEach(sphere => {
// //       const pos = sphere.position;
// //       console.log(`Sphere ${sphere.userData.id} is at position: (${pos.x}, ${pos.y}, ${pos.z})`);
// //   });

// //   // Mark the scene to re-render
// //   markNeedsRender();
// // }

// export function updateSphereAndCubePositions(reducedData, labels) {
//   const { scene, nonBloomScene, camera, controls } = share3dDat();

//   // Get the scene's bounding box
//   const sceneBoundingBox = getSceneBoundingBox(scene);

//   // Normalize and scale the UMAP coordinates
//   const scaledCoordinates = normalizeAndScaleCoordinates(reducedData, sceneBoundingBox);

//   // Create a mapping from fileId (label) to scaled coordinates
//   const idToCoordinates = {};
//   for (let i = 0; i < labels.length; i++) {
//     const fileId = labels[i];
//     const coords = scaledCoordinates[i];
//     idToCoordinates[fileId] = coords;
//   }

//   console.log("idToCoordinates", idToCoordinates);

//   // Find all spheres
//   const spheres = findAllSpheres([scene, nonBloomScene]);

//   // Update sphere positions and scales using userData.id (fileId)
//   spheres.forEach(sphere => {
//     const fileId = sphere.userData.id;
//     const coords = idToCoordinates[fileId];
//     if (coords) {
//       // Create a movement line (optional)
//       const startPosition = sphere.position.clone();
//       const endPosition = new THREE.Vector3(coords[0], coords[1], coords[2]);
//       createMovementLine(startPosition, endPosition);

//       // Create a ghost trail at the current position
//       // createGhostTrail(sphere);

//       // Animate position using GSAP
//       gsap.to(sphere.position, {
//         duration: 1.5,
//         x: coords[0],
//         y: coords[1],
//         z: coords[2],
//         ease: "power2.out",
//         onUpdate: () => markNeedsRender(),
//         onComplete: () => console.log(`Sphere ${fileId} moved to (${coords[0]}, ${coords[1]}, ${coords[2]})`)
//       });

//       // Calculate distance and scale factor
//       const newPosition = new THREE.Vector3(coords[0], coords[1], coords[2]);
//       const distance = calculateDistance(newPosition, camera.position);
//       const scaleFactor = getScaleFactor(distance);
//       console.log(`Sphere ${fileId} - Distance: ${distance.toFixed(2)}, Scale: ${scaleFactor.toFixed(2)}`);

//       // Animate scale with capping
//       if (scaleFactor < MIN_SCALE) {
//         gsap.to(sphere.scale, {
//           duration: 1.5,
//           x: MIN_SCALE,
//           y: MIN_SCALE,
//           z: MIN_SCALE,
//           ease: "power2.out",
//           onUpdate: () => markNeedsRender(),
//           onComplete: () => console.log(`Sphere ${fileId} scaled to minimum scale ${MIN_SCALE}`)
//         });
//       } else {
//         gsap.to(sphere.scale, {
//           duration: 1.5,
//           x: scaleFactor,
//           y: scaleFactor,
//           z: scaleFactor,
//           ease: "power2.out",
//           onUpdate: () => markNeedsRender(),
//           onComplete: () => console.log(`Sphere ${fileId} scaled to ${scaleFactor}`)
//         });
//       }
//     } else {
//       console.warn(`No coordinates found for sphere with fileId: ${fileId}`);
//     }
//   });

//   // Update cube positions and sizes to fit the spheres
//   const cubes = findAllCubes([scene, nonBloomScene]);
//   cubes.forEach(cube => {
//     resizeCubeToFitSpheres(cube);
//   });

//   // Adjust camera to fit the updated scene with animation
//   adjustCameraToFitSceneAnimated();

//   // Visualize the bounding box
//   // visualizeBoundingBox(sceneBoundingBox);

//   // Log each sphere's position
//   spheres.forEach(sphere => {
//     const pos = sphere.position;
//     console.log(`Sphere ${sphere.userData.id} is at position: (${pos.x}, ${pos.y}, ${pos.z})`);
//   });

//   // Ensure the scene is re-rendered
//   markNeedsRender();
// }



// // // Main function to update positions and scales
// // export function updateSphereAndCubePositions(reducedData, labels) {
// //   const { scene, nonBloomScene, camera, controls } = share3dDat();

// //   // Create a mapping from fileId (label) to coordinates
// //   const idToCoordinates = {};
// //   for (let i = 0; i < labels.length; i++) {
// //     const fileId = labels[i];
// //     const coords = reducedData[i];
// //     idToCoordinates[fileId] = coords;
// //   }

// //   console.log("idToCoordinates", idToCoordinates);

// //   // Find all spheres
// //   const spheres = findAllSpheres([scene, nonBloomScene]);

// //   // Update sphere positions and scales using userData.id (fileId)
// //   spheres.forEach(sphere => {
// //     const fileId = sphere.userData.id;
// //     const coords = idToCoordinates[fileId];
// //     if (coords) {
// //       // Create a movement line (optional)
// //       const startPosition = sphere.position.clone();
// //       const endPosition = new THREE.Vector3(coords[0], coords[1], coords[2]);
// //       createMovementLine(startPosition, endPosition);

// //       // Create a ghost trail at the current position
// //       createGhostTrail(sphere);

// //       // Animate position using GSAP
// //       gsap.to(sphere.position, {
// //         duration: 1.5,
// //         x: coords[0],
// //         y: coords[1],
// //         z: coords[2],
// //         ease: "power2.out",
// //         onUpdate: () => markNeedsRender(),
// //         onComplete: () => console.log(`Sphere ${fileId} moved to (${coords[0]}, ${coords[1]}, ${coords[2]})`)
// //       });

// //       // Calculate distance and scale factor
// //       const newPosition = new THREE.Vector3(coords[0], coords[1], coords[2]);
// //       const distance = calculateDistance(newPosition, camera.position);
// //       const scaleFactor = getScaleFactor(distance);
// //       console.log(`Sphere ${fileId} - Distance: ${distance.toFixed(2)}, Scale: ${scaleFactor.toFixed(2)}`);

// //       // Animate scale with capping
// //       if (scaleFactor < MIN_SCALE) {
// //         gsap.to(sphere.scale, {
// //           duration: 1.5,
// //           x: MIN_SCALE,
// //           y: MIN_SCALE,
// //           z: MIN_SCALE,
// //           ease: "power2.out",
// //           onUpdate: () => markNeedsRender(),
// //           onComplete: () => console.log(`Sphere ${fileId} scaled to minimum scale ${MIN_SCALE}`)
// //         });
// //       } else {
// //         gsap.to(sphere.scale, {
// //           duration: 1.5,
// //           x: scaleFactor,
// //           y: scaleFactor,
// //           z: scaleFactor,
// //           ease: "power2.out",
// //           onUpdate: () => markNeedsRender(),
// //           onComplete: () => console.log(`Sphere ${fileId} scaled to ${scaleFactor}`)
// //         });
// //       }
// //     } else {
// //       console.warn(`No coordinates found for sphere with fileId: ${fileId}`);
// //     }
// //   });

// //   // Find all cubes
// //   const cubes = findAllCubes([scene, nonBloomScene]);

// //   // Update cube positions and sizes to fit the spheres
// //   cubes.forEach(cube => {
// //     resizeCubeToFitSpheres(cube);
// //   });

// //   // Adjust camera to fit the updated scene with animation
// //   adjustCameraToFitSceneAnimated();

// //   // Log the scene's bounding box
// //   const sceneBoundingBox = getSceneBoundingBox(scene);
// //   console.log("Scene Bounding Box:", sceneBoundingBox);

// //   // Visualize the bounding box
// //   visualizeBoundingBox(sceneBoundingBox);

// //   // Log each sphere's position
// //   spheres.forEach(sphere => {
// //     const pos = sphere.position;
// //     console.log(`Sphere ${sphere.userData.id} is at position: (${pos.x}, ${pos.y}, ${pos.z})`);
// //   });

// //   // Ensure the scene is re-rendered
// //   markNeedsRender();
// // }

// // Function to create a ghost trail for a sphere
// function createGhostTrail(sphere) {
//   // Clone the sphere's geometry and material
//   const ghostMaterial = new THREE.MeshBasicMaterial({
//     color: sphere.material.color,
//     transparent: true,
//     opacity: 0.5, // Semi-transparent
//     depthWrite: false
//   });
//   const ghostSphere = new THREE.Mesh(sphere.geometry.clone(), ghostMaterial);
  
//   // Set the ghost's position and scale to match the original sphere
//   ghostSphere.position.copy(sphere.position);
//   ghostSphere.scale.copy(sphere.scale);
  
//   // Add the ghost to the scene
//   scene.add(ghostSphere);
  
//   // Animate the ghost's opacity to fade out
//   gsap.to(ghostSphere.material, {
//     duration: 20,
//     opacity: 0,
//     ease: "power2.out",
//     onComplete: () => {
//       scene.remove(ghostSphere);
//       ghostSphere.geometry.dispose();
//       ghostSphere.material.dispose();
//     }
//   });
// }


// // Function to create a movement line for a sphere
// function createMovementLine(startPosition, endPosition) {
//   const material = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
//   const points = [];
//   points.push(startPosition.clone());
//   points.push(endPosition.clone());
//   const geometry = new THREE.BufferGeometry().setFromPoints(points);
//   const line = new THREE.Line(geometry, material);
  
//   scene.add(line);
  
//   // Animate the line's opacity to fade out
//   gsap.to(line.material, {
//     duration: 20,
//     opacity: 0,
//     ease: "power2.out",
//     onComplete: () => {
//       scene.remove(line);
//       geometry.dispose();
//       material.dispose();
//     }
//   });
// }



// function addAxesHelper() {
//   const axesHelper = new THREE.AxesHelper(50); // Adjust size as needed
//   axesHelper.name = 'AxesHelper';
//   scene.add(axesHelper);
//   console.log("Axes Helper added to the scene.");
// }
function addAxesHelper() {
  const axesHelper = new THREE.AxesHelper(50); // Adjust size as needed
  
  // Update vertex colors for each axis: 6 vertices (2 per axis)
  const colors = axesHelper.geometry.attributes.color;
  
  // X-axis (red by default)
  colors.setXYZ(0, 0.5, 0.5, 0.5); // First vertex
  colors.setXYZ(1, 0.5, 0.5, 0.5); // Second vertex
  
  // Y-axis (green by default)
  colors.setXYZ(2, 0.5, 0.5, 0.5); // First vertex
  colors.setXYZ(3, 0.5, 0.5, 0.5); // Second vertex
  
  // Z-axis (blue by default)
  colors.setXYZ(4, 0.5, 0.5, 0.5); // First vertex
  colors.setXYZ(5, 0.5, 0.5, 0.5); // Second vertex
  
  colors.needsUpdate = true; // Ensure the colors are updated in the rendering
  
  axesHelper.name = 'AxesHelper';
  scene.add(axesHelper);
  console.log("Stylish Axes Helper with faint colors added to the scene.");
}




// function visualizeBoundingBox(boundingBox) {
//   // Remove any existing bounding box helper
//   const existingHelper = scene.getObjectByName('BoundingBoxHelper');
//   if (existingHelper) {
//       scene.remove(existingHelper);
//   }

//   // Create a Box3Helper to visualize the bounding box
//   const box = new THREE.Box3(
//       new THREE.Vector3(boundingBox.min.x, boundingBox.min.y, boundingBox.min.z),
//       new THREE.Vector3(boundingBox.max.x, boundingBox.max.y, boundingBox.max.z)
//   );
//   const boxHelper = new THREE.Box3Helper(box, 0xff0000); // Red color
//   boxHelper.name = 'BoundingBoxHelper';
//   scene.add(boxHelper);

//   // Optionally, add axes to the bounding box center
//   const axesHelper = new THREE.AxesHelper(10);
//   axesHelper.position.copy(box.getCenter(new THREE.Vector3()));
//   axesHelper.name = 'BoundingBoxAxesHelper';
//   scene.add(axesHelper);

//   console.log("Bounding Box Helper added to the scene.");
// }

// function adjustCameraToFitScene() {
//   const { scene, nonBloomScene } = share3dDat();

//   // Combine all spheres from both scenes
//   const spheres = findAllSpheres([scene, nonBloomScene]);

//   if (spheres.length === 0) {
//     console.warn('No spheres found to adjust the camera.');
//     return;
//   }

//   // Create a new Box3 to encompass all spheres
//   const boundingBox = new THREE.Box3();

//   spheres.forEach(sphere => {
//     const sphereBox = new THREE.Box3().setFromObject(sphere);
//     boundingBox.expandByPoint(sphereBox.min);
//     boundingBox.expandByPoint(sphereBox.max);
//   });

//   // Compute the center and size of the bounding box
//   const center = boundingBox.getCenter(new THREE.Vector3());
//   const size = boundingBox.getSize(new THREE.Vector3());

//   // Compute the maximum dimension (x, y, or z)
//   const maxDim = Math.max(size.x, size.y, size.z);

//   // Compute an appropriate distance for the camera
//   const fov = camera.fov * (Math.PI / 180);
//   let cameraDistance = maxDim / (2 * Math.tan(fov / 2));

//   // Add some extra space
//   cameraDistance *= 1.2; // Adjust as needed

//   // Determine the new camera position
//   const newCameraPosition = new THREE.Vector3(
//     center.x,
//     center.y,
//     center.z + cameraDistance
//   );

//   // Determine the new controls target
//   const newControlsTarget = center.clone();

//   // Animate the camera position
//   gsap.to(camera.position, {
//     duration: 1.5, // Duration in seconds
//     x: newCameraPosition.x,
//     y: newCameraPosition.y,
//     z: newCameraPosition.z,
//     ease: "power2.out",
//     onUpdate: () => {
//       camera.lookAt(newControlsTarget);
//       markNeedsRender(); // Ensure the scene re-renders during animation
//     },
//     onComplete: () => {
//       console.log("Camera has adjusted to fit the scene.");
//     }
//   });

//   // Animate the controls target
//   gsap.to(controls.target, {
//     duration: 1.5, // Duration in seconds
//     x: newControlsTarget.x,
//     y: newControlsTarget.y,
//     z: newControlsTarget.z,
//     ease: "power2.out",
//     onUpdate: () => {
//       controls.update();
//       markNeedsRender(); // Ensure the scene re-renders during animation
//     },
//     onComplete: () => {
//       console.log("OrbitControls target has been updated.");
//     }
//   });

//   // Adjust camera's near and far planes based on camera distance
//   // Animate near and far planes
//   gsap.to(camera, {
//     duration: 1.5,
//     near: cameraDistance / 100,
//     far: cameraDistance * 10,
//     ease: "power2.out",
//     onUpdate: () => {
//       camera.updateProjectionMatrix();
//     },
//     onComplete: () => {
//       console.log(`Camera near: ${camera.near}, Camera far: ${camera.far}`);
//     }
//   });

//   console.log("Camera Adjusted:");
//   console.log(`Target Position: (${center.x}, ${center.y}, ${center.z})`);
// }

// function adjustCameraToFitSceneAnimated() {
//   const { scene, nonBloomScene, camera, controls } = share3dDat();

//   // Combine all spheres from both scenes
//   const spheres = findAllSpheres([scene, nonBloomScene]);

//   if (spheres.length === 0) {
//     console.warn('No spheres found to adjust the camera.');
//     return;
//   }

//   // Create a bounding box that encompasses all spheres
//   const boundingBox = new THREE.Box3();
//   spheres.forEach(sphere => {
//     boundingBox.expandByObject(sphere);
//   });

//   // Get the center and size of the bounding box
//   const center = boundingBox.getCenter(new THREE.Vector3());
//   const size = boundingBox.getSize(new THREE.Vector3());

//   // Get camera parameters
//   const fov = THREE.MathUtils.degToRad(camera.fov);
//   const aspect = camera.aspect;

//   // Calculate the distance the camera needs to be to fit the bounding box
//   const distanceX = (size.x / 2) / Math.tan(fov / 2) / aspect;
//   const distanceY = (size.y / 2) / Math.tan(fov / 2);
//   const distance = Math.max(distanceX, distanceY);

//   // Add some extra space
//   const cameraDistance = distance * 1.2; // Adjust multiplier as needed

//   // Compute new camera position
//   const direction = new THREE.Vector3(0, 0, 1); // Assuming camera looks along the -Z axis
//   const newCameraPosition = center.clone().add(direction.multiplyScalar(cameraDistance));

//   // Update camera position and target with animation
//   gsap.to(camera.position, {
//     duration: 1.5,
//     x: newCameraPosition.x,
//     y: newCameraPosition.y,
//     z: newCameraPosition.z,
//     ease: "power2.out",
//     onUpdate: () => {
//       camera.lookAt(center);
//       markNeedsRender();
//     },
//     onComplete: () => {
//       console.log("Camera has adjusted to fit the scene.");
//     }
//   });

//   // Update controls target
//   gsap.to(controls.target, {
//     duration: 1.5,
//     x: center.x,
//     y: center.y,
//     z: center.z,
//     ease: "power2.out",
//     onUpdate: () => {
//       controls.update();
//       markNeedsRender();
//     },
//     onComplete: () => {
//       console.log("Controls target updated.");
//     }
//   });

//   // Adjust camera's near and far planes
//   camera.near = cameraDistance / 100;
//   camera.far = cameraDistance * 100;
//   camera.updateProjectionMatrix();

//   console.log(`Adjusted camera position: (${newCameraPosition.x}, ${newCameraPosition.y}, ${newCameraPosition.z})`);
// }



// function adjustCameraToFitScene() {
//   const { scene, nonBloomScene } = share3dDat();

//   // Combine all spheres from both scenes
//   const spheres = findAllSpheres([scene, nonBloomScene]);

//   if (spheres.length === 0) {
//     console.warn('No spheres found to adjust the camera.');
//     return;
//   }

//   // Create a new Box3 to encompass all spheres
//   const boundingBox = new THREE.Box3();

//   spheres.forEach(sphere => {
//     const sphereBox = new THREE.Box3().setFromObject(sphere);
//     boundingBox.expandByPoint(sphereBox.min);
//     boundingBox.expandByPoint(sphereBox.max);
//   });

//   // Compute the center and size of the bounding box
//   const center = boundingBox.getCenter(new THREE.Vector3());
//   const size = boundingBox.getSize(new THREE.Vector3());

//   // Compute the maximum dimension (x, y, or z)
//   const maxDim = Math.max(size.x, size.y, size.z);

//   // Compute an appropriate distance for the camera
//   const fov = camera.fov * (Math.PI / 180);
//   let cameraDistance = maxDim / (2 * Math.tan(fov / 2));

//   // Add some extra space
//   cameraDistance *= 1.2; // Adjust as needed

//   // Update camera position and target
//   camera.position.set(center.x, center.y, center.z + cameraDistance);
//   camera.lookAt(center);
//   controls.target.copy(center);
//   controls.update();

//   // Adjust camera's near and far planes if necessary
//   camera.near = cameraDistance / 100;
//   camera.far = cameraDistance * 10;
//   camera.updateProjectionMatrix();
// }


////////////////////////////////////////////////

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
  
    const centerX = mapSize / 2;
    const centerY = mapSize * 0.8; // Position camera dot near the bottom
  
    // Calculate bounds of all objects
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    function updateBounds(sceneToCheck) {
      sceneToCheck.traverse((object) => {
        if (object.isMesh) {
          minX = Math.min(minX, object.position.x);
          maxX = Math.max(maxX, object.position.x);
          minZ = Math.min(minZ, object.position.z);
          maxZ = Math.max(maxZ, object.position.z);
        }
      });
    }
    updateBounds(scene);
    updateBounds(nonBloomScene);
  
    // Add padding
    const padding = 50;
    minX -= padding;
    maxX += padding;
    minZ -= padding;
    maxZ += padding;
  
    // Ensure the view area is square
    const range = Math.max(maxX - minX, maxZ - minZ);
    
    // Calculate scale factor to fit all objects
    const scaleFactor = (mapSize * 0.6) / range; // 60% of map size to leave margin
  
    // Function to convert world coordinates to mini-map coordinates
    function worldToMap(x, z) {
      return {
        x: centerX + (x - camera.position.x) * scaleFactor,
        y: centerY - (z - camera.position.z) * scaleFactor
      };
    }
  
    // Function to draw objects from a scene
    function drawSceneObjects(sceneToRender) {
      sceneToRender.traverse((object) => {
        if (object.isMesh) {
          const { x, y } = worldToMap(object.position.x, object.position.z);
  
          let color;
          if (object.geometry.type === "IcosahedronGeometry") {
            color = 'red';
          } else if (object.geometry.type === "BoxGeometry") {
            color = object.material.color.getStyle();
          } else {
            return;
          }
  
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  
    // Draw objects from both scenes
    drawSceneObjects(scene);
    drawSceneObjects(nonBloomScene);
  
    // Calculate camera's visible range based on zoom
    const visibleRange = 100 / camera.zoom; // Adjust this factor as needed
    const cameraY = centerY + (visibleRange / 2) * scaleFactor;
  
    // Draw camera position
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(centerX, cameraY, 5, 0, Math.PI * 2);
    ctx.fill();
  
    // Calculate view frustum
    const fov = camera.fov * Math.PI / 180;
    const aspect = camera.aspect;
    const nearDistance = 10 * scaleFactor;
    const farDistance = visibleRange * scaleFactor;
  
    // Draw viewpoint cone
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
    ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
    ctx.beginPath();
    ctx.moveTo(centerX, cameraY);
    ctx.lineTo(centerX + Math.tan(fov / 2) * aspect * nearDistance, cameraY - nearDistance);
    ctx.lineTo(centerX + Math.tan(fov / 2) * aspect * farDistance, cameraY - farDistance);
    ctx.lineTo(centerX - Math.tan(fov / 2) * aspect * farDistance, cameraY - farDistance);
    ctx.lineTo(centerX - Math.tan(fov / 2) * aspect * nearDistance, cameraY - nearDistance);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  
    // Draw compass
    const compassRadius = 15;
    const compassX = mapSize - compassRadius - 5;
    const compassY = compassRadius + 5;
  
    ctx.save();
    ctx.translate(compassX, compassY);
    ctx.rotate(-camera.rotation.y);
  
    ctx.strokeStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(0, -compassRadius);
    ctx.lineTo(0, compassRadius);
    ctx.moveTo(0, -compassRadius);
    ctx.lineTo(-compassRadius / 2, 0);
    ctx.moveTo(0, -compassRadius);
    ctx.lineTo(compassRadius / 2, 0);
    ctx.stroke();
  
    ctx.restore();
  }

// Initial update
updateMiniMap();

// Return the update function
return updateMiniMap;
}


const deletedObjects = new Set();

export function markObjectAsDeleted(uuid) {
  deletedObjects.add(uuid);
}

export function isObjectDeleted(uuid) {
  return deletedObjects.has(uuid);
}

export function cleanupDeletedObjects() {
  // This function should be called periodically to remove old entries
  // For now, we'll keep all entries, but you might want to implement a cleanup strategy later
}