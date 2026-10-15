import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  FlowSourceError, checkFlowSourceToken,
  listFlowSqliteTables, readFlowSqliteTable
} from "../services/flow/flowSqliteSource.js";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "hydria-flow-sqlite-"));
const filePath = path.join(temp, "source.sqlite");
try {
  const writable = new Database(filePath);
  writable.exec("CREATE TABLE sales (city TEXT, amount REAL, note TEXT); CREATE TABLE customers (id INTEGER, name TEXT)");
  writable.prepare("INSERT INTO sales VALUES (?, ?, ?)").run("Paris", 12.5, "=1+1");
  writable.prepare("INSERT INTO sales VALUES (?, ?, ?)").run("Lyon", 7, null);
  writable.close();

  assert.deepEqual(listFlowSqliteTables({ filePath }), ["customers", "sales"]);
  const result = readFlowSqliteTable({filePath,table:"sales",limit:1});
  assert.deepEqual(result.rows, [{city:"Paris",amount:12.5,note:"=1+1"}]);
  assert.deepEqual(result.columns, ["city","amount","note"]);
  assert.equal(result.count, 1);
  assert.deepEqual(readFlowSqliteTable({filePath,table:"customers",limit:20}).rows, []);
  assert.throws(() => readFlowSqliteTable({filePath,table:"sales;DROP TABLE sales",limit:1}), FlowSourceError);
  assert.throws(() => readFlowSqliteTable({filePath,table:"sales",limit:20001}), FlowSourceError);
  assert.throws(() => readFlowSqliteTable({filePath,table:"missing",limit:1}), (e) => e.status === 404);
  assert.throws(() => checkFlowSourceToken("", "test-secret"), (e) => e.status === 403);
  assert.throws(() => checkFlowSourceToken("wrong", "test-secret"), (e) => e.status === 403);
  assert.doesNotThrow(() => checkFlowSourceToken("test-secret", "test-secret"));
  assert.deepEqual(listFlowSqliteTables({ filePath }), ["customers", "sales"], "Read endpoints must not alter the database");
  console.log("Hydria Flow SQLite read-only source gate passed.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
