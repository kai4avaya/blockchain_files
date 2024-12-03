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
  // logSceneContents,
} from "./snapshot.js";
import {
  isUMAPWorkerActive,
  sendSceneBoundingBoxToWorker,
} from "../../ai/umap.js";
import MouseOverlayCanvas from "./MouseOverlayCanvas";
import { Frustum, Matrix4 } from "three";
import indexDBOverlay from '../../memory/local/file_worker';
// import { showContextMenu , contextMenu, hideContextMenu} from "./canvas_menu.js";
import {createMiniMap} from './createMiniMap.js'; 

const frustum = new Frustum();
const projScreenMatrix = new Matrix4();

let mouseOverlay;
export const ENTIRE_SCENE = 0;
export const BLOOM_SCENE = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);
const SCALEFACTOR = 0.05;
let isCubeRender = false;
let renderer = null;
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

// Add this function near the top of the file
let isUsingFallbackRenderer = false;
let currentRenderer = null;

function createRenderer() {
    // Try creating renderer with different configurations
    const rendererConfigs = [
        // Config 1: Optimal settings
        {
            antialias: true,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            alpha: true,
            stencil: false
        },
        // Config 2: Performance settings
        {
            antialias: false,
            powerPreference: "default",
            failIfMajorPerformanceCaveat: false,
            alpha: true,
            stencil: false
        },
        // Config 3: Compatibility settings
        {
            antialias: false,
            powerPreference: "low-power",
            failIfMajorPerformanceCaveat: false,
            alpha: true,
            precision: "lowp"
        }
    ];

    let error = null;

    // Try each config until one works
    for (const config of rendererConfigs) {
        try {
            renderer = new THREE.WebGLRenderer(config);
            console.log('Created renderer with config:', config);
            break;
        } catch (e) {
            error = e;
            console.warn('Failed to create renderer with config:', config, e);
            continue;
        }
    }

    // If all WebGL attempts failed, try CSS3D
    if (!renderer) {
        console.warn('All WebGL renderer attempts failed, falling back to CSS3D');
        try {
            renderer = new THREE.CSS3DRenderer();
            isUsingFallbackRenderer = true;
            showCompatibilityMessage();
        } catch (e) {
            console.error('CSS3D fallback also failed:', e);
            throw error || e; // Throw the original error if CSS3D also fails
        }
    }

    // Configure renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    if (!isUsingFallbackRenderer) {
        renderer.toneMapping = THREE.ReinhardToneMapping;
    }

    // Add context loss handling
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    currentRenderer = renderer;
    return renderer;
}

renderer = createRenderer();

function handleContextLost(event) {
    event.preventDefault();
    console.warn('WebGL context lost, attempting to restore...');
    
    setTimeout(() => {
        try {
            if (currentRenderer.forceContextRestore) {
                currentRenderer.forceContextRestore();
            } else {
                // Recreate renderer if restore not available
                const newRenderer = createRenderer();
                Object.assign(currentRenderer, newRenderer);
            }
            markNeedsRender('full');
        } catch (e) {
            console.error('Failed to restore context:', e);
            showCompatibilityMessage();
        }
    }, 1000);
}

function handleContextRestored() {
    console.log('Context restored');
    markNeedsRender('full');
}

function showCompatibilityMessage() {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 165, 0, 0.9);
        padding: 10px;
        border-radius: 5px;
        z-index: 1000;
        font-family: sans-serif;
        text-align: center;
        max-width: 80%;
    `;
    message.innerHTML = `
        <p style="margin: 0; color: black;">
            ⚠️ Running in compatibility mode. For best experience:
            <br>
            1. Enable hardware acceleration in your browser settings
            <br>
            2. Update your graphics drivers
            <br>
            3. Try using Firefox or another modern browser
        </p>
    `;
    document.body.appendChild(message);
}

// Modify the render function to handle fallbacks gracefully
// const originalRender = render_cull;
// export function render_cull() {
//     try {
//         if (isUsingFallbackRenderer) {
//             renderer.render(scene, camera);
//             labelRenderer.render(scene, camera);
//             return;
//         }
//         originalRender();
//     } catch (e) {
//         console.error('Render error:', e);
//         if (!isUsingFallbackRenderer) {
//             console.warn('Attempting to switch to fallback renderer...');
//             try {
//                 const newRenderer = createRenderer();
//                 Object.assign(renderer, newRenderer);
//                 markNeedsRender('full');
//             } catch (fallbackError) {
//                 console.error('Failed to create fallback renderer:', fallbackError);
//             }
//         }
//     }
// }

document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  1,
  1000 // Increased Far Clipping Plane
);

camera.position.set(20, 20, 20); 
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


controls.enableDamping = true; // Add smooth damping effect
// controls.dampingFactor = 0.05;
controls.screenSpacePanning = false; // Disable 2D panning
// controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation to prevent going below the scene
// controls.minDistance = 5; // Minimum zoom distance
// controls.maxDistance = 500; // Maximum zoom distance
controls.target.set(0, 0, 0); // Set the orbit target to scene center
controls.enableRotate = true;
controls.rotateSpeed = 0.5;

let needsRender = false;
let renderCount = 0;

const RENDER_STATES = {
  NONE: 0,
  NEEDS_MATRIX_UPDATE: 1,
  NEEDS_FULL_RENDER: 2,
};

let renderState = RENDER_STATES.NONE;
let needsLabelUpdate = false;

let timeOfDay;
let prevTimeOfDay;

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


controls.addEventListener("change", () => {
  markNeedsRender();
});

export function initializeGraph() {
  setupScene();
}
initializeGraph()

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

  markNeedsRender("cubeRemoval"); // KAI DOUBLE CHECK THIS

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

  markNeedsRender('immediate');
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

// Add this export function near the other exports
export function removeLabel(objectId, filename = '') {
  console.log('Attempting to remove label:', { objectId, filename });
  let labelRemoved = false;

  // Function to check if a label matches our search criteria
  const isMatchingLabel = (labelElement) => {
    if (!labelElement || !labelElement.element) return false;
    
    // Check by ID
    if (labelElement.element.dataset.objectId === objectId) return true;
    
    // If we have a filename, check the text content
    if (filename && labelElement.element.textContent.includes(filename)) {
      console.log('Found label by filename match:', filename);
      return true;
    }
    
    return false;
  };

  // Search both scenes for labels
  [scene, nonBloomScene].forEach(currentScene => {
    currentScene.traverse((object) => {
      // Look for CSS2DObjects (labels) in children
      object.children.forEach(child => {
        if (child instanceof CSS2DObject) {
          if (isMatchingLabel(child)) {
            console.log('Found and removing label:', child);
            child.removeFromParent();
            child.element.remove();
            labelRemoved = true;
          }
        }
      });
    });
  });

  // Also search for any orphaned label elements in the DOM
  const allLabels = document.querySelectorAll('.label');
  allLabels.forEach(label => {
    if (label.dataset.objectId === objectId || 
        (filename && label.textContent.includes(filename))) {
      console.log('Found and removing orphaned label element');
      label.remove();
      labelRemoved = true;
    }
  });

  if (!labelRemoved) {
    console.warn('No label found to remove for:', { objectId, filename });
  } else {
    console.log('Label removal completed successfully');
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
  labelDiv.className = "label file-label"; 
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

 
  sphere.layers.set(ENTIRE_SCENE); // Default layer
  sphere.layers.enable(BLOOM_SCENE); // Bloom layer

  // markNeedsRender();
  markNeedsRender("cubeRemoval");

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
// export function render_cull() {

//   projScreenMatrix
//     .copy(camera.projectionMatrix)
//     .multiply(camera.matrixWorldInverse);
//   frustum.setFromProjectionMatrix(projScreenMatrix);

//   scene.traverse((object) => {
//     if (object.isMesh) {
//       let isVisible;

//       if (object.geometry && object.geometry.boundingSphere) {
//         // Update the object's bounding sphere
//         if (!object.boundingSphere) {
//           object.boundingSphere = new THREE.Sphere();
//         }
//         object.boundingSphere
//           .copy(object.geometry.boundingSphere)
//           .applyMatrix4(object.matrixWorld);

//         // Add a small buffer to the bounding sphere radius
//         const bufferFactor = 1.1; // Adjust this value as needed
//         const bufferedRadius = object.boundingSphere.radius * bufferFactor;

//         isVisible = frustum.intersectsSphere(
//           new THREE.Sphere(object.boundingSphere.center, bufferedRadius)
//         );
//       } else {
//         // For large objects like cubes, use a more lenient culling method
//         isVisible =
//           frustum.intersectsObject(object) ||
//           object.position.distanceTo(camera.position) <
//             (object.geometry.boundingSphere?.radius || 100);
//       }

//       object.visible = isVisible;

//       if (isVisible && !object.layers.test(bloomLayer)) {
//         darkenNonBloomed(object);
//       }
//     }
//   });

//   bloomComposer.render();
//   scene.traverse(restoreMaterial);

//   nonBloomScene.traverse((object) => {
//     if (object.isMesh) {
//       if (object.geometry && object.geometry.boundingSphere) {
//         // Update the object's bounding sphere
//         if (!object.boundingSphere) {
//           object.boundingSphere = new THREE.Sphere();
//         }
//         object.boundingSphere
//           .copy(object.geometry.boundingSphere)
//           .applyMatrix4(object.matrixWorld);

//         object.visible = frustum.intersectsSphere(object.boundingSphere);
//       } else {
//         // Fallback to using intersectsObject if boundingSphere is not available
//         object.visible = frustum.intersectsObject(object);
//       }
//     }
//   });

//   renderer.setRenderTarget(nonBloomRT);
//   renderer.clear();
//   renderer.render(nonBloomScene, camera);
//   labelRenderer.render(scene, camera);

//   finalComposer.render();
// }


// First, store the original render_cull function implementation
// const originalRenderCull = render_cull;

// Then redefine render_cull with fallback handling while preserving original functionality
export function render_cull() {
    try {
        if (isUsingFallbackRenderer) {
            // Simple rendering path for fallback mode
            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
            return;
        }

        // Call the original render_cull implementation
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

    } catch (e) {
        console.error('Render error:', e);
        if (!isUsingFallbackRenderer) {
            console.warn('Attempting to switch to fallback renderer...');
            try {
                const newRenderer = createRenderer();
                Object.assign(renderer, newRenderer);
                markNeedsRender('full');
            } catch (fallbackError) {
                console.error('Failed to create fallback renderer:', fallbackError);
            }
        }
    }
}


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

const updateMiniMap = createMiniMap(camera, scene, nonBloomScene, markNeedsRender, controls);


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

      case "immediate":
        // Force immediate render cycle
        renderer.renderLists.dispose();
        renderer.clear();
        renderer.info.reset();
        scene.updateMatrixWorld(true);
        nonBloomScene.updateMatrixWorld(true);
        bloomComposer.render();
        finalComposer.render();
        
        // Set up for next frame
        renderState = RENDER_STATES.NEEDS_FULL_RENDER;
        renderCount = 2; // Force two render cycles
        
        // Force an immediate additional render
        requestAnimationFrame(() => {
          controls.update();
          bloomComposer.render();
          finalComposer.render();
        });
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

  // const { scene } = share3dDat();
  scene.add(ghostCube);
  markNeedsRender();
}

export function removeGhostCube() {
  if (ghostCube) {
    // const { scene } = share3dDat();
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

  // logSceneContents({ scene, nonBloomScene });

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

  if (object.userData && object.userData.filename) {
    removeLabel(object.userData.id, object.userData.filename);
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

const deletedObjects = new Set();

export function markObjectAsDeleted(uuid) {
  deletedObjects.add(uuid);
}

export function isObjectDeleted(uuid) {
  return deletedObjects.has(uuid);
}

// Add this new function to create.js
export function clearAllScenes() {
  console.log('Clearing all scenes...');
  
  // Function to properly dispose of objects
  function disposeObject(obj) {
    if (obj.geometry) {
      obj.geometry.dispose();
    }
    
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(material => material.dispose());
      } else {
        obj.material.dispose();
      }
    }
    
    // Remove any CSS2D labels
    if (obj.isCSS2DObject && obj.element && obj.element.parentNode) {
      obj.element.parentNode.removeChild(obj.element);
    }
  }

  // Clear main scene
  scene.traverse(disposeObject);
  scene.children.length = 0;

  // Clear non-bloom scene
  nonBloomScene.traverse(disposeObject);
  nonBloomScene.children.length = 0;

  // Reset any scene-related caches or maps
  deletedObjects.clear();
  labelMap?.clear();

  // Re-add essential scene elements
  addAxesHelper();
  
  // Force renderer to clear its internal state
  renderer.renderLists.dispose();
  renderer.clear();
  
  markNeedsRender('full');
}

function cleanupResources() {
  renderer.dispose();
  materialCache.clear();
  geometryCache.clear();
}
window.addEventListener("beforeunload", cleanupResources);

// const updateMiniMap = createMiniMap(camera, scene, nonBloomScene, markNeedsRender, controls);

