const AI_MODELS = {
  TEXT_MODELS: [
    { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', type: 'text' },
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', type: 'text' },
    { id: 'liquid/lfm-40b', name: 'LFM 40B', type: 'text' },
  ],
  VISION_MODELS: [
    { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama Vision 11B', type: 'vision' },
    { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama Vision 90B', type: 'vision' },
    { id: 'nousresearch/hermes-3-llama-3.1-405b', name: 'Hermes 3', type: 'vision' }

  ]
};

function ModelSelector({ onModelSelect, defaultModel }) {
  // Add your UI components for model selection
}
