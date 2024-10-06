import {fetchEmbeddingsAndPerformUMAP} from '../ai/umap'


export function initiate_gui_controls(){
document.addEventListener('modalAction', (e) => {
    const action = e.detail.action;
    switch (action) {
      case 'visualize-embeddings':
        console.log('Visualize embeddings action triggered');
        fetchEmbeddingsAndPerformUMAP()
        // Add your logic here
        break;
      case 'cluster-nodes':
        console.log('Cluster nodes action triggered');
        // Add your logic here
        break;
      case 'show-network-graph':
        console.log('Show network graph action triggered');
        // Add your logic here
        break;
      case 'filter-ideas':
        console.log('Filter ideas action triggered');
        // Add your logic here
        break;
      default:
        console.log('Unknown action:', action);
    }
  });
}