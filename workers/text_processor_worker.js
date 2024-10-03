// text_processor_worker.js
import * as pdfjsLib from 'pdfjs-dist';

const stopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
                           'its', 'of', 'on', 'that', 'this', 'the', 'to', 'was', 'were', 'will', 'with']);

async function extractTextFromPDF(arrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + ' ';
    }
    return text;
}

function removeStopWords(text) {
    if (typeof text !== 'string') {
        console.error("removeStopWords received non-string input:", typeof text);
        return '';
    }
    return text.split(/\s+/)
               .filter(word => !stopWords.has(word.toLowerCase()))
               .join(' ');
}

function chunkText(text, chunkSize = 1000) {
    if (typeof text !== 'string') {
        console.error("chunkText received non-string input:", typeof text);
        return [];
    }
    const words = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    return chunks;
}

async function processContent(content, fileType) {
    let text;
    try {
        if (fileType === 'application/pdf') {
            text = await extractTextFromPDF(content);
        } else {
            text = content;
        }
        
        if (typeof text !== 'string') {
            throw new Error(`Expected text to be a string, but got ${typeof text}`);
        }

        text = removeStopWords(text);
        const chunks = chunkText(text);
        return { chunks, text };
    } catch (error) {
        console.error("Error in processContent:", error);
        throw error;
    }
}

let taskQueue = [];
let isProcessing = false;


function processNextTask() {
    if (taskQueue.length === 0) {
        isProcessing = false;
        return;
    }
    
    isProcessing = true;
    const task = taskQueue.shift();
    processContent(task.data, task.fileType)
        .then(result => {
            self.postMessage({ type: 'processedText', data: result, fileId: task.fileId });
            processNextTask();
        })
        .catch(error => {
            console.error("Task processing error:", error);
            self.postMessage({ type: 'error', data: error.message, fileId: task.fileId });
            processNextTask();
        });
}


self.onmessage = function(e) {
    const { type, data, fileType, fileId } = e.data;
    if (type === 'processText') {
        taskQueue.push({ data, fileType, fileId });
        if (!isProcessing) {
            processNextTask();
        }
    }
};
