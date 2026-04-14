function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeKeyPart(value = "") {
  return normalizeText(value || "").replace(/[^a-z0-9_-]+/g, "_") || "general";
}

function ensureBucket(target = {}, key) {
  if (!target[key]) {
    target[key] = {
      usageCount: 0,
      successCount: 0,
      successRate: 0.5,
      updatedAt: ""
    };
  }

  return target[key];
}

export function buildLearningContextDescriptor(taskContext = {}) {
  return {
    domain: normalizeKeyPart(taskContext.domain || taskContext.classification || "general"),
    subdomain: normalizeKeyPart(taskContext.subdomain || taskContext.category || "general"),
    taskType: normalizeKeyPart(taskContext.taskType || "general")
  };
}

export function createEmptyContextStats() {
  return {
    exact: {},
    byDomain: {},
    bySubdomain: {},
    byTaskType: {}
  };
}

export function getContextualSuccessRate(item = {}, taskContext = {}) {
  const descriptor = buildLearningContextDescriptor(taskContext);
  const contextStats = item.contextStats || createEmptyContextStats();
  const exactKey = `${descriptor.domain}:${descriptor.subdomain}:${descriptor.taskType}`;
  const exact = contextStats.exact?.[exactKey];
  if (exact) {
    return {
      successRate: Number(exact.successRate || item.successRate || 0.5),
      usageCount: Number(exact.usageCount || 0),
      source: "exact"
    };
  }

  const bySubdomain = contextStats.bySubdomain?.[descriptor.subdomain];
  if (bySubdomain) {
    return {
      successRate: Number(bySubdomain.successRate || item.successRate || 0.5),
      usageCount: Number(bySubdomain.usageCount || 0),
      source: "subdomain"
    };
  }

  const byTaskType = contextStats.byTaskType?.[descriptor.taskType];
  if (byTaskType) {
    return {
      successRate: Number(byTaskType.successRate || item.successRate || 0.5),
      usageCount: Number(byTaskType.usageCount || 0),
      source: "taskType"
    };
  }

  const byDomain = contextStats.byDomain?.[descriptor.domain];
  if (byDomain) {
    return {
      successRate: Number(byDomain.successRate || item.successRate || 0.5),
      usageCount: Number(byDomain.usageCount || 0),
      source: "domain"
    };
  }

  return {
    successRate: Number(item.successRate || 0.5),
    usageCount: Number(item.usageCount || 0),
    source: "global"
  };
}

function updateBucket(bucket, success) {
  bucket.usageCount += 1;
  if (success) {
    bucket.successCount += 1;
  }
  bucket.successRate = Number((bucket.successCount / Math.max(bucket.usageCount, 1)).toFixed(3));
  bucket.updatedAt = new Date().toISOString();
}

export function updateLearningContextStats(item = {}, taskContext = {}, success = false) {
  const descriptor = buildLearningContextDescriptor(taskContext);
  const nextStats = {
    ...(item.contextStats || createEmptyContextStats()),
    exact: { ...((item.contextStats || {}).exact || {}) },
    byDomain: { ...((item.contextStats || {}).byDomain || {}) },
    bySubdomain: { ...((item.contextStats || {}).bySubdomain || {}) },
    byTaskType: { ...((item.contextStats || {}).byTaskType || {}) }
  };
  const exactKey = `${descriptor.domain}:${descriptor.subdomain}:${descriptor.taskType}`;

  updateBucket(ensureBucket(nextStats.exact, exactKey), success);
  updateBucket(ensureBucket(nextStats.byDomain, descriptor.domain), success);
  updateBucket(ensureBucket(nextStats.bySubdomain, descriptor.subdomain), success);
  updateBucket(ensureBucket(nextStats.byTaskType, descriptor.taskType), success);

  return nextStats;
}

export function seedContextStats(taskContext = {}, successRate = 0.5) {
  const seeded = updateLearningContextStats(
    { contextStats: createEmptyContextStats() },
    taskContext,
    successRate >= 0.5
  );
  const descriptor = buildLearningContextDescriptor(taskContext);
  const exactKey = `${descriptor.domain}:${descriptor.subdomain}:${descriptor.taskType}`;
  if (seeded.exact?.[exactKey]) {
    seeded.exact[exactKey].successRate = Number(successRate.toFixed(3));
  }
  if (seeded.byDomain?.[descriptor.domain]) {
    seeded.byDomain[descriptor.domain].successRate = Number(successRate.toFixed(3));
  }
  if (seeded.bySubdomain?.[descriptor.subdomain]) {
    seeded.bySubdomain[descriptor.subdomain].successRate = Number(successRate.toFixed(3));
  }
  if (seeded.byTaskType?.[descriptor.taskType]) {
    seeded.byTaskType[descriptor.taskType].successRate = Number(successRate.toFixed(3));
  }
  return seeded;
}

export default {
  buildLearningContextDescriptor,
  createEmptyContextStats,
  getContextualSuccessRate,
  updateLearningContextStats,
  seedContextStats
};
