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

  console.log("result in convert to js AFTER NOT A DISASTER convertToJs", result)

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

// // Helper function to recursively convert observables to plain objects
// function convertObservablesToPlainObjects(data: any, visitedObjects: Set<any> = new Set()): any {
//   if (Array.isArray(data)) {
//     return data.map(item => convertObservablesToPlainObjects(item, visitedObjects));
//   } else if (data && typeof data === 'object') {
//     if (visitedObjects.has(data)) {
//       return '[Circular Reference]'; // Handle circular references
//     }
//     visitedObjects.add(data);

//     if (data.toJS) {
//       return data.toJS(); // Handle MobX observable maps and arrays
//     } else {
//       const plainObject: any = {};
//       for (const key in data) {
//         plainObject[key] = convertObservablesToPlainObjects(data[key], visitedObjects);
//       }
//       return plainObject;
//     }
//   }
//   return data;
// }

// Serialize function to convert data into a string format suitable for saving in IndexedDB
// export function serialize(data: any): any {
//   const plainData = convertObservablesToPlainObjects(data);
//   return JSON.stringify(plainData);
// }

// Deserialize function to restore data from IndexedDB back into its original form
// export function deserialize(data: any): any {
//   if (typeof data === 'string') {
//     data = JSON.parse(data);
//   }

//   if (data.objects) {
//     data.objects = observable.array(data.objects.map((obj: any) => {
//       const object3D = new THREE.Object3D();
//       Object.assign(object3D, obj.object);
//       obj.object = object3D;
//       return obj;
//     }));
//   }

//   if (data.boxes) {
//     data.boxes = observable.array(data.boxes);
//   }

//   if (data.containment) {
//     data.containment = observable.map(data.containment);
//   }

//   if (data.debugObjects) {
//     const group = new THREE.Group();
//     Object.assign(group, data.debugObjects);
//     data.debugObjects = group;
//   }

//   return data;
// }

// const generatedIds = new Set<string>();

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

