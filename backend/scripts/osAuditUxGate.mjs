import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs/promises";
const base = process.env.HYDRIA_VISUAL_BASE_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  const users = await (await fetch(base + "/api/users")).json();
  const userId = users.users?.[0]?.id;
  assert.ok(userId, "A test profile must exist");
  const created = await fetch(base + "/api/work-objects/new", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "document", title: "Mobile audit", workspaceFamilyId: "document_knowledge", userId })
  });
  const body = await created.json();
  assert.equal(created.status, 200, JSON.stringify(body));
  const object = body.workObject;
  await page.goto(base + "/workspace/docs?openObject=" + encodeURIComponent(object.id), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.hydriaBoot === "ready" &&
    !new URL(window.location.href).searchParams.has("openObject") &&
    document.querySelector("#workspace-title")?.textContent?.includes("Mobile audit"));
  const paragraph = page.locator('.workspace-document-page-sheet p:visible').first();
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
  await page.waitForFunction(marker => [...document.querySelectorAll(".workspace-document-page-sheet")]
    .some(el => el.getBoundingClientRect().width > 0 && el.textContent.includes(marker)), marker);
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
