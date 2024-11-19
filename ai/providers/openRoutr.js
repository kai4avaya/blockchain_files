class OpenRouterAPI {
  constructor(apiKey, siteUrl, siteName) {
    this.apiKey = apiKey;
    this.siteUrl = siteUrl;
    this.siteName = siteName;
    this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  async makeRequest(model, messages, hasImage = false) {
    // Validate model selection based on content type
    if (hasImage && !model.includes('vision')) {
      model = 'meta-llama/llama-3.2-11b-vision-instruct'; // Default vision model
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteName,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true // Enable streaming
      })
    });

    return response;
  }
}
