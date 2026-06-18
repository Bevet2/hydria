import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.CRM_API_URL || "http://localhost:4010/api";
const suffix = Date.now();
let token = "";
let organizationId = "";

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${await response.text()}`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function main() {
  const registration = await request<{ token: string; user: { id: string; organizationId: string } }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      organizationName: `Sales Ops Gate ${suffix}`,
      firstName: "Sales",
      lastName: "Operator",
      email: `sales-ops-${suffix}@example.com`,
      password: "SalesOpsGate123!"
    })
  });
  token = registration.token;
  organizationId = registration.user.organizationId;

  const organization = await request<{ organization: { defaultCurrency: string } }>("/organization", {
    method: "PATCH",
    body: JSON.stringify({
      defaultCurrency: "USD",
      defaultTaxPercent: 8.5,
      paymentTermsDays: 21,
      quotePrefix: "PROP",
      invoicePrefix: "BILL"
    })
  });
  if (organization.organization.defaultCurrency !== "USD") throw new Error("Organization commercial defaults were not persisted");

  const territory = await request<{ territory: { id: string } }>("/sales-ops/territories", {
    method: "POST",
    body: JSON.stringify({ name: "North America", countries: ["US", "CA"] })
  });
  const campaign = await request<{ campaign: { id: string } }>("/sales-ops/campaigns", {
    method: "POST",
    body: JSON.stringify({ name: "Gate Campaign", channel: "EVENT", status: "ACTIVE", budget: 2500 })
  });
  const sequence = await request<{ sequence: { id: string } }>("/sales-ops/sequences", {
    method: "POST",
    body: JSON.stringify({
      name: "Gate follow-up",
      steps: [
        { type: "TASK", delayDays: 0, title: "Call qualified lead" },
        { type: "EMAIL", delayDays: 2, subject: "Following up", body: "Can we help?" }
      ]
    })
  });
  const lead = await request<{ lead: { id: string; score: number } }>("/leads", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Qualified",
      lastName: "Prospect",
      email: `prospect-${suffix}@example.com`,
      jobTitle: "VP Sales",
      companyName: "Gate Customer",
      source: "Referral",
      rating: "HOT",
      annualRevenue: 2_000_000,
      employeeCount: 120,
      campaignId: campaign.campaign.id,
      territoryId: territory.territory.id
    })
  });
  if (lead.lead.score < 50) throw new Error(`Lead score is unexpectedly low (${lead.lead.score})`);

  const enrollment = await request<{ enrollment: { id: string } }>(`/sales-ops/sequences/${sequence.sequence.id}/enroll`, {
    method: "POST",
    body: JSON.stringify({ leadId: lead.lead.id })
  });
  const sequenceJob = await prisma.backgroundJob.findFirst({
    where: { organizationId, type: "SEQUENCE_STEP", payload: { path: ["enrollmentId"], equals: enrollment.enrollment.id } }
  });
  if (!sequenceJob) throw new Error("Sequence enrollment did not create a persistent job");

  const rule = await request<{ rule: { id: string } }>("/automations", {
    method: "POST",
    body: JSON.stringify({
      name: "Multi-step gate",
      trigger: "LEAD_STATUS_CHANGED",
      action: "CREATE_TASK",
      conditions: { status: "QUALIFIED" },
      configuration: { title: "Immediate qualification task" },
      steps: [
        { action: "CREATE_TASK", delayMinutes: 0, configuration: { title: "Immediate qualification task" } },
        { action: "SEND_EMAIL", delayMinutes: 60, configuration: { subject: "Qualified lead", body: "Review this lead." } }
      ]
    })
  });
  await request(`/leads/${lead.lead.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "QUALIFIED" })
  });
  const delayedAutomation = await prisma.backgroundJob.findFirst({
    where: { organizationId, type: "AUTOMATION_ACTION", payload: { path: ["ruleId"], equals: rule.rule.id } }
  });
  if (!delayedAutomation) throw new Error("Delayed automation step was not queued");

  const saved = await request<{ report: { id: string } }>("/reports/saved", {
    method: "POST",
    body: JSON.stringify({
      name: "Campaign pipeline",
      resource: "DEALS",
      metric: "VALUE",
      groupBy: "CAMPAIGN",
      filters: { campaignId: campaign.campaign.id }
    })
  });
  const reports = await request<{ reports: Array<{ id: string }> }>("/reports/saved");
  if (!reports.reports.some((report) => report.id === saved.report.id)) throw new Error("Saved report was not persisted");

  const overview = await request<{ territories: unknown[]; campaigns: unknown[]; sequences: unknown[] }>("/sales-ops");
  if (!overview.territories.length || !overview.campaigns.length || !overview.sequences.length) {
    throw new Error("Sales operations overview is incomplete");
  }
  const backupResponse = await fetch(`${baseUrl}/backups/export`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!backupResponse.ok) throw new Error(`Backup export failed (${backupResponse.status})`);
  const backup = await backupResponse.json() as {
    schemaVersion: number;
    data: { territories: unknown[]; campaigns: unknown[]; sequences: unknown[]; sequenceEnrollments: unknown[]; customReports: unknown[] };
  };
  if (
    backup.schemaVersion !== 4
    || !backup.data.territories.length
    || !backup.data.campaigns.length
    || !backup.data.sequences.length
    || !backup.data.sequenceEnrollments.length
    || !backup.data.customReports.length
  ) {
    throw new Error("Backup v3 is missing sales operations records");
  }

  console.log(JSON.stringify({
    ok: true,
    organizationDefaults: true,
    territory: true,
    campaign: true,
    leadScoring: true,
    sequenceQueue: true,
    multiStepAutomation: true,
    savedReports: true,
    backupV4: true
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await prisma.$disconnect();
});
