function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value = "") {
  return normalizeText(value)
    .split(/[^a-z0-9_.-]+/)
    .filter((token) => token.length >= 2);
}

function daysSince(dateValue) {
  if (!dateValue) {
    return 99999;
  }

  const millis = Date.now() - new Date(dateValue).getTime();
  return Math.max(0, Math.round(millis / 86400000));
}

function computeQueryMatch(repo = {}, keywords = []) {
  const haystack = normalizeText(
    [
      repo.fullName,
      repo.name,
      repo.description,
      ...(repo.topics || [])
    ].join(" ")
  );
  const matches = keywords.filter((keyword) => haystack.includes(normalizeText(keyword)));
  return {
    count: matches.length,
    matchedKeywords: matches
  };
}

function buildFeatureSignals(repo = {}, analysis = null) {
  const structure = analysis?.structure || {};
  const features = analysis?.features || {};
  const topLevel = new Set(structure.topLevelDirectories || []);

  return {
    hasReadme: Boolean(repo.hasReadme || features.hasReadme),
    hasPackageJson: Boolean(features.hasPackageJson),
    hasDocs: Boolean(features.hasDocs || topLevel.has("docs")),
    hasSrc: Boolean(features.hasSrc || topLevel.has("src") || topLevel.has("app")),
    hasTests: Boolean(features.hasTests || topLevel.has("tests") || topLevel.has("__tests__")),
    hasConfig: Boolean(features.hasConfig),
    isArchived: Boolean(repo.archived),
    hasStructuredFolders:
      Boolean(features.hasLayeredBackend) ||
      Boolean(features.hasFeatureModules) ||
      Boolean(features.hasFrontendStructure) ||
      Boolean(features.isMonorepo)
  };
}

function scoreStars(stars = 0) {
  if (stars === null || stars === undefined || Number.isNaN(Number(stars))) return 0;
  if (stars >= 20000) return 20;
  if (stars >= 5000) return 18;
  if (stars >= 1000) return 15;
  if (stars >= 250) return 12;
  if (stars >= 50) return 8;
  if (stars >= 10) return 4;
  return 1;
}

function scoreRecency(updatedAt = null) {
  const ageDays = daysSince(updatedAt);
  if (ageDays <= 30) return 15;
  if (ageDays <= 180) return 12;
  if (ageDays <= 365) return 10;
  if (ageDays <= 730) return 7;
  if (ageDays <= 1460) return 4;
  return 0;
}

function scoreLanguage(repo = {}, expectedLanguage = "") {
  if (!expectedLanguage) {
    return repo.language ? 4 : 0;
  }

  const expected = normalizeText(expectedLanguage);
  const actual = normalizeText(repo.language || "");

  if (expected === actual) {
    return 10;
  }

  if (
    (expected === "typescript" && actual === "javascript") ||
    (expected === "javascript" && actual === "typescript")
  ) {
    return 6;
  }

  return -4;
}

function scoreFeatures(signals = {}) {
  let score = 0;
  if (signals.hasReadme) score += 5;
  if (signals.hasPackageJson) score += 5;
  if (signals.hasSrc) score += 5;
  if (signals.hasDocs) score += 4;
  if (signals.hasTests) score += 4;
  if (signals.hasConfig) score += 2;
  if (signals.hasStructuredFolders) score += 5;
  if (signals.isArchived) score -= 20;
  return score;
}

function scoreAnalysisSignals(analysis = null) {
  if (!analysis) {
    return 0;
  }

  let score = 0;
  if (analysis.confidence === "high") {
    score += 8;
  } else if (analysis.confidence === "medium") {
    score += 4;
  }

  score += Math.min((analysis.patterns || []).length * 2, 8);
  score += Math.min((analysis.summary?.importantPaths || []).length, 6);

  if (analysis.analysisMode === "local_clone") {
    score += 4;
  }

  if ((analysis.limits || []).some((limit) => /few structural files|readme not available/i.test(limit))) {
    score -= 4;
  }

  return score;
}

function scoreHintAlignment(hints = [], signals = {}) {
  let score = 0;

  if (hints.includes("node_backend")) {
    score += signals.hasLayeredBackend ? 8 : -8;
  }

  if (hints.includes("react_admin")) {
    score += signals.hasFrontendStructure ? 8 : -8;
  }

  if (hints.includes("agent_runtime")) {
    score += signals.hasAgentModules ? 7 : -5;
  }

  if (hints.includes("github_focus")) {
    score += signals.hasGitHubIntegration ? 8 : -6;
  }

  if (hints.includes("auth")) {
    score += signals.hasAuthModule ? 5 : -4;
  }

  if (hints.includes("simple_base") && signals.hasConfig) {
    score += 3;
  }

  return score;
}

function scoreLearningAlignment(repo = {}, analysis = null, learnings = []) {
  if (!Array.isArray(learnings) || !learnings.length) {
    return {
      score: 0,
      reasons: []
    };
  }

  const haystack = normalizeText(
    [
      repo.fullName,
      repo.name,
      repo.description,
      repo.language,
      ...(repo.topics || []),
      analysis?.architecture?.summary || "",
      ...(analysis?.stack?.frameworks || []),
      ...(analysis?.patterns || []).map((pattern) => pattern.pattern_name || pattern.description || "")
    ].join(" ")
  );

  let score = 0;
  const reasons = [];

  for (const learning of learnings.slice(0, 4)) {
    const tags = [
      learning.category,
      ...(learning.reusableFor || []),
      learning.description
    ]
      .map((value) => normalizeText(value))
      .filter(Boolean);
    const matches = tags.filter((tag) => haystack.includes(tag));
    if (!matches.length) {
      continue;
    }

    score += Math.min(6, matches.length * 2 + Math.round(Number(learning.confidence || 0) * 2));
    if (reasons.length < 2) {
      reasons.push(`aligns with learned ${learning.type}: ${learning.category}`);
    }
  }

  return {
    score,
    reasons
  };
}

function buildReasons({
  repo,
  queryMatch,
  expectedLanguage,
  signals,
  score,
  learningReasons = []
}) {
  const reasons = [];

  if (queryMatch.count >= 2) {
    reasons.push(`matches ${queryMatch.count} query keywords`);
  } else if (queryMatch.count === 1) {
    reasons.push("partially matches the query");
  }

  if (expectedLanguage && normalizeText(repo.language || "") === normalizeText(expectedLanguage)) {
    reasons.push(`language matches ${expectedLanguage}`);
  }

  if ((repo.stars || 0) >= 100) {
    reasons.push(`${repo.stars} stars`);
  }

  if (repo.updatedAt || repo.pushedAt) {
    const ageDays = daysSince(repo.updatedAt || repo.pushedAt);
    if (ageDays <= 365) {
      reasons.push("recently updated");
    } else if (ageDays > 1460) {
      reasons.push("older maintenance signal");
    }
  }

  if (signals.hasStructuredFolders) {
    reasons.push("clear project structure");
  }

  if (!signals.hasReadme) {
    reasons.push("missing README signal");
  }

  if (signals.isArchived) {
    reasons.push("archived repository");
  }

  reasons.push(...learningReasons.slice(0, 2));

  return {
    score,
    reasons: reasons.slice(0, 4)
  };
}

export function scoreRepositoryCandidate(repo = {}, context = {}, analysis = null) {
  const expectedLanguage = context.filters?.language || context.queryInfo?.language || "";
  const queryMatch = computeQueryMatch(repo, context.queryInfo?.keywords || []);
  const signals = buildFeatureSignals(repo, analysis);
  const learningAlignment = scoreLearningAlignment(
    repo,
    analysis,
    context.learnings || []
  );

  const score =
    scoreStars(repo.stars) +
    scoreRecency(repo.updatedAt || repo.pushedAt) +
    scoreLanguage(repo, expectedLanguage) +
    Math.min(queryMatch.count * 5, 18) +
    scoreFeatures(signals) +
    Math.min(Number(repo.webDiscoveryScore || 0), 12) +
    scoreHintAlignment(context.queryInfo?.hints || [], signals) +
    learningAlignment.score +
    scoreAnalysisSignals(analysis);

  return {
    score,
    queryMatch,
    signals,
    ...buildReasons({
      repo,
      queryMatch,
      expectedLanguage,
      signals,
      score,
      learningReasons: learningAlignment.reasons
    })
  };
}

export function rankRepositoryCandidates(repositories = [], context = {}) {
  return repositories
    .map((repo) => ({
      repository: repo,
      ...scoreRepositoryCandidate(repo, context)
    }))
    .sort((left, right) => right.score - left.score || right.repository.stars - left.repository.stars);
}

export function rerankRepositoryAnalyses(analyses = [], context = {}) {
  return analyses
    .map((analysis) => {
      const scoring = scoreRepositoryCandidate(analysis.repository, context, analysis);
      return {
        ...analysis,
        ranking: scoring
      };
    })
    .sort((left, right) => right.ranking.score - left.ranking.score || right.repository.stars - left.repository.stars);
}

export default {
  scoreRepositoryCandidate,
  rankRepositoryCandidates,
  rerankRepositoryAnalyses
};
