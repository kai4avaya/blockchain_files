import { VectorDB } from '../../memory/vectorDB/vectordb';
import StreamingAIManager from './streaming_ai_manager';
import embeddingWorker from '../embeddings.js';
import config from '../../configs/config.json';
import prompts from '../../configs/prompts.json';
import { updateStatus } from '../../ui/components/process.js';
import toast from '../../ui/components/toast-alert';

class ContextManager {
  constructor() {
    this.vectorDB = new VectorDB();
    this.aiManager = new StreamingAIManager(config);
    this.providerOrder = ['OPEN', 'GEMINI', 'GROQ', 'CEREBRAS'];
    this.currentProviderIndex = 0;
  }

  async getNextProvider() {
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providerOrder.length;
    return this.providerOrder[this.currentProviderIndex];
  }

  async getModelForProvider(provider) {
    const models = config.apiConfig.models[provider.toLowerCase()];
    const modelKey = Object.keys(models)[0];
    return `${provider.toLowerCase()}/${modelKey}`;
  }

  async getContextualResponse(userPrompt, options = { limit: 5 }) {
    let attempts = 0;
    const maxAttempts = this.providerOrder.length;

    // Check for window.fileMetadata
    if (!window.fileMetadata) {
      toast.show(
        'File metadata not available. Searching across all files.',
        'warning'
      );
    }

    while (attempts < maxAttempts) {
      try {
        const currentProvider = this.providerOrder[this.currentProviderIndex];
        const prevStatus = attempts > 0 ? `${this.providerOrder[this.currentProviderIndex - 1]} failed. ` : '';
        updateStatus(`${prevStatus}Attempting with ${currentProvider} provider...`);
        
        updateStatus('Generating embedding for query...');
        const [queryEmbedding] = await embeddingWorker.generateEmbeddings(
          [userPrompt],
          'query'
        );

        updateStatus('Searching vector database...');
        const results = await this.vectorDB.query(queryEmbedding, {
          ...options,
          minResults: 3 // Minimum number of results before expanding search
        });

        updateStatus('Processing search results...');
        const contextString = this.formatContextForPrompt(results);
        
        updateStatus('Creating AI prompt...');
        const systemPrompt = this.createSystemPrompt(contextString);

        const modelId = await this.getModelForProvider(currentProvider);
        updateStatus('Generating AI response...');
        const response = await this.aiManager.streamCompletion(
          modelId,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          options
        );

        updateStatus('Done');
        return response;
      } catch (error) {
        console.error(`Error with provider ${this.providerOrder[this.currentProviderIndex]}:`, error);
        toast.show(
          `${this.providerOrder[this.currentProviderIndex]} provider failed. Trying next provider...`,
          'error'
        );
        await this.getNextProvider();
        attempts++;

        if (attempts >= maxAttempts) {
          updateStatus('All providers failed. Please try again later.');
          toast.show('All AI providers are currently unavailable', 'error');
          throw new Error('All AI providers are currently unavailable');
        }
      }
    }
  }

   formatContextForPrompt(results) {
    return results.map(result => ({
      content: result.object.text,
      fileId: result.fileId,
      similarity: result.similarity
    }));
  }

   createSystemPrompt(context) {
    const { base, context_prefix, instructions } = prompts.contextual_response.system;
    
    return `${base}

${context_prefix}
${context.map(doc => `[//]: # (source:${doc.fileId})
${doc.content}`).join('\n\n')}

Instructions:
${instructions.map((instruction, i) => `${i + 1}. ${instruction}`).join('\n')}`;
  }

  stopResponse(streamId) {
    this.aiManager.stopStream(streamId);
  }
}

export default new ContextManager();