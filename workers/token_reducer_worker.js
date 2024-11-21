import nlp from 'compromise';

// Importance levels for different parts of speech
const IMPORTANCE_LEVELS = {
  Determiner: 1,     // "the", "a", "an"
  Conjunction: 2,    // "and", "but"
  Preposition: 3,    // "in", "on", "at"
  Adverb: 4,        // "quickly", "very"
  Adjective: 5,     // "blue", "large"
  Noun: 8,          // "cat", "house"
  Verb: 9,          // "run", "jump"
  ProperNoun: 10    // "John", "JavaScript"
};

class TokenReducer {
  constructor() {
    // Rough estimate: average English word is 4.7 characters + 1 space
    this.avgCharsPerToken = 5.7;
  }

  estimateTokenCount(text) {
    return Math.ceil(text.length / this.avgCharsPerToken);
  }

  reduceTokens(documents, maxTokens) {
    if (!Array.isArray(documents) || documents.length === 0) {
      return {
        documents: [],
        reduction: {
          type: 'error',
          error: 'No valid documents to process'
        }
      };
    }

    // Filter out invalid documents
    const validDocs = documents.filter(doc => 
      doc && typeof doc === 'object' && 
      doc.content && 
      typeof doc.content === 'string' &&
      doc.content.length > 0
    );

    if (validDocs.length === 0) {
      return {
        documents: [],
        reduction: {
          type: 'error',
          error: 'No valid content in documents'
        }
      };
    }

    const totalEstimatedTokens = validDocs.reduce((sum, doc) => 
      sum + this.estimateTokenCount(doc.content), 0);

    if (totalEstimatedTokens <= maxTokens) {
      return {
        documents: validDocs,
        reduction: {
          type: 'none',
          originalTokens: totalEstimatedTokens,
          finalTokens: totalEstimatedTokens
        }
      };
    }

    // Process each document with compromise
    const processedDocs = validDocs.map(doc => ({
      ...doc,
      parsed: nlp(doc.content)
    }));

    let reductionType = 'semantic';
    
    // Start removing terms by importance level
    for (const level of Object.entries(IMPORTANCE_LEVELS).sort((a, b) => a[1] - b[1])) {
      processedDocs.forEach(doc => {
        if (this.estimateTokenCount(doc.content) > (maxTokens / documents.length)) {
          doc.parsed.match(`#${level[0]}`).remove();
          doc.content = doc.parsed.text();
        }
      });

      const newTotalTokens = processedDocs.reduce((sum, doc) => 
        sum + this.estimateTokenCount(doc.content), 0);

      if (newTotalTokens <= maxTokens) {
        return {
          documents: processedDocs.map(({ parsed, ...doc }) => doc),
          reduction: {
            type: reductionType,
            originalTokens: totalEstimatedTokens,
            finalTokens: newTotalTokens,
            removedTypes: [level[0]]
          }
        };
      }
    }

    // If still over limit, truncate
    reductionType = 'truncation';
    const tokensPerDoc = Math.floor(maxTokens / documents.length);
    processedDocs.forEach(doc => {
      doc.content = doc.content.split(' ')
        .slice(0, tokensPerDoc)
        .join(' ');
    });

    const finalTokens = processedDocs.reduce((sum, doc) => 
      sum + this.estimateTokenCount(doc.content), 0);

    return {
      documents: processedDocs.map(({ parsed, ...doc }) => doc),
      reduction: {
        type: reductionType,
        originalTokens: totalEstimatedTokens,
        finalTokens: finalTokens
      }
    };
  }
}

// Handle worker messages
self.onmessage = async (e) => {
  const { documents, maxTokens } = e.data;
  
  if (!documents || !maxTokens) {
    self.postMessage({ 
      success: false, 
      error: 'Invalid input: missing documents or maxTokens' 
    });
    return;
  }
  
  try {
    const reducer = new TokenReducer();
    const result = reducer.reduceTokens(documents, maxTokens);
    self.postMessage({ 
      success: true, 
      documents: result.documents,
      reduction: result.reduction
    });
  } catch (error) {
    self.postMessage({ 
      success: false, 
      error: error.message || 'Unknown error in token reducer'
    });
  }
}; 