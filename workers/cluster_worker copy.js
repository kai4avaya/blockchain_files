// cluster_worker.js
import densityClustering from 'density-clustering';

console.log('DBSCAN Worker initialized');

self.onmessage = function(e) {
    console.log("DBSCAN Worker received message:", e.data);
    const { reducedData, keywords, fileIds } = e.data;
    
    console.log("Received data:", {
        reducedDataLength: reducedData.length,
        keywordsLength: keywords.length,
        fileIdsLength: fileIds.length
    });

    // Perform DBSCAN clustering
    const dbscan = new densityClustering.DBSCAN();
    const epsilon = 0.5; // Adjust this value based on your data
    const minPoints = 3; // Minimum points to form a cluster
    
    console.log("Starting DBSCAN clustering with parameters:", { epsilon, minPoints });
    
    const clusters = dbscan.run(reducedData, epsilon, minPoints);
    
    console.log("DBSCAN clustering completed. Clusters:", clusters.length);

    // Handle noise points
    const noise = dbscan.noise;
    if (noise.length > 0) {
        clusters.push(noise); // Add noise points as a separate cluster
    }

    self.postMessage({
        type: 'umapResult',
        reducedData,
        keywords,
        fileIds,
        clusters
    });
    
    console.log("DBSCAN Worker sent result back");
};

self.onerror = function(error) {
    console.error("DBSCAN Worker error:", error);
    self.postMessage({
        type: 'error',
        error: error.message
    });
};