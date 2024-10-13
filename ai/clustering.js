// clustering.js
import { processKeywordEmbeddings } from './embeddingBatches.js';
import { performUMAPOnly, sendSceneBoundingBoxToWorker } from './umap.js';
import { createAnimatedPointCloud } from '../ui/graph_v2/createPointCloud.js';

import {zoomCameraToPointCloud, clearScenesAndHideObjects} from '../ui/graph_v2/reorientScene.js'

// Initialize DBSCAN worker
const dbscanWorker = new Worker(new URL('../workers/cluster_worker.js', import.meta.url), { type: 'module' });

console.log('DBSCAN Worker initialized');

dbscanWorker.onerror = (error) => {
    console.error('DBSCAN Worker error:', error);
};

export async function performClustering() {
    console.log("Starting clustering process");
    try {
        // Clear scenes and hide objects
        clearScenesAndHideObjects();

        // Step 1: Process embeddings
        const { embeddings, keywords, fileIds, fileNames } = await processKeywordEmbeddings();
        console.log('Embeddings processed:', embeddings.length);

        // Step 2: Perform UMAP
        console.log("Performing UMAP...");
        const umapResult = await performUMAPOnly(embeddings, fileIds);
        console.log('UMAP completed. Result:', umapResult);

        // Step 3: Set scene bounding box
        sendSceneBoundingBoxToWorker();

        // Step 4: Perform DBSCAN clustering
        console.log("Starting DBSCAN clustering...");
        const dbscanResult = await new Promise((resolve, reject) => {
            dbscanWorker.postMessage({
                reducedData: umapResult.reducedData,
                keywords,
                fileIds,
                fileNames  // Include fileNames in the message to the worker
            });

            dbscanWorker.onmessage = function (e) {
                if (e.data.type === 'umapResult') {
                    console.log("DBSCAN clustering completed");
                    resolve(e.data);
                } else if (e.data.type === 'error') {
                    console.error("DBSCAN worker error:", e.data.error);
                    reject(new Error(e.data.error));
                }
            };
        });
        console.log('DBSCAN result:', dbscanResult);

        // Step 5: Create point cloud
        const pointCloud = createAnimatedPointCloud(
            dbscanResult.reducedData,
            dbscanResult.keywords,
            dbscanResult.fileIds,
            dbscanResult.clusters,
            dbscanResult.fileNames  // Pass fileNames to createAnimatedPointCloud
        );
        console.log('Point cloud created');

        // Step 6: Zoom camera to point cloud
        zoomCameraToPointCloud();

        return pointCloud;
    } catch (error) {
        console.error('Error in clustering process:', error);
        throw error;
    } 
}