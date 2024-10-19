import * as THREE from "three";


import {
    share3dDat,
  } from "./create.js";

export function runOverallDebug(event) {
    console.log("%c=== Starting Overall Debug ===", "color: #ff00ff; font-weight: bold; font-size: 16px;");
  
    console.log("%c--- Scene Contents Debug ---", "color: #4CAF50; font-weight: bold;");
    debugSceneContents();
  
    console.log("%c--- Overlay Elements Debug ---", "color: #2196F3; font-weight: bold;");
    if (event) {
      debugOverlayElements(event);
    } else {
      console.warn("No event provided for overlay debug.");
    }
  
    console.log("%c--- Camera Debug ---", "color: #FFC107; font-weight: bold;");
    debugCamera();
  
    console.log("%c--- Event Listeners Debug ---", "color: #9C27B0; font-weight: bold;");
    debugEventListeners();
  
    console.log("%c=== Overall Debug Complete ===", "color: #ff00ff; font-weight: bold; font-size: 16px;");
  }
  
  function debugSceneContents() {

    const { scene, nonBloomScene } = share3dDat();
    console.log("Main scene children:", scene.children.length);
    console.log("Non-bloom scene children:", nonBloomScene.children.length);
    
    scene.traverse((object) => {
      if (object.isMesh) {
        console.log("Main scene object:", object.type, object.position.toArray());
      }
    });
    
    nonBloomScene.traverse((object) => {
      if (object.isMesh) {
        console.log("Non-bloom scene object:", object.type, object.position.toArray());
      }
    });
  }
  
  function debugOverlayElements(event) {
    const elements = document.elementsFromPoint(event.clientX, event.clientY);
    console.log("Elements at click position:", elements);
    
    const canvasIndex = elements.findIndex(el => el.tagName === 'CANVAS');
    if (canvasIndex === -1) {
      console.warn("Canvas not found at click position!");
    } else if (canvasIndex > 0) {
      console.warn(`Canvas found, but ${canvasIndex} element(s) on top of it:`, elements.slice(0, canvasIndex));
    } else {
      console.log("Canvas is the top element at click position.");
    }
  }
  
  function debugCamera() {
    const { camera } = share3dDat();
    console.log("Camera position:", camera.position);
    console.log("Camera rotation:", camera.rotation);
    console.log("Camera frustum:", {
      near: camera.near,
      far: camera.far,
      fov: camera.fov,
      aspect: camera.aspect
    });
  }
  
  const eventListeners = new Map();

  export function addTrackedEventListener(element, type, listener, options) {
    element.addEventListener(type, listener, options);
    if (!eventListeners.has(element)) {
      eventListeners.set(element, new Map());
    }
    if (!eventListeners.get(element).has(type)) {
      eventListeners.get(element).set(type, new Set());
    }
    eventListeners.get(element).get(type).add(listener);
  }
  
  export function removeTrackedEventListener(element, type, listener, options) {
    element.removeEventListener(type, listener, options);
    if (eventListeners.has(element) && eventListeners.get(element).has(type)) {
      eventListeners.get(element).get(type).delete(listener);
    }
  }
  
  function debugEventListeners() {
    const { renderer } = share3dDat();
    const canvas = renderer.domElement;
    
    if (eventListeners.has(canvas)) {
      console.log("Canvas event listeners:");
      eventListeners.get(canvas).forEach((listeners, type) => {
        console.log(`- ${type}: ${listeners.size} listener(s)`);
      });
    } else {
      console.log("No tracked event listeners for the canvas.");
    }
  }