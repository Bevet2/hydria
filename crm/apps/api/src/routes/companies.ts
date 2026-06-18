import { Router } from "express";
import { rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody, parsePagination } from "../lib/http.js";
import { assertUserInOrganization } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";

const router = Router();
const attachmentRoot = path.resolve(env.ATTACHMENT_DIR);

const companySchema = z.object({
  name: z.string().min(1).max(160),
  domain: z.string().max(160).optional(),
  industry: z.string().max(100).optional(),
  size: z.coerce.number().int().nonnegative().optional().nullable(),
  phone: z.string().max(40).optional(),
  website: z.string().url().optional().or(z.literal("")),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  ownerId: z.string().uuid().optional().nullable()
});

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = String(req.query.search || "").trim();
    const where = {
      organizationId: req.user!.organizationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { domain: { contains: search, mode: "insensitive" as const } },
              { industry: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const [companies, total] = await prisma.$transaction([
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { contacts: true, deals: true, tasks: true } }
        }
      }),
      prisma.company.count({ where })
    ]);
    res.json({ companies, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  })
);

router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const company = await prisma.company.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        contacts: { orderBy: { updatedAt: "desc" } },
        deals: { include: { stage: true, owner: true }, orderBy: { updatedAt: "desc" } },
        tickets: {
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            contact: { select: { id: true, firstName: true, lastName: true } },
            queue: { select: { id: true, name: true } }
          }
        },
        tasks: { orderBy: { createdAt: "desc" } },
        notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
        activities: { orderBy: { occurredAt: "desc" }, take: 30 }
      }
    });
    if (!company) {
      throw new HttpError("Company not found", 404);
    }
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
    const openDealsValue = openDeals.reduce((total, deal) => total + Number(deal.value), 0);
    const wonDealsValue = wonDeals.reduce((total, deal) => total + Number(deal.value), 0);
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
    if (overdueTickets.length) {
      nextBestActions.push({
        title: "Resolve overdue support tickets",
        detail: `${overdueTickets.length} ticket${overdueTickets.length > 1 ? "s are" : " is"} past SLA.`,
        severity: "critical"
      });
    }
    if (overdueTasks.length) {
      nextBestActions.push({
        title: "Close overdue account tasks",
        detail: `${overdueTasks.length} task${overdueTasks.length > 1 ? "s need" : " needs"} follow-up.`,
        severity: "warning"
      });
    }
    if (!openDeals.length) {
      nextBestActions.push({
        title: "Create or qualify the next opportunity",
        detail: "There is no open pipeline attached to this account.",
        severity: "opportunity"
      });
    }
    if (daysSinceLastActivity > 30) {
      nextBestActions.push({
        title: "Schedule an account touchpoint",
        detail: `No activity has been logged for ${daysSinceLastActivity} days.`,
        severity: "warning"
      });
    }
    if (!company.contacts.length) {
      nextBestActions.push({
        title: "Add a buying committee contact",
        detail: "The account has no known contacts yet.",
        severity: "info"
      });
    }
    if (!nextBestActions.length) {
      nextBestActions.push({
        title: "Keep the account warm",
        detail: "Review open work and prepare the next customer check-in.",
        severity: "info"
      });
    }
    res.json({
      company: {
        ...company,
        customer360: {
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
          daysSinceLastActivity,
          healthScore,
          healthLabel: healthScore >= 80 ? "Healthy" : healthScore >= 55 ? "Watch" : "At risk",
          nextBestActions: nextBestActions.slice(0, 4)
        }
      }
    });
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(companySchema, req.body);
    await assertUserInOrganization(req.user!.organizationId, input.ownerId);
    const company = await prisma.company.create({
      data: {
        ...input,
        website: input.website || null,
        organizationId: req.user!.organizationId,
        ownerId: input.ownerId || req.user!.id
      }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      companyId: company.id,
      type: "RECORD_CREATED",
      subject: `Created company ${company.name}`
    });
    res.status(201).json({ company });
  })
);

router.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(companySchema.partial(), req.body);
    const current = await prisma.company.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) {
      throw new HttpError("Company not found", 404);
    }
    await assertUserInOrganization(req.user!.organizationId, input.ownerId);
    const company = await prisma.company.update({
      where: { id: current.id },
      data: { ...input, website: input.website === "" ? null : input.website }
    });
    res.json({ company });
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const current = await prisma.company.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) {
      throw new HttpError("Company not found", 404);
    }
    const attachments = await prisma.attachment.findMany({
      where: { organizationId: req.user!.organizationId, entityType: "COMPANY", entityId: current.id },
      select: { storageKey: true }
    });
    await prisma.$transaction([
      prisma.attachment.deleteMany({
        where: { organizationId: req.user!.organizationId, entityType: "COMPANY", entityId: current.id }
      }),
      prisma.customFieldValue.deleteMany({
        where: {
          organizationId: req.user!.organizationId,
          entityId: current.id,
          definition: { entityType: "COMPANY" }
        }
      }),
      prisma.company.delete({ where: { id: current.id } })
    ]);
    await Promise.all(attachments.map((item) => rm(path.join(attachmentRoot, item.storageKey), { force: true })));
    res.status(204).end();
  })
);

export default router;
