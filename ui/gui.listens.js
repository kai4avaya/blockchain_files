import { fetchEmbeddingsAndPerformUMAP } from '../ai/umap'
import { initConnectLines } from './graph_v2/lineGraphs'
import { performClustering } from '../ai/clustering.js'
import { updateStatus } from './components/process.js'  // Import the updateStatus function
import {setupTextProjectionVisualization} from '../ai/vector_text_patterns.js'
import { saveCurrentSceneState, restoreOriginalScene, createActionPanel} from './graph_v2/restore_scene.js';
import { createTextNetwork } from './graph_v2/text_network';

let cleanupTextNetwork = null;
let choice = 0;

export function initiate_gui_controls() {
    const actionPanel = createActionPanel();
    
    document.addEventListener('modalAction', (e) => {
        const action = e.detail.action;
        
        // Show spinner, hide buttons immediately when any action starts
        showSpinner();

        // Hide the modal that triggered the action
        const modal = document.querySelector('.modal');
        if (modal && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }

        // Check if we need to restore the scene before proceeding
        const needsRestore = document.querySelector('.restore-btn')?.style.display !== 'none';
        if (needsRestore) {
            restoreOriginalScene();
        }

        // Save initial scene state before any action
        saveCurrentSceneState();

        switch (action) {
            case 'visualize-embeddings':
                choice = 1;
                console.log('Visualize embeddings action triggered');
                updateStatus("Initializing embedding visualization...");
                setTimeout(() => {
                    updateStatus("Fetching embeddings and performing UMAP...");
                    fetchEmbeddingsAndPerformUMAP()
                        .then(() => {
                            updateStatus("Embedding visualization complete");
                            setTimeout(() => updateStatus("done"), 2000);
                            handleVisualizationComplete();
                        })
                        .catch(error => {
                            console.error("Error in embedding visualization:", error);
                            updateStatus("Error in embedding visualization");
                            setTimeout(() => updateStatus("done"), 2000);
                        });
                }, 4000);
                break;

            case 'cluster-nodes':
                choice = 2;
                console.log('Cluster nodes action triggered');
                updateStatus("Initializing node clustering...");
                setTimeout(() => {
                    updateStatus("Performing clustering analysis...");
                    performClustering()
                        .then(() => {
                            updateStatus("Node clustering complete");
                            setTimeout(() => updateStatus("done"), 2000);
                            handleVisualizationComplete();
                        })
                        .catch(error => {
                            console.error("Error in node clustering:", error);
                            updateStatus("Error in node clustering");
                            setTimeout(() => updateStatus("done"), 2000);
                        });
                }, 4000);
                break;

            case 'show-network-graph':
                choice = 3;
                console.log('Show network graph action triggered');
                updateStatus("Initializing network graph...");
                setTimeout(() => {
                    updateStatus("Generating network connections...");
                    initConnectLines()
                        .then(() => {
                            updateStatus("Network graph generation complete");
                            setTimeout(() => updateStatus("done"), 2000);
                            handleVisualizationComplete();
                        })
                        .catch(error => {
                            console.error("Error in network graph generation:", error);
                            updateStatus("Error in network graph generation");
                            setTimeout(() => updateStatus("done"), 2000);
                        });
                }, 4000);
                break;

            case 'filter-ideas':
                choice = 4;
                console.log('Filter ideas action triggered');
                updateStatus("Initializing idea filtering...");
                
                // Save scene state specifically for this option
                saveCurrentSceneState();
                
                setTimeout(() => {
                    updateStatus("Applying filters to ideas...");
                    setupTextProjectionVisualization()
                        .then(() => {
                            updateStatus("Idea filtering complete");
                            setTimeout(() => updateStatus("done"), 2000);
                            handleVisualizationComplete();
                        })
                        .catch(error => {
                            console.error("Error in idea filtering:", error);
                            updateStatus("Error in idea filtering");
                            setTimeout(() => updateStatus("done"), 2000);
                            restoreOriginalScene(); // Restore on error
                        });
                }, 4000);
                break;

            case 'hierarchy-view':
                choice = 5;
                console.log('Hierarchy view action triggered');
                try {
                    if (cleanupTextNetwork) {
                        cleanupTextNetwork();
                        cleanupTextNetwork = null;
                    } else {
                        cleanupTextNetwork = createTextNetwork();
                        // Force loader to complete after 10 seconds
                        setTimeout(() => {
                            handleVisualizationComplete();
                            updateStatus("Graph visualization complete");
                            setTimeout(() => updateStatus("done"), 2000);
                        }, 10000);
                    }
                } catch (error) {
                    console.error("Error in text network visualization:", error);
                    updateStatus("Error in text network visualization");
                    setTimeout(() => updateStatus("done"), 2000);
                }
                break;

            default:
                console.log('Unknown action:', action);
                updateStatus("Unknown action triggered");
                setTimeout(() => updateStatus("done"), 2000);
        }
    });

    // Add click handlers for the modal cards
    document.querySelectorAll('.modal-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const action = card.dataset.action;
            // Dispatch the modalAction event
            document.dispatchEvent(new CustomEvent('modalAction', {
                detail: { action }
            }));
            
            // Hide the modal
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Helper functions for consistent panel handling
    function showSpinner() {
        if (actionPanel) {
            actionPanel.style.display = 'flex';
            actionPanel.querySelector('.action-panel-spinner').style.display = 'block';
            actionPanel.querySelector('.action-panel-buttons').style.display = 'none';
        }
    }

    function handleVisualizationComplete() {
        if (actionPanel) {
            actionPanel.style.display = 'flex'; // Ensure panel is visible
            actionPanel.querySelector('.action-panel-spinner').style.display = 'none';
            actionPanel.querySelector('.action-panel-buttons').style.display = 'flex';
            
            // Make sure restore button is visible
            const restoreBtn = actionPanel.querySelector('.restore-btn');
            if (restoreBtn) {
                restoreBtn.style.display = 'block';
            }
        }
    }

    // Setup button handlers
    actionPanel.querySelector('.restore-btn').addEventListener('click', () => {
        const filterElements = document.querySelectorAll('.vector-projection');

        if (choice === 2 || choice === 4) {
            // setTimeout(() => {
                window.location.reload();
            // }, 100);
        }

        if (restoreOriginalScene()) {
            updateStatus("Scene restored to original state");
            // Reload page if it was a filter-ideas view
        }
    });

    actionPanel.querySelector('.screenshot-btn').addEventListener('click', async () => {
        try {
            const { share3dDat } = await import('./graph_v2/create.js');
            const { renderer, scene, camera } = share3dDat();
            
            // Ensure scene is rendered before capturing
            renderer.render(scene, camera);
            
            const link = document.createElement('a');
            link.download = 'scene-screenshot.png';
            link.href = renderer.domElement.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Error taking screenshot:', error);
        }
    });
}