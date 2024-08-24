import {
  createSphere,
  share3dDat,
  createWireframeCube,
  render,
  removeEmptyCubes
} from "./create.js";
import {
    createSceneSnapshot,
  getObjectById,
} from "./snapshot";
import { handleFileDrop } from "../../memory/fileHandler.js";
import * as THREE from "three";
let isDragging = false;
let selectedSphere = null;
let CUBEINTERSECTED;
let lastTime = 0;
const cubeGroups = new Map(); // Map of cube UUIDs to arrays of spheres inside them
let selectedObject = null;
let currentSnapshot = null;
const BLOOM_SCENE = 1;
let isFileDragging = false;

setupDragAndDrop();

// function getCubeUnderPointer(event) {
//   const { camera, raycaster, scene, nonBloomScene, mouse, controls } =
//     share3dDat();

//   // Update mouse position
//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//   // Cast a ray from the camera to the mouse position
//   raycaster.setFromCamera(mouse, camera);
//   const intersects = raycaster.intersectObjects(nonBloomScene.children, true);

//   if (intersects.length > 0) {
//     currentSnapshot = getSceneSnapshot([scene, nonBloomScene]); // Pass the scenes to get the snapshot

//     console.log("currentSnapshot!!!", currentSnapshot);
//     for (const intersectedObject of intersects) {
//       // Find the intersected object in the snapshot cubes using the userData.id or uuid
//       const matchingCube = currentSnapshot.cubes.find(
//         (cube) =>
//           cube.id === intersectedObject.object.userData.id ||
//           cube.id === intersectedObject.object.uuid
//       );

//       if (matchingCube) {
//         controls.enabled = false; // Disable OrbitControls during dragging

//         // Use the matching cube's ID to get the full cube and contained spheres
//         const result = getCubeAndContainedSpheresById(
//           currentSnapshot,
//           matchingCube.id
//         );

//         return result; // Return the cube, its twin, and the contained spheres
//       }
//     }
//   }

//   return null; // Return null if no cube is found
// }


// returns the actual cubes and the spheres inside them
function getCubeUnderPointer(event) {
    const { camera, raycaster, scene, nonBloomScene, mouse, controls } = share3dDat();
    // Update mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
    // Cast a ray from the camera to the mouse position
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nonBloomScene.children, true);
  
    if (intersects.length > 0) {
      currentSnapshot = createSceneSnapshot([scene, nonBloomScene]);

      console.log("currentSnapshot!!!", currentSnapshot);
  
      for (const intersectedObject of intersects) {
        // Find the intersected object in the snapshot boxes
        const matchingBox = currentSnapshot.boxes.find(
          (box) =>
            box.id === intersectedObject.object.userData.id ||
            box.id === intersectedObject.object.uuid
        );
  
        if (matchingBox) {
          controls.enabled = false; // Disable OrbitControls during dragging
  
          return {
            wireframeCube: matchingBox.wireframe,
            solidCube: matchingBox.solid,
            containedSpheres: currentSnapshot.containment[matchingBox.id].map(id => 
              getObjectById(currentSnapshot, id)
            )
          };
        }
      }
    }
    return null; // Return null if no cube is found
  }
  
// export function dragCube(event, cube, intersectPoint, snapshot) {
//   if (!cube) return;
//   if (!cube.wireframeCube) return;

//   const { nonBloomScene, scene } = share3dDat();

//   const cubeId = cube.wireframeCube.id || cube.wireframeCube.uuid;
//   const cubes = getObjectById([nonBloomScene, scene], cubeId);

//   // Calculate the movement delta
//   const movementDelta = new THREE.Vector3().subVectors(
//     intersectPoint,
//     cubes[0].position
//   );

//   // Update cube positions
//   cubes.forEach((cubeObj) => {
//     cubeObj.position.add(movementDelta);
//   });

//   // Move all spheres inside this cube
//   const containedSphereIds = snapshot.containment[cubeId];

//   console.log("containedSphereIds", containedSphereIds);
//   if (containedSphereIds && containedSphereIds.length > 0) {
//     containedSphereIds.forEach((sphereId) => {
//       const sphereObjects = getObjectById([nonBloomScene, scene], sphereId);
//       sphereObjects.forEach((sphereObj) => {
//         // Move sphere by the same delta as the cube
//         sphereObj.position.add(movementDelta);
//       });
//     });
//   }

//   render();
// }


export function dragCube(cubes_and_containtedSpheres, intersectPoint) {
    if (!cubes_and_containtedSpheres || !cubes_and_containtedSpheres.wireframeCube) return;
  
    // const cubeId = cubes_and_containtedSpheres.wireframeCube.id || cubes_and_containtedSpheres.wireframeCube.uuid;
    console.log("cubes_and_containtedSpheres", cubes_and_containtedSpheres)
    const cubes = [cubes_and_containtedSpheres.wireframeCube, cubes_and_containtedSpheres.solidCube].filter(Boolean);
  
    // Calculate the movement delta
    const movementDelta = new THREE.Vector3().subVectors(
      intersectPoint,
      cubes[0].position
    );

    cubes_and_containtedSpheres.wireframeCube.position.add(movementDelta);
    cubes_and_containtedSpheres.solidCube.position.add(movementDelta)
  
    // Move all spheres inside this cube
    const containedSpheres = cubes_and_containtedSpheres.containedSpheres
        containedSpheres.forEach((sphere) => {
            sphere.object.position.add(movementDelta);
      });
  
    render();
  }

export function removeSphereFromCube(sphere, cube) {
  const spheres = cubeGroups.get(cube.uuid);
  if (spheres) {
    const index = spheres.indexOf(sphere);
    if (index !== -1) {
      spheres.splice(index, 1); // Remove sphere from group
    }
  }
}



function handleDragOver(event) {
    const { camera, scene, nonBloomScene, raycaster, mouse } = share3dDat();
  
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
  
    const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);
    const cubeIntersect = allIntersects.find(intersect => 
      intersect.object.geometry.type === "BoxGeometry" || 
      intersect.object.geometry.type === "EdgesGeometry"
    );
  
    if (cubeIntersect) {
      highlightCube(cubeIntersect.object);
    } else {
      resetCubeHighlight();
    }
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
      color: 0x39ff14,  // Bright green
      transparent: true,
      opacity: 0.8,
    });
    cube.material.needsUpdate = true;
    render();
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
  const { camera, raycaster, mouse, scene, nonBloomScene } = share3dDat();

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
  const { mouse, raycaster, camera, scene, nonBloomScene } = share3dDat();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const targetSphere = sphere || selectedSphere;

  console.log("moving me sphere", targetSphere)

  if (!targetSphere) return;

  // Store the original distance from the camera
  const originalDistance = camera.position.distanceTo(targetSphere.position);

  // Create a plane at the sphere's current position
  const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(
    camera.quaternion
  );
  const planeConstant = -targetSphere.position.dot(planeNormal);
  const plane = new THREE.Plane(planeNormal, planeConstant);

  let intersectPoint = intersectPointIn || new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, intersectPoint);

  // Move the sphere to the new position
  targetSphere.position.copy(intersectPoint);

  // Calculate the new distance from the camera
  const newDistance = camera.position.distanceTo(targetSphere.position);

  // Adjust the scale to maintain apparent size
  const scaleFactor = newDistance / originalDistance;
  targetSphere.scale.multiplyScalar(scaleFactor);

  removeEmptyCubes(scene, nonBloomScene);
  render();
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
  const { camera, scene, nonBloomScene, raycaster, mouse } = share3dDat();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);
  const solidCubeIntersect = allIntersects.find(intersect => 
    intersect.object.geometry.type === "BoxGeometry"
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
      render();
    }
  }

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
    isFileDragging = false;
    resetCubeHighlight();
    const { camera, scene, nonBloomScene, raycaster, mouse } = share3dDat();

    const dt = event.dataTransfer;
    const fileList = dt.files;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const size = normalizeSize(file.size);
      let dropPosition;
      const uuids = await handleFileDrop(event);

      if (allIntersects.length > 0) {
        const intersect = allIntersects[0];
        dropPosition = intersect.point;

        if (
          intersect.object.geometry.type === "EdgesGeometry" ||
          intersect.object.geometry.type === "BoxGeometry"
        ) {
          intersect.object.material.color.set(0xff0000);
          // x, y, z, size, id = ""
          createSphere(
            dropPosition.x,
            dropPosition.y,
            dropPosition.z,
            size,
            uuids[i]
          );
        } else if (intersect.object.geometry.type === "IcosahedronGeometry") {
          const actualSphereSize = size * 0.05;
          const scaledCubeSize = actualSphereSize * 4;
          createWireframeCube(
            scaledCubeSize,
            dropPosition.x,
            dropPosition.y,
            dropPosition.z,
            0xff0000
          );
          createSphere(
            dropPosition.x,
            dropPosition.y,
            dropPosition.z,
            size,
            uuids[i]
          );
        } else {
          createSphere(
            dropPosition.x,
            dropPosition.y,
            dropPosition.z,
            size,
            uuids[i]
          );
        }
      } else {
        const planeDistance = -10;
        const plane = new THREE.Plane(
          new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
          planeDistance
        );

        dropPosition = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, dropPosition);

        createSphere(
          dropPosition.x,
          dropPosition.y,
          dropPosition.z,
          size,
          uuids[i]
        );
      }
    }

    // Reset cube highlighting after drop
    if (CUBEINTERSECTED) {
      resetCubeColor(CUBEINTERSECTED);
      CUBEINTERSECTED = null;
    }
    //  const snapshot = getSceneSnapshot([scene, nonBloomScene]);
  });

  window.addEventListener("dragleave", (event) => {
    event.preventDefault();
    isFileDragging = false;
    resetCubeHighlight();
  });
}
function getObjectType(object) {
    if (!object) return 'No object';
    if (!object.geometry) return 'No geometry';
    
    const geometryType = object.geometry.type;
    
    // Check for specific geometry types
    switch(geometryType) {
      case 'IcosahedronGeometry':
      case 'SphereGeometry':
        return 'Sphere';
      case 'BoxGeometry':
        return 'Cube';
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

    const intersects = [...intersectsBloom, ...intersectsNonBloom]
    
    console.log("All intersects:", intersects.map(intersect => getObjectType(intersect.object)));
    
    const sphereIntersect = intersects.find(
      intersect => getObjectType(intersect.object) === 'Sphere'
    );
    
    console.log("Sphere intersect:", sphereIntersect);
    
    if (sphereIntersect) {
      isDragging = true;
      controls.enabled = false;
      selectedSphere = sphereIntersect.object;
      selectedObject = selectedSphere;
      console.log("isDragging", isDragging);
      sphereIntersect.object.layers.toggle(BLOOM_SCENE);
    } else {
      const selectedCube = getCubeUnderPointer(event);
      console.log("i am selectedCube", selectedCube)
      if (selectedCube) {
        isDragging = true;
        controls.enabled = false;
        selectedObject = selectedCube;
      }
    }
  }


function onPointerUp(event) {
  const { controls } = share3dDat();

  if (isDragging) {
    isDragging = false;
    controls.enabled = true; // Re-enable OrbitControls after dragging
    selectedSphere = null;
    selectedObject = null;
    currentSnapshot = null;
    if (CUBEINTERSECTED) {
      resetCubeColor(CUBEINTERSECTED);
      CUBEINTERSECTED = null;
    }
  }
}

// function onPointerMove(event) {
//   const now = performance.now();
//   if (now - lastTime < 16) {
//     return;
//   }
//   lastTime = now;

//   if (isDragging && selectedSphere) {
//     console.log("calling, moveSphere")
//     moveSphere(event);
//   } else {
//     const { camera, scene, nonBloomScene, raycaster, mouse } = share3dDat();

//     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//     raycaster.setFromCamera(mouse, camera);
//     const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);
//     changeCubeColor(allIntersects, isDragging);

//     const plane = new THREE.Plane(
//       new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
//       0
//     );
//     const intersectPoint = new THREE.Vector3();
//     raycaster.ray.intersectPlane(plane, intersectPoint);
//     dragCube(event, selectedObject, intersectPoint, currentSnapshot);
//   }
// }

function onPointerMove(event) {
  const now = performance.now();
  if (now - lastTime < 16) {
    return;
  }
  lastTime = now;

  if (isDragging && selectedSphere) {
    moveSphere(event);
  } else if (isDragging && selectedObject) {
    const { camera, raycaster, mouse } = share3dDat();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(
      new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
      0
    );
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    dragCube(selectedObject, intersectPoint);
  }
  // Remove the else block that was calling handleDragOver
}

  
window.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
