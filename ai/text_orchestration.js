import {textProcessorWorker} from './processText'
import * as vectorDBGateway from '../memory/vectorDB/vectorDbGateway'
import {summarizeText} from './summary'

export async function orchestrateTextProcessing(file, id) {
    try {

        // Process text content
        const content = file.type === 'application/pdf' ? await file.arrayBuffer() : await file.text();

        // Use TextProcessorWorker to process the text
        const processedText = await textProcessorWorker.processText(content, file.type, id);

        // Start summarization process asynchronously
        summarizeText(processedText, id, file.name);

        // Start embedding generation asynchronously
        try {
            const _ = await vectorDBGateway.quickStart({
                text: processedText,
                fileId: id,
                fileName: file.name,
                fileType: file.type
            });

            // Update file metadata with VectorDB key
            console.log(`Embeddings added to file ${id}`);
        } catch (embeddingError) {
            console.error(`Error generating embeddings for file ${id}:`, embeddingError);
        }

        console.log(`File ${id} processed successfully`);
    } catch (error) {
        console.error(`Error processing file ${id}:`, error);
        throw error;  // Re-throw the error for the caller to handle
    }
}