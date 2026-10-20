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

  await page.goto(base+"/workspace/drive",{waitUntil:"domcontentloaded"});
  await page.locator(".hydria-drive-image-row").filter({hasText:"artcraft-ci-photo.png"}).waitFor({timeout:16000});
  await page.getByRole("combobox",{name:"Filtrer les types"}).selectOption("image");
  const imageRows=page.locator(".hydria-drive-image-row");
  assert.ok(await imageRows.count()>0);
  await page.locator(".hydria-drive-image-row").filter({hasText:"artcraft-ci-photo.png"})
    .getByRole("link",{name:"Photo Studio"}).click();
  await page.waitForURL(/workspace\/photo/);

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
  assert.equal(await page.getByLabel("Importer une image PhotoCraft dans Drive").count(),0);
  await page.getByText("ne raccorde pas encore les dialogues").waitFor();
  assert.deepEqual(errors,[]);
  console.log("Photo/Design browser gate: routes, missing runtimes, image Drive roundtrip, self-hosted iframe mounts.");
} finally {
  await browser.close();
  if (created) for (const dir of paths) await rm(dir,{recursive:true,force:true});
}
