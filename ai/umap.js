import { getSceneBoundingBox} from '../ui/graph_v2/create.js'
import { share3dDat } from '../ui/graph_v2/create.js';
// Initialize the worker
import UMAPWorker from '../workers/umap_worker.js?worker';
const umapWorker = new UMAPWorker();
// Handle messages from the UMAP worker

// Handle messages from the worker
umapWorker.onmessage = function (e) {
    const { type, data } = e.data;

    if (type === 'dimensionReductionResult') {
        // Destructure the received data
        const { reducedData, labels } = data;

        // Update sphere and cube positions with cluster colors
        updateSphereAndCubePositions(reducedData, labels);
    }
    else if (type === 'progress') {
        console.log(`UMAP progress: Epoch ${data.epoch}`);
    }
    else if (type === 'error') {
        console.error(`UMAP Worker Error: ${data}`);
    }
};


// Function to perform UMAP dimensionality reduction
export function performUMAP(embeddings) {
    umapWorker.postMessage({
        type: 'reduceDimensions',
        data: { embeddings }
    });
    console.log('Sent embeddings to UMAP worker for dimensionality reduction.');
}

// Function to send the scene bounding box to the UMAP worker
export function sendSceneBoundingBoxToWorker() {
    const { scene } = share3dDat();
    const sceneBoundingBox = getSceneBoundingBox(scene);
    umapWorker.postMessage({
        type: 'setSceneBoundingBox',
        data: sceneBoundingBox
    });
    console.log('Sent scene bounding box to UMAP worker:', sceneBoundingBox);
}

// Optional: Terminate workers when no longer needed
export function terminateWorkers() {
    umapWorker.postMessage({ type: 'terminate' });
    // dbscanWorker.postMessage({ type: 'terminate' });
    console.log('Terminated both UMAP and DBSCAN workers.');
}