function tokenize(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/i)
    .filter((token) => token.length > 2);
}

function stemToken(token = "") {
  return String(token || "")
    .replace(/(ing|ers|ies|ied|ment|ments|tions|tion|euses|euse|eaux|eau|aux|es|s)$/i, "")
    .replace(/(ation|ateur|atrice|isation|iser|ized|izer)$/i, "");
}

function buildCharTrigrams(text = "") {
  const normalized = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const grams = new Set();
  for (let index = 0; index < normalized.length - 2; index += 1) {
    const gram = normalized.slice(index, index + 3);
    if (!/\s{2,}/.test(gram)) {
      grams.add(gram);
    }
  }
  return [...grams];
}

function buildBigrams(tokens = []) {
  const grams = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    grams.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return grams;
}

function topTerms(tokens = []) {
  const counts = new Map();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 16)
    .map(([term]) => term);
}

export function buildIndexedKnowledgeEntry(entry) {
  const combinedText = [
    entry.filename,
    entry.sectionTitle,
    entry.text,
    ...(entry.metadata?.profileTags || [])
  ].join(" ");
  const tokens = tokenize(combinedText);
  const normalizedTokens = tokens.map(stemToken).filter(Boolean);

  return {
    ...entry,
    tokenCount: tokens.length,
    keyTerms: topTerms(tokens),
    normalizedTerms: topTerms(normalizedTokens),
    bigrams: buildBigrams(normalizedTokens).slice(0, 24),
    charTrigrams: buildCharTrigrams(combinedText).slice(0, 120)
  };
}

export default {
  buildIndexedKnowledgeEntry
};
