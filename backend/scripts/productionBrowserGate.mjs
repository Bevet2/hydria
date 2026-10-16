// Browser-level production acceptance: shared Basic auth on UI + same-origin APIs.
// Run only on loopback in CI; real deployments MUST terminate HTTPS at Caddy.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"hydria-prod-browser-"));
const port=39318,base=`http://127.0.0.1:${port}`;
const user="visual_owner",password="ci-owner-password-long-and-random";
let child, browser;
const sleep=(n)=>new Promise(resolve=>setTimeout(resolve,n));
const env={
  ...process.env,NODE_ENV:"production",PORT:String(port),
  HYDRIA_OS_ACCESS_USERNAME:user,HYDRIA_OS_ACCESS_PASSWORD:password,
  HYDRIA_OS_PUBLIC_ORIGIN:"https://os.example.org",HYDRIA_OS_DATA_DIR:tmp,
  LOCAL_LLM_ENABLED:"false",ENABLE_LOCAL_TOOLS:"false",
  HYDRIA_FLOW_SCHEDULER_ENABLED:"false"
};
try {
  child=spawn(process.execPath,["server.js"],{cwd:root,env,stdio:"ignore"});
  let started=false;
  for(let i=0;i<100;i++){
    if(child.exitCode !== null) throw Error("Production process exited early");
    try { if((await fetch(base+"/livez")).ok){started=true;break;} }
    catch {}
    await sleep(100);
  }
  assert.ok(started,"Production server did not start");
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    viewport:{width:1360,height:850},
    httpCredentials:{username:user,password}
  });
  const page=await context.newPage();
  const home=await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:25000});
  assert.equal(home.status(),200,"Authenticated owner should view Hydria OS");
  await page.locator(".app-shell").waitFor({state:"visible",timeout:15000});
  assert.equal(await page.locator("#new-project-button").count(),1);
  assert.equal(await page.evaluate(async()=>{
    const response=await fetch("/api/health/ready",{cache:"no-store"});
    return response.status;
  }),200,"Authenticated same-origin frontend API calls must work");
  const docs=await page.goto(base+"/workspace/docs",{waitUntil:"domcontentloaded",timeout:25000});
  assert.equal(docs.status(),200);
  const dashboard=await page.goto(base+"/flow-dashboard.html?flowKey=11111111-1111-4111-8111-111111111111",
    {waitUntil:"domcontentloaded",timeout:25000});
  assert.equal(dashboard.status(),200);
  assert.ok((await page.title()).includes("Hydria"));
  await context.close();
  console.log("Hydria OS production browser authentication, UI and API smoke passed.");
} finally {
  if(browser)await browser.close();
  if(child?.exitCode===null){
    child.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve=>child.once("exit",resolve)),
      sleep(5000).then(()=>{if(child.exitCode===null)child.kill("SIGKILL");})
    ]);
  }
  fs.rmSync(tmp,{recursive:true,force:true});
}
