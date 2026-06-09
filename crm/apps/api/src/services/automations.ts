import { Prisma, type AutomationTrigger } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { emitWebhook } from "./webhooks.js";
import { enqueueBackgroundJob } from "./backgroundJobs.js";

type AutomationEntity = {
  entityType: "lead" | "deal" | "contact" | "company" | "quote" | "task";
  entityId: string;
  fields: Record<string, unknown>;
};

function asObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function conditionsMatch(conditions: Record<string, unknown>, fields: Record<string, unknown>) {
  return Object.entries(conditions).every(([key, expected]) => {
    const actual = fields[key];
    if (Array.isArray(expected)) return expected.map(String).includes(String(actual));
    if (expected && typeof expected === "object") {
      const matcher = expected as Record<string, unknown>;
      if ("equals" in matcher) return String(actual) === String(matcher.equals);
      if ("contains" in matcher) return String(actual).toLowerCase().includes(String(matcher.contains).toLowerCase());
      if ("not" in matcher) return String(actual) !== String(matcher.not);
    }
    return String(actual) === String(expected);
  });
}

async function resolveOwner(organizationId: string, config: Record<string, unknown>) {
  if (config.ownerId) return String(config.ownerId);
  if (config.strategy !== "ROUND_ROBIN") return null;
  const users = await prisma.user.findMany({
    where: { organizationId, role: { in: ["ADMIN", "MANAGER", "MEMBER"] } },
    orderBy: { id: "asc" },
    select: { id: true }
  });
  if (!users.length) return null;
  const counts = await Promise.all(users.map(async (user) => ({
    id: user.id,
    count: await prisma.lead.count({ where: { organizationId, ownerId: user.id, status: { not: "CONVERTED" } } })
  })));
  return counts.sort((left, right) => left.count - right.count || left.id.localeCompare(right.id))[0]!.id;
}

async function applyRule(
  organizationId: string,
  createdById: string,
  action: string,
  config: Record<string, unknown>,
  entity: AutomationEntity
) {
  if (action === "ASSIGN_OWNER") {
    const ownerId = await resolveOwner(organizationId, config);
    if (!ownerId) throw new Error("Automation could not resolve an owner");
    if (entity.entityType === "lead") await prisma.lead.update({ where: { id: entity.entityId }, data: { ownerId } });
    else if (entity.entityType === "deal") await prisma.deal.update({ where: { id: entity.entityId }, data: { ownerId } });
    else if (entity.entityType === "contact") await prisma.contact.update({ where: { id: entity.entityId }, data: { ownerId } });
    else if (entity.entityType === "company") await prisma.company.update({ where: { id: entity.entityId }, data: { ownerId } });
    else throw new Error("Owner assignment is unsupported for this entity");
    return { ownerId };
  }
  if (action === "CREATE_TASK") {
    const dueDays = Math.max(0, Number(config.dueInDays || 1));
    const task = await prisma.task.create({
      data: {
        organizationId,
        createdById,
        assignedToId: config.assignedToId ? String(config.assignedToId) : createdById,
        title: String(config.title || `Follow up ${entity.entityType}`),
        description: config.description ? String(config.description) : null,
        dueAt: new Date(Date.now() + dueDays * 86_400_000),
        ...(entity.entityType === "lead" ? { leadId: entity.entityId } : {}),
        ...(entity.entityType === "deal" ? { dealId: entity.entityId } : {}),
        ...(entity.entityType === "contact" ? { contactId: entity.entityId } : {}),
        ...(entity.entityType === "company" ? { companyId: entity.entityId } : {})
      }
    });
    return { taskId: task.id };
  }
  if (action === "SEND_EMAIL") {
    const to = String(config.to || entity.fields.email || "");
    if (!to) throw new Error("Automation email has no recipient");
    const message = await prisma.emailMessage.create({
      data: {
        organizationId,
        senderId: createdById,
        to,
        subject: String(config.subject || "Follow-up"),
        body: String(config.body || ""),
        status: "QUEUED",
        ...(entity.entityType === "lead" ? { leadId: entity.entityId } : {}),
        ...(entity.entityType === "contact" ? { contactId: entity.entityId } : {})
      }
    });
    await enqueueBackgroundJob({
      organizationId,
      type: "EMAIL_SEND",
      payload: { emailMessageId: message.id }
    });
    return { emailMessageId: message.id, queued: true };
  }
  if (action === "MOVE_DEAL_STAGE") {
    if (entity.entityType !== "deal") throw new Error("Stage changes require a deal");
    const stageId = String(config.stageId || "");
    const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, organizationId } });
    if (!stage) throw new Error("Automation pipeline stage not found");
    await prisma.deal.update({
      where: { id: entity.entityId },
      data: {
        stageId,
        status: stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN",
        forecastCategory: stage.isWon ? "CLOSED" : stage.isLost ? "OMITTED" : "PIPELINE"
      }
    });
    return { stageId };
  }
  if (action === "UPDATE_FIELD") {
    const field = String(config.field || "");
    const value = config.value;
    const allowed: Record<string, string[]> = {
      lead: ["status", "rating", "source", "description"],
      deal: ["probability", "forecastCategory", "nextStep", "description"],
      contact: ["status", "source", "jobTitle"],
      company: ["industry", "size", "city", "country"]
    };
    if (!allowed[entity.entityType]?.includes(field)) throw new Error("Automation field is not allowed");
    const data = { [field]: value };
    if (entity.entityType === "lead") await prisma.lead.update({ where: { id: entity.entityId }, data });
    else if (entity.entityType === "deal") await prisma.deal.update({ where: { id: entity.entityId }, data });
    else if (entity.entityType === "contact") await prisma.contact.update({ where: { id: entity.entityId }, data });
    else if (entity.entityType === "company") await prisma.company.update({ where: { id: entity.entityId }, data });
    return { field, value };
  }
  throw new Error(`Unsupported automation action: ${action}`);
}

export async function triggerAutomations(
  organizationId: string,
  trigger: AutomationTrigger,
  entity: AutomationEntity
) {
  const rules = await prisma.automationRule.findMany({
    where: { organizationId, trigger, active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  });
  for (const rule of rules) {
    if (!conditionsMatch(asObject(rule.conditions), entity.fields)) continue;
    try {
      const result = await applyRule(
        organizationId,
        rule.createdById,
        rule.action,
        asObject(rule.configuration),
        entity
      );
      await prisma.automationRun.create({
        data: {
          organizationId,
          ruleId: rule.id,
          entityType: entity.entityType,
          entityId: entity.entityId,
          status: "COMPLETED",
          input: entity.fields as Prisma.InputJsonValue,
          result: result as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      await prisma.automationRun.create({
        data: {
          organizationId,
          ruleId: rule.id,
          entityType: entity.entityType,
          entityId: entity.entityId,
          status: "FAILED",
          input: entity.fields as Prisma.InputJsonValue,
          error: error instanceof Error ? error.message : "Automation failed"
        }
      });
    }
  }
  await emitWebhook(organizationId, `crm.${entity.entityType}.${trigger.toLowerCase()}`, {
    id: entity.entityId,
    ...entity.fields
  });
}
