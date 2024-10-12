// summary_worker.js
console.log("Summary worker script starting to load");

import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

const nlp = winkNLP(model);
const its = nlp.its;
const as = nlp.as;

const CHARACTER_LIMIT = 384;
const topN = 400;

self.onmessage = function (e) {
  try {
    const { text, fileId, fileName } = e.data;
    if (!nlp) {
      throw new Error("NLP module not loaded");
    }
    const result = processText(text);
    self.postMessage({ ...result, fileId, fileName });
  } catch (error) {
    console.error("Error in summary worker:", error);
    self.postMessage({
      error: error.message,
      fileId: e.data.fileId,
      fileName: e.data.fileName,
    });
  }
};

function processText(text) {
  try {
    const summary = summarizeText(text);

    console.log("I am summary: " + summary);
    const keywords = extractKeywords(text);
    
    console.log("I am keywords: " + keywords);
    return { summary, keywords };
  } catch (error) {
    console.error("Error in processText:", error);
    throw error;
  }
}

function summarizeText(text) {
  console.log("Summarize text in summary worker:", text);
  try {
    const doc = nlp.readDoc(text);
    const sentences = doc.sentences();

    const scoredSentences = [];

    sentences.each((sentence) => {
      scoredSentences.push({
        text: sentence.out(),
        score: scoreImportance(sentence),
      });
    });

    scoredSentences.sort((a, b) => b.score - a.score);

    let summary = '';
    let usedSentences = new Set();

    for (let i = 0; i < scoredSentences.length && summary.length < CHARACTER_LIMIT; i++) {
      const nextSentence = scoredSentences[i].text;
      if (
        summary.length + nextSentence.length <= CHARACTER_LIMIT &&
        !usedSentences.has(nextSentence)
      ) {
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

  const tokens = sentence.tokens();

  let hasProperNoun = false;
  let hasNumber = false;
  let hasImportantWord = false;
  let tokenCount = 0;

  tokens.each((token) => {
    tokenCount += 1;

    // Check for proper nouns
    if (token.out(its.pos) === 'PROPN') {
      hasProperNoun = true;
    }

    // Check for numbers
    if (token.out(its.type) === 'number') {
      hasNumber = true;
    }

    // Check for specific words
    const normalized = token.out(its.normal).toLowerCase();
    const importantWords = ['important', 'significant', 'crucial', 'essential'];
    if (importantWords.includes(normalized)) {
      hasImportantWord = true;
    }
  });

  if (hasProperNoun) score += 2;
  if (hasNumber) score += 1;
  if (tokenCount > 10) score += 1;
  if (hasImportantWord) score += 2;

  return score;
}

function extractKeywords(text) {
  try {
    const doc = nlp.readDoc(text);
    const tokens = doc.tokens();

    const frequencyMap = {};

    tokens.each((token) => {
      const isWord = token.out(its.type) === 'word';
      const isNotStopWord = !token.out(its.stopWordFlag);

      if (isWord && isNotStopWord) {
        const lemma = token.out(its.lemma).toLowerCase();
        frequencyMap[lemma] = (frequencyMap[lemma] || 0) + 1;
      }
    });

    // Convert frequency map to array and sort
    const frequencyArray = Object.entries(frequencyMap);
    frequencyArray.sort((a, b) => b[1] - a[1]);

    // Get top N keywords
    const keywords = frequencyArray.slice(0, topN).map((entry) => entry[0]);

    return keywords;
  } catch (error) {
    console.error("Error in extractKeywords:", error);
    throw error;
  }
}

export function removeStopWords(text) {
  try {
    const doc = nlp.readDoc(text);
    const tokens = doc.tokens();

    const cleanedTokens = [];

    tokens.each((token) => {
      if (!token.out(its.stopWordFlag)) {
        cleanedTokens.push(token.out());
      }
    });

    const cleanedText = cleanedTokens.join(' ');
    return cleanedText;
  } catch (error) {
    console.error("Error in removeStopWords:", error);
    throw error;
  }
}
