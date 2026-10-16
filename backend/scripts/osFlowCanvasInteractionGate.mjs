import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs/promises";

const base=process.env.HYDRIA_VISUAL_BASE_URL||"http://127.0.0.1:3001";
const output=process.env.HYDRIA_FLOW_UI_SCREENSHOT||"/tmp/hydria-flow-interactions.png";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
try {
  await page.goto(base+"/workspace/flows",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#workspace-panel-root")?.dataset.hasWorkspace==="true" ||
    !!document.querySelector(".workspace-launcher-grid-single .workspace-launcher-card"));
  if(await page.locator("#workspace-panel-root").getAttribute("data-has-workspace")!=="true"){
    const created=await page.evaluate(()=>{
      const btn=document.querySelector(".workspace-launcher-grid-single .workspace-launcher-card");
      if(!btn)return false;btn.click();return true;
    });
    assert.equal(created,true);
  }
  const manager=page.locator(".hydria-flow-manager");
  await manager.waitFor({state:"visible",timeout:20000});
  const palette=manager.locator(".hydria-flow-palette");
  const search=palette.locator(".hydria-flow-search");
  const graph=manager.locator(".hydria-flow-scroll");
  await search.fill("filter");
  const source=palette.locator('[data-node-type="transform.filter"]').first();
  await source.waitFor({state:"visible"});
  const count=await manager.locator(".hydria-flow-node").count();
  const size=await graph.boundingBox();
  assert.ok(size.width>300 && size.height>100);
  // Native HTML5 drag & drop must hit the same event path as a human user.
  const targetX=Math.min(340,Math.round(size.width*.6));
  await source.dragTo(graph,{targetPosition:{x:targetX,y:160}});
  assert.equal(await manager.locator(".hydria-flow-node").count(),count+1,"Drag should add a real node");
  const nodes=manager.locator(".hydria-flow-node");
  const added=nodes.last();
  const before=await added.evaluate(node=>({x:parseInt(node.style.left),y:parseInt(node.style.top),type:node.dataset.nodeId}));
  assert.ok(before.x>=0&&before.y>=0,"Dragged node has valid graph coordinates");
  assert.equal(await search.inputValue(),"filter","Search stays after adding graph node");
  await added.focus();
  await page.keyboard.press("ArrowRight");
  const moved=manager.locator(".hydria-flow-node").last();
  const next=await moved.evaluate(node=>parseInt(node.style.left));
  assert.equal(next,before.x+10,"Arrow key must move node precisely 10 canvas pixels");
  await moved.focus();
  await page.keyboard.press("Shift+ArrowDown");
  const afterY=await manager.locator(".hydria-flow-node").last().evaluate(node=>parseInt(node.style.top));
  assert.equal(afterY,before.y+20);
  await manager.getByRole("button",{name:"Undo",exact:true}).click();
  assert.equal(await manager.locator(".hydria-flow-node").last().evaluate(node=>parseInt(node.style.top)),before.y);
  await manager.getByRole("button",{name:"Fit",exact:true}).click();
  assert.ok(await manager.locator(".hydria-flow-node").count()===count+1,"Fit must preserve graph");
  await fs.mkdir("/tmp",{recursive:true});
  await page.screenshot({path:output,fullPage:false});
  console.log("Hydria Flow UI: real drag/drop, keyboard arrow move, undo, persistent search, viewport fit passed.");
} finally {
  await browser.close();
}
