import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { chromium } from "playwright";

const base = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
function nativeDesign(label) {
  const zip = new AdmZip();
  zip.addFile("document.json", Buffer.from(JSON.stringify({
    format:"figcraft",version:1,pages:[],name:label
  })));
  return zip.toBuffer();
}
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
const page = await browser.newPage({viewport:{width:1360,height:900}});
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
const name="studio-e2e-"+Date.now()+".figcraft";
try {
  await page.goto(base+"/workspace/fig",{waitUntil:"domcontentloaded"});
  const library=page.getByRole("region",{name:"Projets FigCraft conservés dans Drive"});
  await library.waitFor({timeout:30000});
  assert.ok(await page.getByText("Fichier > Ouvrir",{exact:false}).count()>0);
  await page.getByLabel("Importer un projet FigCraft dans Drive")
    .setInputFiles({name,mimeType:"application/octet-stream",buffer:nativeDesign("v1")});
  const row=page.locator(".hydria-figcraft-project-item").filter({hasText:name});
  await row.waitFor({timeout:16000});
  await row.getByText("Version 1").waitFor({timeout:16000});
  const url1=await row.getByRole("link",{name:"Télécharger pour ouvrir"}).getAttribute("href");
  assert.match(url1,/\/api\/drive\/design-assets\/[a-f0-9-]+\/download/);
  const original=(await page.request.get(base+url1));
  assert.equal(original.status(),200);
  assert.deepEqual(Buffer.from(await original.body()),nativeDesign("v1"));

  await row.locator(".hydria-figcraft-version-upload")
    .setInputFiles({name,mimeType:"application/octet-stream",buffer:nativeDesign("v2")});
  const updated=page.locator(".hydria-figcraft-project-item").filter({hasText:name});
  await updated.getByText("Version 2").waitFor({timeout:16000});
  await updated.getByRole("button",{name:"Historique"}).click();
  const history=updated.locator(".hydria-artcraft-history-row");
  await history.first().waitFor({timeout:16000});
  assert.equal(await history.count(),2);
  const old=history.filter({hasText:"Version 1"}).getByRole("link",{name:"Télécharger cette version"});
  const response=await page.request.get(base+(await old.getAttribute("href")));
  assert.equal(response.status(),200);
  assert.deepEqual(Buffer.from(await response.body()),nativeDesign("v1"));
  assert.deepEqual(Buffer.from(await (await page.request.get(base+url1)).body()),nativeDesign("v2"));

  await page.goto(base+"/workspace/drive",{waitUntil:"domcontentloaded"});
  const drive=page.locator(".hydria-drive-design-row").filter({hasText:name});
  await drive.waitFor({timeout:16000});
  await page.getByRole("combobox",{name:"Filtrer les types"}).selectOption("design");
  await drive.getByText("Version 2").waitFor({timeout:16000});
  await drive.getByRole("link",{name:"Design Studio"}).click();
  await page.waitForURL(url=>url.pathname==="/workspace/fig" && url.searchParams.has("designId"));
  const target=page.locator(".hydria-figcraft-project-item.hydria-artcraft-target-image").filter({hasText:name});
  await target.waitFor({timeout:16000});
  await target.locator(".hydria-artcraft-history-row").first().waitFor({timeout:16000});
  assert.deepEqual(errors,[]);
  console.log("FigCraft Drive browser acceptance passed: native project, version 2, old download, Drive deep link.");
} finally { await browser.close(); }
