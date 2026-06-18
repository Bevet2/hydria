import crypto from "node:crypto";
import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { recordActivity } from "../services/activity.js";
import { routeTicketOwner, ticketDeadlines } from "../services/supportSla.js";

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
  "crm.create_ticket",
  "crm.create_deal",
  "crm.update_deal_stage",
  "crm.update_company",
  "crm.update_lead",
  "crm.update_task",
  "crm.update_ticket",
  "crm.convert_lead",
  "crm.add_product_to_deal",
  "crm.create_quote",
  "crm.update_record",
  "crm.summarize_customer",
  "crm.get_account_health",
  "crm.list_at_risk_accounts",
  "crm.delete_record",
  "crm.add_activity",
  "crm.log_call",
  "crm.merge_records",
  "crm.update_custom_field",
  "crm.assign_owner"
]);

const customEntityTypes = ["CONTACT", "COMPANY", "DEAL", "LEAD"] as const;
const customFieldTypes = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "MULTI_SELECT"] as const;

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
    update: { name: "Hydria CRM" },
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
  await prisma.supportQueue.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Support" } },
    update: { active: true },
    create: {
      organizationId: organization.id,
      name: "Support",
      description: "Default queue for customer requests created by Hydria.",
      firstResponseMinutes: 240,
      resolutionMinutes: 1440,
      escalationAfterMinutes: 720,
      routingStrategy: "LEAST_OPEN",
      active: true
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

type CustomEntityType = (typeof customEntityTypes)[number];
type CustomFieldType = (typeof customFieldTypes)[number];

function arrayText(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function targetText(source: Record<string, unknown>, key: string, fallback = "") {
  const target =
    source.target && typeof source.target === "object" && !Array.isArray(source.target)
      ? source.target as Record<string, unknown>
      : {};
  return text(target, key) || text(source, key, fallback);
}

function normalizeEntityName(value = "") {
  const normalized = value.trim().toLowerCase().replace(/s$/, "");
  if (normalized === "contact") return "contact";
  if (normalized === "company" || normalized === "entreprise" || normalized === "societe") return "company";
  if (normalized === "deal" || normalized === "opportunity" || normalized === "opportunite") return "deal";
  if (normalized === "lead" || normalized === "prospect") return "lead";
  if (normalized === "task" || normalized === "tache") return "task";
  if (normalized === "ticket") return "ticket";
  return "";
}

function customEntityType(source: Record<string, unknown>): CustomEntityType {
  const entity = normalizeEntityName(
    targetText(source, "entity") ||
    targetText(source, "recordType") ||
    targetText(source, "resource")
  );
  const type = entity === "contact" ? "CONTACT"
    : entity === "company" ? "COMPANY"
      : entity === "deal" ? "DEAL"
        : entity === "lead" ? "LEAD"
          : "";
  if (!customEntityTypes.includes(type as CustomEntityType)) {
    throw new HttpError("CRM custom fields are available for contacts, companies, deals and leads", 400);
  }
  return type as CustomEntityType;
}

async function recordRelationIds(organizationId: string, source: Record<string, unknown>) {
  const entity = normalizeEntityName(
    targetText(source, "entity") ||
    targetText(source, "recordType") ||
    targetText(source, "resource")
  );
  const recordId = targetText(source, "recordId") || targetText(source, "id");
  const relationIds = {
    contactId: text(source, "contactId"),
    companyId: text(source, "companyId"),
    dealId: text(source, "dealId"),
    leadId: text(source, "leadId")
  };
  if (recordId && entity === "contact") relationIds.contactId = recordId;
  if (recordId && entity === "company") relationIds.companyId = recordId;
  if (recordId && entity === "deal") relationIds.dealId = recordId;
  if (recordId && entity === "lead") relationIds.leadId = recordId;

  const checks = await Promise.all([
    relationIds.contactId
      ? prisma.contact.findFirst({ where: { id: relationIds.contactId, organizationId }, select: { id: true } })
      : null,
    relationIds.companyId
      ? prisma.company.findFirst({ where: { id: relationIds.companyId, organizationId }, select: { id: true } })
      : null,
    relationIds.dealId
      ? prisma.deal.findFirst({ where: { id: relationIds.dealId, organizationId }, select: { id: true } })
      : null,
    relationIds.leadId
      ? prisma.lead.findFirst({ where: { id: relationIds.leadId, organizationId }, select: { id: true } })
      : null
  ]);
  if (relationIds.contactId && !checks[0]) throw new HttpError("CRM contact not found", 404);
  if (relationIds.companyId && !checks[1]) throw new HttpError("CRM company not found", 404);
  if (relationIds.dealId && !checks[2]) throw new HttpError("CRM deal not found", 404);
  if (relationIds.leadId && !checks[3]) throw new HttpError("CRM lead not found", 404);
  return {
    contactId: relationIds.contactId || undefined,
    companyId: relationIds.companyId || undefined,
    dealId: relationIds.dealId || undefined,
    leadId: relationIds.leadId || undefined
  };
}

async function assertEntityInOrganization(organizationId: string, entityType: CustomEntityType, entityId: string) {
  const exists = entityType === "CONTACT"
    ? await prisma.contact.findFirst({ where: { id: entityId, organizationId }, select: { id: true } })
    : entityType === "COMPANY"
      ? await prisma.company.findFirst({ where: { id: entityId, organizationId }, select: { id: true } })
      : entityType === "DEAL"
        ? await prisma.deal.findFirst({ where: { id: entityId, organizationId }, select: { id: true } })
        : await prisma.lead.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
  if (!exists) throw new HttpError("CRM record not found", 404);
}

function normalizeFieldKey(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function normalizeHydriaCustomFieldValue(
  definition: { fieldType: CustomFieldType; required: boolean; options: unknown },
  rawValue: unknown
): Prisma.InputJsonValue | null {
  if (
    rawValue === null ||
    rawValue === undefined ||
    rawValue === "" ||
    (Array.isArray(rawValue) && rawValue.length === 0)
  ) {
    if (definition.required) throw new HttpError("This custom field is required", 400);
    return null;
  }
  if (definition.fieldType === "TEXT") return z.string().max(4000).parse(String(rawValue));
  if (definition.fieldType === "NUMBER") return z.coerce.number().parse(rawValue);
  if (definition.fieldType === "DATE") return z.string().date().parse(String(rawValue));
  if (definition.fieldType === "BOOLEAN") {
    if (typeof rawValue === "boolean") return rawValue;
    const value = String(rawValue).trim().toLowerCase();
    if (["true", "1", "yes", "oui"].includes(value)) return true;
    if (["false", "0", "no", "non"].includes(value)) return false;
    throw new HttpError("Custom field value must be a boolean", 400);
  }
  const options = Array.isArray(definition.options)
    ? definition.options.filter((option): option is string => typeof option === "string")
    : [];
  if (definition.fieldType === "SELECT") {
    const value = z.string().parse(rawValue);
    if (options.length && !options.includes(value)) throw new HttpError("Custom field value is not an allowed option", 400);
    return value;
  }
  const values = Array.isArray(rawValue) ? rawValue.map(String) : String(rawValue).split(",").map((item) => item.trim());
  if (options.length && values.some((value) => !options.includes(value))) {
    throw new HttpError("Custom field value contains an invalid option", 400);
  }
  return values.filter(Boolean);
}

async function mergeCustomFieldValues(
  tx: Prisma.TransactionClient,
  organizationId: string,
  entityType: CustomEntityType,
  targetId: string,
  sourceIds: string[]
) {
  const [existingTargetValues, sourceValues] = await Promise.all([
    tx.customFieldValue.findMany({
      where: { organizationId, entityId: targetId, definition: { entityType } },
      select: { definitionId: true }
    }),
    tx.customFieldValue.findMany({
      where: { organizationId, entityId: { in: sourceIds }, definition: { entityType } }
    })
  ]);
  const occupiedDefinitionIds = new Set(existingTargetValues.map((value) => value.definitionId));
  for (const value of sourceValues) {
    if (occupiedDefinitionIds.has(value.definitionId)) {
      await tx.customFieldValue.delete({ where: { id: value.id } });
    } else {
      await tx.customFieldValue.update({ where: { id: value.id }, data: { entityId: targetId } });
      occupiedDefinitionIds.add(value.definitionId);
    }
  }
}

async function accountHealthSnapshot(organizationId: string, input: { companyId?: string; companyName?: string }) {
  if (!input.companyId && !input.companyName) {
    throw new HttpError("crm.get_account_health requires companyId or companyName", 400);
  }
  const company = await prisma.company.findFirst({
    where: {
      organizationId,
      ...(input.companyId
        ? { id: input.companyId }
        : { name: { equals: input.companyName, mode: "insensitive" as const } })
    },
    include: {
      contacts: true,
      deals: { include: { stage: true }, orderBy: { updatedAt: "desc" } },
      tasks: { orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }] },
      tickets: {
        orderBy: { updatedAt: "desc" },
        take: 12,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          queue: { select: { id: true, name: true } }
        }
      },
      activities: { orderBy: { occurredAt: "desc" }, take: 10 }
    }
  });
  if (!company) throw new HttpError("CRM company not found", 404);
  const now = new Date();
  const openDeals = company.deals.filter((deal) => deal.status === "OPEN");
  const wonDeals = company.deals.filter((deal) => deal.status === "WON");
  const openTasks = company.tasks.filter((task) => ["TODO", "IN_PROGRESS"].includes(task.status));
  const overdueTasks = openTasks.filter((task) => task.dueAt && task.dueAt < now);
  const openTickets = company.tickets.filter((ticket) => ["OPEN", "IN_PROGRESS", "WAITING"].includes(ticket.status));
  const overdueTickets = openTickets.filter((ticket) => ticket.resolutionDueAt && ticket.resolutionDueAt < now);
  const lastActivityAt = company.activities[0]?.occurredAt || company.updatedAt;
  const daysSinceLastActivity = Math.max(
    0,
    Math.floor((now.getTime() - new Date(lastActivityAt).getTime()) / 86_400_000)
  );
  const openDealsValue = openDeals.reduce((sum, deal) => sum + Number(deal.value), 0);
  const wonDealsValue = wonDeals.reduce((sum, deal) => sum + Number(deal.value), 0);
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        overdueTickets.length * 18 -
        overdueTasks.length * 10 -
        Math.max(0, openTickets.length - 2) * 4 -
        (daysSinceLastActivity > 30 ? 12 : 0) -
        (openDeals.length === 0 ? 8 : 0) -
        (company.contacts.length === 0 ? 12 : 0)
    )
  );
  const nextBestActions: Array<{ title: string; detail: string; severity: "critical" | "warning" | "opportunity" | "info" }> = [];
  if (overdueTickets.length) nextBestActions.push({ title: "Resolve overdue support tickets", detail: `${overdueTickets.length} ticket${overdueTickets.length > 1 ? "s are" : " is"} past SLA.`, severity: "critical" });
  if (overdueTasks.length) nextBestActions.push({ title: "Close overdue account tasks", detail: `${overdueTasks.length} task${overdueTasks.length > 1 ? "s need" : " needs"} follow-up.`, severity: "warning" });
  if (!openDeals.length) nextBestActions.push({ title: "Create or qualify the next opportunity", detail: "There is no open pipeline attached to this account.", severity: "opportunity" });
  if (daysSinceLastActivity > 30) nextBestActions.push({ title: "Schedule an account touchpoint", detail: `No activity has been logged for ${daysSinceLastActivity} days.`, severity: "warning" });
  if (!company.contacts.length) nextBestActions.push({ title: "Add a buying committee contact", detail: "The account has no known contacts yet.", severity: "info" });
  if (!nextBestActions.length) nextBestActions.push({ title: "Keep the account warm", detail: "Review open work and prepare the next customer check-in.", severity: "info" });
  return {
    company: { id: company.id, name: company.name, industry: company.industry, domain: company.domain },
    contacts: company.contacts,
    deals: company.deals,
    openTasks,
    openTickets,
    recentActivities: company.activities,
    health: {
      score: healthScore,
      label: healthScore >= 80 ? "Healthy" : healthScore >= 55 ? "Watch" : "At risk",
      contactsCount: company.contacts.length,
      openDealsCount: openDeals.length,
      openDealsValue,
      wonDealsCount: wonDeals.length,
      wonDealsValue,
      openTasksCount: openTasks.length,
      overdueTasksCount: overdueTasks.length,
      openTicketsCount: openTickets.length,
      overdueTicketsCount: overdueTickets.length,
      lastActivityAt,
      daysSinceLastActivity
    },
    nextBestActions: nextBestActions.slice(0, 4),
    suggestedFollowUp: nextBestActions[0]?.title || "Schedule a customer check-in"
  };
}

async function resolveUserInOrganization(organizationId: string, source: Record<string, unknown>) {
  const userId = targetText(source, "ownerId") || targetText(source, "assignedToId") || targetText(source, "userId");
  const email = targetText(source, "ownerEmail") || targetText(source, "assigneeEmail") || targetText(source, "email");
  const name = targetText(source, "ownerName") || targetText(source, "assigneeName") || targetText(source, "userName");
  const user = userId
    ? await prisma.user.findFirst({ where: { id: userId, organizationId } })
    : email
      ? await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, organizationId } })
      : name
        ? await prisma.user.findFirst({
            where: {
              organizationId,
              OR: [
                { firstName: { contains: name, mode: "insensitive" } },
                { lastName: { contains: name, mode: "insensitive" } },
                { email: { contains: name, mode: "insensitive" } }
              ]
            }
          })
        : null;
  if (!user) throw new HttpError("CRM user not found for assignment", 404);
  return user;
}

async function companyForOperation(organizationId: string, ownerId: string, source: Record<string, unknown>) {
  const targetEntity = normalizeEntityName(
    targetText(source, "entity") ||
    targetText(source, "recordType") ||
    targetText(source, "resource")
  );
  const companyId = targetText(source, "companyId") || (targetEntity === "company" ? targetText(source, "recordId") : "");
  if (companyId) {
    const company = await prisma.company.findFirst({ where: { id: companyId, organizationId } });
    if (!company) throw new HttpError("CRM company not found", 404);
    return company;
  }
  return findOrCreateCompany(organizationId, ownerId, text(source, "companyName"));
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

  if (type === "crm.list_at_risk_accounts") {
    const limit = Math.max(1, Math.min(50, numberValue(source, "limit", 10)));
    const threshold = Math.max(0, Math.min(100, numberValue(source, "threshold", 79)));
    const companies = await prisma.company.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: Math.max(limit * 3, limit),
      select: { id: true }
    });
    const snapshots = await Promise.all(
      companies.map((company) => accountHealthSnapshot(organizationId, { companyId: company.id }))
    );
    const records = snapshots
      .filter((snapshot) => snapshot.health.score <= threshold || snapshot.health.overdueTicketsCount > 0 || snapshot.health.overdueTasksCount > 0)
      .sort((left, right) => left.health.score - right.health.score)
      .slice(0, limit);
    return { entity: "account_health_list", record: { threshold, accounts: records } };
  }

  if (type === "crm.assign_owner") {
    const entity = normalizeEntityName(
      targetText(source, "entity") ||
      targetText(source, "recordType") ||
      targetText(source, "resource")
    );
    const recordId = targetText(source, "recordId") || targetText(source, "id");
    if (!recordId || !["contact", "company", "lead", "deal", "task", "ticket"].includes(entity)) {
      throw new HttpError("crm.assign_owner requires entity and recordId", 400);
    }
    const owner = await resolveUserInOrganization(organizationId, source);
    const exists = entity === "contact" ? await prisma.contact.findFirst({ where: { id: recordId, organizationId }, select: { id: true } })
      : entity === "company" ? await prisma.company.findFirst({ where: { id: recordId, organizationId }, select: { id: true } })
      : entity === "lead" ? await prisma.lead.findFirst({ where: { id: recordId, organizationId }, select: { id: true } })
      : entity === "deal" ? await prisma.deal.findFirst({ where: { id: recordId, organizationId }, select: { id: true } })
      : entity === "task" ? await prisma.task.findFirst({ where: { id: recordId, organizationId }, select: { id: true } })
      : await prisma.ticket.findFirst({ where: { id: recordId, organizationId }, select: { id: true } });
    if (!exists) throw new HttpError("CRM record not found", 404);
    const record = entity === "contact"
      ? await prisma.contact.update({ where: { id: recordId }, data: { ownerId: owner.id } })
      : entity === "company"
        ? await prisma.company.update({ where: { id: recordId }, data: { ownerId: owner.id } })
        : entity === "lead"
          ? await prisma.lead.update({ where: { id: recordId }, data: { ownerId: owner.id } })
          : entity === "deal"
            ? await prisma.deal.update({ where: { id: recordId }, data: { ownerId: owner.id } })
            : entity === "task"
              ? await prisma.task.update({ where: { id: recordId }, data: { assignedToId: owner.id } })
              : await prisma.ticket.update({ where: { id: recordId }, data: { assignedToId: owner.id } });
    await recordActivity({
      organizationId,
      actorId: user.id,
      type: "RECORD_UPDATED",
      subject: `Assigned ${entity} to ${owner.firstName} ${owner.lastName} through Hydria Core`,
      metadata: { source: "hydria_core", entity, recordId, ownerId: owner.id }
    });
    return { entity, record };
  }

  if (type === "crm.add_activity" || type === "crm.log_call") {
    const relationIds = await recordRelationIds(organizationId, source);
    const requestedType = text(source, "activityType").toUpperCase();
    const activityType = type === "crm.log_call"
      ? "CALL"
      : ["NOTE", "CALL", "EMAIL", "MEETING", "TASK", "RECORD_UPDATED"].includes(requestedType)
        ? requestedType as "NOTE" | "CALL" | "EMAIL" | "MEETING" | "TASK" | "RECORD_UPDATED"
        : "NOTE";
    const subject = text(source, "subject") || text(source, "title") || (type === "crm.log_call" ? "Call logged through Hydria Core" : "Activity logged through Hydria Core");
    const body = nullableText(source, "body") || nullableText(source, "description") || nullableText(source, "notes");
    const activity = await recordActivity({
      organizationId,
      actorId: user.id,
      type: activityType,
      subject,
      body: body || undefined,
      ...relationIds,
      metadata: {
        source: "hydria_core",
        prompt: text(source, "prompt"),
        durationMinutes: numberValue(source, "durationMinutes")
      }
    });
    return { entity: "activity", record: activity };
  }

  if (type === "crm.update_custom_field") {
    const entityType = customEntityType(source);
    const entityId = targetText(source, "recordId") || targetText(source, "entityId") || targetText(source, "id");
    if (!entityId) throw new HttpError("crm.update_custom_field requires recordId", 400);
    await assertEntityInOrganization(organizationId, entityType, entityId);

    const definitionId = targetText(source, "definitionId") || targetText(source, "fieldId");
    const key = normalizeFieldKey(targetText(source, "fieldKey") || targetText(source, "key"));
    const label = targetText(source, "fieldLabel") || targetText(source, "label") || targetText(source, "name");
    const definition = definitionId
      ? await prisma.customFieldDefinition.findFirst({ where: { id: definitionId, organizationId, entityType } })
      : key
        ? await prisma.customFieldDefinition.findFirst({ where: { key, organizationId, entityType } })
        : label
          ? await prisma.customFieldDefinition.findFirst({
              where: { label: { equals: label, mode: "insensitive" }, organizationId, entityType }
            })
          : null;
    if (!definition) throw new HttpError("CRM custom field not found", 404);

    const rawValue = source.value !== undefined
      ? source.value
      : source.fieldValue !== undefined
        ? source.fieldValue
        : source.newValue;
    const normalizedValue = normalizeHydriaCustomFieldValue(definition, rawValue);
    if (normalizedValue === null) {
      await prisma.customFieldValue.deleteMany({ where: { organizationId, definitionId: definition.id, entityId } });
      return { entity: "custom_field", record: { definitionId: definition.id, entityId, value: null } };
    }
    const value = await prisma.customFieldValue.upsert({
      where: { definitionId_entityId: { definitionId: definition.id, entityId } },
      update: { value: normalizedValue },
      create: { organizationId, definitionId: definition.id, entityId, value: normalizedValue }
    });
    await recordActivity({
      organizationId,
      actorId: user.id,
      type: "RECORD_UPDATED",
      subject: `Updated custom field ${definition.label} through Hydria Core`,
      metadata: { source: "hydria_core", entityType, entityId, definitionId: definition.id }
    });
    return { entity: "custom_field", record: value };
  }

  if (type === "crm.merge_records") {
    if (!confirmed) throw new HttpError("CRM merge requires explicit confirmation", 409);
    const entity = normalizeEntityName(
      targetText(source, "entity") ||
      targetText(source, "recordType") ||
      targetText(source, "resource")
    );
    if (!["contact", "company", "lead"].includes(entity)) {
      throw new HttpError("CRM merge is available for contacts, companies and leads", 400);
    }
    const targetId = targetText(source, "targetId") || targetText(source, "primaryId") || targetText(source, "recordId");
    const sourceIds = [
      ...arrayText(source, "sourceIds"),
      ...arrayText(source, "duplicateIds"),
      ...arrayText(source, "recordIds"),
      text(source, "sourceId"),
      text(source, "duplicateId")
    ].filter(Boolean);
    const uniqueSourceIds = [...new Set(sourceIds)].filter((id) => id !== targetId);
    if (!targetId || !uniqueSourceIds.length) {
      throw new HttpError("crm.merge_records requires targetId and sourceIds", 400);
    }

    if (entity === "company") {
      const companies = await prisma.company.findMany({
        where: { organizationId, id: { in: [targetId, ...uniqueSourceIds] } }
      });
      if (companies.length !== uniqueSourceIds.length + 1) throw new HttpError("A company to merge was not found", 404);
      await prisma.$transaction(async (tx) => {
        await Promise.all([
          tx.contact.updateMany({ where: { organizationId, companyId: { in: uniqueSourceIds } }, data: { companyId: targetId } }),
          tx.deal.updateMany({ where: { organizationId, companyId: { in: uniqueSourceIds } }, data: { companyId: targetId } }),
          tx.quote.updateMany({ where: { organizationId, companyId: { in: uniqueSourceIds } }, data: { companyId: targetId } }),
          tx.task.updateMany({ where: { organizationId, companyId: { in: uniqueSourceIds } }, data: { companyId: targetId } }),
          tx.ticket.updateMany({ where: { organizationId, companyId: { in: uniqueSourceIds } }, data: { companyId: targetId } }),
          tx.note.updateMany({ where: { organizationId, companyId: { in: uniqueSourceIds } }, data: { companyId: targetId } }),
          tx.activity.updateMany({ where: { organizationId, companyId: { in: uniqueSourceIds } }, data: { companyId: targetId } }),
          tx.lead.updateMany({ where: { organizationId, convertedCompanyId: { in: uniqueSourceIds } }, data: { convertedCompanyId: targetId } }),
          tx.attachment.updateMany({ where: { organizationId, entityType: "COMPANY", entityId: { in: uniqueSourceIds } }, data: { entityId: targetId } })
        ]);
        await mergeCustomFieldValues(tx, organizationId, "COMPANY", targetId, uniqueSourceIds);
        await tx.company.deleteMany({ where: { organizationId, id: { in: uniqueSourceIds } } });
      });
      return { entity: "company_merge", record: { targetId, merged: uniqueSourceIds.length } };
    }

    if (entity === "lead") {
      const leads = await prisma.lead.findMany({
        where: { organizationId, id: { in: [targetId, ...uniqueSourceIds] } },
        orderBy: { updatedAt: "desc" }
      });
      if (leads.length !== uniqueSourceIds.length + 1) throw new HttpError("A lead to merge was not found", 404);
      if (leads.some((lead) => lead.status === "CONVERTED")) throw new HttpError("Converted leads cannot be merged", 409);
      const targetLead = leads.find((lead) => lead.id === targetId);
      if (!targetLead) throw new HttpError("CRM lead not found", 404);
      const sources = leads.filter((lead) => lead.id !== targetId);
      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: targetLead.id },
          data: {
            email: targetLead.email || sources.find((lead) => lead.email)?.email,
            phone: targetLead.phone || sources.find((lead) => lead.phone)?.phone,
            companyName: targetLead.companyName || sources.find((lead) => lead.companyName)?.companyName,
            jobTitle: targetLead.jobTitle || sources.find((lead) => lead.jobTitle)?.jobTitle,
            website: targetLead.website || sources.find((lead) => lead.website)?.website,
            description: targetLead.description || sources.find((lead) => lead.description)?.description
          }
        });
        await Promise.all([
          tx.task.updateMany({ where: { organizationId, leadId: { in: uniqueSourceIds } }, data: { leadId: targetId } }),
          tx.note.updateMany({ where: { organizationId, leadId: { in: uniqueSourceIds } }, data: { leadId: targetId } }),
          tx.activity.updateMany({ where: { organizationId, leadId: { in: uniqueSourceIds } }, data: { leadId: targetId } }),
          tx.emailMessage.updateMany({ where: { organizationId, leadId: { in: uniqueSourceIds } }, data: { leadId: targetId } }),
          tx.calendarEvent.updateMany({ where: { organizationId, leadId: { in: uniqueSourceIds } }, data: { leadId: targetId } }),
          tx.attachment.updateMany({ where: { organizationId, entityType: "LEAD", entityId: { in: uniqueSourceIds } }, data: { entityId: targetId } })
        ]);
        await mergeCustomFieldValues(tx, organizationId, "LEAD", targetId, uniqueSourceIds);
        await tx.lead.deleteMany({ where: { organizationId, id: { in: uniqueSourceIds } } });
      });
      return { entity: "lead_merge", record: { targetId, merged: uniqueSourceIds.length } };
    }

    const contacts = await prisma.contact.findMany({
      where: { organizationId, id: { in: [targetId, ...uniqueSourceIds] } },
      orderBy: { updatedAt: "desc" }
    });
    if (contacts.length !== uniqueSourceIds.length + 1) throw new HttpError("A contact to merge was not found", 404);
    const targetContact = contacts.find((contact) => contact.id === targetId);
    if (!targetContact) throw new HttpError("CRM contact not found", 404);
    const sources = contacts.filter((contact) => contact.id !== targetId);
    await prisma.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id: targetContact.id },
        data: {
          email: targetContact.email || sources.find((contact) => contact.email)?.email,
          phone: targetContact.phone || sources.find((contact) => contact.phone)?.phone,
          jobTitle: targetContact.jobTitle || sources.find((contact) => contact.jobTitle)?.jobTitle,
          source: targetContact.source || sources.find((contact) => contact.source)?.source,
          companyId: targetContact.companyId || sources.find((contact) => contact.companyId)?.companyId || null
        }
      });
      await Promise.all([
        tx.deal.updateMany({ where: { organizationId, primaryContactId: { in: uniqueSourceIds } }, data: { primaryContactId: targetId } }),
        tx.quote.updateMany({ where: { organizationId, contactId: { in: uniqueSourceIds } }, data: { contactId: targetId } }),
        tx.task.updateMany({ where: { organizationId, contactId: { in: uniqueSourceIds } }, data: { contactId: targetId } }),
        tx.ticket.updateMany({ where: { organizationId, contactId: { in: uniqueSourceIds } }, data: { contactId: targetId } }),
        tx.note.updateMany({ where: { organizationId, contactId: { in: uniqueSourceIds } }, data: { contactId: targetId } }),
        tx.activity.updateMany({ where: { organizationId, contactId: { in: uniqueSourceIds } }, data: { contactId: targetId } }),
        tx.lead.updateMany({ where: { organizationId, convertedContactId: { in: uniqueSourceIds } }, data: { convertedContactId: targetId } }),
        tx.emailMessage.updateMany({ where: { organizationId, contactId: { in: uniqueSourceIds } }, data: { contactId: targetId } }),
        tx.calendarEvent.updateMany({ where: { organizationId, contactId: { in: uniqueSourceIds } }, data: { contactId: targetId } }),
        tx.attachment.updateMany({ where: { organizationId, entityType: "CONTACT", entityId: { in: uniqueSourceIds } }, data: { entityId: targetId } })
      ]);
      await mergeCustomFieldValues(tx, organizationId, "CONTACT", targetId, uniqueSourceIds);
      await tx.contact.deleteMany({ where: { organizationId, id: { in: uniqueSourceIds } } });
    });
    return { entity: "contact_merge", record: { targetId, merged: uniqueSourceIds.length } };
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
    const company = await companyForOperation(organizationId, user.id, source);
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
    const relationIds = await recordRelationIds(organizationId, source);
    const assignedToId = targetText(source, "assignedToId") || targetText(source, "ownerId") || targetText(source, "userId")
      ? (await resolveUserInOrganization(organizationId, source)).id
      : user.id;
    const task = await prisma.task.create({
      data: {
        organizationId,
        createdById: user.id,
        assignedToId,
        ...relationIds,
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
      ...relationIds,
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

  if (type === "crm.create_ticket") {
    const subject = text(source, "subject") || text(source, "title") || text(source, "value");
    if (!subject) throw new HttpError("crm.create_ticket requires subject", 400);
    const priority = text(source, "priority").toUpperCase();
    const status = text(source, "status").toUpperCase();
    const dueAt = text(source, "dueAt");
    const relationIds = await recordRelationIds(organizationId, source);
    const queueId = targetText(source, "queueId");
    const queue = queueId
      ? await prisma.supportQueue.findFirst({ where: { id: queueId, organizationId } })
      : await prisma.supportQueue.findFirst({
          where: { organizationId, active: true },
          orderBy: { createdAt: "asc" }
        });
    if (queueId && !queue) throw new HttpError("CRM support queue not found", 404);
    const createdAt = new Date();
    const requestedAssignee = targetText(source, "assignedToId") || targetText(source, "ownerId") || targetText(source, "userId");
    const assignedToId = requestedAssignee
      ? (await resolveUserInOrganization(organizationId, source)).id
      : await routeTicketOwner(organizationId, queue) || user.id;
    const ticket = await prisma.ticket.create({
      data: {
        organizationId,
        createdById: user.id,
        assignedToId,
        queueId: queue?.id || null,
        ...relationIds,
        number: `T-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        subject,
        description: nullableText(source, "description"),
        source: text(source, "source", "HYDRIA").toUpperCase(),
        priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)
          ? priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT"
          : "MEDIUM",
        status: ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"].includes(status)
          ? status as "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED"
          : "OPEN",
        dueAt: dueAt ? new Date(dueAt) : null,
        customerEmail: nullableText(source, "customerEmail"),
        ...ticketDeadlines(createdAt, queue),
        resolvedAt: ["RESOLVED", "CLOSED"].includes(status) ? new Date() : null
      }
    });
    await recordActivity({
      organizationId,
      actorId: user.id,
      ...relationIds,
      type: "RECORD_CREATED",
      subject: `Created ticket ${ticket.number} through Hydria Core`,
      body: ticket.subject,
      metadata: { ticketId: ticket.id }
    });
    return { entity: "ticket", record: ticket };
  }

  if (type === "crm.update_ticket") {
    const recordId = text(target, "recordId") || text(source, "ticketId");
    const current = await prisma.ticket.findFirst({ where: { id: recordId, organizationId } });
    if (!current) throw new HttpError("CRM ticket not found", 404);
    const status = text(source, "status").toUpperCase();
    const priority = text(source, "priority").toUpperCase();
    const dueAt = text(source, "dueAt");
    const ticket = await prisma.ticket.update({
      where: { id: current.id },
      data: {
        subject: nullableText(source, "subject") || nullableText(source, "title") || undefined,
        description: source.description !== undefined ? nullableText(source, "description") : undefined,
        status: ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"].includes(status)
          ? status as "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED"
          : undefined,
        priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)
          ? priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT"
          : undefined,
        dueAt: source.dueAt !== undefined ? dueAt ? new Date(dueAt) : null : undefined,
        resolvedAt: ["RESOLVED", "CLOSED"].includes(status)
          ? current.resolvedAt || new Date()
          : status
            ? null
            : undefined
      }
    });
    return { entity: "ticket", record: ticket };
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
    const company = await companyForOperation(organizationId, user.id, source);
    const primaryContactId = targetText(source, "primaryContactId") || targetText(source, "contactId");
    if (primaryContactId) {
      const contact = await prisma.contact.findFirst({ where: { id: primaryContactId, organizationId } });
      if (!contact) throw new HttpError("CRM contact not found", 404);
    }
    const deal = await prisma.deal.create({
      data: {
        organizationId,
        ownerId: user.id,
        companyId: company?.id,
        primaryContactId: primaryContactId || null,
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

  if (type === "crm.summarize_customer" || type === "crm.get_account_health") {
    const snapshot = await accountHealthSnapshot(organizationId, {
      companyId: text(target, "recordId") || text(source, "companyId"),
      companyName: text(source, "companyName") || text(source, "name")
    });
    return {
      entity: type === "crm.get_account_health" ? "account_health" : "customer_summary",
      record: snapshot
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

export async function executeHydriaCrmOperation(
  operation: Record<string, unknown>,
  user: { id: string; organizationId: string },
  confirmed = false
) {
  return executeOperation(
    operation,
    user as Awaited<ReturnType<typeof ensureHydriaIdentity>>,
    confirmed
  );
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
        prisma.task.count({ where: { organizationId, status: { in: ["TODO", "IN_PROGRESS"] } } }),
        prisma.ticket.count({ where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } } })
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
    const [recentLeads, products, quotes, openTickets] = await Promise.all([
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
      }),
      prisma.ticket.findMany({
        where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        take: 12,
        select: {
          id: true,
          number: true,
          subject: true,
          status: true,
          priority: true,
          dueAt: true,
          assignedTo: { select: { id: true, firstName: true, lastName: true } }
        }
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
          openTasks: counts[4],
          openTickets: counts[5]
        },
        pipelineStages: stages,
        recentContacts,
        recentCompanies,
        recentLeads,
        recentDeals,
        openTasks,
        openTickets,
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
      resource: z.enum(["contacts", "companies", "leads", "deals", "tasks", "tickets", "products", "quotes"]),
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
    else if (input.resource === "tickets") records = await prisma.ticket.findMany({
      where: {
        organizationId,
        ...(input.recordId
          ? { id: input.recordId }
          : search
            ? {
                OR: [
                  { number: { contains: search, mode: "insensitive" } },
                  { subject: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } }
                ]
              }
            : {})
      },
      take: input.limit,
      include: { assignedTo: true, createdBy: true, contact: true, company: true }
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
