// import { fetchEmbeddingsAndPerformUMAP } from '../ai/umap'
// import { initConnectLines } from './graph_v2/lineGraphs'
// import { performClustering } from '../ai/clustering.js'

// export function initiate_gui_controls() {
//   document.addEventListener('modalAction', (e) => {
//     const action = e.detail.action;
//     switch (action) {
//       case 'visualize-embeddings':
//         console.log('Visualize embeddings action triggered');
//         // The spinner is already shown by the showSpinner function
//         setTimeout(() => {
//           fetchEmbeddingsAndPerformUMAP();
//           // Add your logic here
//         }, 4000); // Wait for 4 seconds before executing the actual action
//         break;
//       case 'cluster-nodes':
//         console.log('Cluster nodes action triggered');
//         // The spinner is already shown by the showSpinner function
//         performClustering();
//         setTimeout(() => {
//           // Add your logic here
//         }, 4000);
//         break;
//       case 'show-network-graph':
//         console.log('Show network graph action triggered');
//         initConnectLines()
//         // The spinner is already shown by the showSpinner function
//         setTimeout(() => {
//           // Add your logic here
//         }, 4000);
//         break;
//       case 'filter-ideas':
//         console.log('Filter ideas action triggered');
//         // The spinner is already shown by the showSpinner function
//         setTimeout(() => {
//           // Add your logic here
//         }, 4000);
//         break;
//       default:
//         console.log('Unknown action:', action);
//     }
//   });
// }

import { fetchEmbeddingsAndPerformUMAP } from '../ai/umap'
import { initConnectLines } from './graph_v2/lineGraphs'
import { performClustering } from '../ai/clustering.js'
import { updateStatus } from './components/process.js'  // Import the updateStatus function

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