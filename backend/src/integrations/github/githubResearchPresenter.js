function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectLanguage(prompt = "") {
  return /\b(le|la|les|des|une|un|pour|avec|sans|quel|quelle|quelles|quels|cherche|trouve|bonne|propre|analyse|compare)\b/.test(
    normalizeText(prompt)
  )
    ? "fr"
    : "en";
}

function formatConfidence(level = "medium", language = "fr") {
  if (language === "fr") {
    return level === "high" ? "elevee" : level === "low" ? "prudente" : "moyenne";
  }

  return level;
}

function buildRepoLine(entry, language = "fr") {
  const repo = entry.repository || {};
  const reasons = entry.ranking?.reasons || [];
  const coreReason = reasons
    .filter((reason) => !/matches?\s+\d+\s+query\s+keywords?/i.test(reason))
    .slice(0, 2)
    .join(", ");
  const languageLabel = repo.language || (language === "fr" ? "langage non precise" : "unspecified language");
  return language === "fr"
    ? `- ${repo.fullName} (${languageLabel})${coreReason ? ` -> ${coreReason}` : ""}`
    : `- ${repo.fullName} (${languageLabel})${coreReason ? ` -> ${coreReason}` : ""}`;
}

function buildArchitectureLine(entry, language = "fr") {
  const architecture = entry.architecture || {};
  const stack = entry.stack || {};
  const stackText = [
    ...(stack.languages || []),
    ...(stack.frameworks || [])
  ]
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");

  return language === "fr"
    ? `- ${entry.repository.fullName}: ${architecture.summary || "structure limitee"}${stackText ? ` | stack: ${stackText}` : ""}`
    : `- ${entry.repository.fullName}: ${architecture.summary || "limited structure"}${stackText ? ` | stack: ${stackText}` : ""}`;
}

function buildPatternLine(pattern, language = "fr") {
  return language === "fr"
    ? `- ${pattern.pattern_name}: ${pattern.description} (source: ${pattern.source_repo}, confiance ${pattern.confidence})`
    : `- ${pattern.pattern_name}: ${pattern.description} (source: ${pattern.source_repo}, confidence ${pattern.confidence})`;
}

function buildRecommendation(selected = [], patterns = [], prompt = "", language = "fr") {
  const top = selected[0];
  if (!top) {
    return language === "fr"
      ? "Aucune recommandation forte: les resultats sont trop faibles pour conclure proprement."
      : "No strong recommendation: the retrieved results are too weak to conclude confidently.";
  }

  const patternNames = patterns.slice(0, 2).map((pattern) => pattern.pattern_name).join(", ");

  return language === "fr"
    ? `${top.repository.fullName} est le meilleur point de depart pour cette demande. Reprenez surtout sa structure ${top.architecture?.summary || "globale"}${patternNames ? ` et les patterns ${patternNames}` : ""}, puis adaptez-les au contexte Hydria au lieu de copier le repo tel quel.`
    : `${top.repository.fullName} is the best starting point for this request. Reuse its ${top.architecture?.summary || "overall"} structure${patternNames ? ` and the ${patternNames} patterns` : ""}, then adapt them to Hydria instead of copying the repository as-is.`;
}

function buildLimitLine({ errors = [], searchMeta = {}, language = "fr" }) {
  const rateLimitError = (errors || []).find((error) =>
    /rate limit/i.test(String(error || ""))
  );

  if (rateLimitError) {
    return language === "fr"
      ? "Limites: l'API GitHub a ete rate-limitee. Hydria a complete l'analyse avec une recherche web + clone local prudent."
      : "Limits: the GitHub API was rate-limited. Hydria completed the analysis with a cautious web search + local clone fallback.";
  }

  if (searchMeta?.fallbackUsed) {
    return language === "fr"
      ? "Limites: une partie de la recherche a utilise un fallback web, donc certains signaux metadata peuvent etre incomplets."
      : "Limits: part of the search used a web fallback, so some metadata signals may be incomplete.";
  }

  return "";
}

export function presentGitHubResearch({
  prompt = "",
  queryInfo = {},
  filters = {},
  rankedAnalyses = [],
  patternSummary = [],
  codeMatches = [],
  learningGuidance = "",
  reusedLearnings = [],
  searchMeta = {},
  errors = []
} = {}) {
  const language = detectLanguage(prompt);
  const compareMode = /\b(compare|comparaison|versus|vs\.?)\b/i.test(String(prompt || ""));
  const selected = rankedAnalyses.slice(0, 2);

  if (!selected.length) {
    return [
      language === "fr" ? "Meilleurs repos retenus" : "Best repositories kept",
      language === "fr"
        ? "- Aucun repo n'a passe le seuil de pertinence local."
        : "- No repository passed the local relevance threshold.",
      language === "fr" ? "Pourquoi" : "Why",
      `- ${language === "fr" ? "requete normalisee" : "normalized query"}: ${queryInfo.primaryQuery || prompt}`,
      language === "fr"
        ? "- Les resultats trouves etaient trop faibles, trop vieux, ou mal alignes avec la demande."
        : "- The retrieved results were too weak, too old, or poorly aligned with the request.",
      language === "fr" ? "Recommandation finale" : "Final recommendation",
      language === "fr"
        ? "Reformulez avec un cadre plus precis, par exemple le langage, le type de produit, ou un pattern attendu."
        : "Rephrase with a clearer target, such as the language, product type, or expected pattern.",
      language === "fr" ? "Niveau de confiance: prudente." : "Confidence: low.",
      buildLimitLine({ errors, searchMeta, language })
    ].join("\n");
  }

  const confidenceLevels = selected.map((entry) => entry.confidence || "medium");
  const confidence =
    confidenceLevels.includes("low")
      ? "low"
      : confidenceLevels.every((level) => level === "high")
        ? "high"
        : "medium";

  const sections = [
    language === "fr" ? "Meilleurs repos retenus" : "Best repositories kept",
    ...selected.map((entry) => buildRepoLine(entry, language)),
    language === "fr" ? "Pourquoi ils ont ete retenus" : "Why they were kept",
    `- ${language === "fr" ? "requete normalisee" : "normalized query"}: ${queryInfo.primaryQuery || prompt}`,
    `- ${language === "fr" ? "filtres" : "filters"}: ${filters.language || "any language"}, stars >= ${filters.minStars || 0}${filters.updatedWithinDays ? `, updated within ${filters.updatedWithinDays}d` : ""}, archived=false`,
    language === "fr" ? "Architecture detectee" : "Detected architecture",
    ...selected.map((entry) => buildArchitectureLine(entry, language)),
    language === "fr" ? "Patterns reutilisables" : "Reusable patterns",
    ...patternSummary.slice(0, 3).map((pattern) => buildPatternLine(pattern, language)),
    reusedLearnings.length
      ? language === "fr"
        ? "Patterns deja valides"
        : "Previously validated patterns"
      : "",
    ...reusedLearnings
      .slice(0, 2)
      .map((learning) => `- ${learning.type}/${learning.category}: ${learning.description}`),
    codeMatches.length
      ? language === "fr"
        ? "Exemples de code localises"
        : "Located code examples"
      : "",
    ...codeMatches.slice(0, 3).map((match) => `- ${match.repository.fullName}:${match.path}`),
    language === "fr" ? "Recommandation finale" : "Final recommendation",
    buildRecommendation(selected, patternSummary, prompt, language),
    language === "fr"
      ? `Niveau de confiance: ${formatConfidence(confidence, language)}.`
      : `Confidence: ${formatConfidence(confidence, language)}.`,
    buildLimitLine({ errors, searchMeta, language })
  ];

  return sections.filter(Boolean).join("\n");
}

export default {
  presentGitHubResearch
};
