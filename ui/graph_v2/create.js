import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {} from "./move.js";
import { generateUniqueId, generateVersionNonce, makeObjectWritable, convertToThreeJSFormat } from "../../utils/utils";
import { createSceneSnapshot } from "./snapshot.js";
// import { sceneState } from "../../memory/collaboration/scene_colab";

const BLOOM_SCENE = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);

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
setupScene();
let cubes = [];
const loginName = localStorage.getItem("login_block") || "no_login";

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

// export function convertToThreeJSFormat(data) {
//   // Start with a shallow copy of all data
//   const result = { ...data };

//   // Convert position
//   if (Array.isArray(data.position)) {
//     result.position = new THREE.Vector3().fromArray(data.position);
//   }

//   // Convert rotation
//   if (Array.isArray(data.rotation)) {
//     if (data.rotation.length === 4) {
//       // Assuming the rotation is stored as [x, y, z, order]
//       result.rotation = new THREE.Euler(
//         data.rotation[0],
//         data.rotation[1],
//         data.rotation[2],
//         data.rotation[3]
//       );
//     } else if (data.rotation.length === 3) {
//       // If only x, y, z are provided, use default order 'XYZ'
//       result.rotation = new THREE.Euler().fromArray(data.rotation);
//     } else {
//       console.warn('Unexpected rotation format:', data.rotation);
//     }
//   }

//   // Convert scale
//   if (Array.isArray(data.scale)) {
//     result.scale = new THREE.Vector3().fromArray(data.scale);
//   }

//   // Convert color if it's a number (assuming it's stored as a hex value)
//   if (typeof data.color === 'number') {
//     result.color = new THREE.Color(data.color);
//   }

//   // Remove specific fields
//   delete result.type;
//   delete result.shape;

//   // Set default values if not present
//   // result.color = result.color || randomColorGenerator(); 
//   result.version = result.version || 1;
//   result.userData = result.userData || { id: generateUniqueId(3) };
//   result.versionNonce = generateVersionNonce()
//   return result;
// }


// export function createWireframeCube(data) {
//   const convertedData = convertToThreeJSFormat(data);
//   console.log("I AM CUBE convertedData", convertedData);
//   const {
//     position,
//     scale,
//     size = 1,
//     color = randomColorGenerator(),
//     uuid = THREE.MathUtils.generateUUID(),
//     // id =  generateUniqueId(),
//     userData,
//     version = 1,
//     lastEditedBy = 'noUserId',
//   } = convertedData;

//   console.log("I AM CUBE SIZE", size);

//   // Create geometries
//   const geometry = new THREE.BoxGeometry(1, 1, 1);
//   const edges = new THREE.EdgesGeometry(geometry);

//   // Create materials
//   const wireMaterial = new THREE.LineBasicMaterial({ color, linewidth: 2 });
//   const solidMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });

//   // Create meshes
//   const wireframeCube = new THREE.LineSegments(edges, wireMaterial);
//   const solidCube = new THREE.Mesh(geometry, solidMaterial);

//   // Set position and scale
//   [wireframeCube, solidCube].forEach(cube => {
//     if (position) cube.position.copy(position);
//       cube.scale.setScalar(size);
//   });

//   // Set common properties
//   const commonProps = {
//     size,
//     version,
//     lastEditedBy,
//     versionNonce: generateVersionNonce(),
//   };

//   Object.assign(wireframeCube, {
//     ...commonProps,
//     userData: { id },
//     shape: "wireframeCube",
//     uuid,
//   });

//   Object.assign(solidCube, {
//     ...commonProps,
//     userData: { id: id + "_solid" },
//     shape: "solidCube",
//     uuid: uuid + "-solid",
//   });

//   nonBloomScene.add(wireframeCube);
//   nonBloomScene.add(solidCube);

//   console.log("BIG BAD CUBE IS CREATED", wireframeCube, solidCube);

//   return { wireframeCube, solidCube };
// }


  
  // Your createWireframeCube function
  export function createWireframeCube(convertedData) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(geometry);
  
    const color = convertedData.color;
    const wireMaterial = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    const solidMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
  
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

// export function createWireframeCube(convertedData) {
//   // const convertedData = convertToThreeJSFormat(data);
//   console.log("I AM CUBE convertedData", convertedData);

//   const geometry = new THREE.BoxGeometry(1, 1, 1);
//   const edges = new THREE.EdgesGeometry(geometry);

//   const color = convertedData.color;
//   // Create materials
//   // const wireMaterial = new THREE.LineBasicMaterial({ convertedData.color, linewidth: 2 });
//   const wireMaterial = new THREE.LineBasicMaterial({ color, linewidth: 2 });
//   const solidMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });

//   // Create meshes
//   const wireframeCube = new THREE.LineSegments(edges, wireMaterial);
//   const solidCube = new THREE.Mesh(geometry, solidMaterial);

//     // Make position property writable
//     Object.defineProperty(wireframeCube, 'position', {
//       writable: true,
//       value: wireframeCube.position
//     });

//   // Set position and scale
//   [wireframeCube, solidCube].forEach(cube => {
//     if (convertedData.position) cube.position.copy(convertedData.position);
//       cube.scale.setScalar(convertedData.size);
//   });
  
//   Object.assign(wireframeCube, {
//     ...convertedData,
//     shape: "wireframeCube",
//   });

//   Object.assign(solidCube, {
//     ...convertedData,
//     userData: { id: id + "_solid" },
//     shape: "solidCube",
//     uuid: uuid + "-solid",
//   });

//   nonBloomScene.add(wireframeCube);
//   nonBloomScene.add(solidCube);

//   console.log("BIG BAD CUBE IS CREATED", wireframeCube, solidCube);

//   return { wireframeCube, solidCube };
// }


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

  loadCameraState();

  markNeedsRender();
}

// Add an event listener to save camera state when the window is about to unload
window.addEventListener("beforeunload", saveCameraState);

// Modify your controls event listener to save camera state after changes
controls.addEventListener("change", () => {
  markNeedsRender();
  saveCameraState();
});


export function createSphere(data) {
  const convertedData = convertToThreeJSFormat(data);
  const {
    position,
    scale,
    size = 1,
    color: colorIn = null,
    uuid = THREE.MathUtils.generateUUID(),
    id = generateUniqueId(),
    version = 1,
    lastEditedBy = 'noUserId',
    userData
  } = convertedData;

  const geometry = new THREE.IcosahedronGeometry(1, 15);

  // Color handling
  let color;
  if (colorIn !== null && colorIn.isColor) {
    color = colorIn;
  } else {
    color = new THREE.Color().setHSL(
      Math.random(),
      0.7,
      Math.random() * 0.2 + 0.05
    );
  }

  const material = new THREE.MeshBasicMaterial({ color });
  const sphere = new THREE.Mesh(geometry, material);

  if (position) sphere.position.copy(position);
  sphere.scale.setScalar(size * 0.05);

  Object.assign(sphere, {
    shape: "sphere",
    userData,
    size,
    version,
    lastEditedBy,
    uuid,
    versionNonce: generateVersionNonce(),
  });

  scene.add(sphere);

  if (Math.random() < 0.25) sphere.layers.enable(BLOOM_SCENE);

  markNeedsRender();

  console.log("JUST CREATED THIS SPHERE", sphere);

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
  };
}
export function removeEmptyCubes(scene, nonBloomScene) {
  // Create a snapshot of the current scene
  const snapshot = createSceneSnapshot([scene, nonBloomScene]);

  // console.log("snapshot in removeEmptyCubes", snapshot);

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

  // render();
  markNeedsRender();

  // Return the removed cubes
  return removedCubes;
}


export function reconstructScene(snapshot) {
  console.log(
    "----------------------------------------------------------------------------"
  );
  console.log("Reconstructing scene with snapshot:", snapshot);
  const existingObjects = new Map();

  // Collect existing objects
  function traverseScene(object, isMainScene) {
    if (object.uuid) {
      existingObjects.set(object.uuid, { object, inScene: isMainScene });
    }
  }
  scene.traverse((object) => traverseScene(object, true));
  nonBloomScene.traverse((object) => traverseScene(object, false));

  // Update or create objects from snapshot
  snapshot.forEach((objectState) => {
 
    const existingEntry = existingObjects.get(objectState.uuid);

    if (objectState.isDeleted) {
      if (existingEntry) {
        removeObject(existingEntry);
      }
      existingObjects.delete(objectState.uuid);
    } else {
      if (existingEntry) {
        updateObjectProperties(existingEntry.object, objectState);
      } else {
        createObject(objectState);
      }
    }
  });

  console.log(
    "----------------------------------------------------------------------------"
  );
  markNeedsRender();
}

function removeObject(entry) {
  if (!entry.object.shape) return;

  if (entry.inScene) {
    scene.remove(entry.object);
  } else {
    nonBloomScene.remove(entry.object);
  }

  if (entry.object.material) entry.object.material.dispose();
  if (entry.object.geometry) entry.object.geometry.dispose();
}

function createObject(objectState) {
  if (objectState.shape === "sphere") {
    createSphereWrapper(objectState);
  } else if (
    objectState.shape === "wireframeCube"
    // objectState.shape === "solidCube"
  ) {
    createCubeWrapper(objectState);
  }
  // else {
  //   console.warn(`Unknown object type: ${objectState.shape}`);
  // }
}

function updateObjectProperties(object, objectState) {
  // Update the given object
  applyUpdates(object, objectState);

  // Check if this is a cube and update its twin
  if (
    objectState.shape === "wireframeCube" ||
    objectState.shape === "solidCube"
  ) {
    const twinId = object.userData.id.endsWith("_solid")
      ? object.userData.id.slice(0, -6) // Remove "_solid" suffix
      : object.userData.id + "_solid"; // Add "_solid" suffix

    const twinObject = findObjectById(twinId);
    if (twinObject) {
      applyUpdates(twinObject, objectState);
    }
  }
}

function applyUpdates(object, objectState) {
  // Update position
  object.position.set(
    objectState.position[0],
    objectState.position[1],
    objectState.position[2]
  );

  // Update scale
  if (objectState.scale) {
    object.scale.set(
      objectState.scale[0],
      objectState.scale[1],
      objectState.scale[2]
    );
  }

  if(objectState.version) {
    object.version = objectState.version;
  }

  // Update color
  if (object.material && objectState.color !== undefined) {
    object.material.color.setHex(objectState.color);
  }

  // Update size for cubes
  if (
    (object.shape === "wireframeCube" || object.shape === "solidCube") &&
    objectState.size !== undefined
  ) {
    const newSize = objectState.size;
    object.scale.set(newSize, newSize, newSize);
  }
}

function findObjectById(id) {
  let foundObject = null;
  scene.traverse((object) => {
    if (object.userData && object.userData.id === id) {
      foundObject = object;
    }
  });
  if (!foundObject) {
    nonBloomScene.traverse((object) => {
      if (object.userData && object.userData.id === id) {
        foundObject = object;
      }
    });
  }
  return foundObject;
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
  const { sphere } = createSphere(objectState);
  sphere.uuid = objectState.uuid;
}
