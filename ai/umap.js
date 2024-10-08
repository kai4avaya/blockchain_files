// umap.js
import { share3dDat} from '../ui/graph_v2/create.js'
// import { share3dDat, updateSphereAndCubePositions} from '../ui/graph_v2/create.js';
import { getSceneBoundingBox, updateSphereAndCubePositions} from '../ui/graph_v2/reorientScene.js';

const dbWorker = new Worker('../workers/memory_worker.js');

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



// Handle messages from the DB worker (memory_worker.js)
dbWorker.onmessage = function (e) {
    const { id, data, error } = e.data;
    if (error) {
        console.error('DB Worker Error:', error);
        return;
    }

    if (id === 'getEmbeddings') {
        // Extract embeddings and fileId labels from the data
        const embeddings = data.map(item => item.embedding);
        const labels = data.map(item => item.fileId);

        // Perform UMAP dimensionality reduction with embeddings and labels
        performUMAP(embeddings, labels);
    }
};


// Function to perform UMAP dimensionality reduction
export function performUMAP(embeddings, labels) {
    umapWorker.postMessage({
        type: 'reduceDimensions',
        data: { embeddings, labels }
    });
    console.log('Sent embeddings and labels to UMAP worker for dimensionality reduction.', embeddings, labels);
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



// Fetch embeddings from IndexedDB and trigger UMAP
export function fetchEmbeddingsAndPerformUMAP() {
    dbWorker.postMessage({
        id: 'getEmbeddings',
        action: 'getData',
        data: { storeName: 'summaries', dbName: 'summarizationDB' }
    });
    console.log('Requested embeddings from IndexedDB.');
}

// Optional: Terminate workers when no longer needed
export function terminateWorkers() {
    umapWorker.postMessage({ type: 'terminate' });
    // dbscanWorker.postMessage({ type: 'terminate' });
    console.log('Terminated both UMAP and DBSCAN workers.');
}