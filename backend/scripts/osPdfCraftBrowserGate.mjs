import assert from "node:assert/strict";
import { mkdir, writeFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const dist = path.resolve("frontend/vendor/pdfcraft");
try { await stat(dist); throw Error("Refusing to replace an installed PdfCraft runtime in browser tests"); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1360, height: 960 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let created = false;
try {
  await page.goto(base + "/workspace/pdf", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.hydriaBoot === "ready");
  await page.getByText("Installation nécessaire").waitFor({ timeout: 30000 });
  console.log("PDF browser: missing-runtime fallback");
  assert.equal(await page.locator(".hydria-pdf-frame").count(), 0);

  // Fixture of the verified official v0.9.0 protocol; this is not a WASM test.
  await mkdir(dist, { recursive: true }); created = true;
  await writeFile(path.join(dist, "index.html"), `<!doctype html><html><body>
    <p id="state">PdfCraft fixture</p><button id="save">Enregistrer</button>
    <button id="save-as">Enregistrer sous</button>
    <script>
      let bytes = null, name = 'document.pdf';
      addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== parent || event.data.type !== 'pdfcraft:open') return;
        bytes = new Uint8Array(event.data.bytes); name = event.data.name;
        document.querySelector('#state').textContent = 'PDF payload received: ' + name;
      });
      function save(saveAs) {
        const modified = new TextEncoder().encode(new TextDecoder().decode(bytes).replace('%%EOF', '% fixture edit\\n%%EOF'));
        parent.postMessage({type:'pdfcraft:save',name,saveAs,bytes:modified.buffer},location.origin,[modified.buffer]);
      }
      document.querySelector('#save').onclick = () => save(false);
      document.querySelector('#save-as').onclick = () => save(true);
      if (new URLSearchParams(location.search).get('host') === 'parent')
        parent.postMessage({type:'pdfcraft:ready',version:'0.9.0'},location.origin);
    </script></body></html>`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.hydriaBoot === "ready");
  await page.locator('.hydria-pdf-frame[data-bridge-ready="true"]').waitFor({ timeout: 30000 });
  console.log("PDF browser: official-protocol fixture ready");
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
  assert.equal(await page.getByLabel("Importer un PDF dans Hydria Drive").isVisible(), true);
  await page.getByLabel("Importer un PDF dans Hydria Drive").setInputFiles({
    name: "edition-pdfcraft.pdf", mimeType: "application/pdf", buffer: pdf
  });
  let row = page.locator(".hydria-pdf-saved-item").filter({ hasText: "edition-pdfcraft.pdf" });
  await row.waitFor();
  const assetId = (await row.getByRole("link", { name: "Télécharger", exact: true }).getAttribute("href")).split("/").at(-2);
  await row.getByRole("button", { name: "Ouvrir", exact: true }).click();
  let frame = page.frameLocator(".hydria-pdf-frame");
  await frame.getByText("PDF payload received: edition-pdfcraft.pdf", { exact: true }).waitFor();
  console.log("PDF browser: Drive PDF received by iframe");

  // Same-origin is not sufficient: reject parent, obsolete frame and wrong origin.
  await page.evaluate(() => {
    const frame = document.querySelector('.hydria-pdf-frame');
    window.oldPdfFrame = frame.contentWindow;
    const bytes = new TextEncoder().encode('%PDF-1.4\n%%EOF\n').buffer;
    window.postMessage({type:'pdfcraft:save',name:'forged.pdf',saveAs:false,bytes},location.origin);
    window.dispatchEvent(new MessageEvent('message',{origin:'https://untrusted.example',source:frame.contentWindow,
      data:{type:'pdfcraft:save',name:'wrong-origin.pdf',saveAs:false,bytes}}));
  });
  assert.equal(await page.locator(".hydria-pdf-prepared-item").count(), 0);
  await frame.getByRole("button", { name: "Enregistrer", exact: true }).click();
  const draft = page.locator(".hydria-pdf-prepared-item");
  await draft.waitFor();
  assert.equal(await draft.count(), 1);
  const versionButton = draft.getByRole("button", { name: /Ajouter à.*version 2/ });

  // A network/server error leaves the exported bytes available for retry/download.
  await page.route("**/api/drive/pdf-assets/*/versions", route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "Stockage temporairement indisponible" })
  }), { times: 1 });
  await versionButton.click();
  await page.getByRole("alert").filter({ hasText: "Le PDF reste en attente" }).waitFor();
  assert.equal(await draft.getByRole("link", { name: "Télécharger ce PDF" }).count(), 1);
  await versionButton.click();
  await row.getByText("Version 2", { exact: false }).waitFor();
  console.log("PDF browser: direct version save and failed-save retry");
  await page.waitForFunction(() => !document.querySelector('.hydria-pdf-prepared-item'));
  const bytesV2 = Buffer.from(await page.request.get(base + "/api/drive/pdf-assets/" + assetId + "/download").then(r => r.body()));
  assert.match(bytesV2.toString(), /fixture edit/);
  assert.deepEqual(await page.request.get(base + "/api/drive/pdf-assets/" + assetId + "/versions/1/download").then(r => r.body()), pdf);
  await row.locator("summary").click();
  await row.getByRole("link", { name: "Version 1", exact: true }).waitFor();
  await row.getByRole("link", { name: "Version 2", exact: true }).waitFor();

  // Concurrent change produces a 409, and the prepared file can become a copy.
  await frame.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await draft.waitFor();
  const concurrent = new FormData();
  concurrent.append("file", new Blob([pdf], { type: "application/pdf" }), "edition-pdfcraft.pdf");
  concurrent.append("expectedRevision", "2");
  assert.equal((await fetch(base + "/api/drive/pdf-assets/" + assetId + "/versions", { method: "POST", body: concurrent })).status, 201);
  await draft.getByRole("button", { name: /Ajouter à.*version 3/ }).click();
  await page.getByRole("alert").filter({ hasText: "version plus récente" }).waitFor();
  console.log("PDF browser: stale version rejected");
  assert.equal(await draft.count(), 1);
  await draft.getByRole("button", { name: "Enregistrer une nouvelle copie" }).click();
  await page.waitForFunction(() => !document.querySelector('.hydria-pdf-prepared-item'));

  // Multiple native tabs are not auto-bound to the last Drive file.
  await frame.getByRole("button", { name: "Enregistrer sous", exact: true }).click();
  await draft.waitFor();
  assert.equal(await draft.getByRole("button", { name: /Ajouter à/ }).count(), 0);
  await page.getByRole("button", { name: "Nouveau / Ouvrir un fichier local" }).click();
  await page.locator('.hydria-pdf-frame[data-bridge-ready="true"]').waitFor();
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message',{
    origin:location.origin,source:window.oldPdfFrame,
    data:{type:'pdfcraft:save',name:'obsolete.pdf',saveAs:false,bytes:new TextEncoder().encode('%PDF-1.4\n%%EOF\n').buffer}
  })));
  assert.equal(await draft.count(), 1);
  await draft.getByRole("button", { name: "Enregistrer une nouvelle copie" }).click();
  await page.waitForFunction(() => !document.querySelector('.hydria-pdf-prepared-item'));

  // If an edit grows past Drive's size limit, keep a local recovery download.
  await page.locator('.hydria-pdf-frame').evaluate(element => element.contentWindow.eval(`
    const large = new Uint8Array(20 * 1024 * 1024 + 1);
    large.set(new TextEncoder().encode('%PDF-1.4'));
    parent.postMessage({type:'pdfcraft:save',name:'volumineux.pdf',saveAs:true,bytes:large.buffer},location.origin,[large.buffer]);
  `));
  await draft.filter({ hasText: "volumineux.pdf" }).waitFor();
  assert.equal(await draft.getByRole("button", { name: "Enregistrer une nouvelle copie" }).count(), 0);
  assert.equal(await draft.getByRole("link", { name: "Télécharger ce PDF" }).count(), 1);
  page.once("dialog", dialog => dialog.accept());
  await draft.getByRole("button", { name: "Retirer cet export" }).click();
  await page.waitForFunction(() => !document.querySelector('.hydria-pdf-prepared-item'));

  await page.goto(base + "/workspace/drive", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.hydriaBoot === "ready");
  const driveRow = page.locator(".hydria-drive-pdf-row").filter({ hasText: "edition-pdfcraft.pdf" }).filter({ hasText: "Version 3" });
  await driveRow.waitFor({ timeout: 15000 });
  await driveRow.getByRole("link", { name: "Ouvrir dans PDF Studio" }).click();
  await page.waitForURL(url => url.pathname === "/workspace/pdf" && url.searchParams.get("assetId") === assetId);
  await page.frameLocator(".hydria-pdf-frame").getByText("PDF payload received: edition-pdfcraft.pdf", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log("PDF host bridge browser gate passed: source/origin checks, direct exports, failure retry, immutable history, conflicts, copy and Drive reopen.");
} catch (error) {
  await page.screenshot({ path: "/tmp/hydria-pdf-browser-failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  if (created) await rm(dist, { recursive: true, force: true });
}
