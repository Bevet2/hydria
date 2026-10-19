// Full HTTP acceptance of Flow Manager -> Sheets -> Dashboard on a disposable
// Hydria OS instance. No external services and no production credentials.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { flowPublicationModels } from "../services/flow/flowPublicationModels.js";
import { FlowResultError } from "../services/flow/flowResults.js";

const src={id:"11111111-1111-4111-8111-111111111111",label:"Revenue",createdAt:"2026-10-19T00:00:00Z",
  rows:[{region:"Paris",revenue:10},{region:"Lyon",revenue:22},{region:"Paris",revenue:5}]};
const models=flowPublicationModels(src,{sheetId:"sheet-object-1"});
assert.deepEqual(models.sheet.sheets[0].rows[0],["region","revenue"]);
assert.equal(models.sheet.sheets[0].rows.length,4);
assert.equal(models.dashboard.source.workObjectId,"sheet-object-1");
assert.equal(models.dashboard.metrics[0].value,"3");
assert.equal(models.dashboard.metrics[1].value,"37");
assert.equal(models.dashboard.charts[0].points.length,2);
assert.equal(flowPublicationModels({...src,rows:[{danger:"=2+2"}]}).sheet.sheets[0].rows[1][0],"'=2+2");
assert.throws(()=>flowPublicationModels({...src,rows:Array.from({length:5001},()=>({x:1}))}),e=>e instanceof FlowResultError&&e.status===413);

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const folder=fs.mkdtempSync(path.join(os.tmpdir(),"hydria-flow-publishing-"));
const port=39481,base="http://127.0.0.1:"+port,token="private-integration-flow-token-2026";
const env={...process.env,NODE_ENV:"test",PORT:String(port),
  HYDRIA_OS_DATA_DIR:folder,HYDRIA_FLOW_CONNECTOR_TOKEN:token,
  LOCAL_LLM_ENABLED:"false",ENABLE_LOCAL_TOOLS:"false",
  HYDRIA_FLOW_SCHEDULER_ENABLED:"false"};
let server;
const pause=(ms)=>new Promise(r=>setTimeout(r,ms));
const request=async(url,{method="GET",body,authorized=true}={})=>{
  const reply=await fetch(base+url,{method,
    headers:{"content-type":"application/json",...(authorized?{"x-hydria-flow-token":token}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await reply.json().catch(()=>({}));
  return {status:reply.status,data};
};
try {
  server=spawn(process.execPath,["server.js"],{cwd:root,env,stdio:["ignore","pipe","pipe"]});
  let stderr="";server.stderr.on("data",chunk=>{stderr+=chunk.toString().slice(0,2000)});
  let ready=false;
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw new Error("Server exited: "+stderr.slice(-600));
    try{const r=await fetch(base+"/livez");if(r.status===200){ready=true;break}}catch{}
    await pause(100);
  }
  assert.ok(ready,"Hydria OS did not start: "+stderr.slice(-600));
  const created=await request("/api/users",{method:"POST",body:{username:"Flow Publisher"}});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const userId=created.data.user.id;
  const flowKey="12345678-1111-4111-8111-123456789abc";
  const flow=(n)=>({stages:[
    {id:"src",type:"input.table",config:{data:JSON.stringify([{region:"Paris",revenue:10*n},{region:"Lyon",revenue:7*n}])}},
    {id:"out",type:"output.table",config:{}}
  ],links:[{id:"edge",from:"src",to:"out",toPort:0}]});
  const save=async(n)=>{
    const r=await request("/api/flows/snapshots",{method:"POST",body:{flow:flow(n),historyId:flowKey,outputId:"out"}});
    assert.equal(r.status,201,JSON.stringify(r.data));
    return r.data.snapshot;
  };
  const initial=await save(1);
  const forbidden=await request("/api/flow-publications",{method:"POST",authorized:false,
    body:{flowKey,outputId:"out",snapshotId:initial.id,userId}});
  assert.equal(forbidden.status,403,"publication requires admin flow token");
  const invalid=await request("/api/flow-publications",{method:"POST",body:{
    flowKey,outputId:"wrong",snapshotId:initial.id,userId
  }});
  assert.equal(invalid.status,409,"cannot publish snapshot for another output");
  const first=await request("/api/flow-publications",{method:"POST",body:{
    flowKey,outputId:"out",snapshotId:initial.id,userId
  }});
  assert.equal(first.status,200,JSON.stringify(first.data));
  const {sheet,dashboard}=first.data.publication;
  assert.ok(sheet.id&&dashboard.id&&sheet.id!==dashboard.id);
  const sheetView=await request("/api/work-objects/"+sheet.id+"?content=1",{authorized:false});
  assert.equal(sheetView.status,200,JSON.stringify(sheetView.data));
  const sheetModel=JSON.parse(sheetView.data.workObject.file.content);
  assert.equal(sheetModel.kind,"hydria-sheet");
  assert.equal(sheetModel.sheets[0].rows[1][1],10);
  const dashboardView=await request("/api/work-objects/"+dashboard.id+"?content=1",{authorized:false});
  assert.equal(dashboardView.status,200);
  const dashboardModel=JSON.parse(dashboardView.data.workObject.file.content);
  assert.equal(dashboardModel.source.workObjectId,sheet.id);
  assert.equal(dashboardModel.metrics[0].value,"2");

  const refreshSnapshot=await save(3);
  const updated=await request("/api/flow-publications",{method:"POST",body:{
    flowKey,outputId:"out",snapshotId:refreshSnapshot.id,userId
  }});
  assert.equal(updated.status,200,JSON.stringify(updated.data));
  assert.equal(updated.data.publication.sheet.id,sheet.id,"should refresh same Sheet");
  assert.equal(updated.data.publication.dashboard.id,dashboard.id,"should refresh same Dashboard");
  const refreshed=await request("/api/work-objects/"+sheet.id+"?content=1",{authorized:false});
  assert.equal(JSON.parse(refreshed.data.workObject.file.content).sheets[0].rows[1][1],30);
  const latest=await request("/api/flow-publications/"+flowKey+"/out?userId="+userId);
  assert.equal(latest.status,200);
  assert.equal(latest.data.publication.snapshotId,refreshSnapshot.id);
  const users=await request("/api/work-objects?userId="+userId,{authorized:false});
  assert.equal(users.status,200);
  assert.ok(JSON.stringify(users.data).includes(sheet.id)&&JSON.stringify(users.data).includes(dashboard.id),
    "Published objects should be visible in the user's library");
  console.log("Flow → Sheets → Dashboard HTTP gate passed: secure publication, native models, library, idempotent refresh.");
}finally {
  if(server?.exitCode===null){
    server.kill("SIGTERM");
    await Promise.race([new Promise(resolve=>server.once("exit",resolve)),
      pause(5000).then(()=>{if(server.exitCode===null)server.kill("SIGKILL")})]);
  }
  fs.rmSync(folder,{recursive:true,force:true});
}
