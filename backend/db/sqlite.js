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
  logger.info("SQLite initialized", { file: config.paths.databaseFile });
}

export function closeDatabase() {
  db.close();
}

