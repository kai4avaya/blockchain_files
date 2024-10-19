// createTextProjections.js

import * as THREE from "three";
// import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { share3dDat, markNeedsRender, render as mainRender } from './create.js';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
let css3dRenderer;

export function initCSS3DRenderer() {
  const { renderer } = share3dDat();
  
  if (!renderer) {
    console.error('WebGL renderer is not available in share3dDat');
    return null;
  }

  // Create CSS3D renderer
  css3dRenderer = new CSS3DRenderer();
  css3dRenderer.setSize(window.innerWidth, window.innerHeight);
  css3dRenderer.domElement.style.position = 'absolute';
  css3dRenderer.domElement.style.top = '0px';
  css3dRenderer.domElement.style.left = '0px';
  css3dRenderer.domElement.style.pointerEvents = 'none';
  document.body.appendChild(css3dRenderer.domElement);

  console.log('CSS3D renderer initialized and added to document body');
  return css3dRenderer;
}

export function initLabelRenderer() {
  const { labelRenderer } = share3dDat();
  
  if (!labelRenderer) {
    console.error('labelRenderer is not available in share3dDat');
    return null;
  }

  console.log('Label renderer initialized and ready to use');
  return labelRenderer;
}


export function createFloatingElement(text, position, key, fileId, hashKey) {
  const element = document.createElement('div');
  element.className = 'element';
  element.style.backgroundColor = `rgba(0,127,127,${Math.random() * 0.5 + 0.25})`;
  element.style.width = '240px';  // Increased width
  element.style.height = '320px'; // Increased height
  element.style.boxShadow = '0px 0px 12px rgba(0,255,255,0.5)';
  element.style.border = '1px solid rgba(127,255,255,0.25)';
  element.style.fontFamily = 'Helvetica, sans-serif';
  element.style.textAlign = 'center';
  element.style.cursor = 'default';
  element.style.padding = '10px';
  element.style.overflow = 'hidden';

  const symbol = document.createElement('div');
  symbol.className = 'symbol';
  symbol.textContent = text.substring(0, 2).toUpperCase();
  symbol.style.fontSize = '40px';
  symbol.style.fontWeight = 'bold';
  symbol.style.color = 'rgba(255,255,255,0.75)';
  symbol.style.textShadow = '0 0 10px rgba(0,255,255,0.95)';
  element.appendChild(symbol);

  const textContent = document.createElement('div');
  textContent.className = 'text-content';
  textContent.style.height = '100px';
  textContent.style.overflowY = 'auto';
  textContent.style.marginBottom = '10px';
  textContent.style.fontSize = '14px';
  textContent.style.color = 'rgba(255,255,255,0.9)';
  textContent.textContent = text.substring(0, 200);
  element.appendChild(textContent);

  const expandButton = document.createElement('button');
  expandButton.textContent = 'Expand';
  expandButton.style.marginBottom = '10px';
  expandButton.addEventListener('click', () => {
    textContent.textContent = text;
    expandButton.style.display = 'none';
  });
  element.appendChild(expandButton);

  const textArea = document.createElement('textarea');
  textArea.style.width = '90%';
  textArea.style.height = '60px';
  textArea.style.marginBottom = '10px';
  element.appendChild(textArea);

  const submitButton = document.createElement('button');
  submitButton.textContent = 'Submit';
  submitButton.addEventListener('click', () => {
    console.log(`Submitted text for ${fileId}: ${textArea.value}`);
    // Here you can add logic to handle the submitted text
  });
  element.appendChild(submitButton);

  const details = document.createElement('div');
  details.className = 'details';
  details.textContent = `${key} (${hashKey})`;
  details.style.fontSize = '12px';
  details.style.color = 'rgba(127,255,255,0.75)';
  element.appendChild(details);

  const object = new CSS3DObject(element);
  object.position.copy(position);
  object.userData = { fullText: text, key, fileId, hashKey };

  console.log(`Created CSS3D object for ${fileId} at position: ${position.toArray()}`);

  return object;
}

// Modify the createConnections function to return the lines
export function createConnections(scene, hashIndexData, objectMap) {
  const lines = [];
  Object.values(hashIndexData).forEach((bucketObjects) => {
    if (bucketObjects.length > 1) {
      for (let i = 0; i < bucketObjects.length; i++) {
        for (let j = i + 1; j < bucketObjects.length; j++) {
          const obj1 = objectMap.get(String(bucketObjects[i]));
          const obj2 = objectMap.get(String(bucketObjects[j]));
          if (obj1 && obj2) {
            const line = createCurvedLine(obj1, obj2);
            scene.add(line);
            lines.push({ line, obj1, obj2 });
          }
        }
      }
    }
  });
  return lines;
}

function createCurvedLine(obj1, obj2) {
  const start = obj1.position.clone();
  const end = obj2.position.clone();

  console.log('Panel 1 position:', start);
  console.log('Panel 2 position:', end);

  // Create debug spheres at the exact panel positions
  const sphereGeometry = new THREE.SphereGeometry(2);
  const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  
  const startSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  startSphere.position.copy(start);
  
  const endSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  endSphere.position.copy(end);

  const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const normal = new THREE.Vector3().subVectors(end, start).normalize();
  const perpendicular = new THREE.Vector3(-normal.y, normal.x, normal.z).normalize();
  const curveHeight = start.distanceTo(end) * 0.2;
  const curvePoint = midPoint.clone().add(perpendicular.multiplyScalar(curveHeight));

  const curve = new THREE.QuadraticBezierCurve3(start, curvePoint, end);
  const points = curve.getPoints(50);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5, linewidth: 2 });
  const line = new THREE.Line(geometry, material);

  // Create a group to hold the line and debug spheres
  const group = new THREE.Group();
  group.add(line);
  group.add(startSphere);
  group.add(endSphere);

  return group;
}

export function updateRendererSizes() {
  const { renderer, camera, labelRenderer } = share3dDat();
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  if (renderer) {
    renderer.setSize(width, height);
  }
  if (labelRenderer) {
    labelRenderer.setSize(width, height);
  }
  
  markNeedsRender();
}


export function createVisualConnections(scene, hashIndexData, objectMap) {
  Object.values(hashIndexData).forEach((bucketObjects) => {
    const lineGeometry = new THREE.BufferGeometry();
    const positions = [];

    for (let i = 0; i < bucketObjects.length; i++) {
      const obj = objectMap.get(String(bucketObjects[i]));
      if (obj) {
        positions.push(obj.position.x, obj.position.y, obj.position.z);
      }
    }

    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
    const line = new THREE.LineLoop(lineGeometry, lineMaterial);
    scene.add(line);
  });
}


export function adjustCameraAndControls(scene, camera, controls) {
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / Math.tan(fov / 2));

  cameraZ *= 1.5; // Add some padding

  camera.position.set(center.x, center.y, center.z + cameraZ);
  camera.lookAt(center);
  controls.target.copy(center);

  camera.near = cameraZ / 100;
  camera.far = cameraZ * 100;
  camera.updateProjectionMatrix();

  controls.maxDistance = cameraZ * 10;
  controls.update();

  console.log(`Camera positioned at: ${camera.position.toArray()}, looking at: ${center.toArray()}`);
}
function displayFullText(text, fileId, hashKey, position) {
  const { camera } = share3dDat();
  
  const modal = document.getElementById('textModal-text3d');
  const modalTitle = document.getElementById('modalTitle-text3d');
  const modalText = document.getElementById('modalText-text3d');
  const editText = document.getElementById('editText-text3d');

  modalTitle.textContent = `File ID: ${fileId} | Hash Key: ${hashKey}`;
  modalText.textContent = text;
  editText.value = text;

  const vector = new THREE.Vector3(position.x, position.y, position.z);
  vector.project(camera);

  const widthHalf = window.innerWidth / 2;
  const heightHalf = window.innerHeight / 2;

  const modalX = (vector.x * widthHalf) + widthHalf;
  const modalY = -(vector.y * heightHalf) + heightHalf;

  modal.style.left = `${modalX}px`;
  modal.style.top = `${modalY}px`;
  modal.style.display = 'block';

  const closeBtn = document.getElementsByClassName('close-text3d')[0];
  closeBtn.onclick = closeModal;

  const sendButton = document.getElementById('sendButton-text3d');
  sendButton.onclick = () => sendEditedText(fileId, hashKey);

  window.onclick = function(event) {
    if (event.target == modal) {
      closeModal();
    }
  }
}

function closeModal() {
  const modal = document.getElementById('textModal-text3d');
  modal.style.display = 'none';
}

function sendEditedText(fileId, hashKey) {
  const editText = document.getElementById('editText-text3d');
  const newText = editText.value;

  console.log(`Sending edited text for file ${fileId}, hash key ${hashKey}:`, newText);

  updateTextOnElement(fileId, hashKey, newText);

  closeModal();
}

function updateTextOnElement(fileId, hashKey, newText) {
  const { scene } = share3dDat();
  const element = scene.children.find(child => 
    child.isCSS3DObject && 
    child.userData.fileId === fileId && 
    child.userData.hashKey === hashKey
  );

  if (element) {
    const symbol = element.element.querySelector('.symbol');
    symbol.textContent = newText.substring(0, 2).toUpperCase();
    element.userData.fullText = newText;
    console.log(`Updated text element for fileId: ${fileId}, hashKey: ${hashKey}`);
  } else {
    console.warn(`No text element found for fileId: ${fileId}, hashKey: ${hashKey}`);
  }
}


export function renderWithCSS3D() {
  const sharedData = share3dDat();
  
  // Check if the original render function exists and call it
  if (typeof sharedData.render === 'function') {
    sharedData.render();
  } else if (typeof mainRender === 'function') {
    // If sharedData.render doesn't exist, try using the imported mainRender
    mainRender();
  } else {
    console.warn('No main render function found. Only rendering label objects.');
  }

  // Always render label objects
  if (sharedData.labelRenderer && sharedData.scene && sharedData.camera) {
    console.log('Rendering label objects');
    sharedData.labelRenderer.render(sharedData.scene, sharedData.camera);
  } else {
    console.warn('Unable to render label objects. Missing labelRenderer, scene, or camera.');
  }
}


export function addInteractivity(scene, camera, objectMap) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      if (intersectedObject.isCSS3DObject) {
        highlightConnections(scene, intersectedObject);
      }
    } else {
      resetHighlights(scene);
    }
  });
}

function highlightConnections(scene, object) {
  scene.children.forEach((child) => {
    if (child.type === 'Line' && (child.userData.startObject === object || child.userData.endObject === object)) {
      child.material.color.setHex(0xff0000);
      child.material.opacity = 1;
    }
  });
}

function resetHighlights(scene) {
  scene.children.forEach((child) => {
    if (child.type === 'Line') {
      child.material.color.setHex(0x00ffff);
      child.material.opacity = 0.5;
    }
  });
}