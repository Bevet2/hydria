import { Router } from "express";
import { z } from "zod";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { executeHydriaCrmOperation } from "./hydriaIntegration.js";

const router = Router();
const recordTypeSchema = z.enum(["company", "contact", "deal", "lead", "ticket"]);
const planSchema = z.object({
  recordType: recordTypeSchema,
  recordId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(1200)
});
const executeSchema = planSchema.extend({
  confirmed: z.boolean().default(false),
  operations: z.array(z.record(z.string(), z.unknown())).min(1).max(10)
});
const readOnlyOperations = new Set([
  "crm.get_account_health",
  "crm.summarize_customer",
  "crm.list_at_risk_accounts"
]);

type RecordType = z.infer<typeof recordTypeSchema>;
type AssistAction = {
  id: string;
  label: string;
  description: string;
  requiresConfirmation: boolean;
  operation: Record<string, unknown>;
};

router.use(requireAuth);

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function compact(value = "", max = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}...`;
}

function quotedOrPrompt(prompt: string, fallback: string) {
  const quoted = prompt.match(/["']([^"']{3,160})["']/)?.[1];
  if (quoted) return quoted.trim();
  return compact(prompt, 110) || fallback;
}

function assigneeFromPrompt(prompt: string, user: { id: string }) {
  const email = prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) return { ownerEmail: email };
  const name = prompt.match(/(?:to|a|assign to|assigned to|assigne(?:r)?(?: a)?|attribue(?:r)?(?: a)?)\s+([A-Z][^,.;\n]{1,80})/i)?.[1];
  if (name) return { ownerName: name.trim() };
  return { ownerId: user.id };
}

async function loadContext(organizationId: string, recordType: RecordType, recordId: string) {
  if (recordType === "company") {
    const record = await prisma.company.findFirst({
      where: { id: recordId, organizationId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        contacts: { orderBy: { updatedAt: "desc" }, take: 10 },
        deals: { include: { stage: true }, orderBy: { updatedAt: "desc" }, take: 10 },
        tickets: { orderBy: { updatedAt: "desc" }, take: 10 },
        tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 10 },
        activities: { orderBy: { occurredAt: "desc" }, take: 10 }
      }
    });
    if (!record) throw new HttpError("CRM company not found", 404);
    return record;
  }
  if (recordType === "contact") {
    const record = await prisma.contact.findFirst({
      where: { id: recordId, organizationId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        company: true,
        primaryDeals: { include: { stage: true }, orderBy: { updatedAt: "desc" }, take: 10 },
        tickets: { orderBy: { updatedAt: "desc" }, take: 10 },
        tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 10 },
        activities: { orderBy: { occurredAt: "desc" }, take: 10 }
      }
    });
    if (!record) throw new HttpError("CRM contact not found", 404);
    return record;
  }
  if (recordType === "deal") {
    const record = await prisma.deal.findFirst({
      where: { id: recordId, organizationId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        company: true,
        primaryContact: true,
        stage: true,
        tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 10 },
        activities: { orderBy: { occurredAt: "desc" }, take: 10 }
      }
    });
    if (!record) throw new HttpError("CRM deal not found", 404);
    return record;
  }
  if (recordType === "lead") {
    const record = await prisma.lead.findFirst({
      where: { id: recordId, organizationId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 10 },
        activities: { orderBy: { occurredAt: "desc" }, take: 10 }
      }
    });
    if (!record) throw new HttpError("CRM lead not found", 404);
    return record;
  }
  const record = await prisma.ticket.findFirst({
    where: { id: recordId, organizationId },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      company: true,
      contact: true,
      queue: true,
      events: { orderBy: { createdAt: "desc" }, take: 10 },
      messages: { orderBy: { createdAt: "desc" }, take: 8 }
    }
  });
  if (!record) throw new HttpError("CRM ticket not found", 404);
  return record;
}

function recordName(recordType: RecordType, record: Record<string, any>) {
  if (recordType === "company" || recordType === "deal") return record.name;
  if (recordType === "ticket") return `${record.number} ${record.subject}`;
  return `${record.firstName || ""} ${record.lastName || ""}`.trim() || record.email || record.companyName || "record";
}

function relationFor(recordType: RecordType, recordId: string, record: Record<string, any>) {
  if (recordType === "company") return { companyId: recordId };
  if (recordType === "contact") return { contactId: recordId, companyId: record.companyId || record.company?.id || undefined };
  if (recordType === "deal") return { dealId: recordId, companyId: record.companyId || record.company?.id || undefined, contactId: record.primaryContactId || record.primaryContact?.id || undefined };
  if (recordType === "lead") return { leadId: recordId };
  return { ticketId: recordId, companyId: record.companyId || record.company?.id || undefined, contactId: record.contactId || record.contact?.id || undefined };
}

function currentTarget(recordType: RecordType, recordId: string) {
  return { entity: recordType, recordId };
}

function attachContext(operation: Record<string, unknown>, recordType: RecordType, recordId: string, record: Record<string, any>) {
  const relation = relationFor(recordType, recordId, record);
  const type = String(operation.type || "");
  const target = operation.target && typeof operation.target === "object" && !Array.isArray(operation.target)
    ? operation.target as Record<string, unknown>
    : {};
  const next = { ...operation };
  if (["crm.create_task", "crm.create_ticket", "crm.add_activity", "crm.log_call"].includes(type)) {
    Object.assign(next, relation);
  }
  if (type === "crm.create_deal") {
    if (relation.companyId) next.companyId = relation.companyId;
    if (relation.contactId) next.primaryContactId = relation.contactId;
  }
  if (["crm.assign_owner", "crm.update_record", "crm.update_ticket", "crm.update_task"].includes(type)) {
    next.target = { ...currentTarget(recordType, recordId), ...target };
    next.entity = next.entity || recordType;
    next.recordId = next.recordId || recordId;
  }
  if (["crm.get_account_health", "crm.summarize_customer"].includes(type)) {
    if (relation.companyId) next.companyId = relation.companyId;
    else if (recordType === "company") next.companyId = recordId;
  }
  return next;
}

function buildSummary(recordType: RecordType, record: Record<string, any>) {
  if (recordType === "company") {
    const openDeals = (record.deals || []).filter((deal: any) => deal.status === "OPEN");
    const openTickets = (record.tickets || []).filter((ticket: any) => ["OPEN", "IN_PROGRESS", "WAITING"].includes(ticket.status));
    const openTasks = (record.tasks || []).filter((task: any) => ["TODO", "IN_PROGRESS"].includes(task.status));
    return `${record.name}: ${openDeals.length} open deals, ${openTickets.length} open tickets, ${openTasks.length} open tasks.`;
  }
  if (recordType === "ticket") {
    return `${record.number}: ${record.status.toLowerCase().replaceAll("_", " ")} ticket, ${record.priority.toLowerCase()} priority.`;
  }
  if (recordType === "deal") {
    return `${record.name}: ${record.stage?.name || "pipeline"} stage, ${Number(record.value || 0)} ${record.currency || "EUR"}.`;
  }
  return `${recordName(recordType, record)}: ${recordType} record loaded with related CRM context.`;
}

function buildPlan(input: z.infer<typeof planSchema>, record: Record<string, any>, user: { id: string }) {
  const lower = input.prompt.toLowerCase();
  const name = recordName(input.recordType, record);
  const relation = relationFor(input.recordType, input.recordId, record);
  const actions: AssistAction[] = [];
  const add = (label: string, description: string, operation: Record<string, unknown>, requiresConfirmation = true) => {
    actions.push({
      id: `act_${actions.length + 1}`,
      label,
      description,
      requiresConfirmation,
      operation: attachContext(operation, input.recordType, input.recordId, record)
    });
  };

  if (includesAny(lower, ["comptes a risque", "comptes à risque", "at risk", "risque global"])) {
    add("List at-risk accounts", "Find accounts with weak health, overdue tasks or SLA risk.", { type: "crm.list_at_risk_accounts", limit: 10, threshold: 79 }, false);
  }

  if (includesAny(lower, ["resume", "résume", "resumer", "sante", "santé", "risk", "risque", "health"])) {
    if (relation.companyId || input.recordType === "company") {
      add("Summarize risk", "Refresh the CRM account summary and risk signals.", { type: "crm.get_account_health" }, false);
    }
  }

  if (includesAny(lower, ["assigne", "assign", "attribue", "owner", "proprietaire", "propriétaire"])) {
    add("Assign owner", `Assign ${name} to the requested owner.`, {
      type: "crm.assign_owner",
      ...assigneeFromPrompt(input.prompt, user)
    });
  }

  const asksForTicket = includesAny(lower, ["ticket", "support", "bug", "incident", "sla"]) ||
    (input.recordType === "ticket" && includesAny(lower, ["urgent", "critique", "critical", "escalade", "escalate"]));
  if (asksForTicket) {
    if (input.recordType === "ticket" && includesAny(lower, ["urgent", "escalade", "escalate", "priorite", "priorité"])) {
      add("Escalate ticket priority", "Move the current ticket to urgent priority.", {
        type: "crm.update_ticket",
        priority: "URGENT",
        status: "IN_PROGRESS"
      });
    } else {
      add("Create support ticket", "Create a linked support ticket from this record.", {
        type: "crm.create_ticket",
        subject: quotedOrPrompt(input.prompt, `Support follow-up for ${name}`),
        priority: includesAny(lower, ["urgent", "critique", "critical"]) ? "URGENT" : "HIGH",
        description: input.prompt
      });
    }
  }

  if (includesAny(lower, ["tache", "tâche", "task", "relance", "follow", "rappel", "todo", "suivi"])) {
    add("Create follow-up task", "Create a linked follow-up task and assign it to the current user.", {
      type: "crm.create_task",
      title: quotedOrPrompt(input.prompt, `Follow up with ${name}`),
      priority: includesAny(lower, ["urgent", "critique", "important"]) ? "HIGH" : "MEDIUM",
      dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString()
    });
  }

  if (includesAny(lower, ["opportunite", "opportunité", "opportunity", "deal", "pipeline", "vente"])) {
    add("Create opportunity", "Create a linked opportunity in the active pipeline.", {
      type: "crm.create_deal",
      name: quotedOrPrompt(input.prompt, `${name} opportunity`),
      value: 0,
      probability: 20,
      nextStep: input.prompt
    });
  }

  if (includesAny(lower, ["appel", "call", "email", "meeting", "réunion", "reunion", "activite", "activité", "note"])) {
    add("Log activity", "Add the requested interaction to the timeline.", {
      type: includesAny(lower, ["appel", "call"]) ? "crm.log_call" : "crm.add_activity",
      activityType: includesAny(lower, ["email"]) ? "EMAIL" : includesAny(lower, ["meeting", "reunion", "réunion"]) ? "MEETING" : "CALL",
      subject: quotedOrPrompt(input.prompt, `Follow-up with ${name}`),
      body: input.prompt
    });
  }

  if (!actions.length) {
    if (relation.companyId || input.recordType === "company") {
      add("Summarize context", "Return the most relevant CRM context for this record.", {
        type: "crm.get_account_health"
      }, false);
    }
  }

  return {
    summary: buildSummary(input.recordType, record),
    record: {
      id: input.recordId,
      type: input.recordType,
      name
    },
    actions,
    requiresConfirmation: actions.some((action) => action.requiresConfirmation)
  };
}

router.post(
  "/plan",
  asyncRoute(async (req, res) => {
    const input = parseBody(planSchema, req.body);
    const record = await loadContext(req.user!.organizationId, input.recordType, input.recordId);
    res.json({ plan: buildPlan(input, record as Record<string, any>, { id: req.user!.id }) });
  })
);

router.post(
  "/execute",
  asyncRoute(async (req, res) => {
    const input = parseBody(executeSchema, req.body);
    const record = await loadContext(req.user!.organizationId, input.recordType, input.recordId);
    const operations = input.operations.map((operation) =>
      attachContext(operation, input.recordType, input.recordId, record as Record<string, any>)
    );
    const mutating = operations.some((operation) => !readOnlyOperations.has(String(operation.type || "")));
    if (mutating) assertCanWrite(req);
    if (mutating && !input.confirmed) {
      throw new HttpError("Hydria CRM actions require confirmation", 409);
    }

    const results: Array<Record<string, unknown>> = [];
    for (const operation of operations) {
      try {
        const result = await executeHydriaCrmOperation(operation, req.user!, input.confirmed);
        results.push({
          status: "completed",
          operationsApplied: [String(operation.type || "")],
          ...result
        });
      } catch (error) {
        results.push({
          status: "failed",
          operationsApplied: [],
          issues: [error instanceof Error ? error.message : "CRM action failed"]
        });
      }
    }
    res.json({
      executed: results.filter((result) => result.status === "completed").length,
      results
    });
  })
);

export default router;
