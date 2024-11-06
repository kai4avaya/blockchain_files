// memory\vectorDB\vectorDbGateway.js

import textProcessorWorker from "../../ai/processText";
import embeddingWorker from "../../ai/embeddings";
import { VectorDB, getDBDefaults, setDBDefaults } from "./vectordb";
import { generateUniqueId } from "../../utils/utils";
import config from '../../configs/config.json';
import indexDBOverlay from '../local/file_worker';

let dbs = {};
let initialized = false;

export async function initiate() {
  if (initialized) {
    return getDBDefaults();
  }

  try {
    // 1. Set up defaults from config
    const vectorConfig = config.dbStores.vectors.vectorConfig;
    setDBDefaults({
      dbName: config.dbName,
      storeName: 'vectors',
      dimensions: vectorConfig.dimensions,
      hyperplanes: vectorConfig.hyperplanes,
      numPlanes: vectorConfig.numPlanes,
      vectorPath: vectorConfig.vectorPath,
      hashIndexSuffix: vectorConfig.hashIndexSuffix
    });

    // 2. Initialize required stores
    const requiredStores = ['vectors', 'vectors_hashIndex', 'summaries'];
    
    // 3. Create databases and initialize VectorDB instances
    await VectorDB.createDatabase(config.dbName, requiredStores);

    // 4. Initialize VectorDB for vectors store
    const dbKey = `${config.dbName}_vectors`;
    if (!dbs[dbKey]) {
      dbs[dbKey] = new VectorDB({
        dbName: config.dbName,
        storeName: 'vectors',
        vectorPath: vectorConfig.vectorPath,
        dimensions: vectorConfig.dimensions,
        numPlanes: vectorConfig.numPlanes
      });
    }

    // 5. Initialize database for summaries store
    const summariesKey = `${config.dbName}_summaries`;
    if (!dbs[summariesKey]) {
      dbs[summariesKey] = true; // Mark as initialized
    }

    initialized = true;
    console.log('Vector DB Gateway initialized with stores:', requiredStores);
    return getDBDefaults();
  } catch (error) {
    console.error('Failed to initialize Vector DB Gateway:', error);
    throw error;
  }
}


export async function quickStart(params, storeType = 'vectors', dbName = config.dbName) {
  if (!initialized) {
    await initiate();
  }

  const dbKey = `${dbName}_${storeType}`;
  const { task } = params;

  try {
    if (task === "summary") {
      // Handle summary storage
      const summaryData = {
        fileId: params.fileId,
        summary: params.summary,
        keywords: params.keywords,
        fileName: params.fileName,
        fileType: params.fileType,
        timestamp: Date.now()
      };
      
      await indexDBOverlay.saveData('summaries', summaryData);
      return [summaryData];

    } else if (task === "embeddings") {
      // Get the VectorDB instance for embeddings
      const db = dbs[dbKey];
      if (!db) {
        throw new Error(`Store "${storeType}" in database "${dbName}" not initialized`);
      }

      // Process the text and embeddings as before
      const { text, processedChunks, fileId, ...otherMetaData } = params;
      let chunks = processedChunks;

      console.log("pre chunks: " + chunks)
      
      if (!chunks) {
        const processedResult = await textProcessorWorker.processText(text, "text", fileId);
        chunks = processedResult.chunks;
      }

      console.log('chunks got processedText: ', chunks);
      const embeddings = await embeddingWorker.generateEmbeddings(chunks, fileId + `-${task}`);
      const inMemoryRecord = [];

      // Store each chunk and its embedding
      for (let i = 0; i < chunks.length; i++) {
        const record = await db.insert({
          embedding: embeddings[i],
          fileId: fileId,
          ...otherMetaData,
          text: chunks[i],
        });

        inMemoryRecord.push({
          ...record,
          text: chunks[i],
          ...otherMetaData
        });
      }

      return inMemoryRecord;
    }
  } catch (error) {
    console.error(`Error in quickStart for ${storeType}:`, error);
    throw new Error(`Store "${storeType}" operation failed: ${error.message}`);
  }
}

export async function search(
  query,
  storeName,
  k = { limit: 5 },
  token,
  isLocal = true,
  dbName =  dbName = config.dbName,// "vectorDB_new"
) {
  const dbKey = `${dbName}_${storeName}`;
  if (!dbs[dbKey]) {
    throw new Error(
      `Store "${storeName}" in database "${dbName}" not initialized`
    );
  }

  const db = dbs[dbKey];

  // Process the query text
  const processedQuery = await textProcessorWorker.processText(
    query,
    "text",
    "query"
  );

  // Generate embedding for the processed query
  const [queryEmbedding] = await embeddingWorker.generateEmbeddings(
    processedQuery,
    "query"
  );

  // Perform the search using the query embedding
  return db.query(queryEmbedding, k);
}

export async function quickStart_single(metaData, storeName) {
  if (!dbs[storeName]) {
    throw new Error(`Store "${storeName}" not initialized`);
  }

  const db = dbs[storeName];
  const { text, ...otherMetaData } = metaData;
  const fileId = metaData.fileId;

  // Process text
  const [processedText] = await textProcessorWorker.processText(
    text,
    "text",
    fileId
  );

  // Generate embedding
  const [embedding] = await embeddingWorker.generateEmbeddings(
    [processedText],
    fileId
  );

  const key = await db.insert({
    embedding: embedding,
    fileId: fileId,
    ...otherMetaData,
    text: processedText,
  });

  const inMemoryRecord = [
    {
      key: key,
      fileId: fileId,
      ...otherMetaData,
      text: processedText,
    },
  ];

  return inMemoryRecord;
}

export async function delete_row(key, storeName) {
  if (!dbs[storeName]) {
    throw new Error(`Store "${storeName}" not initialized`);
  }

  const db = dbs[storeName];
  return await db.delete(key);
}


/**
 * Generates an embedding for the given text and adds it to the provided summary data.
 * The enriched data is then saved to the 'summaries' store.
 *
 * @async
 * @param {string} text - The text to generate an embedding for.
 * @param {Object} data - The summary data object to enrich with the embedding.
 * @param {string} data.fileId - The unique identifier of the file associated with the summary.
 * @returns {Promise<Object>} A promise that resolves to the enriched summary data object with the added embedding.
 * @throws {Error} If there's an error during the embedding generation or data saving process.
 */
export async function addEmbeddingDirectly(text, data, store='summaries') {
  try {
    // Generate embedding for the summary text using existing worker
    const [embedding] = await embeddingWorker.generateEmbeddings(
      [text],
      `summary-${data.fileId}`
    );

    // Add the embedding to the summary data
    const enrichedSummaryData = {
      ...data,
      embedding // Store the embedding directly in the summary record
    };

    // Update the summary record with the new embedding
    await indexDBOverlay.saveData(store, enrichedSummaryData);

    return enrichedSummaryData;
  } catch (error) {
    console.error('Error adding embedding to summary:', error);
    throw error;
  }
}




export async function update(key, metaData, storeName) {
  if (!dbs[storeName]) {
    throw new Error(`Store "${storeName}" not initialized`);
  }

  const db = dbs[storeName];
  const { text, ...otherMetaData } = metaData;
  const fileId = metaData.fileId || generateUniqueId();

  // Process text
  const [processedText] = await textProcessorWorker.processText(
    text,
    "text",
    fileId
  );

  
  // Generate embedding
  const [embedding] = await embeddingWorker.generateEmbeddings(
    [processedText],
    fileId
  );

  return await db.update(key, {
    embedding: embedding,
    fileId: fileId,
    ...otherMetaData,
    text: processedText,
  });
}
