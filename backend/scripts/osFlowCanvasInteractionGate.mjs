// Chromium acceptance for the REAL Flow Manager component.
// Uses a known valid local workflow to isolate canvas gestures from the
// unrelated asynchronous project-creation journey tested separately.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs/promises";
const base=process.env.HYDRIA_VISUAL_BASE_URL||"http://127.0.0.1:3001";
const output=process.env.HYDRIA_FLOW_UI_SCREENSHOT||"/tmp/hydria-flow-interactions.png";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
try {
  await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:22000});
  await page.evaluate(async()=>{
    const {renderHydriaFlowManager}=await import("/components/workspaceFlowManager.js");
    const root=document.createElement("div");
    root.id="flow-gesture-acceptance";
    root.style.cssText="position:fixed;inset:0;z-index:99999;overflow:auto;padding:14px;background:#f8fafc;";
    document.body.append(root);
    const flow={
      kind:"hydria-dataflow",
      stages:[
        {id:"input-1",type:"input.table",label:"Source",x:95,y:110,
          config:{data:'[{"city":"Paris","sales":10}]'}},
        {id:"filter-1",type:"transform.filter",label:"Filter",x:400,y:110,
          config:{column:"sales",operator:"gte",value:"5"}}
      ],
      links:[{id:"link-1",from:"input-1",to:"filter-1",toPort:0}]
    };
    window.__hydriaFlowSerialized=JSON.stringify(flow);
    renderHydriaFlowManager(root,{
      title:"Flow acceptance",
      content:window.__hydriaFlowSerialized,
      onChange:(json)=>{window.__hydriaFlowSerialized=json;}
    });
  });
  const manager=page.locator("#flow-gesture-acceptance .hydria-flow-manager");
  await manager.waitFor({state:"visible",timeout:10000});
  const palette=manager.locator(".hydria-flow-palette");
  const search=palette.locator(".hydria-flow-search");
  await search.fill("filter");
  const source=palette.locator('[data-node-type="transform.filter"]').first();
  await source.waitFor({state:"visible",timeout:10000});
  const graph=manager.locator(".hydria-flow-scroll");
  const count=await manager.locator(".hydria-flow-node").count();
  assert.equal(count,2);
  const bounds=await graph.boundingBox();
  assert.ok(bounds?.width>300&&bounds.height>100);
  await source.dragTo(graph,{targetPosition:{x:Math.min(350,bounds.width*.6),y:160}});
  assert.equal(await manager.locator(".hydria-flow-node").count(),count+1,"drop creates graph node");
  const last=manager.locator(".hydria-flow-node").last();
  const pos=await last.evaluate(el=>({x:parseInt(el.style.left),y:parseInt(el.style.top)}));
  assert.ok(pos.x>=0&&pos.y>=0,"drop maps to graph coordinates");
  assert.equal(await search.inputValue(),"filter","palette filter stays after drop");
  await last.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await manager.locator(".hydria-flow-node").last().evaluate(el=>parseInt(el.style.left)),
    pos.x+10,"arrow key moves focused node 10 units");
  await manager.locator(".hydria-flow-node").last().focus();
  await page.keyboard.press("Shift+ArrowDown");
  assert.equal(await manager.locator(".hydria-flow-node").last().evaluate(el=>parseInt(el.style.top)),
    pos.y+20,"shift arrow moves 20 units");
  await manager.getByRole("button",{name:"Undo",exact:true}).click();
  assert.equal(await manager.locator(".hydria-flow-node").last().evaluate(el=>parseInt(el.style.top)),
    pos.y,"undo restores node coordinate");
  await manager.getByRole("button",{name:"Fit",exact:true}).click();
  assert.equal(await manager.locator(".hydria-flow-node").count(),3,"fit preserves workflow");
  const stored=await page.evaluate(()=>JSON.parse(window.__hydriaFlowSerialized));
  assert.equal(stored.stages.length,3,"model changes persisted to editor onChange");
  await fs.mkdir("/tmp",{recursive:true});
  await page.screenshot({path:output,fullPage:false});
  console.log("Real Flow Manager component: drag/drop, keyboard movement, undo, zoom fit and persistence passed.");
}finally{
  await browser.close();
}
