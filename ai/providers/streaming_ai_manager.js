import { NODE_ENV } from '../../configs/env_configs.js';

class StreamingAIManager {
    constructor(config) {
      this.config = config;
      this.activeStreams = new Map();
      this.isDevelopment = NODE_ENV === 'development';
    }
  
    getEndpoint() {
      return this.isDevelopment ? 
        this.config.apiConfig.endpoints.development : 
        this.config.apiConfig.endpoints.production;
    }
  
    async streamCompletion(modelId, messages, options = {}) {
      const controller = new AbortController();
      const streamId = crypto.randomUUID();
      
      const [provider, ...modelPath] = modelId.split('/');
      const modelConfig = this.config.apiConfig.models[provider][modelPath.join('/')];
      
      this.activeStreams.set(streamId, controller);
  
      try {
        const response = await fetch(this.getEndpoint(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Provider': modelConfig.provider,
            'X-Endpoint': modelConfig.endpoint,
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
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
          throw new Error(`API request failed: ${response.statusText}`);
        }
  
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
  
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
  
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
  
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
  
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                if (content && options.onToken) {
                  options.onToken(content);
                }
              } catch (e) {
                console.error('Error parsing streaming response:', e);
              }
            }
          }
        }
      } finally {
        this.activeStreams.delete(streamId);
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