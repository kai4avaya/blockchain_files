import { reconstructScene } from "../../ui/graph_v2/create";
import indexDBOverlay from '../local/file_worker';
import { P2PSync } from '../../network/peer2peer';
interface ObjectState {
  uuid: string; // original id of object
  type: string;
  shape: string;
  position: number[];
  rotation: number[];
  scale: number[];
  version: number;
  versionNonce: number;
  lastEditedBy: string;
  isDeleted: boolean;
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


  private constructor() {
    this.objects = new Map();
    this.updatedObjects = new Set();
    this.savedObjects = new Set();
    this.broadcastChannel = new BroadcastChannel('sceneStateChannel');
    this.broadcastChannel.onmessage = this.handleBroadcastMessage.bind(this);
    // this.p2pSync = P2PSync.getInstance(this);
  }
  
  private broadcastUpdate(state: any) {
    this.broadcastChannel.postMessage(state);

    // p2pSync.broadcastUpdate(state);
    // this.p2pSync.broadcastUpdate(state);
  }
  
  private handleBroadcastMessage(event: MessageEvent) {
    const incomingState = event.data as ObjectState;
    this.mergeUpdate(incomingState);
  }

  connectToPeer(peerId: string) {
    // p2pSync.connectToPeer(peerId);
  }


  getMyPeerId(): string {
    // return p2pSync.getMyPeerId();
  }

  
  static getInstance(): SceneState {
    if (!SceneState.instance) {
      SceneState.instance = new SceneState();
    }
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

  syncWithPeer(peerObjects: ObjectState[]): void {
    peerObjects.forEach(peerObject => {
      const existingObject = this.objects.get(peerObject.uuid);
      if (!existingObject || this.isNewerState(peerObject, existingObject)) {
        this.mergeUpdate(peerObject);
      }
    });
    this.reconstructScene();
  }

  private loadState(storedState: ObjectState[]): void {
    storedState.forEach(state => this.objects.set(state.uuid, state));
    this.reconstructScene();
  }

  private reconstructScene(): void {
    reconstructScene(Array.from(this.objects.values()));
  }
  
  updateObject(objectState: Partial<ObjectState> & { uuid: string }): void {
    const existingState = this.objects.get(objectState.uuid);

    if (existingState) {
      if (this.hasChanged(existingState, objectState)) {
        const updatedState = {
          ...existingState,
          ...objectState,
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

    // If it's a cube, also delete its counterpart
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
  
  mergeUpdate(incomingState: ObjectState): void {
    const existingState = this.objects.get(incomingState.uuid);

    if (!existingState || this.isNewerState(incomingState, existingState)) {
      if (incomingState.isDeleted) {
        // If the incoming state is marked as deleted and it's newer, keep it in the objects map
        // but mark it as deleted
        this.objects.set(incomingState.uuid, incomingState);
      } else {
        // Normal update for non-deleted objects
        this.objects.set(incomingState.uuid, {
          ...existingState,
          ...incomingState,
        });
      }
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

  // deleteObject(uuid: string): void {
  //   const state = this.objects.get(uuid);
  //   if (state) {
  //     const updatedState = {
  //       ...state,
  //       isDeleted: true,
  //       version: state.version + 1,
  //       versionNonce: this.generateVersionNonce(),
  //       lastEditedBy: this.userId
  //     };
  //     this.mergeUpdate(updatedState);
  //     this.updatedObjects.add(uuid);
  //   }
  // }

  // getSerializableState(): ObjectState[] {
  //   console.log("Array.from(this.objects.values()", Array.from(this.objects.values()))
  //   return Array.from(this.objects.values());
  // }
  getSerializableState(): ObjectState[] {
    return Array.from(this.objects.values()).filter(state => !state.isDeleted);
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => this.saveStateToDB(), 1000);
  }

  private async saveStateToDB() {
    try {
      const updatedStates = Array.from(this.updatedObjects)
        .map(uuid => this.objects.get(uuid))
        .filter(state => state !== undefined);
      
      if (updatedStates.length > 0) {
        // Fetch existing data from IndexedDB
        const existingData = await indexDBOverlay.getData(this.STORAGE_KEY);
        const existingMap = new Map(existingData.map(item => [item.uuid, item]));
  
        // Prepare data to be saved
        const dataToSave = updatedStates.map(state => {
          if (state) {
            const existingState = existingMap.get(state.uuid);
            if (existingState) {
              // If the state already exists in IndexedDB, update it
              return {
                ...existingState,
                ...state,
                version: (existingState.version || 0) + 1
              };
            } else {
              // If it's a new state, add it
              return {
                ...state,
                version: 1
              };
            }
          }
          return state;
        });
  
        this.broadcastUpdate(dataToSave);

        await indexDBOverlay.saveData(this.STORAGE_KEY, dataToSave);
        
        updatedStates.forEach(state => {
          if (state) {
            this.savedObjects.add(state.uuid);
          }
        });
      }
      this.updatedObjects.clear();
    } catch (error) {
      console.error('Error saving state to IndexedDB:', error);
    }
  }
  // private async saveStateToDB() {
  //   try {
  //     const updatedStates = Array.from(this.updatedObjects)
  //       .map(uuid => this.objects.get(uuid))
  //       .filter(state => state !== undefined && (!this.savedObjects.has(state.uuid) || this.hasChanged(this.objects.get(state.uuid)!, state!)));
      
  //       console.log("updatedStates", updatedStates)
  //     if (updatedStates.length > 0) {
  //       await indexDBOverlay.saveData(this.STORAGE_KEY, updatedStates);
  //       updatedStates.forEach(state => {
  //         if (state) {
  //           this.savedObjects.add(state.uuid);
  //         }
  //       });
  //     }
  //     this.updatedObjects.clear();
  //   } catch (error) {
  //     console.error('Error saving state to IndexedDB:', error);
  //   }
  // }

  // private broadcastUpdate(state: ObjectState) {
  //   // Implement your broadcast logic here
  //   // For example: socket.emit('objectUpdate', state);
  // }

  private generateVersionNonce(): number {
    return Math.floor(Math.random() * 1000000);
  }
}

export const sceneState = SceneState.getInstance();
// const p2pSync = new P2PSync(sceneState);