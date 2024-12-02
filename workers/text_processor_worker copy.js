// text_processor_worker.js
import * as pdfjsLib from 'pdfjs-dist';
import { GlobalWorkerOptions } from 'pdfjs-dist/build/pdf';
import PDFWorker from 'pdfjs-dist/build/pdf.worker.entry';
// Import nlp from compromise if you're using it
import nlp from 'compromise';

GlobalWorkerOptions.workerSrc = PDFWorker;

const CHUNK_SIZE = 800;


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
    try {
        const doc = nlp(text);
        const cleanedText = doc.normalize().remove('#Stop').out('text');
        return cleanedText;
    } catch (error) {
        console.error("Error in removeStopWords:", error);
        return text; // Return original text if there's an error
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
        const textWithoutStopWords = removeStopWords(text);
        const chunks = chunkText(textWithoutStopWords);
        return { chunks, text }; // text is the original full text
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
