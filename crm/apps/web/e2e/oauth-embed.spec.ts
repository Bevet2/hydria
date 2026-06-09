import { expect, test } from "@playwright/test";

test("OAuth completes through a popup from the embedded Hydria CRM", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Popup flow is covered once on desktop Chromium");

  const state = "signed-oauth-state-for-browser-gate";
  let exchangeBody: Record<string, unknown> | null = null;

  await context.route("**/api/integrations/oauth/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        redirectUri: "http://localhost:5174/oauth/callback",
        providers: {
          GOOGLE: { configured: true },
          MICROSOFT: { configured: false }
        }
      })
    });
  });
  await context.route("**/api/integrations/oauth/GOOGLE/start", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        state,
        redirectUri: "http://localhost:5174/oauth/callback",
        authorizationUrl: `http://localhost:5174/oauth/callback?code=browser-gate-code&state=${state}`
      })
    });
  });
  await context.route("**/api/integrations/oauth/callback", async (route) => {
    exchangeBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        connection: {
          id: "00000000-0000-0000-0000-000000000001",
          provider: "GOOGLE",
          status: "ACTIVE",
          externalEmail: "oauth-gate@example.com"
        }
      })
    });
  });

  await page.goto("http://localhost:3001/workspace/crm");
  const crm = page.frameLocator(".workspace-crm-live-frame");
  await expect(crm.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await crm.getByRole("link", { name: "Email & calendar" }).click();
  await expect(crm.getByRole("heading", { name: "Email & calendar" })).toBeVisible();
  await expect(crm.getByRole("button", { name: "Google" })).toBeEnabled();

  const popupPromise = page.waitForEvent("popup");
  await crm.getByRole("button", { name: "Google" }).click();
  const popup = await popupPromise;
  await expect.poll(() => exchangeBody).not.toBeNull();
  expect(exchangeBody).toMatchObject({
    code: "browser-gate-code",
    state
  });
  await expect.poll(() => popup.isClosed()).toBe(true);
});
