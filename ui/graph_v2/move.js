// move.js

import {
  createSphere,
  share3dDat,
  createWireframeCube,
  removeEmptyCubes,
  markNeedsRender,
  randomColorGenerator,
  removeGhostCube,
  createGhostCube,
  BLOOM_SCENE
} from "./create.js";
import {
  createSceneSnapshot,
  getObjectById,
  getCubeContainingSphere,
} from "./snapshot";
import { handleFileDrop } from "../../memory/fileHandler.js";
import * as THREE from "three";
import { convertToThreeJSFormat, throttle, generateUniqueId } from "../../utils/utils";
import { diffSceneChanges } from "../../memory/collaboration/scene_colab";
import { updateConnectedLines } from "./lineGraphs.js";
// import { runOverallDebug } from "./sceneDebug.js";
import {filterDuplicateFiles, FileHashTracker } from '../../utils/file_hash.js'

let isDragging = false;
// let isClicking = false;
let selectedSphere = null;
let CUBEINTERSECTED;
// const cubeGroups = new Map(); // Map of cube UUIDs to arrays of spheres inside them
let selectedObject = null;
let currentSnapshot = null;
// const BLOOM_SCENE = 1;
let isFileDragging = false;
// const SCALEFACTOR = 0.05;
const RESCALEFACTOR = 10;
let initialPointerPosition = { x: 0, y: 0 };
// let initialPointerTime = 0;
// const DRAG_THRESHOLD = 5; // Adjust this value as needed
const DRAG_THRESHOLD = 10; // Increase from 5 to 10 pixels

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectPoint = new THREE.Vector3();
const planeNormal = new THREE.Vector3();
const plane = new THREE.Plane();
const loginName = localStorage.getItem("login_block") || "no_login";

setupDragAndDrop();

function getCubeUnderPointer(event, intersects) {
  const { camera, scene, nonBloomScene, controls, renderer } = share3dDat();
  // Update mouse position
  // mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  // mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Calculate mouse position relative to the canvas
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  // Cast a ray from the camera to the mouse position
  raycaster.setFromCamera(mouse, camera);

  if (intersects.length > 0) {
    currentSnapshot = createSceneSnapshot([scene, nonBloomScene]);

    for (const intersectedObject of intersects) {
      let matchingBox = currentSnapshot.boxes.find(
        (box) =>
          box.wireframe.uuid === intersectedObject.object.uuid ||
          box.solid.uuid === intersectedObject.object.uuid
      );

      // If we found a solid cube (ending with '-solid'), find its wireframe twin
      if (matchingBox && matchingBox.id.endsWith("-solid")) {
        const wireframeId = matchingBox.id.replace("-solid", "");
        matchingBox =
          currentSnapshot.boxes.find((box) => box.id === wireframeId) ||
          matchingBox;
      }

      if (matchingBox) {
        controls.enabled = false; // Disable OrbitControls during dragging

        // Ensure both wireframe and solid cubes are returned
        const wireframeCube =
          matchingBox.wireframe ||
          currentSnapshot.boxes.find(
            (box) => box.id === matchingBox.id + "-solid"
          )?.wireframe ||
          null;
        const solidCube =
          matchingBox.solid ||
          currentSnapshot.boxes.find(
            (box) => box.id === matchingBox.id.replace("-solid", "")
          )?.solid ||
          null;

        return {
          wireframeCube,
          solidCube,
          containedSpheres:
            currentSnapshot.containment[matchingBox.id]?.map((id) =>
              getObjectById(currentSnapshot, id)
            ) || [],
        };
      }
    }
  }
  return null; // Return null if no cube is found
}

// Define a global drag plane (e.g., XZ-plane)
const globalDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Y-up plane

export function dragCube() {
  const { camera, raycaster } = share3dDat();
  if (!selectedObject || !selectedObject.wireframeCube) return;

  // Store the initial position of the wireframe cube
  const initialPosition = selectedObject.wireframeCube.position.clone();

  // Update the raycaster with the current mouse position
  raycaster.setFromCamera(mouse, camera);

  // Calculate the intersection point with the global drag plane
  const intersectionPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(globalDragPlane, intersectionPoint);

  if (previousIntersectPoint === undefined) {
    previousIntersectPoint = intersectionPoint.clone();
  }

  // Calculate the movement delta based on the change in intersect point
  const movementDelta = new THREE.Vector3().subVectors(
    intersectionPoint,
    previousIntersectPoint
  );

  // Move the wireframe and solid cubes
  selectedObject.wireframeCube.position.add(movementDelta);
  selectedObject.solidCube.position.copy(selectedObject.wireframeCube.position);

  // Calculate the actual movement of the cube
  const actualMovement = new THREE.Vector3().subVectors(
    selectedObject.wireframeCube.position,
    initialPosition
  );

  // Move all spheres inside this cube
  selectedObject.containedSpheres.forEach((sphere) => {
    sphere.object.position.add(actualMovement);
    // Update the position in the selectedObject
    sphere.position = sphere.object.position.toArray();
  });

  // Update the previous intersect point for the next drag event
  previousIntersectPoint.copy(intersectionPoint);

  markNeedsRender();

  // Return the actual movement for synchronization purposes
  return actualMovement;
}

export function labelListerners(labelDiv, sphere) {
  const { controls } = share3dDat();


  labelDiv.style.pointerEvents = "none";
}

function highlightCube(cube) {
  if (CUBEINTERSECTED !== cube) {
    resetCubeHighlight();
    CUBEINTERSECTED = cube;
  }

  if (!cube.originalMaterial) {
    cube.originalMaterial = cube.material.clone();
  }

  cube.material = new THREE.MeshBasicMaterial({
    color: 0x39ff14, // Bright green
    transparent: true,
    opacity: 0.8,
  });
  cube.material.needsUpdate = true;
  // render();
  markNeedsRender();
}
export function getObjectUnderPointer(event, objectType = "") {
  const { camera, scene, nonBloomScene, renderer } = share3dDat();
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Calculate mouse position relative to the canvas
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  // Cast a ray from the camera to the mouse position
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  // Check for intersections in both scenes
  const intersects = raycaster.intersectObjects(
    [...scene.children, ...nonBloomScene.children],
    true
  );

  if (intersects.length === 0) return null;

  if (objectType) {
    // Look for a specific object type
    const found = intersects.find((intersect) => {
      if (objectType.toLowerCase() === "sphere") {
        return (
          intersect.object.geometry instanceof THREE.IcosahedronGeometry ||
          intersect.object.geometry instanceof THREE.SphereGeometry
        );
      }
      return intersect.object.type === objectType;
    });

    if (found) {
      return found.object;
    } else {
      return null;
    }
  }

  // If no specific object type is requested, return the first intersected object
  return intersects[0].object;
}

export function moveSphere(event, sphere, intersectPointIn = null) {
  const { camera, renderer } = share3dDat();
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Calculate mouse position relative to the canvas
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const targetSphere = sphere || selectedSphere;

  if (!targetSphere) return;

  // Store the original distance from the camera
  const originalDistance = camera.position.distanceTo(targetSphere.position);

  planeNormal.set(0, 0, 1).applyQuaternion(camera.quaternion);
  plane.setFromNormalAndCoplanarPoint(planeNormal, targetSphere.position);

  let newIntersectPoint = intersectPointIn || intersectPoint; //new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, newIntersectPoint);

  // Move the sphere to the new position
  targetSphere.position.copy(newIntersectPoint);

  // Calculate the new distance from the camera
  const newDistance = camera.position.distanceTo(targetSphere.position);

  // Adjust the scale to maintain apparent size
  const scaleFactor = newDistance / originalDistance;
  targetSphere.scale.multiplyScalar(scaleFactor);

  updateConnectedLines();
  // handleFileDragOver(event);
  // render();
  markNeedsRender();
}

function normalizeSize(fileSize) {
  const maxSize = 10;
  const minSize = 1;
  return (
    (Math.log(fileSize + 1) / Math.log(1024)) * (maxSize - minSize) + minSize
  );
}

export function checkIntersections(raycaster, scenes) {
  let allIntersects = [];

  scenes.forEach((scene) => {
    const intersects = raycaster.intersectObjects(scene.children, false);
    allIntersects = [...allIntersects, ...intersects];
  });

  allIntersects.sort((a, b) => a.distance - b.distance);

  return allIntersects;
}

function handleFileDragOver(
  event,
  allIntersectsN = undefined
  // foundSpheres = undefined
) {
  const { camera, scene, nonBloomScene, renderer } = share3dDat();
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Calculate mouse position relative to the canvas
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const allIntersects =
    allIntersectsN || checkIntersections(raycaster, [scene, nonBloomScene]);
  const solidCubeIntersect = allIntersects.find(
    (intersect) => intersect.object.geometry.type === "BoxGeometry"
  );

  const sphereIntersect = allIntersects.find(
    (intersect) => intersect.object.geometry.type === "IcosahedronGeometry"
  );
  if (sphereIntersect) {
    const intersectedSphere = sphereIntersect.object;
    const containingCube = getCubeContainingSphere(intersectedSphere);
    const sphereRadius = intersectedSphere.geometry.parameters.radius;
    const cubeSize = containingCube ? containingCube.scale.x : sphereRadius * 4;

    createGhostCube(intersectedSphere.position, cubeSize, containingCube);
  } else {
    removeGhostCube();
  }

  if (solidCubeIntersect) {
    highlightCube(solidCubeIntersect.object);
  } else {
    resetCubeHighlight();
  }
  markNeedsRender();
}

function resetCubeHighlight() {
  if (CUBEINTERSECTED) {
    if (CUBEINTERSECTED.originalMaterial) {
      CUBEINTERSECTED.material = CUBEINTERSECTED.originalMaterial;
      CUBEINTERSECTED.material.needsUpdate = true;
    }
    CUBEINTERSECTED = null;
    // render();
    markNeedsRender();
  }
}

// async function handleFileDrop_sphere(event) {
//   // If this is a custom event from tab drop, use the detail
//   const processEvent = event.detail || event;
  
//   isFileDragging = false;
//   resetCubeHighlight();
//   const { camera, scene, nonBloomScene, renderer } = share3dDat();

//   const dt = processEvent.dataTransfer;
//   const fileList = dt?.files;

//   // Check for duplicates before processing
//   const { filteredFiles, duplicates } = await filterDuplicateFiles(fileList);
  
//   // If there were duplicates, notify the user
//   if (duplicates.length > 0) {
//       duplicates.forEach(({ file, original }) => {
//           console.warn(`Duplicate file rejected: ${file.name} (Original: ${original.filename})`);
//       });
//   }

//   // Update the dataTransfer with filtered files
//   if (processEvent.dataTransfer) {
//       processEvent.dataTransfer.files = filteredFiles;
//   }

//   // Continue with existing logic using filtered files
//   const { fileIds, fileNames, fileEntries } = handleFileDrop(processEvent);

//   // Rest of your existing code remains exactly the same
//   console.log('fileIds:', filteredFiles, fileIds);

//   const canvas = renderer.domElement;
//   const rect = canvas.getBoundingClientRect();

//   mouse.x = ((processEvent.clientX - rect.left) / rect.width) * 2 - 1;
//   mouse.y = -((processEvent.clientY - rect.top) / rect.height) * 2 + 1;
//   raycaster.setFromCamera(mouse, camera);

//   let createdShapes = [];
//   const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);

//   if (filteredFiles) {
//     for (let i = 0; i < filteredFiles.length; i++) {
//       const file = fileList[i];
//       const fileId = fileIds[i] || generateUniqueId();
//       const size = normalizeSize(file.size);

//       if (allIntersects.length > 0) {
//         const intersect = allIntersects[0];
//         const dropPosition = intersect.point;

//         const sphereData = convertToThreeJSFormat({
//           position: [dropPosition.x, dropPosition.y, dropPosition.z],
//           size: size,
//           userData: { 
//             id: fileId,
//             filename: file.name,
//             isTab: !!processEvent.tabId,
//             content: processEvent.source?.data?.content
//           },
//           color: randomColorGenerator(),
//           lastEditedBy: loginName,
//         });

//         createdShapes.push(createSphere(sphereData));
//       } else {
//         // Handle drop in empty space
//         planeNormal.copy(camera.getWorldDirection(new THREE.Vector3()));
//         const distance = 40;
//         const planePoint = camera.position
//           .clone()
//           .add(planeNormal.clone().multiplyScalar(distance));
//         plane.setFromNormalAndCoplanarPoint(planeNormal, planePoint);
//         raycaster.ray.intersectPlane(plane, intersectPoint);

//         const sphereData = convertToThreeJSFormat({
//           position: [intersectPoint.x, intersectPoint.y, intersectPoint.z],
//           size: size,
//           userData: { 
//             id: fileId,
//             filename: file.name,
//             isTab: !!processEvent.tabId,
//             content: processEvent.source?.data?.content
//           },
//           color: randomColorGenerator(),
//           lastEditedBy: loginName,
//         });

//         createdShapes.push(createSphere(sphereData));
//       }
//     }
//   }

//   // Reset cube highlighting
//   if (CUBEINTERSECTED) {
//     resetCubeColor(CUBEINTERSECTED);
//     CUBEINTERSECTED = null;
//   }
// }
function createFilteredDataTransfer(validFiles) {
  const newDataTransfer = new DataTransfer();
  validFiles.forEach(file => newDataTransfer.items.add(file));
  return newDataTransfer;
}
function createFilteredEvent(originalEvent, validFiles) {
  // Create new DataTransfer with only valid files
  const newDataTransfer = new DataTransfer();
  validFiles.forEach(file => newDataTransfer.items.add(file));

  // Create a proxy event that preserves all original event methods and properties
  return new Proxy(originalEvent, {
      get: (target, prop) => {
          if (prop === 'dataTransfer') {
              return newDataTransfer;
          }
          // Preserve original methods and properties
          return typeof target[prop] === 'function'
              ? target[prop].bind(target)  // Bind methods to original event
              : target[prop];              // Return original properties
      }
  });
}

async function handleFileDrop_sphere(event) {
  const processEvent = event.detail || event;
  
  isFileDragging = false;
  resetCubeHighlight();
  const { camera, scene, nonBloomScene, renderer } = share3dDat();

  const dt = processEvent.dataTransfer;
  const fileList = dt?.files;

  // This is now a synchronous operation
  const { validFiles, duplicates } = filterDuplicateFiles(fileList);
  
  if (duplicates.length > 0) {
      duplicates.forEach(({ file }) => {
          console.warn(`Duplicate file rejected: ${file.name}`);
      });
  }

  if(validFiles.length === 0) {
      console.warn("No valid files to process.");
      return;
  }

  // Create filtered event that preserves all original event functionality
  const filteredEvent = createFilteredEvent(processEvent, validFiles);

  // Process only valid files
  const { fileIds, fileNames, fileEntries } = handleFileDrop(filteredEvent);

  console.log("fileIds, fileNames, fileEntries", fileIds, fileNames, fileEntries)
  // Rest of your code remains exactly the same...
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  mouse.x = ((processEvent.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((processEvent.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  let createdShapes = [];
  const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);

  if (validFiles.length > 0) {
      for (let i = 0; i < validFiles.length; i++) {
          const file = validFiles[i];
          const fileId = fileIds[i] || generateUniqueId();
          const size = normalizeSize(file.size);

          if (allIntersects.length > 0) {
              const intersect = allIntersects[0];
              const dropPosition = intersect.point;

              const sphereData = convertToThreeJSFormat({
                  position: [dropPosition.x, dropPosition.y, dropPosition.z],
                  size: size,
                  userData: { 
                      id: fileId,
                      filename: file.name,
                      isTab: !!processEvent.tabId,
                      content: processEvent.source?.data?.content
                  },
                  color: randomColorGenerator(),
                  lastEditedBy: loginName,
              });

              createdShapes.push(createSphere(sphereData));
          } else {
              // Handle drop in empty space
              planeNormal.copy(camera.getWorldDirection(new THREE.Vector3()));
              const distance = 40;
              const planePoint = camera.position
                  .clone()
                  .add(planeNormal.clone().multiplyScalar(distance));
              plane.setFromNormalAndCoplanarPoint(planeNormal, planePoint);
              raycaster.ray.intersectPlane(plane, intersectPoint);

              const sphereData = convertToThreeJSFormat({
                  position: [intersectPoint.x, intersectPoint.y, intersectPoint.z],
                  size: size,
                  userData: { 
                      id: fileId,
                      filename: file.name,
                      isTab: !!processEvent.tabId,
                      content: processEvent.source?.data?.content
                  },
                  color: randomColorGenerator(),
                  lastEditedBy: loginName,
              });

              createdShapes.push(createSphere(sphereData));
          }
      }
  }

  // Reset cube highlighting
  if (CUBEINTERSECTED) {
      resetCubeColor(CUBEINTERSECTED);
      CUBEINTERSECTED = null;
  }
}

function resetCubeColor(cube) {
  if (cube && cube.originalMaterial) {
    cube.material = cube.originalMaterial;
    cube.material.needsUpdate = true;
  }
}


function setupDragAndDrop() {
  const { renderer } = share3dDat(); // Access the renderer to get the canvas
  const canvas = renderer.domElement;

  canvas.addEventListener("dragenter", (event) => {
    event.preventDefault();
    isFileDragging = true;
    isDragging = true;
  });

  canvas.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (isFileDragging) {
      handleFileDragOver(event);
    }
  });

  canvas.addEventListener("drop", (event) => {
    event.preventDefault();
    // tabDrop(event);
    handleFileDrop_sphere(event);
    removeGhostCube();
    onPointerUp(event);
  });

  canvas.addEventListener("dragleave", (event) => {
    event.preventDefault();
    isFileDragging = false;
    resetCubeHighlight();
    removeGhostCube();
  });
  canvas.addEventListener('tabDrop', dropExporter);
}

export function dropExporter(event) {
  // Handle both regular events and custom events with detail
  const processEvent = event.detail || event;
  
  handleFileDrop_sphere(processEvent);
  removeGhostCube();
  onPointerUp(processEvent);
}


let clickStartTime = 0;
// const CLICK_DURATION_THRESHOLD = 200; // milliseconds
const CLICK_DURATION_THRESHOLD = 300;

function isAllowed(event) {
  // First check if event exists
  if (!event) {
    return false;
  }

  // Safely check for target and its properties
  const target = event.target || event.srcElement;
  if (!target) {
    return true; // Allow the event if there's no specific target
  }

  // Helper function to safely check closest
  const isClosestTo = (element, selector) => {
    try {
      return element.closest && element.closest(selector);
    } catch (e) {
      return false;
    }
  };

  // Check for UI elements that should be excluded
  const isUIElement = 
    isClosestTo(target, '.modal') ||
    isClosestTo(target, '.p2p_peer_input') ||
    target.id === 'connectButton' ||
    target.id === 'userIdInput' ||
    target.id === 'peerIdInput';

  if (isUIElement) {
    console.log("Event blocked for UI element");
    return false;
  }

  // Special handling for drag and drop events
  if (event.type === 'drop' || event.type === 'dragover' || event.type === 'dragenter') {
    return true;
  }

  return true;
}
// In move.js, modify the onPointerDown function:
export function onPointerDown(event) {
  if (!isAllowed(event)){
    return
  }


  const { mouse, raycaster, renderer, scene, nonBloomScene, camera, controls } =
    share3dDat();
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Ensure the camera can see all layers
  camera.layers.set(0);
  camera.layers.enable(BLOOM_SCENE);

  raycaster.setFromCamera(mouse, camera);

  // Check intersections for both scenes
  const intersectsBloom = raycaster.intersectObjects(scene.children, true);
  const intersectsNonBloom = raycaster.intersectObjects(
    nonBloomScene.children,
    true
  );

  console.log("Bloom intersects:", intersectsBloom);
  console.log("Non-bloom intersects:", intersectsNonBloom);

  initialPointerPosition = { x: event.clientX, y: event.clientY };
  clickStartTime = Date.now();
  isDragging = false;

  const sphereIntersect = intersectsBloom.find(
    (intersect) =>
      intersect.object.geometry instanceof THREE.IcosahedronGeometry ||
      intersect.object.geometry instanceof THREE.SphereGeometry
  );

  if (sphereIntersect) {
    console.log("Sphere selected:", sphereIntersect.object);
    controls.enabled = false;
    selectedSphere = sphereIntersect.object;
    selectedObject = selectedSphere;

    // Log sphere layers before toggle
    console.log("Sphere layers before toggle:", selectedSphere.layers.mask);

    // Toggle bloom on click, but keep the sphere in both layers
    // if (selectedSphere.layers.test(BLOOM_SCENE)) {
    //   selectedSphere.layers.disable(BLOOM_SCENE);
    // } else {
    //   selectedSphere.layers.enable(BLOOM_SCENE);
    // }
    // // Ensure the sphere is always in the default layer (0)
    // selectedSphere.layers.enable(0);

    
    console.log("Sphere layers before toggle:", selectedSphere.layers.mask);
    // toggleBloom(selectedSphere);
    console.log("Sphere layers after toggle:", selectedSphere.layers.mask)

    console.log("Sphere layers after toggle:", selectedSphere.layers.mask);
    markNeedsRender();
  } else if (intersectsNonBloom.length > 0) {
    const selectedCube = getCubeUnderPointer(event, intersectsNonBloom);
    if (selectedCube) {
      console.log("Cube selected:", selectedCube);
      controls.enabled = false;
      selectedObject = selectedCube;

      // Initialize the previousIntersectPoint for cube dragging
      plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
        selectedObject.wireframeCube.position
      );
      raycaster.ray.intersectPlane(plane, previousIntersectPoint);
    }
  } else {
    console.log("No object selected");
    controls.enabled = true;
    selectedSphere = null;
    selectedObject = null;
  }

  event.target.setPointerCapture(event.pointerId);
  markNeedsRender();
}
// Make sure to declare previousIntersectPoint at the top of your file
let previousIntersectPoint = new THREE.Vector3();

function getRandomOffset(cubeSize) {
  const maxOffset = cubeSize / 4; // Adjust this value to control the offset range
  const offsetX = (Math.random() - 0.5) * maxOffset;
  const offsetY = (Math.random() - 0.5) * maxOffset;
  const offsetZ = (Math.random() - 0.5) * maxOffset;
  return new THREE.Vector3(offsetX, offsetY, offsetZ);
}
function toggleBloom(object) {

  let isBloomEnabled = object.layers.test(BLOOM_SCENE);

  
  console.log("i have toggleBloom PRE", isBloomEnabled)

  object.layers.toggle(BLOOM_SCENE);
  
  isBloomEnabled = object.layers.test(BLOOM_SCENE);

  console.log("i have toggleBloom POST", isBloomEnabled)
  
  // Update selection state
  object.userData.selected = isBloomEnabled ? 1 : 0;
  
  // Update global selection tracking KAI CHECK this!!
  
  markNeedsRender();
}
// Update the onPointerUp function to use this new handleSphereDragEnd
async function onPointerUp(event) {
  if (!isAllowed(event)){
    return
  }

  const { controls, scene, nonBloomScene, ghostCube, sceneSnapshot } =
    share3dDat();
  controls.enabled = true;
  const clickDuration = Date.now() - clickStartTime;

  // Calculate total movement
  const deltaX = event.clientX - initialPointerPosition.x;
  const deltaY = event.clientY - initialPointerPosition.y;
  const distanceMoved = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  const isClick =
    !isDragging &&
    distanceMoved < DRAG_THRESHOLD &&
    clickDuration < CLICK_DURATION_THRESHOLD;


  if (isClick && selectedSphere) {
    toggleBloom(selectedSphere);
    console.log("After toggling, layers.mask:", selectedSphere.layers.mask);
  } else if (isDragging || isFileDragging) {
    isDragging = false;
    isFileDragging = false;

    if (selectedSphere) {
      handleSphereDragEnd(selectedSphere, ghostCube);
    }

    cleanupOldCubes();
    resetCubeHighlight();
    diffSceneChanges(scene, nonBloomScene, sceneSnapshot);
  }

  if (event.pointerId !== undefined && event.target?.hasPointerCapture) {
    try {
      if (event.target.hasPointerCapture(event.pointerId)) {
        event.target.releasePointerCapture(event.pointerId);
      }
    } catch (err) {
      console.log("Could not release pointer capture:", err);
    }
  }

  controls.enabled = true;
  isDragging = false;
  selectedSphere = null;
  selectedObject = null;
  currentSnapshot = null;
}
function handleSphereDragEnd(sphere, ghostCube) {
  const sphereRadius = sphere.scale.x / 2 || sphere.geometry.parameters.radius;

  if (ghostCube) {
    if (ghostCube.existingCube) {
      // Handle adding sphere to existing cube
      const existingCube = ghostCube.existingCube;
      const cubeSize = existingCube.scale.x;
      const cubePosition = existingCube.position.clone();

      const offset = getRandomOffset(cubeSize, sphereRadius);
      sphere.position.copy(cubePosition.clone().add(offset));

      // Resize the existing cube to fit the new sphere
    } else {
      // Create a new cube to contain the sphere
      const cubeSize = sphereRadius * RESCALEFACTOR;
      const cubePosition = ghostCube.position.clone();
      const cubeColor = ghostCube.material.color.clone();

      const cubeData = convertToThreeJSFormat({
        position: cubePosition.toArray(),
        size: cubeSize,
        color: cubeColor.getHex(),
        userData: { id: `cube_${Date.now()}` },
        lastEditedBy: loginName,
      });
      createWireframeCube(cubeData);

      const offset = getRandomOffset(cubeSize, sphereRadius);
      sphere.position.copy(cubePosition.clone().add(offset));
    }

    // Remove the ghost cube after handling the sphere
    removeGhostCube();
  }

  // Update any necessary scene information
  markNeedsRender();
}

const onPointerMove = (event) => {
  const { controls, camera, scene, nonBloomScene } = share3dDat();
  if (!selectedSphere && !selectedObject) return;
  const deltaX = event.clientX - initialPointerPosition.x;
  const deltaY = event.clientY - initialPointerPosition.y;
  const distanceMoved = Math.sqrt(deltaX * deltaX + deltaY * deltaY);


  if (distanceMoved > DRAG_THRESHOLD) {
    isDragging = true;
    // isClicking = false; // No longer a click, it's a drag
    controls.enabled = false; // Disable controls during drag
  }

  if (isDragging) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -((event.clientY / window.innerHeight) * 2) + 1;
    raycaster.setFromCamera(mouse, camera);

    if (selectedSphere) {
      moveSphere(event);

      const intersects = checkIntersections(raycaster, [scene, nonBloomScene]);

      const sphereIntersect = intersects.find((intersect) => {
        return (
          intersect.object.geometry.type === "IcosahedronGeometry" &&
          intersect.object !== selectedSphere
        );
      });

      if (sphereIntersect) {
        const intersectedSphere = sphereIntersect.object;

        // Check if the intersected sphere is inside a cube
        const containingCube = getCubeContainingSphere(intersectedSphere);

        const sphereRadius = intersectedSphere.geometry.parameters.radius;
        const cubeSize = containingCube
          ? containingCube.scale.x
          : sphereRadius * 2;

        // Create ghost cube, passing the existing cube if found
        createGhostCube(intersectedSphere.position, cubeSize, containingCube);
      } else {
        removeGhostCube();
      }
    } else if (selectedObject) {
      // Existing code for dragging cubes
      plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
        new THREE.Vector3()
      );
      raycaster.ray.intersectPlane(plane, intersectPoint);
      dragCube();
    }

    markNeedsRender();
  }
};

function cleanupOldCubes() {
  const { scene, nonBloomScene } = share3dDat();

  // Force update of matrices
  scene.updateMatrixWorld(true);
  nonBloomScene.updateMatrixWorld(true);

  const cubesToDelete = removeEmptyCubes(scene, nonBloomScene);

  cubesToDelete?.forEach((cube) => {
    if (!cube.wireframe) return;
    cube.wireframe.isDeleted = true;
    cube.solid.isDeleted = true;
  });
}

function setupPointerEvents() {
  const { renderer } = share3dDat(); // Access the renderer to get the canvas
  const canvas = renderer.domElement;

  canvas.addEventListener("pointerdown", onPointerDown);

  // canvas.addEventListener("pointermove", throttle(onPointerMove, 100));
  const throttleTime = window.matchMedia("(max-width: 600px)").matches
    ? 33
    : 16;
  canvas.addEventListener("pointermove", throttle(onPointerMove, throttleTime));
  canvas.addEventListener("pointerup", onPointerUp);
}

setupPointerEvents();
window.handleFileDrop_sphere = handleFileDrop_sphere;
window.removeGhostCube = removeGhostCube;
window.onPointerUp = onPointerUp;