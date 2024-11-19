class ParallelAIManager {
  constructor(poolSize = 4) {
    this.workerPool = new AIWorkerPool(poolSize);
    this.activeStreams = new Map();
    this.streamBuffers = new Map();
  }

  async processParallelRequeries(queries) {
    const streamId = crypto.randomUUID();
    this.streamBuffers.set(streamId, new Map());
    
    const promises = queries.map((query, index) => {
      return this.workerPool.processRequest(query.modelId, query.messages, {
        onStream: (chunk) => this.handleStreamChunk(streamId, index, chunk)
      });
    });

    // Wait for all queries to complete
    await Promise.all(promises);
    
    // Cleanup
    const finalResult = this.combineStreams(streamId);
    this.streamBuffers.delete(streamId);
    return finalResult;
  }

  handleStreamChunk(streamId, modelIndex, chunk) {
    if (!this.streamBuffers.has(streamId)) {
      this.streamBuffers.set(streamId, new Map());
    }
    
    const streamBuffer = this.streamBuffers.get(streamId);
    if (!streamBuffer.has(modelIndex)) {
      streamBuffer.set(modelIndex, '');
    }
    
    streamBuffer.set(modelIndex, streamBuffer.get(modelIndex) + chunk);
    
    // Emit combined progress if needed
    this.emitCombinedProgress(streamId);
  }

  emitCombinedProgress(streamId) {
    const combinedText = this.combineStreams(streamId);
    // Emit progress event with combinedText
    this.onProgress?.(combinedText);
  }

  combineStreams(streamId) {
    const buffer = this.streamBuffers.get(streamId);
    let combined = '';
    
    // Sort by model index to maintain order
    const sortedEntries = Array.from(buffer.entries()).sort(([a], [b]) => a - b);
    
    for (const [_, text] of sortedEntries) {
      combined += text + '\n';
    }
    
    return combined.trim();
  }

  // Example usage for parallel processing with different models
  async processMultiModelQuery(prompt, options = {}) {
    const queries = [
      {
        modelId: 'google/gemma-2-9b-it',
        messages: [{ role: 'user', content: prompt }]
      },
      {
        modelId: 'meta-llama/llama-3.1-405b-instruct',
        messages: [{ role: 'user', content: prompt }]
      },
      // Add more models as needed
    ];

    return this.processParallelRequeries(queries);
  }

  // Example usage for vision queries
  async processVisionQuery(prompt, imageUrl) {
    const visionQueries = [
      {
        modelId: 'meta-llama/llama-3.2-11b-vision-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }]
      }
    ];

    return this.processParallelRequeries(visionQueries);
  }
} 