export const LEARNING_ITEM_TYPES = Object.freeze([
  "pattern",
  "template",
  "mistake",
  "strategy"
]);

export const LEARNING_PROJECT_TYPES = Object.freeze([
  "internal",
  "external"
]);

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeTags(tags = []) {
  return [...new Set(
    (Array.isArray(tags) ? tags : [tags])
      .map((item) => normalizeString(item).toLowerCase())
      .filter(Boolean)
  )];
}

function normalizeContextStats(contextStats = {}) {
  if (!contextStats || typeof contextStats !== "object") {
    return {
      exact: {},
      byDomain: {},
      bySubdomain: {},
      byTaskType: {}
    };
  }

  return {
    exact: contextStats.exact || {},
    byDomain: contextStats.byDomain || {},
    bySubdomain: contextStats.bySubdomain || {},
    byTaskType: contextStats.byTaskType || {}
  };
}

export function computeLearningScore(item = {}) {
  const confidence = Number(item.confidence || 0);
  const successRate = Number(item.successRate || 0);
  const usageCount = Number(item.usageCount || 0);
  const contextualSupport = Object.values(normalizeContextStats(item.contextStats).exact).reduce(
    (sum, entry) => sum + Number(entry.usageCount || 0),
    0
  );
  return Number(
    (
      confidence * 0.42 +
      successRate * 0.38 +
      Math.min(usageCount, 10) * 0.012 +
      Math.min(contextualSupport, 8) * 0.01
    ).toFixed(3)
  );
}

export function buildLearningKey(item = {}) {
  return [
    normalizeString(item.type || "pattern").toLowerCase(),
    normalizeString(item.category || "general").toLowerCase(),
    normalizeString(item.projectType || "internal").toLowerCase(),
    normalizeString(item.description || "").toLowerCase()
  ].join("::");
}

export function normalizeLearningItem(item = {}) {
  const type = LEARNING_ITEM_TYPES.includes(item.type) ? item.type : "pattern";
  const projectType = LEARNING_PROJECT_TYPES.includes(item.projectType)
    ? item.projectType
    : "internal";
  const confidence = Math.max(0, Math.min(1, Number(item.confidence || 0.5)));
  const successRate = Math.max(0, Math.min(1, Number(item.successRate ?? confidence)));
  const usageCount = Math.max(0, Number(item.usageCount || 0));
  const description = normalizeString(item.description);

  return {
    id: normalizeString(item.id),
    type,
    category: normalizeString(item.category || "general").toLowerCase(),
    description,
    source: item.source || {},
    projectType,
    status: normalizeString(item.status || "active").toLowerCase() || "active",
    confidence,
    usageCount,
    successRate,
    reusableFor: normalizeTags(item.reusableFor || item.tags || []),
    createdAt: normalizeString(item.createdAt) || new Date().toISOString(),
    updatedAt: normalizeString(item.updatedAt) || new Date().toISOString(),
    lastUsedAt: normalizeString(item.lastUsedAt) || "",
    archivedAt: normalizeString(item.archivedAt) || "",
    disabledAt: normalizeString(item.disabledAt) || "",
    audit: item.audit || null,
    contextStats: normalizeContextStats(item.contextStats),
    score: computeLearningScore({
      confidence,
      successRate,
      usageCount,
      contextStats: item.contextStats
    })
  };
}

export default {
  LEARNING_ITEM_TYPES,
  LEARNING_PROJECT_TYPES,
  normalizeLearningItem,
  computeLearningScore,
  buildLearningKey
};
