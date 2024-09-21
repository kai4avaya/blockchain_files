import { reconstructScene } from "../../ui/graph_v2/create";
import indexDBOverlay from '../local/file_worker';
import { p2pSync } from '../../network/peer2peer_simple';
const loginName = localStorage.getItem("login_block") || "no_login";

interface ObjectState {
  uuid: string; // original id of object
  type: string;
  shape: string;
  position: number[];
  rotation: number[];
  scale: number[];
  sceneVersion: number;
  version: number;
  versionNonce: number;
  lastEditedBy: string;
  isDeleted: boolean;
  isUpdated: boolean;
  color: number;
  size?: number;
  userData: {
    id: string; // links back to file id
  };
}

class SceneState {
  private static instance: SceneState | null = null;
  private objects: Map<string, ObjectState>;
  private updatedObjects: Set<string>;
  private savedObjects: Set<string>; // New set to track objects saved in IndexedDB
  private readonly STORAGE_KEY = 'graph';
  private saveTimeout: NodeJS.Timeout | null = null;
  private broadcastChannel: BroadcastChannel;
  private p2pSync: P2PSync;
  public sceneVersion: number = 0;


  private constructor() {
    this.objects = new Map();
    this.updatedObjects = new Set();
    this.savedObjects = new Set();
    this.broadcastChannel = new BroadcastChannel('sceneStateChannel');
    this.broadcastChannel.onmessage = this.handleBroadcastMessage.bind(this);
    // this.p2pSync = P2PSync.getInstance(this);
    this.p2pSync = p2pSync;
    this.p2pSync.setSceneState(this);
  }
  
  private broadcastUpdate(states: ObjectState[]) {
    this.broadcastChannel.postMessage(states);
    console.log("I AM SENDING OVER states", states)
    this.p2pSync.broadcastUpdate(states);
  }
  
  private handleBroadcastMessage(event: MessageEvent) {
    const incomingState = event.data as ObjectState;
    this.mergeUpdate(incomingState);
  }

  connectToPeer(peerId: string) {
    this.p2pSync.connectToPeer(peerId);
  }


  getMyPeerId(): string {
    return this.p2pSync.getMyPeerId();
  }

  
  static getInstance(): SceneState {
    if (!SceneState.instance) {
      SceneState.instance = new SceneState();
    }
    // this.p2pSync.setSceneState(SceneState.instance);
    return SceneState.instance;
  }

  async initialize(): Promise<void> {
    try {
      const storedState = await indexDBOverlay.getData(this.STORAGE_KEY);
      if (storedState && storedState.length > 0) {
        this.loadState(storedState);
        // Add all loaded objects to savedObjects set
        storedState.forEach(state => {
          this.savedObjects.add(state.uuid)
          // this.p2pSync.broadcastUpdate(state);
        });
      }
    } catch (error) {
      console.error('Error initializing SceneState:', error);
    }
  }

 
  getInitializedObjects(): ObjectState[] {
    return this.getSerializableState();
  }

  setupP2PSync(): void {
    p2pSync.setSceneState(this);
    console.log('P2PSync set up in SceneState');
  }

  // syncWithPeer(peerObjects: ObjectState[]): void {
  //   console.log("I am peer objects", peerObjects)
  //   if (!peerObjects || !peerObjects.length) return;
  //   peerObjects.forEach((peerObject) => {
  //     const existingObject = this.objects.get(peerObject.uuid);
  //     if (!existingObject || this.isNewerState(peerObject, existingObject)) {
  //       this.mergeUpdate(peerObject, { fromPeer: true });
  //     }
  //   });
  //   this.reconstructScene();
  // }
  syncWithPeer(peerObjects: ObjectState[]): void {
    console.log("Entering syncWithPeer method");
    console.log("Received peer objects:", peerObjects);
    if (!peerObjects || !peerObjects.length) {
      console.log("No peer objects to sync");
      return;
    }
    peerObjects.forEach((peerObject) => {
      console.log("Processing peer object:", peerObject);
      const existingObject = this.objects.get(peerObject.uuid);
      if (!existingObject || this.isNewerState(peerObject, existingObject)) {
        console.log("Merging update for object:", peerObject.uuid);
        this.mergeUpdate(peerObject, { fromPeer: true });
      }
    });
    console.log("Reconstructing scene");
    this.reconstructScene();
  }
  private loadState(storedState: ObjectState[]): void {
    storedState.forEach(state => this.objects.set(state.uuid, state));
    this.reconstructScene();
  }

  private reconstructScene(): void {
    reconstructScene(Array.from(this.objects.values()));
  }
  
  updateObject(
    objectState: Partial<ObjectState> & { uuid: string },
    options?: { fromPeer?: boolean }
  ): void {
    const existingState = this.objects.get(objectState.uuid);

    if (existingState) {
      if (this.hasChanged(existingState, objectState)) {
        const updatedState = {
          ...existingState,
          ...objectState,
          isUpdated: true,
          versionNonce: this.generateVersionNonce(),
        };

        // Handle deletion
        if (updatedState.isDeleted) {
          this.handleDeletion(updatedState);
        } else {
          this.mergeUpdate(updatedState);
          this.updatedObjects.add(updatedState.uuid);

          // Handle cube counterpart update
          if (updatedState.shape === 'wireframeCube' || updatedState.shape === 'solidCube') {
            this.updateCubeCounterpart(updatedState);
          }
        }
      }
    } else {
      this.createObject(objectState as ObjectState);
      this.updatedObjects.add(objectState.uuid);
    }
  }


  private handleDeletion(state: ObjectState): void {
    this.mergeUpdate(state);
    this.updatedObjects.add(state.uuid);
    if (state.shape === 'wireframeCube' || state.shape === 'solidCube') {
      const counterpartUuid = state.shape === 'wireframeCube' 
        ? state.uuid + '-solid' 
        : state.uuid.replace('-solid', '');
      const counterpartState = this.objects.get(counterpartUuid);
      if (counterpartState) {
        const updatedCounterpartState = {
          ...counterpartState,
          isDeleted: true,
          version: counterpartState.version + 1,
          versionNonce: this.generateVersionNonce(),
        };
        this.mergeUpdate(updatedCounterpartState);
        this.updatedObjects.add(counterpartUuid);
      }
    }
  }
  

  private updateCubeCounterpart(state: ObjectState): void {
    const counterpartUuid = state.shape === 'wireframeCube' 
      ? state.uuid + '-solid' 
      : state.uuid.replace('-solid', '');
    
    const counterpartState = this.objects.get(counterpartUuid);
    if (counterpartState) {
      const updatedCounterpartState = {
        ...counterpartState,
        position: state.position,
        rotation: state.rotation,
        scale: state.scale,
        version: counterpartState.version + 1,
        versionNonce: this.generateVersionNonce(),
      };
      this.mergeUpdate(updatedCounterpartState);
      this.updatedObjects.add(counterpartUuid);
    }
  }


  private hasChanged(existing: ObjectState, incoming: Partial<ObjectState>): boolean {
    return Object.keys(incoming).some(key => {
      if (key === 'position' || key === 'rotation' || key === 'scale') {
        return !this.arraysEqual(existing[key], incoming[key]);
      }
      return existing[key] !== incoming[key];
    });
  }

  private arraysEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  

  getCurrentState(): ObjectState[] {
    console.log("Getting current state");
    const currentState = this.getSerializableState();
    console.log("Current state:", currentState);
    return currentState;
  }

  
  private getNextSceneVersion(): number {
    const maxSceneVersion = Math.max(...Array.from(this.objects.values()).map(obj => obj.sceneVersion));
    this.sceneVersion = maxSceneVersion + 1;
    return this.sceneVersion;
  }

// mergeUpdate(incomingState, options) {
//   const existingState = this.objects.get(incomingState.uuid);
//   if (!existingState || this.isNewerState(incomingState, existingState)) {
//     // Use the isDeleted flag from the incoming state if it's newer
//     const isDeleted = incomingState.isDeleted;
//     this.objects.set(incomingState.uuid, {
//       ...existingState,
//       ...incomingState,
//       isDeleted,
//     });
//     this.updatedObjects.add(incomingState.uuid);
//     this.scheduleSave();
//     this.reconstructScene();
//   }
// }

mergeUpdate(incomingState: ObjectState, options?: { fromPeer?: boolean }): void {
  const existingState = this.objects.get(incomingState.uuid);
  if (!existingState || this.isNewerState(incomingState, existingState)) {
    // Use the isDeleted flag from the incoming state if it's newer
    const isDeleted = incomingState.isDeleted;
    const nextSceneVersion = this.getNextSceneVersion();
    
    this.objects.set(incomingState.uuid, {
      ...existingState,
      ...incomingState,
      isDeleted,
      sceneVersion: nextSceneVersion,
    });
    
    this.updatedObjects.add(incomingState.uuid);
    this.scheduleSave();
    this.reconstructScene();
  }
}


  private createObject(state: ObjectState): void {
    const newState = {
      ...state,
    };
    this.objects.set(newState.uuid, newState);
    if (!this.savedObjects.has(newState.uuid)) {
      this.updatedObjects.add(newState.uuid);
    }
    this.scheduleSave();
    this.reconstructScene();
  }


  // private isNewerState(incoming: ObjectState, existing: ObjectState): boolean {
  //   return incoming.version > existing.version ||
  //          (incoming.version === existing.version && incoming.versionNonce < existing.versionNonce);
  // }

  private isNewerState(incoming: ObjectState, existing: ObjectState): boolean {
    return incoming.version > existing.version ||
           (incoming.version === existing.version && incoming.versionNonce < existing.versionNonce);
  }
  

  deleteObject(uuid: string): void {
    const state = this.objects.get(uuid);
    if (state) {
      this.updateObject({
        ...state,
        isDeleted: true,
        version: state.version + 1
      });
    }
  }

  getSerializableState(): ObjectState[] {
    return Array.from(this.objects.values()).filter(state => !state.isDeleted);
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    // Remove the delay by setting the timeout to 0
    this.saveTimeout = setTimeout(() => this.saveStateToDB(), 0);
  }
  

  private async saveStateToDB(options) {
    try {
      const updatedStates = Array.from(this.updatedObjects)
        .map(uuid => this.objects.get(uuid))
        .filter(state => state !== undefined);
      if (updatedStates.length > 0) {
        const existingData = await indexDBOverlay.getData(this.STORAGE_KEY);
        const existingMap = new Map(existingData.map(item => [item.uuid, item]));
        const dataToSave = updatedStates.map(state => {
          const existingState = existingMap.get(state.uuid);
          return {
            ...state,
            version: state.version, // Use the version from the state
            isDeleted: state.isDeleted, // Ensure isDeleted is taken from the current state
          };
        });
        // Broadcast updates if necessary
        if(this.p2pSync.isConnected() && !options?.fromPeer) {
          this.broadcastUpdate(dataToSave);
        }
        await indexDBOverlay.saveData(this.STORAGE_KEY, dataToSave);
        updatedStates.forEach(state => this.savedObjects.add(state.uuid));
      }
      this.updatedObjects.clear();
    } catch (error) {
      console.error('Error saving state to IndexedDB:', error);
    }
  }
  

  private generateVersionNonce(): number {
    return Math.floor(Math.random() * 1000000);
  }
}

export const sceneState = SceneState.getInstance();
// const p2pSync = new P2PSync(sceneState);
sceneState.setupP2PSync(); 


export function saveObjectChanges(objectData) {
  console.log("saveObjectChanges", objectData);
  if (!objectData) return;

  const convertToArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value.toArray === "function") return value.toArray();
    return value;
  };

  const convertColor = (color) => {
    if (typeof color === "number") return color;
    if (color && typeof color.getHex === "function") return color.getHex();
    return color;
  };

  const commonData = {
    type: objectData.type,
    shape: objectData.shape,
    uuid: objectData.uuid,
    userData: objectData.userData || {},
    position: convertToArray(objectData.position),
    rotation: convertToArray(objectData.rotation),
    scale: convertToArray(objectData.scale),
    version: (objectData.version || 0) + 1,
    sceneVersion: (objectData.sceneVersion || 0) + 1,
    versionNonce: objectData.versionNonce || this.generateVersionNonce(),
    size: objectData.size,
    isDeleted: objectData.isDeleted || false,
    color: convertColor(objectData.material?.color || objectData.color),
    lastEditedBy: objectData.loginName || loginName,
  };
  sceneState.updateObject(commonData);
}

export function diffSceneChanges(scene, nonBloomScene, previousSnapShot) {
  const changedObjects = [];
  const currentSnapshot = {};

  // Function to process objects in a scene
  function processSceneObjects(sceneToProcess) {
    sceneToProcess.traverse((object) => {
      if (object.isMesh && (object.shape === 'sphere' || object.shape.includes('Cube'))) {
        const uuid = object.uuid;
        const simplifiedObject = {
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone(),
          color: object.material?.color?.clone(),
          isDeleted: object.isDeleted || false,
          // Add other relevant properties
        };

        currentSnapshot[uuid] = simplifiedObject;

        const prevObject = previousSnapShot[uuid];
        if (!prevObject) {
          // New object
          changedObjects.push(object);
        } else if (!areObjectsEqual(simplifiedObject, prevObject)) {
          // Object has changed
          changedObjects.push(object);
        }
      }
    });
  }

  // Process objects in both scenes
  processSceneObjects(scene);
  processSceneObjects(nonBloomScene);


  // Update changed objects
  changedObjects.forEach((object) => {
    saveObjectChanges(object);
    console.log("............................", "diffSceneChanges", JSON.stringify(object));
  });

  // Update the scene snapshot after processing
  // sceneSnapshot = currentSnapshot;
}

function areObjectsEqual(obj1, obj2) {
  // Compare position
  if (!obj1.position.equals(obj2.position)) return false;
  // Compare rotation
  if (!obj1.rotation.equals(obj2.rotation)) return false;
  // Compare scale
  if (!obj1.scale.equals(obj2.scale)) return false;
  // Compare color (if applicable)
  if (obj1.color && obj2.color && !obj1.color.equals(obj2.color)) return false;
  if (obj1.isDeleted !== obj2.isDeleted) return false;


  return true;
}
