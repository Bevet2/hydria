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
      organizationName: `Commercial Gate ${suffix}`,
      firstName: "Commercial",
      lastName: "Admin",
      email: `commercial-${suffix}@example.com`,
      password: "CommercialGate123!"
    })
  });
  token = registration.token;
  organizationId = registration.user.organizationId;

  const targetCompany = await request<{ company: { id: string } }>("/companies", {
    method: "POST",
    body: JSON.stringify({ name: `Commercial Customer ${suffix}`, domain: `customer-${suffix}.example.com` })
  });
  const duplicateCompany = await request<{ company: { id: string } }>("/companies", {
    method: "POST",
    body: JSON.stringify({ name: `Commercial Customer Duplicate ${suffix}`, domain: `customer-${suffix}.example.com` })
  });
  await request("/data/duplicates/companies/merge", {
    method: "POST",
    body: JSON.stringify({ targetId: targetCompany.company.id, sourceIds: [duplicateCompany.company.id] })
  });
  if (await prisma.company.findUnique({ where: { id: duplicateCompany.company.id } })) throw new Error("Company duplicate merge failed");

  const product = await request<{ product: { id: string } }>("/products", {
    method: "POST",
    body: JSON.stringify({ name: "Implementation", sku: `IMPLEMENT-${suffix}`, unitPrice: 500, currency: "EUR", active: true })
  });
  const pipeline = await request<{ stages: Array<{ id: string }> }>("/pipeline");
  const deal = await request<{ deal: { id: string } }>("/pipeline/deals", {
    method: "POST",
    body: JSON.stringify({
      name: `Commercial Deal ${suffix}`,
      companyId: targetCompany.company.id,
      stageId: pipeline.stages[0]!.id,
      value: 0,
      probability: 40,
      currency: "EUR",
      forecastCategory: "PIPELINE"
    })
  });
  await request(`/products/deals/${deal.deal.id}/items`, {
    method: "POST",
    body: JSON.stringify({ productId: product.product.id, quantity: 2, discountPercent: 0 })
  });
  const createdQuote = await request<{ quote: { id: string } }>(`/products/deals/${deal.deal.id}/quotes`, {
    method: "POST",
    body: JSON.stringify({ name: "Initial proposal", discountPercent: 0, taxPercent: 20 })
  });
  const edited = await request<{ quote: { total: number | string; lineItems: unknown[] } }>(`/commercial/quotes/${createdQuote.quote.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: "Negotiated proposal",
      discountPercent: 10,
      taxPercent: 20,
      lineItems: [
        { productId: product.product.id, description: "Implementation", quantity: 2, unitPrice: 500, discountPercent: 0 },
        { description: "Training", quantity: 1, unitPrice: 250, discountPercent: 0 }
      ]
    })
  });
  if (Number(edited.quote.total) !== 1350 || edited.quote.lineItems.length !== 2) {
    throw new Error(`Quote recalculation failed (${edited.quote.total})`);
  }

  const approval = await request<{ approval: { id: string } }>(`/commercial/quotes/${createdQuote.quote.id}/approvals`, {
    method: "POST",
    body: JSON.stringify({ reviewerId: registration.user.id })
  });
  const inbox = await request<{ approvals: Array<{ id: string }> }>("/commercial/approvals/inbox");
  if (!inbox.approvals.some((item) => item.id === approval.approval.id)) throw new Error("Approval inbox is missing the quote");
  await request(`/commercial/approvals/${approval.approval.id}/decision`, {
    method: "POST",
    body: JSON.stringify({ status: "APPROVED", comment: "Commercial gate approval" })
  });
  await request(`/products/quotes/${createdQuote.quote.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "ACCEPTED" })
  });
  const invoice = await request<{ invoice: { id: string } }>(`/commercial/quotes/${createdQuote.quote.id}/invoices`, {
    method: "POST",
    body: JSON.stringify({ dueAt: new Date(Date.now() + 14 * 86_400_000).toISOString() })
  });
  const payment = await request<{ payment: { id: string }; invoice: { status: string } }>(`/commercial/invoices/${invoice.invoice.id}/payments`, {
    method: "POST",
    body: JSON.stringify({ amount: 400, method: "BANK_TRANSFER", reference: "GATE-TRANSFER" })
  });
  if (payment.invoice.status !== "PARTIALLY_PAID") throw new Error("Partial payment did not update invoice status");
  const refund = await request<{ invoice: { status: string } }>(`/commercial/payments/${payment.payment.id}/refunds`, {
    method: "POST",
    body: JSON.stringify({ amount: 100, reason: "Commercial gate adjustment" })
  });
  if (refund.invoice.status !== "PARTIALLY_PAID") throw new Error("Partial refund produced an invalid invoice status");
  const credit = await request<{ invoice: { status: string } }>(`/commercial/invoices/${invoice.invoice.id}/credit-notes`, {
    method: "POST",
    body: JSON.stringify({ amount: 1050, reason: "Commercial gate credit", issue: true })
  });
  if (credit.invoice.status !== "PAID") throw new Error("Issued credit note did not settle the invoice");

  const taskA = await request<{ task: { id: string } }>("/tasks", {
    method: "POST",
    body: JSON.stringify({ title: "Commercial gate task A", status: "TODO", priority: "MEDIUM" })
  });
  const taskB = await request<{ task: { id: string } }>("/tasks", {
    method: "POST",
    body: JSON.stringify({ title: "Commercial gate task B", status: "TODO", priority: "MEDIUM" })
  });
  await request("/data/bulk/tasks", {
    method: "POST",
    body: JSON.stringify({ ids: [taskA.task.id, taskB.task.id], action: "UPDATE_STATUS", status: "DONE" })
  });
  if (await prisma.task.count({ where: { id: { in: [taskA.task.id, taskB.task.id] }, status: "DONE" } }) !== 2) {
    throw new Error("Task bulk update failed");
  }

  await request("/dashboard/preferences", {
    method: "PUT",
    body: JSON.stringify({
      widgets: ["openDeals", "wonDeals", "pipeline"],
      layout: [{ id: "openDeals", position: 0 }, { id: "wonDeals", position: 1 }, { id: "pipeline", position: 2 }]
    })
  });
  const preference = await request<{ preference: { widgets: string[] } }>("/dashboard/preferences");
  if (preference.preference.widgets.join(",") !== "openDeals,wonDeals,pipeline") throw new Error("Dashboard preferences were not persisted");

  console.log(JSON.stringify({
    ok: true,
    quoteEditor: true,
    approvalInbox: true,
    partialPayment: true,
    refund: true,
    creditNote: true,
    companyMerge: true,
    taskBulkAction: true,
    dashboardPreferences: true
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await prisma.$disconnect();
});
