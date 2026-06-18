import { Router } from "express";
import { rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { assertCrmRelations } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth, requireRole } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import { triggerAutomations } from "../services/automations.js";

const router = Router();
const attachmentRoot = path.resolve(env.ATTACHMENT_DIR);

const nullableDate = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value ? new Date(value) : null));

const stageFields = z.object({
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#667b74"),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false)
});

const stageSchema = stageFields
  .refine((value) => !(value.isWon && value.isLost), {
    message: "A pipeline stage cannot be both won and lost"
  });

const dealSchema = z.object({
  name: z.string().min(1).max(160),
  value: z.coerce.number().min(0).default(0),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).default("EUR"),
  probability: z.coerce.number().int().min(0).max(100).default(20),
  forecastCategory: z
    .enum(["PIPELINE", "BEST_CASE", "COMMIT", "CLOSED", "OMITTED"])
    .default("PIPELINE"),
  description: z.string().max(4000).optional(),
  nextStep: z.string().max(500).optional(),
  stageId: z.string().uuid(),
  companyId: z.string().uuid().optional().nullable(),
  primaryContactId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  expectedCloseAt: nullableDate,
  campaignId: z.string().uuid().optional().nullable(),
  territoryId: z.string().uuid().optional().nullable(),
  lostReason: z.string().max(500).optional().nullable(),
  competitor: z.string().max(160).optional().nullable()
});

async function assertDealOperationsRelations(organizationId: string, input: { campaignId?: string | null; territoryId?: string | null }) {
  const [campaign, territory] = await Promise.all([
    input.campaignId ? prisma.campaign.findFirst({ where: { id: input.campaignId, organizationId } }) : null,
    input.territoryId ? prisma.territory.findFirst({ where: { id: input.territoryId, organizationId } }) : null
  ]);
  if (input.campaignId && !campaign) throw new HttpError("Campaign not found", 404);
  if (input.territoryId && !territory) throw new HttpError("Territory not found", 404);
}

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const organizationId = req.user!.organizationId;
    const [stages, deals] = await prisma.$transaction([
      prisma.pipelineStage.findMany({
        where: { organizationId },
        orderBy: { position: "asc" }
      }),
      prisma.deal.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          primaryContact: { select: { id: true, firstName: true, lastName: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
          campaign: { select: { id: true, name: true } },
          territory: { select: { id: true, name: true } },
          stage: true,
          _count: { select: { tasks: true, notes: true, activities: true } }
        }
      })
    ]);
    res.json({ stages, deals });
  })
);

router.get(
  "/deals/:id",
  asyncRoute(async (req, res) => {
    const deal = await prisma.deal.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      include: {
        company: true,
        primaryContact: true,
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        campaign: true,
        territory: true,
        stage: true,
        lineItems: { include: { product: true }, orderBy: { createdAt: "asc" } },
        quotes: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { lineItems: true } } }
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          include: { assignedTo: { select: { firstName: true, lastName: true } } }
        },
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
    if (!deal) throw new HttpError("Deal not found", 404);
    res.json({ deal });
  })
);

router.post(
  "/stages",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const input = parseBody(stageSchema, req.body);
    const last = await prisma.pipelineStage.findFirst({
      where: { organizationId: req.user!.organizationId },
      orderBy: { position: "desc" }
    });
    const stage = await prisma.pipelineStage.create({
      data: {
        organizationId: req.user!.organizationId,
        name: input.name,
        color: input.color,
        position: (last?.position ?? -1) + 1,
        isWon: input.isWon,
        isLost: input.isLost
      }
    });
    res.status(201).json({ stage });
  })
);

router.patch(
  "/stages/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const input = parseBody(stageFields.partial(), req.body);
    if (input.isWon && input.isLost) {
      throw new HttpError("A pipeline stage cannot be both won and lost", 400);
    }
    const current = await prisma.pipelineStage.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Pipeline stage not found", 404);
    const nextWon = input.isWon ?? current.isWon;
    const nextLost = input.isLost ?? current.isLost;
    if (nextWon && nextLost) {
      throw new HttpError("A pipeline stage cannot be both won and lost", 400);
    }
    const stage = await prisma.pipelineStage.update({ where: { id: current.id }, data: input });
    res.json({ stage });
  })
);

router.delete(
  "/stages/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const current = await prisma.pipelineStage.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      include: { _count: { select: { deals: true } } }
    });
    if (!current) throw new HttpError("Pipeline stage not found", 404);
    if (current._count.deals) {
      throw new HttpError("Move or delete the deals in this stage first", 409);
    }
    await prisma.pipelineStage.delete({ where: { id: current.id } });
    res.status(204).end();
  })
);

router.post(
  "/deals",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(dealSchema, req.body);
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: input.stageId, organizationId: req.user!.organizationId }
    });
    if (!stage) throw new HttpError("Pipeline stage not found", 404);
    await assertCrmRelations(req.user!.organizationId, {
      ownerId: input.ownerId,
      companyId: input.companyId,
      contactId: input.primaryContactId
    });
    await assertDealOperationsRelations(req.user!.organizationId, input);
    const deal = await prisma.deal.create({
      data: {
        ...input,
        organizationId: req.user!.organizationId,
        ownerId: input.ownerId || req.user!.id,
        status: stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN",
        forecastCategory: stage.isWon
          ? "CLOSED"
          : stage.isLost
            ? "OMITTED"
            : input.forecastCategory
      },
      include: { company: true, stage: true, owner: true }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      dealId: deal.id,
      companyId: deal.companyId || undefined,
      type: "RECORD_CREATED",
      subject: `Created deal ${deal.name}`
    });
    await triggerAutomations(req.user!.organizationId, "DEAL_CREATED", {
      entityType: "deal",
      entityId: deal.id,
      fields: {
        name: deal.name,
        value: Number(deal.value),
        stageId: deal.stageId,
        stageName: deal.stage.name,
        status: deal.status
      }
    });
    res.status(201).json({ deal });
  })
);

router.patch(
  "/deals/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(dealSchema.partial(), req.body);
    const current = await prisma.deal.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Deal not found", 404);
    const stageId = input.stageId || current.stageId;
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, organizationId: req.user!.organizationId }
    });
    if (!stage) throw new HttpError("Pipeline stage not found", 404);
    if (stage.isLost && !(input.lostReason || current.lostReason)) {
      throw new HttpError("A lost reason is required when closing an opportunity as lost", 400);
    }
    await assertCrmRelations(req.user!.organizationId, {
      ownerId: input.ownerId,
      companyId: input.companyId,
      contactId: input.primaryContactId
    });
    await assertDealOperationsRelations(req.user!.organizationId, input);
    const deal = await prisma.deal.update({
      where: { id: current.id },
      data: {
        ...input,
        stageId,
        lostReason: stage.isLost ? input.lostReason ?? current.lostReason : null,
        competitor: stage.isLost ? input.competitor ?? current.competitor : null,
        status: stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN",
        forecastCategory: stage.isWon
          ? "CLOSED"
          : stage.isLost
            ? "OMITTED"
            : input.forecastCategory || current.forecastCategory
      },
      include: { company: true, stage: true, owner: true }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      dealId: deal.id,
      companyId: deal.companyId || undefined,
      type: current.stageId === stageId ? "RECORD_UPDATED" : "DEAL_STAGE_CHANGED",
      subject:
        current.stageId === stageId
          ? `Updated deal ${deal.name}`
          : `Moved ${deal.name} to ${stage.name}`,
      metadata: { previousStageId: current.stageId, stageId }
    });
    if (current.stageId !== stageId) {
      await triggerAutomations(req.user!.organizationId, "DEAL_STAGE_CHANGED", {
        entityType: "deal",
        entityId: deal.id,
        fields: {
          name: deal.name,
          value: Number(deal.value),
          previousStageId: current.stageId,
          stageId,
          stageName: stage.name,
          status: deal.status
        }
      });
    }
    res.json({ deal });
  })
);

router.delete(
  "/deals/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const current = await prisma.deal.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Deal not found", 404);
    const attachments = await prisma.attachment.findMany({
      where: { organizationId: req.user!.organizationId, entityType: "DEAL", entityId: current.id },
      select: { storageKey: true }
    });
    await prisma.$transaction([
      prisma.attachment.deleteMany({
        where: { organizationId: req.user!.organizationId, entityType: "DEAL", entityId: current.id }
      }),
      prisma.customFieldValue.deleteMany({
        where: {
          organizationId: req.user!.organizationId,
          entityId: current.id,
          definition: { entityType: "DEAL" }
        }
      }),
      prisma.deal.delete({ where: { id: current.id } })
    ]);
    await Promise.all(attachments.map((item) => rm(path.join(attachmentRoot, item.storageKey), { force: true })));
    res.status(204).end();
  })
);

export default router;
