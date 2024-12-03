import { VectorDB } from '../../memory/vectorDB/vectordb';
import embeddingWorker from '../embeddings.js';
import config from '../../configs/config.json';
import toast from '../../ui/components/toast-alert';
import { NODE_ENV, MERMAID_API, MERMAID_API_LOCAL } from '../../configs/env_configs';

class DiagramContextManager {
    constructor() {
        this.vectorDB = new VectorDB();
        this.config = config;
        this.endpoint = NODE_ENV === 'development' ? MERMAID_API_LOCAL : MERMAID_API;
        this.textLimit = config.diagram_text_doc_limit || 200; // Default to 200 if not set
    }

    async getContextualDiagramResponse(userPrompt, options = { limit: config.vector_docs_query_limit }) {
        try {
            // Generate embedding for the query
            const [queryEmbedding] = await embeddingWorker.generateEmbeddings([userPrompt], 'query');
            
            // Search vector database
            const results = await this.vectorDB.query(queryEmbedding, {
                ...options,
                minResults: 3
            });

            // Format results with character limit
            const formattedResults = results
                .map(result => ({
                    content: (result.object?.text || '').slice(0, this.textLimit), // Apply character limit
                    fileId: result.fileId || 'unknown',
                    fileName: result.object?.fileName || 'unknown',
                    isCode: result.object?.fileType?.toLowerCase().includes('js') || 
                            result.object?.fileType?.toLowerCase().includes('ts') ||
                            result.object?.fileName?.match(/\.(js|ts|jsx|tsx|json|py|rb|java|cpp|cs)$/i),
                    fileType: result.object?.fileType || 'text',
                    similarity: result.similarity
                }))
                .filter(doc => doc.content && doc.content.length > 0);

            // Create context text
            let contextText = '';
            if (formattedResults.length > 0) {
                contextText = formattedResults
                    .map(doc => {
                        const header = `File: ${doc.fileName} (${doc.fileType})`;
                        const content = doc.content.length === this.textLimit ? 
                            `${doc.content}...` : // Add ellipsis if truncated
                            doc.content;
                        return `${header}\n${content}\n`;
                    })
                    .join('\n---\n');
            }

            // Return both the context and endpoint
            return {
                contextText,
                endpoint: this.endpoint
            };

        } catch (error) {
            console.error('Error getting diagram context:', error);
            toast.show('Error getting context for diagram', 'error');
            // Return minimal context but still provide endpoint
            return {
                contextText: '',
                endpoint: this.endpoint
            };
        }
    }
}

export default new DiagramContextManager();