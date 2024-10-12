// // umap.js
// import { share3dDat} from '../ui/graph_v2/create.js'
// // import { share3dDat, updateSphereAndCubePositions} from '../ui/graph_v2/create.js';
// import { getSceneBoundingBox, updateSphereAndCubePositions} from '../ui/graph_v2/reorientScene.js';
// import indexDBOverlay from  '../memory/local/file_worker'
// const dbWorker = new Worker('../workers/memory_worker.js');

// // Initialize the worker
// import UMAPWorker from '../workers/umap_worker.js?worker';
// const umapWorker = new UMAPWorker();
// // Handle messages from the UMAP worker

// // Handle messages from the worker
// umapWorker.onmessage = function (e) {
//     const { type, data } = e.data;

//     if (type === 'dimensionReductionResult') {
//         // Destructure the received data
//         const { reducedData, labels } = data;

//         // Update sphere and cube positions with cluster colors
//         updateSphereAndCubePositions(reducedData, labels);
//     }
//     else if (type === 'progress') {
//         console.log(`UMAP progress: Epoch ${data.epoch}`);
//     }
//     else if (type === 'error') {
//         console.error(`UMAP Worker Error: ${data}`);
//     }
// };



// // Handle messages from the DB worker (memory_worker.js)
// dbWorker.onmessage = function (e) {
//     const { id, data, error } = e.data;
//     if (error) {
//         console.error('DB Worker Error:', error);
//         return;
//     }

//     if (id === 'getEmbeddings') {
//         // Extract embeddings and fileId labels from the data
//         const embeddings = data.map(item => item.embedding);
//         const labels = data.map(item => item.fileId);

//         // Perform UMAP dimensionality reduction with embeddings and labels
//         performUMAP(embeddings, labels);
//     }
// };


// // Function to perform UMAP dimensionality reduction
// export function performUMAP(embeddings, labels) {
//     umapWorker.postMessage({
//         type: 'reduceDimensions',
//         data: { embeddings, labels }
//     });
//     console.log('Sent embeddings and labels to UMAP worker for dimensionality reduction.', embeddings, labels);
// }


// // Function to send the scene bounding box to the UMAP worker
// export function sendSceneBoundingBoxToWorker() {
//     const { scene } = share3dDat();
//     const sceneBoundingBox = getSceneBoundingBox(scene);
//     umapWorker.postMessage({
//         type: 'setSceneBoundingBox',
//         data: sceneBoundingBox
//     });
//     console.log('Sent scene bounding box to UMAP worker:', sceneBoundingBox);
// }



// // Fetch embeddings from IndexedDB and trigger UMAP
// // export function fetchEmbeddingsAndPerformUMAP() {
// //     dbWorker.postMessage({
// //         id: 'getEmbeddings',
// //         action: 'getData',
// //         data: { storeName: 'summaries', dbName: 'summarizationDB' }
// //     });
// //     console.log('Requested embeddings from IndexedDB.');
// // }


// // / Function to initialize the database and fetch embeddings
// async function initDBAndFetchEmbeddings() {
//   try {
//     // Open the database
//     await indexDBOverlay.openDB('summarizationDB', 2);

//     // Initialize the database with the required object store
//     await indexDBOverlay.initializeDB(['summaries']);

//     // Fetch the embeddings
//     const embeddings = await indexDBOverlay.getData('summaries', 'summarizationDB');

//     // Process the embeddings
//     if (embeddings && embeddings.length > 0) {
//       const embeddingVectors = embeddings.map(item => item.embedding);
//       const labels = embeddings.map(item => item.fileId);

//       // Perform UMAP
//       performUMAP(embeddingVectors, labels);
//     } else {
//       console.log('No embeddings found in the database.');
//     }
//   } catch (error) {
//     console.error('Error initializing database or fetching embeddings:', error);
//   }
// }

// // Update your fetchEmbeddingsAndPerformUMAP function
// export function fetchEmbeddingsAndPerformUMAP() {
//   initDBAndFetchEmbeddings();
// }



// // Optional: Terminate workers when no longer needed
// export function terminateWorkers() {
//     umapWorker.postMessage({ type: 'terminate' });
//     // dbscanWorker.postMessage({ type: 'terminate' });
//     console.log('Terminated both UMAP and DBSCAN workers.');
// }


// umap.js
import { share3dDat } from '../ui/graph_v2/create.js'
import { getSceneBoundingBox, updateSphereAndCubePositions } from '../ui/graph_v2/reorientScene.js';
import indexDBOverlay from '../memory/local/file_worker'

// Initialize the worker
import UMAPWorker from '../workers/umap_worker.js?worker';
const umapWorker = new UMAPWorker();

// Create a promise-based wrapper for UMAP processing
function performUMAPAsync(embeddings, labels) {
    return new Promise((resolve, reject) => {
        const messageHandler = function (e) {
            const { type, data } = e.data;

            if (type === 'dimensionReductionResult') {
                umapWorker.removeEventListener('message', messageHandler);
                resolve(data);
            } else if (type === 'error') {
                umapWorker.removeEventListener('message', messageHandler);
                reject(new Error(data));
            } else if (type === 'progress') {
                console.log(`UMAP progress: Epoch ${data.epoch}`);
            }
        };

        umapWorker.addEventListener('message', messageHandler);

        umapWorker.postMessage({
            type: 'reduceDimensions',
            data: { embeddings, labels }
        });
    });
}

// Function to perform UMAP dimensionality reduction without auto-updating the scene
export async function performUMAPOnly(embeddings, labels) {
    try {
        const result = await performUMAPAsync(embeddings, labels);
        console.log('UMAP reduction completed.');
        return result;
    } catch (error) {
        console.error('Error during UMAP processing:', error);
        throw error;
    }
}

// Function to perform UMAP and update the scene (existing behavior)
export async function performUMAPAndUpdateScene(embeddings, labels) {
    try {
        const { reducedData, labels: resultLabels } = await performUMAPAsync(embeddings, labels);
        updateSphereAndCubePositions(reducedData, resultLabels);
        console.log('UMAP reduction completed and scene updated.');
    } catch (error) {
        console.error('Error during UMAP processing:', error);
    }
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

// Function to initialize the database and fetch embeddings
async function initDBAndFetchEmbeddings() {
    try {
        await indexDBOverlay.openDB('summarizationDB', 2);
        await indexDBOverlay.initializeDB(['summaries']);
        const embeddings = await indexDBOverlay.getData('summaries', 'summarizationDB');

        if (embeddings && embeddings.length > 0) {
            const embeddingVectors = embeddings.map(item => item.embedding);
            const labels = embeddings.map(item => item.fileId);
            return { embeddings: embeddingVectors, labels };
        } else {
            console.log('No embeddings found in the database.');
            return null;
        }
    } catch (error) {
        console.error('Error initializing database or fetching embeddings:', error);
        throw error;
    }
}

// Function to fetch embeddings and perform UMAP without updating the scene
export async function fetchEmbeddingsAndPerformUMAPOnly() {
    try {
        const data = await initDBAndFetchEmbeddings();
        if (data) {
            return await performUMAPOnly(data.embeddings, data.labels);
        }
    } catch (error) {
        console.error('Error in fetchEmbeddingsAndPerformUMAPOnly:', error);
    }
}

// Function to fetch embeddings, perform UMAP, and update the scene (existing behavior)
export async function fetchEmbeddingsAndPerformUMAP() {
    try {
        const data = await initDBAndFetchEmbeddings();
        if (data) {
            await performUMAPAndUpdateScene(data.embeddings, data.labels);
        }
    } catch (error) {
        console.error('Error in fetchEmbeddingsAndPerformUMAP:', error);
    }
}

// Optional: Terminate workers when no longer needed
export function terminateWorkers() {
    umapWorker.postMessage({ type: 'terminate' });
    console.log('Terminated UMAP worker.');
}