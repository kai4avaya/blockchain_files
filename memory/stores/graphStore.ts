// import { makeObservable, observable, action, runInAction, autorun } from "mobx";
// import { saveData, getData } from '../local/db.js';
// import { updateGraph, isRendererReady } from '../../graph.js'; // Import isRendererReady

// class GraphStore {
//   @observable nodes = [];
//   @observable edges = [];
//   @observable islands = [];

//   constructor() {
//     makeObservable(this);
//     this.loadInitialState();

//     autorun(() => {
//       if (!isRendererReady()) {
//         return; // Skip calling updateGraph if renderer is not ready
//       }
      
//       const nodesWithFiles = this.nodes.map(node => {
//         const file = fileStore.files.find(file => file.id === node.fileId);
//         return { ...node, name: file?.name || "Unknown", size: file?.size || 0 };
//       });
//       console.log("AUTORUN: nodes", nodesWithFiles);
//       updateGraph(nodesWithFiles);
//     });
//   }

//   @action.bound
//   async loadInitialState() {
//     const [nodes, edges, islands] = await Promise.all([
//       getData('nodes'),
//       getData('edges'),
//       getData('islands')
//     ]);

//     runInAction(() => {
//       if (nodes) this.nodes = nodes;
//       if (edges) this.edges = edges;
//       if (islands) this.islands = islands;
//     });
//   }

//   @action.bound
//   async addNode(node) {
//     this.nodes.push(node);
//     await this.saveData('nodes', this.nodes);
//   }

//   @action.bound
//   async updateNode(node) {
//     const index = this.nodes.findIndex(n => n.id === node.id);
//     if (index !== -1) {
//       this.nodes[index] = node;
//       await this.saveData('nodes', this.nodes);
//     }
//   }

//   @action.bound
//   async removeNode(nodeId) {
//     this.nodes = this.nodes.filter(node => node.id !== nodeId);
//     await this.saveData('nodes', this.nodes);
//   }

//   @action.bound
//   async saveData(storeName, data) {
//     await saveData(storeName, data);
//   }
// }

// const graphStore = new GraphStore();
// export default graphStore;
import { makeObservable, observable, action, runInAction, autorun } from "mobx";
import { saveData, getData } from '../local/db.js';
import { updateGraph, isRendererReady } from '../../graph.js'; // Import isRendererReady

class GraphStore {
  @observable nodes = [];
  @observable edges = [];
  @observable islands = [];

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
  async loadInitialState() {
    const [nodes, edges, islands] = await Promise.all([
      getData('nodes'),
      getData('edges'),
      getData('islands')
    ]);

    runInAction(() => {
      if (nodes) this.nodes = nodes;
      if (edges) this.edges = edges;
      if (islands) this.islands = islands;
    });
  }

  @action.bound
  async addNode(node) {
    this.nodes.push(node);
    await this.saveData('nodes', this.nodes);
  }

  @action.bound
  async updateNode(node) {
    const index = this.nodes.findIndex(n => n.id === node.id);
    if (index !== -1) {
      this.nodes[index] = node;
      await this.saveData('nodes', this.nodes);
    }
  }

  @action.bound
  async removeNode(nodeId) {
    this.nodes = this.nodes.filter(node => node.id !== nodeId);
    await this.saveData('nodes', this.nodes);
  }

  @action.bound
  async saveData(storeName, data) {
    await saveData(storeName, data);
  }
}

const graphStore = new GraphStore();
export default graphStore;
