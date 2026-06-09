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
import { triggerAutomations } from "../services/automations.js";

const router = Router();
const attachmentRoot = path.resolve(env.ATTACHMENT_DIR);

const leadSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  companyName: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  jobTitle: z.string().max(120).optional(),
  website: z.string().url().optional().or(z.literal("")),
  source: z.string().max(80).optional(),
  status: z.enum(["NEW", "WORKING", "QUALIFIED", "UNQUALIFIED", "CONVERTED"]).default("NEW"),
  rating: z.enum(["HOT", "WARM", "COLD"]).default("WARM"),
  annualRevenue: z.coerce.number().nonnegative().optional().nullable(),
  employeeCount: z.coerce.number().int().nonnegative().optional().nullable(),
  description: z.string().max(4000).optional(),
  ownerId: z.string().uuid().optional().nullable()
});

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").toUpperCase();
    const rating = String(req.query.rating || "").toUpperCase();
    const where = {
      organizationId: req.user!.organizationId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { companyName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(["NEW", "WORKING", "QUALIFIED", "UNQUALIFIED", "CONVERTED"].includes(status)
        ? { status: status as "NEW" | "WORKING" | "QUALIFIED" | "UNQUALIFIED" | "CONVERTED" }
        : {}),
      ...(["HOT", "WARM", "COLD"].includes(rating)
        ? { rating: rating as "HOT" | "WARM" | "COLD" }
        : {})
    };
    const [leads, total] = await prisma.$transaction([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ rating: "asc" }, { updatedAt: "desc" }],
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { tasks: true, notes: true, activities: true } }
        }
      }),
      prisma.lead.count({ where })
    ]);
    res.json({ leads, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  })
);

router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const lead = await prisma.lead.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        convertedCompany: true,
        convertedContact: true,
        convertedDeal: { include: { stage: true } },
        tasks: { orderBy: { createdAt: "desc" } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { firstName: true, lastName: true } } }
        },
        activities: {
          orderBy: { occurredAt: "desc" },
          take: 40,
          include: { actor: { select: { firstName: true, lastName: true } } }
        }
      }
    });
    if (!lead) throw new HttpError("Lead not found", 404);
    res.json({ lead });
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(leadSchema, req.body);
    await assertUserInOrganization(req.user!.organizationId, input.ownerId);
    const lead = await prisma.lead.create({
      data: {
        ...input,
        email: input.email || null,
        website: input.website || null,
        organizationId: req.user!.organizationId,
        ownerId: input.ownerId || req.user!.id
      },
      include: { owner: true }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      leadId: lead.id,
      type: "RECORD_CREATED",
      subject: `Created lead ${lead.firstName} ${lead.lastName}`
    });
    await triggerAutomations(req.user!.organizationId, "LEAD_CREATED", {
      entityType: "lead",
      entityId: lead.id,
      fields: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        status: lead.status,
        rating: lead.rating,
        source: lead.source
      }
    });
    res.status(201).json({ lead });
  })
);

router.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(leadSchema.partial(), req.body);
    const current = await prisma.lead.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Lead not found", 404);
    if (current.status === "CONVERTED") throw new HttpError("Converted leads are read-only", 409);
    await assertUserInOrganization(req.user!.organizationId, input.ownerId);
    const lead = await prisma.lead.update({
      where: { id: current.id },
      data: {
        ...input,
        email: input.email === "" ? null : input.email,
        website: input.website === "" ? null : input.website
      }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      leadId: lead.id,
      type: "RECORD_UPDATED",
      subject: `Updated lead ${lead.firstName} ${lead.lastName}`
    });
    if (input.status && input.status !== current.status) {
      await triggerAutomations(req.user!.organizationId, "LEAD_STATUS_CHANGED", {
        entityType: "lead",
        entityId: lead.id,
        fields: {
          previousStatus: current.status,
          status: lead.status,
          rating: lead.rating,
          email: lead.email,
          source: lead.source
        }
      });
    }
    res.json({ lead });
  })
);

router.post(
  "/:id/convert",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(
      z.object({
        companyId: z.string().uuid().optional().nullable(),
        companyName: z.string().max(160).optional(),
        createDeal: z.boolean().default(true),
        dealName: z.string().max(160).optional(),
        dealValue: z.coerce.number().nonnegative().default(0),
        stageId: z.string().uuid().optional(),
        expectedCloseAt: z.string().optional().nullable()
      }),
      req.body
    );
    const organizationId = req.user!.organizationId;
    const lead = await prisma.lead.findFirst({
      where: { id: String(req.params.id), organizationId }
    });
    if (!lead) throw new HttpError("Lead not found", 404);
    if (lead.status === "CONVERTED") throw new HttpError("Lead already converted", 409);

    const converted = await prisma.$transaction(async (tx) => {
      let company = input.companyId
        ? await tx.company.findFirst({ where: { id: input.companyId, organizationId } })
        : null;
      if (input.companyId && !company) throw new HttpError("Company not found", 404);
      if (!company && (input.companyName || lead.companyName)) {
        company = await tx.company.create({
          data: {
            organizationId,
            ownerId: lead.ownerId || req.user!.id,
            name: input.companyName || lead.companyName!,
            website: lead.website,
            size: lead.employeeCount
          }
        });
      }

      const contact = await tx.contact.create({
        data: {
          organizationId,
          ownerId: lead.ownerId || req.user!.id,
          companyId: company?.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          jobTitle: lead.jobTitle,
          status: "qualified",
          source: lead.source
        }
      });

      let deal = null;
      if (input.createDeal) {
        const stage = input.stageId
          ? await tx.pipelineStage.findFirst({ where: { id: input.stageId, organizationId } })
          : await tx.pipelineStage.findFirst({
              where: { organizationId, isWon: false, isLost: false },
              orderBy: { position: "asc" }
            });
        if (!stage) throw new HttpError("No open pipeline stage found", 409);
        deal = await tx.deal.create({
          data: {
            organizationId,
            ownerId: lead.ownerId || req.user!.id,
            companyId: company?.id,
            primaryContactId: contact.id,
            stageId: stage.id,
            name: input.dealName || `${lead.companyName || lead.lastName} opportunity`,
            value: input.dealValue,
            probability: Math.max(20, stage.position * 20),
            forecastCategory: "PIPELINE",
            expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null
          }
        });
      }

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: "CONVERTED",
          convertedAt: new Date(),
          convertedCompanyId: company?.id,
          convertedContactId: contact.id,
          convertedDealId: deal?.id
        }
      });
      await tx.activity.create({
        data: {
          organizationId,
          actorId: req.user!.id,
          leadId: lead.id,
          companyId: company?.id,
          contactId: contact.id,
          dealId: deal?.id,
          type: "LEAD_CONVERTED",
          subject: `Converted lead ${lead.firstName} ${lead.lastName}`,
          metadata: {
            companyId: company?.id || null,
            contactId: contact.id,
            dealId: deal?.id || null
          }
        }
      });
      return { lead: updatedLead, company, contact, deal };
    });

    res.json(converted);
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const lead = await prisma.lead.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!lead) throw new HttpError("Lead not found", 404);
    const attachments = await prisma.attachment.findMany({
      where: { organizationId: req.user!.organizationId, entityType: "LEAD", entityId: lead.id },
      select: { storageKey: true }
    });
    await prisma.$transaction([
      prisma.attachment.deleteMany({
        where: { organizationId: req.user!.organizationId, entityType: "LEAD", entityId: lead.id }
      }),
      prisma.customFieldValue.deleteMany({
        where: {
          organizationId: req.user!.organizationId,
          entityId: lead.id,
          definition: { entityType: "LEAD" }
        }
      }),
      prisma.lead.delete({ where: { id: lead.id } })
    ]);
    await Promise.all(attachments.map((item) => rm(path.join(attachmentRoot, item.storageKey), { force: true })));
    res.status(204).end();
  })
);

export default router;
