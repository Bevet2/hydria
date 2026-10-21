import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const sourceUrl = "https://raw.githubusercontent.com/storytold/figcraft/v0.8.0/examples/ridgeline-studio-dashboard.figcraft";
const sourceGitBlobSha1 = "c09f869d786855924b351102196c013554ed44fe";
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGN0rT7xn4GBgYGJAQoAJiUCi6vmjGkAAAAASUVORK5CYII=", "base64");
const browser = await chromium.launch({
  headless:true,
  args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-gpu-sandbox"]
});
const context = await browser.newContext({viewport:{width:1440,height:980},acceptDownloads:true});
const page = await context.newPage();
const consoleProblems=[];
page.on("pageerror",error=>consoleProblems.push(error.message));
await mkdir("artifacts",{recursive:true});
function nativeId(url) { return url.split("/").at(-2); }
async function httpUpload(url, bytes, filename, revision=null) {
  const form = new FormData();
  form.append("file",new Blob([bytes]),filename);
  if (revision!==null) form.append("expectedRevision",String(revision));
  const response=await fetch(base+url,{method:"POST",body:form});
  assert.equal(response.status,revision===null?201:201,await response.text().catch(()=> ""));
  return response.json();
}
async function waitRealEngine(editor) {
  await page.goto(base+"/workspace/"+editor+"?webgl=1",{waitUntil:"domcontentloaded"});
  await page.locator('.hydria-artcraft-frame[data-drive-bridge-ready="true"]').waitFor({timeout:90000});
  const iframe=page.frameLocator(".hydria-artcraft-frame");
  const loading = editor==="photo" ? "#photocraft_loading" : "#figcraft_loading";
  await iframe.locator(loading).waitFor({state:"detached",timeout:150000});
  const canvas=iframe.locator(editor==="photo" ? "#photocraft_canvas" : "#figcraft_canvas");
  await canvas.waitFor({state:"visible",timeout:30000});
  assert.ok(await canvas.evaluate(el=>el.width>100 && el.height>100));
  await page.screenshot({path:"artifacts/hydria-real-"+editor+"-boot.png",fullPage:true});
  return {iframe,canvas};
}
try {
  // The PhotoCraft real WASM must receive an image from Drive without a local
  // download; its native File > Save should make a durable Drive revision.
  let stored=await httpUpload("/api/drive/image-assets",image,"real-open.png");
  let {iframe,canvas}=await waitRealEngine("photo");
  const photoRow=page.locator(".hydria-artcraft-image-item").filter({hasText:"real-open.png"});
  await photoRow.waitFor({timeout:30000});
  await photoRow.getByRole("button",{name:"Ouvrir directement"}).click();
  await page.getByText(/Fichier déposé dans l'éditeur/).waitFor({timeout:30000});
  await canvas.click({position:{x:120,y:120}});
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(2500);
  let photoImages=(await fetch(base+"/api/drive/image-assets").then(r=>r.json())).items;
  const versioned=photoImages.find(x=>x.id===stored.id);
  const nativeCreated=(await fetch(base+"/api/drive/photo-projects").then(r=>r.json())).items;
  // PhotoCraft can either re-save an imported image as raster or save it as
  // an editable native .pcraft. Reject a no-op where neither was persisted.
  assert.ok(versioned.revision>=2 ||
    nativeCreated.some(x=>x.created_at>=stored.created_at),
    "Real PhotoCraft Ctrl+S did not reach Drive");
  await page.screenshot({path:"artifacts/hydria-real-photo-after-save.png",fullPage:true});

  // Use an authentic official FigCraft project rather than a synthetic ZIP:
  // the document contains the complex canvas/asset structures real imports use.
  const source=await fetch(sourceUrl,{signal:AbortSignal.timeout(60000)});
  assert.equal(source.status,200);
  const figBytes=Buffer.from(await source.arrayBuffer());
  const gitHash=createHash("sha1").update(Buffer.concat([
    Buffer.from("blob "+figBytes.length+"\0"),figBytes
  ])).digest("hex");
  assert.equal(gitHash,sourceGitBlobSha1);
  assert.ok(figBytes.length>10000);
  new AdmZip(figBytes).getEntry("document.json").getData();
  stored=await httpUpload("/api/drive/design-assets",figBytes,"ridgeline-studio-dashboard.figcraft");
  ({iframe,canvas}=await waitRealEngine("fig"));
  const figRow=page.locator(".hydria-figcraft-project-item").filter({hasText:"ridgeline-studio-dashboard.figcraft"});
  await figRow.waitFor({timeout:30000});
  await figRow.getByRole("button",{name:"Ouvrir directement"}).click();
  await page.getByText(/Fichier déposé dans l'éditeur/).waitFor({timeout:30000});
  await canvas.click({position:{x:140,y:150}});
  await page.keyboard.press("Control+s");
  await page.getByText(/Document enregistré dans Drive · version 2/).waitFor({timeout:30000});
  const changed=Buffer.from(await fetch(base+"/api/drive/design-assets/"+stored.id+"/download").then(r=>r.arrayBuffer()));
  assert.ok(changed.length>10000,"WASM lost native document data while saving");
  assert.ok(new AdmZip(changed).getEntry("document.json"));
  await page.screenshot({path:"artifacts/hydria-real-fig-after-save.png",fullPage:true});
  assert.deepEqual(consoleProblems,[]);
  console.log("Real PhotoCraft/FigCraft WASM boot, authenticated Drive open, native save and document preservation passed");
} finally { await browser.close(); }
