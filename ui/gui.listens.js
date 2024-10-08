import { fetchEmbeddingsAndPerformUMAP } from '../ai/umap'
import { initConnectLines } from './graph_v2/lineGraphs'

export function initiate_gui_controls() {
  document.addEventListener('modalAction', (e) => {
    const action = e.detail.action;
    switch (action) {
      case 'visualize-embeddings':
        console.log('Visualize embeddings action triggered');
        // The spinner is already shown by the showSpinner function
        setTimeout(() => {
          fetchEmbeddingsAndPerformUMAP();
          // Add your logic here
        }, 4000); // Wait for 4 seconds before executing the actual action
        break;
      case 'cluster-nodes':
        console.log('Cluster nodes action triggered');
        // The spinner is already shown by the showSpinner function
        setTimeout(() => {
          // Add your logic here
        }, 4000);
        break;
      case 'show-network-graph':
        console.log('Show network graph action triggered');
        initConnectLines()
        // The spinner is already shown by the showSpinner function
        setTimeout(() => {
          // Add your logic here
        }, 4000);
        break;
      case 'filter-ideas':
        console.log('Filter ideas action triggered');
        // The spinner is already shown by the showSpinner function
        setTimeout(() => {
          // Add your logic here
        }, 4000);
        break;
      default:
        console.log('Unknown action:', action);
    }
  });
}