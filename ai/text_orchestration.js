// text_orchestration.js

import textProcessorWorker from './processText'
import * as vectorDBGateway from '../memory/vectorDB/vectorDbGateway'
import { summarizeText } from './summary'
import {  startPersistentStatus, completePersistentStatus, startMasterStatus, completeMasterStatus } from '../ui/components/process'
// import config from "../configs/config.json"

export async function orchestrateTextProcessing(content, file, id) {
    try {
      // Start the master status that will persist
      startMasterStatus("Processing document...");
      
      // Initialize vector DB if not already done
      const dbStatus = "Initializing database...";
      startPersistentStatus(dbStatus);
      await vectorDBGateway.initiate();
      completePersistentStatus(dbStatus + " ✓");
      
      // Process text into chunks
      const chunkStatus = "Processing text into chunks...";
      startPersistentStatus(chunkStatus);
      const { chunks, positionedChunks, text } = await textProcessorWorker.processText(
        content, 
        file.type, 
        id
      );
      completePersistentStatus(chunkStatus + " ✓");
  
      // Process embeddings
      const embedStatus = "Generating embeddings...";
      startPersistentStatus(embedStatus);
      await embeddingResult(text, chunks, positionedChunks, file, id);
      completePersistentStatus(embedStatus + " ✓");
      
      // Process summary
      const summaryStatus = "Creating summary...";
      startPersistentStatus(summaryStatus, 5000); 
      try {
          const textForSummary = text.split(/\s+/).slice(0, 1000).join(' ');
          await summarizeTextAndStore(textForSummary, file, id);
          completePersistentStatus(summaryStatus + " ✓");
      } catch (summaryError) {
          console.error("Summary generation failed:", summaryError);
          completePersistentStatus("Summary failed ⚠");
      }

      // Finally, complete the master status
      completeMasterStatus("Document processing complete");
    } catch (error) {
      completeMasterStatus("Processing failed");
      console.error(`Error in orchestration for file ${id}:`, error);
      throw error;
    }
  }

  


// Add error handling for vectorization
async function embeddingResult(content, chunks, positionedChunks, file, id) {
  try {
    if (!chunks || chunks.length === 0) {
      console.error('No chunks to process for embeddings');
      return;
    }

    const embeddingResult = await vectorDBGateway.quickStart({
      text: content,
      processedChunks: chunks,
      positionedChunks: positionedChunks,
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
//         const { summary, keywords } = await summarizeText(content, id, file.name);
   

//         // Create summary data object first
//         const summaryData = {
//             fileId: id,
//             summary,
//             keywords,
//             fileName: file.name,
//             fileType: file.type,
//             timestamp: Date.now()
//         };

//         // Use addEmbeddingDirectly to handle both embedding generation and storage
//         const enrichedSummary = await vectorDBGateway.addEmbeddingDirectly(
//             summary,  // Pass the summary text to embed
//             summaryData
//         );

//         return enrichedSummary;
//     } catch (error) {
//         console.error(`Error storing summary for file ${id}:`, error);
//         console.error("Error stack:", error.stack);
//         throw error;
//     }
// }



async function summarizeTextAndStore(content, file, id) {
  try {
      const { summary, keywords } = await summarizeText(content, id, file.name);
      
      const summaryData = {
          fileId: id,
          summary,
          keywords,
          fileName: file.name,
          fileType: file.type,
          timestamp: Date.now()
      };

      await vectorDBGateway.addEmbeddingDirectly(
          summary,
          summaryData
      );

      return summaryData;
  } catch (error) {
      console.error(`Error storing summary for file ${id}:`, error);
      console.error("Error stack:", error.stack);
      throw error;
  }
}
