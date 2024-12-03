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
            position: i / chunkSize
        });
    }
    return chunks;
}

async function processContent(content) {
    try {
        if (typeof content !== 'string') {
            throw new Error(`Expected text to be a string, but got ${typeof content}`);
        }
        const textWithoutStopWords = removeStopWords(content);
        const chunks = chunkText(textWithoutStopWords);
        return { 
            chunks, 
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
                self.postMessage({ type: 'processedText', data: result, fileId });
            })
            .catch(error => {
                self.postMessage({ type: 'error', data: error.message, fileId });
            });
    }
};
