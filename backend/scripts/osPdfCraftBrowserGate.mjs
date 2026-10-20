import assert from "node:assert/strict";
import { mkdir, writeFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const dist = path.resolve("frontend/vendor/pdfcraft");
// Never overwrite or remove a real PdfCraft installation on a developer machine.
try {
  await stat(dist);
  throw Error("Refusing to replace an installed PdfCraft runtime in browser tests");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1360, height: 960 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  // Private OS should never redirect externally when optional PdfCraft is missing.
  await page.goto("http://127.0.0.1:3001/workspace/pdf", { waitUntil: "domcontentloaded" });
  await page.locator(".hydria-pdf-workbench").waitFor({ timeout: 30_000 });
  await page.getByText("Installation nécessaire").waitFor({ timeout: 15_000 });
  assert.equal(await page.locator(".hydria-pdf-frame").count(), 0);

  // A tiny local fixture exercises the iframe/blob handoff without downloading
  // the upstream 14MB archive on every CI run. Real WASM smoke is separate.
  await mkdir(dist, { recursive: true });
  await writeFile(path.join(dist, "index.html"), `<!doctype html><html><body>
    <p id="state">PdfCraft fixture</p>
    <script>
      (async () => {
        const file = new URLSearchParams(location.search).get("file");
        if (!file) return;
        const response = await fetch(file);
        const bytes = new Uint8Array(await response.arrayBuffer());
        document.querySelector("#state").textContent =
          bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70
            ? "PDF payload received" : "Invalid PDF payload";
      })().catch(error => document.querySelector("#state").textContent = error.message);
    </script>
  </body></html>`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".hydria-pdf-frame").waitFor({ timeout: 30_000 });
  await page.frameLocator(".hydria-pdf-frame").getByText("PdfCraft fixture").waitFor();
  await page.evaluate(async () => {
    const { renderPdfCraftWorkbench } = await import("/components/pdfCraftWorkbench.js");
    const container = document.createElement("div");
    container.id = "pdf-fixture-test";
    document.body.append(container);
    renderPdfCraftWorkbench(container, {
      documents: [{ id: "local", title: "Validation" }],
      onExportDocument: async () => new Blob(["%PDF-1.4\\n% Hydria PDF smoke"], { type: "application/pdf" })
    });
  });
  const panel = page.locator("#pdf-fixture-test");
  await panel.locator(".hydria-pdf-frame").waitFor({ timeout: 15_000 });
  await panel.getByLabel("Document Hydria à exporter en PDF").selectOption("local");
  await panel.getByRole("button", { name: "Ouvrir en PDF" }).click();
  await panel.frameLocator(".hydria-pdf-frame").getByText("PDF payload received").waitFor({ timeout: 15_000 });
  assert.deepEqual(errors, []);
  console.log("PDF Studio browser acceptance: missing runtime fallback, embedded frame, PDF Blob handoff.");
} finally {
  await browser.close();
  await rm(dist, { recursive: true, force: true });
}
