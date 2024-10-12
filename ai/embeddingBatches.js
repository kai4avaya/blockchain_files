// embeddingBatches.js
import indexDBOverlay from '../memory/local/file_worker';
import embeddingWorker from './embeddings.js';

const BATCH_SIZE = 100;

async function processEmbeddingsInBatches(
    dbName = "summarizationDB",
    table = "summaries",
    fields = ['keywords', 'fileId', 'fileName'],
    dbVersion = 2
) {
    try {
        await indexDBOverlay.openDB(dbName, dbVersion);
        await indexDBOverlay.initializeDB([table]);
        
        const allData = await indexDBOverlay.getData(table, dbName);
        
        let allEmbeddings = [];
        let allKeywords = [];
        let allFileIds = [];

        for (let i = 0; i < allData.length; i++) {
            const item = allData[i];
            if (item[fields[0]] && Array.isArray(item[fields[0]])) {
                const keywords = item[fields[0]];
                const fileId = item[fields[1]];
                const fileName = item[fields[2]];

                // Process keywords in batches
                for (let j = 0; j < keywords.length; j += BATCH_SIZE) {
                    const batch = keywords.slice(j, j + BATCH_SIZE);
                    try {
                        const embeddings = await embeddingWorker.generateEmbeddings(batch, fileId);
                        allEmbeddings.push(...embeddings);
                        allKeywords.push(...batch);
                        allFileIds.push(...Array(batch.length).fill(fileId));
                    } catch (error) {
                        console.error(`Error processing batch for fileId ${fileId}:`, error);
                    }
                }
            }
        }

        return { embeddings: allEmbeddings, keywords: allKeywords, fileIds: allFileIds };
    } catch (error) {
        console.error('Error processing embeddings:', error);
        throw error;
    }
}

// Backward compatible function
export function processKeywordEmbeddings() {
    return processEmbeddingsInBatches("summarizationDB", "summaries", ['keywords', 'fileId', 'fileName']);
}

export { processEmbeddingsInBatches };