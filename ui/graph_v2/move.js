import {
  createSphere,
  share3dDat,
  createWireframeCube,
  removeEmptyCubes,
  markNeedsRender,
  randomColorGenerator,
  removeGhostCube,
  createGhostCube,
  render
} from "./create.js";
import { createSceneSnapshot, getObjectById, getCubeContainingSphere, findSpheresInCube} from "./snapshot";
import { handleFileDrop } from "../../memory/fileHandler.js";
import * as THREE from "three";
import {convertToThreeJSFormat } from "../../utils/utils";
import { saveObjectChanges } from "../../memory/collaboration/scene_colab";

let isDragging = false;
let selectedSphere = null;
let CUBEINTERSECTED;
const cubeGroups = new Map(); // Map of cube UUIDs to arrays of spheres inside them
let selectedObject = null;
let currentSnapshot = null;
const BLOOM_SCENE = 1;
let isFileDragging = false;
const SCALEFACTOR = 0.05
const RESCALEFACTOR = 10;

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


export function getObjectUnderPointer(event) {
  const { camera, scene, nonBloomScene, renderer } = share3dDat();

  // // Update mouse position
  // mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  // mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Calculate mouse position relative to the canvas
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
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

function handleFileDragOver(event, allIntersectsN = undefined, foundSpheres = undefined) {
  const { camera, scene, nonBloomScene, renderer  } = share3dDat();
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Calculate mouse position relative to the canvas
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const allIntersects = allIntersectsN || checkIntersections(raycaster, [scene, nonBloomScene]);
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



async function handleFileDrop_sphere(event) {
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

  const firstSphereIntersect = allIntersects.find(intersect => 
    intersect.object.geometry.type === "IcosahedronGeometry"
  );

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
        userData: { id: fileIds[i] },
        color: randomColorGenerator(),
        lastEditedBy: loginName,
      });

      // if (intersect.object.geometry.type === "IcosahedronGeometry") {
        if (firstSphereIntersect) {
        // const intersectedSphere = intersect.object;
        const intersectedSphere = firstSphereIntersect.object;

        // Check if there's already a cube over this sphere
        const existingCube = getCubeContainingSphere(intersectedSphere);


        if (!existingCube) {
          
          const createdSphere = createSphere(sphereData);
          createdShapes.push(createdSphere);

          // Create cube with a size relative to the sphere
          const cubeSize = size * RESCALEFACTOR * SCALEFACTOR; // Adjust this factor as needed
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
        position: new THREE.Vector3(intersectPoint.x, intersectPoint.y, intersectPoint.z),
        size: size,
        color: randomColorGenerator(),
        userData: { id: fileIds[i] },
        lastEditedBy: loginName,
      });

      createdShapes.push(createSphere(dataObject));
    }
  }

  // Save changes for created shapes
  createdShapes.forEach((shape) => {
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
// async function handleDrop_sphere(event) {
//   if (!isDragging) return; // may need endpoint for isDragging

//   resetCubeHighlight();
//   const { camera, scene, nonBloomScene } = share3dDat();

//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
//   raycaster.setFromCamera(mouse, camera);

//   const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);
//   if (allIntersects.length > 0) {
//     const intersect = allIntersects[0];
//     const dropPosition = intersect.point;

//     if (
//       intersect.object.geometry.type === "EdgesGeometry" ||
//       intersect.object.geometry.type === "BoxGeometry"
//     ) {
//       intersect.object.material.color.set(0xff0000);
//     } else if (intersect.object.geometry.type === "IcosahedronGeometry") {
//       // Only create a cube if we're dropping onto another sphere
//       if (selectedSphere && selectedSphere !== intersect.object) {
//         const size = getSize(intersect);
//         const actualSphereSize = size * SCALEFACTOR;
//         const scaledCubeSize = actualSphereSize * 4;

//         const dataObject = convertToThreeJSFormat({
//           size: scaledCubeSize,
//           // position: new THREE.Vector3(dropPosition.x, dropPosition.y, dropPosition.z),
//           position: [dropPosition.x, dropPosition.y, dropPosition.z], ////new THREE.Vector3(dropPosition.x, dropPosition.y, dropPosition.z),

//           color: randomColorGenerator(),
//           // userData:{id: fileIds[i]},
//         });
        
//         createWireframeCube(
//           dataObject
//         );
//       }
//     }
//   } else {
//     planeNormal.set(0, 0, 1).applyQuaternion(camera.quaternion);
//     plane.normal.copy(planeNormal);
//     raycaster.ray.intersectPlane(plane, intersectPoint);
//   }

//   // Reset cube highlighting after drop
//   if (CUBEINTERSECTED) {
//     resetCubeColor(CUBEINTERSECTED);
//     CUBEINTERSECTED = null;
//   }
// }


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
  });

  canvas.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (isFileDragging) {
      handleFileDragOver(event);
    }
  });

  canvas.addEventListener("drop", async (event) => {
    event.preventDefault();
    await handleFileDrop_sphere(event);
    removeGhostCube();
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


export function onPointerDown(event) {
  const { mouse, raycaster, renderer, scene, nonBloomScene, camera, controls } = share3dDat();
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Calculate mouse position relative to the canvas
  mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
  mouse.y = -(event.clientY - rect.top) / rect.height * 2 + 1;
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
``
// Make sure to declare previousIntersectPoint at the top of your file
let previousIntersectPoint = new THREE.Vector3();
// export function saveObjectChanges(objectData) {
//   console.log("saveObjectChanges", objectData);
//   if (!objectData) return;

//   const convertToArray = (value) => {
//     if (Array.isArray(value)) return value;
//     if (value && typeof value.toArray === "function") return value.toArray();
//     return value;
//   };

//   const convertColor = (color) => {
//     if (typeof color === "number") return color;
//     if (color && typeof color.getHex === "function") return color.getHex();
//     return color;
//   };

//   const commonData = {
//     type: objectData.type,
//     shape: objectData.shape,
//     uuid: objectData.uuid,
//     userData: objectData.userData || {},
//     position: convertToArray(objectData.position),
//     rotation: convertToArray(objectData.rotation),
//     scale: convertToArray(objectData.scale),
//     version: objectData.version + 1,
//     versionNonce: objectData.versionNonce,
//     size: objectData.size,
//     isDeleted: objectData.isDeleted || false,
//     color: convertColor(objectData.material?.color || objectData.color),
//     lastEditedBy: objectData.loginName || loginName,
//   };
//   sceneState.updateObject(commonData);
// }


function getRandomOffset(cubeSize) {
  const maxOffset = cubeSize / 4; // Adjust this value to control the offset range
  const offsetX = (Math.random() - 0.5) * maxOffset;
  const offsetY = (Math.random() - 0.5) * maxOffset;
  const offsetZ = (Math.random() - 0.5) * maxOffset;
  return new THREE.Vector3(offsetX, offsetY, offsetZ);
}



// async function onPointerUp(event) {
//   if (isDragging) {
//     const { controls, scene, nonBloomScene, ghostCube } = share3dDat();


//     isDragging = false;
//     controls.enabled = true;


//     // just if i am dragging sphere
//     if (selectedSphere) {
//       const sphereRadius = selectedSphere.scale.x || selectedSphere.geometry.parameters.radius
      
//       if (ghostCube) {
//         if (ghostCube.existingCube) {
//           // **The ghost cube represents an existing cube**
//           const existingCube = ghostCube.existingCube;

//           // Remove the ghost cube
//           removeGhostCube();

//           // **Move the selected sphere into the existing cube**
//           const cubeSize = existingCube.scale.x;
//           const cubePosition = existingCube.position.clone();

//           const offset = getRandomOffset(cubeSize, sphereRadius);
//           selectedSphere.position.copy(cubePosition.clone().add(offset));

//           // **Save changes**
//           saveObjectChanges(selectedSphere);
//         } else {

//           const cubeSize = sphereRadius * RESCALEFACTOR;
//           const cubePosition = ghostCube.position.clone();
//           const cubeColor = ghostCube.material.color.clone();

//           // Remove the ghost cube
//           removeGhostCube();

//           // Create a real cube at the ghost cube's position
//           const cubeData = convertToThreeJSFormat({
//             position: cubePosition.toArray(),
//             size: cubeSize,
//             color: cubeColor.getHex(),
//             userData: { id: `cube_${Date.now()}` },
//             lastEditedBy: loginName,
//           });
//           const createdCube = createWireframeCube(cubeData);

//           // Move the selected sphere into the new cube
//           const offset = getRandomOffset(cubeSize, sphereRadius);
//           selectedSphere.position.copy(cubePosition.clone().add(offset));

//           // Save changes
//           saveObjectChanges(selectedSphere);
//           saveObjectChanges(createdCube.wireframeCube);
//           saveObjectChanges(createdCube.solidCube);
//         }
//       } else {
//         // Existing logic for when the sphere is not dropped over another sphere
//         const cubesToDelete = removeEmptyCubes(scene, nonBloomScene);
//         saveObjectChanges(selectedSphere);
//         cubesToDelete.forEach((cube) => {
//           if (!cube.wireframe) return;
//           cube.wireframe.isDeleted = true;
//           cube.solid.isDeleted = true;
//           saveObjectChanges(cube.wireframe);
//           saveObjectChanges(cube.solid);
//         });
//       }
//     } else if (selectedObject && selectedObject.wireframeCube) {
//       // Existing logic for when a cube is being dragged
//       saveObjectChanges(selectedObject.wireframeCube);
//       saveObjectChanges(selectedObject.solidCube);

//       if (selectedObject.containedSpheres) {
//         selectedObject.containedSpheres.forEach((sphereData) => {

//           console.log("I am dragging these spheres have no fears MOVE", sphereData.object)
//           if (sphereData.object) {
//             const updatedPosition = new THREE.Vector3().fromArray(
//               sphereData.object?.position
//             );
//             sphereData.object.position.copy(updatedPosition);
//             const updatedSphereData = {
//               ...sphereData.object,
//               position: updatedPosition,
//             };
//             saveObjectChanges(updatedSphereData);
//           }
//         });
//       }
//     }

//     selectedSphere = null;
//     selectedObject = null;
//     currentSnapshot = null;

//     // Remove the ghost cube if it exists
//     removeGhostCube();

//     // Reset cube highlighting
//     resetCubeHighlight();

//     event.target.releasePointerCapture(event.pointerId);

//     // Force a re-render of the scene
//     markNeedsRender();
//   }
// }


async function onPointerUp(event) {
  if (isDragging) {
    const { controls, scene, nonBloomScene, ghostCube } = share3dDat();

    isDragging = false;
    controls.enabled = true;

    if (selectedSphere) {
      const sphereRadius = selectedSphere.scale.x / 2 || selectedSphere.geometry.parameters.radius;
      
      if (ghostCube) {
        if (ghostCube.existingCube) {
          const existingCube = ghostCube.existingCube;
          removeGhostCube();

          const cubeSize = existingCube.scale.x;
          const cubePosition = existingCube.position.clone();

          const offset = getRandomOffset(cubeSize, sphereRadius);
          selectedSphere.position.copy(cubePosition.clone().add(offset));

          saveObjectChanges(selectedSphere);
          // resizeCubeToFitSpheres(existingCube);
        } else {
          const cubeSize = sphereRadius * RESCALEFACTOR;
          const cubePosition = ghostCube.position.clone();
          const cubeColor = ghostCube.material.color.clone();

          removeGhostCube();

          const cubeData = convertToThreeJSFormat({
            position: cubePosition.toArray(),
            size: cubeSize,
            color: cubeColor.getHex(),
            userData: { id: `cube_${Date.now()}` },
            lastEditedBy: loginName,
          });
          const createdCube = createWireframeCube(cubeData);

          const offset = getRandomOffset(cubeSize, sphereRadius);
          selectedSphere.position.copy(cubePosition.clone().add(offset));

          saveObjectChanges(selectedSphere);
          saveObjectChanges(createdCube.wireframeCube);
          saveObjectChanges(createdCube.solidCube);
        }
      } else {
        const cubesToDelete = removeEmptyCubes(scene, nonBloomScene);
        saveObjectChanges(selectedSphere);
        cubesToDelete.forEach((cube) => {
          if (!cube.wireframe) return;
          cube.wireframe.isDeleted = true;
          cube.solid.isDeleted = true;
          saveObjectChanges(cube.wireframe);
          saveObjectChanges(cube.solid);
        });
      }
    } else if (selectedObject && selectedObject.wireframeCube) {
      saveObjectChanges(selectedObject.wireframeCube);
      saveObjectChanges(selectedObject.solidCube);

      if (selectedObject.containedSpheres) {
        selectedObject.containedSpheres.forEach((sphereData) => {
          if (sphereData.object) {
            const updatedPosition = sphereData.object.position.clone();
            const updatedSphereData = {
              ...sphereData.object,
              position: updatedPosition.toArray(),
            };
            saveObjectChanges(updatedSphereData);
          }
        });
      }

      // resizeCubeToFitSpheres(selectedObject.wireframeCube);
    }

    selectedSphere = null;
    selectedObject = null;
    currentSnapshot = null;

    removeGhostCube();
    resetCubeHighlight();

    event.target.releasePointerCapture(event.pointerId);
    markNeedsRender();
  }
}


const onPointerMove = (event) => {
  if (!isDragging) return;

  const { camera, scene, nonBloomScene } = share3dDat();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
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

      // **Check if the intersected sphere is inside a cube**
      const containingCube = getCubeContainingSphere(intersectedSphere);

      const sphereRadius = intersectedSphere.geometry.parameters.radius;
      const cubeSize = containingCube ? containingCube.scale.x : sphereRadius * 2;

      // **Create ghost cube, passing the existing cube if found**
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
};

// window.addEventListener("pointerdown", onPointerDown);
// window.addEventListener("pointermove", onPointerMove);
// window.addEventListener("pointerup", onPointerUp);

function setupPointerEvents() {
  const { renderer } = share3dDat(); // Access the renderer to get the canvas
  const canvas = renderer.domElement;

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
}

setupPointerEvents() 