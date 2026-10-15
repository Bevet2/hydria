// Opt-in, server-owned SQLite source for Hydria OS Flow Manager.
// Only table discovery and bounded SELECT are exposed: no submitted SQL,
// database paths, writes, or embedded credentials.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";

export class FlowSourceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function checkFlowSourceToken(token, expected = process.env.HYDRIA_FLOW_CONNECTOR_TOKEN) {
  const supplied = Buffer.from(String(token || ""), "utf8");
  const secret = Buffer.from(String(expected || ""), "utf8");
  if (!secret.length || !supplied.length || supplied.length !== secret.length ||
      !timingSafeEqual(supplied, secret)) {
    throw new FlowSourceError("Flow database connector is not configured or access is denied", 403);
  }
}

function openConfiguredDatabase(filePath = process.env.HYDRIA_FLOW_SQLITE_PATH) {
  if (!filePath) throw new FlowSourceError("SQLite source is not configured on this server", 503);
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new FlowSourceError("Configured SQLite database is unavailable", 503);
  }
  const db = new Database(absolute, { readonly: true, fileMustExist: true, timeout: 2000 });
  db.pragma("query_only = ON");
  return db;
}

function withDatabase(filePath, run) {
  const db = openConfiguredDatabase(filePath);
  try { return run(db); } finally { db.close(); }
}

function tableNames(db) {
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 100"
  ).all().map((record) => String(record.name));
}

export function listFlowSqliteTables({ filePath } = {}) {
  return withDatabase(filePath, (db) => tableNames(db));
}

export function readFlowSqliteTable({ filePath, table = "", limit = 1000 } = {}) {
  const name = String(table || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name)) {
    throw new FlowSourceError("Choose a valid table name without SQL expressions");
  }
  const maxRows = Number(limit);
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 20000) {
    throw new FlowSourceError("SQL source limit must be between 1 and 20,000");
  }
  return withDatabase(filePath, (db) => {
    if (!tableNames(db).includes(name)) throw new FlowSourceError("Table not found", 404);
    // The identifier is validated AND checked against sqlite_master; row
    // count is parameterized. Database connection is explicitly read-only.
    const query = db.prepare(`SELECT * FROM "${name}" LIMIT ?`);
    const columns = query.columns().map((column) => column.name);
    if (columns.length > 100) throw new FlowSourceError("Table exceeds 100 columns", 413);
    const data = query.all(maxRows).map((row) => Object.fromEntries(
      columns.map((column) => {
        const value = row[column];
        const converted = value == null ? null :
          Buffer.isBuffer(value) ? value.toString("base64").slice(0, 10000) :
          typeof value === "bigint" ? String(value) :
          typeof value === "string" ? value.slice(0, 10000) : value;
        return [column, converted];
      })
    ));
    if (Buffer.byteLength(JSON.stringify(data), "utf8") > 2_000_000) {
      throw new FlowSourceError("SQL source response exceeds 2 MB", 413);
    }
    return { table: name, columns, rows: data, count: data.length, limit: maxRows };
  });
}
