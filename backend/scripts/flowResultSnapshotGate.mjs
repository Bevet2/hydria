import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  initFlowResultStore, saveFlowResult, listFlowResults,
  readFlowResult, deleteFlowResult, FlowResultError
} from "../services/flow/flowResults.js";

const db = new Database(":memory:");
try {
  initFlowResultStore(db);
  initFlowResultStore(db); // safe on an existing installation
  const flowKey = "11111111-1111-4111-8111-111111111111";
  const otherKey = "22222222-2222-4222-8222-222222222222";
  const rows = [{ city: "Paris", amount: 9 }, { city: "Lyon", amount: "=1+1" }];
  const snapshot = saveFlowResult(db, { flowKey, outputId: "out", label: "Monthly revenue", rows });
  assert.equal(listFlowResults(db, flowKey).length, 1);
  assert.deepEqual(readFlowResult(db, flowKey, snapshot.id).rows, rows);
  assert.equal(readFlowResult(db, flowKey, snapshot.id).label, "Monthly revenue");
  assert.deepEqual(listFlowResults(db, otherKey), []);
  assert.throws(() => readFlowResult(db, otherKey, snapshot.id), (error) => error.status === 404);
  assert.throws(() => saveFlowResult(db, { flowKey: "bad", outputId: "out", rows }), FlowResultError);
  assert.throws(() => saveFlowResult(db, { flowKey, outputId: "out", rows: [{}].concat(Array.from({ length: 20000 }, () => ({}))) }), (error) => error.status === 413);
  assert.throws(() => saveFlowResult(db, { flowKey, outputId: "out", rows: [{ col: "x".repeat(2_000_001) }] }), (error) => error.status === 413);
  assert.throws(() => saveFlowResult(db, { flowKey, outputId: "", rows }), FlowResultError);
  for (let i = 0; i < 12; i++) {
    saveFlowResult(db, { flowKey, outputId: "out", rows: [{ i }] });
  }
  assert.equal(listFlowResults(db, flowKey).length, 10);
  assert.throws(() => readFlowResult(db, flowKey, snapshot.id), (error) => error.status === 404);
  const latest = listFlowResults(db, flowKey)[0];
  assert.equal(readFlowResult(db, flowKey, latest.id).rows[0].i, 11);
  assert.deepEqual(deleteFlowResult(db, flowKey, latest.id), { deleted: true });
  assert.equal(listFlowResults(db, flowKey).length, 9);
  assert.throws(() => deleteFlowResult(db, otherKey, latest.id), (error) => error.status === 404);
  console.log("Hydria Flow persisted snapshot gate passed.");
} finally {
  db.close();
}
