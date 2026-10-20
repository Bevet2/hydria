import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page) {
  await page.goto("/crm/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.CRM_TEST_EMAIL || "admin@northstar.local");
  await page.getByLabel("Password", { exact: true }).fill(process.env.CRM_TEST_PASSWORD || "Northstar123!");
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/crm\/$/);
}
