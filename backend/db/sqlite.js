import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import config from "../config/hydria.config.js";
import logger from "../utils/logger.js";

const databaseDir = path.dirname(config.paths.databaseFile);
fs.mkdirSync(databaseDir, { recursive: true });

export const db = new Database(config.paths.databaseFile);

export function initDatabase() {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(config.paths.schemaFile, "utf8");
  db.exec(schema);
  const ensureColumn = (table, column, definition) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((entry) => entry.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };
  ensureColumn("conversations", "archived_at", "TEXT");
  ensureColumn("conversations", "folder", "TEXT DEFAULT ''");
  ensureColumn("conversations", "project_id", "TEXT DEFAULT ''");
  ensureColumn("conversations", "share_token", "TEXT");
  ensureColumn("conversations", "parent_conversation_id", "INTEGER");
  ensureColumn("messages", "parent_message_id", "INTEGER");
  ensureColumn("messages", "branch_id", "TEXT DEFAULT ''");
  ensureColumn("messages", "citations_json", "TEXT DEFAULT '[]'");
  ensureColumn("messages", "status", "TEXT DEFAULT 'complete'");
  ensureColumn("messages", "error", "TEXT DEFAULT ''");
  ensureColumn("messages", "generation_id", "TEXT DEFAULT ''");
  ensureColumn("messages", "updated_at", "TEXT");
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_share_token ON conversations(share_token)"
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id)"
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_messages_generation_id ON messages(generation_id)"
  );
  logger.info("SQLite initialized", { file: config.paths.databaseFile });
}

export function closeDatabase() {
  db.close();
}
