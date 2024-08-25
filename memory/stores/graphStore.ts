import { makeAutoObservable, reaction } from "mobx";
import * as THREE from "three";
import loroCRDTManager from '../collaboration/graphcolab';
import { createSceneSnapshot } from '../../ui/graph_v2/snapshot';

export interface Snapshot {
  objects: any[];
  boxes: any[];
  containment: { [key: string]: string[] };
  debugObjects: THREE.Group;
}

class GraphStore {
  scene: THREE.Scene | null = null;
  nonBloomScene: THREE.Scene | null = null;
  snapshot: Snapshot | null = null;
  version: number = 0;

  constructor() {
    makeAutoObservable(this);
    this.setupReactions();
  }

  setupReactions() {
    reaction(
      () => [this.scene, this.nonBloomScene],
      () => {
        if (this.scene && this.nonBloomScene) {
          this.updateSnapshot();
        }
      },
      { fireImmediately: true }
    );
  }

  setScenes(scene: THREE.Scene, nonBloomScene: THREE.Scene) {
    this.scene = scene;
    this.nonBloomScene = nonBloomScene;
  }

  private updateSnapshot() {
    if (this.scene && this.nonBloomScene) {
      const newSnapshot = createSceneSnapshot([this.scene, this.nonBloomScene]);
      if (this.hasSnapshotChanged(newSnapshot)) {
        this.snapshot = newSnapshot;
        this.version++;
        this.sendToCRDT();
      }
    }
  }

  private hasSnapshotChanged(newSnapshot: Snapshot): boolean {
    // Implement a deep comparison between the new snapshot and the current one
    // Return true if there are meaningful changes, false otherwise
    // This is a placeholder implementation
    return JSON.stringify(newSnapshot) !== JSON.stringify(this.snapshot);
  }

  private sendToCRDT() {
    if (this.snapshot) {
      loroCRDTManager.updateScene({
        snapshot: this.snapshot,
        version: this.version
      });
    }
  }

  async applyUpdatedData(updatedData: { snapshot: Snapshot; version: number }) {
    if (updatedData.version > this.version) {
      this.snapshot = updatedData.snapshot;
      this.version = updatedData.version;
      this.updateThreeJsScene();
    }
  }

  private updateThreeJsScene() {
    // Logic to update Three.js scene based on the new snapshot
    // This would update object positions, scales, colors, etc.
    // And handle containment relationships
    if (this.scene && this.nonBloomScene && this.snapshot) {
      // Implement the logic to update the Three.js scenes based on the snapshot
      // This might involve creating, updating, or removing objects in the scenes
    }
  }
}

export const graphStore = new GraphStore();
export default graphStore;