// Individual worker that handles API calls and streaming
self.onmessage = async function(e) {
    const { modelId, messages, options } = e.data;
    const port = e.ports[0];
  
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${self.OPENROUTER_API_KEY}`,
          'HTTP-Referer': self.SITE_URL,
          'X-Title': self.SITE_NAME,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          stream: true
        })
      });
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Process all complete lines
        buffer = lines.pop() || ''; // Keep the incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.includes('[DONE]')) continue;
          
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            if (data.choices?.[0]?.delta?.content) {
              port.postMessage({
                type: 'stream',
                chunk: data.choices[0].delta.content
              });
            }
          } catch (err) {
            console.error('Error parsing stream:', err);
          }
        }
      }
  
      port.postMessage({ type: 'complete' });
    } catch (error) {
      port.postMessage({ type: 'error', error: error.message });
    }
  };