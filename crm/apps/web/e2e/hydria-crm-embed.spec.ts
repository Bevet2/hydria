import { expect, test } from "@playwright/test";

// All top-level CRM pages must remain reachable through the *embedded* real
// application in Hydria OS, not only through the standalone CRM Vite preview.
// Embedded roles may have read-only controls, but navigation must not break.
const CRM_SECTIONS = [
  ["Leads", "Leads"],
  ["Contacts", "Contacts"],
  ["Companies", "Companies"],
  ["Pipeline", "Pipeline"],
  ["Products & quotes", "Commercial management"],
  ["Tasks", "Tasks"],
  ["Tickets", "Tickets"],
  ["Custom objects", "Custom objects"],
  ["Reports", "Reports & forecast"],
  ["Sales operations", "Sales operations"],
  ["Email & calendar", "Email & calendar"],
  ["Automation", "Automation & platform"],
  ["Settings", "Settings"]
] as const;

test("Hydria CRM workspace exposes every navigable module on desktop and mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("http://localhost:3001/workspace/crm");
  await page.waitForFunction(
    () => document.documentElement.dataset.hydriaBoot === "ready",
    { timeout: 25_000 }
  );
  const crm = page.frameLocator(".workspace-crm-live-frame");
  await expect(crm.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  const mobile = (page.viewportSize()?.width || 0) <= 760;

  for (const [navigationLabel, heading] of CRM_SECTIONS) {
    if (mobile) {
      await page.locator(".workspace-crm-live-frame").scrollIntoViewIfNeeded();
      await crm.getByRole("button", { name: "Open menu" }).click();
    }
    await crm.getByRole("link", { name: navigationLabel, exact: true }).click();
    await expect(crm.getByRole("heading", { name: heading, exact: true, level: 1 })).toBeVisible({
      timeout: 20_000
    });
  }
  expect(errors, "CRM navigation must not introduce browser exceptions").toEqual([]);
});
