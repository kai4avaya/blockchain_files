
import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;

let extractor = null;

// Initialize the extractor
async function initializeExtractor() {
    console.log("Extractor initialized and TURDING");
    if (!extractor) {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            quantized: false,
        });
    }
    return extractor;
}


async function generateEmbeddings(chunks) {
  const embeddings = [];
  for (const chunk of chunks) {
      if (typeof chunk !== 'string') {
          throw new Error(`Invalid chunk type: expected string, got ${typeof chunk}`);
      }
      console.log("i am chunk", chunk);
      const output = await extractor(chunk, {
          pooling: 'mean',
          normalize: true,
          quantize: true, // Enable quantization for binary embeddings
          precision: 'binary', // Set precision to 'binary'
      });

      console.log("i am output", output);
      console.log("Available properties on output:", Object.keys(output));
      console.log("Available methods on output:", Object.getOwnPropertyNames(Object.getPrototypeOf(output)));

      let embeddingArray;
      try {
          if (ArrayBuffer.isView(output.data)) {
              console.log("Using output.data to serialize embedding.");
              embeddingArray = Array.from(output.data);
              console.log("Serialized using output.data:", embeddingArray);
          } else if (typeof output.tolist === 'function') {
              console.log("Using output.tolist() to serialize embedding.");
              const tolistResult = output.tolist();
              console.log("Output of tolist():", tolistResult);
              if (Array.isArray(tolistResult) && Array.isArray(tolistResult[0])) {
                  embeddingArray = tolistResult[0]; // Extract the first array if nested
              } else if (Array.isArray(tolistResult)) {
                  embeddingArray = tolistResult; // Single array
              } else {
                  console.error("Unexpected format from tolist():", tolistResult);
                  throw new Error("Unexpected tolist() format.");
              }
              console.log("Serialized using tolist():", embeddingArray);
          } else {
              console.error("No known serialization method found on output.");
              throw new Error("Unsupported Tensor format for serialization.");
          }
      } catch (error) {
          console.error("Error during serialization:", error);
          throw new Error("Serialization failed: " + error.message);
      }

      embeddings.push(embeddingArray);
  }
  return embeddings;
}


async function generateEmbeddings_chunks(chunks) {
  // Validate input
  if (!Array.isArray(chunks) || !chunks.every(chunk => typeof chunk === 'string')) {
      throw new Error('Chunks must be an array of strings');
  }

  // Process all chunks in a single batch
  const outputs = await extractor(chunks, {
      pooling: 'mean',
      normalize: true,
      quantize: true,        // Quantize output embeddings
      precision: 'binary',   // Use binary precision for embeddings
  });

  // Serialize embeddings
  const embeddings = outputs.map(output => {
      // Use output.data directly without copying if possible
      return Array.from(output.data);
  });

  return embeddings;
}

self.onmessage = async function (e) {
    const { type, data, fileId } = e.data;
    if (type === "initialize") {
        try {
            await initializeExtractor();
            self.postMessage({ type: "ready" });
        } catch (error) {
            console.error("Initialization error:", error);
            self.postMessage({ type: "error", data: error.message, fileId: fileId });
        }
    } else if (type === "generateEmbeddings") {
        try {
            const embeddings = await generateEmbeddings(data); // Correct
            console.log("i am embeddings", fileId, embeddings);
            self.postMessage({
                type: "embeddingsResult",
                data: embeddings, // Send serialized embeddings
                fileId: fileId,
            });
        } catch (error) {
            // Improved error handling with more details
            console.error("Embedding generation error:", error);
            self.postMessage({
                type: "error",
                data: error.message || "Unknown error",
                fileId: fileId,
            });
        }
    }
};
