// Isolated exploratory tests: intentionally leave failures visible in the report.
// Never target a public/prod domain. CI launches a disposable local server and DB.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const base=process.env.HYDRIA_BUGHUNT_BASE_URL||"http://127.0.0.1:3001";
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(base))throw Error("Bug hunt HTTP probes require loopback");
const cases=[], started=Date.now();
async function probe(id,category,severity,fn){
  const start=Date.now();
  try{const observation=await fn();cases.push({id,category,severity,status:"pass",durationMs:Date.now()-start,observation});}
  catch(err){cases.push({id,category,severity,status:"finding",durationMs:Date.now()-start,message:String(err?.message||err).slice(0,1000)});}
}
async function request(url,method="GET",body,headers={}){
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),8000);
  try {
    const r=await fetch(base+url,{method,headers:{"content-type":"application/json",...headers},body:body===undefined?undefined:JSON.stringify(body),signal:ctrl.signal});
    const text=await r.text();
    let json=null;try{json=JSON.parse(text)}catch{}
    return {status:r.status,text:text.slice(0,2500),json,headers:r.headers};
  }finally{clearTimeout(timer)}
}
const safeJson=r=>r.json||{};
const checkStatus=(r,status,detail="")=>assert.equal(r.status,status,detail+" "+r.text.slice(0,200));
await probe("api-01","health","P0",async()=>{
  const r=await request("/api/health/ready");checkStatus(r,200);assert.equal(r.json?.status,"ready");
});
await probe("api-02","health","P1",async()=>{
  const r=await request("/livez");checkStatus(r,200);assert.equal(r.text,"ok");
});
await probe("api-03","users","P2",async()=>{
  const r=await request("/api/users","POST",{username:"  "});checkStatus(r,400);
});
await probe("api-04","users","P2",async()=>{
  const r=await request("/api/users","POST",{username:42});checkStatus(r,400,"numeric username should be client error");
});
await probe("api-05","users","P2",async()=>{
  const r=await request("/api/users","POST",{username:{toString:"foo"}});checkStatus(r,400,"object username should be client error");
});
await probe("api-06","users","P2",async()=>{
  const r=await request("/api/users","POST",{username:["strange"]});checkStatus(r,400,"array username should be client error");
});
await probe("api-07","users","P2",async()=>{
  const r=await request("/api/users","POST",null);checkStatus(r,400);
});
let userId=null;
await probe("api-08","users","P1",async()=>{
  const a=await request("/api/users","POST",{username:"os_bug_hunt_account"});
  checkStatus(a,201);userId=a.json?.user?.id;assert.ok(userId>0);
  const b=await request("/api/users","POST",{username:"OS_BUG_HUNT_ACCOUNT"});checkStatus(b,201);
  assert.equal(b.json?.user?.id,userId,"case-insensitive deduplication");
});
await probe("api-09","users","P2",async()=>{
  const r=await request("/api/users");checkStatus(r,200);
  assert.ok(Array.isArray(r.json?.users));
});
await probe("api-10","users","P3",async()=>{
  const r=await request("/api/users/not-an-int/conversations");
  assert.ok([200,400,404].includes(r.status),"Invalid user identifier produced unexpected error "+r.status);
  if(r.status===200)assert.deepEqual(r.json?.conversations,[],"Non-numeric user IDs must not map to real data");
  return {invalidIdStatus:r.status,contractNote:"Empty 200 is tolerated for legacy routes; strict 400 would be clearer."};
});
await probe("api-11","users","P2",async()=>{
  const r=await request("/api/users/999999/conversations");
  assert.ok([200,404].includes(r.status),"Non-existing user ID returned "+r.status);
});
let workObjectId=null,revision=null,filePath=null,original="";
await probe("api-12","files","P1",async()=>{
  const r=await request("/api/work-objects/new","POST",{
    kind:"document",title:"Bug hunt: émoji 🧪 / العربية / 你好",userId
  });checkStatus(r,200);assert.ok(r.json?.workObject?.id);
  workObjectId=r.json.workObject.id;
  return {created:true};
});
await probe("api-13","files","P1",async()=>{
  assert.ok(workObjectId,"object creation is a prerequisite");
  const r=await request("/api/work-objects/"+workObjectId+"?content=1");checkStatus(r,200);
  revision=r.json?.workObject?.revision;filePath=r.json?.workObject?.file?.path;
  original=r.json?.workObject?.file?.content||"";
  assert.ok(filePath,"document should have an editable file path");
  return {revision,filePath};
});
await probe("api-14","files","P1",async()=>{
  assert.ok(workObjectId&&filePath);
  const marker="unicode-🧪-\u202E-\nline2";
  const r=await request("/api/work-objects/"+workObjectId+"/content","PATCH",{
    content:marker,entryPath:filePath,userId,expectedRevision:revision
  });checkStatus(r,200);
  const reread=await request("/api/work-objects/"+workObjectId+"?content=1");
  checkStatus(reread,200);
  assert.equal(reread.json?.workObject?.file?.content,marker,"saved bytes should survive HTTP readback");
  revision=reread.json?.workObject?.revision;
});
await probe("api-15","files","P1",async()=>{
  assert.ok(workObjectId&&filePath);
  const r=await request("/api/work-objects/"+workObjectId+"/content","PATCH",{
    content:"stale revision",entryPath:filePath,userId,expectedRevision:revision-1
  });
  checkStatus(r,409,"optimistic locking must reject a stale editor");
});
await probe("api-16","files","P1",async()=>{
  assert.ok(workObjectId);
  const r=await request("/api/work-objects/"+workObjectId+"/history");
  checkStatus(r,200);
  assert.ok(Array.isArray(r.json?.history) && r.json.history.length>0,"revision history must exist");
});
let projectId=null,projectFilePath=null;
await probe("api-16b","files","P1",async()=>{
  const r=await request("/api/work-objects/new","POST",{kind:"project",title:"Bug hunt project",userId});
  checkStatus(r,200);
  projectId=r.json?.workObject?.id;
  assert.ok(projectId,"project work object needed to test editable file operations");
  const d=await request("/api/work-objects/"+projectId+"?content=1");
  checkStatus(d,200);
  projectFilePath=d.json?.workObject?.file?.path;
  assert.ok(projectFilePath);
});
await probe("api-17","files","P1",async()=>{
  assert.ok(projectId);
  const r=await request("/api/work-objects/"+projectId+"/files/new","POST",{
    entryPath:"../../../../unsafe-bughunt.txt",content:"no",userId
  });checkStatus(r,400,"path traversal must be refused");
});
await probe("api-18","files","P1",async()=>{
  assert.ok(projectId);
  const r=await request("/api/work-objects/"+projectId+"/files/new","POST",{
    entryPath:".env.production",content:"secret",userId
  });checkStatus(r,400,"sensitive dot-env filename must be refused");
});
await probe("api-19","files","P1",async()=>{
  assert.ok(projectId);
  const r=await request("/api/work-objects/"+projectId+"/files/move","POST",{
    from:projectFilePath,to:"../../outside.md",userId
  });checkStatus(r,400,"unsafe file move must be refused");
});
await probe("api-20","files","P1",async()=>{
  const r=await request("/api/work-objects/does-not-exist?content=1");checkStatus(r,404);
});
await probe("api-21","files","P1",async()=>{
  assert.ok(workObjectId);
  const r=await request("/api/work-objects/"+workObjectId,"DELETE",{userId,confirmation:"wrong"});
  checkStatus(r,400,"permanent deletion requires explicit confirmation");
});
await probe("api-22","files","P2",async()=>{
  const r=await request("/api/work-objects/search?q="+encodeURIComponent("unicode-🧪")+"&userId="+userId);
  checkStatus(r,200);assert.ok(Array.isArray(r.json?.results));
});
await probe("api-23","flow","P1",async()=>{
  const r=await request("/api/flows/catalog");checkStatus(r,200);
  assert.ok((r.json?.nodes?.length||0)>10);
});
await probe("api-24","flow","P1",async()=>{
  const r=await request("/api/flows/validate","POST",{flow:{stages:[],links:[]}});checkStatus(r,200);
  assert.equal(typeof r.json?.valid,"boolean");
});
await probe("api-25","flow","P1",async()=>{
  const r=await request("/api/flows/validate","POST",{flow:{
    stages:[{id:"A",type:"input.table",config:{data:"[]"}},{id:"B",type:"output.table"}],
    links:[{from:"A",to:"B"},{from:"B",to:"A"}]
  }});assert.ok([200,422].includes(r.status));assert.equal(r.json?.valid,false,"cycle must not be accepted");
});
await probe("api-26","flow","P1",async()=>{
  const r=await request("/api/flows/run","POST",{flow:{stages:[{id:"bad",type:"made.up"}],links:[]}});
  assert.ok([400,422].includes(r.status),"Unknown graph node should be 4xx, got "+r.status);
});
await probe("api-27","flow","P1",async()=>{
  const r=await request("/api/flows/run","POST",{
    flow:{stages:[{id:"input",type:"input.table",config:{data:"[\"oops\""}},{id:"output",type:"output.table"}],
      links:[{from:"input",to:"output",toPort:0}]}
  });
  assert.ok([400,422].includes(r.status),"Malformed table JSON should be rejected: "+r.status);
});
await probe("api-28","flow","P1",async()=>{
  const flow={stages:[{id:"src",type:"input.table",config:{
    data:JSON.stringify([{name:"=HYPERLINK(\"https://malicious.example\")",quantity:2},{name:"safe",quantity:3}])
  }},{id:"out",type:"output.table"}],links:[{id:"l",from:"src",to:"out",toPort:0}]};
  const r=await request("/api/flows/export","POST",{flow});checkStatus(r,200);
  assert.match(r.text,/['’]=HYPERLINK/,"CSV export must escape formula prefix");
});
await probe("api-29","flow","P2",async()=>{
  const r=await request("/api/flows/history/../../bad");
  assert.ok([400,404].includes(r.status),"unsafe flow history path response "+r.status);
});
await probe("api-30","flow","P1",async()=>{
  const r=await request("/api/flows/schedules");checkStatus(r,403,"scheduled flow is token protected");
});
await probe("api-31","flow","P1",async()=>{
  const r=await request("/api/flows/snapshots/not-a-key");checkStatus(r,403,"snapshots are token protected");
});
await probe("api-32","flow","P1",async()=>{
  const r=await request("/api/flow-sources/api/sources");checkStatus(r,403,"REST sources are token protected");
});
await probe("api-33","docs","P2",async()=>{
  const r=await request("/api/docs/export-docx","POST",{title:"probe",html:"<h1>Hello</h1><p>é🧪</p>"});
  checkStatus(r,200);assert.match(r.headers.get("content-type")||"",/officedocument|msword/);
  assert.equal(r.text.startsWith("PK"),true,"DOCX should have ZIP signature");
});
await probe("api-34","docs","P2",async()=>{
  const r=await request("/api/docs/export-pdf","POST",{title:"probe",html:"<p>Hello</p>"});
  checkStatus(r,200);assert.equal(r.text.startsWith("%PDF"),true);
});
await probe("api-35","docs","P1",async()=>{
  const r=await request("/api/docs/export-pdf","POST",{
    title:"bad image",
    html:'<p><img src="data:image/png;base64,AAE=" /></p>'
  });
  assert.ok([400,413,422].includes(r.status),"corrupt image must fail with 4xx (got "+r.status+")");
});
await probe("api-36","misc","P2",async()=>{
  const r=await request("/api/definitely-not-real");checkStatus(r,404);
});
await probe("api-37","files","P1",async()=>{
  assert.ok(projectId);const r=await request("/api/work-objects/"+projectId+"/files/new","POST",{
    entryPath:"safe-folder/one.txt",content:"created safely",userId
  });checkStatus(r,201);
  assert.equal(r.json?.workObject?.file?.content,"created safely");
});
await probe("api-38","files","P1",async()=>{
  assert.ok(projectId);const r=await request("/api/work-objects/"+projectId+"/files/new","POST",{
    entryPath:"safe-folder/one.txt",content:"duplicate",userId
  });checkStatus(r,409,"duplicate path must fail");
});
await probe("api-39","files","P1",async()=>{
  assert.ok(projectId);const r=await request("/api/work-objects/"+projectId+"/files/new","POST",{
    entryPath:"node_modules/secrets.md",content:"no",userId
  });checkStatus(r,400,"reserved directory must fail");
});
await probe("api-40","files","P1",async()=>{
  assert.ok(projectId);const r=await request("/api/work-objects/"+projectId+"/files/new","POST",{
    entryPath:"safe-folder/too-large.md",content:"x".repeat(1_000_100),userId
  });checkStatus(r,413,"file size limit must fail");
});
await probe("api-41","files","P1",async()=>{
  assert.ok(projectId);const r=await request("/api/work-objects/"+projectId+"/files/new","POST",{
    entryPath:"safe-folder/missing-extension",content:"no",userId
  });checkStatus(r,400,"unsupported file extension should fail");
});
await probe("api-42","files","P2",async()=>{
  const r=await request("/api/work-objects/new","POST",{kind:"document",title:{hello:"world"},userId});
  checkStatus(r,400,"non-string title must return validation error");
});
await probe("api-43","files","P2",async()=>{
  const r=await request("/api/work-objects/new","POST",{kind:"document",title:["array"],userId});
  checkStatus(r,400,"array title must return validation error");
});
await probe("api-44","flow","P2",async()=>{
  const r=await request("/api/flows/validate","POST",{flow:[]});
  assert.ok([200,400,422].includes(r.status),"malformed workflow should never be 5xx");
});
await probe("api-45","flow","P2",async()=>{
  const r=await request("/api/flows/validate","POST",{flow:{stages:"not-an-array",links:{}}});
  assert.ok([200,400,422].includes(r.status),"wrong graph shape should be 4xx or invalid result");
  assert.notEqual(r.json?.valid,true,"bad schema must not be marked valid");
});
await probe("api-46","flow","P1",async()=>{
  const r=await request("/api/flows/run","POST",{flow:{stages:"broken",links:[]}});
  assert.ok([400,422].includes(r.status),"bad workflow shape should not crash (got "+r.status+")");
});
await probe("api-47","security","P1",async()=>{
  const r=await request("/api/flows/schedules/"+encodeURIComponent("not-a-uuid"),"PUT",{
    flow:{stages:[],links:[]},intervalMinutes:15
  });checkStatus(r,403,"missing private token must be checked even for malformed schedule ID");
});
await probe("api-48","files","P2",async()=>{
  const r=await request("/api/work-objects/search?limit=abc&q=test");
  assert.ok([200,400].includes(r.status),"bad numeric search limit should not 5xx");
});
await probe("api-49","http","P2",async()=>{
  const r=await fetch(base+"/api/users",{method:"POST",headers:{"content-type":"application/json"},body:'{\"username\":'});
  assert.ok(r.status===400,"broken JSON must be 400; got "+r.status);
});
await probe("api-50","users","P2",async()=>{
  const r=await request("/api/users","POST",{username:"x".repeat(4096)});
  assert.ok([400,413,422].includes(r.status),"unbounded 4096 char username should be rejected; got "+r.status);
});
const report={suite:"Hydria OS exploratory API",commit:process.env.GITHUB_SHA||"unknown",
  runDate:new Date().toISOString(),durationMs:Date.now()-started,
  total:cases.length,passed:cases.filter(c=>c.status==="pass").length,
  findings:cases.filter(c=>c.status==="finding").length,cases};
await fs.mkdir("/tmp/hydria-bughunt",{recursive:true});
await fs.writeFile("/tmp/hydria-bughunt/api.json",JSON.stringify(report,null,2)+"\n");
for(const item of cases)console.log((item.status==="pass"?"PASS":"FIND")+" "+item.id+" "+(item.message||""));
console.log("BUG_HUNT_SUMMARY "+JSON.stringify({total:report.total,passed:report.passed,findings:report.findings}));
if (process.env.HYDRIA_BUGHUNT_STRICT === "1" && report.findings > 0) {
  console.error("Hydria API regression gate: " + report.findings + " failed checks. See api.json.");
  process.exitCode = 1;
}
