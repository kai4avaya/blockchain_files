import * as THREE from "three";
import indexDBOverlay from '../memory/local/file_worker';
import { performUMAPOnly, sendSceneBoundingBoxToWorker } from './umap.js';
import { clearScenesAndHideObjects, reorientCamera, rescalePositions } from '../ui/graph_v2/reorientScene.js';
import { share3dDat, markNeedsRender } from '../ui/graph_v2/create.js'
import { createFloatingElement, createVisualConnections, addInteractivity, initCSS3DRenderer, updateRendererSizes } from '../ui/graph_v2/createTextProjections.js';

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
        keyToCoords[key] = new THREE.Vector3(
            reducedData[index][0] * 800 - 1500,
            -reducedData[index][1] * 800 + 990,
            reducedData[index][2] * 800
        );
    });
    console.log("keyToCoords:", keyToCoords);
    return keyToCoords;
}

function createElements(scene, hashIndexData, vectorMap, keyToCoords) {
    const objectMap = new Map();
    Object.entries(hashIndexData).forEach(([hashKey, bucketObjects]) => {
        console.log(`Processing hash bucket ${hashKey}:`, bucketObjects);

        if (!Array.isArray(bucketObjects)) {
            console.warn('Bucket objects is not an array:', bucketObjects);
            return;
        }

        bucketObjects.forEach((key) => {
            const vectorData = vectorMap.get(String(key));
            if (vectorData && keyToCoords[key]) {
                const element = createFloatingElement(vectorData.text, keyToCoords[key], key, vectorData.fileId, hashKey);
                objectMap.set(String(key), element);
                scene.add(element);
                console.log(`Added element for key: ${key}, fileId: ${vectorData.fileId}, position: ${keyToCoords[key].toArray()}`);
            } else {
                console.warn('Missing data for key:', key);
            }
        });
    });
    return objectMap;
}

export async function setupTextProjectionVisualization() {
    const { scene, camera, controls, renderer, container } = share3dDat();
  
    try {
        clearScenesAndHideObjects();

        const { vectorsData, hashIndexData } = await fetchAndValidateData();
        const { vectorMap, embeddings, labels } = prepareDataForUMAP(vectorsData);
        const keyToCoords = await performUMAPAndCreateCoordMap(embeddings, labels);

        const objectMap = createElements(scene, hashIndexData, vectorMap, keyToCoords);
        createVisualConnections(scene, hashIndexData, objectMap);

        // Rescale positions
        const { center, scale } = rescalePositions(scene);
        console.log(`Rescaled scene. Center: ${center.toArray()}, Scale: ${scale}`);

        // Reorient camera
        reorientCamera(scene, camera, controls);
        console.log('Reoriented camera');

        sendSceneBoundingBoxToWorker();

        addInteractivity();
        initCSS3DRenderer(container); // Pass the container element
        updateRendererSizes();

        window.addEventListener('resize', updateRendererSizes);

        // Override the render function to include CSS3DRenderer
        const originalRender = share3dDat().render;
        share3dDat().render = () => {
            originalRender();
            share3dDat().css3dRenderer.render(scene, camera);
        };

        markNeedsRender();

    } catch (error) {
        console.error('Error setting up visualization:', error);
    }
}