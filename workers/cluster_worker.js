// src/workers/dbscan_worker.js

import { DBSCAN } from 'ml-dbscan';

// Enable detailed debugging
const DEBUG = true;

// Helper function for logging
function debugLog(message, data) {
    if (DEBUG) {
        console.log(`[DBSCAN Worker] ${message}`, data || '');
    }
}

// Listen for messages from the main thread
self.onmessage = function (e) {
    const { type, data } = e.data;

    debugLog(`Received message of type: ${type}`);

    if (type === 'clusterData') {
        const { reducedData, dbscanOptions } = data;

        // Validate inputs
        if (!Array.isArray(reducedData) || reducedData.length === 0) {
            const errorMsg = 'Invalid reducedData received for clustering.';
            debugLog(errorMsg);
            self.postMessage({
                type: 'error',
                data: errorMsg
            });
            return;
        }

        try {
            debugLog('Initializing DBSCAN with options:', dbscanOptions);

            // Perform DBSCAN clustering
            const dbscan = new DBSCAN();
            const labels = dbscan.run(reducedData, dbscanOptions.epsilon, dbscanOptions.minPts);

            debugLog('DBSCAN clustering completed.');

            // Send the cluster labels back to the main thread
            self.postMessage({
                type: 'clusteringResult',
                data: labels
            });
            debugLog('Sent clustering result back to main thread.');
        } catch (error) {
            // Handle any errors during clustering
            const errorMsg = `Error during DBSCAN processing: ${error.message}`;
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
