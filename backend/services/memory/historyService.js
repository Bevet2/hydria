import { db } from "../../db/sqlite.js";
import { randomUUID } from "node:crypto";
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
    apis_used: parseJsonArray(row.apis_used),
    citations: parseJsonArray(row.citations_json),
    status: row.status || "complete",
    error: row.error || "",
    generation_id: row.generation_id || "",
    updated_at: row.updated_at || row.created_at
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

export function getUserDataRole(userId) {
  if (!userId) return "executive";
  const row = db
    .prepare("SELECT value FROM user_preferences WHERE user_id = ? AND key = ?")
    .get(userId, "data_access_role");
  return row?.value || "executive";
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

export function createConversation({ userId, title, projectId = "", folder = "" }) {
  const user = getUserById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const timestamp = nowIso();
  const result = db
    .prepare(
      `
      INSERT INTO conversations (user_id, title, project_id, folder, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      userId,
      (title || "Nouvelle conversation").trim(),
      String(projectId || "").trim(),
      String(folder || "").trim(),
      timestamp,
      timestamp
    );

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

export function listConversationsByUser(
  userId,
  { search = "", archived = false, folder = "", projectId = "" } = {}
) {
  const query = String(search || "").trim();
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
        AND (${archived ? "archived_at IS NOT NULL" : "archived_at IS NULL"})
        AND (? = '' OR folder = ?)
        AND (? = '' OR project_id = ?)
        AND (
          ? = ''
          OR title LIKE '%' || ? || '%'
          OR EXISTS (
            SELECT 1 FROM messages
            WHERE messages.conversation_id = conversations.id
              AND messages.content LIKE '%' || ? || '%'
          )
        )
      ORDER BY updated_at DESC, created_at DESC
      `
    )
    .all(userId, folder, folder, projectId, projectId, query, query, query)
    .map(mapConversation);
}

export function updateConversation(conversationId, {
  title,
  archived,
  folder,
  projectId
} = {}) {
  const current = getConversationById(conversationId);
  if (!current) throw new AppError("Conversation not found", 404);
  db.prepare(
    `
    UPDATE conversations
    SET title = ?, archived_at = ?, folder = ?, project_id = ?, updated_at = ?
    WHERE id = ?
    `
  ).run(
    String(title ?? current.title).trim() || current.title,
    archived === undefined
      ? current.archived_at
      : archived
        ? nowIso()
        : null,
    String(folder ?? current.folder ?? "").trim(),
    String(projectId ?? current.project_id ?? "").trim(),
    nowIso(),
    conversationId
  );
  return getConversationById(conversationId);
}

export function shareConversation(conversationId) {
  const current = getConversationById(conversationId);
  if (!current) throw new AppError("Conversation not found", 404);
  const token = current.share_token || randomUUID();
  db.prepare(
    "UPDATE conversations SET share_token = ?, updated_at = ? WHERE id = ?"
  ).run(token, nowIso(), conversationId);
  return getConversationById(conversationId);
}

export function getSharedConversation(shareToken) {
  const conversation = db
    .prepare(
      `
      SELECT conversations.*,
        (SELECT COUNT(*) FROM messages WHERE messages.conversation_id = conversations.id) AS message_count
      FROM conversations
      WHERE share_token = ?
      `
    )
    .get(String(shareToken || ""));
  if (!conversation) return null;
  return {
    conversation: mapConversation(conversation),
    messages: getConversationMessages(conversation.id)
  };
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
  apisUsed = [],
  parentMessageId = null,
  branchId = "",
  citations = [],
  status = "complete",
  error = "",
  generationId = ""
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
        parent_message_id,
        branch_id,
        citations_json,
        status,
        error,
        generation_id,
        updated_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      parentMessageId,
      String(branchId || ""),
      JSON.stringify(citations || []),
      String(status || "complete"),
      String(error || ""),
      String(generationId || ""),
      timestamp,
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

export function updateMessage(messageId, {
  content,
  status,
  error,
  citations,
  modelsUsed,
  apisUsed
} = {}) {
  const current = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
  if (!current) throw new AppError("Message not found", 404);
  const timestamp = nowIso();
  db.prepare(
    `
    UPDATE messages
    SET content = ?,
        status = ?,
        error = ?,
        citations_json = ?,
        models_used = ?,
        apis_used = ?,
        updated_at = ?
    WHERE id = ?
    `
  ).run(
    content === undefined ? current.content : String(content || ""),
    status === undefined ? current.status || "complete" : String(status || "complete"),
    error === undefined ? current.error || "" : String(error || ""),
    citations === undefined ? current.citations_json || "[]" : JSON.stringify(citations || []),
    modelsUsed === undefined ? current.models_used || "[]" : JSON.stringify(modelsUsed || []),
    apisUsed === undefined ? current.apis_used || "[]" : JSON.stringify(apisUsed || []),
    timestamp,
    messageId
  );
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
    timestamp,
    current.conversation_id
  );
  return mapMessage(db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId));
}

export function getMessageByGenerationId(generationId = "") {
  return mapMessage(
    db.prepare(
      "SELECT * FROM messages WHERE generation_id = ? ORDER BY id DESC LIMIT 1"
    ).get(String(generationId || ""))
  );
}

export function branchConversation({
  conversationId,
  userId,
  messageId,
  title = ""
} = {}) {
  const source = ensureConversationForUser(conversationId, userId);
  const selected = db
    .prepare(
      "SELECT * FROM messages WHERE id = ? AND conversation_id = ?"
    )
    .get(messageId, conversationId);
  if (!selected) throw new AppError("Message not found", 404);

  const branch = createConversation({
    userId,
    title: title || `${source.title} (branch)`
  });
  db.prepare(
    "UPDATE conversations SET parent_conversation_id = ? WHERE id = ?"
  ).run(source.id, branch.id);
  const messages = db
    .prepare(
      `
      SELECT * FROM messages
      WHERE conversation_id = ? AND id <= ?
      ORDER BY created_at ASC, id ASC
      `
    )
    .all(conversationId, selected.id);
  const branchId = randomUUID();
  for (const message of messages) {
    saveMessage({
      conversationId: branch.id,
      role: message.role,
      content: message.content,
      classification: message.classification,
      routeUsed: message.route_used,
      modelsUsed: parseJsonArray(message.models_used),
      apisUsed: parseJsonArray(message.apis_used),
      parentMessageId: message.id,
      branchId,
      citations: parseJsonArray(message.citations_json)
    });
  }
  return getConversationById(branch.id);
}

export function getConversationTree(userId) {
  const conversations = db
    .prepare(
      `
      SELECT conversations.*,
        (SELECT COUNT(*) FROM messages WHERE messages.conversation_id = conversations.id) AS message_count
      FROM conversations
      WHERE user_id = ?
      ORDER BY created_at ASC, id ASC
      `
    )
    .all(userId)
    .map(mapConversation);
  const byParent = new Map();
  for (const conversation of conversations) {
    const parentId = Number(conversation.parent_conversation_id || 0);
    const siblings = byParent.get(parentId) || [];
    siblings.push(conversation);
    byParent.set(parentId, siblings);
  }
  const build = (conversation, seen = new Set()) => {
    if (seen.has(conversation.id)) return { ...conversation, children: [] };
    const nextSeen = new Set(seen);
    nextSeen.add(conversation.id);
    return {
      ...conversation,
      children: (byParent.get(Number(conversation.id)) || []).map((child) =>
        build(child, nextSeen)
      )
    };
  };
  return (byParent.get(0) || []).map((conversation) => build(conversation));
}

export function listChatProjects(userId, { archived = false } = {}) {
  return db
    .prepare(
      `
      SELECT chat_projects.*,
        (SELECT COUNT(*) FROM conversations WHERE conversations.project_id = chat_projects.id) AS conversation_count
      FROM chat_projects
      WHERE user_id = ?
        AND (${archived ? "archived_at IS NOT NULL" : "archived_at IS NULL"})
      ORDER BY updated_at DESC, created_at DESC
      `
    )
    .all(userId);
}

export function createChatProject({ userId, name, description = "" }) {
  const user = getUserById(userId);
  if (!user) throw new AppError("User not found", 404);
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new AppError("Project name is required", 400);
  const id = randomUUID();
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO chat_projects (id, user_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(id, userId, cleanName, String(description || "").trim(), timestamp, timestamp);
  return db.prepare("SELECT * FROM chat_projects WHERE id = ?").get(id);
}

export function updateChatProject(projectId, userId, {
  name,
  description,
  archived
} = {}) {
  const current = db
    .prepare("SELECT * FROM chat_projects WHERE id = ? AND user_id = ?")
    .get(String(projectId || ""), userId);
  if (!current) throw new AppError("Chat project not found", 404);
  db.prepare(
    `
    UPDATE chat_projects
    SET name = ?, description = ?, archived_at = ?, updated_at = ?
    WHERE id = ?
    `
  ).run(
    String(name ?? current.name).trim() || current.name,
    String(description ?? current.description ?? "").trim(),
    archived === undefined ? current.archived_at : archived ? nowIso() : null,
    nowIso(),
    current.id
  );
  return db.prepare("SELECT * FROM chat_projects WHERE id = ?").get(current.id);
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
