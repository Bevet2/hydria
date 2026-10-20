import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const bytes1 = Buffer.from("%PDF-1.4\n1 0 obj\nendobj\n%%EOF\n");
const bytes2 = Buffer.from("%PDF-1.5\n2 0 obj\nendobj\n%%EOF\n");
try {
  await page.goto(base + "/workspace/pdf", { waitUntil: "domcontentloaded" });
  await page.locator(".hydria-pdf-workbench").waitFor({ timeout: 30_000 });
  await page.getByText("Installation nécessaire").waitFor({ timeout: 15_000 });

  await page.locator(".hydria-pdf-upload-file").setInputFiles({
    name: "hydria-acceptance.pdf", mimeType: "application/pdf", buffer: bytes1
  });
  await page.waitForFunction(() => {
    const label = document.querySelector(".hydria-pdf-status")?.textContent || "";
    return label.includes("PDF enregistré") || label.includes("Enregistrement refusé");
  }, { timeout: 20_000 });
  const statusText = await page.locator(".hydria-pdf-status").innerText();
  const errorText = await page.locator(".hydria-pdf-error").innerText();
  assert.match(statusText, /PDF enregistré · révision 1/, "PDF upload failure: " + errorText);
  const id = await page.getByRole("combobox", { name: "PDF Hydria Drive" }).inputValue();
  assert.match(id, /^[0-9a-f-]{36}$/i);
  const userId = await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll("#user-select option"));
    const selected = document.querySelector("#user-select")?.value;
    return Number(selected || options[0]?.value || 0);
  });
  assert.ok(userId > 0);
  let fetched = await page.request.get(base + "/api/work-objects/" + id + "/pdf-content?userId=" + userId);
  assert.equal(fetched.status(), 200);
  assert.equal(fetched.headers()["content-type"]?.includes("application/pdf"), true);
  assert.deepEqual(Buffer.from(await fetched.body()), bytes1);
  const rejected = await page.request.get(base + "/api/work-objects/" + id + "/pdf-content?userId=99999");
  assert.equal(rejected.status(), 403);

  await page.locator(".hydria-pdf-upload-file").setInputFiles({
    name: "hydria-acceptance.pdf", mimeType: "application/pdf", buffer: bytes2
  });
  await page.getByText("PDF enregistré · révision 2").waitFor({ timeout: 20_000 });
  fetched = await page.request.get(base + "/api/work-objects/" + id + "/pdf-content?userId=" + userId);
  assert.equal(fetched.status(), 200);
  assert.deepEqual(Buffer.from(await fetched.body()), bytes2);

  const stale = new FormData();
  stale.append("userId", String(userId));
  stale.append("workObjectId", id);
  stale.append("expectedRevision", "1");
  stale.append("file", new Blob([bytes1], { type: "application/pdf" }), "stale.pdf");
  const staleResponse = await fetch(base + "/api/work-objects/pdf-binaries", {
    method: "POST", body: stale
  });
  assert.equal(staleResponse.status, 409);

  await page.goto(base + "/workspace/drive", { waitUntil: "domcontentloaded" });
  await page.locator(".hydria-drive").waitFor({ timeout: 25_000 });
  await page.getByRole("combobox", { name: "Filtrer les types" }).selectOption("pdf");
  await page.getByRole("searchbox", { name: "Rechercher dans Hydria Drive" })
    .fill("hydria-acceptance");
  await page.locator(".hydria-drive-item").first().click();
  await page.waitForURL(/\/workspace\/pdf(?:\?|$)/, { timeout: 15_000 });
  await page.locator(".hydria-pdf-saved-select").waitFor();
  assert.equal(await page.locator(".hydria-pdf-saved-select").inputValue(), id);
  console.log("PDF Drive browser acceptance: upload, overwrite, scoped reads, conflict, and Drive routing passed.");
} finally {
  await browser.close();
}
