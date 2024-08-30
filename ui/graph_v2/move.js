import {
  createSphere,
  share3dDat,
  createWireframeCube,
  render,
  removeEmptyCubes,
  markNeedsRender
} from "./create.js";
import {
  createSceneSnapshot,
  getObjectById,
} from "./snapshot";
import { handleFileDrop } from "../../memory/fileHandler.js";
import * as THREE from "three";
import {debounce} from "../../utils/utils";
import { sceneState } from '../../memory/collaboration/scene_colab';


let isDragging = false;
let selectedSphere = null;
let CUBEINTERSECTED;
const cubeGroups = new Map(); // Map of cube UUIDs to arrays of spheres inside them
let selectedObject = null;
let currentSnapshot = null;
const BLOOM_SCENE = 1;
let isFileDragging = false;


const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectPoint = new THREE.Vector3();
const planeNormal = new THREE.Vector3();
const plane = new THREE.Plane();
const loginName = localStorage.getItem("login_block") || "no_login";


setupDragAndDrop();

// returns the actual cubes and the spheres inside them
function getCubeUnderPointer(event) {
    const { camera, scene, nonBloomScene, controls } = share3dDat();
    // Update mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
    // Cast a ray from the camera to the mouse position
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nonBloomScene.children, true);
  
    if (intersects.length > 0) {
      currentSnapshot = createSceneSnapshot([scene, nonBloomScene]);

  
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
  

export function dragCube(cubes_and_containtedSpheres, intersectPoint) {
    if (!cubes_and_containtedSpheres || !cubes_and_containtedSpheres.wireframeCube) return;
  
    // const cubeId = cubes_and_containtedSpheres.wireframeCube.id || cubes_and_containtedSpheres.wireframeCube.uuid;
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
  
    // render();
    markNeedsRender()
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
    // render();
    markNeedsRender()
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
  const { camera,  scene, nonBloomScene } = share3dDat();

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

  let newIntersectPoint = intersectPointIn || intersectPoint  //new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, newIntersectPoint);

  // Move the sphere to the new position
  targetSphere.position.copy(newIntersectPoint);

  // Calculate the new distance from the camera
  const newDistance = camera.position.distanceTo(targetSphere.position);

  // Adjust the scale to maintain apparent size
  const scaleFactor = newDistance / originalDistance;
  targetSphere.scale.multiplyScalar(scaleFactor);
  handleFileDragOver(event)
  // render();
  markNeedsRender()

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
  const solidCubeIntersect = allIntersects.find(intersect => 
    intersect.object.geometry.type === "BoxGeometry"
  );

  if (solidCubeIntersect) {
    highlightCube(solidCubeIntersect.object);
  } else {
    resetCubeHighlight();
  }
}
  
async function handleFileDrop_sphere(event) {
  console.log("handleFileDrop_sphere", event)
  // if (!isDragging && !isFileDragging) return;  // may need endpoint for isDragging

  isFileDragging = false;
  resetCubeHighlight();
  const { camera, scene, nonBloomScene} = share3dDat();

  const dt = event.dataTransfer;
  const fileList = dt?.files;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  let createdShapes = []

  const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const size = normalizeSize(file.size);
    // let dropPosition;
    const uuids = await handleFileDrop(event);

    if (allIntersects.length > 0) {
      const intersect = allIntersects[0];
      const dropPosition = intersect.point;

      if (
        intersect.object.geometry.type === "EdgesGeometry" ||
        intersect.object.geometry.type === "BoxGeometry"
      ) {
        intersect.object.material.color.set(0xff0000);
        // x, y, z, size, id = ""
         createdShapes.push(createSphere(
          dropPosition.x,
          dropPosition.y,
          dropPosition.z,
          size,
          uuids[i]
        ))
      } else if (intersect.object.geometry.type === "IcosahedronGeometry") {
        // const size = getSize(intersect)
        const actualSphereSize = size * 0.05;
        const scaledCubeSize = actualSphereSize * 4;
        createdShapes.push(createWireframeCube(
          scaledCubeSize,
          dropPosition.x,
          dropPosition.y,
          dropPosition.z,
          0xff0000
        ))
        createdShapes.push(createSphere(
          dropPosition.x,
          dropPosition.y,
          dropPosition.z,
          size,
          uuids[i]
        ))
      } else {
        createdShapes.push(createSphere(
          dropPosition.x,
          dropPosition.y,
          dropPosition.z,
          size,
          uuids[i]
        ))
      }
    } else {
      // const planeDistance = -10;
      // const plane = new THREE.Plane(
      //   new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
      //   planeDistance
      // );

      // dropPosition = new THREE.Vector3();
      // raycaster.ray.intersectPlane(plane, dropPosition);
      planeNormal.set(0, 0, 1).applyQuaternion(camera.quaternion);
      plane.normal.copy(planeNormal);
      
      raycaster.ray.intersectPlane(plane, intersectPoint);

      createdShapes.push(createSphere(
        intersectPoint.x,
        intersectPoint.y,
        intersectPoint.z,
        size,
        uuids[i]
      ))
    }
  }
  // / Save all created shapes
  createdShapes.forEach(shape => {
    console.log("looping through da shape slape", shape)
    if (shape?.state?.type === "sphere") {  // Assuming this is how we identify spheres
      saveObjectChanges({
        type: 'sphere',
        id: shape?.state?.id,
        position: shape?.state?.position,
        scale: shape?.state?.scale,
        size: shape?.state?.size,
        color: shape?.material?.color
      });
    } else if (shape.wireframeCube && shape.solidCube) {  // Assuming this is how we identify cubes
      saveObjectChanges({
        type: 'cube',
        id: shape.wireframeCube.userData.id,
        position: shape.wireframeCube.position,
        scale: shape.wireframeCube.scale,
        size: shape?.state?.size,
        color: shape?.material?.color
      });
    }
  });

  // Reset cube highlighting after drop
  if (CUBEINTERSECTED) {
    resetCubeColor(CUBEINTERSECTED);
    CUBEINTERSECTED = null;
  }
}

function getSize(intersect, scale=1){
  const boundingBox = new THREE.Box3().setFromObject(intersect.object);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  return Math.max(size.x, size.y, size.z) * scale
}async function handleDrop_sphere(event) {
  if (!isDragging) return;  // may need endpoint for isDragging

  resetCubeHighlight();
  const { camera, scene, nonBloomScene} = share3dDat();

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
        const actualSphereSize = size * 0.05;
        const scaledCubeSize = actualSphereSize * 4;
        createWireframeCube(
          scaledCubeSize,
          dropPosition.x,
          dropPosition.y,
          dropPosition.z,
          0xff0000
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
  
  function resetCubeHighlight() {
    if (CUBEINTERSECTED) {
      if (CUBEINTERSECTED.originalMaterial) {
        CUBEINTERSECTED.material = CUBEINTERSECTED.originalMaterial;
        CUBEINTERSECTED.material.needsUpdate = true;
      }
      CUBEINTERSECTED = null;
      // render();
    markNeedsRender()

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
    await handleFileDrop_sphere(event)
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
    
    
    const sphereIntersect = intersects.find(
      intersect => getObjectType(intersect.object) === 'Sphere'
    );
    
    
    if (sphereIntersect) {
      isDragging = true;
      controls.enabled = false;
      selectedSphere = sphereIntersect.object;
      selectedObject = selectedSphere;
      sphereIntersect.object.layers.toggle(BLOOM_SCENE);
    } else {
      const selectedCube = getCubeUnderPointer(event);
      if (selectedCube) {
        isDragging = true;
        controls.enabled = false;
        selectedObject = selectedCube;
      }
    }

    // render();
    markNeedsRender()

  }


// async function onPointerUp(event) {
//   const { controls,scene, nonBloomScene } = share3dDat();

//   if (isDragging) {
//     await handleDrop_sphere(event)
//     isDragging = false;
//     controls.enabled = true; // Re-enable OrbitControls after dragging
//     selectedSphere = null;
//     selectedObject = null;
//     currentSnapshot = null;

//     if (CUBEINTERSECTED) {
//       resetCubeColor(CUBEINTERSECTED);
//       CUBEINTERSECTED = null;
//     }
//   removeEmptyCubes(scene, nonBloomScene);

//   }
// }


export function saveObjectChanges(objectData) {
  console.log("saveObjectChanges", objectData);
  if (!objectData) return;

  // if (objectData.type === 'sphere') {
  //   sceneState.updateObject({

  //     id: objectData.id,
  //     position: objectData.position,
  //     scale: objectData.scale,
  //     // Add any other properties that might have changed
  //   });
  // } else if (objectData.type === 'cube') {
  //   sceneState.updateObject({
  //     id: objectData.id,
  //     position: objectData.position.toArray(),
  //     // Add any other cube-specific properties that might have changed
  //   });
    sceneState.updateObject({
      type: objectData.type,
      id: objectData.id,
      position: objectData.position,
      scale: objectData.scale,
      size: objectData.size,
      lastEditedBy: loginName,
      // Add any other properties that might have changed
    });

    // Update positions of contained spheres if any
    if (objectData.containedSpheres) {
      objectData.containedSpheres.forEach(sphere => {
        sceneState.updateObject({
          type: objectData.type,
          id: objectData.id,
          position: objectData.position,
          scale: objectData.scale,
          size: objectData.size,
          lastEditedBy: loginName,
        });
      });
    }
  }



async function onPointerUp(event) {
  const { controls, scene, nonBloomScene } = share3dDat();

  if (isDragging) {
    await handleDrop_sphere(event);
    isDragging = false;
    controls.enabled = true; // Re-enable OrbitControls after dragging

    if (selectedSphere) {
      console.log("I am selectedSphere", selectedSphere);
  
      saveObjectChanges({
          type: 'sphere',
          id: selectedSphere.id,
          userData: {id: selectedSphere.userData.id},
          position: selectedSphere.position, // Make sure position is defined
          scale: selectedSphere.scale,       // Make sure scale is defined
          size: selectedSphere.geometry.parameters.radius, // Accessing size from geometry parameters
          color: selectedSphere.material.color.getHex()    // Correctly accessing color
      });
  }
   else if (selectedObject) {
      console.log("i am selectedObject", selectedObject);
      saveObjectChanges({
        type: 'cube',
        id: selectedObject.id,
        userData: {id: selectedObject.userData.id || "no ID"},
        id: selectedObject.wireframeCube.userData.id,
        position: selectedObject.wireframeCube.position,
        scale: selectedObject.scale,
        size: selectedObject.size,
        color: selectedObject.material.color,
        containedSpheres: selectedObject.containedSpheres.map(sphere => ({
          id: sphere.object.userData.id,
          position: sphere.object.position
        }))
      });
    }

    selectedSphere = null;
    selectedObject = null;
    currentSnapshot = null;

    if (CUBEINTERSECTED) {
      resetCubeColor(CUBEINTERSECTED);
      CUBEINTERSECTED = null;
    }

    removeEmptyCubes(scene, nonBloomScene);
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
    dragCube(selectedObject, intersectPoint);
  }

  requestAnimationFrame(render);
}, 16);  // Debounce to roughly 60fps

  
window.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
