self.onmessage = async function(e) {
  const { taskId, text, fileId } = e.data;
  
  console.log('Text stats worker received:', { 
    fileId, 
    textLength: text?.length,
    textType: typeof text 
  });
  
  try {
    // Ensure we have a string to work with
    if (typeof text !== 'string') {
      throw new Error(`Expected string but got ${typeof text}`);
    }

    const stats = {
      fileId,
      lastUpdated: Date.now(),
      textLength: text.length,
      paragraphStats: analyzeParagraphs(text),
      sentenceTypes: analyzeSentenceTypes(text),
      readabilityScores: computeReadabilityScores(text),
      wordStats: analyzeWords(text)
    };

    console.log('Text stats computed:', stats);
    
    self.postMessage({ taskId, stats });
  } catch (error) {
    console.error('Error in text stats worker:', error);
    self.postMessage({ taskId, error: error.message });
  }
};

function analyzeParagraphs(text) {
  if (typeof text !== 'string') {
    throw new Error('analyzeParagraphs requires string input');
  }
  const paragraphs = text.split(/\n\s*\n/);
  return {
    distribution: paragraphs.map(p => p.length),
    average: paragraphs.reduce((acc, p) => acc + p.length, 0) / paragraphs.length || 0,
    count: paragraphs.length
  };
}

function analyzeSentenceTypes(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return {
    questions: sentences.filter(s => s.trim().endsWith('?')).length,
    exclamations: sentences.filter(s => s.trim().endsWith('!')).length,
    statements: sentences.filter(s => s.trim().endsWith('.')).length,
    total: sentences.length
  };
}

function computeReadabilityScores(text) {
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs.map(paragraph => {
    const words = paragraph.split(/\s+/).length;
    const sentences = (paragraph.match(/[.!?]+/g) || []).length;
    // Simple Flesch-Kincaid-like score (simplified for speed)
    return sentences > 0 ? words / sentences : 0;
  });
}

function analyzeWords(text) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  return {
    total: words.length,
    unique: new Set(words).size,
    averageLength: words.reduce((acc, word) => acc + word.length, 0) / words.length
  };
} 