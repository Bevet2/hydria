function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const INTERNAL_LINE_PATTERNS = [
  /\bscore\s+\d+/i,
  /\bmatches?\s+\d+\s+query\s+keywords?\b/i,
  /\banalyse locale\b/i,
  /\blocal analysis\b/i,
  /\bfallback\b/i,
  /\bguidage learnings\b/i,
  /\blearning guidance\b/i,
  /\bno strong local knowledge hits\b/i,
  /\bapi analysis\b/i,
  /\bstars n\/a\b/i,
  /^source\s*:\s*knowledge search, git agent, research agent\.?$/i
];

function isInternalLine(line = "") {
  const text = String(line || "").trim();
  if (!text) {
    return false;
  }

  return INTERNAL_LINE_PATTERNS.some((pattern) => pattern.test(text));
}

function cleanInternalPhrases(text = "") {
  return String(text || "")
    .replace(/\(\s*score\s+\d+[^)]*\)/gi, "")
    .replace(/\bscore\s+\d+\b/gi, "")
    .replace(/\bmatches?\s+\d+\s+query\s+keywords?,?\s*/gi, "")
    .replace(/\banalyse locale\b/gi, "lecture locale prudente")
    .replace(/\blocal analysis\b/gi, "cautious local review")
    .replace(/\bfallback search\b/gi, "recherche de secours")
    .replace(/\bstars n\/a\b/gi, "metadonnees GitHub partielles")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function dedupeLines(lines = []) {
  const seen = new Set();
  const result = [];

  for (const line of lines) {
    const key = normalizeText(line);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(line);
  }

  return result;
}

export function sanitizeUserFacingAnswer(answer = "") {
  const cleaned = String(answer || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => cleanInternalPhrases(line))
    .filter((line) => !isInternalLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return dedupeLines(cleaned.split("\n")).join("\n").trim();
}

export function buildCleanLimitationNote({ language = "fr", hasPartialGithubMetadata = false, hasFallback = false } = {}) {
  if (!hasPartialGithubMetadata && !hasFallback) {
    return "";
  }

  if (language === "fr") {
    if (hasPartialGithubMetadata || hasFallback) {
      return "Les metadonnees GitHub completes n'etaient pas toutes disponibles, donc j'ai complete l'analyse avec une lecture locale prudente.";
    }
  }

  if (hasPartialGithubMetadata || hasFallback) {
    return "Complete GitHub metadata was not fully available, so I completed the analysis with a cautious local review.";
  }

  return "";
}

export default {
  sanitizeUserFacingAnswer,
  buildCleanLimitationNote
};
