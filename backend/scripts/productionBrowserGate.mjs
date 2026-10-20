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
const createdArtCraftFixtures=[];
const sleep=(n)=>new Promise(resolve=>setTimeout(resolve,n));
const env={
  ...process.env,NODE_ENV:"production",PORT:String(port),
  HYDRIA_OS_ACCESS_USERNAME:user,HYDRIA_OS_ACCESS_PASSWORD:password,
  HYDRIA_OS_PUBLIC_ORIGIN:"https://os.example.org",HYDRIA_OS_DATA_DIR:tmp,
  LOCAL_LLM_ENABLED:"false",ENABLE_LOCAL_TOOLS:"false",
  HYDRIA_FLOW_SCHEDULER_ENABLED:"false"
};
try {
  // Only create miniature HTML assets when an upstream distribution is absent.
  // Never overwrite genuine WASM releases on a developer's machine.
  for (const editor of ["pdfcraft", "photocraft", "figcraft"]) {
    const directory=path.resolve(root,"../frontend/vendor",editor);
    if (fs.existsSync(directory)) continue;
    fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,"index.html"),
      "<!doctype html><html><body><main id='frame-proof'>" +
      editor + "-same-origin-frame-ready</main></body></html>");
    createdArtCraftFixtures.push({editor,directory});
  }
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
  // Confirm the real production Node server sends the intended headers, and
  // that Chromium actually renders each authenticated editor inside Hydria.
  const frameHost=await page.goto(base+"/workspace/docs",{waitUntil:"domcontentloaded"});
  assert.equal(frameHost.headers()["x-frame-options"],"DENY");
  for(const editor of ["pdfcraft","photocraft","figcraft"]) {
    const response=await context.request.get(base+"/vendor/"+editor+"/index.html");
    if (response.status() !== 200) {
      assert.equal(response.status(),404,"Unexpected ArtCraft entrypoint response");
      continue;
    }
    assert.equal(response.headers()["x-frame-options"],"SAMEORIGIN");
    assert.equal(response.headers()["content-security-policy"],"frame-ancestors 'self'");
  }
  for(const {editor} of createdArtCraftFixtures) {
    await page.evaluate((slug)=>{
      const iframe=document.createElement("iframe");
      iframe.dataset.artcraftProbe=slug;
      iframe.title=slug+" embedded production test";
      iframe.src="/vendor/"+slug+"/index.html";
      iframe.style.width="480px";
      iframe.style.height="160px";
      document.body.append(iframe);
    },editor);
    await page.frameLocator("iframe[data-artcraft-probe='"+editor+"']")
      .getByText(editor+"-same-origin-frame-ready").waitFor({timeout:15000});
  }
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
  for(const fixture of createdArtCraftFixtures) {
    fs.rmSync(fixture.directory,{recursive:true,force:true});
  }
  fs.rmSync(tmp,{recursive:true,force:true});
}
