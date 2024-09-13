import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {} from "./move.js";
import { makeObjectWritable, convertToThreeJSFormat } from "../../utils/utils";
import { createSceneSnapshot } from "./snapshot.js";
// import { sceneState } from "../../memory/collaboration/scene_colab";

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

  console.log("Simple environment created");
  console.log("Number of objects in scene:", scene.children.length);
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

    console.log("Terrain created");
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

  nonBloomScene.add(wireframeCube);
  nonBloomScene.add(solidCube);

  console.log("BIG BAD CUBE IS CREATED", wireframeCube, solidCube);

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
  

  console.log("One-point perspective scene setup complete");
  console.log("Camera position:", camera.position);
  console.log("Camera lookAt:", camera.getWorldDirection(new THREE.Vector3()));
  console.log("Camera far:", camera.far);

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
  console.log("Creating sphere with data:", convertedData);

  // Update material with the new color
  const color = convertedData.color || new THREE.Color().setHSL(
    Math.random(),
    0.7,
    Math.random() * 0.2 + 0.05
  );
  sphereMaterial = new THREE.MeshBasicMaterial({ color });

  // Create sphere using the global geometry and updated material
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

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

  console.log("Created sphere:", sphere);

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

/**
 * Renders the scene with bloom and non-bloom effects.
 */
export function render() {
  // Clear the renderer
  renderer.setRenderTarget(null); // Set the render target to null (render to screen)
  renderer.clear(); // Clear the render target

  // Render the bloom scene
  scene.traverse(darkenNonBloomed); // Traverse the scene and darken non-bloomed objects
  bloomComposer.render(); // Render the bloom scene using the bloom composer
  scene.traverse(restoreMaterial); // Traverse the scene and restore original materials

  renderer.setRenderTarget(nonBloomRT); // Set the render target to the non-bloom render target
  renderer.clear(); // Clear the render target
  renderer.render(nonBloomScene, camera); // Render the non-bloom scene to the render target

  // Render the final combined scene
  finalComposer.render(); // Render the final combined scene using the final composer

  // Clean up
  nonBloomRT.dispose(); // Dispose of the non-bloom render target
  // graphStore.setScenes(scene, nonBloomScene);
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
  renderCount = 2; // Render for the next 2 frames
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
export function removeEmptyCubes(scene, nonBloomScene) {
  // Create a snapshot of the current scene
  const snapshot = createSceneSnapshot([scene, nonBloomScene]);

  console.log("snapshot in removeEmptyCubes", snapshot);

  // Array to store cubes that need to be removed
  const cubesToRemove = [];
  const removedCubes = [];

  // Check each cube in the snapshot
  snapshot.boxes.forEach((box) => {
    const containedSpheres = snapshot.containment[box.id];

    // If the cube contains no spheres, add it to the removal list
    if (!containedSpheres || containedSpheres.length <= 1) {
      cubesToRemove.push(box);
    }
  });

  // Remove the empty cubes from the scenes
  cubesToRemove.forEach((box) => {
    if (box.wireframe) {
      nonBloomScene.remove(box.wireframe);
      box.wireframe.geometry.dispose();
      box.wireframe.material.dispose();
    }
    if (box.solid) {
      nonBloomScene.remove(box.solid);
      box.solid.geometry.dispose();
      box.solid.material.dispose();
    }

    // Remove from the snapshot as well
    const boxIndex = snapshot.boxes.findIndex((b) => b.id === box.id);
    if (boxIndex !== -1) {
      snapshot.boxes.splice(boxIndex, 1);
    }
    delete snapshot.containment[box.id];

    // Add to the removedCubes array
    removedCubes.push(box);
  });

  markNeedsRender();
  // Return the removed cubes
  return removedCubes;
}

// At the top of your file
let ghostCube = null;

export function createGhostCube(position, size) {
  if (ghostCube) return; // Prevent multiple ghost cubes

  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    opacity: 0.5,
    transparent: true,
  });

  ghostCube = new THREE.Mesh(geometry, material);
  ghostCube.position.copy(position);

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



// export function reconstructScene(snapshot) {
//   console.log(
//     "----------------------------------------------------------------------------"
//   );
//   console.log("Reconstructing scene with snapshot:", snapshot);
//   const existingObjects = new Map();

//   // Collect existing objects
//   function traverseScene(object, isMainScene) {
//     if (object.uuid) {
//       existingObjects.set(object.uuid, { object, inScene: isMainScene });
//     }
//   }
//   scene.traverse((object) => traverseScene(object, true));
//   nonBloomScene.traverse((object) => traverseScene(object, false));

//   // Update or create objects from snapshot
//   snapshot.forEach((objectState) => {
 
//     const existingEntry = existingObjects.get(objectState.uuid);

//     if (objectState.isDeleted) {
//       if (existingEntry) {
//         removeObject(existingEntry);
//       }
//       existingObjects.delete(objectState.uuid);
//     } else {
//       if (existingEntry) {
//       //   updateObjectProperties(existingEntry.object, objectState);
//       } else {
//         createObject(objectState);
//       }
//     }
//   });

//   console.log(
//     "----------------------------------------------------------------------------"
//   );
//   markNeedsRender();
// }
export function reconstructScene(snapshot) {
  console.log("Reconstructing scene with snapshot:", snapshot);
  snapshot.forEach((objectState) => {
    const existingObject = scene.getObjectByProperty('uuid', objectState.uuid) || 
                             nonBloomScene.getObjectByProperty('uuid', objectState.uuid);
      if (existingObject) {
        objectState.isUpdated && updateObjectProperties(existingObject, objectState);
      } 
      else if (objectState.isDeleted) {
        removeObject(existingObject);
      } else {
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
