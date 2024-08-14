import {
  createSphere,
  share3dDat,
  createWireframeCube,
  render
} from "./graph.js";
import {handleFileDrop} from "./memory/fileHandler.js";
import * as THREE from "three";
import { getSceneSnapshot } from "./graph_snapshot.js";

setupDragAndDrop();
let CUBEINTERSECTED;

function normalizeSize(fileSize) {
  const maxSize = 10;
  const minSize = 1;
  return (
    (Math.log(fileSize + 1) / Math.log(1024)) * (maxSize - minSize) + minSize
  );
}

function checkIntersections(raycaster, scenes) {
  let allIntersects = [];

  scenes.forEach(scene => {
    const intersects = raycaster.intersectObjects(scene.children, false);
    allIntersects = [...allIntersects, ...intersects];
  });

  allIntersects.sort((a, b) => a.distance - b.distance);

  return allIntersects;
}

function changeCubeColor(intersects, isHovering) {
  let foundSolidCube = false;

  for (let i = 0; i < intersects.length; i++) {
    const intersectedObject = intersects[i].object;

    if (intersectedObject.isMesh && intersectedObject.geometry.type === "BoxGeometry") {
      foundSolidCube = true;
      console.log("Found solid cube, isHovering:", isHovering);

      if (CUBEINTERSECTED !== intersectedObject) {
        if (CUBEINTERSECTED) {
          console.log("Resetting previous cube");
          resetCubeColor(CUBEINTERSECTED);
        }

        CUBEINTERSECTED = intersectedObject;
        if (isHovering) {
          console.log("Highlighting new cube");
          highlightCube(CUBEINTERSECTED);
        }
      } else if (isHovering) {
        // Ensure the cube stays highlighted while hovering
        highlightCube(CUBEINTERSECTED);
      }
      break;
    }
  }

  if (!foundSolidCube && CUBEINTERSECTED) {
    console.log("No solid cube found, resetting");
    resetCubeColor(CUBEINTERSECTED);
    CUBEINTERSECTED = null;
  }
  render();
}


function highlightCube(cube) {
  console.log("Highlighting cube:", cube);
  if (!cube.originalMaterial) {
    cube.originalMaterial = cube.material.clone();
  }
  cube.material = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.8 });
  cube.material.needsUpdate = true;
}

function resetCubeColor(cube) {
  console.log("Resetting cube color:", cube);
  if (cube.originalMaterial) {
    cube.material = cube.originalMaterial;
    cube.material.needsUpdate = true;
  }
}


function setupDragAndDrop() {
  window.addEventListener("dragover", (event) => {
    event.preventDefault();
    console.log("Drag over event");
    onPointerMove(event, true);
  });

  window.addEventListener("drop", async (event) => {
    event.preventDefault();
    console.log("Drop event");

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

      console.log("uuids from file drop", uuids)

      if (allIntersects.length > 0) {
        const intersect = allIntersects[0];
        dropPosition = intersect.point;

        if (intersect.object.geometry.type === "EdgesGeometry" || intersect.object.geometry.type === "BoxGeometry") {
          intersect.object.material.color.set(0xff0000);
          // x, y, z, size, id = ""
          createSphere(dropPosition.x, dropPosition.y, dropPosition.z, size, uuids[i]);
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
          createSphere(dropPosition.x, dropPosition.y, dropPosition.z, size, uuids[i]);
        } else {
          createSphere(dropPosition.x, dropPosition.y, dropPosition.z, size, uuids[i]);
        }
      } else {
        const planeDistance = -10;
        const plane = new THREE.Plane(
          new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
          planeDistance
        );

        dropPosition = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, dropPosition);

        createSphere(dropPosition.x, dropPosition.y, dropPosition.z, size, uuids[i]);

      }
    }

    // Reset cube highlighting after drop
    if (CUBEINTERSECTED) {
      resetCubeColor(CUBEINTERSECTED);
      CUBEINTERSECTED = null;
    }
   const snapshot = getSceneSnapshot([scene, nonBloomScene]);
   console.log("Drop snapshot:", snapshot);
  });

  window.addEventListener("dragleave", (event) => {
    event.preventDefault();
    console.log("Drag leave event");
    if (CUBEINTERSECTED) {
      resetCubeColor(CUBEINTERSECTED);
      CUBEINTERSECTED = null;
    }
  });
}


function onPointerMove(event, isDragging = false) {
  const { camera, scene, nonBloomScene, raycaster, mouse } = share3dDat();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);

  console.log("Pointer move, isDragging:", isDragging);
  changeCubeColor(allIntersects, isDragging);
}
