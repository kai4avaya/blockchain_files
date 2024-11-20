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
      
      const [provider] = modelId.split('/');
      const modelConfig = this.config.apiConfig.models[provider.toLowerCase()][modelId.split('/').slice(1).join('/')];
      
      this.activeStreams.set(streamId, controller);
  
      try {
        const response = await fetch(this.workerEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Provider': provider.toUpperCase(),
            'X-Endpoint': modelConfig.endpoint,
          },
          body: JSON.stringify({
            model: modelId,
            messages,
            stream: true,
            ...options
          }),
          signal: controller.signal
        });
  
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
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
                    const data = JSON.parse(line.slice(5));
                    yield data.choices[0]?.delta?.content || '';
                  }
                }
              }
            } finally {
              reader.releaseLock();
              this.activeStreams.delete(streamId);
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
      for (const controller of this.activeStreams.values()) {
        controller.abort();
      }
      this.activeStreams.clear();
    }
  }
  
  export default StreamingAIManager;