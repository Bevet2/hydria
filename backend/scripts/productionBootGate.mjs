import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(path.join(os.tmpdir(),"hydria-production-boot-"));
const port = 39317;
const base = `http://127.0.0.1:${port}`;
const username = "hydria_owner";
const password = "ci-private-hydria-owner-password-12345";
const env = {
  ...process.env, NODE_ENV:"production", PORT:String(port),
  HYDRIA_OS_ACCESS_USERNAME:username,
  HYDRIA_OS_ACCESS_PASSWORD:password,
  HYDRIA_OS_PUBLIC_ORIGIN:"https://os.example.org",
  HYDRIA_OS_DATA_DIR:temp, ENABLE_LOCAL_TOOLS:"false",
  HYDRIA_FLOW_SCHEDULER_ENABLED:"false",
  LOCAL_LLM_ENABLED:"false",
  OPENROUTER_API_KEY:"", HYDRIA_CORE_ENABLED:"false"
};
let child;
const token="Basic "+Buffer.from(username+":"+password).toString("base64");
const auth={authorization:token};
const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms));
async function boot() {
  child = spawn(process.execPath,["server.js"],{
    cwd:backend,env,stdio:["ignore","pipe","pipe"]
  });
  let log="";
  child.stdout.on("data",(d)=>{log=(log+d.toString()).slice(-3000);});
  child.stderr.on("data",(d)=>{log=(log+d.toString()).slice(-3000);});
  for(let i=0;i<80;i++){
    if(child.exitCode !== null)throw Error("Hydria production exited: "+log);
    try {
      const response = await fetch(base+"/livez");
      if(response.status===200)return;
    }catch {}
    await sleep(125);
  }
  throw Error("Hydria production didn't start: "+log);
}
async function stop() {
  if (!child) return;
  const processToStop=child;
  child=null;
  if(processToStop.exitCode===null)processToStop.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve)=>processToStop.once("exit",resolve)),
    sleep(5000).then(()=>{if(processToStop.exitCode===null) processToStop.kill("SIGKILL");})
  ]);
}
try {
  await boot();
  assert.equal((await fetch(base+"/")).status,401);
  assert.equal((await fetch(base+"/api/health")).status,401);
  assert.equal((await fetch(base+"/api/users")).status,401);
  assert.equal((await fetch(base+"/api/users",{headers:auth})).status,200);
  assert.equal((await fetch(base+"/api/users",{headers:{authorization:"Basic invalid"}})).status,401);
  assert.equal((await fetch(base+"/")).status,401);
  assert.equal((await fetch(base+"/",{headers:auth})).status,200);
  const created=await fetch(base+"/api/users",{
    method:"POST",headers:{...auth,"content-type":"application/json",
      origin:"https://os.example.org", "sec-fetch-site":"same-origin"},
    body:JSON.stringify({username:"persisted_user"})
  });
  assert.equal(created.status,201,await created.text());
  const blocked=await fetch(base+"/api/users",{
    method:"POST",headers:{...auth,"content-type":"application/json",
      origin:"https://untrusted.example"},
    body:JSON.stringify({username:"malicious"})
  });
  assert.equal(blocked.status,403);
  assert.ok(existsSync(path.join(temp,"hydria.sqlite")));
  await stop();
  await boot();
  const users=await fetch(base+"/api/users",{headers:auth});
  assert.equal(users.status,200);
  const json=await users.json();
  assert.ok(json.users.some((user)=>user.username==="persisted_user"),
    "SQLite state must survive production restart");
  console.log("Hydria production boot, isolation, cross-origin gate and persistent SQLite passed.");
} finally {
  await stop();
  rmSync(temp,{recursive:true,force:true});
}
