import textProcessorWorker from './processText'
import * as vectorDBGateway from '../memory/vectorDB/vectorDbGateway'
import {summarizeText} from './summary'

export async function orchestrateTextProcessing(content, file, id) {
    try {
        const {chunks, text} = await textProcessorWorker.processText(content, file.type, id);

        await embeddingResult(text, chunks, file, id);
        await summarizeTextAndStore(text, file, id);

    } catch (error) {
        console.error(`Error processing file ${id}:`, error);
        throw error; // Re-throw the error for the caller to handle
    }
}

async function embeddingResult(content, chunks, file, id) {
    try {
        const embeddingResult = await vectorDBGateway.quickStart({
            text: content,
            processedChunks: chunks,
            fileId: id,
            fileName: file.name,
            fileType: file.type
        });
        return embeddingResult;
    } catch (error) {
        console.error(`Error generating embeddings for file ${id}:`, error);
        throw error; // Re-throw the error for the caller to handle
    }
}

async function summarizeTextAndStore(content, file, id) {
    try {
        const { summary, keywords } = await summarizeText(content, id, file.name);

        // Start embedding generation for the main vectorDB
        await vectorDBGateway.quickStart({
            text: content,
            processedChunks: [summary],
            fileId: id,
            fileName: file.name,
            fileType: file.type,
            summary: summary,
            keywords: keywords
        }, 'summaries', 'summarizationDB');

        return { summary, keywords };
    } catch (error) {
        console.error(`Error storing summary for file ${id}:`, error);
        throw error; // Re-throw the error for the caller to handle
    }
}
