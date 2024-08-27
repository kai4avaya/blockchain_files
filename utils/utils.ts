import { observable } from "mobx";
import * as THREE from "three";

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Helper function to recursively convert observables to plain objects
function convertObservablesToPlainObjects(data: any, visitedObjects: Set<any> = new Set()): any {
  if (Array.isArray(data)) {
    return data.map(item => convertObservablesToPlainObjects(item, visitedObjects));
  } else if (data && typeof data === 'object') {
    if (visitedObjects.has(data)) {
      return '[Circular Reference]'; // Handle circular references
    }
    visitedObjects.add(data);

    if (data.toJS) {
      return data.toJS(); // Handle MobX observable maps and arrays
    } else {
      const plainObject: any = {};
      for (const key in data) {
        plainObject[key] = convertObservablesToPlainObjects(data[key], visitedObjects);
      }
      return plainObject;
    }
  }
  return data;
}

// Serialize function to convert data into a string format suitable for saving in IndexedDB
export function serialize(data: any): any {
  const plainData = convertObservablesToPlainObjects(data);
  return JSON.stringify(plainData);
}

// Deserialize function to restore data from IndexedDB back into its original form
export function deserialize(data: any): any {
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  if (data.objects) {
    data.objects = observable.array(data.objects.map((obj: any) => {
      const object3D = new THREE.Object3D();
      Object.assign(object3D, obj.object);
      obj.object = object3D;
      return obj;
    }));
  }

  if (data.boxes) {
    data.boxes = observable.array(data.boxes);
  }

  if (data.containment) {
    data.containment = observable.map(data.containment);
  }

  if (data.debugObjects) {
    const group = new THREE.Group();
    Object.assign(group, data.debugObjects);
    data.debugObjects = group;
  }

  return data;
}

const generatedIds = new Set<string>();

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
