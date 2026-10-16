// Server-managed external REST data sources for the Hydria OS Flow Manager.
// Users select an allowlisted source ID; they cannot submit URLs or HTTP headers.
// The server owns all credentials and enforces finite response/time/row limits.
import fs from "node:fs";
import net from "node:net";
import { FlowSourceError } from "./flowSqliteSource.js";

const ID = /^[a-z][a-z0-9_-]{0,63}$/;
const PATH = /^[a-zA-Z_][a-zA-Z_0-9]*(?:\.[a-zA-Z_][a-zA-Z_0-9]*){0,3}$/;
const HEADER = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const PARAM = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_SOURCES = 25;

function invalid(message, status = 400) {
  throw new FlowSourceError(message, status);
}
function catalogFromConfig(settings = process.env) {
  const file = String(settings.HYDRIA_FLOW_API_SOURCES_FILE || "");
  if (!file) return [];
  let raw;
  try {
    if (fs.statSync(file).size > 65_536) invalid("API source configuration is too large.", 503);
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error instanceof FlowSourceError) throw error;
    invalid("API source configuration is unavailable or invalid.", 503);
  }
  if (!Array.isArray(raw) || raw.length > MAX_SOURCES) invalid("Invalid API source catalog.", 503);
  const ids = new Set();
  return raw.map((item) => {
    if (!item || !ID.test(String(item.id || "")) || ids.has(item.id)) {
      invalid("Invalid or duplicate API source ID.", 503);
    }
    ids.add(item.id);
    let url;
    try { url = new URL(String(item.url || "")); }
    catch { invalid("Invalid configured API source URL.", 503); }
    if (url.protocol !== "https:" || url.username || url.password || url.hash ||
        !url.hostname || net.isIP(url.hostname) || url.hostname === "localhost" ||
        url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local")) {
      invalid("API sources require a configured HTTPS hostname without embedded credentials.", 503);
    }
    const path = String(item.itemsPath || "");
    if (path && !PATH.test(path)) invalid("Invalid API itemsPath.", 503);
    const authHeader = String(item.authHeader || "");
    const authEnv = String(item.authEnv || "");
    if ((authHeader && !authEnv) || (authEnv && !authHeader) ||
        (authHeader && (!HEADER.test(authHeader) || /^(host|cookie|authorization|content-length|connection)$/i.test(authHeader))) ||
        (authEnv && !/^HYDRIA_FLOW_API_[A-Z0-9_]{1,72}$/.test(authEnv))) {
      invalid("Invalid API authentication configuration.", 503);
    }
    const pages = Number(item.maxPages ?? 1);
    const pageParam = String(item.pageParam || "");
    const pageSizeParam = String(item.pageSizeParam || "");
    const pageSize = Number(item.pageSize ?? 1000);
    const firstPage = Number(item.firstPage ?? 1);
    if (!Number.isInteger(pages) || pages < 1 || pages > 5 ||
        !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20000 ||
        !Number.isInteger(firstPage) || firstPage < 0 || firstPage > 100000 ||
        (pages > 1 && !pageParam) ||
        (pageParam && !PARAM.test(pageParam)) ||
        (pageSizeParam && !PARAM.test(pageSizeParam)) ||
        (pageParam && pageParam === pageSizeParam)) invalid("Invalid API pagination settings.", 503);
    return Object.freeze({
      id: item.id,
      label: String(item.label || item.id).slice(0, 100),
      url: url.href, itemsPath: path, authHeader, authEnv,
      maxPages: pages, pageParam, firstPage, pageSizeParam, pageSize
    });
  });
}

export function listFlowApiSources({ settings = process.env } = {}) {
  // Never include endpoint URLs, tokens, headers, or environment key names.
  return catalogFromConfig(settings).map(({ id, label }) => ({ id, label }));
}
function getSource(id, settings) {
  if (!ID.test(String(id || ""))) invalid("Invalid API source ID.");
  const source = catalogFromConfig(settings).find((item) => item.id === id);
  if (!source) invalid("API source not found.", 404);
  return source;
}
function extractArray(payload, source) {
  let value = payload;
  if (source.itemsPath) {
    for (const part of source.itemsPath.split(".")) value = value?.[part];
  }
  if (!Array.isArray(value)) invalid("API source response is not an array at the configured path.", 502);
  return value;
}
function sanitizeRows(rows, remaining) {
  if (rows.length > remaining) invalid("API source exceeds the requested row limit.", 413);
  return rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length > 100) {
      invalid("API source rows must be JSON objects with up to 100 columns.", 502);
    }
    const result = Object.create(null);
    for (const [key, value] of Object.entries(row)) {
      const name = String(key).slice(0, 100);
      result[name] = value === null ? null : typeof value === "object"
        ? JSON.stringify(value).slice(0, 10000)
        : typeof value === "string" ? value.slice(0, 10000) : value;
    }
    return result;
  });
}
async function getJson(url, headers, request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await request(url, {
      method: "GET", headers, credentials: "omit",
      redirect: "error", signal: controller.signal
    });
    if (!res.ok) invalid("Configured API source returned an unsuccessful HTTP status.", 502);
    const mime = String(res.headers.get("content-type") || "").toLowerCase();
    if (!mime.includes("application/json") && !mime.includes("+json")) {
      invalid("Configured API source did not return JSON.", 502);
    }
    if (Number(res.headers.get("content-length") || 0) > MAX_RESPONSE_BYTES) {
      invalid("Configured API response exceeds 2 MB.", 413);
    }
    const reader = res.body?.getReader();
    if (!reader) invalid("API response is missing its body.", 502);
    let bytes = 0;
    const chunks = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) invalid("API response exceeds 2 MB.", 413);
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    const joined = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), bytes);
    try { return JSON.parse(joined.toString("utf8")); }
    catch { invalid("API response contains invalid JSON.", 502); }
  } catch (error) {
    if (error instanceof FlowSourceError) throw error;
    // Deliberately omit raw URL, fetch error details or headers from the client.
    invalid("Configured API source is unavailable.", 502);
  } finally { clearTimeout(timer); }
}

export async function readFlowApiSource({
  sourceId, limit = 1000, settings = process.env, request = fetch
} = {}) {
  const count = Number(limit);
  if (!Number.isInteger(count) || count < 1 || count > 20000) {
    invalid("API source limit must be 1–20,000 rows.");
  }
  const source = getSource(sourceId, settings);
  const headers = { "Accept": "application/json" };
  if (source.authEnv) {
    const secret = String(settings[source.authEnv] || "");
    if (!secret) invalid("API source credentials are not configured.", 503);
    headers[source.authHeader] = secret;
  }
  const rows = [];
  let responseBytes = 0;
  for (let index = 0; index < source.maxPages && rows.length < count; index++) {
    const url = new URL(source.url);
    const batchSize = Math.min(source.pageSize, count - rows.length);
    if (source.pageParam) url.searchParams.set(source.pageParam, String(source.firstPage + index));
    if (source.pageSizeParam) url.searchParams.set(source.pageSizeParam, String(batchSize));
    const page = extractArray(await getJson(url.href, headers, request), source);
    // Do not silently truncate data if a remote API ignores configured limits.
    if (page.length > batchSize) invalid("API source ignored the configured page size.", 413);
    const normalized = sanitizeRows(page, batchSize);
    rows.push(...normalized);
    responseBytes += Buffer.byteLength(JSON.stringify(normalized), "utf8");
    if (responseBytes > MAX_RESPONSE_BYTES) invalid("Combined API output exceeds 2 MB.", 413);
    if (page.length < batchSize || page.length === 0) break;
  }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (columns.length > 100) invalid("API output exceeds 100 distinct columns.", 413);
  return { sourceId: source.id, label: source.label, rows, columns, count: rows.length };
}
