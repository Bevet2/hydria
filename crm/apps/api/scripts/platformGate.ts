import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.CRM_API_URL || "http://localhost:4010/api";
const suffix = Date.now();
let token = "";
let organizationId = "";

async function request<T>(path: string, init: RequestInit = {}, authToken = token) {
  const headers = new Headers(init.headers);
  if (authToken) headers.set("authorization", `Bearer ${authToken}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${await response.text()}`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function decodeBase32(value: string) {
  const bits = value.split("").map((character) => alphabet.indexOf(character).toString(2).padStart(5, "0")).join("");
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret: string) {
  const counter = Math.floor(Date.now() / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 15;
  const value = (((digest[offset]! & 127) << 24) | (digest[offset + 1]! << 16) | (digest[offset + 2]! << 8) | digest[offset + 3]!) % 1_000_000;
  return String(value).padStart(6, "0");
}

async function main() {
  const adminEmail = `platform-${suffix}@example.com`;
  const registration = await request<{ token: string; refreshToken: string; user: { id: string; organizationId: string } }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      organizationName: `Platform Gate ${suffix}`,
      firstName: "Platform",
      lastName: "Admin",
      email: adminEmail,
      password: "PlatformGate123!"
    })
  });
  token = registration.token;
  organizationId = registration.user.organizationId;
  const adminId = registration.user.id;

  const refreshed = await request<{ token: string; refreshToken: string }>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: registration.refreshToken })
  }, "");
  token = refreshed.token;

  const setup = await request<{ secret: string }>("/auth/mfa/setup", { method: "POST" });
  const enabled = await request<{ recoveryCodes: string[] }>("/auth/mfa/enable", {
    method: "POST",
    body: JSON.stringify({ code: totp(setup.secret) })
  });
  if (enabled.recoveryCodes.length !== 8) throw new Error("MFA recovery codes were not generated");

  const invitation = await request<{ debugToken: string }>("/users/invitations", {
    method: "POST",
    body: JSON.stringify({ email: `invite-${suffix}@example.com`, firstName: "Invited", lastName: "User", role: "MEMBER" })
  });
  const accepted = await request<{ token: string; user: { id: string } }>("/auth/accept-invitation", {
    method: "POST",
    body: JSON.stringify({ token: invitation.debugToken, password: "InvitationGate123!" })
  }, "");
  if (!accepted.user.id) throw new Error("Invitation acceptance failed");

  const rule = await request<{ rule: { id: string } }>("/automations", {
    method: "POST",
    body: JSON.stringify({
      name: "Gate lead follow-up",
      trigger: "LEAD_CREATED",
      action: "CREATE_TASK",
      conditions: { source: "platform-gate" },
      configuration: { title: "Call platform gate lead", assignedToId: adminId, dueInDays: 1 }
    })
  });
  const lead = await request<{ lead: { id: string } }>("/leads", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Duplicate", lastName: "Lead", email: `lead-${suffix}@example.com`,
      source: "platform-gate", status: "NEW", rating: "WARM"
    })
  });
  await request("/leads", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Duplicate", lastName: "Lead", email: `lead-${suffix}@example.com`,
      source: "platform-gate", status: "NEW", rating: "WARM"
    })
  });
  const duplicateLeads = await request<{ groups: Array<Array<{ id: string }>> }>("/data/duplicates/leads");
  if (!duplicateLeads.groups.some((group) => group.some((item) => item.id === lead.lead.id))) throw new Error("Lead duplicate detection failed");
  const automationRun = await prisma.automationRun.findFirst({ where: { ruleId: rule.rule.id, entityId: lead.lead.id, status: "COMPLETED" } });
  if (!automationRun) throw new Error("Lead automation did not run");

  const key = await request<{ key: { id: string }; token: string }>("/api-keys", {
    method: "POST",
    body: JSON.stringify({ name: "Platform gate", scopes: ["crm:read"] })
  });
  await request("/contacts?limit=1", {}, key.token);
  const deniedWrite = await fetch(`${baseUrl}/companies`, {
    method: "POST",
    headers: { authorization: `Bearer ${key.token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "Scope violation" })
  });
  if (deniedWrite.status !== 403) throw new Error(`Read-only API key write returned ${deniedWrite.status} instead of 403`);
  await request(`/api-keys/${key.key.id}`, { method: "DELETE" });

  const company = await request<{ company: { id: string } }>("/companies", {
    method: "POST", body: JSON.stringify({ name: `Gate Company ${suffix}`, domain: `gate-${suffix}.example.com` })
  });
  const product = await request<{ product: { id: string } }>("/products", {
    method: "POST", body: JSON.stringify({ name: "Gate Service", sku: `GATE-${suffix}`, unitPrice: 500, currency: "EUR", active: true })
  });
  const pipeline = await request<{ stages: Array<{ id: string }> }>("/pipeline");
  const deal = await request<{ deal: { id: string } }>("/pipeline/deals", {
    method: "POST",
    body: JSON.stringify({ name: `Gate Deal ${suffix}`, stageId: pipeline.stages[0]!.id, companyId: company.company.id, value: 0, probability: 20, currency: "EUR", forecastCategory: "PIPELINE" })
  });
  await request(`/products/deals/${deal.deal.id}/items`, {
    method: "POST", body: JSON.stringify({ productId: product.product.id, quantity: 2, discountPercent: 0 })
  });
  const quote = await request<{ quote: { id: string } }>(`/products/deals/${deal.deal.id}/quotes`, {
    method: "POST", body: JSON.stringify({ name: "Gate proposal", taxPercent: 20, discountPercent: 0 })
  });
  const approval = await request<{ approval: { id: string } }>(`/commercial/quotes/${quote.quote.id}/approvals`, {
    method: "POST", body: JSON.stringify({ reviewerId: adminId })
  });
  await request(`/commercial/approvals/${approval.approval.id}/decision`, {
    method: "POST", body: JSON.stringify({ status: "APPROVED" })
  });
  await request(`/products/quotes/${quote.quote.id}/status`, {
    method: "PATCH", body: JSON.stringify({ status: "SENT" })
  });
  const signature = await request<{ signingUrl: string }>(`/commercial/quotes/${quote.quote.id}/signatures`, {
    method: "POST", body: JSON.stringify({ signerName: "Gate Signer", signerEmail: `signer-${suffix}@example.com` })
  });
  const signatureToken = new URL(signature.signingUrl).searchParams.get("token");
  await request(`/commercial/signatures/${signatureToken}`, {
    method: "POST", body: JSON.stringify({ signerName: "Gate Signer", signature: "Gate Signer", accepted: true })
  }, "");
  const invoice = await request<{ invoice: { id: string } }>(`/commercial/quotes/${quote.quote.id}/invoices`, {
    method: "POST", body: JSON.stringify({})
  });
  if (!invoice.invoice.id) throw new Error("Invoice creation failed");

  await request("/compliance/consents", {
    method: "POST",
    body: JSON.stringify({ leadId: lead.lead.id, email: `lead-${suffix}@example.com`, purpose: "sales follow-up", status: "GRANTED", legalBasis: "consent" })
  });
  const privacy = await request<{ request: { id: string } }>("/compliance/privacy-requests", {
    method: "POST", body: JSON.stringify({ type: "EXPORT", subjectEmail: `lead-${suffix}@example.com` })
  });
  const processed = await request<{ request: { status: string; result: unknown } }>(`/compliance/privacy-requests/${privacy.request.id}/process`, {
    method: "POST", body: JSON.stringify({})
  });
  if (processed.request.status !== "COMPLETED" || !processed.request.result) throw new Error("Privacy export failed");

  await request("/backups/schedule", {
    method: "PUT", body: JSON.stringify({ enabled: true, cron: "0 2 * * *", target: "LOCAL" })
  });
  const backup = await request<{ backup: { bytes: number } }>("/backups/schedule/run", { method: "POST" });
  if (backup.backup.bytes < 100) throw new Error("Scheduled backup is unexpectedly empty");

  console.log(JSON.stringify({
    ok: true, sessions: true, mfa: true, invitation: true, automation: true,
    duplicateDetection: true, apiKey: true, quoteLifecycle: true, privacy: true, scheduledBackup: true
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await prisma.$disconnect();
});
