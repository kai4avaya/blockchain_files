// scene_colab.ts

import * as THREE from "three";
import { reconstructScene } from "../../ui/graph_v2/create";
import indexDBOverlay from "../local/file_worker";
import { p2pSync } from "../../network/peer2peer_simple";
import { generateVersionNonce } from "../../utils/utils";
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
    id: string;
    filename: string;
    selected?: number; // Add this line
  };
}

interface DeleteOptions {
  filename?: string;
  forceReconstruct?: boolean;
}

class SceneState {
  private static instance: SceneState | null = null;
  private objects: Map<string, ObjectState>;
  private updatedObjects: Set<string>;
  private savedObjects: Set<string>; // New set to track objects saved in IndexedDB
  private readonly STORAGE_KEY = "graph";
  // private saveTimeout: NodeJS.Timeout | null = null;
  private broadcastChannel: BroadcastChannel;
  public p2pSync: P2PSync;
  public sceneVersion: number = 0;
  private updateQueue: ObjectState[] = [];
  private isProcessingQueue: boolean = false;
  private scenes: THREE.Scene[] = [];
  private selectedSpheres: Set<string> = new Set(); // Add this line
  
  


  private constructor() {
    this.objects = new Map();
    this.updatedObjects = new Set();
    this.savedObjects = new Set();
    this.broadcastChannel = new BroadcastChannel("sceneStateChannel");
    this.broadcastChannel.onmessage = this.handleBroadcastMessage.bind(this);
    // this.p2pSync = P2PSync.getInstance(this);
    this.p2pSync = p2pSync;
    this.p2pSync.setSceneState(this);
  }

  broadcastUpdate(states: ObjectState[]) {
    this.broadcastChannel.postMessage(states);
    this.p2pSync.broadcastUpdate(states);
  }

  // addScene(scene: THREE.Scene) {
  //   this.scenes.push(scene);
  // }
  replaceScenes(newScenes: THREE.Scene[]) {
    this.scenes = newScenes;
  }

  // Method to get the scenes array
  getScenes(): THREE.Scene[] {
    return this.scenes;
  }

  // Add this method to track selected spheres
  updateSelectedSpheres(sphereId: string, isSelected: boolean) {
    if (isSelected) {
      this.selectedSpheres.add(sphereId);
    } else {
      this.selectedSpheres.delete(sphereId);
    }
  }

  // Add this method to get selected spheres
  getSelectedSpheres(): string[] {
    return Array.from(this.selectedSpheres);
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
        storedState.forEach((state) => {
          this.savedObjects.add(state.uuid);
        });
      }
    } catch (error) {
      console.error("Error initializing SceneState:", error);
    }
  }

  getInitializedObjects(): ObjectState[] {
    return this.getSerializableState();
  }

  setupP2PSync(): void {
    p2pSync.setSceneState(this);
  }

 
  syncWithPeer(peerObjects: ObjectState[]): void {
    if (!peerObjects || !peerObjects.length) {
      return;
    }


    peerObjects.forEach((peerObject) => {
   
      this.updateObject(peerObject, {
        fromPeer: true,
        deferReconstruct: true,
      });
    });

 

    // Reconstruct the scene once after all updates
    this.reconstructScene();
    this.saveStateToDB();
  }

  getSceneObjArray(): ObjectState[] {
    return Array.from(this.objects.values());
  }

  private reconstructScene(): void {
    reconstructScene(Array.from(this.objects.values()));
  }

  updateObject(
    objectState: Partial<ObjectState> & { uuid: string },
    options?: { fromPeer?: boolean; deferReconstruct?: boolean }
  ): void {
    const existingState = this.objects.get(objectState.uuid);

    if (existingState) {
      if (this.hasChanged(existingState, objectState)) {
        const updatedState = {
          ...existingState,
          ...objectState,
          isUpdated: true,
          versionNonce: generateVersionNonce(),
        };

        // Handle deletion
        if (updatedState.isDeleted) {
          this.handleDeletion(updatedState, options);
        } else {
          this.mergeUpdate(updatedState, options);
          this.updatedObjects.add(updatedState.uuid);

          // Handle cube counterpart update
          if (
            updatedState.shape === "wireframeCube" ||
            updatedState.shape === "solidCube"
          ) {
            this.updateCubeCounterpart(updatedState, options);
          }
        }
      }
    } else {
      this.createObject(objectState as ObjectState, options);
      this.updatedObjects.add(objectState.uuid);
    }
  }


  private handleDeletion(
    state: ObjectState,
    options?: { deferReconstruct?: boolean }
  ): void {
    this.mergeUpdate(state, options);
    this.updatedObjects.add(state.uuid);
    if (state.shape === "wireframeCube" || state.shape === "solidCube") {
      const counterpartUuid =
        state.shape === "wireframeCube"
          ? state.uuid + "-solid"
          : state.uuid.replace("-solid", "");
      const counterpartState = this.objects.get(counterpartUuid);
      if (counterpartState) {
        const updatedCounterpartState = {
          ...counterpartState,
          isDeleted: true,
          version: counterpartState.version + 1,
          versionNonce: generateVersionNonce(),
        };
        this.mergeUpdate(updatedCounterpartState);
        this.updatedObjects.add(counterpartUuid);
      }
    }
  }

  private loadState(storedState: ObjectState[]): void {
    storedState.forEach((state) => this.objects.set(state.uuid, state));
    this.reconstructScene();
  }

  private updateCubeCounterpart(
    state: ObjectState,
    options?: { deferReconstruct?: boolean }
  ): void {
    const counterpartUuid =
      state.shape === "wireframeCube"
        ? state.uuid + "-solid"
        : state.uuid.replace("-solid", "");

    const counterpartState = this.objects.get(counterpartUuid);

    if (counterpartState) {
      const updatedCounterpartState = {
        ...counterpartState,
        position: state.position,
        rotation: state.rotation,
        scale: state.scale,
        version: counterpartState.version + 1,
        versionNonce: generateVersionNonce(),
      };
      this.mergeUpdate(updatedCounterpartState, options);
      this.updatedObjects.add(counterpartUuid);
    }
  }

  private hasChanged(
    existing: ObjectState,
    incoming: Partial<ObjectState>
  ): boolean {
    return Object.keys(incoming).some((key) => {
      if (key === "position" || key === "rotation" || key === "scale") {
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
    const currentState = this.getSerializableState();
    return currentState;
  }

  private getNextSceneVersion(): number {
    const maxSceneVersion = Math.max(
      ...Array.from(this.objects.values()).map((obj) => obj.sceneVersion)
    );
    this.sceneVersion = maxSceneVersion + 1;
    return this.sceneVersion;
  }

  mergeUpdate(
    incomingState: ObjectState,
    options?: { fromPeer?: boolean; deferReconstruct?: boolean }
  ): void {
    const existingState = this.objects.get(incomingState.uuid);
    if (!existingState || this.isNewerState(incomingState, existingState)) {
      // Use the isDeleted flag from the incoming state if it's newer
      const isDeleted = incomingState.isDeleted;
      const nextSceneVersion = this.getNextSceneVersion();

      this.objects.set(incomingState.uuid, {
        ...(existingState || {}),
        ...incomingState,
        isDeleted,
        sceneVersion: nextSceneVersion,
      });

      this.updatedObjects.add(incomingState.uuid);
      // this.enqueueUpdate(incomingState, options);

      // Conditionally reconstruct the scene
      if (!options?.deferReconstruct) {
        this.reconstructScene();
      }
    }
  }

  private createObject(
    state: ObjectState,
    options?: { deferReconstruct?: boolean }
  ): void {
    const newState = {
      ...state,
    };
    this.objects.set(newState.uuid, newState);
    if (!this.savedObjects.has(newState.uuid)) {
      this.updatedObjects.add(newState.uuid);
    }
    // this.scheduleSave();
    // this.enqueueUpdate(newState, options);
    if (!options?.deferReconstruct) {
      this.reconstructScene();
    }
  }

  private isNewerState(incoming: ObjectState, existing: ObjectState): boolean {
    return (
      incoming.version > existing.version ||
      (incoming.version === existing.version &&
        incoming.versionNonce < existing.versionNonce)
    );
  }

  deleteObject(uuid: string): void {
    const state = this.objects.get(uuid);
    if (state) {
      this.updateObject({
        ...state,
        isDeleted: true,
        version: state.version + 1,
      });
    }
  }

  getSerializableState(): ObjectState[] {
    return Array.from(this.objects.values()).filter(
      (state) => !state.isDeleted
    );
  }


  private enqueueUpdate(
    state: ObjectState,
    options?: { fromPeer?: boolean; deferReconstruct?: boolean }
  ) {
    this.updateQueue.push(state);
    this.processQueue(options);
  }
  private async processQueue(options?: {
    fromPeer?: boolean;
    deferReconstruct?: boolean;
  }) {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.updateQueue.length > 0) {
        const state = this.updateQueue.shift();
        await this.saveStateToDB();
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }


   async saveStateToDB() {
    try {
      const updatedStates = Array.from(this.updatedObjects)
        .map((uuid) => this.objects.get(uuid))
        .filter((state) => state !== undefined);
      if (updatedStates.length > 0) {
        // const existingData = await indexDBOverlay.getData(this.STORAGE_KEY);
        // const existingMap = new Map(existingData.map(item => [item.uuid, item]));
        const dataToSave = updatedStates.map((state) => ({
          ...state,
          version: state.version,
          isDeleted: state.isDeleted,
        }));

        // if (this.p2pSync.isConnected() && !options?.fromPeer) {
        //   this.broadcastUpdate(dataToSave);
        // }

        await indexDBOverlay.saveData(this.STORAGE_KEY, dataToSave);
        updatedStates.forEach((state) => this.savedObjects.add(state.uuid));
      }
      this.updatedObjects.clear();
    } catch (error) {
      console.error("Error saving state to IndexedDB:", error);
    }
  }

  markObjectAsDeleted(objectId: string, options: DeleteOptions = {}): void {
    console.log(`Attempting to mark object as deleted:`, { id: objectId, filename: options.filename });
    
    // Debug log before deletion
    this.debugLogSceneState('Before Deletion');
    
    let objectToDelete = this.objects.get(objectId);
    
    // If not found by ID and filename is provided, try to find by filename
    if (!objectToDelete && options.filename) {
      console.log(`Object not found by ID, searching by filename: ${options.filename}`);
      const foundByFilename = Array.from(this.objects.values()).find(
        obj => obj.userData?.filename === options.filename
      );
      
      if (foundByFilename) {
        console.log(`Found object by filename:`, foundByFilename);
        objectToDelete = foundByFilename;
        objectId = foundByFilename.uuid; // Get the correct ID for graph table
      }
    }

    if (objectToDelete) {
      console.log('Found object to delete:', objectToDelete);
      
      const updatedObject = {
        ...objectToDelete,
        isDeleted: true,
        version: (objectToDelete.version || 0) + 1,
        versionNonce: generateVersionNonce(),
        globalTimestamp: Date.now(),
        lastEditedBy: localStorage.getItem('login_block') || 'no_login'
      };
      
      // Update in memory
      this.objects.set(objectId, updatedObject);
      this.updatedObjects.add(objectId);
      
      // Update the graph table using indexDBOverlay
      indexDBOverlay.saveData('graph', {
        ...updatedObject,
        id: objectId // Ensure we're using the correct ID for the graph table
      }).then(() => {
        console.log(`Successfully marked object ${objectId} as deleted in graph table`);
        
        // Debug log after deletion and save
        this.debugLogSceneState('After Deletion and Save');
        
        // Always reconstruct scene after graph update
        console.log('Initiating scene reconstruction');
        this.reconstructScene();
        
        // Broadcast update
        this.broadcastUpdate([updatedObject]);
      }).catch(error => {
        console.error(`Error saving deleted state for object ${objectId} in graph table:`, error);
        this.debugLogSceneState('After Deletion Error');
      });
    } else {
      console.warn(`Object not found by either ID or filename:`, { id: objectId, filename: options.filename });
      this.debugLogSceneState('Object Not Found');
    }
  }

  // Add this debug utility function
  debugLogSceneState(context: string = ''): void {
    console.group(`Scene State Debug ${context ? `(${context})` : ''}`);
    console.log('Total objects:', this.objects.size);
    console.log('Updated objects:', this.updatedObjects.size);
    console.log('Saved objects:', this.savedObjects.size);
    
    console.group('All Objects:');
    
    // Track objects without IDs
    const objectsWithoutId = new Set<string>();
    
    this.objects.forEach((obj, key) => {
      const filename = obj.userData?.filename;
      const id = obj.uuid || obj.id;
      
      if (!id && filename) {
        objectsWithoutId.add(filename);
      }
      
      console.log(`Object ${key}:`, {
        id: id || 'NO_ID',
        filename: filename || 'NO_FILENAME',
        isDeleted: obj.isDeleted,
        type: obj.type,
        version: obj.version,
        lastEditedBy: obj.lastEditedBy,
        globalTimestamp: obj.globalTimestamp
      });
    });
    
    // Log any objects found by filename but missing IDs
    if (objectsWithoutId.size > 0) {
      console.warn('Objects missing IDs:', Array.from(objectsWithoutId));
    }
    
    // Search for specific filename if provided in context
    if (context.includes('filename:')) {
      const searchFilename = context.split('filename:')[1].trim();
      console.group(`Searching for filename: "${searchFilename}"`);
      const foundObjects = Array.from(this.objects.values())
        .filter(obj => obj.userData?.filename === searchFilename);
      
      if (foundObjects.length > 0) {
        console.log('Found objects with matching filename:', foundObjects);
      } else {
        console.warn('No objects found with filename:', searchFilename);
      }
      console.groupEnd();
    }
    
    console.groupEnd();
    
    console.group('Scene Information:');
    console.log('Scene Version:', this.sceneVersion);
    console.log('Connected to P2P:', this.p2pSync.isConnected());
    console.log('Total Scenes:', this.scenes.length);
    console.groupEnd();
    
    console.groupEnd();
  }
}

export const sceneState = SceneState.getInstance();
sceneState.setupP2PSync();

export function saveObjectChanges(
  objectData: ObjectState,
  options?: { deferReconstruct?: boolean; fromPeer?: boolean }
) {
  // console.log("saveObjectChanges", objectData);
  if (!objectData) return;

  const commonData = serializeThreeObject(objectData);
  sceneState.updateObject(commonData, options);
}

function serializeThreeObject(objectData){
  
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
    // userData: objectData.userData || {},
    userData: {
      ...objectData.userData,
      selected: objectData.layers?.test?.(1) ? 1 : 0,
    },
    position: convertToArray(objectData.position),
    rotation: convertToArray(objectData.rotation),
    scale: convertToArray(objectData.scale),
    version: (objectData.version || 0) + 1,
    sceneVersion: (objectData.sceneVersion || 0) + 1,
    versionNonce: objectData.versionNonce || generateVersionNonce(),
    size: objectData.size,
    isDeleted: objectData.isDeleted || false,
    color: convertColor(objectData.material?.color || objectData.color),
    lastEditedBy: objectData.loginName || loginName,
  };

  return commonData;
}

export function diffSceneChanges(
  scene: any,
  nonBloomScene: any,
  previousSnapShot = SceneState.getSceneObjArray(),
  options: { fromPeer?: boolean } = {}
) {

  console.log("diffSceneChanges", scene, nonBloomScene)
  const changedObjects: any = [];
  const currentSnapshot = {};

  // sceneState.addScene(scene)
  // sceneState.addScene(nonBloomScene)
  sceneState.replaceScenes([scene, nonBloomScene]); // GOING TO NEED IN PEER 2 PEER to use this a way to get previousSnapshot, which will be the scene im connecting to current object state...

  // Function to process objects in a scene
  function processSceneObjects(sceneToProcess) {
    sceneToProcess.traverse((object) => {
      if (object.shape) {
        

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

  // Update changed objects with deferred reconstruction
  changedObjects.forEach((object) => {
    saveObjectChanges(object, {
      deferReconstruct: true,
      fromPeer: options?.fromPeer, // If this update is from a peer, don't broadcast it
    });
  });

  // After all updates, reconstruct the scene once
  sceneState.reconstructScene();

  const serializedChangedObjects = changedObjects.map((object) => {
    const serializedObject = serializeThreeObject(object);
    return serializedObject;
  });
  
  // Broadcast the serialized changed objects
  // sceneState.broadcastUpdate(serializedChangedObjects);

   // Call saveStateToDB without awaiting
   sceneState.saveStateToDB().catch(error => 
    console.error("Error saving state to IndexedDB:", error)
  );

  if (sceneState.p2pSync.isConnected()){//&& !options?.fromPeer) {
        //   this.broadcastUpdate(dataToSave);
  // sceneState.broadcastUpdate(changedObjects);
  sceneState.broadcastUpdate(serializedChangedObjects);
  


        }  

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
  if (obj1.userData?.selected !== obj2.userData?.selected) return false;

  return true;
}
