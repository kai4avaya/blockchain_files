// Initialize the manager
const aiManager = new ParallelAIManager();

// Example 1: Process a text query with multiple models in parallel
aiManager.onProgress = (combinedText) => {
  console.log('Progress:', combinedText);
};

const result = await aiManager.processMultiModelQuery(
  "What are the implications of quantum computing on cybersecurity?"
);

// Example 2: Process a vision query
const visionResult = await aiManager.processVisionQuery(
  "What's in this image?",
  "https://example.com/image.jpg"
);

// Example 3: Custom parallel queries
const customQueries = [
  {
    modelId: 'google/gemma-2-9b-it',
    messages: [{ role: 'user', content: 'Analyze this from a technical perspective.' }]
  },
  {
    modelId: 'meta-llama/llama-3.1-405b-instruct',
    messages: [{ role: 'user', content: 'Analyze this from a business perspective.' }]
  },
  {
    modelId: 'liquid/lfm-40b',
    messages: [{ role: 'user', content: 'Analyze this from a social perspective.' }]
  }
];

const multiPerspectiveAnalysis = await aiManager.processParallelRequeries(customQueries); 