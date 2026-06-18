import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { assertCanWrite, requireAuth, requireRole } from "../middleware/auth.js";
import { calculateLeadScore, scheduleSequenceEnrollment } from "../services/salesOps.js";

const router = Router();
router.use(requireAuth);

const sequenceStep = z.object({
  type: z.enum(["EMAIL", "TASK"]),
  delayDays: z.coerce.number().int().min(0).max(365).default(0),
  subject: z.string().max(240).optional(),
  body: z.string().max(100_000).optional(),
  title: z.string().max(240).optional()
}).refine((step) => step.type === "EMAIL" ? Boolean(step.subject && step.body) : Boolean(step.title), {
  message: "Email steps require subject and body; task steps require a title"
});

router.get("/", asyncRoute(async (req, res) => {
  const organizationId = req.user!.organizationId;
  const [territories, campaigns, sequences, enrollments] = await Promise.all([
    prisma.territory.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true, leads: true, deals: true } } }
    }),
    prisma.campaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        leads: { select: { id: true } },
        deals: { select: { id: true, value: true, status: true } }
      }
    }),
    prisma.sequence.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { enrollments: true } } }
    }),
    prisma.sequenceEnrollment.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        sequence: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } }
      }
    })
  ]);
  res.json({
    territories,
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      leadCount: campaign.leads.length,
      dealCount: campaign.deals.length,
      wonRevenue: campaign.deals
        .filter((deal) => deal.status === "WON")
        .reduce((sum, deal) => sum + Number(deal.value), 0)
    })),
    sequences,
    enrollments
  });
}));

router.post("/territories", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(1000).optional().nullable(),
    countries: z.array(z.string().min(2).max(80)).max(200).default([]),
    active: z.boolean().default(true)
  }), req.body);
  const territory = await prisma.territory.create({
    data: { ...input, countries: input.countries, organizationId: req.user!.organizationId }
  });
  res.status(201).json({ territory });
}));

router.patch("/territories/:id", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(1000).nullable().optional(),
    countries: z.array(z.string().min(2).max(80)).max(200).optional(),
    active: z.boolean().optional()
  }), req.body);
  const current = await prisma.territory.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!current) throw new HttpError("Territory not found", 404);
  res.json({ territory: await prisma.territory.update({ where: { id: current.id }, data: input }) });
}));

router.post("/campaigns", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    name: z.string().min(1).max(160),
    channel: z.string().min(1).max(80),
    status: z.enum(["PLANNED", "ACTIVE", "PAUSED", "COMPLETED"]).default("PLANNED"),
    budget: z.coerce.number().nonnegative().optional().nullable(),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
    description: z.string().max(2000).optional().nullable()
  }), req.body);
  const campaign = await prisma.campaign.create({
    data: {
      ...input,
      organizationId: req.user!.organizationId,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null
    }
  });
  res.status(201).json({ campaign });
}));

router.patch("/campaigns/:id", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    name: z.string().min(1).max(160).optional(),
    channel: z.string().min(1).max(80).optional(),
    status: z.enum(["PLANNED", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
    budget: z.coerce.number().nonnegative().nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    description: z.string().max(2000).nullable().optional()
  }), req.body);
  const current = await prisma.campaign.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!current) throw new HttpError("Campaign not found", 404);
  res.json({
    campaign: await prisma.campaign.update({
      where: { id: current.id },
      data: {
        ...input,
        startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt === undefined ? undefined : input.endsAt ? new Date(input.endsAt) : null
      }
    })
  });
}));

router.post("/sequences", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    name: z.string().min(1).max(160),
    description: z.string().max(2000).optional().nullable(),
    active: z.boolean().default(true),
    steps: z.array(sequenceStep).min(1).max(20)
  }), req.body);
  const sequence = await prisma.sequence.create({
    data: {
      organizationId: req.user!.organizationId,
      createdById: req.user!.id,
      name: input.name,
      description: input.description,
      active: input.active,
      steps: input.steps as Prisma.InputJsonValue
    }
  });
  res.status(201).json({ sequence });
}));

router.patch("/sequences/:id", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    name: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).nullable().optional(),
    active: z.boolean().optional(),
    steps: z.array(sequenceStep).min(1).max(20).optional()
  }), req.body);
  const current = await prisma.sequence.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!current) throw new HttpError("Sequence not found", 404);
  const sequence = await prisma.sequence.update({
    where: { id: current.id },
    data: { ...input, steps: input.steps as Prisma.InputJsonValue | undefined }
  });
  res.json({ sequence });
}));

router.post("/sequences/:id/enroll", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(z.object({
    leadId: z.string().uuid().optional().nullable(),
    contactId: z.string().uuid().optional().nullable()
  }).refine((value) => Boolean(value.leadId || value.contactId), { message: "A lead or contact is required" }), req.body);
  const organizationId = req.user!.organizationId;
  const [sequence, lead, contact] = await Promise.all([
    prisma.sequence.findFirst({ where: { id: String(req.params.id), organizationId, active: true } }),
    input.leadId ? prisma.lead.findFirst({ where: { id: input.leadId, organizationId } }) : null,
    input.contactId ? prisma.contact.findFirst({ where: { id: input.contactId, organizationId } }) : null
  ]);
  if (!sequence) throw new HttpError("Sequence not found", 404);
  if (input.leadId && !lead) throw new HttpError("Lead not found", 404);
  if (input.contactId && !contact) throw new HttpError("Contact not found", 404);
  const email = lead?.email || contact?.email;
  if (!email) throw new HttpError("The selected record has no email address", 409);
  const enrollment = await prisma.sequenceEnrollment.create({
    data: { organizationId, sequenceId: sequence.id, leadId: lead?.id, contactId: contact?.id, email }
  });
  await scheduleSequenceEnrollment(enrollment.id);
  res.status(201).json({ enrollment });
}));

router.patch("/enrollments/:id", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(z.object({ status: z.enum(["ACTIVE", "PAUSED", "CANCELED"]) }), req.body);
  const current = await prisma.sequenceEnrollment.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!current) throw new HttpError("Sequence enrollment not found", 404);
  const enrollment = await prisma.sequenceEnrollment.update({
    where: { id: current.id },
    data: { status: input.status, nextRunAt: input.status === "ACTIVE" ? current.nextRunAt : null }
  });
  if (input.status === "ACTIVE") await scheduleSequenceEnrollment(enrollment.id);
  res.json({ enrollment });
}));

router.post("/scoring/recalculate", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const leads = await prisma.lead.findMany({ where: { organizationId: req.user!.organizationId } });
  await prisma.$transaction(leads.map((lead) => prisma.lead.update({
    where: { id: lead.id },
    data: { score: calculateLeadScore(lead) }
  })));
  res.json({ updated: leads.length });
}));

export default router;
