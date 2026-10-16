// Explicit, bounded and credential-gated flow result snapshots.
// Never use this store for passwords, tokens or flow definitions.
import { randomUUID } from "node:crypto";

export const FLOW_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SNAPSHOT_BYTES = 2_000_000;
const MAX_ROWS = 20_000;
const MAX_SNAPSHOTS = 10;

export class FlowResultError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function requireUuid(value, name) {
  const text = String(value ?? "");
  if (!FLOW_KEY_PATTERN.test(text)) {
    throw new FlowResultError("Invalid " + name + ".");
  }
  return text;
}

export function initFlowResultStore(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS flow_result_snapshots (
      id TEXT PRIMARY KEY,
      flow_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      output_id TEXT NOT NULL,
      label TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      size_bytes INTEGER NOT NULL,
      data_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_flow_result_snapshots_flow
      ON flow_result_snapshots(flow_key, created_at DESC, id DESC);
  `);
}

export function saveFlowResult(database, { flowKey, outputId, label = "", rows }) {
  const key = requireUuid(flowKey, "flow key");
  const nodeId = String(outputId ?? "");
  if (!nodeId || nodeId.length > 128) throw new FlowResultError("Invalid output node.");
  if (!Array.isArray(rows) || rows.length > MAX_ROWS ||
      rows.some((row) => !row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length > 100)) {
    throw new FlowResultError("Output must contain up to 20,000 object rows and 100 columns.", 413);
  }
  const data = JSON.stringify(rows);
  const size = Buffer.byteLength(data, "utf8");
  if (size > MAX_SNAPSHOT_BYTES) {
    throw new FlowResultError("Saved result exceeds the 2 MB limit.", 413);
  }
  const snapshot = {
    id: randomUUID(), flowKey: key, createdAt: new Date().toISOString(),
    outputId: nodeId, label: String(label || nodeId).slice(0, 100),
    rowCount: rows.length, sizeBytes: size
  };
  database.transaction(() => {
    database.prepare(`
      INSERT INTO flow_result_snapshots
      (id, flow_key, created_at, output_id, label, row_count, size_bytes, data_json)
      VALUES (@id, @flowKey, @createdAt, @outputId, @label, @rowCount, @sizeBytes, @data)
    `).run({ ...snapshot, data });
    database.prepare(`
      DELETE FROM flow_result_snapshots
      WHERE flow_key = ? AND id NOT IN (
        SELECT id FROM flow_result_snapshots WHERE flow_key = ?
        ORDER BY created_at DESC, rowid DESC LIMIT ?
      )
    `).run(key, key, MAX_SNAPSHOTS);
  })();
  return snapshot;
}

export function listFlowResults(database, flowKey) {
  const key = requireUuid(flowKey, "flow key");
  return database.prepare(`
    SELECT id, flow_key AS flowKey, created_at AS createdAt, output_id AS outputId,
           label, row_count AS rowCount, size_bytes AS sizeBytes
    FROM flow_result_snapshots WHERE flow_key = ?
    ORDER BY created_at DESC, rowid DESC LIMIT ?
  `).all(key, MAX_SNAPSHOTS);
}

export function readFlowResult(database, flowKey, snapshotId) {
  const key = requireUuid(flowKey, "flow key");
  const id = requireUuid(snapshotId, "snapshot ID");
  const record = database.prepare(`
    SELECT id, flow_key AS flowKey, created_at AS createdAt, output_id AS outputId,
           label, row_count AS rowCount, size_bytes AS sizeBytes, data_json AS data
    FROM flow_result_snapshots WHERE flow_key = ? AND id = ?
  `).get(key, id);
  if (!record) throw new FlowResultError("Snapshot not found.", 404);
  const { data, ...metadata } = record;
  return { ...metadata, rows: JSON.parse(data) };
}

export function deleteFlowResult(database, flowKey, snapshotId) {
  const key = requireUuid(flowKey, "flow key");
  const id = requireUuid(snapshotId, "snapshot ID");
  const result = database.prepare(
    "DELETE FROM flow_result_snapshots WHERE flow_key = ? AND id = ?"
  ).run(key, id);
  if (!result.changes) throw new FlowResultError("Snapshot not found.", 404);
  return { deleted: true };
}
