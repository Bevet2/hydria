import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("primary CRM pages expose usable names and document structure", async ({ page }) => {
  for (const route of ["/", "/leads", "/pipeline", "/products", "/tickets", "/reports", "/communications", "/sales-ops", "/platform"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toHaveCount(1);
    const problems = await page.evaluate(() => {
      const issues: string[] = [];
      for (const button of document.querySelectorAll("button")) {
        if (!(button.textContent || button.getAttribute("aria-label") || button.getAttribute("title"))?.trim()) {
          issues.push("button without accessible name");
        }
      }
      for (const input of document.querySelectorAll("input, select, textarea")) {
        const id = input.getAttribute("id");
        const labelled = input.getAttribute("aria-label")
          || input.getAttribute("aria-labelledby")
          || input.closest("label")
          || (id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
        if (!labelled && input.getAttribute("type") !== "hidden") issues.push(`${input.tagName.toLowerCase()} without label`);
      }
      return issues;
    });
    expect(problems, `${route} accessibility problems`).toEqual([]);
  }
});
