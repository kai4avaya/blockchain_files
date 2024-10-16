// hierarchical_cluster_worker.js
import * as clustering from 'density-clustering';

self.onmessage = function(e) {
  const { clusters, reducedData, maxClusters } = e.data;

  // Calculate cluster centroids
  const centroids = clusters.map(cluster => {
    const sum = cluster.reduce(
      (acc, index) => acc.map((coord, i) => coord + reducedData[index][i]),
      [0, 0, 0]
    );
    return sum.map(coord => coord / cluster.length);
  });

  // Perform hierarchical clustering on centroids
  const dbscan = new clustering.DBSCAN();
  let eps = 0.1;
  let minPoints = 1;
  let mergedClusters;

  while (true) {
    mergedClusters = dbscan.run(centroids, eps, minPoints);
    if (mergedClusters.length <= maxClusters) break;
    eps += 0.1;
  }

  // Map original points to new clusters
  const newClusters = mergedClusters.map(() => []);
  clusters.forEach((cluster, i) => {
    const mergedClusterIndex = mergedClusters.findIndex(c => c.includes(i));
    if (mergedClusterIndex !== -1) {
      newClusters[mergedClusterIndex].push(...cluster);
    }
  });

  self.postMessage({ type: 'hierarchicalClusteringResult', clusters: newClusters });
};