// clustering.js
// clustering.js
import * as THREE from 'three';
import { processKeywordEmbeddings } from './embeddingBatches.js';
import { performUMAPOnly, sendSceneBoundingBoxToWorker } from './umap.js';
import { createAnimatedPointCloud } from '../ui/graph_v2/createPointCloud.js';
import { share3dDat, markNeedsRender } from '../ui/graph_v2/create.js';
// import { getSceneBoundingBox } from '../ui/graph_v2/reorientScene.js';
// import { normalizeAndScaleCoordinates } from '../utils/sceneCoordsUtils.js';

import {zoomCameraToPointCloud, clearScenesAndHideObjects} from '../ui/graph_v2/reorientScene.js'

// Initialize DBSCAN worker
const dbscanWorker = new Worker(new URL('../workers/cluster_worker.js', import.meta.url), { type: 'module' });

console.log('DBSCAN Worker initialized');

dbscanWorker.onerror = (error) => {
    console.error('DBSCAN Worker error:', error);
};


export async function performClustering() {
    console.log("Starting clustering process");
    try {
        // Clear scenes and hide objects
        clearScenesAndHideObjects();

        // Step 1: Process embeddings
        const { embeddings, keywords, fileIds } = await processKeywordEmbeddings();
        console.log('Embeddings processed:', embeddings.length);

        // Step 2: Perform UMAP
        console.log("Performing UMAP...");
        const umapResult = await performUMAPOnly(embeddings, fileIds);
        console.log('UMAP completed. Result:', umapResult);

        // Step 3: Set scene bounding box
        sendSceneBoundingBoxToWorker();

        // Step 4: Perform DBSCAN clustering
        console.log("Starting DBSCAN clustering...");
        const dbscanResult = await new Promise((resolve, reject) => {
            dbscanWorker.postMessage({
                reducedData: umapResult.reducedData,
                keywords,
                fileIds
            });

            dbscanWorker.onmessage = function (e) {
                if (e.data.type === 'umapResult') {
                    console.log("DBSCAN clustering completed");
                    resolve(e.data);
                } else if (e.data.type === 'error') {
                    console.error("DBSCAN worker error:", e.data.error);
                    reject(new Error(e.data.error));
                }
            };
        });
        console.log('DBSCAN result:', dbscanResult);

        // Step 5: Create point cloud
        console.log("Creating point cloud...");
        const pointCloud = createAnimatedPointCloud(
            dbscanResult.reducedData,
            dbscanResult.keywords,
            dbscanResult.fileIds,
            dbscanResult.clusters
        );
        console.log('Point cloud created');

        // Step 6: Zoom camera to point cloud
        zoomCameraToPointCloud();

        return pointCloud;
    } catch (error) {
        console.error('Error in clustering process:', error);
        throw error;
    } 
}

export function onPointCloudInteraction(event) {
    const sharedData = share3dDat();
    if (!sharedData || !sharedData.raycaster || !sharedData.camera || !sharedData.scene) {
        console.warn('Required 3D objects are not available');
        return;
    }
    
    const { raycaster, camera, scene } = sharedData;
    
    // Update the picking ray with the camera and mouse position
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
        const intersectedPoint = intersects[0].object;
        if (intersectedPoint && intersectedPoint.userData) {
            const index = intersects[0].index;
            if (index !== undefined && 
                intersectedPoint.userData.fileIds && 
                intersectedPoint.userData.keywords) {
                // Display information about the intersected point
                console.log('Intersected point:', {
                    fileId: intersectedPoint.userData.fileIds[index],
                    keywords: intersectedPoint.userData.keywords[index]
                });
            } else {
                console.warn('Intersected point does not have expected userData');
            }
        } else {
            console.warn('Intersected object does not have expected properties');
        }
        
        // You can add more interaction logic here, such as highlighting the point or showing a tooltip
    }
}
// Add event listener for point cloud interaction