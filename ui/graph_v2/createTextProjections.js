import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { share3dDat, markNeedsRender } from './create.js';
let css3dRenderer;

export function initCSS3DRenderer(container) {
  if (!container) {
    console.error('Container element is undefined');
    return;
  }
  css3dRenderer = new CSS3DRenderer();
  css3dRenderer.setSize(window.innerWidth, window.innerHeight);
  css3dRenderer.domElement.style.position = 'absolute';
  css3dRenderer.domElement.style.top = '0px';
  container.appendChild(css3dRenderer.domElement);
  share3dDat().css3dRenderer = css3dRenderer;
}
export function createFloatingElement(text, position, key, fileId, hashKey) {
  const element = document.createElement('div');
  element.className = 'element';
  element.style.backgroundColor = `rgba(0,127,127,${Math.random() * 0.5 + 0.25})`;
  element.style.width = '120px';
  element.style.height = '160px';
  element.style.boxShadow = '0px 0px 12px rgba(0,255,255,0.5)';
  element.style.border = '1px solid rgba(127,255,255,0.25)';
  element.style.fontFamily = 'Helvetica, sans-serif';
  element.style.textAlign = 'center';
  element.style.cursor = 'default';

  const symbol = document.createElement('div');
  symbol.className = 'symbol';
  symbol.textContent = text.substring(0, 2).toUpperCase();
  symbol.style.position = 'absolute';
  symbol.style.top = '40px';
  symbol.style.left = '0px';
  symbol.style.right = '0px';
  symbol.style.fontSize = '60px';
  symbol.style.fontWeight = 'bold';
  symbol.style.color = 'rgba(255,255,255,0.75)';
  symbol.style.textShadow = '0 0 10px rgba(0,255,255,0.95)';
  element.appendChild(symbol);

  const details = document.createElement('div');
  details.className = 'details';
  details.textContent = `${key} (${hashKey})`;
  details.style.position = 'absolute';
  details.style.bottom = '15px';
  details.style.left = '0px';
  details.style.right = '0px';
  details.style.fontSize = '12px';
  details.style.color = 'rgba(127,255,255,0.75)';
  element.appendChild(details);

  element.addEventListener('mouseover', () => {
    element.style.boxShadow = '0px 0px 12px rgba(0,255,255,0.75)';
    element.style.border = '1px solid rgba(127,255,255,0.75)';
  });

  element.addEventListener('mouseout', () => {
    element.style.boxShadow = '0px 0px 12px rgba(0,255,255,0.5)';
    element.style.border = '1px solid rgba(127,255,255,0.25)';
  });

  const object = new CSS3DObject(element);
  object.position.copy(position);
  object.userData = { fullText: text, key, fileId, hashKey };

  return object;
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

export function addInteractivity() {
  const { scene, camera, raycaster, mouse } = share3dDat();

  window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      if (object.isCSS3DObject && object.userData.fullText) {
        displayFullText(object.userData.fullText, object.userData.fileId, object.userData.hashKey, object.position);
      }
    }
  });
}

export function updateRendererSizes() {
  const { renderer, camera } = share3dDat();
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (css3dRenderer) {
    css3dRenderer.setSize(window.innerWidth, window.innerHeight);
  }
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  markNeedsRender();
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