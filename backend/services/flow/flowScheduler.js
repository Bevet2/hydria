// Hydria OS scheduled data flows. A single-process, bounded SQLite scheduler.
// It deliberately accepts only the existing deterministic flow graph and never
// persists connection tokens. Configure a dedicated admin token at the API layer.
import { validateFlow, runFlow } from "./flowEngine.js";
import { saveFlowResult, FLOW_KEY_PATTERN } from "./flowResults.js";
import { readFlowPostgresTable } from "./flowPostgresSource.js";
import { readFlowApiSource } from "./flowApiSource.js";

const MIN_INTERVAL = 15;
const MAX_INTERVAL = 1440;
const MAX_SCHEDULES = 25;
const MAX_DEFINITION_BYTES = 512_000;
const MAX_SCHEDULE_NODES = 40;

export class FlowScheduleError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function validKey(value) {
  const key = String(value ?? "");
  if (!FLOW_KEY_PATTERN.test(key)) throw new FlowScheduleError("Invalid flow history key.");
  return key;
}

export function initFlowSchedules(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS flow_schedules (
      flow_key TEXT PRIMARY KEY,
      flow_json TEXT NOT NULL,
      output_id TEXT NOT NULL,
      interval_minutes INTEGER NOT NULL,
      publish_snapshot INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      next_run_at TEXT,
      last_run_at TEXT,
      last_status TEXT,
      last_error TEXT,
      run_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_flow_schedules_due
      ON flow_schedules(enabled, next_run_at);
  `);
}
function metadata(record) {
  if (!record) return null;
  return {
    flowKey: record.flow_key,
    outputId: record.output_id,
    intervalMinutes: record.interval_minutes,
    publishSnapshot: Boolean(record.publish_snapshot),
    enabled: Boolean(record.enabled),
    nextRunAt: record.next_run_at,
    lastRunAt: record.last_run_at,
    lastStatus: record.last_status,
    lastError: record.last_error,
    runCount: record.run_count,
    updatedAt: record.updated_at
  };
}
function getRecord(db, flowKey) {
  return db.prepare("SELECT * FROM flow_schedules WHERE flow_key = ?").get(validKey(flowKey));
}
export function listFlowSchedules(db) {
  return db.prepare("SELECT * FROM flow_schedules ORDER BY updated_at DESC LIMIT ?")
    .all(MAX_SCHEDULES).map(metadata);
}
export function getFlowSchedule(db, flowKey) {
  return metadata(getRecord(db, flowKey));
}
export function saveFlowSchedule(db, {
  flowKey, flow, outputId, intervalMinutes, enabled = true, publishSnapshot = true
}, now = Date.now()) {
  const key = validKey(flowKey);
  const interval = Number(intervalMinutes);
  if (!Number.isInteger(interval) || interval < MIN_INTERVAL || interval > MAX_INTERVAL) {
    throw new FlowScheduleError("Interval must be between 15 and 1440 whole minutes.");
  }
  if (typeof enabled !== "boolean" || typeof publishSnapshot !== "boolean") {
    throw new FlowScheduleError("enabled and publishSnapshot must be booleans.");
  }
  const validation = validateFlow(flow);
  if (!validation.valid) throw new FlowScheduleError(validation.errors.join("; "));
  if (validation.flow.stages.length > MAX_SCHEDULE_NODES) {
    throw new FlowScheduleError("Scheduled flows cannot exceed 40 nodes.");
  }
  const target = String(outputId || "");
  if (!validation.flow.stages.some((s) => s.id === target && (s.type || s.kind) === "output.table")) {
    throw new FlowScheduleError("Select an existing Table output node.");
  }
  // Only the engine's known deterministic nodes are supported. A scheduled
  // run does not gain access to external URLs, files or connector credentials.
  // Store live PostgreSQL references, never browser-imported database rows
  // or credentials. The backend refreshes them at execution time.
  let liveSources = 0;
  const storedStages = validation.flow.stages.map((stage) => {
    const pg = stage.config?.postgresSource;
    const api = stage.config?.apiSource;
    if (pg === undefined && api === undefined) return stage;
    if ((stage.type || stage.kind) !== "input.table" || (pg && api)) {
      throw new FlowScheduleError("Invalid live source configuration.");
    }
    if (++liveSources > 3) throw new FlowScheduleError("Maximum three live sources per scheduled flow.");
    let reference;
    if (pg !== undefined) {
      if (!pg || pg.kind !== "postgres" ||
          !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(String(pg.schema || "")) ||
          !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(String(pg.table || "")) ||
          !Number.isInteger(pg.limit) || pg.limit < 1 || pg.limit > 20000) {
        throw new FlowScheduleError("Invalid live PostgreSQL source reference.");
      }
      reference = { postgresSource: { kind: "postgres", schema: pg.schema, table: pg.table, limit: pg.limit } };
    } else {
      if (!api || api.kind !== "api" ||
          !/^[a-z][a-z0-9_-]{0,63}$/.test(String(api.sourceId || "")) ||
          !Number.isInteger(api.limit) || api.limit < 1 || api.limit > 20000) {
        throw new FlowScheduleError("Invalid managed API source reference.");
      }
      // Only an opaque allowlisted ID and limit survive serialization. Never
      // store an API URL, credential, HTTP header or bearer token.
      reference = { apiSource: { kind: "api", sourceId: api.sourceId, limit: api.limit } };
    }
    const { apiSource, postgresSource, ...other } = stage.config || {};
    return { ...stage, config: { ...other, data: "[]", ...reference } };
  });
  const stored = JSON.stringify({
    kind: "hydria-dataflow", version: 1,
    title: validation.flow.title, stages: storedStages, links: validation.flow.links
  });
  if (Buffer.byteLength(stored, "utf8") > MAX_DEFINITION_BYTES) {
    throw new FlowScheduleError("Scheduled flow definition exceeds 512 KB.", 413);
  }
  const timestamp = new Date(now).toISOString();
  const nextRunAt = enabled ? new Date(now + interval * 60_000).toISOString() : null;
  if (!getRecord(db, key) &&
      db.prepare("SELECT COUNT(*) AS total FROM flow_schedules").get().total >= MAX_SCHEDULES) {
    throw new FlowScheduleError("Maximum 25 scheduled flows reached.", 413);
  }
  db.prepare(`
    INSERT INTO flow_schedules
      (flow_key, flow_json, output_id, interval_minutes, publish_snapshot,
       enabled, next_run_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(flow_key) DO UPDATE SET
      flow_json=excluded.flow_json, output_id=excluded.output_id,
      interval_minutes=excluded.interval_minutes,
      publish_snapshot=excluded.publish_snapshot, enabled=excluded.enabled,
      next_run_at=excluded.next_run_at, updated_at=excluded.updated_at
  `).run(key, stored, target, interval, Number(publishSnapshot),
    Number(enabled), nextRunAt, timestamp);
  return getFlowSchedule(db, key);
}
export function deleteFlowSchedule(db, flowKey) {
  const result = db.prepare("DELETE FROM flow_schedules WHERE flow_key = ?").run(validKey(flowKey));
  if (!result.changes) throw new FlowScheduleError("Schedule not found.", 404);
  return { deleted: true };
}
function recordHistory(db, key, startedAt, status, durationMs, steps, outputRows) {
  db.prepare(`
    INSERT INTO flow_run_history
    (flow_key, started_at, status, duration_ms, step_count, output_rows, error_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(key, startedAt, status, durationMs, steps, outputRows, status === "success" ? 0 : 1);
  db.prepare(`
    DELETE FROM flow_run_history WHERE flow_key = ? AND id NOT IN
    (SELECT id FROM flow_run_history WHERE flow_key = ? ORDER BY id DESC LIMIT 50)
  `).run(key, key);
}
export async function executeScheduledFlow(db, flowKey, now = Date.now(), {
  fetchPostgres = readFlowPostgresTable,
  fetchApi = readFlowApiSource
} = {}) {
  const key = validKey(flowKey);
  const record = getRecord(db, key);
  if (!record) throw new FlowScheduleError("Schedule not found.", 404);
  if (!record.enabled) throw new FlowScheduleError("Schedule is disabled.", 409);
  const startedAt = new Date(now).toISOString();
  const nextRunAt = new Date(now + record.interval_minutes * 60_000).toISOString();

  // Claim the run before execution. An interrupted process will not endlessly
  // replay the same due time on restart (at-most-once, not exactly-once).
  db.prepare("UPDATE flow_schedules SET next_run_at = ?, last_run_at = ? WHERE flow_key = ?")
    .run(nextRunAt, startedAt, key);
  const began = Date.now();
  let status = "success", error = "", stepCount = 0, outputRows = 0, snapshotId = null;
  try {
    const liveFlow = JSON.parse(record.flow_json);
    for (const stage of liveFlow.stages) {
      const pg = stage.config?.postgresSource;
      const api = stage.config?.apiSource;
      if (!pg && !api) continue;
      if (pg && api) throw new FlowScheduleError("Ambiguous live source.");
      let refreshed, limit;
      if (pg) {
        if (pg.kind !== "postgres") throw new FlowScheduleError("Unsupported PostgreSQL reference.");
        refreshed = await fetchPostgres({ schema: pg.schema, table: pg.table, limit: pg.limit });
        limit = pg.limit;
      } else {
        if (api.kind !== "api") throw new FlowScheduleError("Unsupported API reference.");
        refreshed = await fetchApi({ sourceId: api.sourceId, limit: api.limit });
        limit = api.limit;
      }
      if (!Array.isArray(refreshed.rows) || refreshed.rows.length > limit) {
        throw new FlowScheduleError("Invalid refreshed source result.");
      }
      stage.config.data = JSON.stringify(refreshed.rows);
    }
    const result = runFlow(liveFlow, { includeAllOutputs: Boolean(record.publish_snapshot), sampleLimit: 0 });
    stepCount = result.steps?.length || 0;
    if (!result.success) throw new FlowScheduleError((result.errors || []).join("; ") || "Flow execution failed.", 422);
    const output = result.outputs.find((o) => o.id === record.output_id);
    if (!output) throw new FlowScheduleError("Selected output missing.", 422);
    outputRows = output.rows;
    if (record.publish_snapshot) {
      const metadata = saveFlowResult(db, {
        flowKey: key, outputId: output.id,
        label: (liveFlow.stages.find((s) => s.id === output.id)?.label || output.id),
        rows: output.data || []
      });
      snapshotId = metadata.id;
    }
  } catch (err) {
    status = "failed";
    error = String(err?.message || err).slice(0, 500);
  }
  db.transaction(() => {
    db.prepare(`
      UPDATE flow_schedules SET last_status = ?, last_error = ?,
        run_count = run_count + 1 WHERE flow_key = ?
    `).run(status, error || null, key);
    recordHistory(db, key, startedAt, status, Date.now() - began, stepCount, outputRows);
  })();
  return { flowKey: key, startedAt, status, error: error || null, outputRows, snapshotId, nextRunAt };
}
export async function executeDueFlowSchedules(db, now = Date.now(), maxPerTick = 5, options = {}) {
  const limit = Math.max(1, Math.min(5, Math.trunc(maxPerTick) || 5));
  const due = db.prepare(`
    SELECT flow_key FROM flow_schedules
    WHERE enabled = 1 AND next_run_at <= ?
    ORDER BY next_run_at ASC LIMIT ?
  `).all(new Date(now).toISOString(), limit);
  const results = [];
  for (const { flow_key } of due) {
    results.push(await executeScheduledFlow(db, flow_key, now, options));
  }
  return results;
}
