// Real Chromium bug hunt. Individual cases continue on failure, saving evidence.
// Runs against a disposable localhost Hydria OS, never real user data.
import fs from "node:fs/promises";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const base=process.env.HYDRIA_BUGHUNT_BASE_URL||"http://127.0.0.1:3001";
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(base))throw Error("Bug hunt must run on loopback");
const dir="/tmp/hydria-bughunt", results=[],start=Date.now();
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
async function probe(id,category,severity,view,run) {
  const ctx=await browser.newContext({viewport:view,deviceScaleFactor:1});
  const page=await ctx.newPage(),errors=[],responses=[];
  page.on("pageerror",e=>errors.push(String(e).slice(0,360)));
  page.on("response",r=>{
    if(r.url().includes("/api/")&&r.status()>=500)responses.push({url:r.url().replace(base,""),status:r.status()});
  });
  const t=Date.now();
  try{
    const observation=await run(page,errors,responses);
    if(errors.length)throw Error("Unhandled browser exceptions: "+JSON.stringify(errors.slice(0,4)));
    if(responses.length)throw Error("Server returned 5xx: "+JSON.stringify(responses.slice(0,4)));
    results.push({id,category,severity,status:"pass",durationMs:Date.now()-t,observation});
    console.log("PASS "+id);
  }catch(e) {
    const screenshot=id+".png";
    try{await page.screenshot({path:dir+"/"+screenshot,timeout:2500,fullPage:false})}catch{}
    const issue={id,category,severity,status:"finding",message:String(e?.message||e).slice(0,800),
      durationMs:Date.now()-t,screenshot,jsErrors:errors.slice(0,5),http5xx:responses.slice(0,5)};
    results.push(issue);console.log("FIND "+id+" "+issue.message.slice(0,250));
  }finally {await ctx.close();}
}
const desktop={width:1440,height:900},mobile={width:390,height:844};
async function home(page) {
  const response=await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:15000});
  assert.equal(response.status(),200);
  await page.locator(".sidebar").waitFor({state:"attached",timeout:15000});
  await page.locator("#workspace-switcher .workspace-switcher-chip").first().waitFor({timeout:15000});
}
const overflow=page=>page.evaluate(()=>{
  const el=document.documentElement;
  return {viewport:innerWidth,scrollWidth:el.scrollWidth,
    offenders:[...document.querySelectorAll("body *")].filter(x=>{
      const r=x.getBoundingClientRect();return r.width>0&&r.right>innerWidth+12&&
        getComputedStyle(x).position!=="fixed";
    }).slice(0,6).map(x=>({tag:x.tagName,cls:String(x.className).slice(0,80),width:Math.round(x.getBoundingClientRect().width)}))};
});
await probe("ui-01","shell","P1",desktop,async page=>{
  await home(page);
  const n=await page.locator(".workspace-switcher-chip").count();
  assert.ok(n>=12,"global navigation should contain workspaces");
  const dims=await overflow(page);
  assert.ok(dims.scrollWidth<=dims.viewport+3,"Horizontal overflow: "+JSON.stringify(dims));
  return {navItems:n,...dims};
});
await probe("ui-02","shell","P2",desktop,async page=>{
  await home(page);await page.locator("#os-theme-toggle").click();
  assert.equal(await page.locator("body").getAttribute("data-os-theme"),"dark");
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.body.dataset.osTheme==="dark",{timeout:5000});
  assert.equal(await page.locator("body").getAttribute("data-os-theme"),"dark");
});
await probe("ui-03","shell","P2",desktop,async page=>{
  await home(page);await page.locator("#os-collapse-sidebar").click();
  assert.equal(await page.locator("body").evaluate(x=>x.classList.contains("os-sidebar-collapsed")),true);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.body.classList.contains("os-sidebar-collapsed"),{timeout:5000});
});
await probe("ui-04","mobile","P1",mobile,async page=>{
  await home(page);await page.waitForTimeout(260);
  const menu=page.locator("#os-mobile-menu");await menu.click();
  assert.equal(await page.locator("body").evaluate(x=>x.classList.contains("os-sidebar-open")),true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("body").evaluate(x=>x.classList.contains("os-sidebar-open")),false);
});
await probe("ui-05","mobile","P1",mobile,async page=>{
  await home(page);await page.waitForTimeout(260);
  const d=await overflow(page);
  assert.ok(d.scrollWidth<=d.viewport+3,"Horizontal overflow: "+JSON.stringify(d));
  return d;
});
await probe("ui-06","shell","P2",desktop,async page=>{
  await home(page);const search=page.locator("#os-command-search");
  await search.waitFor({state:"visible"});await search.click();
  const palette=page.locator('[role="dialog"],.workspace-command-palette,.command-palette');
  await palette.first().waitFor({state:"visible",timeout:5000});
  await page.keyboard.press("Escape");
  assert.equal(await palette.first().isVisible(),false,"Search modal should close with Escape");
});
await probe("ui-07","navigation","P1",desktop,async page=>{
  await home(page);
  for(const slug of ["docs","sheets","slides","dashboard","flows","whiteboard"]){
    await page.goto(base+"/workspace/"+slug,{waitUntil:"domcontentloaded"});
    await page.locator("#workspace-panel-root").waitFor({state:"attached"});
    await page.waitForFunction(()=>document.querySelector("#workspace-title")?.textContent?.trim().length>0,null,{timeout:10000});
    assert.ok(await page.locator(".workspace-launcher").count()>0||await page.locator("#workspace-panel-root[data-has-workspace='true']").count()>0,
      slug+" no launcher or editor");
  }
});
await probe("ui-08","mobile","P2",mobile,async page=>{
  await home(page);await page.goto(base+"/workspace/docs",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector(".workspace-launcher-card")||
    document.querySelector('#workspace-panel-root[data-has-workspace="true"]'),null,{timeout:13000});
  const d=await overflow(page);
  assert.ok(d.scrollWidth<=d.viewport+5,"Docs mobile page horizontal overflow "+JSON.stringify(d));
  return d;
});
await probe("ui-09","mobile","P2",mobile,async page=>{
  await home(page);await page.goto(base+"/workspace/whiteboard",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector(".workspace-launcher-card")||
    document.querySelector('#workspace-panel-root[data-has-workspace="true"]'),null,{timeout:13000});
  const d=await overflow(page);
  assert.ok(d.scrollWidth<=d.viewport+5,"Whiteboard mobile navigation overflow "+JSON.stringify(d));
  return d;
});
await probe("ui-10","flow","P1",desktop,async page=>{
  await home(page);await page.evaluate(async()=>{
    const {renderHydriaFlowManager}=await import("/components/workspaceFlowManager.js");
    const el=document.createElement("div");
    el.id="hunt-flow";el.style.cssText="position:fixed;inset:0;background:white;z-index:10000;padding:8px;overflow:auto";
    document.body.append(el);
    const flow={kind:"hydria-dataflow",stages:[{id:"input1",type:"input.table",x:120,y:150,
      config:{data:'[{"value":1}]' }}],links:[]};
    window.__huntFlow=JSON.stringify(flow);
    renderHydriaFlowManager(el,{title:"Bug hunt",content:window.__huntFlow,onChange:x=>{window.__huntFlow=x}});
  });
  const root=page.locator("#hunt-flow .hydria-flow-manager");await root.waitFor({state:"visible"});
  const add=root.locator('[data-node-type="transform.filter"]').first();
  assert.ok(await add.count()>0);
  for(let i=0;i<8;i++) {
    await add.click();
    assert.equal(await root.locator(".hydria-flow-node").count(),i+2,"Adding nodes should preserve existing graph");
  }
  const fit=root.getByRole("button",{name:"Fit",exact:true});await fit.click();
  assert.equal(await root.locator(".hydria-flow-node").count(),9);
  const model=await page.evaluate(()=>JSON.parse(window.__huntFlow));
  assert.equal(model.stages.length,9,"All added stages must survive serialization");
});
await probe("ui-11","canvas","P1",desktop,async page=>{
  await home(page);await page.evaluate(async()=>{
    const {renderWorkspaceCanvasPanel}=await import("/components/workspaceCanvasPanel.js");
    const el=document.createElement("div");
    el.id="hunt-canvas";el.style.cssText="position:fixed;inset:0;z-index:10000;background:white;overflow:auto";
    document.body.append(el);
    const content=JSON.stringify({title:"Bug hunt",elements:[{id:"note",type:"note",title:"Note",
      body:"test",x:1,y:1,width:200,height:140,zIndex:1}],links:[]});
    window.__huntCanvas=content;
    renderWorkspaceCanvasPanel(el,{workObject:{title:"Bug hunt",metadata:{workspaceFamilyId:"canvas_board"}},
      content,onContentChange:x=>window.__huntCanvas=x});
  });
  const node=page.locator("#hunt-canvas .workspace-canvas-item").first();
  await node.focus();await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowLeft");await page.keyboard.press("ArrowUp");
  const content=await page.evaluate(()=>JSON.parse(window.__huntCanvas));
  assert.equal(content.elements[0].x,0,"Coordinate must clamp >=0");
  assert.equal(content.elements[0].y,0,"Coordinate must clamp >=0");
});
await probe("ui-12","canvas","P2",mobile,async page=>{
  await home(page);await page.evaluate(async()=>{
    const {renderWorkspaceCanvasPanel}=await import("/components/workspaceCanvasPanel.js");
    const el=document.createElement("div");
    el.id="hunt-canvas";el.style.cssText="position:fixed;inset:0;z-index:10000;background:white;overflow:auto";
    document.body.append(el);
    const content=JSON.stringify({title:"Bug hunt",elements:[{id:"note",type:"note",title:"Note",
      body:"editable",x:40,y:60,width:200,height:140,zIndex:1}],links:[]});
    window.__huntCanvas=content;
    renderWorkspaceCanvasPanel(el,{workObject:{title:"Bug hunt",metadata:{workspaceFamilyId:"canvas_board"}},
      content,onContentChange:x=>window.__huntCanvas=x});
  });
  const node=page.locator("#hunt-canvas .workspace-canvas-item").first();
  const r=await node.boundingBox();assert.ok(r?.width>100);
  assert.equal(await node.getAttribute("tabindex"),"0","touch devices must still support external keyboard focus");
});
await probe("ui-13","flow","P1",desktop,async page=>{
  await home(page);await page.evaluate(async()=>{
    const {renderHydriaFlowManager}=await import("/components/workspaceFlowManager.js");
    const host=document.createElement("div");
    host.id="hunt-flow";host.style.cssText="position:fixed;inset:0;z-index:10000;background:white;overflow:auto";
    document.body.append(host);
    const flow={kind:"hydria-dataflow",stages:[
      {id:"src",type:"input.table",x:120,y:120,config:{data:'[{"x":1}]'}},
      {id:"out",type:"output.table",x:400,y:180,config:{}}
    ],links:[{id:"e",from:"src",to:"out",toPort:0}]};
    window.__huntFlow=JSON.stringify(flow);
    renderHydriaFlowManager(host,{content:window.__huntFlow,onChange:x=>window.__huntFlow=x});
  });
  const root=page.locator("#hunt-flow .hydria-flow-manager");await root.waitFor({state:"visible"});
  const count=await root.locator(".hydria-flow-node").count();
  const zoom=root.getByRole("button",{name:"Fit",exact:true});await zoom.click();
  const saved=await page.evaluate(()=>JSON.parse(window.__huntFlow));
  assert.equal(saved.stages.length,count,"Fit must not mutate stages");
});
const report={suite:"Hydria OS exploratory browser",commit:process.env.GITHUB_SHA||"unknown",
  date:new Date().toISOString(),durationMs:Date.now()-start,total:results.length,
  passed:results.filter(x=>x.status==="pass").length,findings:results.filter(x=>x.status==="finding").length,cases:results};
await fs.writeFile(dir+"/browser.json",JSON.stringify(report,null,2)+"\n");
console.log("BUG_HUNT_SUMMARY "+JSON.stringify({total:report.total,passed:report.passed,findings:report.findings}));
await browser.close();
