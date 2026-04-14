import * as cheerio from "cheerio";

function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value = "") {
  return normalizeText(value)
    .split(/[^a-z0-9_.-]+/)
    .filter((token) => token.length >= 3);
}

function withTimeout(timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    controller,
    clear() {
      clearTimeout(timeout);
    }
  };
}

function unwrapDuckDuckGoUrl(url = "") {
  try {
    const parsed = new URL(url, "https://duckduckgo.com");
    const target = parsed.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : parsed.toString();
  } catch {
    return url;
  }
}

function isIgnoredGitHubPath(parts = []) {
  if (parts.length < 2) {
    return true;
  }

  const owner = String(parts[0] || "").toLowerCase();
  const repo = String(parts[1] || "").toLowerCase();
  return [
    "features",
    "topics",
    "search",
    "orgs",
    "organizations",
    "marketplace",
    "explore",
    "collections",
    "events",
    "issues",
    "pulls",
    "notifications",
    "login",
    "signup",
    "settings",
    "about",
    "sponsors"
  ].includes(owner) || [
    "issues",
    "pulls",
    "actions",
    "security",
    "projects",
    "wiki",
    "discussions",
    "releases",
    "packages"
  ].includes(repo);
}

function extractRepoRefFromUrl(url = "") {
  try {
    const parsed = new URL(unwrapDuckDuckGoUrl(url));
    if (!/github\.com$/i.test(parsed.hostname)) {
      return null;
    }

    const parts = parsed.pathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);

    if (parts.length < 2 || isIgnoredGitHubPath(parts)) {
      return null;
    }

    return `${parts[0]}/${parts[1].replace(/\.git$/i, "")}`;
  } catch {
    return null;
  }
}

function normalizeRepositoryFromSearchResult(result = {}, filters = {}) {
  const fullName = extractRepoRefFromUrl(result.url);
  if (!fullName) {
    return null;
  }

  const [owner, name] = fullName.split("/");
  return {
    id: `web:${fullName}`,
    fullName,
    name,
    owner,
    private: false,
    htmlUrl: `https://github.com/${fullName}`,
    description: cleanText(result.snippet || result.title || ""),
    language: filters.language || "",
    stars: null,
    forks: 0,
    openIssues: 0,
    defaultBranch: "main",
    updatedAt: null,
    pushedAt: null,
    archived: false,
    topics: [],
    license: "",
    size: 0,
    hasIssues: true,
    visibility: "public",
    hasReadme: false,
    discoverySource: "duckduckgo_html",
    metadataConfidence: "low"
  };
}

function scoreSearchResult(result = {}, queryInfo = {}, filters = {}) {
  const haystack = normalizeText(
    `${result.title || ""} ${result.snippet || ""} ${result.url || ""}`
  );
  const keywords = [...new Set([...(queryInfo.keywords || []), ...(queryInfo.hints || [])])];
  let score = 0;

  for (const token of keywords) {
    if (token && haystack.includes(normalizeText(token))) {
      score += 4;
    }
  }

  if (filters.language && haystack.includes(normalizeText(filters.language))) {
    score += 5;
  }

  if (/express|node|backend|api/.test(haystack) && keywords.some((token) => /node|express|backend|api/.test(token))) {
    score += 4;
  }
  if (/react|dashboard|admin|mui|chakra/.test(haystack) && keywords.some((token) => /react|dashboard|admin/.test(token))) {
    score += 4;
  }
  if (/agent|runtime|memory|planner|executor/.test(haystack) && keywords.some((token) => /agent|runtime|memory/.test(token))) {
    score += 4;
  }

  return score;
}

function dedupeRepositories(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item?.fullName;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function fetchDuckDuckGoHtml(query, timeoutMs = 12000) {
  const timeout = withTimeout(timeoutMs);
  try {
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", query);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Hydria-Agentic-V2",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: timeout.controller.signal
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo HTML returned ${response.status}`);
    }

    return await response.text();
  } finally {
    timeout.clear();
  }
}

function parseDuckDuckGoResults(html = "") {
  const $ = cheerio.load(String(html || ""));
  const results = [];

  $(".result").each((_, element) => {
    const titleNode = $(element).find(".result__title a").first();
    const snippetNode = $(element).find(".result__snippet").first();
    const rawUrl = titleNode.attr("href") || $(element).find(".result__url").text();
    const title = cleanText(titleNode.text());
    const snippet = cleanText(snippetNode.text());
    const url = unwrapDuckDuckGoUrl(rawUrl);

    if (!title || !url) {
      return;
    }

    results.push({
      title,
      url,
      snippet
    });
  });

  return results;
}

function buildSearchQueries(queryInfo = {}, filters = {}) {
  const baseQueries = [
    queryInfo.primaryQuery,
    ...(queryInfo.fallbackQueries || [])
  ].filter(Boolean);

  const languageHint = filters.language ? ` ${filters.language}` : "";

  return [...new Set(
    baseQueries.flatMap((query) => [
      `site:github.com ${query}${languageHint}`,
      `site:github.com ${query} ${queryInfo.codeQuery || ""}`.trim()
    ])
  )];
}

export async function discoverRepositoriesViaWeb(
  queryInfo = {},
  filters = {},
  options = {}
) {
  const maxResults = Math.max(3, Number(options.maxResults || 8));
  const queries = buildSearchQueries(queryInfo, filters);
  const repos = [];
  const errors = [];
  let fallbackUsed = false;

  for (const [index, query] of queries.entries()) {
    try {
      const html = await fetchDuckDuckGoHtml(query, options.timeoutMs || 12000);
      const results = parseDuckDuckGoResults(html);
      const normalized = dedupeRepositories(
        results
          .map((result) => ({
            repository: normalizeRepositoryFromSearchResult(result, filters),
            score: scoreSearchResult(result, queryInfo, filters)
          }))
          .filter((result) => result.repository && result.score >= 4)
          .sort((left, right) => right.score - left.score)
          .map((result) => ({
            ...result.repository,
            webDiscoveryScore: result.score
          }))
      );

      if (normalized.length) {
        repos.push(...normalized);
        if (index > 0) {
          fallbackUsed = true;
        }
      }

      if (dedupeRepositories(repos).length >= maxResults) {
        break;
      }
    } catch (error) {
      errors.push({
        provider: "duckduckgo_html",
        message: error.message || String(error)
      });
    }
  }

  return {
    totalCount: dedupeRepositories(repos).length,
    items: dedupeRepositories(repos).slice(0, maxResults),
    fallbackUsed,
    errors
  };
}

export default {
  discoverRepositoriesViaWeb
};
