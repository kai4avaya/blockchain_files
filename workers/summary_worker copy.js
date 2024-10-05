// summary_worker.js
console.log("Summary worker script starting to load");
const topN = 20;

import nlp from 'compromise';

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
  console.log("summarize text in summary worker:", text);
  try {
    const doc = nlp(text);
    const sentences = doc.sentences().out('array');
    const scoredSentences = sentences.map(sentence => ({
      text: sentence,
      score: scoreImportance(nlp(sentence))
    }));

    scoredSentences.sort((a, b) => b.score - a.score);

    let summary = '';
    let usedSentences = new Set();

    for (let i = 0; i < scoredSentences.length && summary.length < CHARACTER_LIMIT; i++) {
      const nextSentence = scoredSentences[i].text;
      if (summary.length + nextSentence.length <= CHARACTER_LIMIT && !usedSentences.has(nextSentence)) {
        summary += (summary ? ' ' : '') + nextSentence;
        usedSentences.add(nextSentence);
      }
    }

    if (summary.length > CHARACTER_LIMIT) {
      summary = summary.substring(0, CHARACTER_LIMIT - 3) + '...';
    }

    console.log("Generated summary:", summary);
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
  if (sentence.match('(important|significant|crucial|essential)').found) score += 2;
  return score;
}

function extractKeywords(text) {
  try {
    const doc = nlp(text);
    const topicsDoc = doc.topics();
    const topicsArray = topicsDoc.out('array');
    const frequencyMap = topicsArray.reduce((acc, topic) => {
      const normalizedTopic = normalizeTopic(topic);
      acc[normalizedTopic] = (acc[normalizedTopic] || 0) + 1;
      return acc;
    }, {});
    const frequencyArray = Object.entries(frequencyMap);
    frequencyArray.sort((a, b) => b[1] - a[1]);
    const keywords = frequencyArray.slice(0, topN).map(entry => entry[0]);
    return keywords;
  } catch (error) {
    console.error("Error in extractKeywords:", error);
    throw error;
  }
}

function normalizeTopic(topic) {
  // Remove punctuation and convert to lowercase
  return topic.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
}

export function removeStopWords(text) {
  try {
    const doc = nlp(text);
    const cleanedText = doc.normalize().remove('#Stop').out('text');
    return cleanedText;
  } catch (error) {
    console.error("Error in removeStopWords:", error);
    throw error;
  }
}




