import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.HYDRIA_VISUAL_BASE_URL || "http://127.0.0.1:3001";
const output = process.env.HYDRIA_UI_SCREENSHOT_DIR || "/tmp/hydria-product-ui";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const exceptions = [];
page.on("pageerror", (error) => exceptions.push(String(error)));

async function openStudio(slug) {
  const response = await page.goto(`${base}/workspace/${slug}`, { waitUntil: "domcontentloaded" });
  assert.equal(response.status(), 200);
  await page.locator(`#workspace-switcher [data-workspace-page="${slug}"].active`).waitFor({ timeout: 20000 });
  await page.locator(".workspace-launcher-grid-single .workspace-launcher-card").first().click();
  await page.locator(".hydria-media-editor").waitFor({ timeout: 25000 });
}

async function assertSavedTimeline(slug, requestedTitle) {
  await page.waitForFunction(async ({ title, expectedKind }) => {
    const library = await fetch("/api/work-objects").then((response) => response.json());
    const target = (library.workObjects || []).find((item) => item.title === title && item.kind === expectedKind);
    if (!target) return false;
    const opened = await fetch(`/api/work-objects/${target.id}?content=1`).then((response) => response.json());
    try {
      return JSON.parse(opened.workObject?.file?.content || "{}").clips?.some((clip) => clip.title === "Segment persistant");
    } catch { return false; }
  }, { title: requestedTitle, expectedKind: slug }, { timeout: 20000 });
}

try {
  for (const slug of ["video", "audio"]) {
    await openStudio(slug);
    const editor = page.locator(".hydria-media-editor");
    assert.equal(await editor.locator(".hydria-media-clip").count(), 1);
    await editor.getByRole("button", { name: "+ Ajouter un segment" }).click();
    assert.equal(await editor.locator(".hydria-media-clip").count(), 2);
    await editor.locator('input[name="title"]').fill("Segment persistant");
    await editor.getByRole("button", { name: "Appliquer les modifications" }).click();
    assert.match(await editor.locator(".hydria-media-clip").last().innerText(), /Segment persistant/);
    await assertSavedTimeline(slug, `Nouveau ${slug === "video" ? "Video Studio" : "Audio Studio"}`);
    await page.screenshot({ path: path.join(output, `suite-${slug}-desktop.png`), fullPage: false });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".hydria-media-editor").waitFor({ timeout: 25000 });
    assert.match(await page.locator(".hydria-media-clip").last().innerText(), /Segment persistant/);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, "suite-audio-mobile.png"), fullPage: false });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2), false);
  assert.deepEqual(exceptions, []);
  console.log("Video/Audio Studio: create, timeline edit, autosave, reload and mobile viewport validated.");
} finally {
  await browser.close();
}
