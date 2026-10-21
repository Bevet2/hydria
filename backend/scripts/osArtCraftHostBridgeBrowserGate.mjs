import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const vendors = ["photo","fig"].map(editor => path.resolve("frontend/vendor", editor === "fig" ? "figcraft" : "photocraft"));
for (const directory of vendors) {
  try { await stat(directory); throw Error("Refusing to replace installed ArtCraft runtime: " + directory); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
const opts = {
  photo: { directory:vendors[0], ext:".pcraft", route:"photo-projects", selector:".hydria-photocraft-project-item",canvas:"photocraft_canvas" },
  fig: { directory:vendors[1], ext:".figcraft", route:"design-assets", selector:".hydria-figcraft-project-item",canvas:"figcraft_canvas" }
};
const nativeZipCache = new Map();
function nativeProject(editor, marker) {
  const key = editor + ":" + marker;
  if (nativeZipCache.has(key)) return nativeZipCache.get(key);
  const zip = new AdmZip();
  zip.addFile(editor === "photo" ? "manifest.json" : "document.json",
    Buffer.from(JSON.stringify(editor === "photo" ? {
      format_version:1, document:{ name:marker,layers:[] }
    } : { format:"figcraft",version:1,name:marker,pages:[] })));
  const bytes = zip.toBuffer();
  nativeZipCache.set(key,bytes);
  return bytes;
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGN0rT7xn4GBgYGJAQoAJiUCi6vmjGkAAAAASUVORK5CYII=", "base64");
function fixture(editor, oldBytes, newBytes) {
  const canvas = opts[editor].canvas, name = "bridge-" + editor + opts[editor].ext;
  const script = [
    'const filename=' + JSON.stringify(name) + ';',
    'const ext=' + JSON.stringify(opts[editor].ext) + ';',
    'const native1=Uint8Array.from(atob(' + JSON.stringify(oldBytes.toString("base64")) + '),c=>c.charCodeAt(0));',
    'const native2=Uint8Array.from(atob(' + JSON.stringify(newBytes.toString("base64")) + '),c=>c.charCodeAt(0));',
    'document.getElementById(' + JSON.stringify(canvas) + ').addEventListener("drop",e=>{document.getElementById("drop").textContent=e.dataTransfer?.files?.[0]?.name||"empty";});',
    'document.getElementById("pickerButton").onclick=()=>{const i=document.createElement("input");i.type="file";i.accept=ext;i.onchange=()=>document.getElementById("picker").textContent=i.files?.[0]?.name||"empty";document.body.append(i);i.click();};',
    'function emitNativeSave(){const b=new Blob([native2],{type:"application/octet-stream"});const href=URL.createObjectURL(b);const a=document.createElement("a");a.href=href;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),10000);}',
    'document.getElementById("saveButton").onclick=emitNativeSave;',
    'window.emitNativePng=()=>{const d=Uint8Array.from(atob(' + JSON.stringify(png.toString("base64")) + '),c=>c.charCodeAt(0));const h=URL.createObjectURL(new Blob([d],{type:"image/png"}));const a=document.createElement("a");a.href=h;a.download="bridge-export.png";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(h),10000);};'
  ].join("\n");
  return '<!doctype html><html><head><script src="/artcraft/hydria-bridge.js" data-hydria-editor="'+editor+'"></script></head>' +
    '<body><h1>Native file-I/O fixture '+editor+'</h1><canvas id="'+canvas+'"></canvas>' +
    '<output id="drop">no drop</output><output id="picker">no picker</output>' +
    '<button id="saveButton">Native File Save</button><button id="pickerButton">Native File Open</button>' +
    '<script>'+script+'</script></body></html>';
}
async function upload(request, editor, bytes, name) {
  const form = new FormData();
  form.append("file",new Blob([bytes],{type:"application/octet-stream"}),name);
  return request.post(base+"/api/drive/"+opts[editor].route,{multipart:form});
}
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
const context = await browser.newContext({acceptDownloads:true,viewport:{width:1360,height:960}});
const page = await context.newPage();
const errors = [];
page.on("pageerror",error=>errors.push(error.message));
let created = false;
try {
  for (const editor of ["photo","fig"]) {
    await mkdir(opts[editor].directory,{recursive:true});
    await writeFile(path.join(opts[editor].directory,"index.html"),
      fixture(editor,nativeProject(editor,"v1"),nativeProject(editor,"v2")));
  }
  created=true;
  for (const editor of ["photo","fig"]) {
    const cfg=opts[editor],filename="bridge-"+editor+cfg.ext;
    const original=nativeProject(editor,"v1"),modified=nativeProject(editor,"v2");
    const initial=await upload(context.request,editor,original,filename);
    assert.equal(initial.status(),201);
    const asset=await initial.json();
    await page.goto(base+"/workspace/"+editor,{waitUntil:"domcontentloaded"});
    await page.locator('.hydria-artcraft-frame[data-drive-bridge-ready="true"]').waitFor({timeout:20000});
    // Fullscreen must never detach a connected native editor and lose Drive's
    // optimistic revision binding. Keep the same Window instance alive.
    await page.locator(".hydria-artcraft-frame").evaluate(frame => {
      frame.contentWindow.__hydriaNativeFrameTest = "kept-alive";
    });
    await page.getByRole("button",{name:"Ouvrir en plein écran"}).click();
    // requestFullscreen() settles asynchronously. Wait for the browser to
    // enter it before calling exitFullscreen(); otherwise the fullscreen
    // viewport can cover Drive buttons and intercept subsequent clicks.
    await page.waitForFunction(() => Boolean(document.fullscreenElement) ||
      document.querySelector(".hydria-artcraft-bridge-status")?.dataset.status === "error",
      { timeout: 5000 }).catch(() => {});
    await page.evaluate(async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
    });
    await page.waitForFunction(() => !document.fullscreenElement);
    assert.equal(await page.locator(".hydria-artcraft-frame").evaluate(
      frame => frame.contentWindow.__hydriaNativeFrameTest), "kept-alive");

    const row=page.locator(cfg.selector).filter({hasText:filename});
    await row.waitFor({timeout:20000});
    await row.getByRole("button",{name:"Ouvrir directement"}).click();
    const iframe=page.frameLocator(".hydria-artcraft-frame");
    await iframe.locator("#drop").getByText(filename,{exact:true}).waitFor({timeout:20000});
    await iframe.getByRole("button",{name:"Native File Open"}).click();
    await iframe.locator("#picker").getByText(filename,{exact:true}).waitFor({timeout:10000});
    await iframe.getByRole("button",{name:"Native File Save"}).click();
    await page.getByText("Document enregistré dans Drive · version 2").waitFor({timeout:20000});
    assert.deepEqual(Buffer.from(await context.request.get(base+"/api/drive/"+cfg.route+"/"+asset.id+"/download").then(r=>r.body())),modified);
    assert.deepEqual(Buffer.from(await context.request.get(base+"/api/drive/"+cfg.route+"/"+asset.id+"/versions/1/download").then(r=>r.body())),original);

    const form = new FormData();
    form.append("file",new Blob([original]),filename);
    form.append("expectedRevision","2");
    assert.equal((await context.request.post(base+"/api/drive/"+cfg.route+"/"+asset.id+"/versions",{multipart:form})).status(),201);
    const [backup] = await Promise.all([
      page.waitForEvent("download",{timeout:25000}),
      iframe.getByRole("button",{name:"Native File Save"}).click()
    ]);
    assert.equal(backup.suggestedFilename(),filename);
    await page.getByText(/Copie de secours téléchargée|Drive a refusé la sauvegarde/).waitFor({timeout:20000});
    assert.equal((await context.request.get(base+"/api/drive/"+cfg.route+"/"+asset.id+"/versions").then(r=>r.json())).revision,3);
    console.log("ArtCraft "+editor+": native direct-open, picker, Drive version and 409 local fallback passed");
  }

  // A delayed save from an obsolete iframe must never rebind its Drive ID to
  // a brand-new editor instance after the user clicks Restart.
  const raceName="bridge-fig.figcraft";
  const raceOriginal=nativeProject("fig","race-v1");
  const raceResponse=await upload(context.request,"fig",raceOriginal,raceName);
  assert.equal(raceResponse.status(),201);
  const raceAsset=await raceResponse.json();
  await page.goto(base+"/workspace/fig",{waitUntil:"domcontentloaded"});
  await page.locator('.hydria-artcraft-frame[data-drive-bridge-ready="true"]').waitFor({timeout:20000});
  await page.locator(".hydria-figcraft-project-item[data-design-id='"+raceAsset.id+"']")
    .getByRole("button",{name:"Ouvrir directement"}).click();
  let releaseHeldSave;
  const heldSave=new Promise(resolve => { releaseHeldSave=resolve; });
  await page.route("**/api/drive/design-assets/"+raceAsset.id+"/versions",async route=>{
    await heldSave;
    await route.continue();
  },{times:1});
  await page.frameLocator(".hydria-artcraft-frame")
    .getByRole("button",{name:"Native File Save"}).click();
  await page.getByText("Sauvegarde dans Hydria Drive…").waitFor({timeout:10000});
  await page.getByRole("button",{name:"Redémarrer l'éditeur"}).click();
  await page.locator('.hydria-artcraft-frame[data-drive-bridge-ready="true"]').waitFor({timeout:16000});
  releaseHeldSave();
  await page.waitForFunction(async id=>{
    const response=await fetch("/api/drive/design-assets/"+id);
    return response.ok && (await response.json()).revision===2;
  },raceAsset.id,{timeout:16000});
  const designsBeforeRestartSave=(await context.request.get(base+"/api/drive/design-assets").then(r=>r.json())).items.length;
  await page.frameLocator(".hydria-artcraft-frame")
    .getByRole("button",{name:"Native File Save"}).click();
  await page.getByText("Document enregistré dans Drive · version 1").waitFor({timeout:16000});
  const designsAfterRestartSave=(await context.request.get(base+"/api/drive/design-assets").then(r=>r.json())).items;
  assert.equal(designsAfterRestartSave.length,designsBeforeRestartSave+1);
  assert.equal((await context.request.get(base+"/api/drive/design-assets/"+raceAsset.id).then(r=>r.json())).revision,2);
  console.log("Creative iframe race passed: stale async save cannot rebind a replaced editor instance.");

  await page.goto(base+"/workspace/photo",{waitUntil:"domcontentloaded"});
  await page.locator('.hydria-artcraft-frame[data-drive-bridge-ready="true"]').waitFor();
  const before=(await context.request.get(base+"/api/drive/image-assets").then(r=>r.json())).items.length;
  await page.locator(".hydria-artcraft-frame").evaluate(el=>el.contentWindow.emitNativePng());
  await page.getByText("Document enregistré dans Drive · version 1").waitFor({timeout:20000});
  const saved=(await context.request.get(base+"/api/drive/image-assets").then(r=>r.json())).items;
  assert.equal(saved.length,before+1);
  assert.equal(saved[0].filename,"bridge-export.png");
  assert.deepEqual(errors,[]);
  console.log("Creative bridge browser tests passed: native projects and flattened PhotoCraft image export.");
} finally {
  await browser.close();
  if (created) for (const directory of vendors) await rm(directory,{recursive:true,force:true});
}
