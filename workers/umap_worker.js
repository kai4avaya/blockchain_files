// src/workers/umap_worker.js

import { UMAP } from 'umap-js';
import { normalizeAndScaleCoordinates } from '../utils/sceneCoordsUtils.js'; // Adjust path as necessary

// Enable detailed debugging
const DEBUG = true;

// Helper function for logging
function debugLog(message, data) {
    if (DEBUG) {
        console.log(`[UMAP Worker] ${message}`, data || '');
    }
}

// Initialize variables to store scene bounding box
let sceneBoundingBox = {
    min: { x: -500, y: -500, z: -500 },
    max: { x: 500, y: 500, z: 500 }
};

// Listen for messages from the main thread
self.onmessage = async function (e) {
    const { type, data } = e.data;

    debugLog(`Received message of type: ${type}`);

    if (type === 'setSceneBoundingBox') {
        // Update the scene bounding box
        sceneBoundingBox = data;
        debugLog('Updated scene bounding box:', sceneBoundingBox);
    }
    else if (type === 'reduceDimensions') {
        // The embeddings data is received from the main thread
        const embeddings = data.embeddings;

        // Ensure embeddings are in the correct format
        if (!Array.isArray(embeddings) || embeddings.length === 0) {
            const errorMsg = 'Invalid embeddings data received.';
            debugLog(errorMsg);
            self.postMessage({
                type: 'error',
                data: errorMsg
            });
            return;
        }

        try {
            debugLog('Initializing UMAP with parameters:', {
                nComponents: 3,
                nNeighbors: 15,
                minDist: 0.1
            });

            // Perform dimensionality reduction using UMAP
            const umap = new UMAP({
                nComponents: 3,   // Reduce to 3 dimensions
                nNeighbors: 15,   // Number of nearest neighbors
                minDist: 0.1      // Minimum distance between points
                // You can adjust the parameters above as needed
            });

            debugLog('Fitting UMAP to the embeddings...');

            // Fit the UMAP model to the embeddings asynchronously
            const embedding3D = await umap.fitAsync(embeddings, (epochNumber) => {
                // Optionally send progress updates
                self.postMessage({
                    type: 'progress',
                    data: { epoch: epochNumber }
                });
                debugLog(`UMAP progress: Epoch ${epochNumber}`);
            });

            debugLog('UMAP fitting completed.');

            // Normalize and scale the embeddings based on scene bounding box
            const scaledCoordinates = normalizeAndScaleCoordinates(embedding3D, sceneBoundingBox);

            debugLog('Normalization and scaling completed.');

            // Send the scaled embeddings back to the main thread
            self.postMessage({
                type: 'dimensionReductionResult',
                data: scaledCoordinates
            });
            debugLog('Sent scaled dimension reduction result back to main thread.');
        } catch (error) {
            // Handle any errors during processing
            const errorMsg = `Error during UMAP processing: ${error.message}`;
            debugLog(errorMsg, error);
            self.postMessage({
                type: 'error',
                data: errorMsg
            });
        }
    }
    // Optionally handle other message types
    else if (type === 'terminate') {
        debugLog('Terminating worker as per request.');
        // Terminate the worker if requested
        self.close();
    }
    else {
        const errorMsg = `Unknown message type: ${type}`;
        debugLog(errorMsg);
        self.postMessage({
            type: 'error',
            data: errorMsg
        });
    }
};
