import { getContextualSuccessRate } from "./learning.contextStats.js";
import { computeGenericityScore } from "./learning.genericityScore.js";

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

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function overlapScore(source = [], target = []) {
  if (!source.length || !target.length) {
    return 0;
  }

  let score = 0;
  for (const value of source) {
    if (target.includes(value)) {
      score += 1;
    }
  }

  return score;
}

function daysSince(dateValue = "") {
  if (!dateValue) {
    return 9999;
  }

  const millis = Date.now() - new Date(dateValue).getTime();
  return Math.max(0, Math.round(millis / 86400000));
}

export function inferLearningCategory(taskContext = {}) {
  const normalized = normalizeText(taskContext.prompt || taskContext.resolvedPrompt || "");

  if (/\b(auth|login|session|jwt|oauth|passport)\b/.test(normalized)) {
    return "auth";
  }
  if (/\b(api|rest|endpoint|webhook)\b/.test(normalized)) {
    return "api";
  }
  if (/\b(react|vue|dashboard|admin|frontend)\b/.test(normalized)) {
    return "frontend";
  }
  if (/\b(ui|ux|component|layout|css|design)\b/.test(normalized)) {
    return "ui";
  }
  if (/\b(sql|sqlite|postgres|mysql|database|db)\b/.test(normalized)) {
    return "database";
  }
  if (/\b(github|repo|repository|octokit|probot)\b/.test(normalized) || taskContext.domain === "github_research") {
    return "github";
  }
  if (/\b(agent|orchestrator|runtime|tool)\b/.test(normalized)) {
    return "agent";
  }
  if (/\b(node|express|fastify|koa|backend|server)\b/.test(normalized) || taskContext.classification === "coding") {
    return "backend";
  }

  return "general";
}

export function detectTaskSubdomain(taskContext = {}) {
  const normalized = normalizeText(taskContext.prompt || taskContext.resolvedPrompt || "");

  if (/\b(auth|login|session|jwt|oauth|passport)\b/.test(normalized)) {
    return "auth";
  }
  if (/\b(admin dashboard|dashboard|ui|ux|component|layout|tailwind|material ui)\b/.test(normalized)) {
    return "ui";
  }
  if (/\b(react|vue|frontend|next)\b/.test(normalized)) {
    return "frontend";
  }
  if (/\b(sql|sqlite|postgres|mysql|database|db)\b/.test(normalized)) {
    return "database";
  }
  if (/\b(api|rest|endpoint|webhook)\b/.test(normalized)) {
    return "api";
  }
  if (/\b(github|repo|repository|octokit|probot)\b/.test(normalized)) {
    return "github";
  }
  if (/\b(agent|orchestrator|runtime|tool|multi-agent)\b/.test(normalized)) {
    return "agent";
  }
  if (/\b(node|express|fastify|koa|backend|server)\b/.test(normalized)) {
    return "backend";
  }

  return inferLearningCategory(taskContext);
}

export function detectTaskType(taskContext = {}) {
  const normalized = normalizeText(taskContext.prompt || taskContext.resolvedPrompt || "");

  if (/\b(compare|comparaison|versus|vs)\b/.test(normalized) || taskContext.classification === "compare") {
    return "compare";
  }
  if (/\b(fix|corrige|debug|repair|bug|issue)\b/.test(normalized)) {
    return "fix";
  }
  if (/\b(create|build|cree|fais|generate|genera|write|implement)\b/.test(normalized) || taskContext.classification === "artifact_generation") {
    return "build";
  }
  if (/\b(explain|explique|what|why|comment|what is)\b/.test(normalized)) {
    return "explain";
  }
  if (/\b(analyse|analyze|analysis|audit|inspect)\b/.test(normalized)) {
    return "analyze";
  }
  if (/\b(search|cherche|find|research|repo)\b/.test(normalized) || taskContext.domain === "github_research") {
    return "research";
  }

  return "general";
}

export function inferLearningTags(taskContext = {}) {
  const normalized = normalizeText(taskContext.prompt || taskContext.resolvedPrompt || "");
  const subdomain = detectTaskSubdomain(taskContext);
  const taskType = detectTaskType(taskContext);
  const tags = [
    taskContext.classification || "",
    taskContext.domain || "",
    inferLearningCategory(taskContext),
    subdomain,
    taskType
  ];

  if (/\b(node|express|fastify|koa)\b/.test(normalized)) {
    tags.push("node", "express", "backend");
  }
  if (/\b(react|next)\b/.test(normalized)) {
    tags.push("react");
  }
  if (/\b(github|repo|repository)\b/.test(normalized)) {
    tags.push("github");
  }
  if (/\bagent|multi-agent|orchestr/i.test(normalized)) {
    tags.push("agent");
  }
  if (/\b(auth|jwt|session|oauth)\b/.test(normalized)) {
    tags.push("auth");
  }
  if (/\b(dashboard|admin|ui|component)\b/.test(normalized)) {
    tags.push("ui", "dashboard");
  }
  if (/\b(database|sqlite|postgres|mysql)\b/.test(normalized)) {
    tags.push("database");
  }

  return uniq(tags.map((tag) => normalizeText(tag)).filter(Boolean));
}

export function inferProjectType(taskContext = {}) {
  if (taskContext.projectType) {
    return taskContext.projectType;
  }

  if (taskContext.domain === "github_research" || taskContext.classification === "github_research") {
    return "external";
  }

  return "internal";
}

function deriveDomain(taskContext = {}) {
  return normalizeText(taskContext.domain || taskContext.classification || "simple_chat");
}

function deriveSelectionLimit(taskContext = {}) {
  const domain = deriveDomain(taskContext);
  if (["simple_chat", "data_lookup"].includes(domain)) {
    return 1;
  }
  if (["coding", "github_research", "compare", "reasoning", "complex_reasoning", "artifact_generation"].includes(domain)) {
    return 2;
  }
  return 2;
}

function computeSourceWeight(taskContext = {}, item = {}) {
  const projectType = inferProjectType(taskContext);
  const domain = deriveDomain(taskContext);
  const itemProjectType = item.projectType || "internal";

  if (projectType === "internal") {
    return itemProjectType === "internal" ? 1.22 : 0.8;
  }

  if (domain === "github_research") {
    return itemProjectType === "external" ? 1.12 : 0.88;
  }

  return itemProjectType === "external" ? 0.98 : 1.05;
}

function relatedCategoryMatch(subdomain = "", item = {}) {
  const category = normalizeText(item.category || "");
  const tags = (item.reusableFor || []).map((value) => normalizeText(value));
  const descriptorTokens = new Set(tokenize(`${category} ${tags.join(" ")}`));

  const groups = {
    backend: ["backend", "node", "express", "api", "service", "controller"],
    auth: ["auth", "jwt", "oauth", "middleware", "session", "authentication"],
    ui: ["ui", "dashboard", "layout", "component", "frontend", "react"],
    frontend: ["frontend", "react", "vue", "component", "layout"],
    api: ["api", "rest", "endpoint", "webhook", "backend"],
    database: ["database", "sql", "sqlite", "postgres", "mysql"],
    github: ["github", "repo", "repository", "octokit", "probot"],
    agent: ["agent", "runtime", "tool", "memory", "orchestrator"]
  };

  const expected = groups[subdomain] || [subdomain];
  return expected.some((token) => descriptorTokens.has(normalizeText(token)));
}

export function scoreLearningForDomain(taskDomain, taskSubdomain, learningItem) {
  let score = 0;
  let domainMatch = "weak";

  const descriptorTokens = new Set(
    tokenize(
      normalizeText(
        [
          learningItem.category,
          ...(learningItem.reusableFor || [])
        ].join(" ")
      )
    )
  );

  const matchesSubdomainToken = descriptorTokens.has(normalizeText(taskSubdomain));
  const matchesDomainToken = descriptorTokens.has(normalizeText(taskDomain));

  if (matchesSubdomainToken || relatedCategoryMatch(taskSubdomain, learningItem)) {
    score += 7;
    domainMatch = "strong";
  } else if (matchesDomainToken || relatedCategoryMatch(taskDomain, learningItem)) {
    score += 4;
    domainMatch = "medium";
  } else if (learningItem.category === "general") {
    score -= 4;
    domainMatch = "generic";
  }

  return {
    score,
    domainMatch
  };
}

function scoreTaskTypeMatch(taskType = "general", learningItem = {}) {
  const descriptor = normalizeText(
    [
      learningItem.description,
      ...(learningItem.reusableFor || [])
    ].join(" ")
  );

  if (taskType === "build" && /\b(build|create|generate|template|delivery|artifact)\b/.test(descriptor)) {
    return 4;
  }
  if (taskType === "compare" && /\b(compare|recommendation|tradeoff)\b/.test(descriptor)) {
    return 4;
  }
  if (taskType === "fix" && /\b(fix|avoid|mistake|error|retry)\b/.test(descriptor)) {
    return 4;
  }
  if (taskType === "research" && /\b(repo|repository|github|pattern)\b/.test(descriptor)) {
    return 4;
  }
  if (taskType === "analyze" && /\b(analyze|analysis|diagnosis|pattern)\b/.test(descriptor)) {
    return 3;
  }

  return descriptor.includes(taskType) ? 2 : 0;
}

function scoreRecency(item = {}) {
  const ageDays = daysSince(item.lastUsedAt || item.updatedAt || item.createdAt);
  if (ageDays <= 7) {
    return 3;
  }
  if (ageDays <= 30) {
    return 2;
  }
  if (ageDays <= 120) {
    return 1;
  }
  return 0;
}

function scoreRecentUsefulness(item = {}) {
  const successRate = Number(item.successRate || 0);
  const usageCount = Number(item.usageCount || 0);

  if (usageCount === 0) {
    return 0;
  }
  if (successRate >= 0.85 && usageCount >= 3) {
    return 2.5;
  }
  if (successRate >= 0.72 && usageCount >= 2) {
    return 1.5;
  }
  if (successRate < 0.45 && usageCount >= 2) {
    return -2;
  }
  return 0;
}

export function computeLearningRelevance(taskContext = {}, learningItem = {}) {
  const domain = deriveDomain(taskContext);
  const subdomain = detectTaskSubdomain(taskContext);
  const taskType = detectTaskType(taskContext);
  const taskTags = inferLearningTags(taskContext);
  const learningTags = (learningItem.reusableFor || []).map((value) => normalizeText(value));
  const domainScore = scoreLearningForDomain(domain, subdomain, learningItem);
  const taskTypeScore = scoreTaskTypeMatch(taskType, learningItem);
  const tagOverlap = overlapScore(taskTags, learningTags);
  const genericity = computeGenericityScore(learningItem);
  const contextual = getContextualSuccessRate(learningItem, {
    domain,
    subdomain,
    taskType
  });
  const sourceWeight = computeSourceWeight(
    {
      ...taskContext,
      domain,
      subdomain,
      taskType
    },
    learningItem
  );
  const contextualScore = Number((contextual.successRate * 8 + Math.min(contextual.usageCount, 6) * 0.35).toFixed(3));
  const confidenceScore = Number((Number(learningItem.confidence || 0) * 5).toFixed(3));
  const recencyScore = scoreRecency(learningItem);
  const recentUsefulnessScore = scoreRecentUsefulness(learningItem);
  const genericityPenalty = Number((genericity.score * 7).toFixed(3));
  const rawScore =
    domainScore.score +
    taskTypeScore +
    Math.min(tagOverlap * 1.5, 6) +
    contextualScore +
    confidenceScore +
    recencyScore +
    recentUsefulnessScore -
    genericityPenalty;
  const finalScore = Number((rawScore * sourceWeight).toFixed(3));

  return {
    ...learningItem,
    reuseMeta: {
      taskDomain: domain,
      taskSubdomain: subdomain,
      taskType,
      domainMatch: domainScore.domainMatch,
      contextualScore,
      contextualSource: contextual.source,
      contextualSuccessRate: contextual.successRate,
      genericityPenalty,
      genericityScore: genericity.score,
      sourceWeight: Number(sourceWeight.toFixed(3)),
      tagOverlap,
      taskTypeScore,
      confidenceScore,
      recencyScore,
      recentUsefulnessScore,
      finalScore,
      reuseReason:
        domainScore.domainMatch === "strong"
          ? `matched ${subdomain} with ${contextual.source} success data`
          : domainScore.domainMatch === "medium"
            ? `matched ${domain} with ${contextual.source} success data`
            : `weak match kept only because of strong contextual success`,
      projectAffinity:
        sourceWeight > 1
          ? `${learningItem.projectType || "internal"} favored for ${inferProjectType(taskContext)} task`
          : `${learningItem.projectType || "internal"} de-prioritized for ${inferProjectType(taskContext)} task`
    }
  };
}

export function rankRelevantLearnings(taskContext = {}, candidates = []) {
  const domain = deriveDomain(taskContext);

  return candidates
    .map((candidate) => computeLearningRelevance(taskContext, candidate))
    .filter((candidate) => candidate.reuseMeta.finalScore > 7)
    .filter(
      (candidate) =>
        candidate.reuseMeta.genericityPenalty <= 5.2 ||
        candidate.reuseMeta.domainMatch === "strong" ||
        ["simple_chat", "brainstorm"].includes(domain)
    )
    .filter(
      (candidate) =>
        candidate.reuseMeta.domainMatch !== "generic" ||
        ["simple_chat", "brainstorm"].includes(domain)
    )
    .sort(
      (left, right) =>
        right.reuseMeta.finalScore - left.reuseMeta.finalScore ||
        (right.score || 0) - (left.score || 0)
    );
}

export function selectTopLearnings(taskContext = {}, ranked = []) {
  if (!ranked.length) {
    return [];
  }

  const maxItems = deriveSelectionLimit(taskContext);
  const selected = [ranked[0]];
  const topScore = ranked[0].reuseMeta.finalScore;

  for (const candidate of ranked.slice(1)) {
    if (selected.length >= maxItems) {
      break;
    }

    const sameCategory = selected.some(
      (item) =>
        item.category === candidate.category &&
        item.type === candidate.type
    );
    const closeEnough = candidate.reuseMeta.finalScore >= topScore * 0.78;
    const specificEnough =
      candidate.reuseMeta.genericityPenalty <= 4.8 ||
      candidate.reuseMeta.domainMatch === "strong";

    if (closeEnough && specificEnough && !sameCategory) {
      selected.push(candidate);
    }
  }

  return selected;
}

export async function getRelevantLearnings(taskContext = {}, learningStore, options = {}) {
  if (!learningStore) {
    return [];
  }

  const category = inferLearningCategory(taskContext);
  const subdomain = detectTaskSubdomain(taskContext);
  const taskType = detectTaskType(taskContext);
  const tags = inferLearningTags(taskContext);
  const projectType = inferProjectType(taskContext);
  const result = await learningStore.searchLearnings(
    {
      ...taskContext,
      category,
      subdomain,
      taskType,
      categories: uniq([category, subdomain, ...(taskContext.categories || [])]),
      tags,
      projectType
    },
    {
      limit: options.limit || 4,
      candidateLimit: options.candidateLimit || 18,
      minConfidence: options.minConfidence
    }
  );

  const ranked = rankRelevantLearnings(
    {
      ...taskContext,
      category,
      subdomain,
      taskType,
      projectType
    },
    result.items || []
  );
  const selected = selectTopLearnings(
    {
      ...taskContext,
      category,
      subdomain,
      taskType,
      projectType
    },
    ranked
  );

  if (deriveDomain(taskContext) === "github_research") {
    return selected.filter((item) => item.category !== "general");
  }

  return selected;
}

export function buildLearningGuidance(learnings = [], { domain = "", projectType = "internal" } = {}) {
  if (!learnings.length) {
    return "";
  }

  const patterns = learnings
    .filter((item) => item.type === "pattern")
    .slice(0, 2)
    .map(
      (item) =>
        `${item.category}: ${item.description} [${item.reuseMeta?.reuseReason || "relevant"}]`
    );
  const strategies = learnings
    .filter((item) => item.type === "strategy")
    .slice(0, 1)
    .map(
      (item) =>
        `${item.description} [${item.reuseMeta?.reuseReason || "validated"}]`
    );
  const mistakes = learnings
    .filter((item) => item.type === "mistake")
    .slice(0, 1)
    .map((item) => item.description);
  const templates =
    projectType === "internal"
      ? learnings
          .filter((item) => item.type === "template")
          .slice(0, 1)
          .map((item) => item.description)
      : [];

  return [
    patterns.length ? `Validated patterns: ${patterns.join(" | ")}` : "",
    strategies.length ? `Known successful strategy: ${strategies.join(" | ")}` : "",
    templates.length ? `Reusable template: ${templates.join(" | ")}` : "",
    mistakes.length ? `Avoid repeating: ${mistakes.join(" | ")}` : "",
    domain === "github_research"
      ? "Prefer deterministic repository analysis over speculative conclusions."
      : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function summarizeLearningUsage(learnings = [], { limit = 2 } = {}) {
  const priority = {
    strategy: 0,
    template: 1,
    pattern: 2,
    mistake: 3
  };

  return [...learnings]
    .sort((left, right) => {
      const projectDelta =
        (left.projectType === "internal" ? 0 : 1) -
        (right.projectType === "internal" ? 0 : 1);
      if (projectDelta !== 0) {
        return projectDelta;
      }
      return (priority[left.type] ?? 10) - (priority[right.type] ?? 10);
    })
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      type: item.type,
      category: item.category,
      description: item.description,
      source: item.source,
      confidence: item.confidence,
      projectType: item.projectType,
      reuseReason: item.reuseMeta?.reuseReason || "",
      domainMatch: item.reuseMeta?.domainMatch || "unknown",
      taskSubdomain: item.reuseMeta?.taskSubdomain || "",
      taskType: item.reuseMeta?.taskType || "",
      contextualScore: item.reuseMeta?.contextualScore || 0,
      contextualSource: item.reuseMeta?.contextualSource || "global",
      contextualSuccessRate: item.reuseMeta?.contextualSuccessRate || 0,
      genericityScore: item.reuseMeta?.genericityScore || 0,
      genericityPenalty: item.reuseMeta?.genericityPenalty || 0,
      sourceWeight: item.reuseMeta?.sourceWeight || 1,
      projectAffinity: item.reuseMeta?.projectAffinity || "",
      finalScore: item.reuseMeta?.finalScore || 0
    }));
}

export default {
  inferLearningCategory,
  detectTaskSubdomain,
  detectTaskType,
  inferLearningTags,
  inferProjectType,
  computeLearningRelevance,
  scoreLearningForDomain,
  rankRelevantLearnings,
  selectTopLearnings,
  getRelevantLearnings,
  buildLearningGuidance,
  summarizeLearningUsage
};
