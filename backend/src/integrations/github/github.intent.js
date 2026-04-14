function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractLanguage(prompt = "") {
  const normalized = normalizeText(prompt);
  const languages = [
    "typescript",
    "javascript",
    "python",
    "rust",
    "go",
    "java",
    "php"
  ];

  return languages.find((language) => normalized.includes(language)) || "";
}

function extractMinStars(prompt = "") {
  const match = String(prompt || "").match(/(\d+)\s*(?:stars|etoiles|étoiles)/i);
  if (match) {
    return Number(match[1]);
  }

  if (/\bpopular|populaire|well starred\b/i.test(prompt)) {
    return 100;
  }

  return 0;
}

function extractRepoRef(prompt = "") {
  const urlMatch = String(prompt || "").match(/github\.com\/([^/\s]+\/[^/\s)]+)/i);
  if (urlMatch) {
    return urlMatch[1].replace(/\.git$/i, "");
  }

  const repoMatch = String(prompt || "").match(/\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/);
  return repoMatch?.[1] || "";
}

function extractQuery(prompt = "") {
  const cleaned = String(prompt || "")
    .replace(/https?:\/\/github\.com\/[^\s]+/gi, "")
    .replace(/\b(github|repo|repos|repository|repositories|depot|search|cherche|find|analyze|analyse|clone|code)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    .replace(/\bagents autonomes\b/gi, "autonomous agents")
    .replace(/\bsource ouverte\b/gi, "open source")
    .replace(/\bexemples?\b/gi, "examples")
    .replace(/\bpatterns utiles\b/gi, "implementation patterns")
    .replace(/\bet donne moi\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || "hydria architecture agent";
}

export function detectGitHubNeed(prompt = "") {
  const normalized = normalizeText(prompt);
  const repoRef = extractRepoRef(prompt);
  const directSignals =
    /\b(github|repo|repos|repository|repositories|open source|code examples?|implementation patterns?|clone repo|search github|github search)\b/i.test(
      prompt
    ) ||
    /github\.com\//i.test(prompt) ||
    /\b(base|starter|boilerplate|template|good base|bonne base)\b/i.test(
      normalized
    ) ||
    (/\b(dashboard|admin dashboard)\b/i.test(normalized) &&
      /\b(repo|repository|github|open source|template|boilerplate|starter|base)\b/i.test(
        normalized
      )) ||
    (/\barchitecture\b/i.test(normalized) &&
      /\b(node|express|auth|react|dashboard|admin)\b/i.test(normalized));

  if (!directSignals) {
    return null;
  }

  return {
    action: /\bclone\b/i.test(prompt)
      ? "clone"
      : /\bfile|readme|package\.json|pyproject|structure|analyse un repo|analyze a repo|analyse ce repo|analyze this repo\b/i.test(
            normalized
          )
        ? "analyze"
        : "search",
    repoRef,
    query: extractQuery(prompt),
    filters: {
      language: extractLanguage(prompt),
      minStars: extractMinStars(prompt)
    },
    codeQuery:
      /\b(code|function|class|router|agent|memory|planner|executor|critic)\b/i.test(prompt)
        ? extractQuery(prompt)
        : ""
  };
}

export default detectGitHubNeed;
