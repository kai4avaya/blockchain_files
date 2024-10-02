import nlp from 'compromise';

// Main worker function
self.onmessage = function(e) {
  const { text } = e.data;
  const result = processText(text);
  self.postMessage(result);
};

function processText(text) {
  const summary = summarizeText(text);
  const keywords = extractKeywords(text);
  return { summary, keywords };
}

function summarizeText(text) {
  const doc = nlp(text);
  const sentences = doc.sentences().out('array');
  const scoredSentences = sentences.map(sentence => ({
    text: sentence,
    score: scoreImportance(nlp(sentence))
  }));

  scoredSentences.sort((a, b) => b.score - a.score);
  return scoredSentences.slice(0, 3).map(s => s.text).join(' ');
}

function scoreImportance(sentence) {
  let score = 0;
  if (sentence.match('#ProperNoun').found) score += 2;
  if (sentence.numbers().found) score += 1;
  if (sentence.terms().length > 10) score += 1;
  return score;
}

function extractKeywords(text) {
  const doc = nlp(text);
  return doc.topics().slice(0, 5).out('array');
}

function removeStopWords(text) {
  // Use the 'nlp' function from the compromise library to process the text
  const doc = nlp(text);
  // Remove stop words from the document
  const cleanedText = doc.normalize().remove('#Stop').out('text');
  return cleanedText;
}
