import { makeObservable, observable, action, runInAction, autorun } from "mobx";
import { saveData, getData } from '../local/db.js';
import { updateGraph, isRendererReady } from '../../ui/graph/graph.js'; // Import isRendererReady
import { fileStore } from './fileStore';

// Define interfaces for the data structures
interface Node {
  id: string;
  fileId?: string;
  name?: string;
  size?: number;
  [key: string]: any; // Additional properties
}

interface Edge {
  id: string;
  source: string;
  target: string;
  [key: string]: any; // Additional properties
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
    this.loadInitialState();

    autorun(() => {
      if (!isRendererReady()) {
        return; // Skip calling updateGraph if renderer is not ready
      }
      
      const nodesWithFiles = this.nodes.map(node => {
        const file = fileStore.files.find(file => file.id === node.fileId);
        return { ...node, name: file?.name || "Unknown", size: file?.size || 0 };
      });
      console.log("AUTORUN: nodes", nodesWithFiles);
      updateGraph(nodesWithFiles);
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
    this.nodes.push(node);
    await this.saveData('nodes', this.nodes);
  }

  @action.bound
  async updateNode(node: Node): Promise<void> {
    const index = this.nodes.findIndex(n => n.id === node.id);
    if (index !== -1) {
      this.nodes[index] = node;
      await this.saveData('nodes', this.nodes);
    }
  }

  @action.bound
  async removeNode(nodeId: string): Promise<void> {
    this.nodes = this.nodes.filter(node => node.id !== nodeId);
    await this.saveData('nodes', this.nodes);
  }

  @action.bound
  async addIsland(island: Island): Promise<void> {
    this.islands.push({
      id: island.id,
      nodeIds: island.nodeIds || []
    });
    await this.saveData('islands', this.islands);
  }

  @action.bound
  async updateIsland(islandId: string, newNodeIds: string[]): Promise<void> {
    const island = this.islands.find(i => i.id === islandId);
    if (island) {
      island.nodeIds = newNodeIds;
      await this.saveData('islands', this.islands);
    }
  }

  @action.bound
  async removeIsland(islandId: string): Promise<void> {
    this.islands = this.islands.filter(island => island.id !== islandId);
    await this.saveData('islands', this.islands);
  }

  @action.bound
  async saveData(storeName: string, data: any): Promise<void> {
    await saveData(storeName, data);
  }
}

const graphStore = new GraphStore();
export default graphStore;
