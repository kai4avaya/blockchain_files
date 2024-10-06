// Initialize the DBSCAN worker as an ES module
const dbscanWorker = new Worker(new URL('../workers/dbscan_worker.js', import.meta.url), { type: 'module' });

dbscanWorker.onmessage = function (e) {
    const { type, data } = e.data;

    if (type === 'clusteringResult') {
        // Update sphere positions with the received cluster labels
        console.log('Received DBSCAN cluster labels:', data);
        updateSphereAndCubePositions(null, data); // Pass null or adjust based on your implementation
    }
    else if (type === 'error') {
        console.error(`DBSCAN Worker Error: ${data}`);
    }
};

// Function to perform DBSCAN clustering
export function performDBSCAN(reducedData, dbscanOptions = { epsilon: 5, minPts: 5 }) {
    dbscanWorker.postMessage({
        type: 'clusterData',
        data: { reducedData, dbscanOptions }
    });
    console.log('Sent reduced data to DBSCAN worker for clustering.');
}

// Optional: Terminate workers when no longer needed
export function terminateWorkers() {
    umapWorker.postMessage({ type: 'terminate' });
    dbscanWorker.postMessage({ type: 'terminate' });
    console.log('Terminated both UMAP and DBSCAN workers.');
}