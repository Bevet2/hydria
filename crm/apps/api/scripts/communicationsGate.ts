import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.CRM_API_URL || "http://localhost:4010/api";
const suffix = Date.now();
let token = "";
let organizationId = "";

async function request<T>(path: string, init: RequestInit = {}, authToken = token) {
  const headers = new Headers(init.headers);
  if (authToken) headers.set("authorization", `Bearer ${authToken}`);
  if (init.body) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function main() {
  const registration = await request<{ token: string; user: { organizationId: string } }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      organizationName: `Communications Gate ${suffix}`,
      firstName: "Communications",
      lastName: "Admin",
      email: `communications-${suffix}@example.com`,
      password: "CommunicationsGate123!"
    })
  }, "");
  token = registration.token;
  organizationId = registration.user.organizationId;

  const config = await request<{ redirectUri: string }>("/integrations/oauth/config");
  if (!config.redirectUri.endsWith("/oauth/callback")) throw new Error("OAuth callback URL is not canonical");

  const createdTemplate = await request<{ template: { id: string } }>("/communications/templates", {
    method: "POST",
    body: JSON.stringify({
      name: `Follow-up ${suffix}`,
      subject: "Initial subject",
      body: "Initial body",
      shared: true
    })
  });
  const updatedTemplate = await request<{ template: { subject: string } }>(
    `/communications/templates/${createdTemplate.template.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ subject: "Updated subject" })
    }
  );
  if (updatedTemplate.template.subject !== "Updated subject") throw new Error("Email template update failed");

  const connector = await request<{ connection: { id: string; provider: string } }>("/integrations/custom", {
    method: "POST",
    body: JSON.stringify({
      provider: "ACCOUNTING",
      accessToken: "communications-gate-token",
      externalAccountId: `gate-${suffix}`,
      metadata: { endpoint: "https://example.com/accounting" }
    })
  });
  if (connector.connection.provider !== "ACCOUNTING") throw new Error("Custom connector creation failed");

  const startsAt = new Date(Date.now() + 86_400_000);
  const endsAt = new Date(startsAt.getTime() + 3_600_000);
  const event = await request<{ event: { id: string } }>("/communications/calendar", {
    method: "POST",
    body: JSON.stringify({
      title: `Gate meeting ${suffix}`,
      attendeeEmails: [],
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString()
    })
  });
  await request(`/communications/calendar/${event.event.id}`, { method: "DELETE" });
  const calendar = await request<{ events: Array<{ id: string; status: string }> }>("/communications/calendar");
  if (!calendar.events.some((item) => item.id === event.event.id && item.status === "CANCELED")) {
    throw new Error("Calendar cancellation was not persisted");
  }

  const invalidCallback = await fetch(`${baseUrl}/integrations/oauth/callback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "invalid-code", state: "invalid-state-value-that-is-long-enough" })
  });
  if (invalidCallback.status !== 400) throw new Error(`Invalid OAuth callback returned ${invalidCallback.status}`);

  await request(`/communications/templates/${createdTemplate.template.id}`, { method: "DELETE" });
  await request(`/integrations/${connector.connection.id}`, { method: "DELETE" });

  console.log(JSON.stringify({
    ok: true,
    oauthConfiguration: true,
    invalidStateRejected: true,
    templates: true,
    customConnectors: true,
    calendarCancellation: true
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (organizationId) {
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});
