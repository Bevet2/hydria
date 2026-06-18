import { PrismaClient } from "@prisma/client";
import { processTicketSlaPolicies } from "../src/services/supportSla.js";

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
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function main() {
  const registration = await request<{
    token: string;
    user: { organizationId: string };
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      organizationName: `Tickets Gate ${suffix}`,
      firstName: "Support",
      lastName: "Admin",
      email: `tickets-${suffix}@example.com`,
      password: "TicketsGate123!"
    })
  });
  token = registration.token;
  organizationId = registration.user.organizationId;

  const queue = await request<{
    queue: { id: string; routingStrategy: string };
  }>("/tickets/queues", {
    method: "POST",
    body: JSON.stringify({
      name: `Priority support ${suffix}`,
      firstResponseMinutes: 30,
      resolutionMinutes: 120,
      escalationAfterMinutes: 60,
      routingStrategy: "LEAST_OPEN",
      businessHours: {
        timezone: "Europe/Paris",
        weekdays: {
          "1": [["00:00", "23:59"]],
          "2": [["00:00", "23:59"]],
          "3": [["00:00", "23:59"]],
          "4": [["00:00", "23:59"]],
          "5": [["00:00", "23:59"]],
          "6": [["00:00", "23:59"]],
          "0": [["00:00", "23:59"]]
        }
      },
      pauseStatuses: ["WAITING"],
      escalationPolicy: [
        { afterMinutes: 60, priority: "HIGH", status: "IN_PROGRESS" },
        { afterMinutes: 120, priority: "URGENT", status: "IN_PROGRESS" }
      ]
    })
  });
  if (queue.queue.routingStrategy !== "LEAST_OPEN") {
    throw new Error("Queue routing policy was not persisted");
  }

  const subject = `Customer issue ${suffix}`;
  const created = await request<{
    ticket: { id: string; number: string; status: string; portalToken: string };
  }>("/tickets", {
    method: "POST",
    body: JSON.stringify({
      subject,
      description: "The customer cannot complete the workflow.",
      priority: "HIGH",
      source: "WEB",
      queueId: queue.queue.id,
      customerEmail: `customer-${suffix}@example.com`
    })
  });
  if (!created.ticket.number.startsWith("T-")) throw new Error("Ticket number was not generated");
  await prisma.ticket.update({
    where: { id: created.ticket.id },
    data: {
      createdAt: new Date(Date.now() - 3 * 60 * 60_000),
      firstResponseDueAt: new Date(Date.now() - 60_000),
      resolutionDueAt: new Date(Date.now() - 60_000)
    }
  });
  await processTicketSlaPolicies();
  const policyResult = await prisma.ticket.findUniqueOrThrow({
    where: { id: created.ticket.id }
  });
  if (
    !policyResult.slaBreachedAt ||
    policyResult.escalationLevel < 2 ||
    policyResult.priority !== "URGENT"
  ) {
    throw new Error("Automated SLA breach and graduated escalation failed");
  }

  const listed = await request<{ tickets: Array<{ id: string }> }>(
    `/tickets?search=${encodeURIComponent(subject)}`
  );
  if (!listed.tickets.some((ticket) => ticket.id === created.ticket.id)) {
    throw new Error("Created ticket is missing from filtered listing");
  }

  await request(`/tickets/${created.ticket.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: "We are investigating the issue.", public: true })
  });
  const customerEmail = `customer-${suffix}@example.com`;
  const access = await request<{ sent: boolean; devCode?: string }>(
    `/tickets/portal/${created.ticket.portalToken}/request-access`,
    {
      method: "POST",
      body: JSON.stringify({ email: customerEmail })
    }
  );
  if (!access.devCode) {
    throw new Error("Ticket gate requires the development portal access code");
  }
  const session = await request<{ token: string }>(
    `/tickets/portal/${created.ticket.portalToken}/session`,
    {
      method: "POST",
      body: JSON.stringify({ email: customerEmail, code: access.devCode })
    }
  );
  const adminToken = token;
  token = session.token;
  await request(`/tickets/portal/${created.ticket.portalToken}/messages`, {
    method: "POST",
    body: JSON.stringify({
      name: "Customer",
      body: "Thank you, here is another detail."
    })
  });
  token = adminToken;
  const detail = await request<{
    ticket: { messages: unknown[]; events: unknown[]; firstRespondedAt: string | null };
  }>(`/tickets/${created.ticket.id}`);
  if (detail.ticket.messages.length !== 2 || !detail.ticket.firstRespondedAt) {
    throw new Error("Ticket conversation or first response SLA was not persisted");
  }
  if (detail.ticket.events.length < 3) {
    throw new Error("Ticket history is incomplete");
  }

  const escalated = await request<{ ticket: { priority: string; escalatedAt: string | null } }>(
    `/tickets/${created.ticket.id}/escalate`,
    { method: "POST", body: JSON.stringify({}) }
  );
  if (escalated.ticket.priority !== "URGENT" || !escalated.ticket.escalatedAt) {
    throw new Error("Ticket escalation failed");
  }

  const updated = await request<{
    ticket: { status: string; resolvedAt: string | null };
  }>(`/tickets/${created.ticket.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "RESOLVED" })
  });
  if (updated.ticket.status !== "RESOLVED" || !updated.ticket.resolvedAt) {
    throw new Error("Ticket resolution state is invalid");
  }

  const search = await request<{
    results: Array<{ id: string; type: string }>;
  }>(`/search?q=${encodeURIComponent(subject)}`);
  if (!search.results.some((result) => result.type === "ticket" && result.id === created.ticket.id)) {
    throw new Error("Ticket is missing from global search");
  }

  await request(`/tickets/${created.ticket.id}`, { method: "DELETE" });
  console.log(JSON.stringify({
    success: true,
    ticketNumber: created.ticket.number,
    messages: detail.ticket.messages.length,
    escalation: true,
    automaticSla: true,
    portal: true
  }));
}

main()
  .finally(async () => {
    if (organizationId) {
      await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
