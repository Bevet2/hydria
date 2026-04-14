import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  buildLearningKey,
  computeLearningScore,
  normalizeLearningItem
} from "./learning.types.js";
import { updateLearningContextStats } from "./learning.contextStats.js";

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createDefaultState() {
  return {
    version: 1,
    items: []
  };
}

function isActiveItem(item = {}) {
  return !["archived", "disabled"].includes(String(item.status || "active").toLowerCase());
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
    .filter((token) => token.length >= 2);
}

function overlapScore(queryTokens = [], item = {}) {
  const haystack = tokenize(
    [
      item.category,
      item.description,
      ...(item.reusableFor || [])
    ].join(" ")
  );

  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function buildSearchScore(item = {}, queryTokens = [], preferredCategories = []) {
  const textOverlap = overlapScore(queryTokens, item);
  let score = textOverlap;
  if (preferredCategories.includes(item.category)) {
    score += 4;
  }
  score += Number(item.score || computeLearningScore(item)) * 10;
  return {
    score: Number(score.toFixed(3)),
    textOverlap
  };
}

function mergeContextBucketMaps(left = {}, right = {}) {
  const merged = {};
  const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);

  for (const key of keys) {
    const leftEntry = left?.[key] || {};
    const rightEntry = right?.[key] || {};
    const usageCount =
      Number(leftEntry.usageCount || 0) + Number(rightEntry.usageCount || 0);
    const successCount =
      Number(leftEntry.successCount || 0) + Number(rightEntry.successCount || 0);
    const explicitSuccessRate =
      rightEntry.successRate !== undefined ? Number(rightEntry.successRate || 0) : null;
    merged[key] = {
      usageCount,
      successCount,
      successRate:
        explicitSuccessRate !== null
          ? explicitSuccessRate
          : Number((successCount / Math.max(usageCount, 1)).toFixed(3)),
      updatedAt: rightEntry.updatedAt || leftEntry.updatedAt || ""
    };
  }

  return merged;
}

function mergeItems(current = {}, incoming = {}) {
  const mergedContextStats = {
    exact: mergeContextBucketMaps(
      (current.contextStats || {}).exact || {},
      (incoming.contextStats || {}).exact || {}
    ),
    byDomain: mergeContextBucketMaps(
      (current.contextStats || {}).byDomain || {},
      (incoming.contextStats || {}).byDomain || {}
    ),
    bySubdomain: mergeContextBucketMaps(
      (current.contextStats || {}).bySubdomain || {},
      (incoming.contextStats || {}).bySubdomain || {}
    ),
    byTaskType: mergeContextBucketMaps(
      (current.contextStats || {}).byTaskType || {},
      (incoming.contextStats || {}).byTaskType || {}
    )
  };
  const merged = normalizeLearningItem({
    ...current,
    ...incoming,
    id: current.id || incoming.id || randomUUID(),
    confidence: Math.max(Number(current.confidence || 0), Number(incoming.confidence || 0)),
    successRate: Number(
      (
        (Number(current.successRate || 0) + Number(incoming.successRate || 0)) /
        (current.successRate !== undefined && incoming.successRate !== undefined ? 2 : 1)
      ).toFixed(3)
    ) || Number(current.successRate || incoming.successRate || 0.5),
    usageCount: Math.max(Number(current.usageCount || 0), Number(incoming.usageCount || 0)),
    reusableFor:
      (incoming.reusableFor || []).length > 0
        ? [...new Set(incoming.reusableFor || [])]
        : [...new Set([...(current.reusableFor || []), ...(incoming.reusableFor || [])])],
    updatedAt: new Date().toISOString(),
    source: incoming.source || current.source || {},
    lastUsedAt: incoming.lastUsedAt || current.lastUsedAt || "",
    contextStats: mergedContextStats
  });

  return {
    ...merged,
    score: computeLearningScore(merged)
  };
}

export class LearningStore {
  constructor({ filePath, maxItems = 400, minConfidence = 0.45 }) {
    this.filePath = filePath;
    this.maxItems = maxItems;
    this.minConfidence = minConfidence;
    ensureDirectory(this.filePath);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(createDefaultState(), null, 2));
    }
  }

  readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return {
        version: parsed.version || 1,
        items: Array.isArray(parsed.items) ? parsed.items.map((item) => normalizeLearningItem(item)) : []
      };
    } catch {
      return createDefaultState();
    }
  }

  writeState(state) {
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  async addLearningItem(item = {}) {
    return this.addLearningItems([item]);
  }

  async addLearningItems(items = []) {
    const normalizedItems = items
      .map((item) => normalizeLearningItem({
        ...item,
        id: item.id || randomUUID()
      }))
      .filter((item) => item.description && item.confidence >= this.minConfidence);

    if (!normalizedItems.length) {
      return [];
    }

    const state = this.readState();
    const nextItems = [...state.items];
    const keyToIndex = new Map(
      nextItems.map((item, index) => [buildLearningKey(item), index])
    );
    const addedOrUpdated = [];

    for (const item of normalizedItems) {
      const key = buildLearningKey(item);
      if (keyToIndex.has(key)) {
        const index = keyToIndex.get(key);
        nextItems[index] = mergeItems(nextItems[index], item);
        addedOrUpdated.push(nextItems[index]);
      } else {
        const normalized = {
          ...item,
          score: computeLearningScore(item)
        };
        nextItems.push(normalized);
        keyToIndex.set(key, nextItems.length - 1);
        addedOrUpdated.push(normalized);
      }
    }

    nextItems.sort((left, right) => (right.score || 0) - (left.score || 0));
    state.items = nextItems.slice(0, this.maxItems);
    this.writeState(state);
    return addedOrUpdated;
  }

  async getLearningsByCategory(category = "", { limit = 8, type = "", projectType = "" } = {}) {
    const state = this.readState();
    return state.items
      .filter((item) => isActiveItem(item))
      .filter((item) => (category ? item.category === category : true))
      .filter((item) => (type ? item.type === type : true))
      .filter((item) => (projectType ? item.projectType === projectType : true))
      .sort((left, right) => (right.score || 0) - (left.score || 0))
      .slice(0, limit);
  }

  async getTopLearnings({ limit = 10, type = "", projectType = "" } = {}) {
    const state = this.readState();
    return state.items
      .filter((item) => isActiveItem(item))
      .filter((item) => (type ? item.type === type : true))
      .filter((item) => (projectType ? item.projectType === projectType : true))
      .sort((left, right) => (right.score || 0) - (left.score || 0))
      .slice(0, limit);
  }

  async searchLearnings(
    taskContext = {},
    {
      limit = 4,
      minConfidence = this.minConfidence,
      candidateLimit = 16
    } = {}
  ) {
    const prompt = taskContext.prompt || taskContext.resolvedPrompt || "";
    const queryTokens = tokenize(
      [
        prompt,
        taskContext.classification,
        taskContext.domain,
        ...(taskContext.tags || [])
      ].join(" ")
    );
    const preferredCategories = [...new Set(taskContext.categories || [])];
    const state = this.readState();

    const items = state.items
      .filter((item) => isActiveItem(item))
      .filter((item) => item.confidence >= minConfidence)
      .map((item) => {
        const ranking = buildSearchScore(item, queryTokens, preferredCategories);
        return {
          ...item,
          relevanceScore: ranking.score,
          textOverlap: ranking.textOverlap
        };
      })
      .filter(
        (item) =>
          item.relevanceScore > 4.5 &&
          (item.textOverlap > 0 || preferredCategories.includes(item.category)) &&
          (
            item.category !== "general" ||
            preferredCategories.includes("general") ||
            item.textOverlap >= 2
          )
      )
      .sort((left, right) => right.relevanceScore - left.relevanceScore || (right.score || 0) - (left.score || 0))
      .slice(0, Math.max(limit, candidateLimit));

    return {
      totalMatches: items.length,
      items
    };
  }

  async updateUsageStats(id, { success = null, increment = 1, taskContext = null } = {}) {
    const state = this.readState();
    const item = state.items.find((entry) => entry.id === id);
    if (!item) {
      return null;
    }

    const previousUsage = Number(item.usageCount || 0);
    item.usageCount = previousUsage + Math.max(0, Number(increment || 0));
    if (typeof success === "boolean") {
      const weighted = Number(item.successRate || 0.5) * Math.max(previousUsage, 1);
      item.successRate = Number(
        ((weighted + (success ? 1 : 0)) / Math.max(item.usageCount, 1)).toFixed(3)
      );
    }
    if (taskContext) {
      item.contextStats = updateLearningContextStats(item, taskContext, Boolean(success));
    }
    item.updatedAt = new Date().toISOString();
    item.lastUsedAt = new Date().toISOString();
    item.score = computeLearningScore(item);
    this.writeState(state);
    return item;
  }

  async updateUsageBatch(items = [], { success = null, taskContext = null } = {}) {
    const updated = [];
    for (const item of items) {
      const next = await this.updateUsageStats(item.id, {
        success,
        increment: 1,
        taskContext
      });
      if (next) {
        updated.push(next);
      }
    }
    return updated;
  }
}

export default LearningStore;
