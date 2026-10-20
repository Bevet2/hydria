import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
try {
  const errors = [];
  page.on("pageerror", error => errors.push(String(error.message || error)));
  await page.goto("http://127.0.0.1:3001/workspace/drive", { waitUntil: "domcontentloaded" });
  await page.locator(".hydria-drive").waitFor({ timeout: 30_000 });
  assert.equal(await page.locator(".hydria-drive-heading h2").textContent(),
    "Tous vos espaces, au même endroit");
  assert.equal(await page.locator('.workspace-switcher-chip[data-workspace-page="drive"]').count(), 1);

  // Wait for Hydria startup: the initial library can still be hydrating here.
  await page.waitForFunction(() => document.documentElement.dataset.hydriaBoot === "ready");
  await page.locator(".hydria-drive-quick").waitFor();
  const [creation] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/work-objects/new") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Nouveau document", exact: true }).click()
  ]);
  const created = (await creation.json()).workObject;
  assert.ok(created?.id && created.title, "Drive must create a real document");
  await page.waitForURL(/\/workspace\/docs(?:$|\?)/, { timeout: 25_000 });
  await page.goto("http://127.0.0.1:3001/workspace/drive", { waitUntil: "domcontentloaded" });
  await page.locator(".hydria-drive-item").first().waitFor({ timeout: 25_000 });
  assert.match(await page.locator(".hydria-drive-results").innerText(), /[1-9]\d* résultat/);

  await page.getByRole("searchbox", { name: "Rechercher dans Hydria Drive" }).fill(created.title);
  assert.ok(await page.locator(".hydria-drive-item").count() >= 1);
  await page.getByRole("combobox", { name: "Filtrer les types" }).selectOption("dataset");
  assert.equal(await page.locator(".hydria-drive-item").count(), 0);
  await page.getByRole("combobox", { name: "Filtrer les types" }).selectOption("document");
  // Existing browser scenarios may already have multiple matching Docs.
  assert.ok(await page.locator(".hydria-drive-item").count() >= 1);

  await page.locator(".hydria-drive-item").first().click();
  await page.waitForURL(/\/workspace\/docs(?:$|\?)/, { timeout: 25_000 });
  assert.deepEqual(errors, [], "Browser console script errors");
  console.log("Drive browser acceptance passed: route, create, search, filter, open.");
} finally {
  await browser.close();
}
