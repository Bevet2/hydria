// Browser acceptance: create/open all six workbench types in one real Hydria OS instance.
// Screenshots are generated from the actual app, not from mock HTML or drawings.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const base = process.env.HYDRIA_VISUAL_BASE_URL || "http://127.0.0.1:3001";
const output = process.env.HYDRIA_WORKBENCH_SCREENSHOTS || "/tmp/hydria-workbench-review";
await fs.mkdir(output, { recursive: true });
const browser=await chromium.launch({ headless:true });
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];
page.on("pageerror", err=>errors.push(String(err).slice(0,300)));
const screens=[
  {slug:"docs",className:".workspace-docs-menubar"},
  {slug:"sheets",className:".workspace-sheet-app"},
  {slug:"slides",className:".workspace-powerpoint-app"},
  {slug:"dashboard",className:".workspace-dashboard-powerbi"},
  {slug:"flows",className:".hydria-flow-manager"},
  {slug:"whiteboard",className:".workspace-canvas-surface"}
];
try {
  for(let i=0;i<screens.length;i++){
    const item=screens[i];
    const response=await page.goto(base+"/workspace/"+item.slug,{waitUntil:"domcontentloaded",timeout:25000});
    assert.equal(response.status(),200,item.slug+" route");
    // Opening an existing object is valid; otherwise create a real one via native CTA.
    await page.waitForFunction(
      ()=>document.querySelector("#workspace-panel-root")?.dataset.hasWorkspace==="true" ||
         !!document.querySelector(".workspace-launcher-grid-single .workspace-launcher-card"),
      null,{timeout:16000}
    );
    if(await page.locator("#workspace-panel-root").getAttribute("data-has-workspace")!=="true"){
      await page.locator(".workspace-launcher-grid-single .workspace-launcher-card").first().click();
      await page.locator('#workspace-panel-root[data-has-workspace="true"]').waitFor({state:"visible",timeout:22000});
    }
    const editor=page.locator(item.className).first();
    await editor.waitFor({state:"attached",timeout:22000});
    // Editors may be scrolled below the fold; render without affecting data.
    const focus=page.locator("#os-editor-focus");
    await focus.waitFor({state:"visible"});
    await focus.click();
    assert.equal(await focus.getAttribute("aria-pressed"),"true",item.slug+" focus mode");
    assert.equal(await page.locator("body").evaluate(e=>e.classList.contains("os-editor-focus")),true);
    await page.waitForTimeout(90);
    await page.screenshot({path:path.join(output,(i+1)+"-"+item.slug+".png"),fullPage:false});
    await page.keyboard.press("Escape");
    assert.equal(await focus.getAttribute("aria-pressed"),"false",item.slug+" focus Escape");

    if(item.slug==="flows"){
      const root=page.locator(".hydria-flow-manager");
      const inspector=page.locator(".hydria-flow-inspector");
      const palette=page.locator(".hydria-flow-palette");
      const results=page.locator(".hydria-flow-console");
      // Same real graph must remain when panels are collapsed.
      const originalStages=await root.locator(".hydria-flow-node").count();
      for(const [label,panel] of [["Properties",inspector],["Nodes",palette],["Results",results]]){
        const toggle=root.getByRole("button",{name:label,exact:true});
        assert.equal(await toggle.getAttribute("aria-pressed"),"true",label+" visible by default at 1440px");
        await toggle.click();
        assert.equal(await panel.evaluate(el=>el.hidden),true,label+" hidden");
        assert.equal(await toggle.getAttribute("aria-pressed"),"false");
        await toggle.click();
        assert.equal(await panel.evaluate(el=>el.hidden),false,label+" restored");
      }
      assert.equal(await root.locator(".hydria-flow-node").count(),originalStages);
      const query=palette.locator(".hydria-flow-search");
      await query.fill("filter");
      assert.ok(await palette.locator(".hydria-flow-catalog-item").count()>0);
      assert.ok((await palette.locator(".hydria-flow-catalog-item").allTextContents()).every(t=>t.toLowerCase().includes("filter")));
      await palette.locator(".hydria-flow-catalog-item").first().click();
      assert.equal(await palette.locator(".hydria-flow-search").inputValue(),"filter","search retained after graph mutation");
    }
  }
  // Scoped visual pages sometimes run transient background data API calls.
  // Record exceptions but do not reject known optional connector errors.
  assert.deepEqual(errors,[], "No browser JS crashes should occur");
  console.log("All 6 Hydria OS editors opened; focus navigation, Flow Manager inspector, search and graph persistence passed.");
}finally {
  await browser.close();
}
