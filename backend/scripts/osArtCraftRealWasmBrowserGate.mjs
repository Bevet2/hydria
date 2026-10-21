import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const sourceUrl = "https://raw.githubusercontent.com/storytold/figcraft/v0.8.0/examples/ridgeline-studio-dashboard.figcraft";
const sourceGitBlobSha1 = "c09f869d786855924b351102196c013554ed44fe";
// Generate a standards-compliant PNG instead of copying a fragile base64 test
// literal. CRCs are calculated for every chunk and decoded by real PhotoCraft.
function crc32(bytes) {
  let value=0xffffffff;
  for(const byte of bytes) {
    value ^= byte;
    for(let bit=0;bit<8;bit++)
      value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function pngChunk(type,data) {
  const chunk=Buffer.alloc(data.length+12);
  chunk.writeUInt32BE(data.length,0);
  chunk.write(type,4,4,"ascii");
  data.copy(chunk,8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4,8+data.length)),8+data.length);
  return chunk;
}
function createValidPng(width=64,height=64) {
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);
  ihdr.writeUInt32BE(height,4);
  ihdr[8]=8;ihdr[9]=2; // RGB, 8 bits per channel
  const scan=Buffer.alloc(height*(1+width*3));
  for(let y=0;y<height;y++)
    for(let x=0;x<width;x++) {
      const offset=y*(1+width*3)+1+x*3;
      scan[offset]=(x*3)&255;
      scan[offset+1]=(y*3)&255;
      scan[offset+2]=180;
    }
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk("IHDR",ihdr),
    pngChunk("IDAT",deflateSync(scan)),
    pngChunk("IEND",Buffer.alloc(0))
  ]);
}
const image=createValidPng();
const browser = await chromium.launch({
  headless:true,
  args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-gpu-sandbox"]
});
const context = await browser.newContext({viewport:{width:1440,height:980},acceptDownloads:true});
const page = await context.newPage();
const consoleProblems=[];
page.on("pageerror",error=>consoleProblems.push(error.message));
page.on("console",msg => { if (msg.type()==="error" || /photocraft|figcraft|drop|save/i.test(msg.text())) console.log("WASM console ["+msg.type()+"]: "+msg.text().slice(0,400)); });
page.on("dialog",async dialog=>{ console.log("WASM browser dialog: "+dialog.message()); await dialog.dismiss().catch(()=>{}); });
await mkdir("artifacts",{recursive:true});
function nativeId(url) { return url.split("/").at(-2); }
async function httpUpload(url, bytes, filename, revision=null) {
  const form = new FormData();
  form.append("file",new Blob([bytes]),filename);
  if (revision!==null) form.append("expectedRevision",String(revision));
  const response=await fetch(base+url,{method:"POST",body:form});
  if (response.status!==201) throw Error("Drive upload failed: "+response.status+" "+await response.text());
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
  const projectsBefore=(await fetch(base+"/api/drive/photo-projects").then(r=>r.json())).items.length;
  let stored=await httpUpload("/api/drive/image-assets",image,"real-open.png");
  let {iframe,canvas}=await waitRealEngine("photo");
  const photoRow=page.locator(".hydria-artcraft-image-item").filter({hasText:"real-open.png"});
  await photoRow.waitFor({timeout:30000});
  await photoRow.getByRole("button",{name:"Ouvrir directement"}).click();
  await page.getByText(/Fichier déposé dans l'éditeur/).waitFor({timeout:30000});
  const startCanvas = await canvas.screenshot();
  // A native open can be clean/unchanged; make an intentional brush stroke
  // before exercising the native Save command.
  const bounds=await canvas.boundingBox();
  const x=bounds.x+bounds.width*0.54,y=bounds.y+bounds.height*0.57;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+28,y+12,{steps:6});
  await page.mouse.up();
  await page.waitForTimeout(750);
  const editedCanvas=await canvas.screenshot();
  console.log("Photo actual canvas changed after direct image open/brush gesture:",
    !startCanvas.equals(editedCanvas));
  await canvas.click({position:{x:120,y:120}});
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(2500);
  let photoImages=(await fetch(base+"/api/drive/image-assets").then(r=>r.json())).items;
  const versioned=photoImages.find(x=>x.id===stored.id);
  const nativeCreated=(await fetch(base+"/api/drive/photo-projects").then(r=>r.json())).items;
  console.log("Photo after native Ctrl+S:",JSON.stringify({imageRevision:versioned?.revision, nativeProjects:nativeCreated.length, bridgeStatus:await page.locator(".hydria-artcraft-bridge-status").textContent(), problems:consoleProblems}));
  // PhotoCraft can either re-save an imported image as raster or save it as
  // an editable native .pcraft. Reject a no-op where neither was persisted.
  assert.ok(versioned.revision>=2 || nativeCreated.length>projectsBefore,
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
