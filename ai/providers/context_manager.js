// mayne call all at once

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
    this.providerOrder = config.providerOrder;
    this.currentProviderIndex = 0;
    this.config = config;
  }

  async getNextProvider() {
    console.log('Current providers:', this.providerOrder);
    console.log('Current index:', this.currentProviderIndex);
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providerOrder.length;
    const nextProvider = this.providerOrder[this.currentProviderIndex];
    console.log('Next provider:', nextProvider);
    return nextProvider;
  }

  async getModelForProvider(provider) {
    const providerKey = provider.toLowerCase();
    if (!this.config.apiConfig.models[providerKey]) {
      throw new Error(`No models configured for provider: ${provider}`);
    }
    
    const models = this.config.apiConfig.models[providerKey];
    const modelKey = Object.keys(models)[0];
    if (!modelKey) {
      throw new Error(`No models available for provider: ${provider}`);
    }
    
    return `${providerKey}/${modelKey}`;
  }

  async checkProviderHealth(provider) {
    try {
      const response = await fetch(`${this.aiManager.workerEndpoint}/health`);
      if (!response.ok) return false;
      
      const health = await response.json();
      switch(provider) {
        case 'OPEN': return health.environment.hasOpenRouterKey;
        case 'GEMINI': return health.environment.hasGeminiKey;
        case 'GROQ': return health.environment.hasGroqKey;
        case 'CEREBRAS': return health.environment.hasCerebrasKey;
        default: return false;
      }
    } catch {
      return false;
    }
  }

  async getContextualResponse(userPrompt, options = { limit: 5 }) {
    let attempts = 0;
    const maxAttempts = this.providerOrder.length;

    while (attempts < maxAttempts) {
      const currentProvider = this.providerOrder[this.currentProviderIndex];
      
      if (!await this.checkProviderHealth(currentProvider)) {
        console.warn(`Provider ${currentProvider} is not available`);
        await this.getNextProvider();
        attempts++;
        continue;
      }

      try {
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

        updateStatus('Generating AI response...');
        const modelId = await this.getModelForProvider(currentProvider);
        
        let hasInitialResponse = false;
        const timeoutId = setTimeout(() => {
          if (!hasInitialResponse) {
            this.aiManager.stopAllStreams();
            throw new Error(`No response after ${this.config.apiConfig.timeout/1000}s from ${currentProvider}`);
          }
        }, this.config.apiConfig.timeout);

        try {
          const response = await this.aiManager.streamCompletion(
            modelId,
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            options
          );

          hasInitialResponse = true;
          clearTimeout(timeoutId);
          updateStatus('Done');
          return response;

        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }

      } catch (error) {
        console.error(`Error with provider ${currentProvider}:`, error);
        toast.show(`Provider ${currentProvider} failed: ${error.message}`, 'error');
        await this.getNextProvider();
        attempts++;
      }
    }

    updateStatus('All providers failed');
    toast.show('All available providers failed to respond', 'error');
    throw new Error('All providers failed to respond');
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