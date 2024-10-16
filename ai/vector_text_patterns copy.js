


import * as THREE from "three";
import indexDBOverlay from '../memory/local/file_worker';
import { performUMAPOnly, sendSceneBoundingBoxToWorker } from './umap.js';
import { adjustCameraToFitScene, clearScenesAndHideObjects, reorientCamera, rescalePositions } from '../ui/graph_v2/reorientScene.js';
import { share3dDat, markNeedsRender } from '../ui/graph_v2/create.js'
import { createFloatingTextPlane, addInteractivity, adjustTextPlaneOrientations } from '../ui/graph_v2/createTextProjections.js';

async function fetchAndValidateData() {
    await indexDBOverlay.openDB('vectorDB_new', 2);
    const vectorsData = await indexDBOverlay.getData('vectors', 'vectorDB_new');
    const hashIndexData = await indexDBOverlay.getData('vectors_hashIndex', 'vectorDB_new');

    console.log("vectorsData:", vectorsData);
    console.log("hashIndexData:", hashIndexData);

    if (!vectorsData || vectorsData.length === 0) {
        throw new Error('No vector data retrieved from the database');
    }
    if (!hashIndexData || Object.keys(hashIndexData).length === 0) {
        throw new Error('No hash index data retrieved from the database');
    }

    return { vectorsData, hashIndexData };
}

function prepareDataForUMAP(vectorsData) {
    const vectorMap = new Map(vectorsData.map((item, index) => [String(index + 1), item]));
    console.log("vectorMap:", [...vectorMap.entries()]);

    const embeddings = [];
    const labels = [];
    vectorsData.forEach((item, index) => {
        embeddings.push(item.embedding);
        labels.push(String(index + 1));
    });

    return { vectorMap, embeddings, labels };
}

async function performUMAPAndCreateCoordMap(embeddings, labels) {
    const { reducedData } = await performUMAPOnly(embeddings, labels);
    const keyToCoords = {};
    labels.forEach((key, index) => {
        keyToCoords[key] = reducedData[index];
    });
    console.log("keyToCoords:", keyToCoords);
    return keyToCoords;
}

function createTextPlanes(scene, hashIndexData, vectorMap, keyToCoords) {
    Object.entries(hashIndexData).forEach(([hashKey, bucketObjects]) => {
        console.log(`Processing hash bucket ${hashKey}:`, bucketObjects);

        if (!Array.isArray(bucketObjects)) {
            console.warn('Bucket objects is not an array:', bucketObjects);
            return;
        }

        bucketObjects.forEach((key) => {
            const vectorData = vectorMap.get(String(key));
            if (vectorData && keyToCoords[key]) {
                const position = new THREE.Vector3(
                    keyToCoords[key][0],
                    keyToCoords[key][1],
                    keyToCoords[key][2]
                );
                const textPlane = createFloatingTextPlane(vectorData.text.substring(0, 100), position);
                textPlane.userData = { fullText: vectorData.text, key: key, fileId: vectorData.fileId };
                scene.add(textPlane);
                console.log(`Added text plane for key: ${key}, fileId: ${vectorData.fileId}, position: ${position.toArray()}`);
            } else {
                console.warn('Missing data for key:', key);
            }
        });
    });
}

function createVisualConnections(scene, hashIndexData) {
    Object.values(hashIndexData).forEach((bucketObjects) => {
        for (let i = 0; i < bucketObjects.length - 1; i++) {
            for (let j = i + 1; j < bucketObjects.length; j++) {
                const obj1 = scene.getObjectByProperty('userData', { key: String(bucketObjects[i]) });
                const obj2 = scene.getObjectByProperty('userData', { key: String(bucketObjects[j]) });
                if (obj1 && obj2) {
                    const line = new THREE.Line(
                        new THREE.BufferGeometry().setFromPoints([obj1.position, obj2.position]),
                        new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.3 })
                    );
                    scene.add(line);
                }
            }
        }
    });
}

export async function setupTextProjectionVisualization() {
    const { scene, camera, controls } = share3dDat();
  
    try {
        clearScenesAndHideObjects();

        const { vectorsData, hashIndexData } = await fetchAndValidateData();
        const { vectorMap, embeddings, labels } = prepareDataForUMAP(vectorsData);
        const keyToCoords = await performUMAPAndCreateCoordMap(embeddings, labels);

        createTextPlanes(scene, hashIndexData, vectorMap, keyToCoords);
        createVisualConnections(scene, hashIndexData);

        // Rescale positions
        const { center, scale } = rescalePositions(scene);
        console.log(`Rescaled scene. Center: ${center.toArray()}, Scale: ${scale}`);

        // Reorient camera
        reorientCamera(scene, camera, controls);
        console.log('Reoriented camera');

        sendSceneBoundingBoxToWorker();
        adjustTextPlaneOrientations();

        addInteractivity();
        markNeedsRender();

        // Log the new positions of some objects for debugging
        scene.traverse((object) => {
            if (object.isObject3D && object.userData.key) {
                console.log(`Object ${object.userData.key} position: ${object.position.toArray()}`);
            }
        });

    } catch (error) {
        console.error('Error setting up visualization:', error);
    }
}