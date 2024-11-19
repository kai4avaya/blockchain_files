// create.js

import * as THREE from "three";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/addons/renderers/CSS2DRenderer.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {} from "./move.js";
import {
  makeObjectWritable,
  convertToThreeJSFormat,
  getCurrentTimeOfDay,
  throttle,
} from "../../utils/utils";
import { labelListerners } from "./move.js";
import {
  createSceneSnapshot,
  findSpheresInCube,
  logSceneContents,
} from "./snapshot.js";
import {
  isUMAPWorkerActive,
  sendSceneBoundingBoxToWorker,
} from "../../ai/umap.js";
import MouseOverlayCanvas from "./MouseOverlayCanvas";
import { Frustum, Matrix4 } from "three";
import indexDBOverlay from '../../memory/local/file_worker';

const frustum = new Frustum();
const projScreenMatrix = new Matrix4();

let mouseOverlay;
export const ENTIRE_SCENE = 0;
export const BLOOM_SCENE = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);
const SCALEFACTOR = 0.05;

export const scene = new THREE.Scene();
export const nonBloomScene = new THREE.Scene();

const params = {
  threshold: 0.01,
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
// const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
// const renderer = new THREE.WebGLRenderer({
//   antialias: false,
//   powerPreference: "high-performance",
//   failIfMajorPerformanceCaveat: false,
//   preserveDrawingBuffer: true,
// });

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance",
  failIfMajorPerformanceCaveat: false,
  preserveDrawingBuffer: true,
  alpha: true, // Add this line
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.domElement.addEventListener(
  "webglcontextlost",
  (event) => {
    event.preventDefault();
    setTimeout(() => {
      renderer.forceContextRestore();
    }, 1000);
  },
  false
);
document.body.appendChild(renderer.domElement);

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
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0px";
labelRenderer.domElement.style.pointerEvents = "none"; // Allows mouse events to pass through
document.body.appendChild(labelRenderer.domElement);

// const controls = new OrbitControls(camera, renderer.domElement);
const controls = new OrbitControls(
  camera,
  renderer.domElement,
  labelRenderer.domElement
);

controls.maxPolarAngle = Math.PI * 0.5;
// controls.minDistance = 1;
controls.minDistance = 0.1;

// controls.maxDistance = 100;
controls.maxDistance = 1000; // Increased Max Distance
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
const labelMap = new Map(); 

const materialCache = new Map();
const geometryCache = new Map();

function getCachedMaterial(type, params) {
  const key = `${type}-${JSON.stringify(params)}`;
  if (!materialCache.has(key)) {
    let material;
    switch (type) {
      case "basic":
        material = new THREE.MeshBasicMaterial(params);
        break;
      case "line":
        material = new THREE.LineBasicMaterial(params);
        break;
    }
    materialCache.set(key, material);
  }
  return materialCache.get(key);
}

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
  const gridHelper = new THREE.GridHelper(
    gridSize,
    gridDivisions,
    0x444444,
    0x444444
  );
  scene.add(gridHelper);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Add directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(1, 1, 1).normalize();
  scene.add(directionalLight);
}
// function setLightingBasedOnTime(scene, nonBloomScene) {
//   const timeOfDay = getCurrentTimeOfDay();

//   // Remove existing lights from both scenes
//   [scene, nonBloomScene].forEach((scn) => {
//     scn.traverse((object) => {
//       if (object.isLight) {
//         scn.remove(object);
//       }
//     });
//   });

//   let ambientLight, directionalLight;

//   if (timeOfDay === 'day') {
//     // Daytime lights
//     ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
//     directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
//     directionalLight.position.set(1, 1, 1).normalize();
//   } else {
//     // Nighttime lights
//     ambientLight = new THREE.AmbientLight(0x404040, 0.3);
//     directionalLight = new THREE.DirectionalLight(0x8888ff, 0.2);
//     directionalLight.position.set(1, 1, 1).normalize();
//   }

//   // Add lights to both scenes
//   scene.add(ambientLight);
//   scene.add(directionalLight);

//   // Clone the lights for the nonBloomScene
//   const ambientLightClone = ambientLight.clone();
//   const directionalLightClone = directionalLight.clone();

//   nonBloomScene.add(ambientLightClone);
//   nonBloomScene.add(directionalLightClone);
// }

// function setBackgroundBasedOnTime(scene, nonBloomScene) {
//   const timeOfDay = getCurrentTimeOfDay();
//   let bgColor;

//   if (timeOfDay === 'day') {
//     bgColor = new THREE.Color(0x87CEEB); // Sky blue
//   } else {
//     scene.background = new THREE.Color(0x0A0A0A); // Black
//   }

//   scene.background = bgColor;
//   nonBloomScene.background = bgColor;
//   renderer.setClearColor(bgColor);
// }

// function setBackgroundBasedOnTime(scene, nonBloomScene) {
//   const timeOfDay = getCurrentTimeOfDay();
//   let bgColor;

//   if (timeOfDay === 'day') {
//     // Soft daylight gradient
//     renderer.setClearColor(0x87CEEB, 1); // Sky blue
//   } else {
//     // Night gradient - deep dark blue that works well with bloom
//     renderer.setClearColor(0x0A0A14, 1); // Deep night blue
//   }

//   // Set same background for both scenes to maintain consistency
//   scene.background = new THREE.Color(renderer.getClearColor());
//   nonBloomScene.background = new THREE.Color(renderer.getClearColor());
// }

function loadTerrain(file, callback) {
  const xhr = new XMLHttpRequest();
  xhr.responseType = "arraybuffer";
  xhr.open("GET", file, true);
  xhr.onload = function (evt) {
    if (xhr.response) {
      callback(new Uint16Array(xhr.response));
    }
  };
  xhr.send(null);
}

function createEnvironmentTerrain() {
  // Set the background to black
  scene.background = new THREE.Color(0x000000);

  loadTerrain("../../assets/besseggen.bin", function (data) {
    const width = 199;
    const height = 199;
    const geometry = new THREE.PlaneGeometry(60, 60, width - 1, height - 1);

    for (let i = 0, l = geometry.attributes.position.count; i < l; i++) {
      geometry.attributes.position.setZ(i, (data[i] / 65535) * 10);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
      color: 0xdddddd,
      wireframe: true,
    });

    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2; // Rotate to lay flat
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

export function resizeCubeToFitSpheres(
  cube,
  minSizeAllowed = false,
  buffer = 5
) {
  // Instead of using cubeGroups, we'll find spheres within the cube
  const spheres = findSpheresInCube(cube);
  if (spheres.length === 0) return;

  // Calculate the bounding box that fits all spheres
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

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
  const finalCubeSize = minSizeAllowed
    ? newCubeSize
    : Math.max(newCubeSize, currentCubeSize);

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
  wireMaterial = new THREE.LineBasicMaterial({
    color: convertedData.color,
    linewidth: 2,
  });
  solidMaterial = new THREE.MeshBasicMaterial({
    color: convertedData.color,
    transparent: true,
    opacity: 0,
  });

  // Create wireframe and solid cubes using the global geometry and updated materials
  const wireframeCube = new THREE.LineSegments(edges, wireMaterial);
  const solidCube = new THREE.Mesh(geometry, solidMaterial);

  // Make entire object writable
  makeObjectWritable(wireframeCube);
  makeObjectWritable(solidCube);

  // Set position and scale
  [wireframeCube, solidCube].forEach((cube) => {
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

  console.log(
    "CUBE CREATED! I have created wireframecube",
    wireframeCube,
    solidCube
  );
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

  // Only send bounding box if UMAP worker is active
  if (isUMAPWorkerActive()) {
    sendSceneBoundingBoxToWorker();
  }

  labelRenderer.setSize(width, height);
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


function setupScene() {
  scene.traverse(disposeMaterial);
  scene.children.length = 0;
  nonBloomScene.traverse(disposeMaterial);
  nonBloomScene.children.length = 0;

  // Get the canvas container
  const canvasContainer = document.getElementById("canvas-container");
  if (!canvasContainer) {
    console.error("Canvas container not found");
    return;
  }

  // Move the renderer's canvas to the container if it's not already there
  const canvas = renderer.domElement;
  if (canvas.parentElement !== canvasContainer) {
    canvasContainer.appendChild(canvas);
  }

  // Initialize mouse overlay with the canvas container
  mouseOverlay = new MouseOverlayCanvas(canvasContainer);

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

  window.addEventListener("resize", resizeCanvases);
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


// export function clearExistingLabels() {
//   labelMap.forEach((label) => {
//     if (label && label.parentNode) {
//       label.parentNode.removeChild(label);
//     }
//   });
//   labelMap.clear();
// }



function removeExistingLabel(filename) {
  if (labelMap.has(filename)) {
    const existingLabel = labelMap.get(filename);
    if (existingLabel && existingLabel.element && existingLabel.parent) {
      existingLabel.parent.remove(existingLabel);
    }
    labelMap.delete(filename); // Remove it from the map
  }
}


export function createSphere(convertedData) {
  const color =
    convertedData.color ||
    new THREE.Color().setHSL(Math.random(), 0.7, Math.random() * 0.2 + 0.05);

  const material = getCachedMaterial("basic", { color });
  const sphere = new THREE.Mesh(sphereGeometry, material);




  // Create sphere using the global geometry and updated material
  // const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
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
  sphere.boundingSphere = new THREE.Sphere().copy(
    sphere.geometry.boundingSphere
  );

  // Assume that the filename is stored in sphere.userData.filename
  const filename = sphere.userData.filename || "Unknown File";

    // Remove any existing label with the same filename
  removeExistingLabel(filename);

  const labelDiv = document.createElement("div");
  labelDiv.className = "label";
  labelDiv.textContent = filename;
  labelDiv.style.color = "#4169E1"; // Royal blue
  labelDiv.style.fontFamily = "monospace";
  labelDiv.style.fontSize = "16px";
  labelDiv.style.padding = "2px";
  // Remove the backgroundColor style to make it fully transparent
  labelDiv.style.pointerEvents = "auto";
  labelListerners(labelDiv, sphere);
  const label = new CSS2DObject(labelDiv);

  // Position label to the right of the sphere
  const radius = sphere.geometry.boundingSphere.radius * sphere.scale.x;
  const padding = radius * 6; // Adjust this factor to fine-tune the distance
  label.position.set(radius + padding, 0, 0);

  sphere.add(label);
  //  sphere.userData.label = label;

  scene.add(sphere);

    // Add the label to labelMap
    labelMap.set(filename, label);

  // if (Math.random() < 0.25) sphere.layers.enable(BLOOM_SCENE);
  // sphere.layers.enable(BLOOM_SCENE);
  // sphere.layers.set(BLOOM_SCENE);

  // sphere.layers.enable(0);  // Default layer
  // sphere.layers.enable(BLOOM_SCENE);
  sphere.layers.set(ENTIRE_SCENE); // Default layer
  sphere.layers.enable(BLOOM_SCENE); // Bloom layer

  markNeedsRender();

  console.log("i am created sphere", sphere);
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

  projScreenMatrix
    .copy(camera.projectionMatrix)
    .multiply(camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreenMatrix);

  scene.traverse((object) => {
    if (object.isMesh) {
      let isVisible;

      if (object.geometry && object.geometry.boundingSphere) {
        // Update the object's bounding sphere
        if (!object.boundingSphere) {
          object.boundingSphere = new THREE.Sphere();
        }
        object.boundingSphere
          .copy(object.geometry.boundingSphere)
          .applyMatrix4(object.matrixWorld);

        // Add a small buffer to the bounding sphere radius
        const bufferFactor = 1.1; // Adjust this value as needed
        const bufferedRadius = object.boundingSphere.radius * bufferFactor;

        isVisible = frustum.intersectsSphere(
          new THREE.Sphere(object.boundingSphere.center, bufferedRadius)
        );
      } else {
        // For large objects like cubes, use a more lenient culling method
        isVisible =
          frustum.intersectsObject(object) ||
          object.position.distanceTo(camera.position) <
            (object.geometry.boundingSphere?.radius || 100);
      }

      object.visible = isVisible;

      if (isVisible && !object.layers.test(bloomLayer)) {
        darkenNonBloomed(object);
      }
    }
  });

  bloomComposer.render();
  scene.traverse(restoreMaterial);

  nonBloomScene.traverse((object) => {
    if (object.isMesh) {
      if (object.geometry && object.geometry.boundingSphere) {
        // Update the object's bounding sphere
        if (!object.boundingSphere) {
          object.boundingSphere = new THREE.Sphere();
        }
        object.boundingSphere
          .copy(object.geometry.boundingSphere)
          .applyMatrix4(object.matrixWorld);

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

// const throttledRender = throttle(() => {
//   camera.updateMatrixWorld();

//   // Render bloom pass
//   renderer.setClearColor(0x000000, 0);
//   bloomComposer.renderToScreen = false;
//   scene.traverse((obj) => {
//     if (obj.isMesh) {
//       if (obj.layers.test(BLOOM_SCENE)) {
//         obj.layers.enable(BLOOM_SCENE);
//         obj.layers.disable(0);
//       } else {
//         obj.layers.enable(0);
//         obj.layers.disable(BLOOM_SCENE);
//       }
//     }
//   });
//   bloomComposer.render();

//   // Render scene normally
//   renderer.setClearColor(0x000000, 1);
//   camera.layers.set(0);
//   renderer.setRenderTarget(null);
//   renderer.render(scene, camera);

//   // Render non-bloom scene
//   renderer.setRenderTarget(nonBloomRT);
//   renderer.clear();
//   renderer.render(nonBloomScene, camera);

//   // Final composite
//   finalComposer.render();

//   // Render labels
//   labelRenderer.render(scene, camera);
// }, 16);

// const throttledRender = throttle(() => {
//   camera.updateMatrixWorld();

//   // **1. Render Bloom Pass**
//   renderer.setClearColor(0x000000, 0);
//   bloomComposer.renderToScreen = false;

//   // **Set camera to render only BLOOM_SCENE layer**
//   camera.layers.set(BLOOM_SCENE);
//   bloomComposer.render();

//   // **2. Render Normal Scene**
//   renderer.setClearColor(0x000000, 1);

//   // **Set camera to render only ENTIRE_SCENE layer**
//   camera.layers.set(ENTIRE_SCENE);
//   renderer.setRenderTarget(null);
//   renderer.render(scene, camera);

//   // **3. Render Non-Bloom Scene if Applicable**
//   renderer.setRenderTarget(nonBloomRT);
//   renderer.clear();
//   renderer.render(nonBloomScene, camera);

//   // **4. Final Composite**
//   finalComposer.render();

//   // **5. Render Labels**
//   labelRenderer.render(scene, camera);
// }, 16);

// Near your other global variables
const RENDER_STATES = {
  NONE: 0,
  NEEDS_MATRIX_UPDATE: 1,
  NEEDS_FULL_RENDER: 2,
};

let renderState = RENDER_STATES.NONE;
let needsLabelUpdate = false;

let timeOfDay;
let prevTimeOfDay;

function setBloomParameters(timeOfDay) {
  if (timeOfDay >= 0.8) {
    // For noon, reduce bloom strength and increase threshold
    bloomPass.strength = 0.5;   // Reduce bloom strength
    bloomPass.threshold = 0.2;  // Increase threshold to reduce bloom on bright areas
  } else {
    // Default bloom settings
    bloomPass.strength = params.strength;
    bloomPass.threshold = params.threshold;
  }
}

function setRendererExposure(timeOfDay) {
  if (timeOfDay >= 0.8) {
    renderer.toneMappingExposure = 0.8; // Decrease exposure at noon
  } else {
    renderer.toneMappingExposure = 1.0; // Default exposure
  }
}


// function setBackgroundBasedOnTime(scene, nonBloomScene) {
//   // const nightColors = {
//   //   deepNight: new THREE.Color(0x2a2a4d),
//   //   twilight: new THREE.Color(0x3a3a6d),
//   //   dawn: new THREE.Color(0x2a2a4d),
//   //   morning: new THREE.Color(0x3a3a6d),    // Darke
//   //   noon: new THREE.Color(0x6464c8),
//   // };

//   const nightColors = {
//     deepNight: new THREE.Color(0x2a2a4d), // Dark Blue
//     twilight: new THREE.Color(0x3a3a6d),  // Medium Dark Blue
//     dawn: new THREE.Color(0x2a2a4d),      // Dark Blue
//     morning: new THREE.Color(0x3a3a6d),   // Medium Dark Blue
//     noon: new THREE.Color(0x2a2a5a),      // Slightly Darker Blue
//   };
  
//   console.log("time of day", timeOfDay)

//   // Label colors that contrast with backgrounds
//   const labelColors = {
//     deepNight: "#00ffff", // Cyan for deep night
//     twilight: "#ffa500", // Orange for twilight
//     dawn: "#ffffff", // White for dawn
//     morning: "#ffff00", // Yellow for morning
//     noon: "#ffffff", // White for noon
//   };

//   let bgColor = nightColors.deepNight;
//   let labelColor;

//   if (timeOfDay >= 0.0 && timeOfDay < 0.2) {
//     bgColor = nightColors.deepNight;
//     labelColor = labelColors.deepNight;
//   } else if (timeOfDay >= 0.2 && timeOfDay < 0.4) {
//     bgColor = nightColors.twilight;
//     labelColor = labelColors.twilight;
//   } else if (timeOfDay >= 0.4 && timeOfDay < 0.6) {
//     bgColor = nightColors.dawn;
//     labelColor = labelColors.dawn;
//   } else if (timeOfDay >= 0.6 && timeOfDay < 0.8) {
//     bgColor = nightColors.morning;
//     labelColor = labelColors.morning;
//   } else {
//     bgColor = nightColors.noon;
//     labelColor = labelColors.noon;
//   }


//    // Adjust bloom parameters based on time
//    setBloomParameters(timeOfDay);

//    // Adjust renderer exposure based on time
//    setRendererExposure(timeOfDay);

//   // renderer.setClearColor(bgColor, 1);
//   renderer.setClearColor(bgColor, 0); // Set alpha to 0 for transparency
//   scene.background = bgColor;
//   // nonBloomScene.background = bgColor;

//    // Set transparent background for nonBloomScene
//   //  nonBloomScene.background = new THREE.Color(0x000000);
//   //  nonBloomScene.background.alpha = 0;

//   nonBloomScene.background = null;

//   nonBloomScene.traverse((object) => {
//     if (object.material) {
//       object.material.transparent = true;
//       object.material.needsUpdate = true;
//     }
//   });


//   // Update all labels in the scene
//   scene.traverse((object) => {
//     if (object.isCSS2DObject) {
//       object.element.style.color = labelColor;
//     }
//   });

//   // markNeedsRender("cubeRemoval");
//   markNeedsRender("full");
// }

// Global variable to switch between plain background and gradient sky
let useGradientSky = false;

// Define the gradient sky mesh globally so we can modify it later
let sky;

function setBackgroundBasedOnTime(scene, nonBloomScene) {
  // Time of day ranges from 0.0 to 1.0
  // Adjust these colors and times as needed
  const nightColors = {
    deepNight: new THREE.Color(0x2a2a4d), // Dark Blue
    twilight: new THREE.Color(0x3a3a6d),  // Medium Dark Blue
    dawn: new THREE.Color(0x2a2a4d),      // Dark Blue
    morning: new THREE.Color(0x3a3a6d),   // Medium Dark Blue
    noon: new THREE.Color(0x2a2a5a),      // Slightly Darker Blue
  };

  // Label colors that contrast with backgrounds
  const labelColors = {
    deepNight: "#00ffff", // Cyan for deep night
    twilight: "#ffa500",  // Orange for twilight
    dawn: "#ffffff",      // White for dawn
    morning: "#ffff00",   // Yellow for morning
    noon: "#ffffff",      // White for noon
  };

  let bgColor = nightColors.deepNight;
  let labelColor;
  let bottomColor;

  if (timeOfDay >= 0.0 && timeOfDay < 0.2) {
    bgColor = nightColors.deepNight;
    labelColor = labelColors.deepNight;
    bottomColor = new THREE.Color(0x000000); // Night
  } else if (timeOfDay >= 0.2 && timeOfDay < 0.4) {
    bgColor = nightColors.twilight;
    labelColor = labelColors.twilight;
    bottomColor = new THREE.Color(0x110022); // Early morning
  } else if (timeOfDay >= 0.4 && timeOfDay < 0.6) {
    bgColor = nightColors.dawn;
    labelColor = labelColors.dawn;
    bottomColor = new THREE.Color(0x550055); // Dawn
  } else if (timeOfDay >= 0.6 && timeOfDay < 0.8) {
    bgColor = nightColors.morning;
    labelColor = labelColors.morning;
    bottomColor = new THREE.Color(0x0066ff); // Morning
  } else {
    bgColor = nightColors.noon;
    labelColor = labelColors.noon;
    bottomColor = new THREE.Color(0x87ceeb); // Day
  }

  // Adjust bloom parameters based on time
  setBloomParameters(timeOfDay);

  // Adjust renderer exposure based on time
  setRendererExposure(timeOfDay);

  if (useGradientSky) {
    // Remove existing sky if it exists
    if (sky) {
      scene.remove(sky);
      sky.geometry.dispose();
      sky.material.dispose();
    }

    // Create gradient sky
    const skyGeo = new THREE.SphereGeometry(1000, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: bgColor },
        bottomColor: { value: bottomColor },
        offset: { value: 0 }, // Adjusted offset
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          // Correctly add offset to the y-component
          float h = normalize( vWorldPosition + vec3(0.0, offset, 0.0) ).y;
          gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max(h, 0.0), exponent ), 0.0 ) ), 1.0 );
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Ensure the background is transparent
    scene.background = null;
    renderer.setClearColor(0x000000, 0); // Transparent background
  } else {
    // Remove existing sky if it exists
    if (sky) {
      scene.remove(sky);
      sky.geometry.dispose();
      sky.material.dispose();
      sky = null;
    }

    // Set plain background color
    renderer.setClearColor(bgColor, 0);
    scene.background = bgColor;
  }

  // Set transparent background for nonBloomScene
  nonBloomScene.background = null;

  nonBloomScene.traverse((object) => {
    if (object.material) {
      object.material.transparent = true;
      object.material.needsUpdate = true;
    }
  });

  // Update all labels in the scene
  scene.traverse((object) => {
    if (object.isCSS2DObject) {
      object.element.style.color = labelColor;
    }
  });

  markNeedsRender("full");
}


// Replace your current throttledRender
const throttledRender = throttle(() => {
  // Skip if no updates needed
  if (renderState === RENDER_STATES.NONE && !needsRender && renderCount <= 0) {
    return;
  }
  timeOfDay = getCurrentTimeOfDay();

  if ((!timeOfDay && !isCubeRender) || timeOfDay != prevTimeOfDay) {
    setBackgroundBasedOnTime(scene, nonBloomScene);
    prevTimeOfDay = timeOfDay;
  }

  // Update matrices only when needed
  if (camera.matrixWorldNeedsUpdate) {
    camera.updateMatrixWorld();
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);
  }

  // Store layer states
  const bloomObjects = new Map();
  const nonBloomObjects = new Map();

  // Efficient frustum culling
  const visibleObjects = new Set();

  scene.traverse((object) => {
    // if (object.isMesh) {
    //   // Update bounding sphere only when needed
    //   if (!object.boundingSphere || object.matrixWorldNeedsUpdate) {
    //     if (!object.boundingSphere) {
    //       object.boundingSphere = new THREE.Sphere();
    //     }
    //     object.boundingSphere.copy(object.geometry.boundingSphere).applyMatrix4(object.matrixWorld);
    //   }
    if (object.isMesh) {
      // Update bounding sphere only when needed
      if (!object.boundingSphere || object.matrixWorldNeedsUpdate) {
        if (!object.boundingSphere) {
          object.boundingSphere = new THREE.Sphere();
        }
        // Add null check for geometry.boundingSphere
        if (object.geometry.boundingSphere) {
          object.boundingSphere
            .copy(object.geometry.boundingSphere)
            .applyMatrix4(object.matrixWorld);
        } else {
          // Compute the bounding sphere if it doesn't exist
          object.geometry.computeBoundingSphere();
          object.boundingSphere
            .copy(object.geometry.boundingSphere)
            .applyMatrix4(object.matrixWorld);
        }
      }

      // Frustum culling with buffer
      const isVisible = frustum.intersectsSphere(object.boundingSphere);
      object.visible = isVisible;

      if (isVisible) {
        visibleObjects.add(object);
        if (object.layers.test(BLOOM_SCENE)) {
          bloomObjects.set(object, object.layers.mask);
        } else {
          nonBloomObjects.set(object, object.layers.mask);
        }
      }
    }
  });


  // setBackgroundBasedOnTime(scene, nonBloomScene);
  bloomComposer.renderToScreen = false;

  bloomObjects.forEach((layerMask, obj) => {
    obj.layers.mask = BLOOM_SCENE;
  });

  camera.layers.set(BLOOM_SCENE);
  bloomComposer.render();

  // Restore layers and render main scene
  bloomObjects.forEach((layerMask, obj) => {
    obj.layers.mask = layerMask;
  });

  // renderer.setClearColor(0x000000, 1);
  camera.layers.set(ENTIRE_SCENE);
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  // Handle non-bloom scene
  if (nonBloomScene.children.length > 0) {
    renderer.setRenderTarget(nonBloomRT);
    renderer.clear();
    renderer.render(nonBloomScene, camera);
  }

  // Final composite
  finalComposer.render();

  // Update labels only when needed
  if (needsLabelUpdate || renderState === RENDER_STATES.NEEDS_FULL_RENDER) {
    labelRenderer.render(scene, camera);
    needsLabelUpdate = false;
  }

  // Reset render state
  renderState = RENDER_STATES.NONE;
}, 16);

export function render() {
  throttledRender();
}

function ensureBaseSize(object) {
  if (object.baseSize === undefined) {
    if (object.isAxesHelper) {
      // For AxesHelper, use its size as baseSize
      object.baseSize = object.geometry.boundingSphere.radius;
    } else if (object.geometry && object.geometry.boundingSphere) {
      // For other objects with geometry, use the bounding sphere radius
      object.baseSize = object.geometry.boundingSphere.radius;
    } else {
      // Default fallback size
      object.baseSize = 1;
    }
  }
}

// export function render() {
//   camera.updateMatrixWorld();

//   function updateObjectVisibilityAndScale(object) {
//       if (object.isMesh || object.isLine || object.isPoints) {
//           ensureBaseSize(object);

//           const visible = isObjectVisible(object, camera);
//           object.visible = visible;

//           if (visible) {
//               const distance = camera.position.distanceTo(object.position);
//               const scaleFactor = getScaleFactorForDistance(distance);

//               object.scale.setScalar(object.baseSize * scaleFactor);

//               if (object.isCSS2DObject) {
//                   // Update label scale inversely to maintain size
//                   object.scale.setScalar(1 / scaleFactor);
//               }
//           }
//       }
//   }

//   scene.traverse(updateObjectVisibilityAndScale);
//   nonBloomScene.traverse(updateObjectVisibilityAndScale);

//   // Render bloom scene
//   bloomComposer.render();

//   // Render non-bloom scene
//   renderer.setRenderTarget(nonBloomRT);
//   renderer.render(nonBloomScene, camera);

//   // Final composite
//   finalComposer.render();

//   // Render labels
//   labelRenderer.render(scene, camera);
// }

// function darkenNonBloomed(obj) {
//   if (obj.isMesh && !bloomLayer.test(obj.layers)) {
//     if (!materials[obj.uuid]) {
//       materials[obj.uuid] = obj.material;
//       obj.material = darkMaterial;
//     }
//   }
// }
function darkenNonBloomed(obj) {
  if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
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

// export function markNeedsRender() {
//   needsRender = true;
//   renderCount = 1; // Render for the next 2 frames
//   updateMiniMap();
// }
let isCubeRender = false;
// export function markNeedsRender(type = "full") {
//   isCubeRender = false;
//   switch (type) {
//     case "matrix":
//       renderState = Math.max(renderState, RENDER_STATES.NEEDS_MATRIX_UPDATE);
//       break;
//     case "labels":
//       needsLabelUpdate = true;
//       break;
//     case "cubeRemoval":
//       // Special case for cube removal with full cleanup
//       renderer.renderLists.dispose();
//       renderer.clear();
//       renderer.info.reset();
//       scene.updateMatrixWorld(true);
//       nonBloomScene.updateMatrixWorld(true);
//       bloomComposer.render();
//       finalComposer.render();
//       isCubeRender = true;
//       renderState = RENDER_STATES.NEEDS_FULL_RENDER;
//       // render();
//       break;
//     case "full":
//     default:
//       renderState = RENDER_STATES.NEEDS_FULL_RENDER;
//       renderCount = 1;
//       if (updateMiniMap) {
//         updateMiniMap();
//       }
//   }
// }


export function markNeedsRender(type = "full") {
  isCubeRender = false;
  switch (type) {
    case "matrix":
      renderState = Math.max(renderState, RENDER_STATES.NEEDS_MATRIX_UPDATE);
      break;
    case "labels":
      needsLabelUpdate = true;
      break;
      case "cubeRemoval":
            // Special case for cube removal with full cleanup
            renderer.renderLists.dispose();
            renderer.clear();
            renderer.info.reset();
            scene.updateMatrixWorld(true);
            nonBloomScene.updateMatrixWorld(true);
            bloomComposer.render();
            finalComposer.render();
            isCubeRender = true;
            renderState = RENDER_STATES.NEEDS_FULL_RENDER;
            // render();
            break;
    case "full":
    default:
      renderState = RENDER_STATES.NEEDS_FULL_RENDER;
      renderCount = 1;
      if (updateMiniMap) {
        updateMiniMap();
      }
  }
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
  z = Math.random() * 100 - 50
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
    labelMap: labelMap,
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
    const boxIndex = snapshot.boxes.findIndex(
      (b) => b.wireframe.userData.id === boxId
    );
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
      if (
        object.shape &&
        object.isMesh &&
        (object.shape === "sphere" || object.shape.includes("Cube"))
      ) {
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
  // handleDeletedObjects()

  logSceneContents({ scene, nonBloomScene });

  snapshot
    .filter((objectState) => objectState.isDeleted)
    .forEach((objectState) => {
      const objToDelete =
        scene.getObjectByProperty("uuid", objectState.uuid) ||
        nonBloomScene.getObjectByProperty("uuid", objectState.uuid);

      if (objToDelete) {
       
        removeObject(objToDelete);
      }
    });

  // Create or update non-deleted objects
  snapshot
    .filter((objectState) => !objectState.isDeleted)
    .forEach((objectState) => {
      const existingObject =
        scene.getObjectByProperty("uuid", objectState.uuid) ||
        nonBloomScene.getObjectByProperty("uuid", objectState.uuid);
      if (existingObject) {
        objectState.isUpdated &&
          updateObjectProperties(existingObject, objectState);
      } else {
        createObject(objectState); // if its a new object
      }
    });
  markNeedsRender();
  saveSceneSnapshot();
}

export function reconstructFromGraphData() {
  setTimeout(async () => {
      const graphData = await indexDBOverlay.getData("graph");
      if (graphData && graphData.length > 0) {
          reconstructScene(graphData);
      }
  }, 0);
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
  if (scene.getObjectByProperty("uuid", object.uuid)) {
    scene.remove(object);
  }
  // Remove from non-bloom scene
  if (nonBloomScene.getObjectByProperty("uuid", object.uuid)) {
    nonBloomScene.remove(object);
  }

  // If the object is a Line or LineSegments (for wireframe cubes)
  if (object.isLine || object.isLineSegments) {
    const solidCubeUuid = object.uuid + "-solid";
    const solidCube = nonBloomScene.getObjectByProperty("uuid", solidCubeUuid);
    if (solidCube) {
      nonBloomScene.remove(solidCube);
      if (solidCube.material) solidCube.material.dispose();
      if (solidCube.geometry) solidCube.geometry.dispose();
    }
  }

  // Dispose of materials and geometries
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose());
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

  // Force complete scene cleanup
  nonBloomScene.children = nonBloomScene.children.filter(
    (child) =>
      child.uuid !== object.uuid && child.uuid !== object.uuid + "-solid"
  );

  // Force renderer to clear its internal state
  renderer.renderLists.dispose();

  // Update scene matrices
  scene.updateMatrixWorld(true);
  nonBloomScene.updateMatrixWorld(true);

  // Force a complete re-render
  renderer.clear();
  markNeedsRender("cubeRemoval");
}

export function hideObject(object, scene, nonBloomScene) {
  // Function to recursively hide an object and its children
  function hideRecursively(obj) {
    obj.visible = false;
    if (obj.children) {
      obj.children.forEach((child) => hideRecursively(child));
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

function addAxesHelper() {
  const axesHelper = new THREE.AxesHelper(2); // Adjust size as needed

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

  axesHelper.name = "AxesHelper";
  scene.add(axesHelper);
}

export function createMiniMap(scene, nonBloomScene, camera, renderer) {
  const mapSize = 150;
  const padding = 10;
  const borderWidth = 2;

  // Create container div for border
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.right = `${padding}px`;
  container.style.bottom = `${padding}px`;
  container.style.width = `${mapSize + 2 * borderWidth}px`;
  container.style.height = `${mapSize + 2 * borderWidth}px`;
  container.style.backgroundColor = "rgba(211, 211, 211, 0.5)";
  container.style.padding = `${borderWidth}px`;
  document.body.appendChild(container);

  // Create canvas element
  const canvas = document.createElement("canvas");
  canvas.width = mapSize;
  canvas.height = mapSize;
  canvas.style.display = "block";
  canvas.style.backgroundColor = "rgba(0,0,0,0.5)";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  // Add click event listener to the canvas
  canvas.addEventListener("click", (event) => {
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
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
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
        y: centerY - (z - camera.position.z) * scaleFactor,
      };
    }

    // Function to draw objects from a scene
    function drawSceneObjects(sceneToRender) {
      sceneToRender.traverse((object) => {
        if (object.isMesh) {
          const { x, y } = worldToMap(object.position.x, object.position.z);

          let color;
          if (object.geometry.type === "IcosahedronGeometry") {
            color = "red";
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
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(centerX, cameraY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Calculate view frustum
    const fov = (camera.fov * Math.PI) / 180;
    const aspect = camera.aspect;
    const nearDistance = 10 * scaleFactor;
    const farDistance = visibleRange * scaleFactor;

    // Draw viewpoint cone
    ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
    ctx.fillStyle = "rgba(255, 255, 0, 0.1)";
    ctx.beginPath();
    ctx.moveTo(centerX, cameraY);
    ctx.lineTo(
      centerX + Math.tan(fov / 2) * aspect * nearDistance,
      cameraY - nearDistance
    );
    ctx.lineTo(
      centerX + Math.tan(fov / 2) * aspect * farDistance,
      cameraY - farDistance
    );
    ctx.lineTo(
      centerX - Math.tan(fov / 2) * aspect * farDistance,
      cameraY - farDistance
    );
    ctx.lineTo(
      centerX - Math.tan(fov / 2) * aspect * nearDistance,
      cameraY - nearDistance
    );
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

    ctx.strokeStyle = "white";
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

function cleanupResources() {
  renderer.dispose();
  materialCache.clear();
  geometryCache.clear();
}

window.addEventListener("beforeunload", cleanupResources);
