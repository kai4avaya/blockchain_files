import { NODE_ENV, LUMI_ENDPOINT, LOCAL_ENDPOINT } from '../../configs/env_configs.js';

class StreamingAIManager {
    constructor(config) {
      this.config = config;
      this.activeStreams = new Map();
      this.workerEndpoint = NODE_ENV === 'development' ? LOCAL_ENDPOINT : LUMI_ENDPOINT;
    }
    async streamCompletion(modelId, messages, options = {}) {
        const controller = new AbortController();
        const streamId = crypto.randomUUID();
        
        const [provider, ...modelParts] = modelId.split('/');
        const providerKey = provider.toLowerCase();
        const modelKey = modelParts.join('/'); // Keep the full model name including slashes
        
        try {
          if (!this.config.apiConfig.models[providerKey]) {
            throw new Error(`Invalid provider configuration: ${provider}`);
          }
          
          const modelConfig = this.config.apiConfig.models[providerKey][modelKey];
          if (!modelConfig) {
            throw new Error(`Invalid model configuration for: ${modelId}`);
          }
      
          this.activeStreams.set(streamId, controller);
      
          // Format request body based on provider
          let requestBody = provider.toUpperCase() === 'GEMINI' ? {
            contents: messages.map(msg => ({
              role: msg.role === 'system' ? 'user' : msg.role,
              parts: [{ text: msg.content }]
            }))
          } : {
            messages,
            ...modelConfig.parameters  // Use all parameters from config
          };
      
          const response = await fetch(this.workerEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Provider': provider.toUpperCase(),
              'X-Endpoint': modelConfig.endpoint,
              ...modelConfig.headers
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorText;
          } catch {
            errorMessage = errorText;
          }
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
        }
  
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');
  
        return {
          streamId,
          async* [Symbol.asyncIterator]() {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
  
                const chunk = new TextDecoder().decode(value);
                const lines = chunk
                  .split('\n')
                  .filter(line => line.trim() !== '');
  
                for (const line of lines) {
                  if (line.includes('[DONE]')) return;
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(5));
                      if (provider.toUpperCase() === 'GEMINI') {
                        yield data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                      } else {
                        yield data.choices?.[0]?.delta?.content || '';
                      }
                    } catch (e) {
                      console.warn('Error parsing streaming response:', e);
                    }
                  }
                }
              }
            } catch (error) {
              console.warn('Stream interrupted:', error);
            } finally {
              try {
                reader.releaseLock();
                if (this.activeStreams.has(streamId)) {
                  this.activeStreams.delete(streamId);
                }
              } catch (e) {
                console.warn('Error cleaning up stream:', e);
              }
            }
          }
        };
      } catch (error) {
        this.activeStreams.delete(streamId);
        throw error;
      }
    }
  
    stopStream(streamId) {
      const controller = this.activeStreams.get(streamId);
      if (controller) {
        controller.abort();
        this.activeStreams.delete(streamId);
      }
    }
  
    stopAllStreams() {
      for (const [streamId, controller] of this.activeStreams.entries()) {
        controller.abort();
        this.activeStreams.delete(streamId);
      }
    }
  }
  
  export default StreamingAIManager;