// import { observable } from "mobx";
import * as THREE from "three";

const generatedIds = new Set<string>();


export function convertToThreeJSFormat(data: any) {
  // Start with a shallow copy of all data
  const result = { ...data };

  // Convert position
  if (Array.isArray(data.position)) {
    result.position = new THREE.Vector3().fromArray(data.position);
  }

  // Convert rotation
  if (Array.isArray(data.rotation)) {
    if (data.rotation.length === 4) {
      // Assuming the rotation is stored as [x, y, z, order]
      result.rotation = new THREE.Euler(
        data.rotation[0],
        data.rotation[1],
        data.rotation[2],
        data.rotation[3]
      );
    } else if (data.rotation.length === 3) {
      // If only x, y, z are provided, use default order 'XYZ'
      result.rotation = new THREE.Euler().fromArray(data.rotation);
    } else {
      console.warn('Unexpected rotation format:', data.rotation);
    }
  }

  // Convert scale
  if (Array.isArray(data.scale)) {
    result.scale = new THREE.Vector3().fromArray(data.scale);
  }

  // Convert color if it's a number (assuming it's stored as a hex value)
  if (typeof data.color === 'number') {
    result.color = new THREE.Color(data.color);
  }

  // Remove specific fields
  delete result.type;
  delete result.shape;

  // Set default values if not present
  // result.color = result.color || randomColorGenerator(); 
  result.version = result.version || 1;
  // console.log("result in convert to js", result)
  // result.userData = result.userData || { id: generateUniqueId(3) };
  result.versionNonce = generateVersionNonce()

  if ('id' in data) { // hack since this is added in indexdb
    delete result.id;
  }


  return result;
}

export function makeObjectWritable(obj) {
  for (const key of Object.keys(obj)) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (descriptor && !descriptor.writable) {
      Object.defineProperty(obj, key, {
        writable: true,
        value: obj[key]
      });
    }
    // If the property is an object, recursively make it writable
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      makeObjectWritable(obj[key]);
    }
      }
}
  

export function debounce(func: Function, wait: number) {
  let timeout: number;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

export function generateUniqueId(length = 3): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let uniqueId = '';
  do {
    uniqueId = '';
    for (let i = 0; i < length; i++) {
      uniqueId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
  } while (generatedIds.has(uniqueId));
  generatedIds.add(uniqueId);
  return uniqueId;
}

export function generateVersionNonce(): number {
  return Math.floor(Math.random() * 1000000);
}



export function getCurrentTimeOfDay() {
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60; // Current time in hours (0-24)

  // Define day time as between 6 AM and 6 PM
  if (hours >= 6 && hours < 18) {
    // Calculate the progression from dawn (6 AM) to noon (12 PM) to dusk (6 PM)
    if (hours < 12) {
      // Dawn to noon
      return (hours - 6) / 6; // 0 to 1
    } else {
      // Noon to dusk
      return 1 - (hours - 12) / 6; // 1 to 0
    }
  } else {
    // Night time
    return 0;
  }
}

export function calculateDistance(point1: THREE.Vector3, point2: THREE.Vector3) {
  return point1.distanceTo(point2);
}

