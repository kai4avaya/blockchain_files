// text_orchestration.js

import textProcessorWorker from './processText'
import * as vectorDBGateway from '../memory/vectorDB/vectorDbGateway'
import { summarizeText } from './summary'
import config from "../configs/config.json"

export async function orchestrateTextProcessing(content, file, id) {
    try {
      // Initialize vector DB if not already done
      await vectorDBGateway.initiate();
      
      // Process text into chunks
      const { chunks, text } = await textProcessorWorker.processText(
        content, 
        file.type, 
        id
      );
  
      // Process embeddings
      await embeddingResult(text, chunks, file, id);
      
      // Process summary
      await summarizeTextAndStore(text, file, id);
    } catch (error) {
      console.error(`Error in orchestration for file ${id}:`, error);
      throw error;
    }
  }

  


// Add error handling for vectorization
async function embeddingResult(content, chunks, file, id) {
  try {
    if (!chunks || chunks.length === 0) {
      console.error('No chunks to process for embeddings');
      return;
    }

    const embeddingResult = await vectorDBGateway.quickStart({
      text: content,
      processedChunks: chunks,
      fileId: id,
      fileName: file.name,
      fileType: file.type,
      task: "embeddings",
    });

    return embeddingResult;
  } catch (error) {
    console.error(`Embedding generation failed for file ${id}:`, error);
    throw error;
  }
}


// async function summarizeTextAndStore(content, file, id) {
//     try {
//         console.log(`Starting summarization for file ${id}`);
//         const { summary, keywords } = await summarizeText(content, id, file.name);
//         console.log(`Summarization completed for file ${id}`);
//         console.log("Summary length:", summary.length);
//         console.log("Number of keywords:", keywords.length);

//         console.log(`Starting embedding generation for summary of file ${id}`);
//         await vectorDBGateway.quickStart({
//             text: content,
//             processedChunks: [summary],
//             fileId: id,
//             fileName: file.name,
//             fileType: file.type,
//             summary: summary,
//             keywords: keywords,
//             task: "summary",
//         }, 'summaries', config.dbName);
//         console.log(`Embedding generation for summary completed for file ${id}`);

//         return { summary, keywords };
//     } catch (error) {
//         console.error(`Error storing summary for file ${id}:`, error);
//         console.error("Error stack:", error.stack);
//         throw error;
//     }
// }


async function summarizeTextAndStore(content, file, id) {
    try {
        console.log(`Starting summarization for file ${id}`);
        const { summary, keywords } = await summarizeText(content, id, file.name);
        console.log(`Summarization completed for file ${id}`);
        console.log("Summary length:", summary.length);
        console.log("Number of keywords:", keywords.length);

        // Create summary data object first
        const summaryData = {
            fileId: id,
            summary,
            keywords,
            fileName: file.name,
            fileType: file.type,
            timestamp: Date.now()
        };

        // Use addEmbeddingDirectly to handle both embedding generation and storage
        const enrichedSummary = await vectorDBGateway.addEmbeddingDirectly(
            summary,  // Pass the summary text to embed
            summaryData
        );

        console.log(`Summary and embedding stored for file ${id}`);
        return enrichedSummary;
    } catch (error) {
        console.error(`Error storing summary for file ${id}:`, error);
        console.error("Error stack:", error.stack);
        throw error;
    }
}
