import { makeObservable, observable, action, runInAction } from "mobx";
import { saveData, getData } from '../local/dbgeneral';
import { updateGraph, isRendererReady } from '../../ui/graph/graph.js';
import { fetchGraphDataFromServer } from '../../services/graphqlLayer';

interface SnapshotObject {
  id: string;
  type: string;
  scene: number;
  [key: string]: any;
}

interface Box {
  id: string;
  wireframe: any;
  solid: any;
}

interface Snapshot {
  objects: SnapshotObject[];
  boxes: Box[];
  containment: { [key: string]: string[] };
}

class GraphStore {
  @observable snapshot: Snapshot = { objects: [], boxes: [], containment: {} };

  constructor() {
    makeObservable(this);
    this.initializeGraphData();
  }

  @action.bound
  async initializeGraphData(): Promise<void> {
    try {
      const serverData = await fetchGraphDataFromServer();
      runInAction(() => {
        this.snapshot = serverData.snapshot || { objects: [], boxes: [], containment: {} };
      });
    } catch (error) {
      console.warn("Failed to fetch data from server, loading from IndexedDB", error);
      const graphData = await getData('graph');
      runInAction(() => {
        this.snapshot = graphData.snapshot || { objects: [], boxes: [], containment: {} };
      });
    }
    this.updateGraphState();
  }

  @action.bound
  async updateGraphState(): Promise<void> {
    if (isRendererReady()) {
      updateGraph(this.snapshot);
    }
    await saveData('graph', { snapshot: this.snapshot });
  }

  @action.bound
  async updateFromSnapshot(newSnapshot: Snapshot): Promise<void> {
    runInAction(() => {
      this.snapshot = newSnapshot;
    });
    await this.updateGraphState();
  }

  getGraphData(): Snapshot {
    return this.snapshot;
  }
}

const graphStore = new GraphStore();
export default graphStore;