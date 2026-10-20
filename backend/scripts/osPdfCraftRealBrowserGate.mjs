// Real official v0.9.0 WASM: no fixture and no synthetic save message.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import parsePdf from "pdf-parse/lib/pdf-parse.js";
import { chromium } from "playwright";

const base = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const output = process.env.HYDRIA_PDF_SCREENSHOTS || "/tmp/hydria-pdf-save";
await fs.stat("frontend/vendor/pdfcraft/pdfcraft-web-93f3e457fbc79002_bg.wasm");
await fs.mkdir(output, { recursive: true });
const document = new PDFDocument({ compress: false });
const chunks = [];
document.on("data", chunk => chunks.push(chunk));
const finished = new Promise(resolve => document.on("end", resolve));
document.fontSize(20).text("Hydria - real PDF save verification");
document.fontSize(12).text("One page. Rotate this page, save to Drive and reopen.");
document.end(); await finished;
const original = Buffer.concat(chunks);
const form = new FormData();
form.append("file", new Blob([original], { type: "application/pdf" }), "hydria-real-pdf.pdf");
const uploaded = await fetch(base + "/api/drive/pdf-assets", { method: "POST", body: form });
assert.equal(uploaded.status, 201); const item = await uploaded.json();
const browser = await chromium.launch({ headless: true, args: [
  "--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"
] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await page.addInitScript(() => {
    window.pdfMessages = [];
    window.addEventListener("message", event => {
      if (event.origin === location.origin && event.data?.type?.startsWith("pdfcraft:")) {
        window.pdfMessages.push({ type: event.data.type, dirty: event.data.dirty, size: event.data.bytes?.byteLength });
      }
    });
  });
  await page.goto(base + "/workspace/pdf?assetId=" + item.id, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.hydriaBoot === "ready");
  await page.locator('.hydria-pdf-frame[data-bridge-ready="true"]').waitFor({ timeout: 90000 });
  const canvas = page.frameLocator(".hydria-pdf-frame").locator("canvas");
  await canvas.click({ position: { x: 450, y: 350 } });
  // The app does not acknowledge open messages; give its parser/render worker
  // time to finish, then verify the edit via the resulting PDF bytes below.
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(output, "01-real-open.png") });
  await page.keyboard.press("Control+k");
  await page.keyboard.type("Rotate pages clockwise", { delay: 30 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.pdfMessages.some(m => m.type === "pdfcraft:dirty" && m.dirty === true));
  console.log("Real PdfCraft edit: dirty state received after rotating the page");
  await page.keyboard.press("Control+s");
  const draft = page.locator(".hydria-pdf-prepared-item");
  await draft.waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(output, "02-real-save-review-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0);
  await draft.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  await page.screenshot({ path: path.join(output, "03-real-save-review-mobile.png") });
  const commit = draft.getByRole("button", { name: /Ajouter à.*version 2/ });
  await commit.focus();
  assert.equal(await commit.evaluate(element => element === document.activeElement), true);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector('.hydria-pdf-prepared-item'));
  const saved = await fetch(base + "/api/drive/pdf-assets/" + item.id + "/download");
  assert.equal(saved.status, 200);
  const bytes = Buffer.from(await saved.arrayBuffer()), rotations = [];
  // The bundled default PDF.js 1.10 misreads some valid incremental xrefs.
  // Use the newer parser already shipped by the installed pdf-parse package.
  const contents = await parsePdf(bytes, { version: "v2.0.550", pagerender: async pdfPage => {
    rotations.push(pdfPage.rotate);
    return (await pdfPage.getTextContent()).items.map(i => i.str).join(" ");
  } });
  assert.equal(contents.numpages, 1);
  assert.match(contents.text, /real PDF save verification/);
  assert.deepEqual(rotations, [90]);
  assert.notDeepEqual(bytes, original);
  assert.deepEqual(Buffer.from(await fetch(base + "/api/drive/pdf-assets/" + item.id + "/versions/1/download").then(r => r.arrayBuffer())), original);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.hydriaBoot === "ready");
  await page.locator('.hydria-pdf-frame[data-bridge-ready="true"]').waitFor({ timeout: 90000 });
  await page.waitForTimeout(2000);
  await canvas.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, "04-real-reopen.png") });
  assert.equal((await fetch(base + "/api/drive/pdf-assets/" + item.id).then(r => r.json())).revision, 2);
  assert.deepEqual(errors, []);
  console.log("Real PdfCraft WASM roundtrip passed: rotate 90°, native Ctrl+S, keyboard Drive commit, PDF content/rotation, original bytes retained, reload and reopen.");
} catch (error) {
  console.log("PdfCraft messages:", await page.evaluate(() => window.pdfMessages));
  await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally { await browser.close(); }
