import { computeGenericityScore } from "./learning.genericityScore.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function daysSince(dateValue = "") {
  if (!dateValue) {
    return 9999;
  }

  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) {
    return 9999;
  }

  return Math.max(0, Math.round((Date.now() - timestamp) / 86400000));
}

function inferSuggestedCategory(item = {}) {
  const description = normalizeText(item.description);
  const tags = normalizeText((item.reusableFor || []).join(" "));
  const haystack = `${description} ${tags}`;

  if (/\b(auth|jwt|oauth|session|middleware)\b/.test(haystack)) {
    return "auth";
  }
  if (/\b(api|rest|endpoint|webhook)\b/.test(haystack)) {
    return "api";
  }
  if (/\b(react|vue|frontend|component|layout|dashboard)\b/.test(haystack)) {
    return "frontend";
  }
  if (/\b(sql|sqlite|postgres|mysql|database)\b/.test(haystack)) {
    return "database";
  }
  if (/\b(github|repo|repository|octokit|probot)\b/.test(haystack)) {
    return "github";
  }
  if (/\b(node|express|backend|server|controller|service)\b/.test(haystack)) {
    return "backend";
  }
  if (/\b(agent|runtime|memory|tool|orchestrator)\b/.test(haystack)) {
    return "agent";
  }

  return item.category || "general";
}

export function auditLearningItem(item = {}) {
  const genericity = computeGenericityScore(item);
  const ageDays = daysSince(item.updatedAt || item.lastUsedAt || item.createdAt);
  const usageCount = Number(item.usageCount || 0);
  const successRate = Number(item.successRate || 0);
  const confidence = Number(item.confidence || 0);
  const suggestedCategory = inferSuggestedCategory(item);
  const flags = [];
  let action = "keep";

  if (genericity.score >= 0.72) {
    flags.push("too_generic");
  }
  if (usageCount <= 1 && ageDays > 120) {
    flags.push("low_usage_old");
  }
  if (successRate > 0 && successRate < 0.42) {
    flags.push("low_success");
  }
  if (ageDays > 365) {
    flags.push("stale");
  }
  if (
    suggestedCategory &&
    suggestedCategory !== (item.category || "general") &&
    genericity.score < 0.8
  ) {
    flags.push("category_mismatch");
  }

  if (flags.includes("too_generic") && flags.includes("low_usage_old")) {
    action = "archive";
  } else if (flags.includes("low_success") && usageCount >= 2) {
    action = "disable";
  } else if (flags.includes("category_mismatch")) {
    action = "recategorize";
  } else if (flags.includes("too_generic") || flags.includes("stale")) {
    action = "downgrade";
  }

  return {
    itemId: item.id || "",
    genericityScore: genericity.score,
    ageDays,
    flags,
    action,
    suggestedCategory
  };
}

export function auditLearningStoreItems(items = []) {
  const audits = items.map((item) => ({
    item,
    audit: auditLearningItem(item)
  }));

  return {
    total: audits.length,
    flagged: audits.filter((entry) => entry.audit.flags.length > 0).length,
    actions: audits.reduce((accumulator, entry) => {
      const key = entry.audit.action;
      accumulator[key] = Number(accumulator[key] || 0) + 1;
      return accumulator;
    }, {}),
    entries: audits
  };
}

export default {
  auditLearningItem,
  auditLearningStoreItems
};
