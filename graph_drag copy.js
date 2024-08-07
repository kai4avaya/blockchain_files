import { createSphere, share3dDat, render } from './graph.js';
import * as THREE from 'three';

let camera, scene, renderer, mouse;

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
    return Math.log(fileSize + 1) / Math.log(1024) * (maxSize - minSize) + minSize;
  }
  
  function setupDragAndDrop() {
    window.addEventListener('dragover', (event) => {
      event.preventDefault();
    });
  
    window.addEventListener('drop', (event) => {
      event.preventDefault();
    //   initializeScene() 

      const { camera, scene, renderer, mouse } = share3dDat();
    
      const dt = event.dataTransfer;
      const fileList = dt.files;
  
      console.log("camera", camera);
      console.log("scene", scene);
      console.log("renderer", renderer);
      console.log("mouse", mouse);


      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, false);
  
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const size = normalizeSize(file.size);
        let x, y, z;
        // x = mouse.x;
        // y = mouse.y;
  
        if (intersects.length > 0) {
          const intersect = intersects[0];
          x = intersect.point.x;
          y = intersect.point.y;
          z = intersect.point.z;
  
          if (intersect.object.geometry.type === 'BoxGeometry') {
            // If intersecting with a cube, highlight it
            intersect.object.material.color.set(0xff0000);
          } else if (intersect.object.geometry.type === 'SphereGeometry') {
            // If intersecting with a sphere, create a cube around it and add a new sphere
            const spherePosition = intersect.point;
            const cube = new THREE.Mesh(
              new THREE.BoxGeometry(size, size, size),
              new THREE.MeshBasicMaterial({ color: 0x00ff00 })
            );
            cube.position.copy(spherePosition);
            scene.add(cube);
  
            createSphere(spherePosition.x, spherePosition.y, spherePosition.z, size);
          } else {
            // Drop at intersect point
            createSphere(x, y, z, size);
          }
        } else {
          // Drop at mouse position if no intersection
          x = (event.clientX / window.innerWidth) * 2 - 1;
          y = -(event.clientY / window.innerHeight) * 2 + 1;
          z = 0;
  
          raycaster.setFromCamera({ x, y }, camera);
          const direction = raycaster.ray.direction.clone().multiplyScalar(100);
          const dropPosition = raycaster.ray.origin.clone().add(direction);
  
          createSphere(dropPosition.x, dropPosition.y, dropPosition.z, size);
        }
      }
    });
  }


  
window.addEventListener('mousemove', (event) => {
    const { camera, scene, renderer, mouse } = share3dDat();

    if(mouse)
    {
    // console.log("mouse in move", mouse)

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        addMouseTrail(mouse.x, mouse.y);
    }
});

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


  window.addEventListener('dragleave', (event) => {
    event.preventDefault();
    if (INTERSECTED) {
      INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
      INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
      INTERSECTED = null;
    }
  });
  
  function addMouseTrail(x, y) {
    const { camera, scene, renderer, mouse } = share3dDat();

    console.log("addMouseTrail", x, y);
    raycaster.setFromCamera({ x, y }, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
  
    let point;
    if (intersects.length > 0) {
      point = intersects[0].point;
    } else {
      const direction = raycaster.ray.direction.clone().multiplyScalar(1000);
      point = raycaster.ray.origin.clone().add(direction);
    }
  
    const geometry = new THREE.SphereGeometry(0.3, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(point);
  
    scene.add(sphere);
    console.log("I am sphere", sphere)
    render()
  }