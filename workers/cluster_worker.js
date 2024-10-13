import densityClustering from 'density-clustering';

function calculateDistances(data) {
  const distances = [];
  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
      const distance = euclideanDistance(data[i], data[j]);
      distances.push(distance);
    }
  }
  return distances;
}

function logDataDistribution(data) {
    const dimensions = data[0].length;
    const stats = Array(dimensions).fill().map(() => ({ min: Infinity, max: -Infinity }));
    
    data.forEach(point => {
      point.forEach((value, dim) => {
        stats[dim].min = Math.min(stats[dim].min, value);
        stats[dim].max = Math.max(stats[dim].max, value);
      });
    });
    
    console.log("Data distribution:");
    stats.forEach((stat, dim) => {
      console.log(`Dimension ${dim}: min = ${stat.min}, max = ${stat.max}`);
    });
  }

function simpleClustering(data, k) {
    // Implement a simple k-means-like clustering
    const centroids = data.slice(0, k);
    const clusters = Array(k).fill().map(() => []);
  
    data.forEach((point, index) => {
      let minDist = Infinity;
      let closestCentroid = 0;
      
      centroids.forEach((centroid, i) => {
        const dist = euclideanDistance(point, centroid);
        if (dist < minDist) {
          minDist = dist;
          closestCentroid = i;
        }
      });
      
      clusters[closestCentroid].push(index);
    });
  
    return clusters;
  }

function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}


// function estimateEpsilon(data) {
//     const distances = calculateDistances(data);
//     distances.sort((a, b) => a - b);
//     const k = Math.floor(Math.sqrt(data.length));
//     return distances[k] * 1.5;  // Increase epsilon slightly
// }

function estimateEpsilon(data) {
    const distances = calculateDistances(data);
    distances.sort((a, b) => a - b);
    const k = Math.floor(Math.sqrt(data.length));
    return distances[k] * 2.5;  // Increase epsilon more significantly
  }



self.onmessage = function(e) {
  console.log("DBSCAN Worker received message:", e.data);
  const { reducedData, keywords, fileIds, fileNames } = e.data;

  console.log("Received data:", {
    reducedDataLength: reducedData.length,
    keywordsLength: keywords.length,
    fileIdsLength: fileIds.length,
    fileNamesLength: fileNames.length
  });


  const epsilon = estimateEpsilon(reducedData);
//   const minPoints = Math.max(3, Math.floor(Math.log(reducedData.length) / 2)); // Reduce minPoints
// const minPoints = Math.max(3, Math.ceil(Math.log(reducedData.length)));
const minPoints = Math.max(5, Math.ceil(Math.log(reducedData.length) * 1.5));
  console.log("Estimated DBSCAN parameters:", { epsilon, minPoints });

  // Perform DBSCAN clustering
  const dbscan = new densityClustering.DBSCAN();
  
  let clusters = dbscan.run(reducedData, epsilon, minPoints);

  if (clusters.length === 0) {
    console.log("DBSCAN produced no clusters. Falling back to simple clustering.");
    const k = Math.min(10, Math.floor(Math.sqrt(reducedData.length)));
    clusters = simpleClustering(reducedData, k);
  }

  console.log("Clustering completed. Clusters:", clusters.length);


// Handle outliers
const outliers = dbscan.noise;
if (outliers.length > 0) {
    const outlierClusterSize = Math.min(5, Math.ceil(outliers.length / 20));
    for (let i = 0; i < outliers.length; i += outlierClusterSize) {
        clusters.push(outliers.slice(i, i + outlierClusterSize));
    }
}

  self.postMessage({
    type: 'umapResult',
    reducedData,
    keywords,
    fileIds,
    fileNames,
    clusters
  });


  console.log("DBSCAN Worker sent result back");

  console.log("DBSCAN Worker processing log data now...");
  logDataDistribution(reducedData);

};

self.onerror = function(error) {
  console.error("DBSCAN Worker error:", error);
  self.postMessage({
    type: 'error',
    error: error.message
  });
};