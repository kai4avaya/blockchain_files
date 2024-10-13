// // createPointCloud.js
// import * as THREE from 'three';
// import { share3dDat, markNeedsRender } from './create.js';

// function createAnimatedPointCloud(reducedData, keywords, fileIds, clusters) {
//   const { scene, camera } = share3dDat();
  
//   console.log("Creating point cloud with:", {
//       dataPoints: reducedData.length,
//       clusters: clusters.length,
//       keywords: keywords.length,
//       fileIds: fileIds.length
//   });

//   if (reducedData.length === 0) {
//       console.error("No data points to create point cloud.");
//       return null;
//   }

//   const pointClouds = [];
//   const clusterColors = clusters.map(() => new THREE.Color(Math.random(), Math.random(), Math.random()));

//   clusters.forEach((cluster, clusterIndex) => {
//       if (cluster.length === 0) {
//           console.warn(`Cluster ${clusterIndex} is empty. Skipping.`);
//           return;
//       }

//       const geometry = new THREE.BufferGeometry();
//       const positions = new Float32Array(cluster.length * 3);
//       const colors = new Float32Array(cluster.length * 3);
//       const sizes = new Float32Array(cluster.length);

//       cluster.forEach((pointIndex, index) => {
//           if (pointIndex >= reducedData.length) {
//               console.error(`Invalid point index ${pointIndex} for cluster ${clusterIndex}. Max index is ${reducedData.length - 1}.`);
//               return;
//           }

//           const coords = reducedData[pointIndex];
//           positions[index * 3] = coords[0];
//           positions[index * 3 + 1] = coords[1];
//           positions[index * 3 + 2] = coords[2];

//           const color = clusterColors[clusterIndex];
//           colors[index * 3] = color.r;
//           colors[index * 3 + 1] = color.g;
//           colors[index * 3 + 2] = color.b;

//           sizes[index] = 0.5; // Increased from 0.1 to 0.5
//       });

//       geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
//       geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
//       geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

//       const material = new THREE.ShaderMaterial({
//           uniforms: {
//               time: { value: 0 },
//           },
//           vertexShader: `
//               attribute vec3 color;
//               attribute float size;
//               uniform float time;
//               varying vec3 vColor;
//               void main() {
//                   vColor = color;
//                   vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
//                   gl_PointSize = size * (1000.0 / -mvPosition.z) * (1.0 + 0.1 * sin(time + position.x * 10.0)); // Increased from 300.0 to 1000.0
//                   gl_Position = projectionMatrix * mvPosition;
//               }
//           `,
//           fragmentShader: `
//               varying vec3 vColor;
//               void main() {
//                   if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.475) discard;
//                   gl_FragColor = vec4(vColor, 1.0);
//               }
//           `,
//           transparent: true,
//       });

//       const pointCloud = new THREE.Points(geometry, material);
//       scene.add(pointCloud);

//       pointCloud.userData = {
//           clusterIndex,
//           keywords: cluster.map(index => keywords[index]),
//           fileIds: cluster.map(index => fileIds[index]),
//       };

//       pointClouds.push(pointCloud);

//       console.log(`Created point cloud for cluster ${clusterIndex} with ${cluster.length} points.`);
//   });

//   function animate() {
//       requestAnimationFrame(animate);
//       pointClouds.forEach(cloud => {
//           cloud.material.uniforms.time.value += 0.05;
//       });
//       markNeedsRender();
//   }
//   animate();

//   console.log(`Total point clouds created: ${pointClouds.length}`);

//   return pointClouds;
// }

// export { createAnimatedPointCloud };

// export function onPointCloudInteraction(event) {
//   const sharedData = share3dDat();
//   if (!sharedData || !sharedData.raycaster || !sharedData.camera || !sharedData.scene) {
//       console.warn('Required 3D objects are not available');
//       return;
//   }
  
//   const { raycaster, camera, scene } = sharedData;
  
//   // Update the picking ray with the camera and mouse position
//   const mouse = new THREE.Vector2(
//       (event.clientX / window.innerWidth) * 2 - 1,
//       -(event.clientY / window.innerHeight) * 2 + 1
//   );
//   raycaster.setFromCamera(mouse, camera);

//   // Calculate objects intersecting the picking ray
//   const intersects = raycaster.intersectObjects(scene.children);

//   if (intersects.length > 0) {
//       const intersectedPoint = intersects[0].object;
//       if (intersectedPoint && intersectedPoint.userData) {
//           const index = intersects[0].index;
//           if (index !== undefined && 
//               intersectedPoint.userData.fileIds && 
//               intersectedPoint.userData.keywords) {
//               // Display information about the intersected point
//               console.log('Intersected point:', {
//                   fileId: intersectedPoint.userData.fileIds[index],
//                   keywords: intersectedPoint.userData.keywords[index]
//               });
//           } else {
//               console.warn('Intersected point does not have expected userData');
//           }
//       } else {
//           console.warn('Intersected object does not have expected properties');
//       }
      
//       // You can add more interaction logic here, such as highlighting the point or showing a tooltip
//   }
// }
// // Add event listener for point cloud interaction

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { share3dDat, markNeedsRender } from './create.js';

let labelRenderer;
let currentLabel = null;
// let hoverTimeout;
  let lastCall = 0;
  const throttleMs = 50;
  function initializeLabelRenderer() {
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelRenderer.domElement.style.zIndex = '1'; // Ensure labels are on top
    document.body.appendChild(labelRenderer.domElement);
  }
  


function createAnimatedPointCloud(reducedData, keywords, fileIds, clusters, fileNames) { // Add fileNames parameter
  const { scene, camera } = share3dDat();

  if (!labelRenderer) {
    initializeLabelRenderer();
  }
  
  if (reducedData.length === 0) {
    console.error("No data points to create point cloud.");
    return null;
  }
  const pointClouds = [];
  const clusterColors = clusters.map(() => new THREE.Color(Math.random(), Math.random(), Math.random()));

  clusters.forEach((cluster, clusterIndex) => {
    if (cluster.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(cluster.length * 3);
    const colors = new Float32Array(cluster.length * 3);
    const sizes = new Float32Array(cluster.length);

    cluster.forEach((pointIndex, index) => {
      if (pointIndex >= reducedData.length) return;

      const coords = reducedData[pointIndex];
      positions.set(coords, index * 3);

      const color = clusterColors[clusterIndex];
      colors.set([color.r, color.g, color.b], index * 3);

      sizes[index] = 2.0; // Increase point size
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        attribute vec3 color;
        attribute float size;
        uniform float time;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (1000.0 / -mvPosition.z) * (1.0 + 0.1 * sin(time + position.x * 10.0));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.475) discard;
          gl_FragColor = vec4(vColor, 1.0);
        }
      `,
      transparent: true,
    });

    const pointCloud = new THREE.Points(geometry, material);
    pointCloud.frustumCulled = false; // Ensure all points are rendered
    scene.add(pointCloud);

   
    // Add error checking when setting userData
    pointCloud.userData = {
      clusterIndex,
      keywords: cluster.map(index => {
        if (index >= keywords.length) {
          console.warn(`Invalid keyword index ${index}. Max index is ${keywords.length - 1}.`);
          return undefined;
        }
        return keywords[index];
      }),
      fileIds: cluster.map(index => {
        if (index >= fileIds.length) {
          console.warn(`Invalid fileId index ${index}. Max index is ${fileIds.length - 1}.`);
          return undefined;
        }
        return fileIds[index];
      }),
      fileNames: fileNames ? cluster.map(index => {
        if (index >= fileNames.length) {
          console.warn(`Invalid fileName index ${index}. Max index is ${fileNames.length - 1}.`);
          return undefined;
        }
        return fileNames[index];
      }) : undefined
    };

    pointClouds.push(pointCloud);
  });

  function animate() {
    requestAnimationFrame(animate);
    pointClouds.forEach(cloud => {
      cloud.material.uniforms.time.value += 0.05;
    });
    if (labelRenderer) {
      labelRenderer.render(scene, camera);
    }
    markNeedsRender();
  }
  animate();

  return pointClouds;
}

// function createLabel(text) {
//   const labelDiv = document.createElement('div');
//   labelDiv.className = 'label';
//   labelDiv.textContent = text;
//   labelDiv.style.cssText = `
//     background-color: rgba(0,0,0,0.7);
//     color: white;
//     padding: 5px;
//     border-radius: 3px;
//     font-family: Arial, sans-serif;
//     font-size: 12px;
//     pointer-events: none;
//     white-space: nowrap;
//   `;
//   return new CSS2DObject(labelDiv);
// }

function createLabel(text) {
  const labelDiv = document.createElement('div');
  labelDiv.className = 'label';
  labelDiv.innerHTML = text; // Use innerHTML to support HTML tags
  labelDiv.style.cssText = `
    background-color: rgba(0,0,0,0.7);
    color: white;
    padding: 5px;
    border-radius: 3px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    pointer-events: none;
    white-space: nowrap;
    transform: translate(-50%, -50%); /* Center the label */
  `;
  return new CSS2DObject(labelDiv);
}

// function updateLabelPosition(label, camera, point) {
//   const vector = point.clone().project(camera);
//   const widthHalf = window.innerWidth / 2;
//   const heightHalf = window.innerHeight / 2;
//   vector.x = (vector.x * widthHalf) + widthHalf;
//   vector.y = -(vector.y * heightHalf) + heightHalf;

//   label.position.set(0, 0, 0);
//   label.element.style.transform = `translate(-50%, -50%) translate(${vector.x}px,${vector.y}px)`;
  
//   // Ensure label is always in view
//   const rect = label.element.getBoundingClientRect();
//   if (rect.left < 0) vector.x = rect.width / 2;
//   if (rect.right > window.innerWidth) vector.x = window.innerWidth - rect.width / 2;
//   if (rect.top < 0) vector.y = rect.height / 2;
//   if (rect.bottom > window.innerHeight) vector.y = window.innerHeight - rect.height / 2;
  
//   label.element.style.transform = `translate(-50%, -50%) translate(${vector.x}px,${vector.y}px)`;
// }
// const onPointCloudInteraction = (() => {
//   let lastCall = 0;
//   const throttleMs = 50;

//   return (event) => {
//     const now = Date.now();
//     if (now - lastCall < throttleMs) return;
//     lastCall = now;

//     const { raycaster, camera, scene } = share3dDat();
//     if (!raycaster || !camera || !scene) return;

//     const mouse = new THREE.Vector2(
//       (event.clientX / window.innerWidth) * 2 - 1,
//       -(event.clientY / window.innerHeight) * 2 + 1
//     );
//     raycaster.setFromCamera(mouse, camera);
//     raycaster.params.Points.threshold = 0.1; 
//     const intersects = raycaster.intersectObjects(scene.children);

//     if (intersects.length > 0) {
//       const intersectedPoint = intersects[0].object;
//       if (intersectedPoint instanceof THREE.Points) {
//         const index = intersects[0].index;
//         if (index !== undefined && 
//             intersectedPoint.userData.fileIds && 
//             intersectedPoint.userData.keywords &&
//             intersectedPoint.userData.fileNames) {
//           const fileId = intersectedPoint.userData.fileIds[index];
//           const keyword = intersectedPoint.userData.keywords[index];
//           const fileName = intersectedPoint.userData.fileNames[index];

//           if (currentLabel) {
//             scene.remove(currentLabel);
//           }

//           currentLabel = createLabel(`File: ${fileName}\nKeyword: ${keyword}`);
//           updateLabelPosition(currentLabel, camera, intersects[0].point);
//           scene.add(currentLabel);
          
//           console.log("Label created:", { fileName, keyword });
//         }
//       }
//     } else if (currentLabel) {
//       scene.remove(currentLabel);
//       currentLabel = null;
//     }
    
//     markNeedsRender();
//   };
// })();
function onPointCloudInteraction(event) {
  console.log("Mouse moved:", event.clientX, event.clientY); // Debug log

  const now = Date.now();
  if (now - lastCall < throttleMs) return;
  lastCall = now;

  const { raycaster, camera, scene } = share3dDat();
  if (!raycaster || !camera || !scene) {
    console.warn('Raycaster, camera, or scene is not available.');
    return;
  }
  console.log("i am a raycaster", raycaster);

  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  raycaster.params.Points.threshold = 0.1; 
  const intersects = raycaster.intersectObjects(scene.children);

  console.log("i am intersects!", intersects.length)
  if (intersects.length > 0) {
    const intersectedPoint = intersects[0].object;

    console.log("intersectedPoint", intersectedPoint)
    if (intersectedPoint instanceof THREE.Points) {

      const index = intersects[0].index;
      if (
        index !== undefined && 
        intersectedPoint.userData.fileIds && 
        intersectedPoint.userData.keywords &&
        intersectedPoint.userData.fileNames
      ) {
        const fileId = intersectedPoint.userData.fileIds[index];
        const keyword = intersectedPoint.userData.keywords[index];
        const fileName = intersectedPoint.userData.fileNames[index];

        console.log("Hovered over point:", { fileId, keyword, fileName });

        if (currentLabel) {
          scene.remove(currentLabel);
          currentLabel = null;
        }

        // Create label text with HTML line breaks
        currentLabel = createLabel(`File: ${fileName}<br>Keyword: ${keyword}`);
        // Set the label's position to the intersected point's position
        currentLabel.position.copy(intersects[0].point);
        scene.add(currentLabel);
        
        console.log("Label created:", { fileName, keyword });
      }
    }
  } else if (currentLabel) {
    scene.remove(currentLabel);
    currentLabel = null;
    console.log("Label removed.");
  }
  
  markNeedsRender();
}




// function updateLabels() {
//   if (currentLabel) {
//     const { camera } = share3dDat();
//     updateLabelPosition(currentLabel, camera, currentLabel.position);
//   }
// }



window.addEventListener('mousemove', onPointCloudInteraction, false);
window.addEventListener('resize', () => {
  const { camera, renderer } = share3dDat();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
}, false);

export { createAnimatedPointCloud, initializeLabelRenderer };