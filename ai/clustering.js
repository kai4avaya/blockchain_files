// clustering.js
import { processKeywordEmbeddings } from './embeddingBatches.js';
import { performUMAPOnly, sendSceneBoundingBoxToWorker } from './umap.js';
import { createAnimatedPointCloud, adjustCameraAndRaycaster } from '../ui/graph_v2/createPointCloud.js';
import { clearScenesAndHideObjects } from '../ui/graph_v2/reorientScene.js';

// Initialize DBSCAN worker
const dbscanWorker = new Worker(new URL('../workers/cluster_worker.js', import.meta.url), { type: 'module' });

dbscanWorker.onerror = (error) => {
  console.error('DBSCAN Worker error:', error);
};

// Initialize Hierarchical Clustering worker
const hierarchicalWorker = new Worker(new URL('../workers/hierarchical_cluster_worker.js', import.meta.url), { type: 'module' });

hierarchicalWorker.onerror = (error) => {
  console.error('Hierarchical Clustering Worker error:', error);
};

export async function performClustering() {
  try {
    // Clear scenes and hide objects
    clearScenesAndHideObjects();

    // Step 1: Process embeddings
    const { embeddings, keywords, fileIds, fileNames } = await processKeywordEmbeddings();

    // Step 2: Perform UMAP
    const umapResult = await performUMAPOnly(embeddings, fileIds);

    // Step 3: Set scene bounding box
    sendSceneBoundingBoxToWorker();

    // Step 4: Perform DBSCAN clustering
    const dbscanResult = await new Promise((resolve, reject) => {
      dbscanWorker.postMessage({
        reducedData: umapResult.reducedData,
        keywords,
        fileIds,
        fileNames
      });

      dbscanWorker.onmessage = function (e) {
        if (e.data.type === 'umapResult') {
          resolve(e.data);
        } else if (e.data.type === 'error') {
          console.error("DBSCAN worker error:", e.data.error);
          reject(new Error(e.data.error));
        }
      };
    });

    // Step 5: Perform Hierarchical Clustering
    const hierarchicalResult = await new Promise((resolve, reject) => {
      hierarchicalWorker.postMessage({
        clusters: dbscanResult.clusters,
        reducedData: dbscanResult.reducedData,
        maxClusters: 7 // Adjust this value as needed (5-7)
      });

      hierarchicalWorker.onmessage = function (e) {
        if (e.data.type === 'hierarchicalClusteringResult') {
          resolve(e.data);
        } else if (e.data.type === 'error') {
          console.error("Hierarchical Clustering worker error:", e.data.error);
          reject(new Error(e.data.error));
        }
      };
    });

    // Step 6: Create point cloud with coalesced clusters
    const pointCloud = createAnimatedPointCloud(
      dbscanResult.reducedData,
      dbscanResult.keywords,
      dbscanResult.fileIds,
      hierarchicalResult.clusters,
      dbscanResult.fileNames
    );

    // Step 7: Adjust camera and raycaster
    adjustCameraAndRaycaster();

    return pointCloud;
  } catch (error) {
    console.error('Error in clustering process:', error);
    throw error;
  }
}