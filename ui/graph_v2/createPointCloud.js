import * as THREE from 'three';
import { Raycaster, Vector2 } from 'three'; // Import Raycaster and Vector2
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { share3dDat, markNeedsRender } from './create.js';
import {throttle} from '../../utils/utils'
import gsap from 'gsap';


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

function generateDistinctColors(numClusters) {
  const colors = [];
  const goldenRatioConjugate = 0.618033988749895;
  let hue = Math.random();

  for (let i = 0; i < numClusters; i++) {
    hue += goldenRatioConjugate;
    hue %= 1;
    const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
    colors.push(color);
  }

  return colors;
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
  const clusterColors = generateDistinctColors(clusters.length);

  // Scale factor to increase separation between points
  const scaleFactor = 1;

  // Jitter amount
  const jitterAmount = 0.05;

  clusters.forEach((cluster, clusterIndex) => {
    if (cluster.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(cluster.length * 3);
    const colors = new Float32Array(cluster.length * 3);
    const sizes = new Float32Array(cluster.length);

    cluster.forEach((pointIndex, index) => {
      if (pointIndex >= reducedData.length) return;

      const coords = reducedData[pointIndex];
      
      // Apply scaling and jittering
      const scaledCoords = coords.map(coord => coord * scaleFactor);
      const jitteredCoords = scaledCoords.map(coord => 
        coord + (Math.random() - 0.5) * jitterAmount
      );

      positions.set(jitteredCoords, index * 3);

      const color = clusterColors[clusterIndex];
      colors.set([color.r, color.g, color.b], index * 3);

      sizes[index] = 50.0; // Set a larger initial size
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: { 
        time: { value: 0 },
        pointSize: { value: 1.0 } // We'll multiply this with the size attribute
      },
      vertexShader: `
        attribute vec3 color;
        attribute float size;
        uniform float time;
        uniform float pointSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * pointSize * (300.0 / -mvPosition.z) * (1.0 + 0.2 * sin(time + position.x * 10.0));
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

    // Animate point sizes
    gsap.to(sizes, {
      duration: 2,
      ease: "power2.out",
      onUpdate: () => {
        geometry.attributes.size.needsUpdate = true;
      }
    });

    console.log(`Created point cloud for cluster ${clusterIndex} with ${cluster.length} points.`);
  });

  function adjustPointSize(pointClouds, size) {
    pointClouds.forEach(cloud => {
      if (cloud.material.uniforms && cloud.material.uniforms.pointSize) {
        cloud.material.uniforms.pointSize.value = size;
      }
    });
  }
  
  function adjustPointSizeAndGlow(pointClouds, size, glow) {
    pointClouds.forEach(cloud => {
      if (cloud.material.uniforms) {
        cloud.material.uniforms.pointSize.value = size;
        cloud.material.fragmentShader = `
          varying vec3 vColor;
          void main() {
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            float r = dot(cxy, cxy);
            float alpha = 1.0 - smoothstep(0.5, 1.0, r);
            gl_FragColor = vec4(vColor, alpha * ${glow.toFixed(2)});
          }
        `;
        cloud.material.needsUpdate = true;
      }
    });
  }
  
  verifySceneScale();


  // addDebugVisualization()

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

  const pointClouds = scene.children.filter(child => child instanceof THREE.Points);
  const intersects = raycaster.intersectObjects(pointClouds);

  if (intersects.length > 0) {
    const intersectedPoint = intersects[0].object;
    const index = intersects[0].index;

    if (index !== undefined && intersectedPoint.userData.fileIds && 
        intersectedPoint.userData.keywords && intersectedPoint.userData.fileNames) {
      // const fileId = intersectedPoint.userData.fileIds[index];
      const keyword = intersectedPoint.userData.keywords[index];
      const fileName = intersectedPoint.userData.fileNames[index];

      if (!currentLabel || currentLabel.userData.index !== index) {
        if (currentLabel) {
          scene.remove(currentLabel);
        }

        currentLabel = createLabel(`File: ${fileName}<br>Keyword: ${keyword}`);
        currentLabel.position.copy(intersects[0].point);
        currentLabel.userData.index = index; // Store the index to check if we're still on the same point
        scene.add(currentLabel);
      }
    }
  } else if (currentLabel) {
    scene.remove(currentLabel);
    currentLabel = null;
  }
  
  if (labelRenderer) {
    labelRenderer.render(scene, camera);
  }
  renderer.render(scene, camera);
  markNeedsRender();
}

function verifySceneScale() {
  const { scene, camera } = share3dDat();
  const boundingBox = new THREE.Box3().setFromObject(scene);
  const center = boundingBox.getCenter(new THREE.Vector3());
  const size = boundingBox.getSize(new THREE.Vector3());

  console.log("Scene Bounding Box:", {
    min: boundingBox.min,
    max: boundingBox.max,
    center: center,
    size: size
  });
  console.log("Camera Position:", camera.position);
  console.log("Camera Look At:", camera.getWorldDirection(new THREE.Vector3()));
}


function adjustCameraAndRaycaster() {
  const { camera, scene } = share3dDat();
  const boundingBox = new THREE.Box3().setFromObject(scene);
  const center = boundingBox.getCenter(new THREE.Vector3());
  const size = boundingBox.getSize(new THREE.Vector3());

  // Calculate new camera position
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 5; // Increased multiplier from 1.5 to 5
  const newPosition = new THREE.Vector3(center.x, center.y, center.z + cameraZ);

  // Animate camera position
  gsap.to(camera.position, {
    duration: 2,
    x: newPosition.x,
    y: newPosition.y,
    z: newPosition.z,
    ease: "power2.inOut",
    onUpdate: () => {
      camera.lookAt(center);
      camera.updateProjectionMatrix();
    }
  });

  // Adjust raycaster threshold
  const raycaster = getRaycaster();
  raycaster.params.Points.threshold = maxDim / 100; // Increased divisor from 200 to 100

  console.log("Animating camera to position:", newPosition);
  console.log("Adjusted raycaster threshold:", raycaster.params.Points.threshold);
}
function initializeEventListeners() {
// window.addEventListener('mousemove', onPointCloudInteraction, false);
window.addEventListener('mousemove', throttle(onPointCloudInteraction, 50), false);
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

export { createAnimatedPointCloud, initializeLabelRenderer, initializeEventListeners, adjustCameraAndRaycaster };