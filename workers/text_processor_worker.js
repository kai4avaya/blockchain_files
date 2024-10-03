// // text_processor_worker.js
// import * as pdfjsLib from 'pdfjs-dist';
// import {removeStopWords} from "./summary_worker.js"
// // const stopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
// //                            'its', 'of', 'on', 'that', 'this', 'the', 'to', 'was', 'were', 'will', 'with']);

// async function extractTextFromPDF(arrayBuffer) {
//     const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
//     let text = '';
//     for (let i = 1; i <= pdf.numPages; i++) {
//         const page = await pdf.getPage(i);
//         const content = await page.getTextContent();
//         text += content.items.map(item => item.str).join(' ') + ' ';
//     }
//     return text;
// }

// // function removeStopWords(text) {
// //     if (typeof text !== 'string') {
// //         console.error("removeStopWords received non-string input:", typeof text);
// //         return '';
// //     }
// //     return text.split(/\s+/)
// //                .filter(word => !stopWords.has(word.toLowerCase()))
// //                .join(' ');
// // }



// export function removeStopWords(text) {
//     try {
//       const doc = nlp(text);
//       const cleanedText = doc.normalize().remove('#Stop').out('text');
//       return cleanedText;
//     } catch (error) {
//       console.error("Error in removeStopWords:", error);
//       throw error;
//     }
//   }
  
  
// function chunkText(text, chunkSize = 1000) {
//     if (typeof text !== 'string') {
//         console.error("chunkText received non-string input:", typeof text);
//         return [];
//     }
//     const words = text.split(/\s+/);
//     const chunks = [];
//     for (let i = 0; i < words.length; i += chunkSize) {
//         chunks.push(words.slice(i, i + chunkSize).join(' '));
//     }
//     return chunks;
// }

// async function processContent(content, fileType) {
//     let text;
//     try {
//         if (fileType === 'application/pdf') {
//             text = await extractTextFromPDF(content);
//         } else {
//             text = content;
//         }
        
//         if (typeof text !== 'string') {
//             throw new Error(`Expected text to be a string, but got ${typeof text}`);
//         }
//         console.log("I am text in text_processor_worker", text)
//         // Do not modify the original text
//         const textWithoutStopWords = removeStopWords(text);
//         console.log("I am text in textWithoutStopWords text_processor_worker", textWithoutStopWords)
//         const chunks = chunkText(textWithoutStopWords);

//         console.log("I am chunks in text_processor_worker", chunks)
//         return { chunks, text }; // text is the original full text
//     } catch (error) {
//         console.error("Error in processContent:", error);
//         throw error;
//     }
// }


// let taskQueue = [];
// let isProcessing = false;


// function processNextTask() {
//     if (taskQueue.length === 0) {
//         isProcessing = false;
//         return;
//     }
    
//     isProcessing = true;
//     const task = taskQueue.shift();
//     processContent(task.data, task.fileType)
//         .then(result => {
//             self.postMessage({ type: 'processedText', data: result, fileId: task.fileId });
//             processNextTask();
//         })
//         .catch(error => {
//             console.error("Task processing error:", error);
//             self.postMessage({ type: 'error', data: error.message, fileId: task.fileId });
//             processNextTask();
//         });
// }


// self.onmessage = function(e) {
//     const { type, data, fileType, fileId } = e.data;
//     if (type === 'processText') {
//         taskQueue.push({ data, fileType, fileId });
//         if (!isProcessing) {
//             processNextTask();
//         }
//     }
// };

// text_processor_worker.js
import * as pdfjsLib from 'pdfjs-dist';
// Import nlp from compromise if you're using it
import nlp from 'compromise';

console.log("WORKER text_processor_worker is initializing");

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
        console.log("Text received in text_processor_worker", text.substring(0, 100) + "...");
        const textWithoutStopWords = removeStopWords(text);
        console.log("Text without stop words", textWithoutStopWords.substring(0, 100) + "...");
        const chunks = chunkText(textWithoutStopWords);
        console.log("Number of chunks created:", chunks.length);
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
        console.log(`Received task for file ${fileId}, type: ${fileType}`);
        taskQueue.push({ data, fileType, fileId });
        if (!isProcessing) {
            processNextTask();
        }
    }
};

console.log("WORKER text_processor_worker initialization complete");