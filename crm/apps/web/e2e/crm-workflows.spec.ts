import { expect, test } from "@playwright/test";

test("admin can run the core CRM workflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The full mutation workflow runs once.");

  const suffix = Date.now();
  const companyName = `E2E Company ${suffix}`;
  const contactName = `E2E Contact ${suffix}`;
  const dealName = `E2E Deal ${suffix}`;
  const taskName = `E2E Follow-up ${suffix}`;
  const created: Record<string, string> = {};
  let token = "";

  async function api(path: string, method = "GET", body?: unknown) {
    const response = await page.request.fetch(`http://localhost:4010/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { "content-type": "application/json" } : {})
      },
      data: body
    });
    expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBe(true);
    return response.status() === 204 ? null : response.json();
  }

  try {
    await page.goto("/login");
    await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    token = await page.evaluate(() => localStorage.getItem("northstar_crm_token") || "");
    expect(token).toBeTruthy();

    await page.goto("/companies");
    await page.getByRole("button", { name: "Company", exact: true }).click();
    const companyDialog = page.getByRole("dialog", { name: "New company" });
    await companyDialog.getByLabel("Company name").fill(companyName);
    await companyDialog.getByLabel("Industry").fill("Testing");
    await companyDialog.getByRole("button", { name: "Create company" }).click();
    await page.getByPlaceholder("Search companies").fill(companyName);
    await expect(page.getByRole("heading", { name: companyName })).toBeVisible();
    created.companyId = (await api(`/companies?limit=100&search=${encodeURIComponent(companyName)}`)).companies[0].id;

    await page.goto("/contacts");
    await page.getByRole("button", { name: "Contact", exact: true }).click();
    const contactDialog = page.getByRole("dialog", { name: "New contact" });
    await contactDialog.getByLabel("First name").fill("E2E");
    await contactDialog.getByLabel("Last name").fill(`Contact ${suffix}`);
    await contactDialog.getByLabel("Email").fill(`e2e-${suffix}@example.com`);
    await contactDialog.getByLabel("Company").selectOption({ label: companyName });
    await contactDialog.getByRole("button", { name: "Create contact" }).click();
    await page.getByPlaceholder("Search contacts").fill(`e2e-${suffix}@example.com`);
    await expect(page.getByText(contactName, { exact: true })).toBeVisible();
    created.contactId = (await api(`/contacts?limit=100&search=${encodeURIComponent(`e2e-${suffix}@example.com`)}`)).contacts[0].id;

    await page.getByText(contactName, { exact: true }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit contact" });
    await editDialog.getByLabel("Job title").fill("Revenue Tester");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Revenue Tester", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Task", exact: true }).click();
    const taskDialog = page.getByRole("dialog", { name: "New task" });
    await taskDialog.getByLabel("Title").fill(taskName);
    await taskDialog.getByLabel("Priority").selectOption("HIGH");
    await taskDialog.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByText(taskName, { exact: true })).toBeVisible();
    created.taskId = (await api(`/tasks?relationType=contact&relationId=${created.contactId}`)).tasks.find(
      (task: { title: string }) => task.title === taskName
    ).id;

    await page.goto("/tasks");
    await page.getByRole("button", { name: `Edit ${taskName}` }).click();
    const editTaskDialog = page.getByRole("dialog", { name: "Edit task" });
    await editTaskDialog.getByLabel("Title").fill(`${taskName} updated`);
    await editTaskDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: `${taskName} updated` })).toBeVisible();

    await page.goto("/pipeline");
    await page.getByRole("button", { name: "Deal", exact: true }).click();
    const dealDialog = page.getByRole("dialog", { name: "New deal" });
    await dealDialog.getByLabel("Deal name").fill(dealName);
    await dealDialog.getByLabel("Value").fill("12500");
    await dealDialog.getByLabel("Company").selectOption({ label: companyName });
    await dealDialog.getByRole("button", { name: "Create deal" }).click();
    await expect(page.getByRole("heading", { name: dealName })).toBeVisible();
    created.dealId = (await api("/pipeline")).deals.find(
      (deal: { name: string }) => deal.name === dealName
    ).id;
  } finally {
    if (token) {
      const cleanup = [
        created.taskId && `/tasks/${created.taskId}`,
        created.dealId && `/pipeline/deals/${created.dealId}`,
        created.contactId && `/contacts/${created.contactId}`,
        created.companyId && `/companies/${created.companyId}`
      ].filter((path): path is string => Boolean(path));
      for (const path of cleanup) {
        await api(path, "DELETE").catch(() => undefined);
      }
    }
  }
});
