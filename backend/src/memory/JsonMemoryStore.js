import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MemoryStore } from "../types/contracts.js";
import { consolidateConversationState } from "./memory.consolidation.js";
import { classifyMemoryBucket } from "./memory.hierarchy.js";
import { computeMemoryPriority } from "./memory.prioritization.js";
import { applyMemoryForgetting } from "./memory.forgetting.js";
import { buildMemoryLinks } from "./memory.links.js";

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function tokenize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9_-]+/i)
    .filter((token) => token.length > 2);
}

function overlapScore(queryTokens, value = "") {
  const tokens = tokenize(value);
  let score = 0;

  for (const token of queryTokens) {
    if (tokens.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function nowIso() {
  return new Date().toISOString();
}

function createDefaultState() {
  return {
    version: 3,
    shortTerm: {},
    midTerm: {},
    workingMemory: {},
    longTerm: {},
    strategicMemory: {},
    projectMemory: {},
    patternMemory: {},
    memoryLinks: {},
    taskOutcomes: {},
    errorMemories: {}
  };
}

export class JsonMemoryStore extends MemoryStore {
  constructor({
    filePath,
    maxShortTermPerConversation = 16,
    maxMidTermPerConversation = 36,
    maxLongTermPerUser = 80,
    maxTaskOutcomesPerUser = 120,
    consolidateEveryTurns = 6
  }) {
    super();
    this.filePath = filePath;
    this.maxShortTermPerConversation = maxShortTermPerConversation;
    this.maxMidTermPerConversation = maxMidTermPerConversation;
    this.maxLongTermPerUser = maxLongTermPerUser;
    this.maxTaskOutcomesPerUser = maxTaskOutcomesPerUser;
    this.consolidateEveryTurns = consolidateEveryTurns;
    ensureDirectory(this.filePath);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(createDefaultState(), null, 2));
    }
  }

  readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return {
        version: parsed.version || 3,
        shortTerm: parsed.shortTerm || {},
        midTerm: parsed.midTerm || {},
        workingMemory: parsed.workingMemory || {},
        longTerm: parsed.longTerm || {},
        strategicMemory: parsed.strategicMemory || {},
        projectMemory: parsed.projectMemory || {},
        patternMemory: parsed.patternMemory || {},
        memoryLinks: parsed.memoryLinks || {},
        taskOutcomes: parsed.taskOutcomes || {},
        errorMemories: parsed.errorMemories || {}
      };
    } catch {
      return createDefaultState();
    }
  }

  writeState(nextState) {
    fs.writeFileSync(this.filePath, JSON.stringify(nextState, null, 2));
  }

  async recallContext({ userId, conversationId, prompt, limit = 4 }) {
    const state = this.readState();
    const userKey = String(userId);
    const conversationKey = String(conversationId);
    const queryTokens = tokenize(prompt);

    const shortTerm = (state.shortTerm[conversationKey] || []).slice(-limit);
    const midTerm = (state.midTerm[conversationKey] || []).slice(0, limit);
    const workingMemory = state.workingMemory[conversationKey] || null;
    const longTerm = (state.longTerm[userKey] || [])
      .map((item) => ({
        ...item,
        score: overlapScore(queryTokens, `${item.content} ${(item.tags || []).join(" ")}`) +
          Number(item.score || 0)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
    const strategicMemory = (state.strategicMemory[userKey] || [])
      .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
      .slice(0, limit);
    const projectMemory = (state.projectMemory[userKey] || [])
      .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
      .slice(0, limit);
    const patternMemory = (state.patternMemory[userKey] || [])
      .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
      .slice(0, limit);

    const taskPatterns = (state.taskOutcomes[userKey] || [])
      .map((item) => ({
        ...item,
        score:
          overlapScore(
            queryTokens,
            `${item.prompt} ${item.summary} ${item.classification} ${item.outcome}`
          ) + Number(item.score || 0)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
    const errorPatterns = (state.errorMemories[userKey] || [])
      .map((item) => ({
        ...item,
        score:
          overlapScore(queryTokens, `${item.summary} ${item.outcome} ${item.classification}`) +
          Number(item.score || 0)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    return {
      shortTerm,
      midTerm,
      workingMemory,
      longTerm,
      strategicMemory,
      projectMemory,
      patternMemory,
      memoryLinks: state.memoryLinks[userKey] || [],
      taskPatterns,
      errorPatterns
    };
  }

  async appendShortTermEvent({
    conversationId,
    role,
    content,
    metadata = {}
  }) {
    const state = this.readState();
    const conversationKey = String(conversationId);
    const history = state.shortTerm[conversationKey] || [];

    history.push({
      id: randomUUID(),
      role,
      content: String(content || "").trim(),
      metadata,
      createdAt: nowIso()
    });

    state.shortTerm[conversationKey] = history.slice(-this.maxShortTermPerConversation);
    consolidateConversationState(state, conversationKey, {
      consolidateEveryTurns: this.consolidateEveryTurns,
      midTermLimit: this.maxMidTermPerConversation
    });
    this.writeState(state);
    return state.shortTerm[conversationKey];
  }

  async setWorkingMemory(conversationId, workingMemory) {
    const state = this.readState();
    const conversationKey = String(conversationId);
    state.workingMemory[conversationKey] = {
      ...workingMemory,
      updatedAt: nowIso()
    };
    this.writeState(state);
    return state.workingMemory[conversationKey];
  }

  async addLongTermMemory({
    userId,
    type = "fact",
    content,
    score = 0.5,
    tags = [],
    source = {}
  }) {
    const cleanContent = String(content || "").trim();
    if (!cleanContent) {
      return null;
    }

    const state = this.readState();
    const userKey = String(userId);
    const memoryBucketName = classifyMemoryBucket({
      type,
      content: cleanContent,
      source
    });
    const bucket = state[memoryBucketName][userKey] || [];
    const existing = bucket.find(
      (item) => item.type === type && item.content.toLowerCase() === cleanContent.toLowerCase()
    );

    if (existing) {
      existing.score = Math.max(Number(existing.score || 0), Number(score || 0));
      existing.tags = [...new Set([...(existing.tags || []), ...tags])];
      existing.source = source || existing.source;
      existing.updatedAt = nowIso();
      existing.priority = computeMemoryPriority(existing);
      state[memoryBucketName][userKey] = applyMemoryForgetting(bucket, {
        limit: this.maxLongTermPerUser
      });
      state.memoryLinks[userKey] = buildMemoryLinks([
        ...(state.longTerm[userKey] || []),
        ...(state.strategicMemory[userKey] || []),
        ...(state.projectMemory[userKey] || []),
        ...(state.patternMemory[userKey] || [])
      ]);
      this.writeState(state);
      return existing;
    }

    const record = {
      id: randomUUID(),
      type,
      content: cleanContent,
      score,
      successRate: score,
      usageCount: 0,
      tags,
      source,
      priority: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    record.priority = computeMemoryPriority(record);

    state[memoryBucketName][userKey] = applyMemoryForgetting([record, ...bucket], {
      limit: this.maxLongTermPerUser
    });
    state.memoryLinks[userKey] = buildMemoryLinks([
      ...(state.longTerm[userKey] || []),
      ...(state.strategicMemory[userKey] || []),
      ...(state.projectMemory[userKey] || []),
      ...(state.patternMemory[userKey] || [])
    ]);
    this.writeState(state);
    return record;
  }

  async recordTaskOutcome({
    userId,
    conversationId,
    prompt,
    classification,
    success,
    score,
    summary,
    outcome,
    planSnapshot = null,
    critique = null
  }) {
    const state = this.readState();
    const userKey = String(userId);
    const bucket = state.taskOutcomes[userKey] || [];

    const record = {
      id: randomUUID(),
      conversationId,
      prompt,
      classification,
      success,
      score,
      summary,
      outcome,
      critique,
      planSnapshot,
      createdAt: nowIso()
    };

    state.taskOutcomes[userKey] = [record, ...bucket].slice(0, this.maxTaskOutcomesPerUser);

    if (!success) {
      const errorBucket = state.errorMemories[userKey] || [];
      state.errorMemories[userKey] = [
        {
          id: randomUUID(),
          conversationId,
          classification,
          prompt,
          summary,
          outcome,
          score,
          createdAt: nowIso()
        },
        ...errorBucket
      ].slice(0, this.maxTaskOutcomesPerUser);
    }

    this.writeState(state);
    return record;
  }
}

export default JsonMemoryStore;
