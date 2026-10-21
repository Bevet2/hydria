import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs/promises";
const base=process.env.HYDRIA_VISUAL_BASE_URL||"http://127.0.0.1:3001";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
try{
  await page.goto(base+"/",{waitUntil:"domcontentloaded"});
  await page.evaluate(async()=>{
    const {renderWorkspaceCanvasPanel}=await import("/components/workspaceCanvasPanel.js");
    const host=document.createElement("div");
    host.id="canvas-keyboard-test";
    host.style.cssText="position:fixed;inset:0;z-index:99999;overflow:auto;background:#f8fafc;padding:12px;";
    document.body.append(host);
    const initial={
      title:"Keyboard canvas",
      elements:[{id:"note-test",type:"note",title:"Test note",body:"Important",x:110,y:145,width:250,height:160,zIndex:1}],
      links:[]
    };
    window.__whiteboardState=JSON.stringify(initial);
    renderWorkspaceCanvasPanel(host,{
      workObject:{title:"Keyboard canvas",metadata:{workspaceFamilyId:"canvas_board"}},
      content:window.__whiteboardState,
      onContentChange:(updated)=>{window.__whiteboardState=updated;}
    });
  });
  const host=page.locator("#canvas-keyboard-test");
  const node=host.locator('.workspace-canvas-item[data-id="note-test"]');
  await node.waitFor({state:"attached",timeout:10000});
  await node.focus();
  await page.keyboard.press("Enter");
  assert.equal(await host.locator('.workspace-canvas-item[data-id="note-test"]').evaluate(el=>el.classList.contains("selected")),true,
    "Enter selects a focusable whiteboard item");
  const original=await page.evaluate(()=>JSON.parse(window.__whiteboardState).elements.find(x=>x.id==="note-test"));
  await page.keyboard.press("ArrowRight");
  let current=await page.evaluate(()=>JSON.parse(window.__whiteboardState).elements.find(x=>x.id==="note-test"));
  assert.equal(current.x,original.x+10,"arrow key moves by 10 logical canvas pixels");
  await page.keyboard.press("Shift+ArrowDown");
  current=await page.evaluate(()=>JSON.parse(window.__whiteboardState).elements.find(x=>x.id==="note-test"));
  assert.equal(current.y,original.y+20,"shift arrow moves by 20 pixels");
  // Editable input fields must keep native cursor behavior, not reposition cards.
  await host.locator(".workspace-canvas-item [contenteditable='true']").first().focus();
  await page.keyboard.press("ArrowRight");
  current=await page.evaluate(()=>JSON.parse(window.__whiteboardState).elements.find(x=>x.id==="note-test"));
  assert.equal(current.x,original.x+10,"editing text must not nudge a block");
  // A touch/mouse gesture that is interrupted must not leave a resized block.
  // This regression also proves a completed gesture still persists correctly.
  const beforeResize=await page.evaluate(()=>JSON.parse(window.__whiteboardState).elements.find(el=>el.id==="note-test"));
  const resize=host.locator('.workspace-canvas-item[data-id="note-test"] .workspace-canvas-resize');
  await resize.scrollIntoViewIfNeeded();
  const bounds=await resize.boundingBox();
  assert.ok(bounds,"Whiteboard block has a resize handle");
  const start={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  await page.mouse.move(start.x+55,start.y+30,{steps:6});
  const during=await host.locator('.workspace-canvas-item[data-id="note-test"]').evaluate(el=>parseFloat(el.style.width));
  assert.ok(during>beforeResize.width,"Resize tracks pointer movement continuously");
  await resize.dispatchEvent("pointercancel",{bubbles:true,pointerId:1});
  await page.mouse.up();
  assert.equal(await host.locator('.workspace-canvas-item[data-id="note-test"]').evaluate(el=>Math.round(parseFloat(el.style.width))),beforeResize.width,
    "Interrupted resize must restore block width");
  let after=await page.evaluate(()=>JSON.parse(window.__whiteboardState).elements.find(el=>el.id==="note-test"));
  assert.equal(after.width,beforeResize.width,"Cancelled resize must not be persisted");
  const freshBounds=await resize.boundingBox();
  assert.ok(freshBounds);
  const x=freshBounds.x+freshBounds.width/2,y=freshBounds.y+freshBounds.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+40,y+25,{steps:5});
  await page.mouse.up();
  after=await page.evaluate(()=>JSON.parse(window.__whiteboardState).elements.find(el=>el.id==="note-test"));
  assert.ok(after.width>=beforeResize.width+35,"Completed resize persists the new block width");
  console.log("Canvas keyboard and interruptible resize persistence passed.");
  await page.screenshot({path:"/tmp/hydria-canvas-keyboard.png",fullPage:false});
}finally{await browser.close();}
