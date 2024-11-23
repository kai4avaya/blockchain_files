class DirectStreamingService {
  constructor() {
    this.activeStreams = new Map();
  }

  async detectApiType(endpoint, apiKey, testMessage) {
    try {
      // Test request to detect API structure
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: testMessage || 'Hello'
          }]
        })
      });

      if (!response.ok) return 'unknown';

      const data = await response.json();
      
      // Check response structure
      if (data.candidates?.[0]?.content?.parts) {
        return 'gemini';
      } else if (data.choices?.[0]?.message || data.choices?.[0]?.delta) {
        return 'openai';
      }
      
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async streamCompletion(endpoint, apiKey, messages, options = {}) {
    const controller = new AbortController();
    const streamId = crypto.randomUUID();

    try {
      const apiType = await this.detectApiType(endpoint, apiKey);
      this.activeStreams.set(streamId, controller);

      const requestBody = apiType === 'gemini' ? {
        contents: messages.map(msg => ({
          role: msg.role === 'system' ? 'user' : msg.role,
          parts: [{ text: msg.content }]
        }))
      } : {
        messages,
        stream: true,
        ...options
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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

              if (apiType === 'gemini') {
                try {
                  const data = JSON.parse(buffer);
                  if (data.error) {
                    throw new Error(data.error.message || 'Gemini API error');
                  }
                  
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    yield text;
                    break;
                  }
                } catch (e) {
                  if (done) break;
                  continue;
                }
              } else {
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
}

export default new DirectStreamingService(); 