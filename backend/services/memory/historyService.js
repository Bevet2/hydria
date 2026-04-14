import { db } from "../../db/sqlite.js";
import { AppError } from "../../utils/errors.js";
import { nowIso } from "../../utils/time.js";

function parseJsonArray(value) {
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}

function mapMessage(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    models_used: parseJsonArray(row.models_used),
    apis_used: parseJsonArray(row.apis_used)
  };
}

function mapConversation(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    message_count: Number(row.message_count || 0)
  };
}

function parseExecutionPlan(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

export function deriveConversationTitle(prompt) {
  const clean = (prompt || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    return "Nouvelle conversation";
  }

  return clean.slice(0, 80);
}

export function listUsers() {
  return db
    .prepare("SELECT * FROM users ORDER BY updated_at DESC, created_at DESC")
    .all();
}

export function getUserById(userId) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) || null;
}

export function createUser(username) {
  const cleanUsername = (username || "").trim();
  if (!cleanUsername) {
    throw new AppError("username is required", 400);
  }

  const existing = db
    .prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)")
    .get(cleanUsername);

  if (existing) {
    return existing;
  }

  const timestamp = nowIso();
  const result = db
    .prepare(
      `
      INSERT INTO users (username, created_at, updated_at)
      VALUES (?, ?, ?)
      `
    )
    .run(cleanUsername, timestamp, timestamp);

  return getUserById(result.lastInsertRowid);
}

export function createConversation({ userId, title }) {
  const user = getUserById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const timestamp = nowIso();
  const result = db
    .prepare(
      `
      INSERT INTO conversations (user_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      `
    )
    .run(userId, (title || "Nouvelle conversation").trim(), timestamp, timestamp);

  return getConversationById(result.lastInsertRowid);
}

export function getConversationById(conversationId) {
  return (
    db
      .prepare(
        `
        SELECT
          conversations.*,
          (
            SELECT COUNT(*)
            FROM messages
            WHERE messages.conversation_id = conversations.id
          ) AS message_count
        FROM conversations
        WHERE conversations.id = ?
        `
      )
      .get(conversationId) || null
  );
}

export function ensureConversationForUser(conversationId, userId) {
  const conversation = getConversationById(conversationId);

  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  if (Number(conversation.user_id) !== Number(userId)) {
    throw new AppError("Conversation does not belong to the user", 403);
  }

  return conversation;
}

export function listConversationsByUser(userId) {
  return db
    .prepare(
      `
      SELECT
        conversations.*,
        (
          SELECT COUNT(*)
          FROM messages
          WHERE messages.conversation_id = conversations.id
        ) AS message_count
      FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC, created_at DESC
      `
    )
    .all(userId)
    .map(mapConversation);
}

export function updateConversationTitle(conversationId, title) {
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) {
    return getConversationById(conversationId);
  }

  db.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?").run(
    cleanTitle,
    nowIso(),
    conversationId
  );

  return getConversationById(conversationId);
}

export function maybeUpdateConversationTitle(conversationId, prompt) {
  const conversation = getConversationById(conversationId);
  if (!conversation) {
    return null;
  }

  const isDefaultTitle =
    conversation.title === "Nouvelle conversation" ||
    conversation.title === "New conversation";

  if (!isDefaultTitle && Number(conversation.message_count) > 1) {
    return conversation;
  }

  return updateConversationTitle(conversationId, deriveConversationTitle(prompt));
}

export function saveMessage({
  conversationId,
  role,
  content,
  classification = null,
  routeUsed = null,
  modelsUsed = [],
  apisUsed = []
}) {
  const conversation = getConversationById(conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  const timestamp = nowIso();
  const result = db
    .prepare(
      `
      INSERT INTO messages (
        conversation_id,
        role,
        content,
        classification,
        route_used,
        models_used,
        apis_used,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      conversationId,
      role,
      content,
      classification,
      routeUsed,
      JSON.stringify(modelsUsed || []),
      JSON.stringify(apisUsed || []),
      timestamp
    );

  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
    timestamp,
    conversationId
  );

  return mapMessage(
    db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid)
  );
}

export function getConversationHistory(conversationId, { limit = 8 } = {}) {
  const rows = db
    .prepare(
      `
      SELECT *
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
      `
    )
    .all(conversationId, limit);

  return rows.reverse().map(mapMessage);
}

export function getConversationMessages(conversationId) {
  return db
    .prepare(
      `
      SELECT *
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC, id ASC
      `
    )
    .all(conversationId)
    .map(mapMessage);
}

export function createExecutionLog({
  conversationId,
  classification,
  executionPlan,
  durationMs,
  status
}) {
  db.prepare(
    `
    INSERT INTO execution_logs (
      conversation_id,
      classification,
      execution_plan,
      duration_ms,
      status,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(
    conversationId,
    classification,
    JSON.stringify(executionPlan),
    durationMs,
    status,
    nowIso()
  );
}

export function getLatestExecutionLog(conversationId) {
  const row = db
    .prepare(
      `
      SELECT *
      FROM execution_logs
      WHERE conversation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `
    )
    .get(conversationId);

  if (!row) {
    return null;
  }

  return {
    ...row,
    execution_plan: parseExecutionPlan(row.execution_plan)
  };
}

export function clearConversationMessages(conversationId) {
  const conversation = getConversationById(conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(conversationId);
  db.prepare("DELETE FROM execution_logs WHERE conversation_id = ?").run(conversationId);
  db.prepare(
    "DELETE FROM user_memory WHERE source_conversation_id = ? AND memory_type = 'summary'"
  ).run(conversationId);
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
    nowIso(),
    conversationId
  );

  return getConversationById(conversationId);
}
