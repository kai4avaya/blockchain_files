// createTextProjection.js

import * as THREE from "three";
import { share3dDat, markNeedsRender } from './create.js';
export function createFloatingTextPlane(text, position) {
    const { scene, camera } = share3dDat();
  
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 1024;  // Increased size for better resolution
    canvas.height = 1024;
  
    context.fillStyle = 'rgba(0, 0, 0, 0.9)';  // More opaque background
    context.fillRect(0, 0, canvas.width, canvas.height);
  
    context.font = '24px Arial';  // Increased font size
    context.fillStyle = 'white';
    context.textAlign = 'left';
    context.textBaseline = 'top';
  
    const maxWidth = canvas.width - 40;
    const lineHeight = 30;
    const words = text.split(' ');
    let line = '';
    let y = 20;
  
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = context.measureText(testLine);
      if (metrics.width > maxWidth) {
        context.fillText(line, 20, y);
        line = words[i] + ' ';
        y += lineHeight;
        if (y > canvas.height - lineHeight) break;  // Stop if we've run out of space
      } else {
        line = testLine;
      }
    }
    context.fillText(line, 20, y);
  
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true, 
      side: THREE.DoubleSide,
      depthWrite: false  // This can help with rendering order issues
    });
    const geometry = new THREE.PlaneGeometry(10, 10);  // Adjust size as needed
    const plane = new THREE.Mesh(geometry, material);
  
    plane.position.copy(position);
    plane.lookAt(camera.position);
  
    scene.add(plane);
    console.log(`Added plane at position: ${position.x}, ${position.y}, ${position.z}`);
    markNeedsRender();
  
    return plane;
  }

  export function addInteractivity() {
    const { scene, camera, raycaster, mouse, controls } = share3dDat();
  
    window.addEventListener('click', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
  
        raycaster.setFromCamera(mouse, camera);
  
        const intersects = raycaster.intersectObjects(scene.children, true);
  
        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (object.userData.fullText) {
                displayFullText(object.userData.fullText, object.userData.fileId, object.position);
            }
        }
    });
  
    // Add event listener to update plane orientations
    window.addEventListener('resize', adjustTextPlaneOrientations);
    controls.addEventListener('change', adjustTextPlaneOrientations);
}
  
  export function adjustTextPlaneOrientations() {
    const { scene, camera } = share3dDat();
  
    scene.traverse((object) => {
      if (object.isMesh && object.geometry.type === 'PlaneGeometry') {
        object.lookAt(camera.position);
      }
    });
    markNeedsRender();
  }
  

  let currentFileId = null;

  function displayFullText(text, fileId, position) {
    const { camera } = share3dDat();
    currentFileId = fileId;
  
    // Update modal content
    const modal = document.getElementById('textModal-text3d');
    const modalTitle = document.getElementById('modalTitle-text3d');
    const modalText = document.getElementById('modalText-text3d');
    const editText = document.getElementById('editText-text3d');
  
    modalTitle.textContent = `File ID: ${fileId}`;
    modalText.textContent = text;
    editText.value = text;
  
    // Position the modal next to the clicked panel
    const vector = new THREE.Vector3(position.x, position.y, position.z);
    vector.project(camera);
  
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;
  
    const modalX = (vector.x * widthHalf) + widthHalf;
    const modalY = -(vector.y * heightHalf) + heightHalf;
  
    modal.style.left = `${modalX}px`;
    modal.style.top = `${modalY}px`;
  
    // Show the modal
    modal.style.display = 'block';
  
    // Add event listeners
    const closeBtn = document.getElementsByClassName('close-text3d')[0];
    closeBtn.onclick = closeModal;
  
    const sendButton = document.getElementById('sendButton-text3d');
    sendButton.onclick = sendEditedText;
  
    // Close modal if clicked outside
    window.onclick = function(event) {
      if (event.target == modal) {
        closeModal();
      }
    }
  }
  
  function closeModal() {
    const modal = document.getElementById('textModal-text3d');
    modal.style.display = 'none';
    currentFileId = null;
  }
  
  function sendEditedText() {
    const editText = document.getElementById('editText-text3d');
    const newText = editText.value;
  
    // Here you would typically send the edited text to your backend or update your data structure
    console.log(`Sending edited text for file ${currentFileId}:`, newText);
  
    // For this example, we'll just update the text on the panel
    updateTextOnPanel(currentFileId, newText);
  
    closeModal();
  }
  function updateTextOnPanel(fileId, newText) {
    const { scene } = share3dDat();
    const textPlane = scene.getObjectByProperty('userData', { fileId: fileId });
  
    if (textPlane) {
      // Get the existing canvas from the texture
      const canvas = textPlane.material.map.image;
      const context = canvas.getContext('2d');
  
      // Clear the canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
  
      // Redraw background
      context.fillStyle = 'rgba(0, 0, 0, 0.8)';
      context.fillRect(0, 0, canvas.width, canvas.height);
  
      // Redraw text
      context.font = '24px Arial';
      context.fillStyle = 'white';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
  
      const maxWidth = canvas.width - 40;
      const lineHeight = 30;
      const words = newText.split(' ');
      let line = '';
      let y = 40;
  
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = context.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
          context.fillText(line, canvas.width / 2, y);
          line = words[i] + ' ';
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      context.fillText(line, canvas.width / 2, y);
  
      // Update the texture
      textPlane.material.map.needsUpdate = true;
  
      // Update the userData
      textPlane.userData.fullText = newText;
  
      markNeedsRender();
      console.log(`Updated text plane for fileId: ${fileId}`);
    } else {
      console.warn(`No text plane found for fileId: ${fileId}`);
    }
  }