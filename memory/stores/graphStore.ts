import { makeObservable, observable, action, runInAction, autorun } from "mobx";
// import { saveData, getData } from '../local/db.js';
import { saveData, getData } from '../local/dbgeneral';
import { updateGraph, isRendererReady } from '../../ui/graph/graph.js';
import { FileStore } from './fileStore';
import { fetchGraphDataFromServer } from '../../services/graphqlLayer'; // Hypothetical function to fetch data from server

interface Node {
  id: string;
  fileId?: string;
  name?: string;
  size?: number;
  shapeType?: string; // E.g., "sphere", "cube", "customShape"
  geometry?: { [key: string]: any }; // Geometry-specific data (e.g., radius, width, height)
  material?: { [key: string]: any }; // Material-specific data (e.g., color, texture)
  position?: { x: number; y: number; z: number }; // Position in 3D space
  rotation?: { x: number; y: number; z: number }; // Rotation in 3D space
  scale?: { x: number; y: number; z: number }; // Scale in 3D space
  [key: string]: any; // Additional properties
}


interface Edge {
  id: string;
  source: string;
  target: string;
  [key: string]: any;
}

interface Island {
  id: string;
  nodeIds: string[];
}
class GraphStore {
  @observable nodes: Node[] = [];
  @observable edges: Edge[] = [];
  @observable islands: Island[] = [];

  
  constructor() {
    makeObservable(this);
    this.initializeGraphData();
  }

  @action.bound
  async initializeGraphData(): Promise<void> {
    try {
      // First, attempt to load data from the server
      const serverData = await fetchGraphDataFromServer();
      runInAction(() => {
        this.nodes = serverData.nodes || [];
        this.edges = serverData.edges || [];
        this.islands = serverData.islands || [];
      });
    } catch (error) {
      console.warn("Failed to fetch data from server, loading from IndexedDB", error);

      // If server data fails, load from IndexedDB
      const graphData = await getData('graph');
      runInAction(() => {
        this.nodes = graphData.nodes || [];
        this.edges = graphData.edges || [];
        this.islands = graphData.islands || [];
      });
    }

    this.updateGraphState();
  }

  @action.bound
  async updateGraphState(): Promise<void> {
    // Trigger a UI update
    if (isRendererReady()) {
      updateGraph(this.nodes, this.edges, this.islands);
    }

    // Save the current graph state to IndexedDB
    await saveData('graph', {
      nodes: this.nodes,
      edges: this.edges,
      islands: this.islands
    });
  }


  @action.bound
  async loadInitialState(): Promise<void> {
    const [nodes, edges, islands] = await Promise.all([
      getData('nodes') as Promise<Node[]>,
      getData('edges') as Promise<Edge[]>,
      getData('islands') as Promise<Island[]>
    ]);

    runInAction(() => {
      if (nodes) this.nodes = nodes;
      if (edges) this.edges = edges;
      if (islands) this.islands = islands;
    });
  }

  @action.bound
  async addNode(node: Node): Promise<void> {
    runInAction(() => this.nodes.push(node));
    await this.updateGraphState();
  }

  @action.bound
  async updateNode(node: Node): Promise<void> {
    runInAction(() => {
      const index = this.nodes.findIndex(n => n.id === node.id);
      if (index !== -1) this.nodes[index] = node;
    });
    await this.updateGraphState();
  }

  @action.bound
  async removeNode(nodeId: string): Promise<void> {
    runInAction(() => this.nodes = this.nodes.filter(node => node.id !== nodeId));
    await this.updateGraphState();
  }

  @action.bound
  async upsertIsland(islandId: string, nodeIds: string[]): Promise<void> {
    runInAction(() => {
      let island = this.islands.find(i => i.id === islandId);

      if (island) {
        island.nodeIds = [...island.nodeIds, ...nodeIds];
      } else {
        this.islands.push({ id: islandId || `island-${Date.now()}`, nodeIds });
      }
    });
    await this.updateGraphState();
  }

  @action.bound
  async updateGraphState(): Promise<void> {
    await Promise.all([
      this.saveData('nodes', this.nodes),
      this.saveData('islands', this.islands)
    ]);
  }
}

const graphStore = new GraphStore();
export default graphStore;

