import { reconstructScene } from "../../ui/graph_v2/create";
import indexDBOverlay from '../local/file_worker';

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
  private readonly STORAGE_KEY = 'graph';
  private saveTimeout: NodeJS.Timeout | null = null;
  private userId: string = "noUserId";

  private constructor() {
    this.objects = new Map();
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
      } else {
      }
    } catch (error) {
      console.error('Error initializing SceneState:', error);
    }
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
          version: existingState.version + 1,
          versionNonce: this.generateVersionNonce(),
          lastEditedBy: this.userId 
        };
        this.mergeUpdate(updatedState);
      }
    } else {
      this.createObject(objectState as ObjectState);
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
        // If the incoming state is marked as deleted, update only if it's newer
        this.objects.set(incomingState.uuid, {
          ...existingState,
          ...incomingState,
          isDeleted: true
        });
      } else if (existingState && existingState.isDeleted) {
        // If the existing state was deleted but the incoming state is not,
        // only update if the incoming state is newer
        if (this.isNewerState(incomingState, existingState)) {
          this.objects.set(incomingState.uuid, incomingState);
        }
      } else {
        // Normal update for non-deleted objects
        this.objects.set(incomingState.uuid, {
          ...existingState,
          ...incomingState,
        });
      }
      this.scheduleSave();
      this.reconstructScene();
      this.broadcastUpdate(incomingState);
    }
  }

  private createObject(state: ObjectState): void {
    const newState = {
      ...state,
      // version: 1,
      // versionNonce: this.generateVersionNonce(),
      lastEditedBy: this.userId
    };
    this.objects.set(newState.uuid, newState);
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
      const updatedState = {
        ...state,
        isDeleted: true,
        version: state.version + 1,
        versionNonce: this.generateVersionNonce(),
        lastEditedBy: this.userId
      };
      this.mergeUpdate(updatedState);
    }
  }

  getSerializableState(): ObjectState[] {
    console.log("Array.from(this.objects.values()", Array.from(this.objects.values()))
    return Array.from(this.objects.values());
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => this.saveStateToDB(), 1000);
  }

  private async saveStateToDB() {
    try {
      await indexDBOverlay.saveData(this.STORAGE_KEY, this.getSerializableState());
    } catch (error) {
      console.error('Error saving state to IndexedDB:', error);
    }
  }

  private broadcastUpdate(state: ObjectState) {
    // Implement your broadcast logic here
    // For example: socket.emit('objectUpdate', state);
  }

  private generateVersionNonce(): number {
    return Math.floor(Math.random() * 1000000);
  }
}

export const sceneState = SceneState.getInstance();