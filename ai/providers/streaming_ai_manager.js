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
        const modelKey = modelParts.join('/');
        
        try {
          const modelConfig = this.config.apiConfig.models[providerKey]?.[modelKey];
          if (!modelConfig) {
            throw new Error(`Invalid model configuration for: ${modelId}`);
          }
      
          this.activeStreams.set(streamId, controller);
      
          // Use provider-specific configuration from config.json
          const requestBody = provider.toUpperCase() === 'GEMINI' ? {
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
              ...modelConfig.headers  // Use headers from config
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
                let buffer = '';
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = new TextDecoder().decode(value);
                    buffer += chunk;

                    // Handle different response formats
                    if (provider.toUpperCase() === 'GEMINI') {
                        try {
                            const data = JSON.parse(buffer);
                            // Check for error response
                            if (data.error) {
                                throw new Error(data.error.message || 'Gemini API error');
                            }
                            
                            // Extract text from Gemini response structure
                            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (text) {
                                // Simulate streaming for better UX
                                const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
                                for (const sentence of sentences) {
                                    // Split long sentences into smaller chunks
                                    const words = sentence.trim().split(' ');
                                    const chunkSize = 5; // Adjust for smoother streaming
                                    
                                    for (let i = 0; i < words.length; i += chunkSize) {
                                        const chunk = words.slice(i, i + chunkSize).join(' ');
                                        yield chunk + (i + chunkSize >= words.length ? ' ' : '');
                                        // Small delay between chunks
                                        await new Promise(resolve => setTimeout(resolve, 30));
                                    }
                                }
                                break; // Exit after processing complete response
                            }
                        } catch (e) {
                            if (done) {
                                console.warn('Failed to parse Gemini response:', e);
                                break;
                            }
                            // Continue accumulating if not complete JSON
                            continue;
                        }
                    } else {
                        // Original streaming logic for other providers
                        const parts = buffer.split('data: ');
                        buffer = parts.pop() || '';

                        for (const part of parts) {
                            if (part.trim() === '' || part.includes('[DONE]')) continue;
                            
                            try {
                                const data = JSON.parse(part);
                                const content = data.choices?.[0]?.delta?.content;
                                if (content) yield content;
                            } catch (e) {
                                console.warn('Error parsing chunk:', e);
                            }
                        }
                    }
                }
            } finally {
                reader?.releaseLock();
                this.activeStreams?.delete(streamId);
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