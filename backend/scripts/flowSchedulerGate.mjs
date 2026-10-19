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
  assert.throws(() => saveFlowSchedule(db, { flowKey, flow: { stages: [], links: [] }, outputId: "out", intervalMinutes: 15 }, start), /at least one node/, "Empty workflows must not be scheduled as successful runs");
  const created = saveFlowSchedule(db, {
    flowKey, flow, outputId: "out", intervalMinutes: 15
  }, start);
  assert.equal(created.enabled, true);
  assert.equal(created.publishSnapshot, true);
  assert.equal(created.nextRunAt, "2026-10-16T10:15:00.000Z");
  assert.equal((await executeDueFlowSchedules(db, start)).length, 0);
  const outcomes = await executeDueFlowSchedules(db, start + 15 * 60_000);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].status, "success");
  assert.equal(outcomes[0].outputRows, 1);
  assert.equal(getFlowSchedule(db, flowKey).runCount, 1);
  const saved = listFlowResults(db, flowKey);
  assert.equal(saved.length, 1);
  assert.deepEqual(readFlowResult(db, flowKey, saved[0].id).rows, [{city:"Paris",amount:3}]);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM flow_run_history").get().count,1);
  assert.equal((await executeDueFlowSchedules(db, start + 16 * 60_000)).length,0);
  assert.equal((await executeScheduledFlow(db, flowKey, start + 18 * 60_000)).status,"success");
  assert.equal(getFlowSchedule(db, flowKey).runCount, 2);

  const disabled = saveFlowSchedule(db, { flowKey, flow, outputId: "out",
    intervalMinutes: 30, enabled: false, publishSnapshot: false }, start);
  assert.equal(disabled.nextRunAt, null);
  assert.equal(disabled.enabled, false);
  assert.deepEqual(await executeDueFlowSchedules(db, start + 2 * 86400000), []);
  await assert.rejects(() => executeScheduledFlow(db, flowKey), (e) => e.status === 409);

  const invalidData = {
    ...flow,
    stages: [{ ...flow.stages[0], config: { data: "{bad" } }, flow.stages[1]]
  };
  saveFlowSchedule(db, {flowKey, flow: invalidData, outputId:"out",
    intervalMinutes:15, publishSnapshot:false},start);
  const failure = await executeScheduledFlow(db, flowKey, start);
  assert.equal(failure.status,"failed");
  assert.match(failure.error,/JSON/i);
  assert.equal(getFlowSchedule(db, flowKey).lastStatus,"failed");
  assert.equal(db.prepare("SELECT status FROM flow_run_history ORDER BY id DESC LIMIT 1").get().status,"failed");
  const live = {
    ...flow, stages:[
      {id:"src",type:"input.table",config:{
        data: JSON.stringify([{city:"STALE",amount:-1}]),
        postgresSource: {kind:"postgres",schema:"public",table:"sales",limit:100}
      }},
      flow.stages[1]
    ]
  };
  const configured = saveFlowSchedule(db,{flowKey,flow:live,outputId:"out",
    intervalMinutes:15,enabled:true},start);
  assert.equal(configured.enabled,true);
  const stored = db.prepare("SELECT flow_json FROM flow_schedules WHERE flow_key=?").get(flowKey);
  assert.deepEqual(JSON.parse(stored.flow_json).stages[0].config.data,"[]",
    "Scheduled definitions should not retain copied PostgreSQL result rows");
  let counter = 3, sources = 0;
  const fetchPostgres = async ({schema,table,limit}) => {
    assert.deepEqual({schema,table,limit},{schema:"public",table:"sales",limit:100});
    sources++;
    return {rows:[{city:"Paris",amount:counter++}]};
  };
  assert.equal((await executeScheduledFlow(db,flowKey,start,{fetchPostgres})).status,"success");
  assert.equal((await executeScheduledFlow(db,flowKey,start+60_000,{fetchPostgres})).status,"success");
  assert.equal(sources,2);
  const snapshots = listFlowResults(db,flowKey);
  assert.equal(readFlowResult(db,flowKey,snapshots[0].id).rows[0].amount,4);
  assert.equal(readFlowResult(db,flowKey,snapshots[1].id).rows[0].amount,3);
  assert.throws(() => saveFlowSchedule(db,{
    flowKey,flow:{...flow,stages:[{...flow.stages[0],config:{
      data:"[]",postgresSource:{kind:"postgres",schema:"public",table:"sales;DROP",limit:100}
    }},flow.stages[1]]},outputId:"out",intervalMinutes:15
  }),/Invalid live PostgreSQL/);
  const sourceFailure = await executeScheduledFlow(db,flowKey,start+120_000,{
    fetchPostgres:async()=>{throw Error("Postgres connection failed");}
  });
  assert.equal(sourceFailure.status,"failed");
  assert.match(sourceFailure.error,/Postgres connection failed/);
  const liveApi = {
    ...flow, stages: [
      { id: "src", type: "input.table", config: {
        data: '[{"city":"STALE","amount":0}]',
        apiSource: { kind: "api", sourceId: "sales_reports", limit: 50 }
      }},
      flow.stages[1]
    ]
  };
  saveFlowSchedule(db,{flowKey,flow:liveApi,outputId:"out",intervalMinutes:15},start);
  const apiDefinition = JSON.parse(db.prepare(
    "SELECT flow_json FROM flow_schedules WHERE flow_key=?"
  ).get(flowKey).flow_json);
  assert.deepEqual(apiDefinition.stages[0].config.data,"[]");
  assert.deepEqual(apiDefinition.stages[0].config.apiSource,{
    kind:"api",sourceId:"sales_reports",limit:50
  });
  assert.equal(JSON.stringify(apiDefinition).includes("STALE"),false);
  let apiValue = 17, calls = 0;
  const fetchApi = async ({sourceId,limit}) => {
    assert.deepEqual({sourceId,limit},{sourceId:"sales_reports",limit:50});
    calls++; return {rows:[{city:"Paris",amount:apiValue++}]};
  };
  assert.equal((await executeScheduledFlow(db,flowKey,start,{fetchApi})).status,"success");
  assert.equal((await executeScheduledFlow(db,flowKey,start+1000,{fetchApi})).status,"success");
  assert.equal(calls,2);
  const apiSnapshots = listFlowResults(db,flowKey);
  assert.deepEqual(readFlowResult(db,flowKey,apiSnapshots[0].id).rows,[{city:"Paris",amount:18}]);
  assert.deepEqual(readFlowResult(db,flowKey,apiSnapshots[1].id).rows,[{city:"Paris",amount:17}]);
  assert.throws(() => saveFlowSchedule(db, {
    flowKey,flow:{...flow,stages:[
      {...flow.stages[0],config:{data:"[]",apiSource:{kind:"api",sourceId:"https://evil.local",limit:10}}},
      flow.stages[1]
    ]},outputId:"out",intervalMinutes:15
  }),/Invalid managed API/);
  const apiFailure = await executeScheduledFlow(db,flowKey,start+2000,{
    fetchApi:async()=>{throw new Error("API temporary error");}
  });
  assert.equal(apiFailure.status,"failed");
  assert.match(apiFailure.error,/temporary error/);
  // Concurrent run-now requests cannot execute the same schedule twice.
  saveFlowSchedule(db,{flowKey,flow:liveApi,outputId:"out",intervalMinutes:15},start);
  let releaseRequest;
  const pendingFetch = async () => new Promise((resolve) => { releaseRequest = resolve; });
  const pending = executeScheduledFlow(db,flowKey,start+3000,{fetchApi:pendingFetch});
  assert.equal(typeof releaseRequest,"function");
  const running = db.prepare("SELECT run_token,run_until FROM flow_schedules WHERE flow_key=?").get(flowKey);
  assert.match(running.run_token,/^[0-9a-f-]{36}$/);
  assert.ok(running.run_until);
  await assert.rejects(
    executeScheduledFlow(db,flowKey,start+3000,{fetchApi}),
    (error) => error.status === 409
  );
  releaseRequest({rows:[{city:"Paris",amount:40}]});
  assert.equal((await pending).status,"success");
  assert.equal(db.prepare("SELECT run_token FROM flow_schedules WHERE flow_key=?").get(flowKey).run_token,null);
  assert.equal((await executeScheduledFlow(db,flowKey,start+4000,{fetchApi})).status,"success");

  const migratedDb = new Database(":memory:");
  try {
    migratedDb.exec(`CREATE TABLE flow_schedules (
      flow_key TEXT PRIMARY KEY, flow_json TEXT NOT NULL,
      output_id TEXT NOT NULL, interval_minutes INTEGER NOT NULL,
      publish_snapshot INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1,
      next_run_at TEXT, last_run_at TEXT, last_status TEXT, last_error TEXT,
      run_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
    )`);
    initFlowSchedules(migratedDb);
    initFlowSchedules(migratedDb);
    const names = migratedDb.prepare("PRAGMA table_info(flow_schedules)").all().map(x=>x.name);
    assert.ok(names.includes("run_token") && names.includes("run_until"));
  } finally { migratedDb.close(); }
  assert.deepEqual(deleteFlowSchedule(db, flowKey),{deleted:true});
  assert.equal(getFlowSchedule(db, flowKey),null);
  assert.throws(() => deleteFlowSchedule(db, flowKey),(e)=>e.status===404);
  console.log("Hydria Flow scheduler gate passed.");
} finally {
  db.close();
}
