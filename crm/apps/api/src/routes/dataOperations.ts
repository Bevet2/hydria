import { rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { assertCanWrite } from "../middleware/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const resourceSchema = z.enum(["contacts", "companies", "leads", "deals", "products", "tasks", "tickets"]);
const attachmentRoot = path.resolve(env.ATTACHMENT_DIR);

router.use(requireAuth);

function resource(value: string) {
  const parsed = resourceSchema.safeParse(value);
  if (!parsed.success) throw new HttpError("Unsupported resource", 400);
  return parsed.data;
}

router.get("/duplicates/:resource", asyncRoute(async (req, res) => {
  const kind = resource(String(req.params.resource));
  const organizationId = req.user!.organizationId;
  if (kind === "contacts") {
    const rows = await prisma.contact.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      include: { company: { select: { id: true, name: true } } }
    });
    const groups = new Map<string, typeof rows>();
    for (const contact of rows) {
      const key = contact.email?.trim().toLowerCase()
        || `name:${contact.firstName.trim().toLowerCase()}:${contact.lastName.trim().toLowerCase()}:${contact.companyId || ""}`;
      groups.set(key, [...(groups.get(key) || []), contact]);
    }
    res.json({ groups: [...groups.values()].filter((items) => items.length > 1) });
    return;
  }
  if (kind === "companies") {
    const rows = await prisma.company.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" } });
    const groups = new Map<string, typeof rows>();
    for (const company of rows) {
      const key = company.domain?.trim().toLowerCase() || `name:${company.name.trim().toLowerCase()}`;
      groups.set(key, [...(groups.get(key) || []), company]);
    }
    res.json({ groups: [...groups.values()].filter((items) => items.length > 1) });
    return;
  }
  if (kind === "leads") {
    const rows = await prisma.lead.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" } });
    const groups = new Map<string, typeof rows>();
    for (const lead of rows) {
      const key = lead.email?.trim().toLowerCase()
        || `name:${lead.firstName.trim().toLowerCase()}:${lead.lastName.trim().toLowerCase()}:${(lead.companyName || "").trim().toLowerCase()}`;
      groups.set(key, [...(groups.get(key) || []), lead]);
    }
    res.json({ groups: [...groups.values()].filter((items) => items.length > 1) });
    return;
  }
  throw new HttpError("Duplicate detection is available for contacts, companies and leads", 400);
}));

router.post("/duplicates/companies/merge", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(z.object({
    targetId: z.string().uuid(),
    sourceIds: z.array(z.string().uuid()).min(1).max(50)
  }), req.body);
  const organizationId = req.user!.organizationId;
  const sourceIds = [...new Set(input.sourceIds)].filter((id) => id !== input.targetId);
  const companies = await prisma.company.findMany({
    where: { organizationId, id: { in: [input.targetId, ...sourceIds] } }
  });
  if (companies.length !== sourceIds.length + 1) throw new HttpError("A company to merge was not found", 404);
  await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.contact.updateMany({ where: { organizationId, companyId: { in: sourceIds } }, data: { companyId: input.targetId } }),
      tx.deal.updateMany({ where: { organizationId, companyId: { in: sourceIds } }, data: { companyId: input.targetId } }),
      tx.quote.updateMany({ where: { organizationId, companyId: { in: sourceIds } }, data: { companyId: input.targetId } }),
      tx.task.updateMany({ where: { organizationId, companyId: { in: sourceIds } }, data: { companyId: input.targetId } }),
      tx.note.updateMany({ where: { organizationId, companyId: { in: sourceIds } }, data: { companyId: input.targetId } }),
      tx.activity.updateMany({ where: { organizationId, companyId: { in: sourceIds } }, data: { companyId: input.targetId } }),
      tx.lead.updateMany({ where: { organizationId, convertedCompanyId: { in: sourceIds } }, data: { convertedCompanyId: input.targetId } }),
      tx.attachment.updateMany({ where: { organizationId, entityType: "COMPANY", entityId: { in: sourceIds } }, data: { entityId: input.targetId } }),
      tx.customFieldValue.updateMany({ where: { organizationId, entityId: { in: sourceIds }, definition: { entityType: "COMPANY" } }, data: { entityId: input.targetId } })
    ]);
    await tx.company.deleteMany({ where: { organizationId, id: { in: sourceIds } } });
  });
  res.json({ targetId: input.targetId, merged: sourceIds.length });
}));

router.post("/duplicates/leads/merge", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(z.object({
    targetId: z.string().uuid(),
    sourceIds: z.array(z.string().uuid()).min(1).max(50)
  }), req.body);
  const organizationId = req.user!.organizationId;
  const sourceIds = [...new Set(input.sourceIds)].filter((id) => id !== input.targetId);
  const leads = await prisma.lead.findMany({
    where: { organizationId, id: { in: [input.targetId, ...sourceIds] } },
    orderBy: { updatedAt: "desc" }
  });
  if (leads.length !== sourceIds.length + 1) throw new HttpError("A lead to merge was not found", 404);
  if (leads.some((lead) => lead.status === "CONVERTED")) throw new HttpError("Converted leads cannot be merged", 409);
  const target = leads.find((lead) => lead.id === input.targetId)!;
  const sources = leads.filter((lead) => lead.id !== input.targetId);
  const patch = {
    email: target.email || sources.find((lead) => lead.email)?.email,
    phone: target.phone || sources.find((lead) => lead.phone)?.phone,
    companyName: target.companyName || sources.find((lead) => lead.companyName)?.companyName,
    jobTitle: target.jobTitle || sources.find((lead) => lead.jobTitle)?.jobTitle,
    website: target.website || sources.find((lead) => lead.website)?.website,
    description: target.description || sources.find((lead) => lead.description)?.description
  };
  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: target.id }, data: patch });
    await Promise.all([
      tx.task.updateMany({ where: { organizationId, leadId: { in: sourceIds } }, data: { leadId: target.id } }),
      tx.note.updateMany({ where: { organizationId, leadId: { in: sourceIds } }, data: { leadId: target.id } }),
      tx.activity.updateMany({ where: { organizationId, leadId: { in: sourceIds } }, data: { leadId: target.id } }),
      tx.emailMessage.updateMany({ where: { organizationId, leadId: { in: sourceIds } }, data: { leadId: target.id } }),
      tx.calendarEvent.updateMany({ where: { organizationId, leadId: { in: sourceIds } }, data: { leadId: target.id } }),
      tx.attachment.updateMany({ where: { organizationId, entityType: "LEAD", entityId: { in: sourceIds } }, data: { entityId: target.id } }),
      tx.customFieldValue.updateMany({ where: { organizationId, entityId: { in: sourceIds }, definition: { entityType: "LEAD" } }, data: { entityId: target.id } })
    ]);
    await tx.lead.deleteMany({ where: { organizationId, id: { in: sourceIds } } });
  });
  res.json({ targetId: target.id, merged: sourceIds.length });
}));

router.post("/bulk/:resource", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const kind = resource(String(req.params.resource));
  const input = parseBody(z.object({
    ids: z.array(z.string().uuid()).min(1).max(500),
    action: z.enum(["ASSIGN_OWNER", "UPDATE_STATUS", "MOVE_STAGE", "SET_ACTIVE", "DELETE"]),
    ownerId: z.string().uuid().nullable().optional(),
    status: z.string().max(40).optional(),
    stageId: z.string().uuid().optional(),
    active: z.boolean().optional(),
    confirmation: z.literal("DELETE").optional()
  }), req.body);
  const organizationId = req.user!.organizationId;
  if (input.action === "DELETE" && input.confirmation !== "DELETE") {
    throw new HttpError('Bulk deletion requires confirmation "DELETE"', 400);
  }
  if (input.ownerId) {
    const owner = await prisma.user.findFirst({ where: { id: input.ownerId, organizationId } });
    if (!owner) throw new HttpError("Owner not found", 404);
  }

  let count = 0;
  if (kind === "companies") {
    const found = await prisma.company.findMany({ where: { organizationId, id: { in: input.ids } }, select: { id: true } });
    if (input.action === "ASSIGN_OWNER") {
      count = (await prisma.company.updateMany({ where: { organizationId, id: { in: input.ids } }, data: { ownerId: input.ownerId || null } })).count;
    } else if (input.action === "DELETE") {
      count = found.length;
      await deleteAttachments(organizationId, "COMPANY", input.ids);
      await prisma.company.deleteMany({ where: { organizationId, id: { in: input.ids } } });
    } else throw new HttpError("Unsupported company bulk action", 400);
  } else if (kind === "leads") {
    if (input.action === "ASSIGN_OWNER") {
      count = (await prisma.lead.updateMany({ where: { organizationId, id: { in: input.ids } }, data: { ownerId: input.ownerId || null } })).count;
    } else if (input.action === "UPDATE_STATUS") {
      const parsed = z.enum(["NEW", "WORKING", "QUALIFIED", "UNQUALIFIED"]).safeParse(input.status);
      if (!parsed.success) throw new HttpError("Valid lead status is required", 400);
      count = (await prisma.lead.updateMany({ where: { organizationId, id: { in: input.ids }, status: { not: "CONVERTED" } }, data: { status: parsed.data } })).count;
    } else if (input.action === "DELETE") {
      await deleteAttachments(organizationId, "LEAD", input.ids);
      count = (await prisma.lead.deleteMany({ where: { organizationId, id: { in: input.ids }, status: { not: "CONVERTED" } } })).count;
    } else throw new HttpError("Unsupported lead bulk action", 400);
  } else if (kind === "deals") {
    if (input.action === "ASSIGN_OWNER") {
      count = (await prisma.deal.updateMany({ where: { organizationId, id: { in: input.ids } }, data: { ownerId: input.ownerId || null } })).count;
    } else if (input.action === "MOVE_STAGE") {
      if (!input.stageId) throw new HttpError("stageId is required", 400);
      const stage = await prisma.pipelineStage.findFirst({ where: { id: input.stageId, organizationId } });
      if (!stage) throw new HttpError("Pipeline stage not found", 404);
      count = (await prisma.deal.updateMany({
        where: { organizationId, id: { in: input.ids } },
        data: {
          stageId: stage.id,
          status: stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN",
          forecastCategory: stage.isWon ? "CLOSED" : stage.isLost ? "OMITTED" : "PIPELINE"
        }
      })).count;
    } else if (input.action === "DELETE") {
      await deleteAttachments(organizationId, "DEAL", input.ids);
      count = (await prisma.deal.deleteMany({ where: { organizationId, id: { in: input.ids } } })).count;
    } else throw new HttpError("Unsupported deal bulk action", 400);
  } else if (kind === "products") {
    if (input.action === "SET_ACTIVE") {
      if (input.active === undefined) throw new HttpError("active is required", 400);
      count = (await prisma.product.updateMany({ where: { organizationId, id: { in: input.ids } }, data: { active: input.active } })).count;
    } else if (input.action === "DELETE") {
      const used = await prisma.product.count({
        where: { organizationId, id: { in: input.ids }, OR: [{ dealLineItems: { some: {} } }, { quoteLineItems: { some: {} } }] }
      });
      if (used) throw new HttpError("Products used by deals or quotes cannot be deleted", 409);
      count = (await prisma.product.deleteMany({ where: { organizationId, id: { in: input.ids } } })).count;
    } else throw new HttpError("Unsupported product bulk action", 400);
  } else if (kind === "tasks") {
    if (input.action === "ASSIGN_OWNER") {
      count = (await prisma.task.updateMany({
        where: { organizationId, id: { in: input.ids } },
        data: { assignedToId: input.ownerId || null }
      })).count;
    } else if (input.action === "UPDATE_STATUS") {
      const parsed = z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELED"]).safeParse(input.status);
      if (!parsed.success) throw new HttpError("Valid task status is required", 400);
      count = (await prisma.task.updateMany({
        where: { organizationId, id: { in: input.ids } },
        data: { status: parsed.data, completedAt: parsed.data === "DONE" ? new Date() : null }
      })).count;
    } else if (input.action === "DELETE") {
      count = (await prisma.task.deleteMany({ where: { organizationId, id: { in: input.ids } } })).count;
    } else throw new HttpError("Unsupported task bulk action", 400);
  } else {
    if (input.action === "ASSIGN_OWNER") {
      count = (await prisma.ticket.updateMany({
        where: { organizationId, id: { in: input.ids } },
        data: { assignedToId: input.ownerId || null }
      })).count;
    } else if (input.action === "UPDATE_STATUS") {
      const parsed = z.enum(["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"]).safeParse(input.status);
      if (!parsed.success) throw new HttpError("Valid ticket status is required", 400);
      count = (await prisma.ticket.updateMany({
        where: { organizationId, id: { in: input.ids } },
        data: {
          status: parsed.data,
          resolvedAt: ["RESOLVED", "CLOSED"].includes(parsed.data) ? new Date() : null
        }
      })).count;
    } else if (input.action === "DELETE") {
      await deleteAttachments(organizationId, "TICKET", input.ids);
      count = (await prisma.ticket.deleteMany({ where: { organizationId, id: { in: input.ids } } })).count;
    } else throw new HttpError("Unsupported ticket bulk action", 400);
  }
  res.json({ updated: count });
}));

async function deleteAttachments(organizationId: string, entityType: "CONTACT" | "COMPANY" | "LEAD" | "DEAL" | "TICKET", ids: string[]) {
  const attachments = await prisma.attachment.findMany({
    where: { organizationId, entityType, entityId: { in: ids } },
    select: { storageKey: true }
  });
  await prisma.attachment.deleteMany({ where: { organizationId, entityType, entityId: { in: ids } } });
  await Promise.all(attachments.map((item) => rm(path.join(attachmentRoot, item.storageKey), { force: true })));
}

router.get("/export/:resource.csv", asyncRoute(async (req, res) => {
  const kind = resource(String(req.params.resource));
  const organizationId = req.user!.organizationId;
  let records: Array<Record<string, unknown>>;
  if (kind === "contacts") {
    const contacts = await prisma.contact.findMany({
      where: { organizationId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { company: { select: { name: true } }, owner: { select: { email: true } } }
    });
    records = contacts.map((contact) => ({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || "",
      phone: contact.phone || "",
      jobTitle: contact.jobTitle || "",
      status: contact.status,
      source: contact.source || "",
      companyName: contact.company?.name || "",
      ownerEmail: contact.owner?.email || "",
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt
    }));
  } else if (kind === "companies") records = await prisma.company.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  else if (kind === "leads") records = await prisma.lead.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  else if (kind === "deals") {
    const deals = await prisma.deal.findMany({ where: { organizationId }, include: { stage: true, company: true } });
    records = deals.map((deal) => ({ ...deal, stageName: deal.stage.name, companyName: deal.company?.name || "" }));
  } else if (kind === "products") records = await prisma.product.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  else if (kind === "tasks") records = await prisma.task.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  else {
    const tickets = await prisma.ticket.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      include: {
        assignedTo: { select: { email: true, firstName: true, lastName: true } },
        contact: { select: { firstName: true, lastName: true, email: true } },
        company: { select: { name: true } },
        queue: { select: { name: true } }
      }
    });
    records = tickets.map((ticket) => ({
      number: ticket.number,
      subject: ticket.subject,
      description: ticket.description || "",
      status: ticket.status,
      priority: ticket.priority,
      source: ticket.source,
      customerEmail: ticket.customerEmail || "",
      assignedToEmail: ticket.assignedTo?.email || "",
      assignedToName: ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : "",
      contactEmail: ticket.contact?.email || "",
      contactName: ticket.contact ? `${ticket.contact.firstName} ${ticket.contact.lastName}` : "",
      companyName: ticket.company?.name || "",
      queueName: ticket.queue?.name || "",
      dueAt: ticket.dueAt || "",
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt
    }));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="hydria-crm-${kind}.csv"`);
  res.send(stringifyCsv(records, { header: true }));
}));

async function findCompanyByName(organizationId: string, ownerId: string, name = "") {
  const cleanName = name.trim();
  if (!cleanName) return null;
  const existing = await prisma.company.findFirst({
    where: { organizationId, name: { equals: cleanName, mode: "insensitive" } }
  });
  return existing || prisma.company.create({
    data: { organizationId, ownerId, name: cleanName }
  });
}

router.post("/import/:resource", upload.single("file"), asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const kind = resource(String(req.params.resource));
  if (!req.file) throw new HttpError("CSV file is required", 400);
  const rows = parseCsv(req.file.buffer.toString("utf8"), {
    bom: true, columns: true, skip_empty_lines: true, trim: true
  }) as Array<Record<string, string>>;
  if (rows.length > 5000) throw new HttpError("CSV import is limited to 5000 rows", 400);
  const organizationId = req.user!.organizationId;
  let imported = 0;
  const skipped: number[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      if (kind === "contacts") {
        if (!row.firstName || !row.lastName) throw new Error();
        const company = await findCompanyByName(organizationId, req.user!.id, row.companyName || "");
        const owner = row.ownerEmail
          ? await prisma.user.findFirst({
              where: { organizationId, email: { equals: row.ownerEmail, mode: "insensitive" } },
              select: { id: true }
            })
          : null;
        await prisma.contact.create({
          data: {
            organizationId,
            ownerId: owner?.id || req.user!.id,
            companyId: company?.id,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email || null,
            phone: row.phone || null,
            jobTitle: row.jobTitle || null,
            status: row.status || "lead",
            source: row.source || "csv"
          }
        });
      } else if (kind === "companies") {
        if (!row.name) throw new Error();
        await prisma.company.create({
          data: {
            organizationId, ownerId: req.user!.id, name: row.name,
            domain: row.domain || null, industry: row.industry || null, phone: row.phone || null,
            website: row.website || null, city: row.city || null, country: row.country || null
          }
        });
      } else if (kind === "leads") {
        if (!row.firstName || !row.lastName) throw new Error();
        await prisma.lead.create({
          data: {
            organizationId, ownerId: req.user!.id, firstName: row.firstName, lastName: row.lastName,
            companyName: row.companyName || null, email: row.email || null, phone: row.phone || null,
            source: row.source || "csv"
          }
        });
      } else if (kind === "products") {
        if (!row.name || !row.sku) throw new Error();
        await prisma.product.create({
          data: {
            organizationId, name: row.name, sku: row.sku.toUpperCase(),
            description: row.description || null, unitPrice: Number(row.unitPrice || 0),
            currency: (row.currency || "EUR").toUpperCase(), active: row.active !== "false"
          }
        });
      } else if (kind === "deals") {
        if (!row.name) throw new Error();
        const stage = await prisma.pipelineStage.findFirst({
          where: row.stageName
            ? { organizationId, name: { equals: row.stageName, mode: "insensitive" } }
            : { organizationId, isWon: false, isLost: false },
          orderBy: { position: "asc" }
        });
        if (!stage) throw new Error();
        await prisma.deal.create({
          data: {
            organizationId, ownerId: req.user!.id, stageId: stage.id, name: row.name,
            value: Number(row.value || 0), currency: (row.currency || "EUR").toUpperCase(),
            probability: Math.max(0, Math.min(100, Number(row.probability || 20)))
          }
        });
      } else if (kind === "tasks") {
        if (!row.title) throw new Error();
        await prisma.task.create({
          data: {
            organizationId,
            createdById: req.user!.id,
            assignedToId: req.user!.id,
            title: row.title,
            description: row.description || null,
            status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELED"]).catch("TODO").parse(row.status),
            priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).catch("MEDIUM").parse(row.priority),
            dueAt: row.dueAt ? new Date(row.dueAt) : null
          }
        });
      } else {
        if (!row.subject) throw new Error();
        const [assignedTo, contact, queue] = await Promise.all([
          row.assignedToEmail
            ? prisma.user.findFirst({
                where: { organizationId, email: { equals: row.assignedToEmail, mode: "insensitive" } },
                select: { id: true }
              })
            : null,
          row.contactEmail
            ? prisma.contact.findFirst({
                where: { organizationId, email: { equals: row.contactEmail, mode: "insensitive" } },
                select: { id: true, companyId: true, email: true }
              })
            : null,
          row.queueName
            ? prisma.supportQueue.findFirst({
                where: { organizationId, name: { equals: row.queueName, mode: "insensitive" } },
                select: { id: true }
              })
            : null
        ]);
        const company = contact?.companyId
          ? null
          : await findCompanyByName(organizationId, req.user!.id, row.companyName || "");
        const status = z.enum(["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"]).catch("OPEN").parse(row.status);
        const priority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).catch("MEDIUM").parse(row.priority);
        await prisma.ticket.create({
          data: {
            organizationId,
            createdById: req.user!.id,
            assignedToId: assignedTo?.id || req.user!.id,
            contactId: contact?.id,
            companyId: contact?.companyId || company?.id,
            queueId: queue?.id,
            number: row.number || `T-${randomUUID().slice(0, 8).toUpperCase()}`,
            subject: row.subject,
            description: row.description || null,
            status,
            priority,
            source: row.source || "CSV",
            customerEmail: row.customerEmail || contact?.email || null,
            dueAt: row.dueAt ? new Date(row.dueAt) : null,
            resolvedAt: ["RESOLVED", "CLOSED"].includes(status) ? new Date() : null
          }
        });
      }
      imported += 1;
    } catch {
      skipped.push(index + 2);
    }
  }
  res.status(201).json({ imported, skipped });
}));

export default router;
