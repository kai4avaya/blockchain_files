import * as THREE from 'three';
import {
  createSphere,
  share3dDat,
  createWireframeCube,
  render,
  removeEmptyCubes
} from "../../ui/graph_v2/create";
import { createSceneSnapshot } from "../../ui/graph_v2/snapshot";
import indexDBOverlay from '../local/file_worker';


// import { io } from 'socket.io-client';
// const socket = io('http://your-server-url');
// Mock Socket.IO (as before)
const socket = {
  on: (event: string, callback: (data: any) => void) => {
    // Mock implementation
  },
  emit: (event: string, data: any) => {
    // Mock implementation
  }
};

interface ObjectState {
  id: string;
  type: string;
  position: number[];
  rotation: number[];
  scale: number[];
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  color?: number;
  size?: number;
}

interface SceneSnapshot {
  objects: ObjectState[];
  boxes: BoxState[];
  containment: { [key: string]: string[] };
  debugObjects: THREE.Group;
}

interface BoxState {
  id: string;
  wireframe: THREE.LineSegments | null;
  solid: THREE.Mesh | null;
}

class ThreeJsObjectState implements ObjectState {
  id: string;
  type: string;
  position: number[];
  rotation: number[];
  scale: number[];
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  color?: number;
  size?: number;

  constructor(object: THREE.Object3D) {
    this.id = object.userData.id || object.uuid;
    this.type = object.type;
    this.position = object.position.toArray();
    this.rotation = object.rotation.toArray();
    this.scale = object.scale.toArray();
    this.version = 0;
    this.versionNonce = Math.floor(Math.random() * 1000000);
    this.isDeleted = false;
    if (object instanceof THREE.Mesh) {
      this.color = (object.material as THREE.MeshBasicMaterial).color.getHex();
    }
    if (object.geometry instanceof THREE.BoxGeometry) {
      this.size = object.geometry.parameters.width;
    }
  }

  update(newState: Partial<ObjectState>): boolean {
    if (newState.version! > this.version || 
        (newState.version === this.version && newState.versionNonce! < this.versionNonce)) {
      Object.assign(this, newState);
      return true;
    }
    return false;
  }


  updatePosition(newPosition: THREE.Vector3) {
    this.position = newPosition.toArray();
    this.version++;
    this.versionNonce = Math.floor(Math.random() * 1000000);
  }

  updateScale(newScale: THREE.Vector3) {
    this.scale = newScale.toArray();
    this.version++;
    this.versionNonce = Math.floor(Math.random() * 1000000);
  }
}

class SceneState {
  private objects: Map<string, ThreeJsObjectState>;
  private scene: THREE.Scene;
  private nonBloomScene: THREE.Scene;
  private readonly STORAGE_KEY = 'sceneState';
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(scene: THREE.Scene, nonBloomScene: THREE.Scene) {
    this.objects = new Map();
    this.scene = scene;
    this.nonBloomScene = nonBloomScene;
    this.loadStateFromDB();
  }

  private async loadStateFromDB() {
    try {
      const storedState = await indexDBOverlay.getData(this.STORAGE_KEY);
      if (storedState) {
        this.deserializeState(storedState);
      }
    } catch (error) {
      console.error('Error loading state from IndexedDB:', error);
    }
  }

  private async saveStateToDB() {
    try {
      const serializedState = this.serializeState();
      await indexDBOverlay.saveData(this.STORAGE_KEY, serializedState);
    } catch (error) {
      console.error('Error saving state to IndexedDB:', error);
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => this.saveStateToDB(), 1000); // Save after 1 second of inactivity
  }

  private serializeState(): any {
    return Array.from(this.objects.values());
  }

  private deserializeState(serializedState: any) {
    serializedState.forEach((state: ObjectState) => {
      this.updateObject(state);
    });
  }

  updateObject(objectState: ObjectState): void {
    if (this.objects.has(objectState.id)) {
      const updated = this.objects.get(objectState.id)!.update(objectState);
      if (updated) {
        this.applyToThreeJsObject(objectState);
        this.scheduleSave();
      }
    } else {
      this.objects.set(objectState.id, new ThreeJsObjectState(objectState as THREE.Object3D));
      this.createThreeJsObject(objectState);
      this.scheduleSave();
    }
  }

  private applyToThreeJsObject(state: ObjectState): void {
    const object = this.scene.getObjectByProperty('uuid', state.id) as THREE.Object3D;
    if (object) {
      object.position.fromArray(state.position);
      object.rotation.fromArray(state.rotation);
      object.scale.fromArray(state.scale);
      object.visible = !state.isDeleted;
      if (object instanceof THREE.Mesh && state.color !== undefined) {
        (object.material as THREE.MeshBasicMaterial).color.setHex(state.color);
      }
    }
  }

  private createThreeJsObject(state: ObjectState): void {
    let object: THREE.Object3D;

    switch (state.type) {
      case 'Mesh':
        if (state.size !== undefined) {
          // This is a cube
          const { wireframeCube, solidCube } = createWireframeCube(
            state.size,
            state.position[0],
            state.position[1],
            state.position[2],
            state.color || 0xffffff,
            state.id
          );
          this.nonBloomScene.add(wireframeCube);
          this.nonBloomScene.add(solidCube);
          object = wireframeCube; // We'll use the wireframe as the main object
        } else {
          // This is a sphere
          object = createSphere(
            state.position[0],
            state.position[1],
            state.position[2],
            state.scale[0] * 20,
            state.id
          );
          this.scene.add(object);
        }
        break;
      default:
        console.warn(`Unsupported object type: ${state.type}`);
        return;
    }

    object.userData = { id: state.id };
    this.applyToThreeJsObject(state);
  }
  deleteObject(id: string): void {
    const state = this.objects.get(id);
    if (state) {
      state.isDeleted = true;
      state.version++;
      state.versionNonce = Math.floor(Math.random() * 1000000);
      this.applyToThreeJsObject(state);
      this.scheduleSave();
    }
  }

  getSerializableState(): SceneSnapshot {
    return createSceneSnapshot();
  }

  
  updateObjectPosition(id: string, newPosition: THREE.Vector3) {
    const state = this.objects.get(id);
    if (state) {
      state.updatePosition(newPosition);
      this.applyToThreeJsObject(state);
      this.broadcastUpdate(state);
      this.scheduleSave();
    }
  }

  updateObjectScale(id: string, newScale: THREE.Vector3) {
    const state = this.objects.get(id);
    if (state) {
      state.updateScale(newScale);
      this.applyToThreeJsObject(state);
      this.broadcastUpdate(state);
      this.scheduleSave();
    }
  }

  private broadcastUpdate(state: ThreeJsObjectState) {
    socket.emit('objectUpdate', state);
  }
}

// // Usage
// const scene = new THREE.Scene();
// const nonBloomScene = new THREE.Scene();
// const sceneState = new SceneState(scene, nonBloomScene);

// socket.on('sceneUpdate', (updatedStates: ObjectState[]) => {
//   updatedStates.forEach(state => sceneState.updateObject(state));
// });

// function emitSceneUpdate(): void {
//   socket.emit('sceneUpdate', sceneState.getSerializableState());
// }

// // Function to add debug visuals to a scene
// function addDebugVisualsToScene(scene: THREE.Scene, snapshot: SceneSnapshot) {
//   scene.add(snapshot.debugObjects);
// }

// // Example usage
// const cube = new THREE.Mesh(
//   new THREE.BoxGeometry(1, 1, 1),
//   new THREE.MeshBasicMaterial({ color: 0x00ff00 })
// );
// scene.add(cube);

// const cubeState = new ThreeJsObjectState(cube);
// sceneState.updateObject(cubeState);

// // Later, update the cube's position
// cube.position.set(1, 1, 1);
// cubeState.position = cube.position.toArray();
// cubeState.version++;
// cubeState.versionNonce = Math.floor(Math.random() * 1000000);
// sceneState.updateObject(cubeState);

// // Emit the update
// emitSceneUpdate();

// // Get the current scene snapshot
// const snapshot = sceneState.getSerializableState();

// // Add debug visuals to the scene
// addDebugVisualsToScene(scene, snapshot);

// FIX THESE Modified dragCube function
// export function dragCube(cubes_and_containedSpheres, intersectPoint) {
//   if (!cubes_and_containedSpheres || !cubes_and_containedSpheres.wireframeCube) return;

//   const cubes = [cubes_and_containedSpheres.wireframeCube, cubes_and_containedSpheres.solidCube].filter(Boolean);

//   const movementDelta = new THREE.Vector3().subVectors(
//     intersectPoint,
//     cubes[0].position
//   );

//   cubes.forEach(cube => {
//     cube.position.add(movementDelta);
//     sceneState.updateObjectPosition(cube.userData.id, cube.position);
//   });

//   cubes_and_containedSpheres.containedSpheres.forEach((sphere) => {
//     sphere.object.position.add(movementDelta);
//     sceneState.updateObjectPosition(sphere.object.userData.id, sphere.object.position);
//   });

//   render();
// }

// // Modified moveSphere function
// export function moveSphere(event, sphere, intersectPointIn = null) {
//   const { camera } = share3dDat();
//   // ... (existing moveSphere logic)

//   const targetSphere = sphere || selectedSphere;
//   if (!targetSphere) return;

//   // ... (existing position calculation)

//   targetSphere.position.copy(newIntersectPoint);
//   sceneState.updateObjectPosition(targetSphere.userData.id, targetSphere.position);

//   const scaleFactor = newDistance / originalDistance;
//   targetSphere.scale.multiplyScalar(scaleFactor);
//   sceneState.updateObjectScale(targetSphere.userData.id, targetSphere.scale);

//   render();
// }

// Global SceneState instance
const sceneState = new SceneState(share3dDat().scene, share3dDat().nonBloomScene);

// Socket event listener for updates from peers
socket.on('objectUpdate', (updatedState: ObjectState) => {
  sceneState.updateObject(updatedState);
});

// Export sceneState for use in other parts of your application
export { sceneState };