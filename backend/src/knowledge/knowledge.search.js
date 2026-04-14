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
    grams.add(normalized.slice(index, index + 3));
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

function expandQueryTokens(tokens = []) {
  const synonymMap = {
    agent: ["agents", "orchestrator", "planner", "executor"],
    memory: ["state", "context", "history"],
    knowledge: ["document", "index", "retrieval", "search"],
    bug: ["error", "issue", "fix", "debug"],
    architecture: ["design", "structure", "modules"],
    github: ["repository", "repo", "source"]
  };

  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const synonym of synonymMap[token] || []) {
      expanded.add(synonym);
    }
  }
  return [...expanded];
}

function jaccardScore(left = [], right = []) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  return union.size ? intersection / union.size : 0;
}

function computeDocumentFrequency(chunks = []) {
  const counts = new Map();
  for (const chunk of chunks) {
    const uniqueTerms = new Set([
      ...(chunk.keyTerms || []),
      ...(chunk.normalizedTerms || [])
    ]);
    for (const term of uniqueTerms) {
      counts.set(term, (counts.get(term) || 0) + 1);
    }
  }
  return counts;
}

function buildQueryProfile(query = "") {
  const tokens = expandQueryTokens(tokenize(query));
  const normalizedTokens = tokens.map(stemToken).filter(Boolean);
  return {
    raw: query,
    tokens,
    normalizedTokens,
    bigrams: buildBigrams(normalizedTokens),
    charTrigrams: buildCharTrigrams(query)
  };
}

function overlapScore(queryTerms = [], chunkTerms = [], docFrequency = new Map(), totalChunks = 1) {
  const chunkSet = new Set(chunkTerms || []);
  let score = 0;

  for (const term of queryTerms) {
    if (!chunkSet.has(term)) {
      continue;
    }

    const df = docFrequency.get(term) || 1;
    const rarity = Math.log(1 + totalChunks / df);
    score += 2 + rarity * 3;
  }

  return score;
}

function phraseScore(profile, chunk) {
  const haystack = [chunk.filename, chunk.sectionTitle, chunk.text]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  let score = 0;
  for (const phrase of profile.bigrams || []) {
    if (phrase.length > 4 && haystack.includes(phrase)) {
      score += 2.25;
    }
  }

  if (profile.raw && haystack.includes(String(profile.raw).toLowerCase())) {
    score += 4;
  }

  return score;
}

function trigramScore(queryTrigrams = [], chunkTrigrams = []) {
  return jaccardScore(queryTrigrams, chunkTrigrams) * 12;
}

function metadataScore(profile, chunk) {
  const filename = String(chunk.filename || "").toLowerCase();
  const section = String(chunk.sectionTitle || "").toLowerCase();
  const parser = String(chunk.parser || "").toLowerCase();
  let score = 0;

  if (profile.tokens.some((token) => filename.includes(token))) {
    score += 2.2;
  }

  if (profile.tokens.some((token) => section.includes(token))) {
    score += 1.8;
  }

  if (profile.tokens.some((token) => parser.includes(token))) {
    score += 1.2;
  }

  if (
    chunk.contentFamily === "technical" &&
    profile.tokens.some((token) => /code|repo|agent|runtime|tool|memory|knowledge/.test(token))
  ) {
    score += 1.4;
  }

  return score;
}

function freshnessScore(chunk) {
  const timestamp = chunk.indexedAt ? Date.parse(chunk.indexedAt) : NaN;
  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  const ageHours = (Date.now() - timestamp) / 3600000;
  if (ageHours < 24) {
    return 1.2;
  }
  if (ageHours < 168) {
    return 0.6;
  }
  return 0;
}

export function searchKnowledgeIndex(chunks = [], query = "", options = {}) {
  const profile = buildQueryProfile(query);
  const docFrequency = computeDocumentFrequency(chunks);
  const docSeen = new Map();

  const matches = chunks
    .map((chunk) => {
      const chunkTerms = [
        ...(chunk.keyTerms || tokenize(chunk.text)),
        ...(chunk.normalizedTerms || [])
      ];
      const rawScore =
        overlapScore(profile.tokens, chunkTerms, docFrequency, Math.max(chunks.length, 1)) +
        overlapScore(profile.normalizedTokens, chunkTerms, docFrequency, Math.max(chunks.length, 1)) +
        jaccardScore(profile.normalizedTokens, chunk.normalizedTerms || []) * 8 +
        phraseScore(profile, chunk) +
        trigramScore(profile.charTrigrams, chunk.charTrigrams || []) +
        metadataScore(profile, chunk) +
        freshnessScore(chunk);

      return {
        ...chunk,
        rawScore: Number(rawScore.toFixed(3))
      };
    })
    .filter((chunk) => chunk.rawScore > 0)
    .sort((left, right) => right.rawScore - left.rawScore)
    .map((chunk) => {
      const docId = chunk.docId || chunk.filename || chunk.id;
      const duplicatePenalty = (docSeen.get(docId) || 0) * 2.5;
      docSeen.set(docId, (docSeen.get(docId) || 0) + 1);
      return {
        ...chunk,
        score: Number((chunk.rawScore - duplicatePenalty).toFixed(3))
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, options.limit || 6);

  return {
    query,
    totalMatches: matches.length,
    items: matches
  };
}

export default {
  searchKnowledgeIndex
};
