import textProcessorWorker from "../../ai/processText";
import embeddingWorker from "../../ai/embeddings";
import { VectorDB, getDBDefaults, setDBDefaults } from "./vectordb";
import { generateUniqueId } from "../../utils/utils";
``;
let dbs = {};

export async function initiate(
  dbName = "vectorDB_new",
  storeNames = ["vectors"],
  vectorPath = "embedding"
) {
  setDBDefaults({ dbName: dbName });

  // Create the database and stores if they don't exist
  await VectorDB.createDatabase(dbName, storeNames);

  for (let storeName of storeNames) {
    dbs[`${dbName}_${storeName}`] = new VectorDB({
      dbName: dbName,
      vectorPath: vectorPath,
      storeName: storeName,
    });
  }

  return getDBDefaults();
}

export async function quickStart(
  metaData,
  storeName = "vectors",
  dbName = "vectorDB_new"
) {
  const { text, ...otherMetaData } = metaData;
  const fileId = metaData.fileId;

  const dbKey = `${dbName}_${storeName}`;
  if (!dbs[dbKey]) {
    throw new Error(
      `Store "${storeName}" in database "${dbName}" not initialized`
    );
  }

  const db = dbs[dbKey];

  let processedChunks;
  if (!metaData.processedChunks) {
    processedChunks = await textProcessorWorker.processText(
      text,
      "text",
      fileId
    );
  } else {
    processedChunks = metaData.processedChunks;
  }

  // Generate embeddings
  const embeddings = await embeddingWorker.generateEmbeddings(
    processedChunks,
    fileId + `-${metaData.task}`
  ); // in case single file has multiple processes running tasks differentiate it

  const inMemoryRecord = [];

  for (let i = 0; i < processedChunks.length; i++) {
    const key = await db.insert({
      embedding: embeddings[i],
      fileId: fileId,
      ...otherMetaData,
      text: processedChunks[i],
    });

    inMemoryRecord.push({
      key: key,
      fileId: fileId,
      ...otherMetaData,
      text: processedChunks[i],
    });
  }

  return inMemoryRecord;
}

export async function search(
  query,
  storeName,
  k = { limit: 5 },
  token,
  isLocal = true,
  dbName = "vectorDB_new"
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
