import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("core CRM workspaces render without browser errors or overflow", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  for (const route of ["/products", "/tasks", "/communications", "/platform", "/settings"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    if (route === "/communications" || route === "/platform") {
      await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}.png`), fullPage: true });
    }
  }

  await page.goto("/contacts");
  const firstContact = page.locator(".record-link").first();
  if (await firstContact.count()) {
    await firstContact.click();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Task" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("record-detail.png"),
      fullPage: true
    });
  }
  expect(browserErrors).toEqual([]);
});
