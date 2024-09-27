// embedding_worker.js (updated)
import { pipeline } from '@xenova/transformers';

let extractor;

async function initializeExtractor() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: false,
      cache_dir: '/models',
    });
  }
}

async function generateBinaryEmbeddings(chunks) {
  const embeddings = [];
  for (const chunk of chunks) {
    const output = await extractor(chunk, {
      pooling: 'mean',
      quantize: true,
      precision: 'binary'
    });
    embeddings.push(output);
  }
  return embeddings;
}

self.onmessage = async function(e) {
  const { type, data, fileId } = e.data;
  if (type === 'generateEmbeddings') {
    try {
      await initializeExtractor();
      const embeddings = await generateBinaryEmbeddings(data);
      self.postMessage({ type: 'embeddingsResult', data: embeddings, fileId });
    } catch (error) {
      self.postMessage({ type: 'error', data: error.message, fileId });
    }
  }
};

// Main application usage
import textProcessorWorker from './TextProcessorWorker';
import embeddingWorker from './EmbeddingWorker';

async function processFile(file, id) {
    try {
        let content;
        if (file.type === 'application/pdf') {
            content = await file.arrayBuffer();
        } else {
            content = await file.text();
        }

        // Process text
        const processedText = await textProcessorWorker.processText(content, file.type, id);

        // Generate embeddings
        const embeddings = await embeddingWorker.generateEmbeddings(processedText, id);

        // Process embeddings, update file system, etc.
        return embeddings;
    } catch (error) {
        console.error('Error processing file:', error);
        throw error;
    }
}

// Function to process multiple files in parallel
async function processFiles(files) {
    const promises = files.map((file, index) => processFile(file, `file_${index}`));
    return Promise.all(promises);
}