import assert from "node:assert/strict";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const paths = ["photocraft", "figcraft"].map(name => path.resolve("frontend/vendor",name));
for(const dest of paths) {
  try { await stat(dest); throw Error("Refusing to replace installed ArtCraft runtime: "+dest); }
  catch (error) { if(error.code !== "ENOENT") throw error; }
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGN0rT7xn4GBgYGJAQoAJiUCi6vmjGkAAAAASUVORK5CYII=",
  "base64"
);
const browser = await chromium.launch({ headless:true, args:["--no-sandbox"] });
const page=await browser.newPage({viewport:{width:1400,height:1000}});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
let created=false;
try {
  const base="http://127.0.0.1:3001";
  await page.goto(base+"/workspace/photo",{waitUntil:"domcontentloaded"});
  await page.locator(".hydria-artcraft[data-artcraft-editor='photo']").waitFor({timeout:30000});
  await page.getByText("Installation nécessaire").first().waitFor({timeout:12000});
  assert.equal(await page.locator(".hydria-artcraft-frame").count(),0);
  const upload=page.getByLabel("Importer une image PhotoCraft dans Drive");
  await upload.setInputFiles({name:"artcraft-ci-photo.png",mimeType:"image/png",buffer:png});
  const thumbnailRow=page.locator(".hydria-artcraft-image-item").filter({hasText:"artcraft-ci-photo.png"});
  await thumbnailRow.waitFor({timeout:16000});
  const link=thumbnailRow.getByRole("link",{name:"Télécharger"});
  assert.match(await link.getAttribute("href"),/\/api\/drive\/image-assets\/.*\/download/);

  // Upload an edited image as revision 2 without destroying revision 1.
  const revisedPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkKD/DwMDAxMDAwMDAAAAOggFH5ocWlQAAAABJRU5ErkJggg==",
    "base64"
  );
  await thumbnailRow.locator(".hydria-artcraft-version-input").setInputFiles({
    name:"artcraft-ci-photo.png", mimeType:"image/png", buffer:revisedPng
  });
  const updatedRow = page.locator(".hydria-artcraft-image-item").filter({hasText:"artcraft-ci-photo.png"});
  await updatedRow.getByText("Version 2").waitFor({timeout:16000});
  await updatedRow.getByRole("button",{name:"Historique"}).click();
  const versionRows = updatedRow.locator(".hydria-artcraft-history-row");
  await versionRows.first().waitFor({timeout:16000});
  assert.equal(await versionRows.count(),2);
  const oldLink = versionRows.filter({hasText:"Version 1"}).getByRole("link",{name:"Télécharger cette version"});
  assert.ok((await oldLink.getAttribute("href")).endsWith("/versions/1/download"));


  await page.goto(base+"/workspace/drive",{waitUntil:"domcontentloaded"});
  const driveRow = page.locator(".hydria-drive-image-row").filter({hasText:"artcraft-ci-photo.png"});
  await driveRow.waitFor({timeout:16000});
  await page.getByRole("combobox",{name:"Filtrer les types"}).selectOption("image");
  assert.ok(await page.locator(".hydria-drive-image-row").count()>0);
  await driveRow.getByText("Version 2").waitFor({timeout:16000});
  await driveRow.getByRole("link",{name:"Photo Studio"}).click();
  await page.waitForURL(url => url.pathname === "/workspace/photo" && url.searchParams.has("imageId"));
  const focused = page.locator(".hydria-artcraft-target-image").filter({hasText:"artcraft-ci-photo.png"});
  await focused.waitFor({timeout:16000});
  await focused.locator(".hydria-artcraft-history-row").first().waitFor({timeout:16000});

  // Standalone fixtures verify Hydria mounting without substituting a mock for
  // the real production WASM app. Real binaries are installed separately.
  for (const dir of paths) await mkdir(dir,{recursive:true});
  created=true;
  await writeFile(path.join(paths[0],"index.html"),
    "<!doctype html><html><body><strong>PhotoCraft WASM fixture</strong></body></html>");
  await writeFile(path.join(paths[1],"index.html"),
    "<!doctype html><html><body><strong>FigCraft WASM fixture</strong></body></html>");

  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator(".hydria-artcraft-status").filter({hasText:"PhotoCraft disponible"}).waitFor({timeout:16000});
  await page.frameLocator(".hydria-artcraft-frame").getByText("PhotoCraft WASM fixture").waitFor({timeout:16000});
  await page.getByRole("button",{name:"Redémarrer l'éditeur"}).click();
  await page.frameLocator(".hydria-artcraft-frame").getByText("PhotoCraft WASM fixture").waitFor({timeout:16000});

  await page.goto(base+"/workspace/fig",{waitUntil:"domcontentloaded"});
  await page.locator(".hydria-artcraft-status").filter({hasText:"FigCraft disponible"}).waitFor({timeout:16000});
  await page.frameLocator(".hydria-artcraft-frame").getByText("FigCraft WASM fixture").waitFor({timeout:16000});
  const figSandbox = await page.locator(".hydria-artcraft-frame").getAttribute("sandbox");
  assert.ok(figSandbox.split(/\s+/).includes("allow-downloads"),
    "FigCraft native File > Save must be permitted in the iframe");
  assert.equal(await page.getByLabel("Importer une image PhotoCraft dans Drive").count(),0);
  await page.getByText("FigCraft Web v0.8 sait ouvrir et sauvegarder").waitFor();
  await page.getByLabel("Importer un projet FigCraft dans Drive").waitFor();
  assert.deepEqual(errors,[]);
  console.log("Photo/Design browser gate: routes, versioned image upload and history, deep links, missing runtimes, iframe mounts.");
} finally {
  await browser.close();
  if (created) for (const dir of paths) await rm(dir,{recursive:true,force:true});
}
