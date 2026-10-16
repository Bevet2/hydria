// Optional Hydria Flow Manager PostgreSQL adapter.
// Requires the administrator to install the PostgreSQL "psql" client.
// Fixed read-only queries, parameterless public API and server-owned settings;
// no user-submitted SQL, database credentials or hostnames.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { FlowSourceError } from "./flowSqliteSource.js";

const execAsync = promisify(execFile);
const MAX_RESPONSE_BYTES = 2_000_000;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const SUPPORTED_SSL = new Set(["require", "verify-ca", "verify-full", "disable"]);

function validateIdentifier(name, field) {
  const value = String(name ?? "");
  if (!IDENTIFIER.test(value)) throw new FlowSourceError("Invalid PostgreSQL " + field + " identifier.");
  return value;
}

export async function runConfiguredPsql(sql, { settings = process.env, exec = execAsync } = {}) {
  const host = String(settings.HYDRIA_FLOW_PG_HOST || "");
  const database = String(settings.HYDRIA_FLOW_PG_DATABASE || "");
  const user = String(settings.HYDRIA_FLOW_PG_USER || "");
  if (!host || !database || !user) {
    throw new FlowSourceError("PostgreSQL source is not configured on the server.", 503);
  }
  const ssl = settings.HYDRIA_FLOW_PG_SSLMODE || "require";
  if (!SUPPORTED_SSL.has(ssl)) throw new FlowSourceError("Invalid PostgreSQL SSL mode.", 503);
  const port = String(settings.HYDRIA_FLOW_PG_PORT || "5432");
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new FlowSourceError("Invalid PostgreSQL connection port.", 503);
  }
  // The SQL is built only by the two functions below, never from submitted
  // SQL strings. This process uses no shell and runs without psqlrc.
  const env = {
    ...process.env,
    PGHOST: host, PGPORT: port, PGDATABASE: database, PGUSER: user,
    PGPASSWORD: String(settings.HYDRIA_FLOW_PG_PASSWORD || ""),
    PGSSLMODE: ssl, PGCONNECT_TIMEOUT: "3",
    PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=4000"
  };
  try {
    const result = await exec(
      String(settings.HYDRIA_FLOW_PSQL_BIN || "psql"),
      ["--no-psqlrc", "--no-password", "--quiet", "--tuples-only", "--no-align",
       "--set", "ON_ERROR_STOP=1", "--command", sql],
      { env, timeout: 7000, maxBuffer: MAX_RESPONSE_BYTES + 100_000, windowsHide: true }
    );
    const text = String(result.stdout || "").trim();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      throw new FlowSourceError("PostgreSQL response exceeds 2 MB.", 413);
    }
    return text;
  } catch (error) {
    if (error instanceof FlowSourceError) throw error;
    // Do not return raw stderr; it may disclose database hostnames or names.
    throw new FlowSourceError("PostgreSQL source unavailable or read query failed.", 503);
  }
}
function parseRows(text) {
  let result;
  try { result = JSON.parse(String(text || "[]")); }
  catch { throw new FlowSourceError("PostgreSQL returned invalid JSON.", 502); }
  if (!Array.isArray(result)) throw new FlowSourceError("PostgreSQL result is not a JSON array.", 502);
  return result;
}
const TABLES_SQL = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
  SELECT table_schema AS schema, table_name AS name
  FROM information_schema.tables
  WHERE table_type = 'BASE TABLE'
    AND table_schema NOT IN ('information_schema', 'pg_catalog')
  ORDER BY table_schema, table_name LIMIT 100
) AS t;`;

export async function listFlowPostgresTables({ query = runConfiguredPsql } = {}) {
  const entries = parseRows(await query(TABLES_SQL));
  if (entries.length > 100) throw new FlowSourceError("Too many PostgreSQL tables.", 413);
  return entries.filter((row) => row && IDENTIFIER.test(row.schema) &&
    IDENTIFIER.test(row.name)).map((row) => ({ schema: row.schema, name: row.name }));
}
export async function readFlowPostgresTable({
  schema = "public", table, limit = 1000, query = runConfiguredPsql
} = {}) {
  const schemaName = validateIdentifier(schema, "schema");
  const tableName = validateIdentifier(table, "table");
  const maxRows = Number(limit);
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 20000) {
    throw new FlowSourceError("PostgreSQL limit must be 1–20,000 rows.");
  }
  // Table discovery is mandatory. Identifiers are both allowlisted by actual
  // server metadata and narrowly validated before quoting for SQL.
  const allowed = await listFlowPostgresTables({ query });
  if (!allowed.some((item) => item.schema === schemaName && item.name === tableName)) {
    throw new FlowSourceError("PostgreSQL table not found or not accessible.", 404);
  }
  const sql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (SELECT * FROM "${schemaName}"."${tableName}" LIMIT ${maxRows}) AS t;`;
  const rows = parseRows(await query(sql));
  if (rows.length > maxRows) throw new FlowSourceError("PostgreSQL result exceeded limit.", 413);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  if (columns.length > 100 || rows.some((row) =>
    !row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length > 100)) {
    throw new FlowSourceError("PostgreSQL response exceeds 100 columns.", 413);
  }
  const data = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const converted = value === null ? null : typeof value === "object"
      ? JSON.stringify(value).slice(0, 10000)
      : typeof value === "string" ? value.slice(0, 10000) : value;
    return [key, converted];
  })));
  if (Buffer.byteLength(JSON.stringify(data), "utf8") > MAX_RESPONSE_BYTES) {
    throw new FlowSourceError("PostgreSQL rows exceed 2 MB.", 413);
  }
  return { schema: schemaName, table: tableName, limit: maxRows, columns, rows: data, count: data.length };
}
