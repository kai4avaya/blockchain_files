import * as THREE from 'three';
import { Raycaster, Vector2 } from 'three'; // Import Raycaster and Vector2
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { share3dDat, markNeedsRender } from './create.js';

let labelRenderer;
let currentLabel = null;
let lastCall = 0;
const throttleMs = 50;

// Initialize a raycaster if not present in share3dDat
function getRaycaster() {
  const sharedData = share3dDat();
  if (!sharedData.raycaster) {
    sharedData.raycaster = new Raycaster();
  }
  return sharedData.raycaster;
}

function initializeLabelRenderer() {
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none';
  labelRenderer.domElement.style.zIndex = '1'; // Ensure labels are on top
  document.body.appendChild(labelRenderer.domElement);
}
function createAnimatedPointCloud(reducedData, keywords, fileIds, clusters, fileNames) {
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

    cluster.forEach((pointIndex, index) => {
      if (pointIndex >= reducedData.length) return;

      const coords = reducedData[pointIndex];
      positions.set(coords, index * 3);

      const color = clusterColors[clusterIndex];

      console.log(`Created point cloud for cluster ${clusterIndex} with ${cluster.length} points. Color: #${clusterColors[clusterIndex].getHexString()}`);
      colors.set([color.r, color.g, color.b], index * 3);
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        attribute vec3 color;
        uniform float time;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 20.0 * (1000.0 / -mvPosition.z) * (1.0 + 0.1 * sin(time + position.x * 10.0));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 cxy = 2.0 * gl_PointCoord - 1.0;
          float r = dot(cxy, cxy);
          float alpha = 1.0 - smoothstep(0.5, 1.0, r);
          gl_FragColor = vec4(vColor, alpha * 0.7);
        }
      `,
      transparent: true,
    });

    const shaderPointCloud = new THREE.Points(geometry, shaderMaterial);
    shaderPointCloud.frustumCulled = false;
    scene.add(shaderPointCloud);

    shaderPointCloud.userData = {
      clusterIndex,
      keywords: cluster.map(index => keywords[index]),
      fileIds: cluster.map(index => fileIds[index]),
      fileNames: fileNames ? cluster.map(index => fileNames[index]) : undefined
    };

    pointClouds.push(shaderPointCloud);
    console.log(`Created point cloud for cluster ${clusterIndex} with ${cluster.length} points.`);
  });

  function animate() {
    requestAnimationFrame(animate);
    pointClouds.forEach(cloud => {
      if (cloud.material.uniforms && cloud.material.uniforms.time) {
        cloud.material.uniforms.time.value += 0.05;
      }
    });
    if (labelRenderer) {
      labelRenderer.render(scene, camera);
    }
    markNeedsRender();
  }
  animate();

  console.log(`Total point clouds created: ${pointClouds.length}`);
 // Initialize event listeners after creating the point cloud
 initializeEventListeners();
  return pointClouds;
}


function createLabel(text) {
  const labelDiv = document.createElement('div');
  labelDiv.className = 'label';
  labelDiv.innerHTML = text;
  labelDiv.style.cssText = `
    background-color: rgba(0,0,0,0.8);
    color: white;
    padding: 8px;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    pointer-events: none;
    white-space: nowrap;
    transform: translate(-50%, -100%);
    z-index: 1000;
  `;
  return new CSS2DObject(labelDiv);
}
function createInvisiblePointerPointCloud(reducedData, fileIds, keywords, fileNames) {
  const { scene } = share3dDat();
  const pointerGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(reducedData.length * 3);
  
  // Populate positions
  for (let i = 0; i < reducedData.length; i++) {
    positions.set(reducedData[i], i * 3);
  }
  
  pointerGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const pointerMaterial = new THREE.PointsMaterial({
    size: 20.0, // Large size for easy detection
    transparent: true,
    opacity: 0.0, // Fully transparent
  });
  
  const pointerPoints = new THREE.Points(pointerGeometry, pointerMaterial);
  pointerPoints.name = 'invisiblePointer'; // Assign a unique name
  
  // Assign userData for raycasting
  pointerPoints.userData = {
    fileIds: fileIds,
    keywords: keywords,
    fileNames: fileNames,
  };
  
  scene.add(pointerPoints);
  console.log("Invisible pointer point cloud created.");
  
  return pointerPoints;
}
function onPointCloudInteraction(event) {
  const now = Date.now();
  if (now - lastCall < throttleMs) return;
  lastCall = now;

  const { camera, scene, renderer } = share3dDat();
  if (!camera || !scene || !renderer) {
    console.warn('Camera, scene, or renderer is not available.');
    return;
  }

  const raycaster = getRaycaster();

  const mouse = new Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  
  raycaster.params.Points.threshold = 0.5;

  const pointClouds = scene.children.filter(child => child instanceof THREE.Points);
  console.log("Number of point clouds:", pointClouds.length);

  const intersects = raycaster.intersectObjects(pointClouds);
  console.log("Number of intersections:", intersects.length);

  if (intersects.length > 0) {
    const intersectedPoint = intersects[0].object;
    const index = intersects[0].index;
    console.log("Intersected object:", intersectedPoint);
    console.log("Intersection index:", index);

    if (index !== undefined && intersectedPoint.userData.fileIds && 
        intersectedPoint.userData.keywords && intersectedPoint.userData.fileNames) {
      const fileId = intersectedPoint.userData.fileIds[index];
      const keyword = intersectedPoint.userData.keywords[index];
      const fileName = intersectedPoint.userData.fileNames[index];

      console.log("Hovered over point:", { fileId, keyword, fileName });

      if (currentLabel) {
        scene.remove(currentLabel);
      }

      currentLabel = createLabel(`File: ${fileName}<br>Keyword: ${keyword}`);
      currentLabel.position.copy(intersects[0].point);
      scene.add(currentLabel);
      console.log("Label added to scene at position:", currentLabel.position);
    } else {
      console.log("Missing user data for intersection");
    }
  } else if (currentLabel) {
    scene.remove(currentLabel);
    currentLabel = null;
    console.log("Label removed");
  }
  
  if (labelRenderer) {
    labelRenderer.render(scene, camera);
  }
  renderer.render(scene, camera);
  markNeedsRender();
}

// window.addEventListener('mousemove', onPointCloudInteraction, false);
// window.addEventListener('resize', () => {
//   const { camera, renderer } = share3dDat();
//   camera.aspect = window.innerWidth / window.innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(window.innerWidth, window.innerHeight);
//   if (labelRenderer) {
//     labelRenderer.setSize(window.innerWidth, window.innerHeight);
//   }
// }, false);

function initializeEventListeners() {
  window.addEventListener('mousemove', onPointCloudInteraction, false);
  window.addEventListener('resize', () => {
    const { camera, renderer } = share3dDat();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (labelRenderer) {
      labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
  }, false);
  
  console.log("Event listeners initialized.");
}

export { createAnimatedPointCloud, initializeLabelRenderer, initializeEventListeners };