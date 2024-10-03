// vectorDBGateway.js
import textProcessorWorker from '../../ai/processText';
import embeddingWorker from '../../ai/embeddings';
import { VectorDB, getDBDefaults, setDBDefaults } from "./vectordb";
import { generateUniqueId } from '../../utils/utils';

let db;

export async function initiate(dbName) {
    setDBDefaults({ dbName: dbName });
    db = new VectorDB({
        vectorPath: "embedding"
    });
    return getDBDefaults();
}
export async function quickStart(metaData) {
    const { text, ...otherMetaData } = metaData;
    const fileId = generateUniqueId();

    // Process text
    const processedChunks = await textProcessorWorker.processText(text, 'text', fileId);

    console.log("I AM TURD POOL!", fileId)
    // Generate embeddings
    console.time('OLD Embedding Generation');

    const embeddings = await embeddingWorker.generateEmbeddings(processedChunks, fileId);
    console.timeEnd('OLD Embedding Generation');
    console.log("i am durdur")

    const inMemoryRecord = [];

    for (let i = 0; i < processedChunks.length; i++) {
        const key = await db.insert({
            embedding: embeddings[i],
            fileId: fileId,
            ...otherMetaData,
            text: processedChunks[i]
        });

        inMemoryRecord.push({
            key: key,
            fileId: fileId,
            ...otherMetaData,
            text: processedChunks[i]
        });
    }

    return inMemoryRecord;
}

export async function search(query, k = { limit: 5 }, token, isLocal = true) {
    // Process the query text
    const processedQuery = await textProcessorWorker.processText(query, 'text', 'query');

    // Generate embedding for the processed query
    const [queryEmbedding] = await embeddingWorker.generateEmbeddings(processedQuery, 'query');

    // Perform the search using the query embedding
    return db.query(queryEmbedding, k);
}

export async function quickStart_single(metaData) {
    const { text, ...otherMetaData } = metaData;
    const fileId = metaData.fileId;

    // Process text
    const [processedText] = await textProcessorWorker.processText(text, 'text', fileId);

    console.log("processedText", processedText);

    // Generate embedding
    const [embedding] = await embeddingWorker.generateEmbeddings([processedText], fileId);

    console.log("embedding", embedding);

    const key = await db.insert({
        embedding: embedding,
        fileId: fileId,
        ...otherMetaData,
        text: processedText
    });

    const inMemoryRecord = [{
        key: key,
        fileId: fileId,
        ...otherMetaData,
        text: processedText
    }];

    return inMemoryRecord;
}

export async function delete_row(key) {
    return await db.delete(key);
}

export async function update(key, metaData) {
    const { text, ...otherMetaData } = metaData;
    const fileId = metaData.fileId || generateUniqueId();

    // Process text
    const [processedText] = await textProcessorWorker.processText(text, 'text', fileId);

    // Generate embedding
    const [embedding] = await embeddingWorker.generateEmbeddings([processedText], fileId);

    return await db.update(key, {
        embedding: embedding,
        fileId: fileId,
        ...otherMetaData,
        text: processedText
    });
}