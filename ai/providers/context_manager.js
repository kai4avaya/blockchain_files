// mayne call all at once

import { VectorDB } from '../../memory/vectorDB/vectordb';
import StreamingAIManager from './streaming_ai_manager';
import embeddingWorker from '../embeddings.js';
import config from '../../configs/config.json';
import prompts from '../../configs/prompts.json';
import { updateStatus } from '../../ui/components/process.js';
import toast from '../../ui/components/toast-alert';
import directStreamingService from './direct_streaming_service.js';

const tokenReducerWorker = new Worker(new URL('../../workers/token_reducer_worker.js', import.meta.url), { type: 'module' });

class ContextManager {
  constructor() {
    this.vectorDB = new VectorDB();
    this.aiManager = new StreamingAIManager(config);
    this.providerOrder = config.providerOrder;
    this.currentProviderIndex = 0;
    this.config = config;
  }

  async getNextProvider() {
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providerOrder.length;
    const nextProvider = this.providerOrder[this.currentProviderIndex];
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
        case 'OPEN': return health.environment.OPENROUTER_KEY;
        case 'GEMINI': return health.environment.GEMINI_KEY;
        case 'GROQ': return health.environment.GROQ_KEY;
        case 'CEREBRAS': return health.environment.CEREBRAS_KEY;
        default: return false;
      }
    } catch {
      return false;
    }
  }

  async getContextualResponse(userPrompt, options = { limit: config.vector_docs_query_limit }) {
    const customEndpoint = localStorage.getItem('aiProvider');
    const customApiKey = localStorage.getItem('apiKey');
    
    if (customEndpoint && customApiKey) {
      try {
        updateStatus('Using custom API endpoint...');
        
        const [queryEmbedding] = await embeddingWorker.generateEmbeddings([userPrompt], 'query');
        const results = await this.vectorDB.query(queryEmbedding, { ...options, minResults: 3 });
        
        if (!results?.length) throw new Error('No relevant context found');
        
        const reducedContext = await this.formatContextForPrompt(results);
        const systemPrompt = this.createSystemPrompt(reducedContext);
        
        updateStatus('Generating AI response...', true);
        
        return await directStreamingService.streamCompletion(
          customEndpoint,
          customApiKey,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          options
        );
      } catch (error) {
        console.error('Custom API failed:', error);
        toast.show('Custom API failed, falling back to default providers', 'warning');
      }
    }
    
    let attempts = 0;
    let healthCheckFailures = 0;
    const maxAttempts = this.providerOrder.length;
    const maxHealthCheckFailures = 10;

    while (attempts < maxAttempts) {
      const currentProvider = this.providerOrder[this.currentProviderIndex];
      
      if (!await this.checkProviderHealth(currentProvider)) {
        console.warn(`Provider ${currentProvider} is not available`);
        healthCheckFailures++;
        
        if (healthCheckFailures >= maxHealthCheckFailures) {
          updateStatus('Health check failures exceeded limit');
          toast.show('Unable to connect to AI providers after multiple attempts', 'error');
          throw new Error('Maximum health check failures reached');
        }

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
          minResults: 3
        });

        if (!results || !Array.isArray(results) || results.length === 0) {
          throw new Error('No relevant context found');
        }

        // Format results before token reduction
        const formattedResults = results.map(result => ({
          content: result.object?.text || '',
          fileId: result.fileId || 'unknown',
          fileName: result.object?.fileName || 'unknown',
          isCode: result.object?.fileType?.toLowerCase().includes('js') || 
                  result.object?.fileType?.toLowerCase().includes('ts') ||
                  result.object?.fileName?.match(/\.(js|ts|jsx|tsx|json|py|rb|java|cpp|cs)$/i),
          fileType: result.object?.fileType || 'text',
          similarity: result.similarity
        })).filter(doc => doc.content && doc.content.length > 0);

        if (formattedResults.length === 0) {
          throw new Error('No valid content in search results');
        }

        // Force token reduction before creating prompt
        updateStatus('Processing and reducing context...');
        const reducedContext = await new Promise((resolve, reject) => {
          tokenReducerWorker.onmessage = (e) => {
            if (e.data.success) {
              if (e.data.reduction) {
                toast.show(`Reduced context to ${e.data.reduction.finalTokens} tokens`, 'info');
              }
              resolve(e.data.documents);
            } else {
              reject(new Error(e.data.error));
            }
          };

          tokenReducerWorker.postMessage({
            documents: formattedResults,
            maxTokens: Math.floor(this.config.apiConfig.max_input_tokens * 0.75) // Leave room for prompt
          });
        });

        if (!reducedContext || !Array.isArray(reducedContext) || reducedContext.length === 0) {
          throw new Error('Token reduction failed to produce valid context');
        }

        updateStatus('Creating AI prompt...');
        const systemPrompt = this.createSystemPrompt(reducedContext);

        updateStatus('Generating AI response...', true);
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

  async formatContextForPrompt(results) {
    if (!Array.isArray(results)) {
        console.warn('Expected results to be an array, got:', typeof results);
        toast.show('Invalid search results format', 'warning');
        return [];
    }

    const formatted = results.map(result => ({
        content: result.object.text,
        fileId: result.fileId,
        fileName: result.object.fileName,
        isCode: result.object.fileType?.toLowerCase().includes('js') || 
                result.object.fileType?.toLowerCase().includes('ts') ||
                result.object.fileName?.match(/\.(js|ts|jsx|tsx|json|py|rb|java|cpp|cs)$/i),
        fileType: result.object.fileType || 'text',
        similarity: result.similarity
    }));

    // Calculate rough token estimate
    const estimatedTokens = formatted.reduce((sum, doc) => 
        sum + (doc.content?.length || 0) / 4, 0);

    // Only attempt reduction if we're likely over the limit
    if (estimatedTokens > this.config.apiConfig.max_input_tokens) {
        updateStatus('Reducing context size to fit token limit...');
        try {
            const reducedDocs = await new Promise((resolve, reject) => {
                tokenReducerWorker.onmessage = (e) => {
                    if (e.data.success) {
                        const docs = Array.isArray(e.data.documents) ? e.data.documents : [];
                        if (docs.length < formatted.length) {
                            toast.show(`Reduced context from ${formatted.length} to ${docs.length} documents`, 'info');
                        }
                        resolve(docs);
                    } else {
                        reject(new Error(e.data.error));
                    }
                };

                tokenReducerWorker.postMessage({
                    documents: formatted,
                    maxTokens: this.config.apiConfig.max_input_tokens
                });
            });

            updateStatus('Context reduction complete');
            return reducedDocs;

        } catch (error) {
            console.warn('Token reduction failed:', error);
            toast.show('Token reduction failed, using truncated context', 'warning');
            updateStatus('Using truncated context...');
            
            // Simple truncation as fallback
            return formatted.map(doc => ({
                ...doc,
                content: doc.content.slice(0, Math.floor(this.config.apiConfig.max_input_tokens / formatted.length * 4))
            }));
        }
    }

    return formatted;
  }

  createSystemPrompt(context) {
    const { base, context_prefix, instructions, no_context_response } = prompts.contextual_response.system;
    
    // Ensure context is an array and has content
    const contextArray = Array.isArray(context) ? context : [];
    
    // If no context is available, return prompt that will trigger the no-context response
    if (contextArray.length === 0) {
        return `${base}

${context_prefix}

No relevant source documents found.

Instructions:
${instructions.map((instruction, i) => `${i + 1}. ${instruction}`).join('\n')}

Note: When no source documents are provided, respond with:
${no_context_response}`;
    }
    
    const contextSection = contextArray.map(doc => {
        if (!doc || typeof doc !== 'object') {
            console.warn('Invalid document in context:', doc);
            return '';
        }

        const sourceComment = `[//]: # (source:${doc.fileId || 'unknown'} - ${doc.fileName || 'unknown'})`;
        if (doc.isCode) {
            return `${sourceComment}
\`\`\`${doc.fileType || 'text'}:${doc.fileName || 'unknown'}
${doc.content || ''}
\`\`\``;
        } else {
            return `${sourceComment}
${doc.content || ''}`;
        }
    }).filter(Boolean).join('\n\n');
    
    const finalPrompt = `${base}

${context_prefix}
${contextSection}

Instructions:
${instructions.map((instruction, i) => `${i + 1}. ${instruction}`).join('\n')}`;

    return finalPrompt;
  }

  stopResponse(streamId) {
    this.aiManager.stopStream(streamId);
  }
}

export default new ContextManager();