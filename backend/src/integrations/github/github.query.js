function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const STOPWORDS = new Set([
  "a",
  "agent",
  "agents",
  "an",
  "and",
  "architecture",
  "un",
  "une",
  "bonne",
  "cherche",
  "cherchez",
  "cherche-moi",
  "code",
  "compare",
  "dashboard",
  "de",
  "des",
  "donne",
  "donne-moi",
  "for",
  "github",
  "good",
  "goodness",
  "i",
  "implementation",
  "les",
  "me",
  "moi",
  "open",
  "opensource",
  "open-source",
  "pattern",
  "patterns",
  "pour",
  "propre",
  "repo",
  "repos",
  "repository",
  "repositories",
  "search",
  "source",
  "sur",
  "simple",
  "simples",
  "trouve",
  "trouver",
  "types",
  "utile",
  "utiles",
  "with"
]);

const LANGUAGE_ALIASES = {
  typescript: "TypeScript",
  ts: "TypeScript",
  javascript: "JavaScript",
  js: "JavaScript",
  node: "TypeScript",
  express: "TypeScript",
  react: "TypeScript",
  vue: "TypeScript",
  python: "Python",
  py: "Python",
  rust: "Rust",
  go: "Go",
  golang: "Go",
  java: "Java",
  php: "PHP"
};

function uniq(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function tokenize(value = "") {
  return normalizeText(value)
    .split(/[^a-z0-9_.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !STOPWORDS.has(token));
}

function detectLanguage(task = "") {
  const normalized = normalizeText(task);
  const explicit = Object.entries(LANGUAGE_ALIASES).find(([alias]) =>
    new RegExp(`\\b${alias}\\b`, "i").test(normalized)
  );

  if (explicit) {
    return explicit[1];
  }

  if (/\bnode\b/.test(normalized) || /\breact\b/.test(normalized) || /\bvue\b/.test(normalized)) {
    return "TypeScript";
  }

  return "";
}

function detectMinStars(task = "") {
  const match = String(task || "").match(/(\d+)\s*(?:stars|etoiles|étoiles)/i);
  if (match) {
    return Number(match[1]);
  }

  if (/\b(propre|clean|solide|good|bonne|best|mature|production-ready)\b/i.test(task)) {
    return 40;
  }

  return 15;
}

function detectUpdatedWithinDays(task = "") {
  const normalized = normalizeText(task);

  if (/\b(recent|recently|recentes?|recente|updated recently|maintained|active)\b/.test(normalized)) {
    return 540;
  }

  if (/\b(clean|propre|good|bonne|solid|solide|mature)\b/.test(normalized)) {
    return 1460;
  }

  return 0;
}

function detectIntentHints(task = "") {
  const normalized = normalizeText(task);
  const hints = [];

  if (/\bauth|authentication|login|jwt|oauth|passport|session\b/.test(normalized)) {
    hints.push("auth");
  }
  if (/\bnode|express|backend|api|rest\b/.test(normalized)) {
    hints.push("node_backend");
  }
  if (/\b(simple|simples|minimal|minimaliste|starter|boilerplate|base)\b/.test(normalized)) {
    hints.push("simple_base");
  }
  if (/\breact|dashboard|admin|panel|ui\b/.test(normalized)) {
    hints.push("react_admin");
  }
  if (/\bagent|autonomous|runtime|memory|planner|executor|critic|github agent\b/.test(normalized)) {
    hints.push("agent_runtime");
  }
  if (/\bgithub\b/.test(normalized)) {
    hints.push("github_focus");
  }
  if (/\bcompare|versus|vs\b/.test(normalized)) {
    hints.push("compare");
  }

  return hints;
}

function buildHintKeywords(hints = []) {
  const keywords = [];

  for (const hint of hints) {
    if (hint === "auth") {
      keywords.push("auth", "authentication", "jwt", "session", "oauth");
    } else if (hint === "node_backend") {
      keywords.push("node", "express", "backend", "api");
    } else if (hint === "simple_base") {
      keywords.push("boilerplate", "starter", "template");
    } else if (hint === "react_admin") {
      keywords.push("react", "admin", "dashboard", "template");
    } else if (hint === "agent_runtime") {
      keywords.push("agent", "autonomous", "runtime", "memory", "tools");
    } else if (hint === "github_focus") {
      keywords.push("github", "repo", "repository", "automation", "octokit", "probot", "github-app");
    }
  }

  return uniq(keywords);
}

function buildReadableQuery(tokens = [], hintKeywords = []) {
  return uniq([...tokens, ...hintKeywords]).slice(0, 7).join(" ").trim();
}

function buildFallbackQueries(tokens = [], hints = []) {
  const queries = [];

  if (hints.includes("auth")) {
    queries.push("node express auth typescript");
    queries.push("authentication boilerplate express");
  }

  if (hints.includes("node_backend")) {
    queries.push("node express boilerplate");
    queries.push("simple express api");
  }

  if (hints.includes("react_admin")) {
    queries.push("react admin dashboard typescript");
    queries.push("admin dashboard template react");
  }

  if (hints.includes("agent_runtime")) {
    queries.push("autonomous agent typescript");
    queries.push("typescript ai agent runtime");
    if (hints.includes("github_focus")) {
      queries.push("github agent typescript");
      queries.push("github automation agent");
      queries.push("github app octokit probot");
    }
  }

  if (tokens.length >= 2) {
    queries.push(tokens.slice(0, 4).join(" "));
  }

  return uniq(queries.filter(Boolean));
}

function buildCodeQuery(tokens = [], hints = []) {
  if (hints.includes("auth")) {
    return "auth middleware";
  }

  if (hints.includes("react_admin")) {
    return "dashboard layout";
  }

  if (hints.includes("agent_runtime")) {
    if (hints.includes("github_focus")) {
      return "github app octokit";
    }
    return "agent runtime memory";
  }

  if (hints.includes("node_backend")) {
    return "routes services controllers";
  }

  return tokens.slice(0, 3).join(" ");
}

export function normalizeGitHubQuery(task = "") {
  const prompt = String(task || "").trim();
  const cleaned = prompt
    .replace(/https?:\/\/github\.com\/[^\s]+/gi, " ")
    .replace(/\b(github|repo|repository|repositories|open source|open-source|code search|search github|cherche sur github|trouve sur github|donne moi|donne-moi|analyse|analyze|compare)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = tokenize(cleaned);
  const hints = detectIntentHints(prompt);
  const hintKeywords = buildHintKeywords(hints);
  const primaryQuery =
    hints.includes("agent_runtime") && hints.includes("github_focus")
      ? "github app octokit probot agent"
      : buildReadableQuery(tokens, hintKeywords) || "typescript agent runtime";
  const fallbackQueries = buildFallbackQueries(tokens, hints);

  return {
    originalTask: prompt,
    primaryQuery,
    fallbackQueries,
    keywords: uniq([...tokens, ...hintKeywords]),
    language: detectLanguage(prompt),
    hints,
    codeQuery: buildCodeQuery(tokens, hints)
  };
}

export function buildRepositorySearchFilters(taskContext = {}) {
  const prompt =
    typeof taskContext === "string"
      ? taskContext
      : taskContext.prompt || taskContext.query || taskContext.originalTask || "";
  const normalized = normalizeGitHubQuery(prompt);
  const explicitFilters = typeof taskContext === "object" ? taskContext.filters || {} : {};

  return {
    language: explicitFilters.language || normalized.language || "",
    minStars: explicitFilters.minStars || detectMinStars(prompt),
    updatedWithinDays:
      explicitFilters.updatedWithinDays ||
      explicitFilters.updatedRecentlyDays ||
      detectUpdatedWithinDays(prompt),
    archived: explicitFilters.archived === false ? false : false,
    perPage: explicitFilters.perPage || 8,
    sort: explicitFilters.sort || "stars",
    order: explicitFilters.order || "desc"
  };
}

export default {
  normalizeGitHubQuery,
  buildRepositorySearchFilters
};
