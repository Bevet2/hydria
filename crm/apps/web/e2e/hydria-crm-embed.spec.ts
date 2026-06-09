import { expect, test } from "@playwright/test";

test("Hydria CRM workspace exposes the real interactive application", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://localhost:3001/workspace/crm");
  const crm = page.frameLocator(".workspace-crm-live-frame");
  await expect(crm.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  if ((page.viewportSize()?.width || 0) <= 760) {
    await page.locator(".workspace-crm-live-frame").scrollIntoViewIfNeeded();
    await crm.getByRole("button", { name: "Open menu" }).click();
  }
  await crm.getByRole("link", { name: "Contacts" }).click();
  await expect(crm.getByRole("heading", { name: "Contacts" })).toBeVisible();
  expect(errors).toEqual([]);
});
