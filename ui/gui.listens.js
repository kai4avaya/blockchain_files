import { fetchEmbeddingsAndPerformUMAP } from '../ai/umap'
import { initConnectLines } from './graph_v2/lineGraphs'
import { performClustering } from '../ai/clustering.js'
import { updateStatus } from './components/process.js'  // Import the updateStatus function
import {setupTextProjectionVisualization} from '../ai/vector_text_patterns.js'
export function initiate_gui_controls() {
  document.addEventListener('modalAction', (e) => {
    const action = e.detail.action;
    switch (action) {
      case 'visualize-embeddings':
        console.log('Visualize embeddings action triggered');
        updateStatus("Initializing embedding visualization...");
        setTimeout(() => {
          updateStatus("Fetching embeddings and performing UMAP...");
          fetchEmbeddingsAndPerformUMAP()
            .then(() => {
              updateStatus("Embedding visualization complete");
              setTimeout(() => updateStatus("done"), 2000);
            })
            .catch(error => {
              console.error("Error in embedding visualization:", error);
              updateStatus("Error in embedding visualization");
              setTimeout(() => updateStatus("done"), 2000);
            });
        }, 4000);
        break;

      case 'cluster-nodes':
        console.log('Cluster nodes action triggered');
        updateStatus("Initializing node clustering...");
        setTimeout(() => {
          updateStatus("Performing clustering analysis...");
          performClustering()
            .then(() => {
              updateStatus("Node clustering complete");
              setTimeout(() => updateStatus("done"), 2000);
            })
            .catch(error => {
              console.error("Error in node clustering:", error);
              updateStatus("Error in node clustering");
              setTimeout(() => updateStatus("done"), 2000);
            });
        }, 4000);
        break;

      case 'show-network-graph':
        console.log('Show network graph action triggered');
        updateStatus("Initializing network graph...");
        setTimeout(() => {
          updateStatus("Generating network connections...");
          initConnectLines()
            .then(() => {
              updateStatus("Network graph generation complete");
              setTimeout(() => updateStatus("done"), 2000);
            })
            .catch(error => {
              console.error("Error in network graph generation:", error);
              updateStatus("Error in network graph generation");
              setTimeout(() => updateStatus("done"), 2000);
            });
        }, 4000);
        break;

      case 'filter-ideas':
        console.log('Filter ideas action triggered');
        updateStatus("Initializing idea filtering...");
        setTimeout(() => {
          updateStatus("Applying filters to ideas...");
          // Add your logic here
          // For now, we'll just simulate a process
          setupTextProjectionVisualization()
          setTimeout(() => {
            updateStatus("Idea filtering complete");
            setTimeout(() => updateStatus("done"), 2000);
          }, 2000);
        }, 4000);
        break;

      default:
        console.log('Unknown action:', action);
        updateStatus("Unknown action triggered");
        setTimeout(() => updateStatus("done"), 2000);
    }
  });
}