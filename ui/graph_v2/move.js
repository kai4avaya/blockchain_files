import {
  createSphere,
  share3dDat,
  createWireframeCube,
  removeEmptyCubes,
  markNeedsRender,
  randomColorGenerator,
  removeGhostCube,
  createGhostCube,
} from "./create.js";
import {
  createSceneSnapshot,
  getObjectById,
  getCubeContainingSphere,
  // findSpheresInCube,
} from "./snapshot";
import { handleFileDrop } from "../../memory/fileHandler.js";
import * as THREE from "three";
import { convertToThreeJSFormat } from "../../utils/utils";
import { diffSceneChanges } from "../../memory/collaboration/scene_colab";

let isDragging = false;
// let isClicking = false;
let selectedSphere = null;
let CUBEINTERSECTED;
// const cubeGroups = new Map(); // Map of cube UUIDs to arrays of spheres inside them
let selectedObject = null;
let currentSnapshot = null;
const BLOOM_SCENE = 1;
let isFileDragging = false;
// const SCALEFACTOR = 0.05;
const RESCALEFACTOR = 10;
let initialPointerPosition = { x: 0, y: 0 };
// let initialPointerTime = 0;
const DRAG_THRESHOLD = 5; // Adjust this value as needed

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


// // Define a global drag plane (e.g., XZ-plane)
// const globalDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Y-up plane


// export function dragCube() {
//   if (!selectedObject || !selectedObject.wireframeCube) return;

//   // Store the initial position of the wireframe cube
//   const initialPosition = selectedObject.wireframeCube.position.clone();

//   // Calculate the movement delta based on the change in intersect point
//   const movementDelta = new THREE.Vector3().subVectors(
//     intersectPoint,
//     previousIntersectPoint
//   );

//   // Move the wireframe and solid cubes
//   selectedObject.wireframeCube.position.add(movementDelta);
//   selectedObject.solidCube.position.copy(selectedObject.wireframeCube.position);

//   // Calculate the actual movement of the cube
//   const actualMovement = new THREE.Vector3().subVectors(
//     selectedObject.wireframeCube.position,
//     initialPosition
//   );

//   // Move all spheres inside this cube
//   selectedObject.containedSpheres.forEach((sphere) => {
//     sphere.object.position.add(actualMovement);
//     // Update the position in the selectedObject
//     sphere.position = sphere.object.position.toArray();
//   });

//   // Update the previous intersect point for the next drag event
//   previousIntersectPoint.copy(intersectPoint);

//   markNeedsRender();
// }

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
  allIntersectsN = undefined,
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
   function handleFileDrop_sphere(event) {

  isFileDragging = false;
  resetCubeHighlight();
  const { camera, scene, nonBloomScene, renderer } = share3dDat();

  const dt = event.dataTransfer;
  const fileList = dt?.files;

  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Calculate mouse position relative to the canvas
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  let createdShapes = [];

  const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);
  let dataObject = {};

  const firstSphereIntersect = allIntersects.find(
    (intersect) => intersect.object.geometry.type === "IcosahedronGeometry"
  );

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const size = normalizeSize(file.size);
    const fileIds = handleFileDrop(event);

    if (allIntersects.length > 0) {
      const intersect = allIntersects[0];
      const dropPosition = intersect.point;

      const sphereData = convertToThreeJSFormat({
        position: [dropPosition.x, dropPosition.y, dropPosition.z],
        size: size,
        userData: { id: fileIds[i] },
        color: randomColorGenerator(),
        lastEditedBy: loginName,
      });

      if (firstSphereIntersect) {
        const intersectedSphere = firstSphereIntersect.object;

        // Check if there's already a cube over this sphere
        const existingCube = getCubeContainingSphere(intersectedSphere);

        if (!existingCube) {
          const createdSphere = createSphere(sphereData);
          createdShapes.push(createdSphere);

          // Create cube with a size relative to the sphere
          const cubeSize = size; // * RESCALEFACTOR * SCALEFACTOR; // Adjust this factor as needed
          const cubeData = convertToThreeJSFormat({
            ...sphereData,
            size: cubeSize,
            position: [dropPosition.x, dropPosition.y, dropPosition.z],
          });
          const createdCube = createWireframeCube(cubeData);
          createdShapes.push(createdCube);
        } else {
        }
      } else {
        // Handle case when object is not a sphere
        createdShapes.push(createSphere(sphereData));
      }
    } else {
      planeNormal.set(0, 0, 1).applyQuaternion(camera.quaternion);
      plane.normal.copy(planeNormal);
      raycaster.ray.intersectPlane(plane, intersectPoint);

      dataObject = convertToThreeJSFormat({
        position: new THREE.Vector3(
          intersectPoint.x,
          intersectPoint.y,
          intersectPoint.z
        ),
        size: size,
        color: randomColorGenerator(),
        userData: { id: fileIds[i] },
        lastEditedBy: loginName,
      });

      createdShapes.push(createSphere(dataObject));
    }
  }

  // Save changes for created shapes
  // createdShapes.forEach((shape) => {
  //   Object.values(shape).forEach((item) => {
  //     if (item && typeof item === "object" && "uuid" in item) {
  //       saveObjectChanges(item);
  //     }
  //   });
  // });

  // Reset cube highlighting after drop
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
  //  setupDragAndDrop2()

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
}

function getObjectType(object) {
  if (!object) return "No object";
  if (!object.geometry) return "No geometry";

  const geometryType = object.geometry.type;

  // Check for specific geometry types
  switch (geometryType) {
    case "IcosahedronGeometry":
    case "SphereGeometry":
      return "Sphere";
    case "BoxGeometry":
      return "Cube";
    default:
      return geometryType;
  }
}

// export function onPointerDown(event) {
//   const { mouse, raycaster, renderer, scene, nonBloomScene, camera, controls } = share3dDat();
//   const canvas = renderer.domElement;
//   const rect = canvas.getBoundingClientRect();

//   // Calculate mouse position relative to the canvas
//   mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
//   mouse.y = -(event.clientY - rect.top) / rect.height * 2 + 1;
//   raycaster.setFromCamera(mouse, camera);
//   const intersectsBloom = raycaster.intersectObjects(scene.children, true);
//   const intersectsNonBloom = raycaster.intersectObjects(nonBloomScene.children, true);

//   // Record initial pointer position and time
//   initialPointerPosition = { x: event.clientX, y: event.clientY };
//   initialPointerTime = Date.now();
//   isDragging = false; // Reset isDragging

//     const sphereIntersect = intersectsBloom.find(
//     (intersect) => getObjectType(intersect.object) === "Sphere"
//   );

//   if (sphereIntersect) {
//     isDragging = true;
//     controls.enabled = false;
//     selectedSphere = sphereIntersect.object;
//     selectedObject = selectedSphere;
//     sphereIntersect.object.layers.toggle(BLOOM_SCENE);
//   } else if(intersectsNonBloom?.length > 0) {

//     const selectedCube = getCubeUnderPointer(event, intersectsNonBloom);
//     if (selectedCube) {
//       isDragging = true;
//       controls.enabled = false;
//       selectedObject = selectedCube;

//       // Initialize the previousIntersectPoint for cube dragging
//       plane.setFromNormalAndCoplanarPoint(
//         new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
//         selectedObject.wireframeCube.position
//       );
//       raycaster.ray.intersectPlane(plane, previousIntersectPoint);
//     }
//   }

//   if (isDragging) {
//     // Prevent default behavior when dragging starts
//     event.preventDefault();
//     event.stopPropagation();
//   }
//   event.target.setPointerCapture(event.pointerId);
//   markNeedsRender();
// }

export function onPointerDown(event) {
  const { mouse, raycaster, renderer, scene, nonBloomScene, camera, controls } =
    share3dDat();
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Calculate mouse position relative to the canvas
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersectsBloom = raycaster.intersectObjects(scene.children, true);
  const intersectsNonBloom = raycaster.intersectObjects(
    nonBloomScene.children,
    true
  );

  // Record initial pointer position and time
  initialPointerPosition = { x: event.clientX, y: event.clientY };
  // initialPointerTime = Date.now();
  isDragging = false; // Reset isDragging
  // isClicking = false; // Add this line

  const sphereIntersect = intersectsBloom.find(
    (intersect) => getObjectType(intersect.object) === "Sphere"
  );

  if (sphereIntersect) {
    controls.enabled = false; // Disable controls
    selectedSphere = sphereIntersect.object;
    selectedObject = selectedSphere;
    sphereIntersect.object.layers.toggle(BLOOM_SCENE);
    // isClicking = true; // Indicate that an object was clicked
  } else if (intersectsNonBloom?.length > 0) {
    const selectedCube = getCubeUnderPointer(event, intersectsNonBloom);
    if (selectedCube) {
      controls.enabled = false; // Disable controls
      selectedObject = selectedCube;
      // isClicking = true; // Indicate that an object was clicked

      // Initialize the previousIntersectPoint for cube dragging
      plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
        selectedObject.wireframeCube.position
      );
      raycaster.ray.intersectPlane(plane, previousIntersectPoint);
    }
  } else {
    isDragging = false;
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

async function onPointerUp(event) {
  const { controls, scene, nonBloomScene, ghostCube, sceneSnapshot } =
    share3dDat();
  console.log("i am onpointerup isdragging", isDragging);

  if (isDragging || isFileDragging) {
    isDragging = false;
    isFileDragging = false;

    if (selectedSphere) {
      const sphereRadius =
        selectedSphere.scale.x / 2 || selectedSphere.geometry.parameters.radius;

      if (ghostCube) {
        if (ghostCube.existingCube) {
          const existingCube = ghostCube.existingCube;
          // removeGhostCube();

          const cubeSize = existingCube.scale.x;
          const cubePosition = existingCube.position.clone();

          const offset = getRandomOffset(cubeSize, sphereRadius);
          selectedSphere.position.copy(cubePosition.clone().add(offset));

          // saveObjectChanges(selectedSphere);
          // resizeCubeToFitSpheres(existingCube);
        } else {
          const cubeSize = sphereRadius * RESCALEFACTOR;
          const cubePosition = ghostCube.position.clone();
          const cubeColor = ghostCube.material.color.clone();

          // removeGhostCube();

          const cubeData = convertToThreeJSFormat({
            position: cubePosition.toArray(),
            size: cubeSize,
            color: cubeColor.getHex(),
            userData: { id: `cube_${Date.now()}` },
            lastEditedBy: loginName,
          });
          const _ = createWireframeCube(cubeData);

          const offset = getRandomOffset(cubeSize, sphereRadius);
          selectedSphere.position.copy(cubePosition.clone().add(offset));

          // saveObjectChanges(selectedSphere);
          // saveObjectChanges(createdCube.wireframeCube);
          // saveObjectChanges(createdCube.solidCube);
        }
      }
    }
    if (event.target.hasPointerCapture(event.pointerId)) {
      event.target.releasePointerCapture(event.pointerId);
    }
    markNeedsRender();
    cleanupOldCubes();
    removeGhostCube();
    resetCubeHighlight();
    diffSceneChanges(scene, nonBloomScene, sceneSnapshot);

  }
  controls.enabled = true;
  // Reset variables
  isDragging = false;
  // isClicking = false;
  selectedSphere = null;
  selectedObject = null;
  currentSnapshot = null;
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

    // saveObjectChanges(cube.wireframe);
    // saveObjectChanges(cube.solid);
  });
}

function setupPointerEvents() {
  console.log("setupPointerEvents called");
  const { renderer } = share3dDat(); // Access the renderer to get the canvas
  const canvas = renderer.domElement;

  canvas.addEventListener("pointerdown", onPointerDown);

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
}

setupPointerEvents();

// document.addEventListener("pointerup", function (event) {
//   const { renderer } = share3dDat(); // Access the renderer to get the canvas

//   const canvas = renderer.domElement;
//   if (event.target === canvas) {
//     onPointerUp(event);
//   }
// });
