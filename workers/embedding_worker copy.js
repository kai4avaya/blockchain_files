// import { pipeline, env, detectEnvironment } from '@xenova/transformers';

// let extractor = null;

// /**
//  * Initialize the extractor with appropriate environment settings based on feature detection.
//  */
// async function initializeExtractor() {
//     if (!extractor) {
//         // Perform environment detection
//         const envInfo = await detectEnvironment();

//         // Configure threading based on support
//         if (envInfo.wasmThreads) {
//             console.log("WebAssembly threads are supported.");
//             env.useBrowserThreads = true;
//             env.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4; // Use available cores
//         } else {
//             console.warn("WebAssembly threads are not supported.");
//             env.useBrowserThreads = false;
//             env.onnx.wasm.numThreads = 1;
//         }

//         // Configure SIMD based on support
//         if (envInfo.wasmSimd) {
//             console.log("WebAssembly SIMD is supported.");
//             env.onnx.wasm.simd = true;
//         } else {
//             console.warn("WebAssembly SIMD is not supported.");
//             env.onnx.wasm.simd = false;
//         }

//         try {
//             // Initialize the extractor pipeline
//             extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
//                 quantized: true,      // Use quantized model for better performance
//                 cache: 'localStorage' // Cache model locally
//             });
//         } catch (error) {
//             console.error("Error initializing extractor:", error);
//             throw error; // Re-throw the error to be caught in the calling function
//         }
//     }
//     return extractor;
// }

// /**
//  * Add global error listeners
//  */
// self.addEventListener('error', function (e) {
//     console.error('Worker global error event:', e);
//     self.postMessage({
//         type: 'error',
//         data: e.message || 'Unknown error in worker',
//         fileId: null,
//     });
// });

// self.addEventListener('unhandledrejection', function (e) {
//     console.error('Worker unhandled rejection:', e);
//     self.postMessage({
//         type: 'error',
//         data: e.reason ? e.reason.message : 'Unhandled promise rejection in worker',
//         fileId: null,
//     });
// });

// self.onmessage = async function (e) {
//     const { type, data, fileId } = e.data;
//     if (type === "initialize") {
//         try {
//             await initializeExtractor();
//             self.postMessage({ type: "ready" });
//         } catch (error) {
//             console.error("Initialization error:", error);
//             self.postMessage({ type: "error", data: error.message, fileId: fileId });
//         }
//     } else if (type === "generateEmbeddings") {
//         try {
//             const embeddings = await generateEmbeddings_chunks(data);
//             self.postMessage({
//                 type: "embeddingsResult",
//                 data: embeddings,
//                 fileId: fileId,
//             });
//         } catch (error) {
//             console.error("Embedding generation error:", error);
//             self.postMessage({
//                 type: "error",
//                 data: error.message || "Unknown error",
//                 fileId: fileId,
//             });
//         }
//     }
// };

// // Rest of your code...


// embedding_worker.js


import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;

let extractor = null;


async function isWasmThreadsSupported() {
  if (typeof SharedArrayBuffer === 'undefined') {
      return false;
  }

  // Attempt to compile a minimal WebAssembly module that uses threads
  const wasmCode = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // WASM binary magic
      0x01, 0x00, 0x00, 0x00, // WASM version
      // Type section
      0x01, // section code
      0x07, // section size
      0x01, // one type
      0x60, // func type
      0x00, // param count
      0x00, // result count
      // Import section
      0x02, // section code
      0x07, // section size
      0x01, // one import
      0x06, // module name length
      0x61, 0x73, 0x6d, 0x65, 0x74, 0x69, // "asm"
      0x01, // field name length
      0x66, // "f"
      0x00, // kind (func)
      0x00, // func index
      // Export section
      0x07, // section code
      0x05, // section size
      0x01, // one export
      0x01, // name length
      0x66, // "f"
      0x00, // kind (func)
      0x00, // func index
      // Code section
      0x0a, // section code
      0x02, // section size
      0x00, // function count
      0x0b  // end
  ]);

  try {
      const module = new WebAssembly.Module(wasmCode);
      const instance = await WebAssembly.instantiate(module, {});
      return true;
  } catch (e) {
      console.warn("WebAssembly threads are not supported:", e);
      return false;
  }
}


// Initialize the extractor
async function initializeExtractor() {

  if (!extractor) {
      // Perform feature detection
      const threadsSupported = await isWasmThreadsSupported();

      if (threadsSupported) {
          env.useBrowserThreads = true;
      } else {
          env.useBrowserThreads = false;
      }

      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          quantized: true, // Use quantized model for better performance
          cache: 'localStorage', // Cache model locally
      });
  }
  return extractor;
}



/**
 * Generates embeddings for a batch of text chunks.
 * @param {string[]} chunks - Array of text chunks.
 * @returns {Promise<number[][]>} Array of embeddings.
 */
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

  // Extract embeddings from the Tensor
  const embeddings = [];
  const batchSize = outputs.dims[0];
  const embeddingDim = outputs.dims[1];

  for (let i = 0; i < batchSize; i++) {
      const start = i * embeddingDim;
      const end = start + embeddingDim;
      const embedding = Array.from(outputs.data.slice(start, end));
      embeddings.push(embedding);
  }

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
            const embeddings = await generateEmbeddings_chunks(data); // Correct
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
    } else if (type === "terminate") {
        try {
            // Ensure any pending operations are completed
            if (extractor) {
                // Clean up any active pipeline resources
                await extractor.dispose();
                extractor = null;
            }
            
            // Send confirmation before terminating
            self.postMessage({ type: "terminationComplete" });
            
            // Terminate the worker
            self.close();
        } catch (error) {
            console.error("Termination error:", error);
            self.postMessage({
                type: "error",
                data: "Failed to terminate worker: " + error.message,
            });
        }
    }
};
