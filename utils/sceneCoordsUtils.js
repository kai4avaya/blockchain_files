
// Function to normalize and scale coordinates based on scene bounding box
// export function normalizeAndScaleCoordinates(embedding3D, sceneBoundingBox) {
//     // Find min and max values from the embeddings
//     let minCoord = [Infinity, Infinity, Infinity];
//     let maxCoord = [-Infinity, -Infinity, -Infinity];
  
//     embedding3D.forEach(coord => {
//         for (let i = 0; i < 3; i++) {
//             if (coord[i] < minCoord[i]) minCoord[i] = coord[i];
//             if (coord[i] > maxCoord[i]) maxCoord[i] = coord[i];
//         }
//     });
  
//     // Compute the range of the embeddings
//     const embeddingRanges = maxCoord.map((max, index) => max - minCoord[index]);
  
//     // Compute the range of the scene
//     const sceneRanges = [
//         sceneBoundingBox.max.x - sceneBoundingBox.min.x,
//         sceneBoundingBox.max.y - sceneBoundingBox.min.y,
//         sceneBoundingBox.max.z - sceneBoundingBox.min.z
//     ];
  
//     // Calculate scaling factors for each axis
//     const scales = sceneRanges.map((sceneRange, index) => {
//         // Prevent division by zero
//         return embeddingRanges[index] > 0 ? sceneRange / embeddingRanges[index] : 1;
//     });
  
//     // Use the minimum scale to maintain aspect ratio
//     const scale = Math.min(...scales) * 0.8; // Use 80% to add some padding
  
//     // Center of the scene
//     const sceneCenter = {
//         x: (sceneBoundingBox.min.x + sceneBoundingBox.max.x) / 2,
//         y: (sceneBoundingBox.min.y + sceneBoundingBox.max.y) / 2,
//         z: (sceneBoundingBox.min.z + sceneBoundingBox.max.z) / 2
//     };
  
//     // Normalize and scale coordinates
//     const scaledCoordinates = embedding3D.map(coord => {
//         return coord.map((value, index) => {
//             // Normalize to [-0.5, 0.5]
//             const normalizedValue = (value - minCoord[index]) / embeddingRanges[index] - 0.5;
//             // Scale and position within the scene
//             return normalizedValue * scale + sceneCenter[['x', 'y', 'z'][index]];
//         });
//     });
  
//     return scaledCoordinates;
//   }
  

export function normalizeAndScaleCoordinates(coordinates, sceneBoundingBox, zOffset = 0) {
    // Compute the current range of the coordinates
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    coordinates.forEach(coord => {
        if (coord[0] < minX) minX = coord[0];
        if (coord[0] > maxX) maxX = coord[0];
        if (coord[1] < minY) minY = coord[1];
        if (coord[1] > maxY) maxY = coord[1];
        if (coord[2] < minZ) minZ = coord[2];
        if (coord[2] > maxZ) maxZ = coord[2];
    });

    const rangeX = maxX - minX || 1; // Prevent division by zero
    const rangeY = maxY - minY || 1;
    const rangeZ = maxZ - minZ || 1;

    // Compute the scale factors based on scene bounding box
    const scaleX = (sceneBoundingBox.max.x - sceneBoundingBox.min.x) / rangeX;
    const scaleY = (sceneBoundingBox.max.y - sceneBoundingBox.min.y) / rangeY;
    const scaleZ = (sceneBoundingBox.max.z - sceneBoundingBox.min.z) / rangeZ;

    // Scale and translate coordinates
    const scaledCoordinates = coordinates.map(coord => {
        const x = ((coord[0] - minX) * scaleX) + sceneBoundingBox.min.x;
        const y = ((coord[1] - minY) * scaleY) + sceneBoundingBox.min.y;
        const z = ((coord[2] - minZ) * scaleZ) + sceneBoundingBox.min.z + zOffset;
        return [x, y, z];
    });

    return scaledCoordinates;
}
