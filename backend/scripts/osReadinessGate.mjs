import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { inspectOsReadiness } from "../services/operations/readiness.js";

const home=fs.mkdtempSync(path.join(os.tmpdir(),"hydria-readiness-"));
const dataDir=path.join(home,"data"),frontendDir=path.join(home,"frontend");
fs.mkdirSync(dataDir);fs.mkdirSync(frontendDir);
fs.writeFileSync(path.join(frontendDir,"index.html"),"ok");
const db=new Database(":memory:");
try {
  const good=inspectOsReadiness({database:db,dataDir,frontendDir});
  assert.equal(good.ready,true);
  assert.deepEqual(good.checks,{database:"ready",storage:"ready",frontend:"ready"});
  assert.equal(inspectOsReadiness({database:db,dataDir,frontendDir:"/missing/dir"}).ready,false);
  assert.equal(inspectOsReadiness({database:db,dataDir:"/missing/dir",frontendDir}).checks.storage,"unavailable");
  db.close();
  const failed=inspectOsReadiness({database:db,dataDir,frontendDir});
  assert.equal(failed.ready,false);
  assert.equal(failed.checks.database,"unavailable");
  console.log("Hydria OS readiness gate passed.");
} finally {
  if (db.open) db.close();
  fs.rmSync(home,{recursive:true,force:true});
}
