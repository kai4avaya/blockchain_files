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
              let jsonBuffer = '';
              let inJson = false;
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                // console.log(`[${provider.toU/pperCase()}] Raw chunk:`, chunk);
                buffer += chunk;

                // Split by data: prefix
                const parts = buffer.split('data: ');
                buffer = parts.pop() || ''; // Keep the last part in buffer

                for (const part of parts) {
                  if (part.trim() === '') continue;
                  if (part.includes('[DONE]')) {
                    return;
                  }
                  
                  try {
                    // Try to parse as complete JSON
                    const data = JSON.parse(part);
                    // console.log(`[${provider.toUpperCase()}] Parsed data:`, data);
                    
                    if (provider.toUpperCase() === 'GEMINI') {
                      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                      if (text) {
                        yield text;
                      }
                    } else {
                      const content = data.choices?.[0]?.delta?.content;
                      if (content) {
                        yield content;
                      }
                    }
                  } catch (e) {
                    // If parsing fails, accumulate until we have valid JSON
                    if (part.includes('{')) {
                      jsonBuffer = part;
                      inJson = true;
                    } else if (inJson) {
                      jsonBuffer += part;
                      if (part.includes('}')) {
                        inJson = false;
                        try {
                          const data = JSON.parse(jsonBuffer);
                          if (provider.toUpperCase() === 'GEMINI') {
                            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (text) yield text;
                          } else {
                            const content = data.choices?.[0]?.delta?.content;
                            if (content) yield content;
                          }
                        } catch (e) {
                          if (!jsonBuffer.includes('{') || !jsonBuffer.includes('}')) {
                            console.warn(`[${provider.toUpperCase()}] Error parsing complete JSON:`, e);
                          }
                        }
                        jsonBuffer = '';
                      }
                    }
                  }
                }
              }
            } finally {
              if (reader) {
                reader.releaseLock();
              }
              if (this.activeStreams?.has(streamId)) {
                this.activeStreams.delete(streamId);
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