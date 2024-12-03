// text_processor_worker.js
import nlp from 'compromise';

const CHUNK_SIZE = 800;

function removeStopWords(text) {
    try {
        const doc = nlp(text);
        const cleanedText = doc.normalize().remove('#Stop').out('text');
        return cleanedText;
    } catch (error) {
        console.error("Error in removeStopWords:", error);
        return text;
    }
}

function removeBase64Content(text) {
    try {
        // This regex matches common base64 patterns
        const base64Regex = /(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
        
        // Look for long strings that match base64 pattern (at least 50 chars)
        return text.replace(/[A-Za-z0-9+/]{50,}={0,2}/g, ' ');
    } catch (error) {
        console.error("Error in removeBase64Content:", error);
        return text;
    }
}

function chunkText(text, chunkSize = CHUNK_SIZE) {
    if (typeof text !== 'string') {
        console.error("chunkText received non-string input:", typeof text);
        return [];
    }
    const words = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push({
            text: words.slice(i, i + chunkSize).join(' '),
            position: 0 // this is not used!
        });
    }
    return chunks;
}

async function processContent(content) {
    try {
        if (typeof content !== 'string') {
            throw new Error(`Expected text to be a string, but got ${typeof content}`);
        }
        
        const textWithoutBase64 = removeBase64Content(content);
        
        const textWithoutStopWords = removeStopWords(textWithoutBase64);
        
        const chunks = chunkText(textWithoutStopWords);
        
        // Create two versions of chunks - one with position info and one without
        const processedChunks = chunks.map(chunk => chunk.text); // For embedding worker
        const positionedChunks = chunks; // For vector storage
        
        return { 
            chunks: processedChunks,  // Compatible format for embedding worker
            positionedChunks: positionedChunks, // New format with position info
            text: content 
        };
    } catch (error) {
        console.error("Error in processContent:", error);
        throw error;
    }
}

// Message handler
self.onmessage = function(e) {
    const { type, data, fileId } = e.data;
    if (type === 'processText') {
        processContent(data)
            .then(result => {
                self.postMessage({ 
                    type: 'processedText', 
                    data: {
                        chunks: result.chunks, // For embedding worker
                        positionedChunks: result.positionedChunks, // For vector storage
                        text: result.text
                    },
                    fileId 
                });
            })
            .catch(error => {
                self.postMessage({ type: 'error', data: error.message, fileId });
            });
    }
};
