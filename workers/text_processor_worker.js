// text_processor_worker.js
import * as pdfjsLib from 'pdfjs-dist';

const stopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
                           'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with']);

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
  return text.split(/\s+/)
             .filter(word => !stopWords.has(word.toLowerCase()))
             .join(' ');
}

function chunkText(text, chunkSize = 1000) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

async function processContent(content, fileType) {
  let text;
  if (fileType === 'application/pdf') {
    text = await extractTextFromPDF(content);
  } else {
    text = content;
  }
  
  text = removeStopWords(text);
  return chunkText(text);
}

self.onmessage = async function(e) {
  const { type, data, fileType, fileId } = e.data;
  if (type === 'processText') {
    try {
      const processedText = await processContent(data, fileType);
      self.postMessage({ type: 'processedText', data: processedText, fileId });
    } catch (error) {
      self.postMessage({ type: 'error', data: error.message, fileId });
    }
  }
};
