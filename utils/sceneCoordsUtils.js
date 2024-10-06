
// Function to normalize and scale coordinates based on scene bounding box
export function normalizeAndScaleCoordinates(embedding3D, sceneBoundingBox) {
    // Find min and max values from the embeddings
    let minCoord = [Infinity, Infinity, Infinity];
    let maxCoord = [-Infinity, -Infinity, -Infinity];
  
    embedding3D.forEach(coord => {
        for (let i = 0; i < 3; i++) {
            if (coord[i] < minCoord[i]) minCoord[i] = coord[i];
            if (coord[i] > maxCoord[i]) maxCoord[i] = coord[i];
        }
    });
  
    // Compute the range of the embeddings
    const embeddingRanges = maxCoord.map((max, index) => max - minCoord[index]);
  
    // Compute the range of the scene
    const sceneRanges = [
        sceneBoundingBox.max.x - sceneBoundingBox.min.x,
        sceneBoundingBox.max.y - sceneBoundingBox.min.y,
        sceneBoundingBox.max.z - sceneBoundingBox.min.z
    ];
  
    // Calculate scaling factors for each axis
    const scales = sceneRanges.map((sceneRange, index) => {
        // Prevent division by zero
        return embeddingRanges[index] > 0 ? sceneRange / embeddingRanges[index] : 1;
    });
  
    // Use the minimum scale to maintain aspect ratio
    const scale = Math.min(...scales) * 0.8; // Use 80% to add some padding
  
    // Center of the scene
    const sceneCenter = {
        x: (sceneBoundingBox.min.x + sceneBoundingBox.max.x) / 2,
        y: (sceneBoundingBox.min.y + sceneBoundingBox.max.y) / 2,
        z: (sceneBoundingBox.min.z + sceneBoundingBox.max.z) / 2
    };
  
    // Normalize and scale coordinates
    const scaledCoordinates = embedding3D.map(coord => {
        return coord.map((value, index) => {
            // Normalize to [-0.5, 0.5]
            const normalizedValue = (value - minCoord[index]) / embeddingRanges[index] - 0.5;
            // Scale and position within the scene
            return normalizedValue * scale + sceneCenter[['x', 'y', 'z'][index]];
        });
    });
  
    return scaledCoordinates;
  }
  