// summary_worker.js
console.log("Summary worker script starting to load");

let nlp;
try {
  // Try to import nlp as a module
  import('/node_modules/.vite/deps/compromise.js?v=f9272eb6')
    .then(module => {
      nlp = module.default;
      console.log("NLP module loaded successfully");
    })
    .catch(error => {
      console.error("Error importing NLP module:", error);
    });
} catch (error) {
  console.error("Error in import statement:", error);
  // Fallback to using self.compromise if import fails
  nlp = self.compromise;
  if (nlp) {
    console.log("Using self.compromise as fallback");
  } else {
    console.error("Neither import nor self.compromise are available");
  }
}

const CHARACTER_LIMIT = 384;

self.onmessage = function(e) {
  try {
    const { text, fileId, fileName } = e.data;
    if (!nlp) {
      throw new Error("NLP module not loaded");
    }
    const result = processText(text);
    self.postMessage({ ...result, fileId, fileName });
  } catch (error) {
    console.error("Error in summary worker:", error);
    self.postMessage({ error: error.message, fileId: e.data.fileId, fileName: e.data.fileName });
  }
};

function processText(text) {
  try {
    const summary = summarizeText(text);
    const keywords = extractKeywords(text);
    return { summary, keywords };
  } catch (error) {
    console.error("Error in processText:", error);
    throw error;
  }
}

function summarizeText(text) {
  try {
    const doc = nlp(text);
    const sentences = doc.sentences().out('array');
    const scoredSentences = sentences.map(sentence => ({
      text: sentence,
      score: scoreImportance(nlp(sentence))
    }));

    scoredSentences.sort((a, b) => b.score - a.score);

    let summary = '';
    let i = 0;

    while (i < scoredSentences.length && summary.length < CHARACTER_LIMIT) {
      const nextSentence = scoredSentences[i].text;
      if (summary.length + nextSentence.length <= CHARACTER_LIMIT) {
        summary += (summary ? ' ' : '') + nextSentence;
      } else {
        break;
      }
      i++;
    }

    if (summary.length > CHARACTER_LIMIT) {
      summary = summary.substring(0, CHARACTER_LIMIT - 3) + '...';
    }

    return summary;
  } catch (error) {
    console.error("Error in summarizeText:", error);
    throw error;
  }
}

function scoreImportance(sentence) {
  let score = 0;
  if (sentence.match('#ProperNoun').found) score += 2;
  if (sentence.numbers().found) score += 1;
  if (sentence.terms().length > 10) score += 1;
  return score;
}

function extractKeywords(text) {
  try {
    const doc = nlp(text);
    const keywords = doc.topics().slice(0, 5).out('array');
    return keywords;
  } catch (error) {
    console.error("Error in extractKeywords:", error);
    throw error;
  }
}

function removeStopWords(text) {
  try {
    const doc = nlp(text);
    const cleanedText = doc.normalize().remove('#Stop').out('text');
    return cleanedText;
  } catch (error) {
    console.error("Error in removeStopWords:", error);
    throw error;
  }
}
