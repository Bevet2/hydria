import { db } from "../../db/sqlite.js";
import { nowIso } from "../../utils/time.js";
import { updateUserPreferences } from "./profileService.js";
import {
  getConversationById,
  getConversationMessages,
  getUserById
} from "./historyService.js";
import {
  createConversationSummary,
  shouldSummarizeConversation
} from "./summarizerService.js";

function tokenize(text) {
  return new Set(
    String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9_-]+/i)
      .filter((token) => token.length > 2)
  );
}

function scoreMemoryAgainstPrompt(memory, promptTokens) {
  const memoryTokens = tokenize(memory.content);
  let overlap = 0;

  for (const token of promptTokens) {
    if (memoryTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap + Number(memory.importance_score || 0);
}

function mapMemory(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    importance_score: Number(row.importance_score)
  };
}

export function getAllUserMemory(userId, { limit = 50 } = {}) {
  return db
    .prepare(
      `
      SELECT *
      FROM user_memory
      WHERE user_id = ?
      ORDER BY importance_score DESC, updated_at DESC
      LIMIT ?
      `
    )
    .all(userId, limit)
    .map(mapMemory);
}

export function getConversationSummary(conversationId) {
  return mapMemory(
    db
      .prepare(
        `
        SELECT *
        FROM user_memory
        WHERE source_conversation_id = ? AND memory_type = 'summary'
        ORDER BY updated_at DESC
        LIMIT 1
        `
      )
      .get(conversationId)
  );
}

export function saveMemory({
  userId,
  memoryType,
  content,
  importanceScore = 0.5,
  sourceConversationId = null
}) {
  const cleanContent = (content || "").trim();
  if (!cleanContent || !getUserById(userId)) {
    return null;
  }

  const existing = db
    .prepare(
      `
      SELECT *
      FROM user_memory
      WHERE user_id = ? AND memory_type = ? AND content = ?
      LIMIT 1
      `
    )
    .get(userId, memoryType, cleanContent);

  const timestamp = nowIso();

  if (existing) {
    db.prepare(
      `
      UPDATE user_memory
      SET importance_score = ?, source_conversation_id = ?, updated_at = ?
      WHERE id = ?
      `
    ).run(importanceScore, sourceConversationId, timestamp, existing.id);

    return mapMemory(db.prepare("SELECT * FROM user_memory WHERE id = ?").get(existing.id));
  }

  const result = db
    .prepare(
      `
      INSERT INTO user_memory (
        user_id,
        memory_type,
        content,
        importance_score,
        source_conversation_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      userId,
      memoryType,
      cleanContent,
      importanceScore,
      sourceConversationId,
      timestamp,
      timestamp
    );

  return mapMemory(db.prepare("SELECT * FROM user_memory WHERE id = ?").get(result.lastInsertRowid));
}

export function getRelevantMemoryForPrompt(userId, prompt, { limit = 5 } = {}) {
  const promptTokens = tokenize(prompt);
  const rows = db
    .prepare(
      `
      SELECT *
      FROM user_memory
      WHERE user_id = ? AND memory_type IN ('long_term', 'preference', 'fact')
      ORDER BY updated_at DESC
      `
    )
    .all(userId)
    .map(mapMemory);

  return rows
    .map((memory) => ({
      ...memory,
      relevance: scoreMemoryAgainstPrompt(memory, promptTokens)
    }))
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, limit);
}

export function summarizeConversationIfNeeded({ conversationId, userId }) {
  const conversation = getConversationById(conversationId);
  if (!conversation || Number(conversation.user_id) !== Number(userId)) {
    return null;
  }

  const messages = getConversationMessages(conversationId);
  if (!shouldSummarizeConversation(messages)) {
    return null;
  }

  const summary = createConversationSummary(messages);
  return saveMemory({
    userId,
    memoryType: "summary",
    content: summary,
    importanceScore: 0.72,
    sourceConversationId: conversationId
  });
}

function detectPreferenceMemory(prompt) {
  const captures = [];
  const normalized = prompt
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const languageMatch = normalized.match(
    /(?:reponds?|parle|write|answer)\s+(?:en|in)\s+([a-z-]+)/i
  );
  if (languageMatch) {
    captures.push({
      memoryType: "preference",
      content: `Preferred language: ${languageMatch[1]}`,
      importanceScore: 0.95,
      preferenceKey: "preferred_language",
      preferenceValue: languageMatch[1]
    });
  }

  const toneMatch = normalized.match(
    /(?:ton|tone)\s+(?:prefere|preferred)\s*[:=]?\s*([a-z -]+)/i
  );
  if (toneMatch) {
    captures.push({
      memoryType: "preference",
      content: `Preferred tone: ${toneMatch[1].trim()}`,
      importanceScore: 0.84,
      preferenceKey: "preferred_tone",
      preferenceValue: toneMatch[1].trim()
    });
  }

  const responseFormatMatch = normalized.match(
    /(?:format|structure)\s+(?:de reponse|response)\s*[:=]?\s*([a-z0-9 ,_-]+)/i
  );
  if (responseFormatMatch) {
    captures.push({
      memoryType: "preference",
      content: `Preferred response format: ${responseFormatMatch[1].trim()}`,
      importanceScore: 0.8,
      preferenceKey: "response_format",
      preferenceValue: responseFormatMatch[1].trim()
    });
  }

  return captures;
}

function detectFactMemory(prompt) {
  const captures = [];

  const projectMatch = prompt.match(
    /(?:je travaille sur|mon projet est|i am working on|my project is)\s+([^.!?\n]+)/i
  );
  if (projectMatch) {
    captures.push({
      memoryType: "long_term",
      content: `Active project: ${projectMatch[1].trim()}`,
      importanceScore: 0.88
    });
  }

  const toolMatch = prompt.match(
    /(?:j'utilise|i use|nous utilisons|we use)\s+([^.!?\n]+)/i
  );
  if (toolMatch) {
    captures.push({
      memoryType: "fact",
      content: `Known tools: ${toolMatch[1].trim()}`,
      importanceScore: 0.7
    });
  }

  return captures;
}

export function storeUsefulMemory({
  userId,
  conversationId,
  prompt,
  classification
}) {
  const stored = [];
  const candidates = [
    ...detectPreferenceMemory(prompt),
    ...detectFactMemory(prompt)
  ];

  const preferenceUpdates = {};

  for (const candidate of candidates) {
    const memory = saveMemory({
      userId,
      memoryType: candidate.memoryType,
      content: candidate.content,
      importanceScore: candidate.importanceScore,
      sourceConversationId: conversationId
    });

    if (memory) {
      stored.push(memory);
    }

    if (candidate.preferenceKey) {
      preferenceUpdates[candidate.preferenceKey] = candidate.preferenceValue;
    }
  }

  if (
    classification === "coding" &&
    prompt.length > 40 &&
    !candidates.some((candidate) => candidate.memoryType === "long_term")
  ) {
    const codingMemory = saveMemory({
      userId,
      memoryType: "fact",
      content: `Coding topic discussed: ${prompt.slice(0, 140).trim()}`,
      importanceScore: 0.56,
      sourceConversationId: conversationId
    });

    if (codingMemory) {
      stored.push(codingMemory);
    }
  }

  if (Object.keys(preferenceUpdates).length) {
    updateUserPreferences(userId, preferenceUpdates);
  }

  return stored;
}
