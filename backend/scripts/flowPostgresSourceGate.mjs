import assert from "node:assert/strict";
import {
  listFlowPostgresTables, readFlowPostgresTable, runConfiguredPsql
} from "../services/flow/flowPostgresSource.js";

const calls = [];
const query = async (sql) => {
  calls.push(sql);
  if (sql.includes("information_schema.tables")) {
    return JSON.stringify([{schema:"public",name:"sales"}, {schema:"analytics",name:"monthly"}]);
  }
  if (sql.includes('"public"."sales"')) {
    return JSON.stringify([{city:"Paris",amount:8,payload:{x:1}}, {city:"Lyon",amount:4,note:"=1+1"}]);
  }
  return "[]";
};
const catalog = await listFlowPostgresTables({query});
assert.deepEqual(catalog,[{schema:"public",name:"sales"},{schema:"analytics",name:"monthly"}]);
const result = await readFlowPostgresTable({schema:"public",table:"sales",limit:4,query});
assert.equal(result.count,2);
assert.deepEqual(result.columns,["city","amount","payload","note"]);
assert.deepEqual(result.rows,[
  {city:"Paris",amount:8,payload:'{"x":1}'},{city:"Lyon",amount:4,note:"=1+1"}
]);
assert.match(calls[2],/FROM "public"."sales" LIMIT 4/);
assert.match(calls[1],/information_schema\.tables/);
await assert.rejects(
  readFlowPostgresTable({schema:"public",table:"sales;DROP TABLE users",query}),
  /Invalid PostgreSQL table/
);
await assert.rejects(
  readFlowPostgresTable({schema:"private",table:"secrets",query}),
  (e) => e.status === 404
);
await assert.rejects(
  readFlowPostgresTable({schema:"public",table:"sales",limit:20001,query}),
  /1–20,000/
);
const secret = "never-print-me";
let captured;
const mockExec = async (binary,args,options) => {
  captured = { binary,args,options };
  return {stdout:"[]\n",stderr:""};
};
const configured = {
  HYDRIA_FLOW_PG_HOST:"db.internal",
  HYDRIA_FLOW_PG_DATABASE:"business",
  HYDRIA_FLOW_PG_USER:"readonly",
  HYDRIA_FLOW_PG_PASSWORD:secret,
  HYDRIA_FLOW_PG_SSLMODE:"require",
  HYDRIA_FLOW_PG_PORT:"5432"
};
assert.equal(await runConfiguredPsql("SELECT '[]'::json;",{settings:configured,exec:mockExec}),"[]");
assert.equal(captured.options.env.PGPASSWORD,secret);
assert.equal(captured.options.env.PGOPTIONS.includes("default_transaction_read_only=on"),true);
assert.equal(captured.args.join(" ").includes(secret),false);
assert.equal(captured.options.shell,undefined);
await assert.rejects(
  runConfiguredPsql("SELECT 1",{settings:{...configured,HYDRIA_FLOW_PG_SSLMODE:"prefer"},exec:mockExec}),
  (e) => e.status === 503
);
await assert.rejects(
  runConfiguredPsql("SELECT 1",{settings:{},exec:mockExec}),
  (e) => e.status === 503
);
await assert.rejects(
  runConfiguredPsql("SELECT 1",{settings:configured,exec:async()=>{throw Error("password="+secret)}}),
  (e) => e.status === 503 && !e.message.includes(secret)
);
console.log("Hydria PostgreSQL source gate passed.");
