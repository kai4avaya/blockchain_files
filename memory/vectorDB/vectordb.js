import config from '../../configs/config.json';
import indexDBOverlay from '../local/file_worker';
import in_memory_store from '../local/in_memory'
import { generateUniqueId } from "../../utils/utils";  // Add this import!

// vectorDb.js

let DB_DEFAULTS = {
  dbName: config.dbName,
  objectStore: config.dbStores.vectors.storeName || "vectors",
  ...config.dbStores.vectors.vectorConfig,
  keyPath: config.dbStores.vectors.keyPath
};

  // Function to update defaults
  export function setDBDefaults(newValues) {
    // Update properties individually instead of reassigning
    Object.assign(DB_DEFAULTS, newValues);
    return DB_DEFAULTS;
  }
  // Function to get the current defaults
  export function getDBDefaults() {
    return { ...DB_DEFAULTS };
  }
  function generateRandomVector(dimensions) {
    return Array.from({length: dimensions}, () => Math.random() - 0.5);
  }
  
  class LSH {
    constructor(dimensions, numPlanes, numTables = 5) {
        this.numTables = numTables;
        this.tables = Array.from({ length: numTables }, () =>
            Array.from({ length: numPlanes }, () => generateRandomVector(dimensions))
        );
    }
  
    hashVector(vector) {
        return this.tables.map(planes =>
            planes.map(plane =>
                vector.reduce((acc, v, idx) => acc + v * plane[idx], 0) >= 0 ? '1' : '0'
            ).join('')
        );
    }
  }
  
  
  function cosineSimilarity(a, b) {
  
    // temp workaround
    if(a.length === 1){
      a = a[0]
    }
    
    const dotProduct = a.reduce((sum, aVal, idx) => sum + aVal * b[idx], 0);
    const aMagnitude = Math.sqrt(a.reduce((sum, aVal) => sum + aVal * aVal, 0));
    const bMagnitude = Math.sqrt(b.reduce((sum, bVal) => sum + bVal * bVal, 0));
  
    return dotProduct / (aMagnitude * bMagnitude);
  }
  
  
  class VectorDB {
    #objectStore;
    #vectorPath;
    #lsh;
    #hashIndexStore;
    #hashIndexStorePrefix = config.hashindex_prefix;
  

  constructor(options = {}) {
    const { dbName, storeName, vectorPath, dimensions, numPlanes } = {
      ...DB_DEFAULTS,
      ...options,
    };

    this.#objectStore = "vectors";
    this.#vectorPath = vectorPath || DB_DEFAULTS.vectorPath;
    this.#hashIndexStore = `${this.#objectStore}${DB_DEFAULTS.hashIndexSuffix}`;

    console.log('VectorDB initialized with stores:', {
      vectorStore: this.#objectStore,
      hashIndexStore: this.#hashIndexStore
    });

    this.#lsh = new LSH(
      dimensions || DB_DEFAULTS.dimensions,
      numPlanes || DB_DEFAULTS.numPlanes
    );
  }
  
  static async createDatabase(dbName, storeNames) {
    // Use indexDBOverlay to initialize stores
    await indexDBOverlay.initializeDB(storeNames);
  }

   

async insert(object) {
  const vector = object[this.#vectorPath];
  if (!Array.isArray(vector) && !(vector instanceof Int8Array)) {
    throw new Error(`${this.#vectorPath} on 'object' is expected to be an Array or Int8Array`);
  }

  try {
    if (!object.fileId) {
      throw new Error('Cannot insert record without fileId');
    }

    const vectorId = generateUniqueId(4);
    const recordToSave = {
      id: vectorId,
      fileId: object.fileId,
      ...object
    };
    await indexDBOverlay.saveData(this.#objectStore, recordToSave);

    // Modified hash bucket structure to include fileIds
    const hashes = this.#lsh.hashVector(vector);
    for (let hash of hashes) {
      const existingBucket = await indexDBOverlay.getItem(this.#hashIndexStore, hash);
      
      // Update structure to track both vectorIds and their corresponding fileIds
      const bucket = existingBucket || { vectorIds: [], fileIds: {} };
      bucket.vectorIds = [...new Set([...bucket.vectorIds, vectorId])];
      bucket.fileIds[vectorId] = object.fileId;
      
      await indexDBOverlay.saveData(
        this.#hashIndexStore, 
        bucket,
        hash
      );
    }

    return {
      vectorId,
      fileId: object.fileId
    };
  } catch (error) {
    console.error('Database error during insertion:', error);
    throw error;
  }
}


  async delete(key) {
    if (key == null) {
      throw new Error("Unable to delete object without a key");
    }

    try {
      // Get the object first to get its vector for hash computation
      const object = await indexDBOverlay.getItem(this.#objectStore, key);
      if (!object) {
        throw new Error("Object not found with the provided key");
      }

      const vector = object[this.#vectorPath];
      const hashKeys = this.#lsh.hashVector(vector);

      // Remove from hash buckets
      await Promise.all(hashKeys.map(async hashKey => {
        const bucket = await indexDBOverlay.getItem(this.#hashIndexStore, hashKey) || [];
        const index = bucket.indexOf(key);
        if (index !== -1) {
          bucket.splice(index, 1);
          await indexDBOverlay.saveData(this.#hashIndexStore, hashKey, bucket);
        }
      }));

      // Delete the main object
      await indexDBOverlay.deleteItem(this.#objectStore, key);
    } catch (error) {
      console.error('Error during deletion:', error);
      throw error;
    }
  }

  
  async removeFromBucket(hashIndexStore, key, hashKey) {
    const bucket = await new Promise((resolve, reject) => {
        const request = hashIndexStore.get(hashKey);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
  
    const index = bucket.indexOf(key);
    if (index !== -1) {
        bucket.splice(index, 1);
        await new Promise((resolve, reject) => {
            const request = hashIndexStore.put(bucket, hashKey);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
  }
  
  
  
 
  async update(key, object) {
    if (key == null) {
      throw new Error("Unable to update object without a key");
    }

    if (!(this.#vectorPath in object)) {
      throw new Error(`${this.#vectorPath} expected to be present in the object being updated`);
    }

    if (!Array.isArray(object[this.#vectorPath]) && !(object[this.#vectorPath] instanceof Int8Array)) {
      throw new Error(`${this.#vectorPath} on 'object' is expected to be an Array or Int8Array`);
    }

    try {
      // Get current object to compute old hashes
      const currentObject = await indexDBOverlay.getItem(this.#objectStore, key);
      if (!currentObject) {
        throw new Error("Object not found with the provided key");
      }

      const oldHashes = this.#lsh.hashVector(currentObject[this.#vectorPath]);
      const newHashes = this.#lsh.hashVector(object[this.#vectorPath]);

      // Update hash indices
      for (let i = 0; i < this.#lsh.numTables; i++) {
        if (oldHashes[i] !== newHashes[i]) {
          await this.updateHashIndex(key, oldHashes[i], newHashes[i]);
        }
      }

      // Update main object
      await indexDBOverlay.saveData(this.#objectStore, object);
      return key;
    } catch (error) {
      console.error('Error during update:', error);
      throw error;
    }
  }
  async updateHashIndex(key, oldHash, newHash) {
    // Remove from old bucket
    const oldBucket = await indexDBOverlay.getItem(this.#hashIndexStore, oldHash) || [];
    const oldVectorIds = new Set(oldBucket.vectorIds || []);
    oldVectorIds.delete(key);
    await indexDBOverlay.saveData(this.#hashIndexStore, {
      vectorIds: Array.from(oldVectorIds)
    }, oldHash);
  
    // Add to new bucket
    const newBucket = await indexDBOverlay.getItem(this.#hashIndexStore, newHash) || [];
    const newVectorIds = new Set(newBucket.vectorIds || []);
    newVectorIds.add(key);
    await indexDBOverlay.saveData(this.#hashIndexStore, {
      vectorIds: Array.from(newVectorIds)
    }, newHash);
  }
  
  async query(queryVector, options = { limit: 10, minResults: 3 }) {
    console.log('Query started with options:', options);
    
    const { limit, minResults } = options;
    let collectedVectors = new Set();
    let resultObjects = [];
    
    try {
      const hashes = this.#lsh.hashVector(queryVector);
      console.log('Generated hashes:', hashes);
      
      for (let hash of hashes) {
        const hashBucket = await indexDBOverlay.getItem(this.#hashIndexStore, hash);
        console.log('Hash bucket for', hash, ':', hashBucket);
        
        if (!hashBucket || !hashBucket.vectorIds) continue;
        
        // For each vectorId in the bucket, retrieve the actual vector
        for (let vectorId of hashBucket.vectorIds) {
          if (!collectedVectors.has(vectorId)) {
            collectedVectors.add(vectorId);
            
            // Get the actual vector document
            const vector = await indexDBOverlay.getItem(this.#objectStore, vectorId);
            console.log('Retrieved vector:', vector); // Add this log
            
            if (vector) {
              const similarity = cosineSimilarity(queryVector, vector[this.#vectorPath]);
              resultObjects.push({
                vectorId,
                fileId: vector.fileId,
                similarity,
                object: vector
              });
              
              console.log('Added result object:', {
                vectorId,
                fileId: vector.fileId,
                similarity,
                object: vector
              }); // Add this log
            }
          }
        }
        
        if (resultObjects.length >= limit) break;
      }

      // Sort by similarity
      resultObjects.sort((a, b) => b.similarity - a.similarity);
      
      console.log('Final sorted result objects:', resultObjects);
      return resultObjects.slice(0, limit);
      
    } catch (error) {
      console.error("Error during query operation:", error);
      throw error;
    }
  }

  async queryAcrossAllVectorHashIndexes(queryVector, options = { limit: 10 }) {
    const allTables = await indexDBOverlay.getTablesWithPrefix(this.#hashIndexStorePrefix);
    let results = [];

    for (const table of allTables) {
      const partialResults = await this.queryFromTable(queryVector, table, options);
      results = results.concat(partialResults);
    }

    // Sort and limit results across all tables
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, options.limit);
  }

  async queryAcrossAllVectorHashIndexesInMemory(queryVector, options = { limit: 10 }) {
    // Get all table names from the in-memory store that match the hash index prefix
    const allTables = Object.keys(inMemoryStore.inMemoryStore).filter(tableName =>
      tableName.startsWith(this.hashIndexStorePrefix)
    );
  
    let results = [];
  
    for (const table of allTables) {
      const partialResults = await this.queryFromInMemoryTable(queryVector, table, options);
      results = results.concat(partialResults);
    }
  
    // Sort by similarity and limit the number of results
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, options.limit);
  }
  

  async queryFromInMemoryTable(queryVector, tableName, options) {
    const collectedVectors = new Set();
    let resultObjects = [];
  
    // Retrieve all items from the in-memory table
    const data = await in_memory_store.getAll(tableName);
  
    for (const item of data) {
      if (!collectedVectors.has(item.id)) {
        collectedVectors.add(item.id);
        const similarity = this.calculateSimilarity(queryVector, item.vector); // You can replace this with your similarity calculation method
        resultObjects.push({
          vectorId: item.id,
          fileId: item.fileId,
          similarity,
          object: item
        });
      }
    }
  
    // Sort results by similarity
    resultObjects.sort((a, b) => b.similarity - a.similarity);
    return resultObjects.slice(0, options.limit);
  }

   calculateSimilarity(queryVector, vector) {
    // Replace with your actual similarity calculation logic, e.g., cosine similarity
    const dotProduct = queryVector.reduce((sum, q, idx) => sum + q * vector[idx], 0);
    const queryMagnitude = Math.sqrt(queryVector.reduce((sum, q) => sum + q * q, 0));
    const vectorMagnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return dotProduct / (queryMagnitude * vectorMagnitude);
  }
  
    get objectStore() {
      // Escape hatch.
      return this.#objectStore;
    }

    
  }
  
  export { VectorDB };