// clustering.js
import { processKeywordEmbeddings } from './embeddingBatches.js';
import { performUMAPOnly, sendSceneBoundingBoxToWorker } from './umap.js';
import { createAnimatedPointCloud, adjustCameraAndRaycaster } from '../ui/graph_v2/createPointCloud.js';
// import { clearScenesAndHideObjects } from '../ui/graph_v2/reorientScene.js';
import { updateStatus } from '../ui/components/process.js'  // Import the updateStatus function

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
    // Step 1: Process embeddings
    updateStatus("Step 1/4: Processing keyword embeddings...");
    const { embeddings, keywords, fileIds, fileNames } = await processKeywordEmbeddings();

    // Step 2: Perform UMAP
    updateStatus("Step 2/4: Performing dimensional reduction...");
    const umapResult = await performUMAPOnly(embeddings, fileIds);

    // Step 3: Set scene bounding box
    updateStatus("Step 3/4: Performing DBSCAN clustering...");
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
    updateStatus("Step 4/4: Creating visualization...");
    const hierarchicalResult = await new Promise((resolve, reject) => {
      hierarchicalWorker.postMessage({
        clusters: dbscanResult.clusters,
        reducedData: dbscanResult.reducedData,
        maxClusters: 7
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

    // Create visualization
    const pointCloud = createAnimatedPointCloud(
      dbscanResult.reducedData,
      dbscanResult.keywords,
      dbscanResult.fileIds,
      hierarchicalResult.clusters,
      dbscanResult.fileNames
    );

    adjustCameraAndRaycaster();
    updateStatus("Clustering complete!");

    return pointCloud;
  } catch (error) {
    console.error('Error in clustering process:', error);
    updateStatus("Error: " + error.message);
    throw error;
  }
}