import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("support tickets can be created, resolved and deleted", async ({ page }) => {
  const marker = `Browser ticket ${Date.now()}`;
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
  await page.getByRole("button", { name: "Ticket", exact: true }).click();

  const createDialog = page.getByRole("dialog", { name: "New ticket" });
  await createDialog.getByLabel("Subject").fill(marker);
  await createDialog.getByLabel("Description").fill("A reproducible support request.");
  await createDialog.getByLabel("Priority").selectOption("HIGH");
  await createDialog.getByRole("button", { name: "Create ticket" }).click();

  const search = page.getByPlaceholder("Search tickets");
  await search.fill(marker);
  const ticket = page.locator(".ticket-list > article").filter({ hasText: marker });
  await expect(ticket).toBeVisible();
  await ticket.getByRole("button", { name: /Edit T-/ }).click();

  const editDialog = page.getByRole("dialog", { name: /Edit T-/ });
  await editDialog.getByLabel("Status").selectOption("RESOLVED");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(ticket.getByText("Resolved", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await ticket.getByRole("button", { name: /Delete T-/ }).click();
  await expect(ticket).toHaveCount(0);
});
