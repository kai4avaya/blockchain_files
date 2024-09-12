import {
  createSphere,
  share3dDat,
  createWireframeCube,
  render,
  removeEmptyCubes,
  markNeedsRender,
  randomColorGenerator
} from "./create.js";
import { createSceneSnapshot, getObjectById } from "./snapshot";
import { handleFileDrop } from "../../memory/fileHandler.js";
import * as THREE from "three";
import { debounce, convertToThreeJSFormat } from "../../utils/utils";
import { sceneState } from "../../memory/collaboration/scene_colab";

let isDragging = false;
let selectedSphere = null;
let CUBEINTERSECTED;
const cubeGroups = new Map(); // Map of cube UUIDs to arrays of spheres inside them
let selectedObject = null;
let currentSnapshot = null;
const BLOOM_SCENE = 1;
let isFileDragging = false;
const SCALEFACTOR = 0.05

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectPoint = new THREE.Vector3();
const planeNormal = new THREE.Vector3();
const plane = new THREE.Plane();
const loginName = localStorage.getItem("login_block") || "no_login";

setupDragAndDrop();

// // returns the actual cubes and the spheres inside them
// function getCubeUnderPointer(event, intersects) {
//   const { camera, scene, nonBloomScene, controls } = share3dDat();
//   // Update mouse position
//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//   // Cast a ray from the camera to the mouse position
//   raycaster.setFromCamera(mouse, camera);
//   // const intersects = raycaster.intersectObjects(nonBloomScene.children, true);

//   if (intersects.length > 0) {
//     currentSnapshot = createSceneSnapshot([scene, nonBloomScene]);

//     console.log("i am currentSnapshot", currentSnapshot)

//     for (const intersectedObject of intersects) {
//       // Find the intersected object in the snapshot boxes
//       const matchingBox = currentSnapshot.boxes.find(
//         (box) =>
//           box.id === intersectedObject.object.userData.id ||
//           box.id === intersectedObject.object.uuid
//       );

//       if (matchingBox) {
//         controls.enabled = false; // Disable OrbitControls during dragging

//         return {
//           wireframeCube: matchingBox.wireframe || null,
//           solidCube: matchingBox.solid || null,
//           containedSpheres: currentSnapshot.containment[matchingBox.id].map(
//               (id) => getObjectById(currentSnapshot, id)
//           ),
//       };
//       }
//     }
//   }
//   return null; // Return null if no cube is found
// }


function getCubeUnderPointer(event, intersects) {
  const { camera, scene, nonBloomScene, controls } = share3dDat();
  // Update mouse position
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Cast a ray from the camera to the mouse position
  raycaster.setFromCamera(mouse, camera);

  if (intersects.length > 0) {
    currentSnapshot = createSceneSnapshot([scene, nonBloomScene]);

    console.log("I am currentSnapshot", currentSnapshot);

    for (const intersectedObject of intersects) {
      let matchingBox = currentSnapshot.boxes.find(
        (box) =>
          box.wireframe.uuid === intersectedObject.object.uuid ||
          box.solid.uuid === intersectedObject.object.uuid
      );

      // If we found a solid cube (ending with '-solid'), find its wireframe twin
      if (matchingBox && matchingBox.id.endsWith('-solid')) {
        const wireframeId = matchingBox.id.replace('-solid', '');
        matchingBox = currentSnapshot.boxes.find(box => box.id === wireframeId) || matchingBox;
      }

      if (matchingBox) {
        controls.enabled = false; // Disable OrbitControls during dragging

        // Ensure both wireframe and solid cubes are returned
        const wireframeCube = matchingBox.wireframe || currentSnapshot.boxes.find(box => box.id === matchingBox.id + '-solid')?.wireframe || null;
        const solidCube = matchingBox.solid || currentSnapshot.boxes.find(box => box.id === matchingBox.id.replace('-solid', ''))?.solid || null;

        return {
          wireframeCube,
          solidCube,
          containedSpheres: currentSnapshot.containment[matchingBox.id]?.map(
            (id) => getObjectById(currentSnapshot, id)
          ) || [],
        };
      }
    }
  }
  return null; // Return null if no cube is found
} 
// export function dragCube(cubes_and_containtedSpheres, intersectPoint) {
//   if (
//     !cubes_and_containtedSpheres ||
//     !cubes_and_containtedSpheres.wireframeCube
//   )
//     return;
//   // const cubeId = cubes_and_containtedSpheres.wireframeCube.id || cubes_and_containtedSpheres.wireframeCube.uuid;
//   const cubes = [
//     cubes_and_containtedSpheres.wireframeCube,
//     cubes_and_containtedSpheres.solidCube,
//   ].filter(Boolean);
//   // Calculate the movement delta
//   const movementDelta = new THREE.Vector3().subVectors(
//     intersectPoint,
//     cubes[0].position
//   );
//   cubes_and_containtedSpheres.wireframeCube.position.add(movementDelta);
//   cubes_and_containtedSpheres.solidCube.position.add(movementDelta);
//   // Move all spheres inside this cube
//   // const containedSpheres = cubes_and_containtedSpheres.containedSphereS;
//   cubes_and_containtedSpheres.containedSpheres.forEach((sphere) => {
//     console.log("containedsphere item", sphere.object)
//     sphere.object.position.add(movementDelta);
//     console.log("sphere in cube being draggged", sphere.object.uuid, "POSITION: " , sphere.object.position)
//   });
//   // render();
//   markNeedsRender();
// }

// let previousIntersectPoint = new THREE.Vector3();

export function dragCube() {
  if (!selectedObject || !selectedObject.wireframeCube) return;

  // Store the initial position of the wireframe cube
  const initialPosition = selectedObject.wireframeCube.position.clone();

  // Calculate the movement delta based on the change in intersect point
  const movementDelta = new THREE.Vector3().subVectors(intersectPoint, previousIntersectPoint);

  // Move the wireframe and solid cubes
  selectedObject.wireframeCube.position.add(movementDelta);
  selectedObject.solidCube.position.copy(selectedObject.wireframeCube.position);

  // Calculate the actual movement of the cube
  const actualMovement = new THREE.Vector3().subVectors(selectedObject.wireframeCube.position, initialPosition);

  // Move all spheres inside this cube
  selectedObject.containedSpheres.forEach((sphere) => {

    // console.log("+++sphere in cube being draggged", sphere.object.uuid)
    // console.log("sphere in cube being POSITION: " , JSON.stringify(sphere.object.position))
    sphere.object.position.add(actualMovement);
    // Update the position in the selectedObject
    sphere.position = sphere.object.position.toArray();
  });

  // Update the previous intersect point for the next drag event
  previousIntersectPoint.copy(intersectPoint);

  markNeedsRender();
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

export function resizeCubeToFitSpheres(
  cube,
  minSizeAllowed = false,
  buffer = 5
) {
  const spheres = cubeGroups.get(cube.uuid);
  if (!spheres || spheres.length === 0) return;

  // Calculate the bounding box that fits all spheres
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  spheres.forEach((sphere) => {
    const spherePosition = sphere.position;
    const sphereRadius = sphere.scale.x; // Assuming uniform scale for simplicity

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
  const currentCubeSize = cube.scale.x; // Assuming uniform scale for simplicity

  // Determine the final cube size
  let finalCubeSize;
  if (minSizeAllowed) {
    // Allow shrinking to the new calculated size with the buffer
    finalCubeSize = newCubeSize;
  } else {
    // Do not allow shrinking below the current size
    finalCubeSize = Math.max(newCubeSize, currentCubeSize);
  }

  // Set the cube size to the final calculated size
  cube.scale.set(finalCubeSize, finalCubeSize, finalCubeSize);
}

export function getObjectUnderPointer(event) {
  const { camera, scene, nonBloomScene } = share3dDat();

  // Update mouse position
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Cast a ray from the camera to the mouse position
  raycaster.setFromCamera(mouse, camera);

  // Check for intersections in both scenes
  const intersects = raycaster.intersectObjects(
    [...scene.children, ...nonBloomScene.children],
    true
  );

  if (intersects.length > 0) {
    return intersects[0].object; // Return the first intersected object
  }

  return null; // Return null if no object is found
}

export function moveSphere(event, sphere, intersectPointIn = null) {
  const { camera } = share3dDat();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

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
  handleFileDragOver(event);
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
function handleFileDragOver(event) {
  const { camera, scene, nonBloomScene } = share3dDat();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);
  const solidCubeIntersect = allIntersects.find(
    (intersect) => intersect.object.geometry.type === "BoxGeometry"
  );

  if (solidCubeIntersect) {
    highlightCube(solidCubeIntersect.object);
  } else {
    resetCubeHighlight();
  }
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


async function handleFileDrop_sphere(event) {

  isFileDragging = false;
  resetCubeHighlight();
  const { camera, scene, nonBloomScene } = share3dDat();

  const dt = event.dataTransfer;
  const fileList = dt?.files;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  let createdShapes = [];

  const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);
  let dataObject = {};
  
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const size = normalizeSize(file.size);
    const fileIds = await handleFileDrop(event);

    if (allIntersects.length > 0) {
      const intersect = allIntersects[0];
      const dropPosition = intersect.point;

      const sphereData = convertToThreeJSFormat({
        position: [dropPosition.x, dropPosition.y, dropPosition.z],
        size: size,
        userData: {id: fileIds[i]},
        color: randomColorGenerator(),
        lastEditedBy: loginName,
      });

      if (intersect.object.geometry.type === "IcosahedronGeometry") {
        // Create sphere
        const createdSphere = createSphere(sphereData);
        createdShapes.push(createdSphere);

        // Create cube with a size relative to the sphere
        const cubeSize = size * 4 * SCALEFACTOR; // Adjust this factor as needed
        const cubeData = convertToThreeJSFormat({
          ...sphereData,
          size: cubeSize,
          position: [dropPosition.x, dropPosition.y, dropPosition.z],
        });
        const createdCube = createWireframeCube(cubeData);
        createdShapes.push(createdCube);

      } else {
        createdShapes.push(createSphere(sphereData));
      }
    } else {
      planeNormal.set(0, 0, 1).applyQuaternion(camera.quaternion);
          plane.normal.copy(planeNormal);
          raycaster.ray.intersectPlane(plane, intersectPoint);

          dataObject = convertToThreeJSFormat({
            position: new THREE.Vector3(intersectPoint.x, intersectPoint.y, intersectPoint.z),
            size: size,
            color: randomColorGenerator(),
            userData:{id: fileIds[i]},
            lastEditedBy: loginName,

          });

          createdShapes.push(

          createSphere( 
              dataObject
            )
          );
    }
  }

  createdShapes.forEach((shape) => {
    // console.log("Saving shape:", shape);
    Object.values(shape).forEach((item) => {
      if (item && typeof item === "object" && "uuid" in item) {
        saveObjectChanges(item);
      }
    });
  });

  // Reset cube highlighting after drop
  if (CUBEINTERSECTED) {
    resetCubeColor(CUBEINTERSECTED);
    CUBEINTERSECTED = null;
  }
}

function getSize(intersect, scale = 1) {
  const boundingBox = new THREE.Box3().setFromObject(intersect.object);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  return Math.max(size.x, size.y, size.z) * scale;
}
async function handleDrop_sphere(event) {
  if (!isDragging) return; // may need endpoint for isDragging

  resetCubeHighlight();
  const { camera, scene, nonBloomScene } = share3dDat();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);
  if (allIntersects.length > 0) {
    const intersect = allIntersects[0];
    const dropPosition = intersect.point;

    if (
      intersect.object.geometry.type === "EdgesGeometry" ||
      intersect.object.geometry.type === "BoxGeometry"
    ) {
      intersect.object.material.color.set(0xff0000);
    } else if (intersect.object.geometry.type === "IcosahedronGeometry") {
      // Only create a cube if we're dropping onto another sphere
      if (selectedSphere && selectedSphere !== intersect.object) {
        const size = getSize(intersect);
        const actualSphereSize = size * SCALEFACTOR;
        const scaledCubeSize = actualSphereSize * 4;

        const dataObject = convertToThreeJSFormat({
          size: scaledCubeSize,
          // position: new THREE.Vector3(dropPosition.x, dropPosition.y, dropPosition.z),
          position: [dropPosition.x, dropPosition.y, dropPosition.z], ////new THREE.Vector3(dropPosition.x, dropPosition.y, dropPosition.z),

          color: randomColorGenerator(),
          // userData:{id: fileIds[i]},
        });
        
        createWireframeCube(
          dataObject
        );
      }
    }
  } else {
    planeNormal.set(0, 0, 1).applyQuaternion(camera.quaternion);
    plane.normal.copy(planeNormal);
    raycaster.ray.intersectPlane(plane, intersectPoint);
  }

  // Reset cube highlighting after drop
  if (CUBEINTERSECTED) {
    resetCubeColor(CUBEINTERSECTED);
    CUBEINTERSECTED = null;
  }
}

// function resetCubeHighlight() {
//   if (CUBEINTERSECTED) {
//     if (CUBEINTERSECTED.originalMaterial) {
//       CUBEINTERSECTED.material = CUBEINTERSECTED.originalMaterial;
//       CUBEINTERSECTED.material.needsUpdate = true;
//     }
//     CUBEINTERSECTED = null;
//     // render();
//     markNeedsRender();
//   }
// }

function resetCubeColor(cube) {
  if (cube && cube.originalMaterial) {
    cube.material = cube.originalMaterial;
    cube.material.needsUpdate = true;
  }
}
function setupDragAndDrop() {
  window.addEventListener("dragenter", (event) => {
    event.preventDefault();
    isFileDragging = true;
  });

  window.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (isFileDragging) {
      handleFileDragOver(event);
    }
  });

  window.addEventListener("drop", async (event) => {
    event.preventDefault();
    await handleFileDrop_sphere(event);
    //  const snapshot = getSceneSnapshot([scene, nonBloomScene]);
  });

  window.addEventListener("dragleave", (event) => {
    event.preventDefault();
    isFileDragging = false;
    resetCubeHighlight();
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


export function onPointerDown(event) {
  const { mouse, raycaster, scene, nonBloomScene, camera, controls } = share3dDat();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersectsBloom = raycaster.intersectObjects(scene.children, true);
  const intersectsNonBloom = raycaster.intersectObjects(nonBloomScene.children, true);

    const sphereIntersect = intersectsBloom.find(
    (intersect) => getObjectType(intersect.object) === "Sphere"
  );


  if (sphereIntersect) {
    isDragging = true;
    controls.enabled = false;
    selectedSphere = sphereIntersect.object;
    selectedObject = selectedSphere;
    sphereIntersect.object.layers.toggle(BLOOM_SCENE);
  } else if(intersectsNonBloom?.length > 0) {

    const selectedCube = getCubeUnderPointer(event, intersectsNonBloom);
    if (selectedCube) {
      isDragging = true;
      controls.enabled = false;
      selectedObject = selectedCube;
      
      // Initialize the previousIntersectPoint for cube dragging
      plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
        selectedObject.wireframeCube.position
      );
      raycaster.ray.intersectPlane(plane, previousIntersectPoint);
    }
  }

  if (isDragging) {
    // Prevent default behavior when dragging starts
    event.preventDefault();
    event.stopPropagation();
  }
  event.target.setPointerCapture(event.pointerId);
  markNeedsRender();
}

// Make sure to declare previousIntersectPoint at the top of your file
let previousIntersectPoint = new THREE.Vector3();
export function saveObjectChanges(objectData) {
  console.log("saveObjectChanges", objectData);
  if (!objectData) return;

  const convertToArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value.toArray === "function") return value.toArray();
    return value;
  };

  const convertColor = (color) => {
    if (typeof color === "number") return color;
    if (color && typeof color.getHex === "function") return color.getHex();
    return color;
  };

  const commonData = {
    type: objectData.type,
    shape: objectData.shape,
    uuid: objectData.uuid,
    userData: objectData.userData || {},
    position: convertToArray(objectData.position),
    rotation: convertToArray(objectData.rotation),
    scale: convertToArray(objectData.scale),
    version: objectData.version + 1,
    versionNonce: objectData.versionNonce,
    size: objectData.size,
    isDeleted: objectData.isDeleted || false,
    color: convertColor(objectData.material?.color || objectData.color),
    lastEditedBy: objectData.loginName || loginName,
  };
  sceneState.updateObject(commonData);
}

// async function onPointerUp(event) {
//   if (isDragging) {

//   const { controls, scene, nonBloomScene } = share3dDat();

//     await handleDrop_sphere(event);
//     isDragging = false;
//     controls.enabled = true; // Re-enable OrbitControls after dragging

//     if (selectedSphere) {
//       saveObjectChanges(selectedSphere);
//     } else if (selectedObject && selectedObject.wireframeCube) {
//       console.log("selected a cube! onPointerUp", selectedObject);

//       // Save wireframe cube
//       saveObjectChanges(selectedObject.wireframeCube);
//       saveObjectChanges(selectedObject.solidCube);

//       if (selectedObject.containedSpheres) {
//         selectedObject.containedSpheres.forEach(sphereData => {
//           if (sphereData.object) {
//             // Use the updated position from the object
//             sphereData.object.position.fromArray(sphereData.position);
//             saveObjectChanges(sphereData.object);
//           }
//         });

//         // Release the pointer capture
//     event.target.releasePointerCapture(event.pointerId);
//       }
//     }

//     selectedSphere = null;
//     selectedObject = null;
//     currentSnapshot = null;

//     if (CUBEINTERSECTED) {
//       resetCubeColor(CUBEINTERSECTED);
//       CUBEINTERSECTED = null;
//     }

//     removeEmptyCubes(scene, nonBloomScene);
//   }
// }


// async function onPointerUp(event) {
//   if (isDragging) {
//     const { controls, scene, nonBloomScene } = share3dDat();

//     isDragging = false;
//     controls.enabled = true;

//     if (selectedSphere) {
//        const cubesToDelete = removeEmptyCubes(scene, nonBloomScene);

//        if (cubesToDelete.length > 0) {
//          // Update the scene state with the cubes to delete
//          cubesToDelete.forEach(cube => {
//            saveObjectChanges(cube.wire);
//            saveObjectChanges(cube.solid);
//          });
//        }
//       saveObjectChanges(selectedSphere);

//     } else if (selectedObject && selectedObject.wireframeCube) {
//       // Save wireframe cube
//       saveObjectChanges(selectedObject.wireframeCube);
//       // Save solid cube
//       saveObjectChanges(selectedObject.solidCube);

//       if (selectedObject.containedSpheres) {
//         console.log("selectedObject.containedSpheres", selectedObject.containedSpheres);
//         selectedObject.containedSpheres.forEach(sphereData => {
//           if (sphereData.object) {
//             console.log("spheredata each object", sphereData)
//             console.log("sphereData.position updated from the drag cube event", sphereData.uuid, sphereData.position);
//             sphereData.object.position.fromArray(sphereData.position);
//             saveObjectChanges(sphereData.object);
//           }
//         });
//       }
//     }

//     selectedSphere = null;
//     selectedObject = null;
//     currentSnapshot = null;

//     if (CUBEINTERSECTED) {
//       resetCubeColor(CUBEINTERSECTED);
//       CUBEINTERSECTED = null;
//     }

//     // removeEmptyCubes(scene, nonBloomScene);
//     event.target.releasePointerCapture(event.pointerId);

//     // Force a re-render of the scene
//     markNeedsRender();
//   }
// }

// async function onPointerUp(event) {
//   if (isDragging) {
//     const { controls } = share3dDat();

//     isDragging = false;
//     controls.enabled = true;

//     if (selectedSphere) {
//       // ... (existing code for handling selected sphere)
//        const cubesToDelete = removeEmptyCubes(scene, nonBloomScene);

//        if (cubesToDelete.length > 0) {
//          // Update the scene state with the cubes to delete
//          cubesToDelete.forEach(cube => {
//            saveObjectChanges(cube.wire);
//            saveObjectChanges(cube.solid);
//          });
//        }
//       saveObjectChanges(selectedSphere);
//     } else if (selectedObject && selectedObject.wireframeCube) {
//       // Save wireframe cube
//       saveObjectChanges(selectedObject.wireframeCube);
//       // Save solid cube
//       saveObjectChanges(selectedObject.solidCube);

//       if (selectedObject.containedSpheres) {
//         // const cubePosition = selectedObject.wireframeCube.position;
//         selectedObject.containedSpheres.forEach(sphereData => {
//           if (sphereData.object) {
//             // Calculate the sphere's offset from the cube's center
//             // const offset = new THREE.Vector3().subVectors(sphereData.object.position, cubePosition);
            
//             // // Update the sphere's position based on the cube's final position and the offset
//             // sphereData.object.position.copy(cubePosition).add(offset);
//             // sphereData.position = sphereData.object.position.toArray();

//             console.log("++sphereData.position updated from the drag cube event", sphereData.object.uuid, sphereData.object.position);
//             saveObjectChanges(sphereData.object);
//           }
//         });
//       }
//     }

//     selectedSphere = null;
//     selectedObject = null;
//     currentSnapshot = null;

//     if (CUBEINTERSECTED) {
//       resetCubeColor(CUBEINTERSECTED);
//       CUBEINTERSECTED = null;
//     }

//     // removeEmptyCubes(scene, nonBloomScene);
//     event.target.releasePointerCapture(event.pointerId);

//     // Force a re-render of the scene
//     markNeedsRender();
//   }
// }


async function onPointerUp(event) {
  if (isDragging) {
    const { controls,scene, nonBloomScene } = share3dDat();

    isDragging = false;
    controls.enabled = true;

    if (selectedSphere) {
       const cubesToDelete = removeEmptyCubes(scene, nonBloomScene);
       console.log("cubesToDelete", cubesToDelete);
       saveObjectChanges(selectedSphere);
       cubesToDelete.forEach((cube) => {
         if (!cube.wireframe) return
         cube.wireframe.isDeleted = true;
         cube.solid.isDeleted = true;
         saveObjectChanges(cube.wireframe);
         saveObjectChanges(cube.solid);
       })
    } else if (selectedObject && selectedObject.wireframeCube) {
      // Save wireframe cube
      saveObjectChanges(selectedObject.wireframeCube);
      // Save solid cube
      saveObjectChanges(selectedObject.solidCube);

      if (selectedObject.containedSpheres) {
        selectedObject.containedSpheres.forEach(sphereData => {
          
          if (sphereData.object) {
            // Use the updated position from sphere.position
            const updatedPosition = new THREE.Vector3().fromArray(sphereData.position);
            sphereData.object.position.copy(updatedPosition);
            
            
            // Create a new object with the updated position for saving
            const updatedSphereData = {
              ...sphereData.object,
              position: updatedPosition
            };
            
            saveObjectChanges(updatedSphereData);
          }
        });
      }
    }

    selectedSphere = null;
    selectedObject = null;
    currentSnapshot = null;

    if (CUBEINTERSECTED) {
      resetCubeColor(CUBEINTERSECTED);
      CUBEINTERSECTED = null;
    }

    // removeEmptyCubes(scene, nonBloomScene);
    event.target.releasePointerCapture(event.pointerId);

    // Force a re-render of the scene
    markNeedsRender();
  }
}

const onPointerMove = debounce((event) => {
  if (!isDragging) return;

  const { camera } = share3dDat();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  if (selectedSphere) {
    moveSphere(event);
  } else if (selectedObject) {
    plane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
      new THREE.Vector3()
    );
    raycaster.ray.intersectPlane(plane, intersectPoint);
    dragCube();
  }

  requestAnimationFrame(render);
}, 16); // Debounce to roughly 60fps

window.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
