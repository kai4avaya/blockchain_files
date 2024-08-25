import Loro from 'loro-crdt';
import graphStore from '../stores/graphStore';
import { updateGraph } from '../../ui/graph_v2/create.js'

class LoroGraphManager {
  private loro: Loro;

  constructor() {
    this.loro = new Loro();
    this.initializeFromGraphStore();
  }

  private initializeFromGraphStore() {
    const snapshot = graphStore.getGraphData();
    this.loro.getMap("graph").set("snapshot", snapshot);
  }

  async updateGraph(updateFunction: (snapshot: any) => any) {
    const currentSnapshot = this.loro.getMap("graph").get("snapshot");
    const updatedSnapshot = updateFunction(currentSnapshot);
    this.loro.getMap("graph").set("snapshot", updatedSnapshot);

    // Update GraphStore
    await graphStore.updateFromSnapshot(updatedSnapshot);

    // Update visual graph
    updateGraph(updatedSnapshot);
  }

  exportChanges(): Uint8Array {
    return this.loro.exportFrom();
  }

  importChanges(bytes: Uint8Array) {
    this.loro.import(bytes);
    const updatedSnapshot = this.loro.getMap("graph").get("snapshot");
    graphStore.updateFromSnapshot(updatedSnapshot);
    updateGraph(updatedSnapshot);
  }

  saveToLocalStorage() {
    const bytes = this.loro.exportSnapshot();
    localStorage.setItem('loroGraphSnapshot', JSON.stringify(Array.from(bytes)));
  }

  loadFromLocalStorage() {
    const storedBytes = localStorage.getItem('loroGraphSnapshot');
    if (storedBytes) {
      const bytes = new Uint8Array(JSON.parse(storedBytes));
      this.loro.import(bytes);
      const snapshot = this.loro.getMap("graph").get("snapshot");
      graphStore.updateFromSnapshot(snapshot);
      updateGraph(snapshot);
    }
  }
}

export const loroGraphManager = new LoroGraphManager();