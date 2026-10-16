import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { initFlowResultStore, listFlowResults, readFlowResult } from "../services/flow/flowResults.js";
import {
  initFlowSchedules, saveFlowSchedule, getFlowSchedule, listFlowSchedules,
  deleteFlowSchedule, executeScheduledFlow, executeDueFlowSchedules,
  FlowScheduleError
} from "../services/flow/flowScheduler.js";

const db = new Database(":memory:");
const start = Date.parse("2026-10-16T10:00:00.000Z");
const flowKey = "11111111-1111-4111-8111-111111111111";
const flow = {
  kind: "hydria-dataflow", stages: [
    { id: "src", type: "input.table", config: { data: '[{"city":"Paris","amount":3}]' } },
    { id: "out", type: "output.table", label: "Results" }
  ],
  links: [{ id: "a", from: "src", to: "out", toPort: 0 }]
};
try {
  db.exec(`CREATE TABLE flow_run_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flow_key TEXT NOT NULL, started_at TEXT NOT NULL, status TEXT NOT NULL,
    duration_ms INTEGER, step_count INTEGER, output_rows INTEGER, error_count INTEGER
  )`);
  initFlowResultStore(db);
  initFlowSchedules(db);
  initFlowSchedules(db);
  assert.deepEqual(listFlowSchedules(db), []);
  assert.throws(() => saveFlowSchedule(db, { flowKey, flow, outputId: "out", intervalMinutes: 1 }, start), /15 and 1440/);
  assert.throws(() => saveFlowSchedule(db, { flowKey, flow, outputId: "missing", intervalMinutes: 15 }, start), /output node/);
  assert.throws(() => saveFlowSchedule(db, { flowKey, flow: { stages: [], links: [] }, outputId: "out", intervalMinutes: 15 }, start), /output node/);
  const created = saveFlowSchedule(db, {
    flowKey, flow, outputId: "out", intervalMinutes: 15
  }, start);
  assert.equal(created.enabled, true);
  assert.equal(created.publishSnapshot, true);
  assert.equal(created.nextRunAt, "2026-10-16T10:15:00.000Z");
  assert.equal(executeDueFlowSchedules(db, start).length, 0);
  const outcomes = executeDueFlowSchedules(db, start + 15 * 60_000);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].status, "success");
  assert.equal(outcomes[0].outputRows, 1);
  assert.equal(getFlowSchedule(db, flowKey).runCount, 1);
  const saved = listFlowResults(db, flowKey);
  assert.equal(saved.length, 1);
  assert.deepEqual(readFlowResult(db, flowKey, saved[0].id).rows, [{city:"Paris",amount:3}]);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM flow_run_history").get().count,1);
  assert.equal(executeDueFlowSchedules(db, start + 16 * 60_000).length,0);
  assert.equal(executeScheduledFlow(db, flowKey, start + 18 * 60_000).status,"success");
  assert.equal(getFlowSchedule(db, flowKey).runCount, 2);

  const disabled = saveFlowSchedule(db, { flowKey, flow, outputId: "out",
    intervalMinutes: 30, enabled: false, publishSnapshot: false }, start);
  assert.equal(disabled.nextRunAt, null);
  assert.equal(disabled.enabled, false);
  assert.deepEqual(executeDueFlowSchedules(db, start + 2 * 86400000), []);
  assert.throws(() => executeScheduledFlow(db, flowKey), (e) => e.status === 409);

  const invalidData = {
    ...flow,
    stages: [{ ...flow.stages[0], config: { data: "{bad" } }, flow.stages[1]]
  };
  saveFlowSchedule(db, {flowKey, flow: invalidData, outputId:"out",
    intervalMinutes:15, publishSnapshot:false},start);
  const failure = executeScheduledFlow(db, flowKey, start);
  assert.equal(failure.status,"failed");
  assert.match(failure.error,/JSON/i);
  assert.equal(getFlowSchedule(db, flowKey).lastStatus,"failed");
  assert.equal(db.prepare("SELECT status FROM flow_run_history ORDER BY id DESC LIMIT 1").get().status,"failed");
  assert.deepEqual(deleteFlowSchedule(db, flowKey),{deleted:true});
  assert.equal(getFlowSchedule(db, flowKey),null);
  assert.throws(() => deleteFlowSchedule(db, flowKey),(e)=>e.status===404);
  console.log("Hydria Flow scheduler gate passed.");
} finally {
  db.close();
}
