import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base=process.env.HYDRIA_VISUAL_BASE_URL || "http://127.0.0.1:3001";
const output=process.env.HYDRIA_UI_SCREENSHOT_DIR || "/tmp/hydria-product-ui";
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
page.on("pageerror",e=>errors.push(String(e).slice(0,400)));
try {
  const home=await page.goto(base+"/",{waitUntil:"domcontentloaded"});
  assert.equal(home.status(),200);
  await page.locator("#workspace-switcher .workspace-switcher-chip.active").first()
    .waitFor({state:"visible",timeout:20000});
  assert.equal(await page.locator("#workspace-switcher .workspace-switcher-chip").count()>=12,true);
  await page.waitForFunction(
    () => document.querySelectorAll("#workspace-switcher .os-nav-icon").length >= 12,
    {timeout:10000}
  );
  assert.equal(await page.locator(".os-nav-icon").count()>=12,true,`Navigation icons missing; browser errors: ${errors.join(", ")}`);
  assert.equal(await page.locator("#os-active-workspace").innerText(),"Accueil");
  const desktop=await page.evaluate(()=>{
    const nav=document.querySelector(".sidebar").getBoundingClientRect();
    const editor=document.querySelector("#workspace-panel-root").getBoundingClientRect();
    return {navX:nav.x,navWidth:nav.width,editorX:editor.x,bodyOverflow:document.documentElement.scrollWidth>innerWidth+2,
      style: getComputedStyle(document.querySelector(".workspace-launcher-card")).borderRadius};
  });
  assert.ok(desktop.navWidth>=225 && desktop.navWidth<=260,JSON.stringify(desktop));
  assert.ok(desktop.editorX>=230,JSON.stringify(desktop));
  assert.equal(desktop.bodyOverflow,false,"Desktop should not scroll horizontally");
  await page.screenshot({path:path.join(output,"01-overview-desktop.png"),fullPage:false});
  await page.locator("#os-collapse-sidebar").click();
  assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("os-sidebar-collapsed")),true);
  const collapsed=await page.locator(".sidebar").boundingBox();
  assert.ok(collapsed.width<=75,"sidebar collapse should free workspace space");
  await page.locator("#os-collapse-sidebar").click();
  await page.locator("#os-theme-toggle").click();
  assert.equal(await page.locator("body").getAttribute("data-os-theme"),"dark");
  await page.waitForTimeout(180); // CSS color transitions must be complete in the visual evidence.
  await page.screenshot({path:path.join(output,"02-overview-dark.png"),fullPage:false});
  await page.locator("#os-theme-toggle").click();
  assert.equal(await page.locator("body").getAttribute("data-os-theme"),"light");

  // Real functional smoke: open Docs, then create a real editable work object.
  await page.locator("#workspace-switcher .workspace-switcher-chip").filter({hasText:"Docs"}).click();
  await page.locator(".workspace-launcher-grid-single .workspace-launcher-card").first()
    .waitFor({state:"visible",timeout:15000});
  await page.screenshot({path:path.join(output,"03-docs-empty.png"),fullPage:false});
  await page.locator(".workspace-launcher-grid-single .workspace-launcher-card").click();
  await page.locator('#workspace-panel-root[data-has-workspace="true"]')
    .waitFor({state:"visible",timeout:25000});
  assert.ok(await page.locator("#workspace-title").innerText());
  await page.screenshot({path:path.join(output,"04-docs-editor.png"),fullPage:false});
  // Real focus mode: hide both navigators, preserve title and editor, then restore.
  const titleBefore=await page.locator("#workspace-title").innerText();
  await page.locator("#os-focus-toggle").waitFor({state:"visible"});
  await page.locator("#os-focus-toggle").click();
  assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("os-focus-mode")),true);
  assert.equal(await page.locator("#os-focus-toggle").getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator(".sidebar").isVisible(),false);
  assert.equal(await page.locator('#workspace-panel-root[data-has-workspace="true"] .workspace-sidebar').isVisible(),false);
  assert.equal(await page.locator("#workspace-title").innerText(),titleBefore);
  await page.screenshot({path:path.join(output,"07-docs-focus-mode.png"),fullPage:false});
  await page.locator("#os-focus-toggle").click();
  assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("os-focus-mode")),false);
  assert.equal(await page.locator(".sidebar").isVisible(),true);
  assert.equal(await page.locator('#workspace-panel-root[data-has-workspace="true"] .workspace-sidebar').isVisible(),true);
  assert.equal(await page.locator("#workspace-title").innerText(),titleBefore);

  await page.setViewportSize({width:390,height:844});
  await page.locator("#os-mobile-menu").waitFor({state:"visible"});
  await page.waitForTimeout(260); // Wait for CSS drawer closing transition.
  assert.equal(await page.locator(".sidebar").evaluate(el=>el.getBoundingClientRect().right<=0),true);
  await page.locator("#os-mobile-files").waitFor({state:"visible"});
  assert.equal(await page.locator('#workspace-panel-root[data-has-workspace="true"] .workspace-sidebar').isVisible(),false);
  await page.locator("#os-mobile-files").click();
  assert.equal(await page.locator('#workspace-panel-root[data-has-workspace="true"] .workspace-sidebar').isVisible(),true);
  await page.locator("#os-mobile-files").click();
  assert.equal(await page.locator('#workspace-panel-root[data-has-workspace="true"] .workspace-sidebar').isVisible(),false);
  await page.locator("#os-mobile-menu").click();
  assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("os-sidebar-open")),true);
  await page.waitForTimeout(260);
  await page.screenshot({path:path.join(output,"05-mobile-drawer.png"),fullPage:false});
  await page.locator("#os-sidebar-scrim").click({position:{x:350,y:400}});
  assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("os-sidebar-open")),false);
  await page.waitForTimeout(260);
  await page.screenshot({path:path.join(output,"06-mobile-workspace.png"),fullPage:false});
  const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
  assert.equal(mobileOverflow,false,"Mobile app shell must not cause horizontal overflow");
  assert.deepEqual(errors,[],"No browser JS exceptions should be emitted");
  console.log("Hydria product UI desktop, document focus mode, dark theme, collapsing sidebar and mobile editor validated");
}finally {
  await browser.close();
}
