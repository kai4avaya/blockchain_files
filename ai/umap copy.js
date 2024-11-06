// umap.js
import { share3dDat } from '../ui/graph_v2/create.js';
import { getSceneBoundingBox, updateSphereAndCubePositions } from '../ui/graph_v2/reorientScene.js';
import indexDBOverlay from '../memory/local/file_worker';
import config from '../configs/config.json';

let umapWorker = null;
let inactivityTimeout = null;
let isWorkerActive = false;

export function isUMAPWorkerActive() {
    return isWorkerActive && umapWorker !== null;
}

async function getUMAPWorker() {
    if (!umapWorker) {
        try {
            const { default: UMAPWorker } = await import('../workers/umap_worker.js?worker');
            umapWorker = new UMAPWorker();
            isWorkerActive = true;
            console.log('UMAP worker initialized.');
        } catch (error) {
            console.error('Failed to load UMAP worker:', error);
            isWorkerActive = false;
            throw error;
        }
    }
    resetInactivityTimeout();
    return umapWorker;
}

function resetInactivityTimeout() {
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => terminateWorker(), 300000); // 5 minutes
}

function terminateWorker() {
    if (umapWorker) {
        umapWorker.terminate();
        umapWorker = null;
        isWorkerActive = false;
        console.log('UMAP worker terminated.');
    }
}

async function ensureWorkerInitialized() {
    getUMAPWorker();
}

function performUMAPAsync(embeddings, labels) {
    ensureWorkerInitialized();
    return new Promise((resolve, reject) => {
        const messageHandler = function (e) {
            const { type, data } = e.data;

            if (type === 'dimensionReductionResult') {
                umapWorker.removeEventListener('message', messageHandler);
                resolve(data);
            } else if (type === 'error') {
                umapWorker.removeEventListener('message', messageHandler);
                reject(new Error(data));
            } else if (type === 'progress') {
                console.log(`UMAP progress: Epoch ${data.epoch}`);
            }
        };

        umapWorker.addEventListener('message', messageHandler);

        umapWorker.postMessage({
            type: 'reduceDimensions',
            data: { embeddings, labels }
        });
    });
}

export async function performUMAPOnly(embeddings, labels) {
    try {
        const result = await performUMAPAsync(embeddings, labels);
        console.log('UMAP reduction completed.');
        return result;
    } catch (error) {
        console.error('Error during UMAP processing:', error);
        throw error;
    }
}

export async function performUMAPAndUpdateScene(embeddings, labels) {
    try {
        const { reducedData, labels: resultLabels } = await performUMAPAsync(embeddings, labels);
        updateSphereAndCubePositions(reducedData, resultLabels);
        console.log('UMAP reduction completed and scene updated.');
    } catch (error) {
        console.error('Error during UMAP processing:', error);
    }
}

export function sendSceneBoundingBoxToWorker() {
    if (!isWorkerActive || !umapWorker) return;
    
    const { scene } = share3dDat();
    const sceneBoundingBox = getSceneBoundingBox(scene);
    umapWorker.postMessage({
        type: 'setSceneBoundingBox',
        data: sceneBoundingBox
    });
}

async function initDBAndFetchEmbeddings() {
    try {
        await indexDBOverlay.openDB(config.dbName);
        await indexDBOverlay.initializeDB(Object.keys(config.dbStores));
        const embeddings = await indexDBOverlay.getData('summaries');

        if (embeddings && embeddings.length > 0) {
            const embeddingVectors = embeddings.map(item => item.embedding);
            const labels = embeddings.map(item => item.fileId);
            return { embeddings: embeddingVectors, labels };
        } else {
            console.log('No embeddings found in the database.');
            return null;
        }
    } catch (error) {
        console.error('Error initializing database or fetching embeddings:', error);
        throw error;
    }
}

export async function fetchEmbeddingsAndPerformUMAPOnly() {
    try {
        const data = await initDBAndFetchEmbeddings();
        if (data) {
            return await performUMAPOnly(data.embeddings, data.labels);
        }
    } catch (error) {
        console.error('Error in fetchEmbeddingsAndPerformUMAPOnly:', error);
    }
}

export async function fetchEmbeddingsAndPerformUMAP() {
    try {
        const data = await initDBAndFetchEmbeddings();
        if (data) {
            await performUMAPAndUpdateScene(data.embeddings, data.labels);
        }
    } catch (error) {
        console.error('Error in fetchEmbeddingsAndPerformUMAP:', error);
    }
}

export function terminateWorkers() {
    terminateWorker();
}

export async function fetchDataAndPerformUMAP_projections() {
    try {
        ensureWorkerInitialized();
        await indexDBOverlay.openDB(config.dbName);
        await indexDBOverlay.initializeDB(Object.keys(config.dbStores));

        const vectorsData = await indexDBOverlay.getData('vectors');
        const hashIndexData = await indexDBOverlay.getData('vectors_hashIndex');

        const embeddings = vectorsData.map(item => item.embedding);
        const labels = vectorsData.map(item => item.fileId);

        const umapResult = await performUMAPOnly(embeddings, labels);

        return { umapResult, vectorsData, hashIndexData };
    } catch (error) {
        console.error('Error fetching data or performing UMAP:', error);
        throw error;
    }
}