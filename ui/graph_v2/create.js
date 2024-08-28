import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {} from "./move.js";
import { generateUniqueId } from "../../utils/utils";
import { createSceneSnapshot } from "./snapshot.js";
import { sceneState } from "../../memory/collaboration/scene_colab";

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

controls.addEventListener("change", () => {
  markNeedsRender();
});

export async function initializeGraph() {
  setupScene();
}

// export function createWireframeCube(size, x, y, z, color, id = 0) {
//   const geometry = new THREE.BoxGeometry(size, size, size);
//   const edges = new THREE.EdgesGeometry(geometry);
//   const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
//   const wireframeCube = new THREE.LineSegments(edges, material);
//   wireframeCube.position.set(x, y, z);

//   const solidCubeMaterial = new THREE.MeshBasicMaterial({
//     color: color,
//     transparent: true,
//     opacity: 0,
//   });
//   const solidCube = new THREE.Mesh(geometry, solidCubeMaterial);
//   solidCube.position.set(x, y, z);

//   // Ensure `userData` is assigned
//   const userData = {
//     id: generateUniqueId(),
//   };
//   wireframeCube.userData = userData;
//   solidCube.userData = userData;

//   const cube = {
//     wireframeCube: wireframeCube,
//     solidCube: solidCube,
//   };

//   nonBloomScene.add(wireframeCube);
//   nonBloomScene.add(solidCube);

//   return cube;
// }

export function createWireframeCube(size, x, y, z, color, id = 0) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
  const wireframeCube = new THREE.LineSegments(edges, material);
  wireframeCube.position.set(x, y, z);

  const solidCubeMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0,
  });
  const solidCube = new THREE.Mesh(geometry, solidCubeMaterial);
  solidCube.position.set(x, y, z);

  const userData = {
    id: id || generateUniqueId(),
  };
  wireframeCube.userData = userData;
  solidCube.userData = userData;

  nonBloomScene.add(wireframeCube);
  nonBloomScene.add(solidCube);

  return {
    wireframeCube,
    solidCube,
    state: {
      id: userData.id,
      type: "cube",
      position: wireframeCube.position.toArray(),
      rotation: wireframeCube.rotation.toArray(),
      scale: wireframeCube.scale.toArray(),
      color: color,
      size: size,
      geometry: {
        type: "BoxGeometry",
        parameters: { width: size, height: size, depth: size },
      },
      material: {
        type: "LineBasicMaterial",
        color: color,
        wireframe: true,
      },
    },
  };
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

function setupSceneBloom() {
  scene.traverse(disposeMaterial);
  scene.children.length = 0;

  const geometry = new THREE.IcosahedronGeometry(1, 15);

  for (let i = 0; i < 50; i++) {
    const color = new THREE.Color();
    color.setHSL(Math.random(), 0.7, Math.random() * 0.2 + 0.05);

    const material = new THREE.MeshBasicMaterial({ color: color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.x = Math.random() * 10 - 5;
    sphere.position.y = Math.random() * 10 - 5;
    sphere.position.z = Math.random() * 10 - 5;
    sphere.position.normalize().multiplyScalar(Math.random() * 4.0 + 2.0);
    sphere.scale.setScalar(Math.random() * Math.random() + 0.5);
    scene.add(sphere);

    if (Math.random() < 0.25) sphere.layers.enable(BLOOM_SCENE);
  }

  // render();
  markNeedsRender();
}

function setupScene() {
  scene.traverse(disposeMaterial);
  scene.children.length = 0;
  nonBloomScene.traverse(disposeMaterial);
  nonBloomScene.children.length = 0;

  // render();
  markNeedsRender();
}

let first = 1;

// export function createSphere(x, y, z, size, id = "") {
//   if (first) {
//     scene.traverse(disposeMaterial);
//     scene.children.length = 0;
//   }

//   first = 0;

//   const geometry = new THREE.IcosahedronGeometry(1, 15);

//   const color = new THREE.Color();
//   color.setHSL(Math.random(), 0.7, Math.random() * 0.2 + 0.05);

//   const material = new THREE.MeshBasicMaterial({ color: color });
//   const sphere = new THREE.Mesh(geometry, material);
//   sphere.position.set(x, y, z);

//   sphere.scale.setScalar(size * 0.05);

//   sphere.userData = {
//     id: id, // Unique ID
//   };

//   scene.add(sphere);

//   if (Math.random() < 0.25) sphere.layers.enable(BLOOM_SCENE);

//   // render();
//   markNeedsRender();
// }

export function createSphere(x, y, z, size, id = "", colorIn = "") {
  const geometry = new THREE.IcosahedronGeometry(1, 15);
  // const color = new THREE.Color();
  let color = new THREE.Color()
  if (colorIn)  color.setHSL(colorIn);
  else {
    color.setHSL(Math.random(), 0.7, Math.random() * 0.2 + 0.05);
  }
  let material = new THREE.MeshBasicMaterial({ color: color });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(x, y, z);
  sphere.scale.setScalar(size * 0.05);

  const userData = {
    id: id || generateUniqueId(),
  };
  sphere.userData = userData;

  scene.add(sphere);

  if (Math.random() < 0.25) sphere.layers.enable(BLOOM_SCENE);

  markNeedsRender();

  console.log("JUST CREATED THIS SPHERE", sphere)

  return {
    sphere,
    state: {
      id: userData.id,
      type: "sphere",
      position: sphere.position.toArray(),
      rotation: sphere.rotation.toArray(),
      scale: sphere.scale.toArray(),
      color: sphere.material.color.getHex(),
      geometry: {
        type: "IcosahedronGeometry",
        parameters: { radius: 1, detail: 15 },
      },
      material: {
        type: "MeshBasicMaterial",
        color: sphere.material.color.getHex(),
      },
    },
  };
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

  // Array to store cubes that need to be removed
  const cubesToRemove = [];

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
  });

  console.log(`Removed ${cubesToRemove.length} empty cubes`);

  // render();
  markNeedsRender();
}

// ---------------- CREATING ----------------------------------------

// Helper function to check if two objects are approximately equal
function approxEqual(obj1, obj2, epsilon = 0.001) {
  if (typeof obj1 !== typeof obj2) return false;
  if (typeof obj1 !== "object") return Math.abs(obj1 - obj2) < epsilon;
  for (let key in obj1) {
    if (!approxEqual(obj1[key], obj2[key], epsilon)) return false;
  }
  return true;
}

// export function initializeReactiveGraph() {
//   if (!scene || !camera || !renderer || !controls) {
//     console.error(
//       "Three.js setup is not complete. Make sure to call setupScene() first."
//     );
//     return;
//   }

//   // Set up the reaction to update the graph when the MobX store changes
//   const disposeReaction = reaction(
//     () => graphStore.snapshot,
//     (snapshot) => efficientGraphUpdate(snapshot),
//     { fireImmediately: true }
//   );

//   // Return a cleanup function
//   return () => {
//     disposeReaction();
//     // Add any other cleanup logic here if needed
//   };
// }

// export function efficientGraphUpdate(snapshot) {
//   const existingObjects = new Map();
//   scene.traverse((object) => {
//     if (object.userData.id) {
//       existingObjects.set(object.userData.id, object);
//     }
//   });

//   // Update or create boxes
//   snapshot.boxes.forEach((box) => {
//     let cube = existingObjects.get(box.id);
//     if (!cube) {
//       cube = createWireframeCube(
//         box.size || 1,
//         box.position.x,
//         box.position.y,
//         box.position.z,
//         box.color || 0xffffff,
//         box.id
//       );
//       // scene.add(cube.wireframeCube);
//       // scene.add(cube.solidCube);
//     } else {
//       // Update existing cube properties if changed
//       if (!approxEqual(cube.wireframeCube.position, box.position)) {
//         cube.wireframeCube.position.set(
//           box.position.x,
//           box.position.y,
//           box.position.z
//         );
//         cube.solidCube.position.set(
//           box.position.x,
//           box.position.y,
//           box.position.z
//         );
//       }
//       if (!approxEqual(cube.wireframeCube.scale, box.scale)) {
//         cube.wireframeCube.scale.set(box.scale.x, box.scale.y, box.scale.z);
//         cube.solidCube.scale.set(box.scale.x, box.scale.y, box.scale.z);
//       }
//       if (cube.wireframeCube.material.color.getHex() !== box.color) {
//         cube.wireframeCube.material.color.setHex(box.color);
//         cube.solidCube.material.color.setHex(box.color);
//       }
//     }
//     existingObjects.delete(box.id);
//   });

//   // Update or create spheres
//   snapshot.objects.forEach((obj) => {
//     if (obj.type === "IcosahedronGeometry" || obj.type === "SphereGeometry") {
//       let sphere = existingObjects.get(obj.id);
//       if (!sphere) {
//         sphere = createSphere(
//           obj.position.x,
//           obj.position.y,
//           obj.position.z,
//           obj.scale.x * 20,
//           obj.id
//         );
//         // scene.add(sphere);
//       } else {
//         // Update existing sphere properties if changed
//         if (!approxEqual(sphere.position, obj.position)) {
//           sphere.position.set(obj.position.x, obj.position.y, obj.position.z);
//         }
//         if (!approxEqual(sphere.scale, obj.scale)) {
//           sphere.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
//         }
//         if (sphere.material.color.getHex() !== obj.color) {
//           sphere.material.color.setHex(obj.color);
//         }
//       }
//       existingObjects.delete(obj.id);
//     }
//   });

//   // Remove objects that no longer exist in the snapshot
//   existingObjects.forEach((object) => {
//     scene.remove(object);
//     if (object.material) object.material.dispose();
//     if (object.geometry) object.geometry.dispose();
//   });

//   // Update containment relationships (if needed)
//   // ... (implement containment logic here)

//   // render();
//   markNeedsRender();
// }
export function reconstructScene(snapshot) {
  console.log("Reconstructing scene with snapshot:", snapshot);

  const existingObjects = new Map();
  let sceneObjectCount = 0;
  let nonBloomSceneObjectCount = 0;

  // Collect existing objects
  scene.traverse((object) => {
    if (object.userData.id) {
      existingObjects.set(object.userData.id, { object, inScene: true });
      sceneObjectCount++;
    }
  });
  nonBloomScene.traverse((object) => {
    if (object.userData.id) {
      existingObjects.set(object.userData.id, { object, inScene: false });
      nonBloomSceneObjectCount++;
    }
  });

  console.log(`Existing objects before reconstruction: ${existingObjects.size}`);
  console.log(`Scene object count: ${sceneObjectCount}`);
  console.log(`Non-bloom scene object count: ${nonBloomSceneObjectCount}`);

  // Remove all existing objects
  existingObjects.forEach((entry, id) => {
    console.log(`Removing existing object: ${id}`);
    if (entry.inScene) {
      scene.remove(entry.object);
    } else {
      nonBloomScene.remove(entry.object);
    }
    if (entry.object.material) entry.object.material.dispose();
    if (entry.object.geometry) entry.object.geometry.dispose();
  });

  // Recreate objects from snapshot
  snapshot.forEach((objectState) => {
    console.log(`Creating/Recreating object: ${objectState.id}, Type: ${objectState.type}`);
    if (objectState.type === "cube") {
      const { wireframeCube, solidCube } = createWireframeCube(
        objectState.size,
        objectState.position[0],
        objectState.position[1],
        objectState.position[2],
        objectState.color,
        objectState.id
      );
      console.log(`Created cube: ${objectState.id}`);
    } else if (objectState.type === "sphere") {
      const { sphere } = createSphere(
        objectState.position[0],
        objectState.position[1],
        objectState.position[2],
        objectState.scale[0] * 20,
        objectState.id,
        objectState.color
      );
      console.log(`Created sphere: ${objectState.id}`);
    } else {
      console.warn(`Unknown object type: ${objectState.type}`);
    }
  });

  sceneObjectCount = 0;
  nonBloomSceneObjectCount = 0;
  scene.traverse((object) => {
    if (object.userData.id) sceneObjectCount++;
  });
  nonBloomScene.traverse((object) => {
    if (object.userData.id) nonBloomSceneObjectCount++;
  });

  console.log("Scene reconstruction complete.");
  console.log(`Final scene object count: ${sceneObjectCount}`);
  console.log(`Final non-bloom scene object count: ${nonBloomSceneObjectCount}`);

  markNeedsRender();
  requestAnimationFrame(() => {
    render();
    console.log("Render complete.");
  });
}