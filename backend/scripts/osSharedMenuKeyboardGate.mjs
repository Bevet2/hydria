import assert from "node:assert/strict";
import { chromium } from "playwright";

// Real DOM acceptance for the shared nested menu used by native workbenches.
const base=process.env.HYDRIA_VISUAL_BASE_URL||"http://127.0.0.1:3001";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1024,height:768}});
try {
  await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:22000});
  // The integration shell initializes asynchronously. Inject the fixture only
  // after boot completes, otherwise startup may recreate or detach its host.
  await page.waitForFunction(() => document.documentElement.dataset.hydriaBoot === "ready",
    {timeout:20000});
  await page.evaluate(async()=>{
    const {createWorkspaceContextMenu}=await import("/components/workspaceMenuUi.js");
    const opener=document.createElement("button");
    opener.id="shared-menu-keyboard-opener";
    opener.textContent="Editor context actions";
    opener.type="button";
    const root=document.createElement("div");
    root.id="shared-menu-keyboard-fixture";
    root.className="workspace-context-menu";
    root.style.position="fixed";
    root.style.zIndex="99999";
    root.hidden=true;
    document.body.append(opener,root);
    window.__sharedMenuSelected="";
    // The fixture opener is appended after a potentially tall app shell.
    // Focus without scrolling: an incidental viewport scroll would correctly
    // dismiss the context menu before the keyboard assertions can start.
    opener.focus({preventScroll:true});
    const menu=createWorkspaceContextMenu({root});
    menu.open([
      {label:"Rename",onSelect:()=>{window.__sharedMenuSelected="rename";}},
      {separator:true},
      {label:"More",items:[
        {label:"Duplicate",onSelect:()=>{window.__sharedMenuSelected="duplicate";}},
        {label:"Delete",disabled:true,onSelect:()=>{window.__sharedMenuSelected="delete";}}
      ]},
      {label:"Export",onSelect:()=>{window.__sharedMenuSelected="export";}}
    ],{clientX:70,clientY:100});
    window.__sharedMenu=menu;
  });
  const root=page.locator("#shared-menu-keyboard-fixture");
  await root.waitFor({state:"visible",timeout:15000});
  assert.ok(await root.locator("button").count()>=3,
    "The shared menu fixture must render its actions before keyboard testing");
  const rename=root.getByRole("button",{name:"Rename"});
  const more=root.getByRole("button",{name:"More"});
  const exportButton=root.getByRole("button",{name:"Export"});
  await rename.focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await more.evaluate(el=>document.activeElement===el),true,
    "Down arrow must focus the next enabled menu action");
  await page.keyboard.press("ArrowRight");
  const duplicateState=await page.evaluate(()=>{
    const menu=document.querySelector("#shared-menu-keyboard-fixture");
    const item=[...menu.querySelectorAll("button")].find(x=>x.textContent.trim()==="Duplicate");
    const parent=item?.parentElement?.parentElement;
    return {found:!!item,focused:item===document.activeElement,
      active:document.activeElement?.textContent?.trim(),
      subClass:parent?.className,
      menuVisible:item ? getComputedStyle(item).visibility : null,
      display:item ? getComputedStyle(item).display : null,
      subDisplay:parent ? getComputedStyle(parent).display : null,
      rects:item?.getClientRects()?.length,html:parent?.outerHTML?.slice(0,1600)};
  });
  console.log("NESTED_MENU_DIAGNOSTIC",JSON.stringify(duplicateState));
  assert.equal(duplicateState.focused,true,
    "Right arrow must open nested submenu and focus its first enabled item");
  const duplicate=root.getByRole("button",{name:"Duplicate"});
  assert.equal(await more.getAttribute("aria-expanded"),"true");
  await page.keyboard.press("ArrowDown");
  assert.equal(await duplicate.evaluate(el=>document.activeElement===el),true,
    "Navigation must skip disabled menu actions");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await more.evaluate(el=>document.activeElement===el),true,
    "Left arrow must return focus to the submenu parent");
  assert.equal(await more.getAttribute("aria-expanded"),"false");
  await page.keyboard.press("End");
  assert.equal(await exportButton.evaluate(el=>document.activeElement===el),true);
  await page.keyboard.press("Home");
  assert.equal(await rename.evaluate(el=>document.activeElement===el),true);
  await page.keyboard.press("Escape");
  assert.equal(await root.evaluate(el=>el.hidden),true,"Escape must dismiss nested menu");
  assert.equal(await page.locator("#shared-menu-keyboard-opener").evaluate(el=>document.activeElement===el),true,
    "Escape must restore focus to the preceding editor control");
  assert.equal(await page.evaluate(()=>window.__sharedMenuSelected),"",
    "Menu keyboard navigation must not accidentally execute a command");
  console.log("Shared nested menu: keyboard arrows, disabled options, submenu, Escape and focus restoration passed.");
}finally {
  await browser.close();
}
