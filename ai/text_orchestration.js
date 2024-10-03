// import textProcessorWorker from './processText'
// import * as vectorDBGateway from '../memory/vectorDB/vectorDbGateway'
// import {summarizeText} from './summary'

// export async function orchestrateTextProcessing(content, file, id) {
//     try {
//         console.log("content: text_orchestration orchestrateTextProcessing...")
//         const {chunks, text} = await textProcessorWorker.processText(content, file.type, id);
//         console.log("TEXTPORCESSOR in text_orchestration")
//         await embeddingResult(text, chunks, file, id);
//         console.log("TEXTPORCESSOR in embedding")
//         await summarizeTextAndStore(text, file, id);
//         console.log("TEXTPORCESSOR in summarization")


//     } catch (error) {
//         console.error(`Error processing file ${id}:`, error);
//         throw error; // Re-throw the error for the caller to handle
//     }
// }

// async function embeddingResult(content, chunks, file, id) {
//     try {
//         const embeddingResult = await vectorDBGateway.quickStart({
//             text: content,
//             processedChunks: chunks,
//             fileId: id,
//             fileName: file.name,
//             fileType: file.type
//         });
//         return embeddingResult;
//     } catch (error) {
//         console.error(`Error generating embeddings for file ${id}:`, error);
//         throw error; // Re-throw the error for the caller to handle
//     }
// }

// async function summarizeTextAndStore(content, file, id) {
//     try {
//         const { summary, keywords } = await summarizeText(content, id, file.name);

//         console.log("text_orchestration", summary, keywords);
//         // Start embedding generation for the main vectorDB
//         await vectorDBGateway.quickStart({
//             text: content,
//             processedChunks: [summary],
//             fileId: id,
//             fileName: file.name,
//             fileType: file.type,
//             summary: summary,
//             keywords: keywords
//         }, 'summaries', 'summarizationDB');

//         return { summary, keywords };
//     } catch (error) {
//         console.error(`Error storing summary for file ${id}:`, error);
//         throw error; // Re-throw the error for the caller to handle
//     }
// }


import textProcessorWorker from './processText'
import * as vectorDBGateway from '../memory/vectorDB/vectorDbGateway'
import { summarizeText } from './summary'

// let textProcessorWorker;

export async function orchestrateTextProcessing(content, file, id) {
    try {
        console.log(`Starting text processing for file ${id}, type: ${file.type}`);
        console.log("Content length:", content.length);

        if (!textProcessorWorker) {
            console.log("Initializing TextProcessorWorker");
        }

        const { chunks, text } = await textProcessorWorker.processText(content, file.type, id);
        console.log(`Text processing completed for file ${id}`);
        console.log("Processed text length:", text.length);
        console.log("Number of chunks:", chunks.length);

        console.log(`Starting embedding for file ${id}`);
        embeddingResult(text, chunks, file, id);
        console.log(`Embedding completed for file ${id}`);

        console.log(`Starting summarization for file ${id}`);
        summarizeTextAndStore(text, file, id);
        console.log(`Summarization completed for file ${id}`);
    } catch (error) {
        console.error(`Error processing file ${id}:`, error);
        console.error("Error stack:", error.stack);
        throw error;
    }
}
async function embeddingResult(content, chunks, file, id) {
    try {
        console.log(`Starting embedding generation for file ${id}`);
        console.log(`Number of chunks to process: ${chunks.length}`);
        
        const embeddingResult = await vectorDBGateway.quickStart({
            text: content,
            processedChunks: chunks,
            fileId: id,
            fileName: file.name,
            fileType: file.type,
            task: "embeddings",
        });
        
        console.log(`Embedding generation completed for file ${id}`);
        console.log(`Embedding result:`, embeddingResult);
        
        return embeddingResult;
    } catch (error) {
        console.error(`Error generating embeddings for file ${id}:`, error);
        console.error("Error stack:", error.stack);
        throw error;
    }
}
async function summarizeTextAndStore(content, file, id) {
    try {
        console.log(`Starting summarization for file ${id}`);
        const { summary, keywords } = await summarizeText(content, id, file.name);
        console.log(`Summarization completed for file ${id}`);
        console.log("Summary length:", summary.length);
        console.log("Number of keywords:", keywords.length);

        console.log(`Starting embedding generation for summary of file ${id}`);
        await vectorDBGateway.quickStart({
            text: content,
            processedChunks: [summary],
            fileId: id,
            fileName: file.name,
            fileType: file.type,
            summary: summary,
            keywords: keywords,
            task: "summary",
        }, 'summaries', 'summarizationDB');
        console.log(`Embedding generation for summary completed for file ${id}`);

        return { summary, keywords };
    } catch (error) {
        console.error(`Error storing summary for file ${id}:`, error);
        console.error("Error stack:", error.stack);
        throw error;
    }
}