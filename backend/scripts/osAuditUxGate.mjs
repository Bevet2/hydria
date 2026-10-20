import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs/promises";
const base = process.env.HYDRIA_VISUAL_BASE_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto(base + "/workspace/docs", { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-launcher-grid-single .workspace-launcher-card").waitFor();
  const response = page.waitForResponse(r => r.url().endsWith("/api/work-objects/new") && r.request().method() === "POST");
  await page.locator(".workspace-launcher-grid-single .workspace-launcher-card").click();
  const object = (await (await response).json()).workObject;
  const paragraph = page.locator('.workspace-document-page-sheet p').first();
  await paragraph.waitFor();
  const rect = await paragraph.boundingBox();
  assert.ok(rect.x >= 0 && rect.x + rect.width <= 391, "Mobile paragraph must fit in the viewport: " + JSON.stringify(rect));
  const marker = "Mobile audit " + Date.now();
  await paragraph.fill(marker); await paragraph.press("Tab");
  await page.waitForFunction(async ({ base, id, marker }) => {
    const result = await fetch(`${base}/api/work-objects/${id}?content=1`).then(r => r.json());
    return result.workObject?.file?.content?.includes(marker);
  }, { base, id: object.id, marker }, { timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".workspace-document-page-sheet").first().waitFor();
  assert.ok((await page.locator(".workspace-document-page-sheet").allTextContents()).join(" ").includes(marker));
  await page.evaluate(async () => {
    const { showWorkspaceActionConsent } = await import("/components/workspaceActionConsent.js");
    showWorkspaceActionConsent({ userId: 1, results: [{ status: "needs_confirmation", confirmationToken: "test-display-only", toolName: "sheet.delete_row" }] });
  });
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.getByRole("button", { name: "Annuler", exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press("Escape"); assert.equal(await page.getByRole("dialog").count(), 0);
  await fs.mkdir("/tmp/hydria-audit-ux", { recursive: true });
  await page.screenshot({ path: "/tmp/hydria-audit-ux/mobile-edit-reopened.png" });
  console.log("Audit UX gate passed: mobile editor fits, edits persist after reload, confirmation is keyboard accessible and cancellable.");
} finally { await browser.close(); }
