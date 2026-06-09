import crypto from "node:crypto";
import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { recordActivity } from "../services/activity.js";

const router = Router();
const identitySchema = z.object({
  hydriaUserId: z.string().min(1).max(160),
  username: z.string().min(1).max(120)
});
const actionRequestSchema = identitySchema.extend({
  prompt: z.string().max(4000).optional(),
  confirmed: z.boolean().default(false),
  workspaceToolCalls: z.array(z.record(z.string(), z.unknown())).min(1).max(20)
});

const supportedOperations = new Set([
  "crm.create_contact",
  "crm.update_contact",
  "crm.create_company",
  "crm.create_lead",
  "crm.create_task",
  "crm.create_deal",
  "crm.update_deal_stage",
  "crm.update_company",
  "crm.update_lead",
  "crm.update_task",
  "crm.convert_lead",
  "crm.add_product_to_deal",
  "crm.create_quote",
  "crm.update_record",
  "crm.summarize_customer",
  "crm.delete_record"
]);

function assertSignedRequest(req: Request) {
  const timestamp = String(req.headers["x-hydria-timestamp"] || "");
  const supplied = String(req.headers["x-hydria-signature"] || "");
  const timestampMs = Number(timestamp);
  if (!timestamp || !supplied || !Number.isFinite(timestampMs)) {
    throw new HttpError("Hydria integration signature required", 401);
  }
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    throw new HttpError("Hydria integration signature expired", 401);
  }
  const serializedBody = JSON.stringify(req.body ?? {});
  const expected = crypto
    .createHmac("sha256", env.HYDRIA_INTEGRATION_SECRET)
    .update(`${timestamp}.${serializedBody}`)
    .digest("hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw new HttpError("Invalid Hydria integration signature", 401);
  }
}

function splitName(username: string) {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Hydria",
    lastName: parts.slice(1).join(" ") || "User"
  };
}

function publicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  organization: { name: string; slug: string };
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    organizationId: user.organizationId,
    organization: user.organization
  };
}

async function ensureHydriaIdentity(input: z.infer<typeof identitySchema>) {
  const organization = await prisma.organization.upsert({
    where: { slug: "northstar-demo" },
    update: {},
    create: {
      name: "Hydria CRM",
      slug: "northstar-demo",
      pipelineStages: {
        create: [
          { name: "New", position: 0, color: "#667b74" },
          { name: "Qualified", position: 1, color: "#397f9c" },
          { name: "Proposal", position: 2, color: "#a76b2d" },
          { name: "Won", position: 3, color: "#167d68", isWon: true },
          { name: "Lost", position: 4, color: "#9d4b4b", isLost: true }
        ]
      }
    }
  });
  const email = `hydria-${input.hydriaUserId.replace(/[^a-z0-9_-]/gi, "-")}@hydria.local`.toLowerCase();
  const name = splitName(input.username);
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          organizationId: organization.id,
          firstName: name.firstName,
          lastName: name.lastName
        },
        include: { organization: true }
      })
    : await prisma.user.create({
        data: {
          organizationId: organization.id,
          email,
          passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
          emailVerifiedAt: new Date(),
          firstName: name.firstName,
          lastName: name.lastName,
          role: "ADMIN"
        },
        include: { organization: true }
      });
  return user;
}

function sourceForOperation(operation: Record<string, unknown>): Record<string, unknown> {
  const raw =
    operation.raw && typeof operation.raw === "object" && !Array.isArray(operation.raw)
      ? operation.raw as Record<string, unknown>
      : {};
  const target =
    operation.target && typeof operation.target === "object" && !Array.isArray(operation.target)
      ? operation.target as Record<string, unknown>
      : {};
  const rawTarget =
    raw.target && typeof raw.target === "object" && !Array.isArray(raw.target)
      ? raw.target as Record<string, unknown>
      : {};
  return {
    ...raw,
    ...operation,
    target: { ...rawTarget, ...target }
  };
}

function text(source: Record<string, unknown>, key: string, fallback = "") {
  const value = source[key];
  return value === null || value === undefined ? fallback : String(value).trim();
}

function nullableText(source: Record<string, unknown>, key: string) {
  return text(source, key) || null;
}

function numberValue(source: Record<string, unknown>, key: string, fallback = 0) {
  const value = Number(source[key]);
  return Number.isFinite(value) ? value : fallback;
}

async function findOrCreateCompany(organizationId: string, ownerId: string, companyName: string) {
  if (!companyName) return null;
  const existing = await prisma.company.findFirst({
    where: { organizationId, name: { equals: companyName, mode: "insensitive" } }
  });
  return existing || prisma.company.create({
    data: { organizationId, ownerId, name: companyName }
  });
}

async function executeOperation(
  operation: Record<string, unknown>,
  user: Awaited<ReturnType<typeof ensureHydriaIdentity>>,
  confirmed = false
) {
  const source = sourceForOperation(operation);
  const target = source.target as Record<string, unknown>;
  const type = text(source, "type");
  const organizationId = user.organizationId;
  if (!supportedOperations.has(type)) {
    throw new HttpError(`Unsupported CRM operation: ${type || "unknown"}`, 400);
  }

  if (type === "crm.create_company") {
    const name = text(source, "name") || text(source, "title");
    if (!name) throw new HttpError("crm.create_company requires name", 400);
    const company = await prisma.company.create({
      data: {
        organizationId,
        ownerId: user.id,
        name,
        domain: nullableText(source, "domain"),
        industry: nullableText(source, "industry"),
        phone: nullableText(source, "phone"),
        website: nullableText(source, "website"),
        city: nullableText(source, "city"),
        country: nullableText(source, "country")
      }
    });
    await recordActivity({
      organizationId,
      actorId: user.id,
      companyId: company.id,
      type: "RECORD_CREATED",
      subject: `Created company ${company.name} through Hydria Core`
    });
    return { entity: "company", record: company };
  }

  if (type === "crm.create_contact") {
    const firstName = text(source, "firstName");
    const lastName = text(source, "lastName");
    if (!firstName || !lastName) {
      throw new HttpError("crm.create_contact requires firstName and lastName", 400);
    }
    const company = await findOrCreateCompany(
      organizationId,
      user.id,
      text(source, "companyName")
    );
    const contact = await prisma.contact.create({
      data: {
        organizationId,
        ownerId: user.id,
        companyId: company?.id,
        firstName,
        lastName,
        email: nullableText(source, "email"),
        phone: nullableText(source, "phone"),
        jobTitle: nullableText(source, "jobTitle"),
        source: nullableText(source, "source") || "Hydria Core",
        status: text(source, "status", "lead")
      },
      include: { company: true }
    });
    await recordActivity({
      organizationId,
      actorId: user.id,
      contactId: contact.id,
      companyId: company?.id,
      type: "RECORD_CREATED",
      subject: `Created contact ${contact.firstName} ${contact.lastName} through Hydria Core`
    });
    return { entity: "contact", record: contact };
  }

  if (type === "crm.update_contact") {
    const recordId = text(target, "recordId") || text(target, "contactId") || text(source, "contactId");
    const email = text(source, "email");
    const current = await prisma.contact.findFirst({
      where: {
        organizationId,
        ...(recordId ? { id: recordId } : email ? { email } : { id: "__missing__" })
      }
    });
    if (!current) throw new HttpError("CRM contact not found", 404);
    const contact = await prisma.contact.update({
      where: { id: current.id },
      data: {
        firstName: nullableText(source, "firstName") || undefined,
        lastName: nullableText(source, "lastName") || undefined,
        email: source.email !== undefined ? nullableText(source, "email") : undefined,
        phone: source.phone !== undefined ? nullableText(source, "phone") : undefined,
        jobTitle: source.jobTitle !== undefined ? nullableText(source, "jobTitle") : undefined,
        status: nullableText(source, "status") || undefined
      }
    });
    await recordActivity({
      organizationId,
      actorId: user.id,
      contactId: contact.id,
      type: "RECORD_UPDATED",
      subject: `Updated contact ${contact.firstName} ${contact.lastName} through Hydria Core`
    });
    return { entity: "contact", record: contact };
  }

  if (type === "crm.create_lead") {
    const firstName = text(source, "firstName");
    const lastName = text(source, "lastName");
    if (!firstName || !lastName) {
      throw new HttpError("crm.create_lead requires firstName and lastName", 400);
    }
    const lead = await prisma.lead.create({
      data: {
        organizationId,
        ownerId: user.id,
        firstName,
        lastName,
        companyName: nullableText(source, "companyName"),
        email: nullableText(source, "email"),
        phone: nullableText(source, "phone"),
        jobTitle: nullableText(source, "jobTitle"),
        source: nullableText(source, "source") || "Hydria Core",
        description: nullableText(source, "description"),
        status: ["NEW", "WORKING", "QUALIFIED", "UNQUALIFIED"].includes(text(source, "status").toUpperCase())
          ? text(source, "status").toUpperCase() as "NEW" | "WORKING" | "QUALIFIED" | "UNQUALIFIED"
          : "NEW",
        rating: ["HOT", "WARM", "COLD"].includes(text(source, "rating").toUpperCase())
          ? text(source, "rating").toUpperCase() as "HOT" | "WARM" | "COLD"
          : "WARM"
      }
    });
    await recordActivity({
      organizationId,
      actorId: user.id,
      leadId: lead.id,
      type: "RECORD_CREATED",
      subject: `Created lead ${lead.firstName} ${lead.lastName} through Hydria Core`
    });
    return { entity: "lead", record: lead };
  }

  if (type === "crm.update_company") {
    const recordId = text(target, "recordId") || text(source, "companyId");
    const name = text(source, "companyName") || text(source, "name");
    const current = await prisma.company.findFirst({
      where: {
        organizationId,
        ...(recordId ? { id: recordId } : name ? { name: { equals: name, mode: "insensitive" } } : { id: "__missing__" })
      }
    });
    if (!current) throw new HttpError("CRM company not found", 404);
    const company = await prisma.company.update({
      where: { id: current.id },
      data: {
        name: nullableText(source, "newName") || undefined,
        domain: source.domain !== undefined ? nullableText(source, "domain") : undefined,
        industry: source.industry !== undefined ? nullableText(source, "industry") : undefined,
        phone: source.phone !== undefined ? nullableText(source, "phone") : undefined,
        website: source.website !== undefined ? nullableText(source, "website") : undefined,
        city: source.city !== undefined ? nullableText(source, "city") : undefined,
        country: source.country !== undefined ? nullableText(source, "country") : undefined
      }
    });
    return { entity: "company", record: company };
  }

  if (type === "crm.update_lead") {
    const recordId = text(target, "recordId") || text(source, "leadId");
    const email = text(source, "email");
    const current = await prisma.lead.findFirst({
      where: { organizationId, ...(recordId ? { id: recordId } : email ? { email } : { id: "__missing__" }) }
    });
    if (!current) throw new HttpError("CRM lead not found", 404);
    if (current.status === "CONVERTED") throw new HttpError("Converted leads are read-only", 409);
    const requestedStatus = text(source, "status").toUpperCase();
    const requestedRating = text(source, "rating").toUpperCase();
    const lead = await prisma.lead.update({
      where: { id: current.id },
      data: {
        firstName: nullableText(source, "firstName") || undefined,
        lastName: nullableText(source, "lastName") || undefined,
        companyName: source.companyName !== undefined ? nullableText(source, "companyName") : undefined,
        email: source.email !== undefined ? nullableText(source, "email") : undefined,
        phone: source.phone !== undefined ? nullableText(source, "phone") : undefined,
        description: source.description !== undefined ? nullableText(source, "description") : undefined,
        status: ["NEW", "WORKING", "QUALIFIED", "UNQUALIFIED"].includes(requestedStatus)
          ? requestedStatus as "NEW" | "WORKING" | "QUALIFIED" | "UNQUALIFIED"
          : undefined,
        rating: ["HOT", "WARM", "COLD"].includes(requestedRating)
          ? requestedRating as "HOT" | "WARM" | "COLD"
          : undefined
      }
    });
    return { entity: "lead", record: lead };
  }

  if (type === "crm.create_task") {
    const title = text(source, "title") || text(source, "name") || text(source, "value");
    if (!title) throw new HttpError("crm.create_task requires title", 400);
    const priority = text(source, "priority").toUpperCase();
    const status = text(source, "status").toUpperCase();
    const dueAt = text(source, "dueAt");
    const task = await prisma.task.create({
      data: {
        organizationId,
        createdById: user.id,
        assignedToId: user.id,
        title,
        description: nullableText(source, "description"),
        priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)
          ? priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT"
          : "MEDIUM",
        status: ["TODO", "IN_PROGRESS", "DONE", "CANCELED"].includes(status)
          ? status as "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED"
          : "TODO",
        dueAt: dueAt ? new Date(dueAt) : null
      }
    });
    await recordActivity({
      organizationId,
      actorId: user.id,
      type: "TASK",
      subject: `Created task ${task.title} through Hydria Core`
    });
    return { entity: "task", record: task };
  }

  if (type === "crm.update_task") {
    const recordId = text(target, "recordId") || text(source, "taskId");
    const current = await prisma.task.findFirst({ where: { id: recordId, organizationId } });
    if (!current) throw new HttpError("CRM task not found", 404);
    const status = text(source, "status").toUpperCase();
    const priority = text(source, "priority").toUpperCase();
    const dueAt = text(source, "dueAt");
    const task = await prisma.task.update({
      where: { id: current.id },
      data: {
        title: nullableText(source, "title") || undefined,
        description: source.description !== undefined ? nullableText(source, "description") : undefined,
        status: ["TODO", "IN_PROGRESS", "DONE", "CANCELED"].includes(status)
          ? status as "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED"
          : undefined,
        priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)
          ? priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT"
          : undefined,
        dueAt: source.dueAt !== undefined ? dueAt ? new Date(dueAt) : null : undefined,
        completedAt: status === "DONE" ? new Date() : status ? null : undefined
      }
    });
    return { entity: "task", record: task };
  }

  if (type === "crm.create_deal") {
    const name = text(source, "name") || text(source, "title");
    if (!name) throw new HttpError("crm.create_deal requires name", 400);
    const requestedStage = text(source, "stageName");
    const stage = await prisma.pipelineStage.findFirst({
      where: {
        organizationId,
        ...(requestedStage
          ? { name: { equals: requestedStage, mode: "insensitive" } }
          : { isWon: false, isLost: false })
      },
      orderBy: { position: "asc" }
    });
    if (!stage) throw new HttpError("CRM pipeline stage not found", 404);
    const company = await findOrCreateCompany(
      organizationId,
      user.id,
      text(source, "companyName")
    );
    const deal = await prisma.deal.create({
      data: {
        organizationId,
        ownerId: user.id,
        companyId: company?.id,
        stageId: stage.id,
        name,
        value: Math.max(0, numberValue(source, "value")),
        currency: text(source, "currency", "EUR").slice(0, 3).toUpperCase(),
        probability: Math.max(0, Math.min(100, numberValue(source, "probability", 20))),
        description: nullableText(source, "description"),
        nextStep: nullableText(source, "nextStep")
      },
      include: { company: true, stage: true }
    });
    await recordActivity({
      organizationId,
      actorId: user.id,
      dealId: deal.id,
      companyId: company?.id,
      type: "RECORD_CREATED",
      subject: `Created deal ${deal.name} through Hydria Core`
    });
    return { entity: "deal", record: deal };
  }

  if (type === "crm.convert_lead") {
    const recordId = text(target, "recordId") || text(source, "leadId");
    const email = text(source, "email");
    const lead = await prisma.lead.findFirst({
      where: { organizationId, ...(recordId ? { id: recordId } : email ? { email } : { id: "__missing__" }) }
    });
    if (!lead) throw new HttpError("CRM lead not found", 404);
    if (lead.status === "CONVERTED") throw new HttpError("Lead is already converted", 409);
    const converted = await prisma.$transaction(async (tx) => {
      const company = lead.companyName ? await tx.company.create({
        data: { organizationId, ownerId: lead.ownerId || user.id, name: lead.companyName, website: lead.website }
      }) : null;
      const contact = await tx.contact.create({
        data: {
          organizationId, ownerId: lead.ownerId || user.id, companyId: company?.id,
          firstName: lead.firstName, lastName: lead.lastName, email: lead.email,
          phone: lead.phone, jobTitle: lead.jobTitle, source: lead.source, status: "qualified"
        }
      });
      const stage = await tx.pipelineStage.findFirst({ where: { organizationId, isWon: false, isLost: false }, orderBy: { position: "asc" } });
      const createDeal = source.createDeal !== false;
      const deal = createDeal && stage ? await tx.deal.create({
        data: {
          organizationId, ownerId: lead.ownerId || user.id, companyId: company?.id,
          primaryContactId: contact.id, stageId: stage.id,
          name: text(source, "dealName", `${lead.companyName || lead.lastName} opportunity`),
          value: numberValue(source, "dealValue")
        }
      }) : null;
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: "CONVERTED", convertedAt: new Date(), convertedCompanyId: company?.id,
          convertedContactId: contact.id, convertedDealId: deal?.id
        }
      });
      return { company, contact, deal };
    });
    return { entity: "lead_conversion", record: converted };
  }

  if (type === "crm.add_product_to_deal") {
    const dealId = text(target, "recordId") || text(target, "dealId") || text(source, "dealId");
    const dealName = text(source, "dealName");
    const sku = text(source, "sku").toUpperCase();
    const productName = text(source, "productName");
    const [deal, product] = await Promise.all([
      prisma.deal.findFirst({ where: { organizationId, ...(dealId ? { id: dealId } : { name: { equals: dealName, mode: "insensitive" } }) } }),
      prisma.product.findFirst({ where: { organizationId, active: true, ...(sku ? { sku } : { name: { equals: productName, mode: "insensitive" } }) } })
    ]);
    if (!deal) throw new HttpError("CRM deal not found", 404);
    if (!product) throw new HttpError("CRM product not found", 404);
    const quantity = Math.max(0.01, numberValue(source, "quantity", 1));
    const unitPrice = source.unitPrice !== undefined ? numberValue(source, "unitPrice") : Number(product.unitPrice);
    const discountPercent = Math.max(0, Math.min(100, numberValue(source, "discountPercent")));
    const lineTotal = Math.round(quantity * unitPrice * (1 - discountPercent / 100) * 100) / 100;
    const item = await prisma.dealLineItem.upsert({
      where: { dealId_productId: { dealId: deal.id, productId: product.id } },
      create: { organizationId, dealId: deal.id, productId: product.id, quantity, unitPrice, discountPercent, lineTotal },
      update: { quantity, unitPrice, discountPercent, lineTotal }
    });
    const total = await prisma.dealLineItem.aggregate({ where: { dealId: deal.id }, _sum: { lineTotal: true } });
    await prisma.deal.update({ where: { id: deal.id }, data: { value: Number(total._sum.lineTotal || 0) } });
    return { entity: "deal_line_item", record: item };
  }

  if (type === "crm.create_quote") {
    const dealId = text(target, "recordId") || text(target, "dealId") || text(source, "dealId");
    const dealName = text(source, "dealName");
    const deal = await prisma.deal.findFirst({
      where: { organizationId, ...(dealId ? { id: dealId } : { name: { equals: dealName, mode: "insensitive" } }) },
      include: { lineItems: { include: { product: true } } }
    });
    if (!deal) throw new HttpError("CRM deal not found", 404);
    if (!deal.lineItems.length) throw new HttpError("Add products to the deal before creating a quote", 409);
    const subtotal = deal.lineItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
    const discountPercent = Math.max(0, Math.min(100, numberValue(source, "discountPercent")));
    const taxPercent = Math.max(0, Math.min(100, numberValue(source, "taxPercent")));
    const total = Math.round(subtotal * (1 - discountPercent / 100) * (1 + taxPercent / 100) * 100) / 100;
    const quote = await prisma.quote.create({
      data: {
        organizationId, ownerId: user.id, dealId: deal.id, companyId: deal.companyId,
        contactId: deal.primaryContactId,
        number: `${new Date().getFullYear()}-${String((await prisma.quote.count({ where: { organizationId } })) + 1).padStart(5, "0")}`,
        name: text(source, "name", `${deal.name} proposal`),
        subtotal, discountPercent, taxPercent, total, notes: nullableText(source, "notes"),
        validUntil: text(source, "validUntil") ? new Date(text(source, "validUntil")) : null,
        lineItems: { create: deal.lineItems.map((item) => ({
          organizationId, productId: item.productId, description: item.product.name,
          quantity: item.quantity, unitPrice: item.unitPrice, discountPercent: item.discountPercent,
          lineTotal: item.lineTotal
        })) }
      },
      include: { lineItems: true }
    });
    return { entity: "quote", record: quote };
  }

  if (type === "crm.summarize_customer") {
    const companyId = text(target, "recordId") || text(source, "companyId");
    const name = text(source, "companyName");
    const company = await prisma.company.findFirst({
      where: { organizationId, ...(companyId ? { id: companyId } : { name: { equals: name, mode: "insensitive" } }) },
      include: {
        contacts: true,
        deals: { include: { stage: true } },
        tasks: { where: { status: { in: ["TODO", "IN_PROGRESS"] } }, orderBy: { dueAt: "asc" } },
        activities: { orderBy: { occurredAt: "desc" }, take: 10 }
      }
    });
    if (!company) throw new HttpError("CRM company not found", 404);
    const openValue = company.deals.filter((deal) => deal.status === "OPEN").reduce((sum, deal) => sum + Number(deal.value), 0);
    return {
      entity: "customer_summary",
      record: {
        company: { id: company.id, name: company.name, industry: company.industry },
        contacts: company.contacts,
        deals: company.deals,
        openTasks: company.tasks,
        recentActivities: company.activities,
        openPipelineValue: openValue,
        suggestedFollowUp: company.tasks[0]?.title || company.deals.find((deal) => deal.status === "OPEN")?.nextStep || "Schedule a customer check-in"
      }
    };
  }

  if (type === "crm.update_record") {
    const entity = text(source, "entity").toLowerCase();
    const recordId = text(target, "recordId") || text(source, "recordId");
    const fields = source.fields && typeof source.fields === "object" && !Array.isArray(source.fields)
      ? source.fields as Record<string, unknown>
      : {};
    const allowed: Record<string, string[]> = {
      contact: ["firstName", "lastName", "email", "phone", "jobTitle", "status", "source"],
      company: ["name", "domain", "industry", "size", "phone", "website", "address", "city", "country"],
      lead: ["firstName", "lastName", "companyName", "email", "phone", "jobTitle", "source", "status", "rating", "description"],
      deal: ["name", "value", "currency", "probability", "forecastCategory", "description", "nextStep", "expectedCloseAt"],
      task: ["title", "description", "status", "priority", "dueAt"]
    };
    if (!allowed[entity]) throw new HttpError("Unsupported CRM entity", 400);
    const data = Object.fromEntries(Object.entries(fields).filter(([key]) => allowed[entity]!.includes(key)));
    if (!Object.keys(data).length) throw new HttpError("No supported properties to update", 400);
    const exists = entity === "contact" ? await prisma.contact.findFirst({ where: { id: recordId, organizationId } })
      : entity === "company" ? await prisma.company.findFirst({ where: { id: recordId, organizationId } })
      : entity === "lead" ? await prisma.lead.findFirst({ where: { id: recordId, organizationId } })
      : entity === "deal" ? await prisma.deal.findFirst({ where: { id: recordId, organizationId } })
      : await prisma.task.findFirst({ where: { id: recordId, organizationId } });
    if (!exists) throw new HttpError("CRM record not found", 404);
    const record = entity === "contact" ? await prisma.contact.update({ where: { id: recordId }, data })
      : entity === "company" ? await prisma.company.update({ where: { id: recordId }, data })
      : entity === "lead" ? await prisma.lead.update({ where: { id: recordId }, data })
      : entity === "deal" ? await prisma.deal.update({ where: { id: recordId }, data })
      : await prisma.task.update({ where: { id: recordId }, data });
    return { entity, record };
  }

  if (type === "crm.delete_record") {
    if (!confirmed) throw new HttpError("CRM deletion requires explicit confirmation", 409);
    const entity = text(source, "entity").toLowerCase();
    const recordId = text(target, "recordId") || text(source, "recordId");
    const deleted = entity === "contact" ? await prisma.contact.deleteMany({ where: { id: recordId, organizationId } })
      : entity === "company" ? await prisma.company.deleteMany({ where: { id: recordId, organizationId } })
      : entity === "lead" ? await prisma.lead.deleteMany({ where: { id: recordId, organizationId } })
      : entity === "deal" ? await prisma.deal.deleteMany({ where: { id: recordId, organizationId } })
      : entity === "task" ? await prisma.task.deleteMany({ where: { id: recordId, organizationId } })
      : { count: 0 };
    if (!deleted.count) throw new HttpError("CRM record not found", 404);
    return { entity, record: { id: recordId, deleted: true } };
  }

  const recordId = text(target, "recordId") || text(target, "dealId") || text(source, "dealId");
  const dealName = text(source, "dealName") || text(source, "name");
  const stageName = text(source, "stageName") || text(source, "status");
  const current = await prisma.deal.findFirst({
    where: {
      organizationId,
      ...(recordId
        ? { id: recordId }
        : dealName
          ? { name: { equals: dealName, mode: "insensitive" } }
          : { id: "__missing__" })
    }
  });
  if (!current) throw new HttpError("CRM deal not found", 404);
  const stage = await prisma.pipelineStage.findFirst({
    where: { organizationId, name: { equals: stageName, mode: "insensitive" } }
  });
  if (!stage) throw new HttpError(`CRM pipeline stage not found: ${stageName}`, 404);
  const deal = await prisma.deal.update({
    where: { id: current.id },
    data: {
      stageId: stage.id,
      status: stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN",
      forecastCategory: stage.isWon ? "CLOSED" : stage.isLost ? "OMITTED" : current.forecastCategory
    },
    include: { stage: true, company: true }
  });
  await recordActivity({
    organizationId,
    actorId: user.id,
    dealId: deal.id,
    companyId: deal.companyId || undefined,
    type: "DEAL_STAGE_CHANGED",
    subject: `Moved ${deal.name} to ${stage.name} through Hydria Core`
  });
  return { entity: "deal", record: deal };
}

router.use((req, _res, next) => {
  try {
    assertSignedRequest(req);
    next();
  } catch (error) {
    next(error);
  }
});

router.post(
  "/session",
  asyncRoute(async (req, res) => {
    const input = parseBody(identitySchema, req.body);
    const user = await ensureHydriaIdentity(input);
    const token = signAccessToken({
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email
    });
    res.json({ token, user: publicUser(user) });
  })
);

router.post(
  "/context",
  asyncRoute(async (req, res) => {
    const input = parseBody(identitySchema, req.body);
    const user = await ensureHydriaIdentity(input);
    const organizationId = user.organizationId;
    const [counts, stages, recentContacts, recentCompanies, recentDeals, openTasks] = await Promise.all([
      Promise.all([
        prisma.contact.count({ where: { organizationId } }),
        prisma.company.count({ where: { organizationId } }),
        prisma.lead.count({ where: { organizationId, status: { not: "CONVERTED" } } }),
        prisma.deal.count({ where: { organizationId, status: "OPEN" } }),
        prisma.task.count({ where: { organizationId, status: { in: ["TODO", "IN_PROGRESS"] } } })
      ]),
      prisma.pipelineStage.findMany({
        where: { organizationId },
        orderBy: { position: "asc" },
        select: { id: true, name: true, position: true, isWon: true, isLost: true }
      }),
      prisma.contact.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { id: true, firstName: true, lastName: true, email: true }
      }),
      prisma.company.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { id: true, name: true, industry: true }
      }),
      prisma.deal.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          value: true,
          currency: true,
          stage: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } }
        }
      }),
      prisma.task.findMany({
        where: { organizationId, status: { in: ["TODO", "IN_PROGRESS"] } },
        orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
        take: 12,
        select: { id: true, title: true, status: true, priority: true, dueAt: true }
      })
    ]);
    const [recentLeads, products, quotes] = await Promise.all([
      prisma.lead.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { id: true, firstName: true, lastName: true, companyName: true, email: true, status: true, rating: true }
      }),
      prisma.product.findMany({
        where: { organizationId, active: true },
        orderBy: { name: "asc" },
        take: 30,
        select: { id: true, name: true, sku: true, unitPrice: true, currency: true }
      }),
      prisma.quote.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { id: true, number: true, name: true, status: true, total: true, dealId: true }
      })
    ]);
    res.json({
      context: {
        kind: "hydria-crm",
        organization: user.organization,
        counts: {
          contacts: counts[0],
          companies: counts[1],
          activeLeads: counts[2],
          openDeals: counts[3],
          openTasks: counts[4]
        },
        pipelineStages: stages,
        recentContacts,
        recentCompanies,
        recentLeads,
        recentDeals,
        openTasks,
        products,
        quotes
      }
    });
  })
);

router.post(
  "/query",
  asyncRoute(async (req, res) => {
    const input = parseBody(identitySchema.extend({
      resource: z.enum(["contacts", "companies", "leads", "deals", "tasks", "products", "quotes"]),
      search: z.string().max(300).default(""),
      recordId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25)
    }), req.body);
    const user = await ensureHydriaIdentity(input);
    const organizationId = user.organizationId;
    const search = input.search.trim();
    let records: unknown[];
    if (input.resource === "contacts") records = await prisma.contact.findMany({
      where: { organizationId, ...(input.recordId ? { id: input.recordId } : search ? { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}) },
      take: input.limit, include: { company: true, primaryDeals: { include: { stage: true } }, tasks: true }
    });
    else if (input.resource === "companies") records = await prisma.company.findMany({
      where: { organizationId, ...(input.recordId ? { id: input.recordId } : search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { domain: { contains: search, mode: "insensitive" } }] } : {}) },
      take: input.limit, include: { contacts: true, deals: { include: { stage: true } }, tasks: true }
    });
    else if (input.resource === "leads") records = await prisma.lead.findMany({
      where: { organizationId, ...(input.recordId ? { id: input.recordId } : search ? { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { companyName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}) },
      take: input.limit, include: { tasks: true, activities: { orderBy: { occurredAt: "desc" }, take: 20 } }
    });
    else if (input.resource === "deals") records = await prisma.deal.findMany({
      where: { organizationId, ...(input.recordId ? { id: input.recordId } : search ? { name: { contains: search, mode: "insensitive" } } : {}) },
      take: input.limit, include: { stage: true, company: true, primaryContact: true, lineItems: { include: { product: true } }, quotes: true, tasks: true }
    });
    else if (input.resource === "tasks") records = await prisma.task.findMany({
      where: { organizationId, ...(input.recordId ? { id: input.recordId } : search ? { title: { contains: search, mode: "insensitive" } } : {}) },
      take: input.limit, include: { assignedTo: true, contact: true, company: true, deal: true, lead: true }
    });
    else if (input.resource === "products") records = await prisma.product.findMany({
      where: { organizationId, ...(input.recordId ? { id: input.recordId } : search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] } : {}) },
      take: input.limit
    });
    else records = await prisma.quote.findMany({
      where: { organizationId, ...(input.recordId ? { id: input.recordId } : search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { number: { contains: search, mode: "insensitive" } }] } : {}) },
      take: input.limit, include: { deal: true, company: true, contact: true, lineItems: true, approvals: true, signatures: true, invoices: true }
    });
    res.json({ resource: input.resource, records });
  })
);

router.post(
  "/actions",
  asyncRoute(async (req, res) => {
    const input = parseBody(actionRequestSchema, req.body);
    const user = await ensureHydriaIdentity(input);
    const results: Array<Record<string, unknown>> = [];
    for (const call of input.workspaceToolCalls) {
      const payload =
        call.payload && typeof call.payload === "object" && !Array.isArray(call.payload)
          ? call.payload as Record<string, unknown>
          : call;
      const operations = Array.isArray(payload.operations) ? payload.operations : [];
      if ((call.requiresConfirmation || payload.requiresConfirmation) && !input.confirmed) {
        results.push({
          type: "workspace_tool_call",
          status: "needs_confirmation",
          toolName: String(payload.toolName || ""),
          operationsApplied: [],
          issues: ["CRM action requires confirmation before execution."]
        });
        continue;
      }
      for (const rawOperation of operations) {
        try {
          const operation =
            rawOperation && typeof rawOperation === "object" && !Array.isArray(rawOperation)
              ? rawOperation as Record<string, unknown>
              : {};
          const result = await executeOperation(operation, user, input.confirmed);
          results.push({
            type: "workspace_tool_call",
            status: "completed",
            engine: "crm",
            toolName: String(payload.toolName || operation.type || ""),
            operationsApplied: [String(operation.type || "")],
            issues: [],
            ...result,
            finalAnswer: `CRM updated: ${result.entity} saved.`
          });
        } catch (error) {
          results.push({
            type: "workspace_tool_call",
            status: "failed",
            engine: "crm",
            toolName: String(payload.toolName || ""),
            operationsApplied: [],
            issues: [error instanceof Error ? error.message : "CRM operation failed"]
          });
        }
      }
    }
    res.json({ results });
  })
);

export default router;
