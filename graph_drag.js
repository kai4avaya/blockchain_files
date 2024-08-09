import {
  createSphere,
  share3dDat,
  render,
  createWireframeCube,
} from "./graph.js";
import * as THREE from "three";

// let camera, scene, renderer, mouse;
const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.PointsMaterial({
  color: 0xff0000,
  size: 0.5,
  sizeAttenuation: true,
});
const trailPoints = new THREE.Points(trailGeometry, trailMaterial);

let first = 1;

// Throttle mouse move events
let lastMoveTime = 0;
const MOVE_THROTTLE = 16; // ~ 60 fps

// export function addMouseTrail(x, y) {
//   const { camera, scene, raycaster } = share3dDat();

//   raycaster.setFromCamera({ x, y }, camera);

//   // Compute the position directly in front of the camera
//   const direction = raycaster.ray.direction.clone().multiplyScalar(100); // Adjust the scalar for depth
//   const point = raycaster.ray.origin.clone().add(direction);

//   // Create a sphere at the computed position
//   const sphereGeometry = new THREE.SphereGeometry(0.1, 8, 8); // Adjust size as needed
//   const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color
//   const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
//   sphere.position.copy(point);
//   scene.add(sphere);

//   setTimeout(() => {
//     scene.remove(sphere);
//     sphere.geometry.dispose();
//     sphere.material.dispose();
//     console.log(`Removed sphere at: (${point.x}, ${point.y}, ${point.z})`);

//   }, 1000); // 1000 ms = 1 second
//   console.log(`Added sphere at: (${point.x}, ${point.y}, ${point.z})`);

//   render();
// }
// window.addEventListener('mousemove', (event) => {
//   const currentTime = performance.now();
//   if (currentTime - lastMoveTime < MOVE_THROTTLE) return;
//   lastMoveTime = currentTime;

//   const { mouse, scene, nonBloomScene } = share3dDat();

//   if (first) {
//     scene.add(trailPoints);
//     first = 0;
//   }

//   if (mouse) {
//     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
//     addMouseTrail(mouse.x, mouse.y);
//   }
// });

// async function initializeScene() {

//     await isRendererReadyPromise();

//     const { camera: cameraB, scene: sceneB, renderer: rendererB, mouse: mouseB } = share3dDat();

//     camera = cameraB;
//     scene = sceneB;
//     renderer = rendererB;
//     mouse = mouseB;

//     console.log("camera", camera);
//     console.log("scene", scene);
//     console.log("renderer", renderer);
//     console.log("mouse", mouse);

//     // setupDragAndDrop();
// }

// await initializeScene()
setupDragAndDrop();
let INTERSECTED;
// initializeScene();

const raycaster = new THREE.Raycaster();

// function normalizeSize(fileSize) {
//   const maxSize = 10;
//   const minSize = 1;
//   return Math.log(fileSize + 1) / Math.log(1024) * (maxSize - minSize) + minSize;
// }

// function setupDragAndDrop() {
//   window.addEventListener('dragover', (event) => {
//     event.preventDefault();
//   });

//   window.addEventListener('drop', (event) => {

//     event.preventDefault();

//   const { camera, scene, renderer, mouse } = share3dDat();

//     const dt = event.dataTransfer;
//     const fileList = dt.files;

//     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//     raycaster.setFromCamera(mouse, camera);
//     const intersects = raycaster.intersectObjects(scene.children, false);

//     for (let i = 0; i < fileList.length; i++) {
//       const file = fileList[i];
//       const size = normalizeSize(file.size);

//       let x, y, z;

//       if (intersects.length > 0) {
//         const intersect = intersects[0];
//         x = intersect.point.x;
//         y = intersect.point.y;
//         z = intersect.point.z;
//       } else {
//         x = Math.random() * 10 - 5;
//         y = Math.random() * 10 - 5;
//         z = Math.random() * 10 - 5;
//       }

//       createSphere(x, y, z, size);
//     }
//   });
// }

// window.addEventListener('dragleave', (event) => {
//   event.preventDefault();
//   if (INTERSECTED) {
//     INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
//     INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
//     INTERSECTED = null;
//   }
// });

// window.addEventListener('drop', (event) => {
//   event.preventDefault();
//   const dt = event.dataTransfer;
//   const fileList = dt.files;

//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//   raycaster.setFromCamera(mouse, camera);
//   const intersects = raycaster.intersectObjects(cubes.map(cube => cube.solidCube), false);

//   for (let i = 0; i < fileList.length; i++) {
//     const file = fileList[i];

//     if (intersects.length > 0) {
//       const cube = intersects[0].object;
//       const data = { file, position: cube.position, cube };
//       createFilePoint(data);
//     } else {
//       const dropPosition = new THREE.Vector3(
//         THREE.MathUtils.randFloatSpread(400),
//         THREE.MathUtils.randFloatSpread(400),
//         THREE.MathUtils.randFloatSpread(400)
//       );
//       const data = { file, position: dropPosition };
//       createFilePoint(data);
//     }
//   }

//   if (INTERSECTED) {
//     INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
//     INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
//     INTERSECTED = null;
//   }
// });

// // for debugging mouse position
// function addMouseTrail(x, y) {
//     console.log("addMouseTrail", x, y);
//     // Set raycaster from camera and mouse position
//     raycaster.setFromCamera({ x, y }, camera);
//     const intersects = raycaster.intersectObjects(scene.children, true);

//     let point;
//     if (intersects.length > 0) {
//       point = intersects[0].point;
//     } else {
//       // If no intersection, set a point far away in the direction of the ray
//       const direction = raycaster.ray.direction.clone().multiplyScalar(1000);
//       point = raycaster.ray.origin.clone().add(direction);
//     }

//     // Sphere geometry
//     const geometry = new THREE.SphereGeometry(2, 8, 8);
//     const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
//     const sphere = new THREE.Mesh(geometry, material);
//     sphere.position.copy(point);

//     scene.add(sphere);
//   }

function normalizeSize(fileSize) {
  const maxSize = 10;
  const minSize = 1;
  return (
    (Math.log(fileSize + 1) / Math.log(1024)) * (maxSize - minSize) + minSize
  );
}
function setupDragAndDrop() {
  window.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  window.addEventListener("drop", (event) => {
    event.preventDefault();

    const { camera, scene, renderer, raycaster, mouse } = share3dDat();

    const dt = event.dataTransfer;
    const fileList = dt.files;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, false);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const size = normalizeSize(file.size);
      let dropPosition;

      if (intersects.length > 0) {
        const intersect = intersects[0];
        dropPosition = intersect.point;

        if (intersect.object.geometry.type === "BoxGeometry") {
          intersect.object.material.color.set(0xff0000);
          console.log("Intersecting with a cube");
        } else if (intersect.object.geometry.type === "SphereGeometry") {
          console.log("Intersecting with a sphere");
          createWireframeCube(
            size,
            dropPosition.x,
            dropPosition.y,
            dropPosition.z,
            0xff0000
          );
          createSphere(dropPosition.x, dropPosition.y, dropPosition.z, size);
        } else {
          console.log("Unknown geometry type");
          createSphere(dropPosition.x, dropPosition.y, dropPosition.z, size);
        }
      } else {
        console.log("No intersection");

        // Adjust to drop at the actual mouse position
        // const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion), -camera.position.z);
        const planeDistance = -10; // This can be a small negative value to position the object slightly in front of the camera
        const plane = new THREE.Plane(
          new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
          planeDistance
        );

        dropPosition = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, dropPosition);
        console.log(
          "dropPosition.x, dropPosition.y, dropPosition.z, size",
          dropPosition.x,
          dropPosition.y,
          dropPosition.z,
          size
        );

        createSphere(dropPosition.x, dropPosition.y, dropPosition.z, size);
      }
    }
  });
}

// function setupDragAndDrop() {
//   window.addEventListener('dragover', (event) => {
//     event.preventDefault();
//   });

//   window.addEventListener('drop', (event) => {
//     event.preventDefault();
//   //   initializeScene()

//     const { camera, scene, renderer, mouse } = share3dDat();

//     const dt = event.dataTransfer;
//     const fileList = dt.files;

//     console.log("camera", camera);
//     console.log("scene", scene);
//     console.log("renderer", renderer);
//     console.log("mouse", mouse);

//     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//     raycaster.setFromCamera(mouse, camera);
//     const intersects = raycaster.intersectObjects(scene.children, false);

//     for (let i = 0; i < fileList.length; i++) {
//       const file = fileList[i];
//       const size = normalizeSize(file.size);
//       let x, y, z;
//       // x = mouse.x;
//       // y = mouse.y;

//       if (intersects.length > 0) {
//         const intersect = intersects[0];
//         x = intersect.point.x;
//         y = intersect.point.y;
//         z = intersect.point.z;

//         if (intersect.object.geometry.type === 'BoxGeometry') {
//           // If intersecting with a cube, highlight it
//           intersect.object.material.color.set(0xff0000);
//           console.log("intersecting with a cube");
//         } else if (intersect.object.geometry.type === 'SphereGeometry') {
//           console.log("intersecting with a sphere");
//           // If intersecting with a sphere, create a cube around it and add a new sphere
//           // const spherePosition = intersect.point;
//           // const cube = new THREE.Mesh(
//           //   new THREE.BoxGeometry(size, size, size),
//           //   new THREE.MeshBasicMaterial({ color: 0x00ff00 })
//           // );
//           // cube.position.copy(spherePosition);
//           // scene.add(cube);

//           createWireframeCube(size, x,y,z, 0xff0000);

//           createSphere(spherePosition.x, spherePosition.y, spherePosition.z, size);
//         } else {
//           console.log("unknown geometry type");
//           // Drop at intersect point
//           createSphere(x, y, z, size);
//         }
//       } else {
//         console.log("no intersection");
//         // Drop at mouse position if no intersection
//         x = (event.clientX / window.innerWidth) * 2 - 1;
//         y = -(event.clientY / window.innerHeight) * 2 + 1;
//         z = 0;

//         raycaster.setFromCamera({ x, y }, camera);
//         const direction = raycaster.ray.direction.clone().multiplyScalar(100);
//         const dropPosition = raycaster.ray.origin.clone().add(direction);

//         createSphere(dropPosition.x, dropPosition.y, dropPosition.z, size);
//       }
//     }
//   });
// }

//   function setupDragAndDrop() {
//   window.addEventListener('dragover', (event) => {
//     event.preventDefault();
//   });

//   window.addEventListener('drop', (event) => {
//     event.preventDefault();

//     const { camera,mouse, scene,nonBloomScene, raycaster } = share3dDat();

//     const dt = event.dataTransfer;
//     const fileList = dt.files;

//     raycaster.setFromCamera(mouse, camera);
//     const intersects = raycaster.intersectObjects(scene.children, true);

//     for (let i = 0; i < fileList.length; i++) {
//       const file = fileList[i];
//       const size = normalizeSize(file.size);

//       let x, y, z;
//       let intersectedSpheres = [];

//       // Check if any spheres were intersected
//       intersects.forEach(intersect => {
//         if (intersect.object.geometry.type === 'IcosahedronGeometry' && intersect.object.material.color.getHex() === 0xff0000) {
//           intersectedSpheres.push(intersect.object);
//         }
//       });

//       if (intersectedSpheres.length > 0) {
//         // If spheres were intersected, calculate the bounding box for the cube
//         const boundingBox = new THREE.Box3();

//         intersectedSpheres.forEach(sphere => boundingBox.expandByObject(sphere));

//         // Adjust the bounding box to fit the new sphere
//         x = boundingBox.getCenter(new THREE.Vector3()).x;
//         y = boundingBox.getCenter(new THREE.Vector3()).y;
//         z = boundingBox.getCenter(new THREE.Vector3()).z;
//         boundingBox.expandByPoint(new THREE.Vector3(x, y, z).addScalar(size));

//         // Create or update the cube to fit around the spheres
//         if (boundingBox.min.length() > 0 && boundingBox.max.length() > 0) {
//           const cubeSize = boundingBox.getSize(new THREE.Vector3());
//           const cubeGeometry = new THREE.BoxGeometry(cubeSize.x, cubeSize.y, cubeSize.z);
//           const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
//           const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
//           cube.position.copy(boundingBox.getCenter(new THREE.Vector3()));
//           nonBloomScene.add(cube);
//         }
//       } else {
//          //         // Drop at mouse position if no intersection
//           x = (event.clientX / window.innerWidth) * 2 - 1;
//           y = -(event.clientY / window.innerHeight) * 2 + 1;
//           z = Math.random() * 10 - 5;

//         // No spheres intersected, place the sphere randomly in the scene
//         // x = Math.random() * 10 - 5;
//         // y = Math.random() * 10 - 5;
//         // z = Math.random() * 10 - 5;
//         createSphere(x, y, z, size);
//       }
//     }
//   });
// }

// window.addEventListener('mousemove', (event) => {
//     const { camera, scene, renderer, mouse } = share3dDat();

//     if(mouse)
//     {
//     // console.log("mouse in move", mouse)

//         mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//         mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
//         addMouseTrail(mouse.x, mouse.y);
//     }
// });

// window.addEventListener('dragover', (event) => {
//   event.preventDefault();
//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
//   checkIntersections();
// });

// window.addEventListener('dragleave', (event) => {
//   event.preventDefault();
//   if (INTERSECTED) {
//     INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
//     INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
//     INTERSECTED = null;
//   }
// });

// window.addEventListener('drop', (event) => {
//   event.preventDefault();
//   const dt = event.dataTransfer;
//   const fileList = dt.files;

//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//   raycaster.setFromCamera(mouse, camera);
//   const intersects = raycaster.intersectObjects(cubes.map(cube => cube.solidCube), false);

//   for (let i = 0; i < fileList.length; i++) {
//     const file = fileList[i];

//     if (intersects.length > 0) {
//       const cube = intersects[0].object;
//       const data = { file, position: cube.position, cube };
//       createFilePoint(data);
//     } else {
//       const dropPosition = new THREE.Vector3(
//         THREE.MathUtils.randFloatSpread(400),
//         THREE.MathUtils.randFloatSpread(400),
//         THREE.MathUtils.randFloatSpread(400)
//       );
//       const data = { file, position: dropPosition };
//       createFilePoint(data);
//     }
//   }

//   if (INTERSECTED) {
//     INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
//     INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
//     INTERSECTED = null;
//   }
// });

window.addEventListener("dragleave", (event) => {
  event.preventDefault();
  if (INTERSECTED) {
    INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
    INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
    INTERSECTED = null;
  }
});

// function addMouseTrail(x, y) {
//   const { camera, scene, renderer, mouse } = share3dDat();

//   console.log("addMouseTrail", x, y);
//   raycaster.setFromCamera({ x, y }, camera);
//   const intersects = raycaster.intersectObjects(scene.children, true);

//   let point;
//   if (intersects.length > 0) {
//     point = intersects[0].point;
//   } else {
//     const direction = raycaster.ray.direction.clone().multiplyScalar(1000);
//     point = raycaster.ray.origin.clone().add(direction);
//   }

//   const geometry = new THREE.SphereGeometry(0.3, 8, 8);
//   const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
//   const sphere = new THREE.Mesh(geometry, material);
//   sphere.position.copy(point);

//   scene.add(sphere);
//   console.log("I am sphere", sphere)
//   render()
// }
