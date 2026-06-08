import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { assertCrmRelations } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";

const router = Router();
const relationSchema = z
  .object({
    contactId: z.string().uuid().optional().nullable(),
    companyId: z.string().uuid().optional().nullable(),
    dealId: z.string().uuid().optional().nullable(),
    leadId: z.string().uuid().optional().nullable()
  })
  .refine((value) => value.contactId || value.companyId || value.dealId || value.leadId, {
    message: "A contact, company, deal or lead is required"
  });

router.use(requireAuth);

router.get(
  "/activities",
  asyncRoute(async (req, res) => {
    const activities = await prisma.activity.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { occurredAt: "desc" },
      take: Math.min(100, Number(req.query.limit) || 40),
      include: {
        actor: { select: { firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    res.json({ activities });
  })
);

router.post(
  "/activities",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(
      relationSchema.and(
        z.object({
          type: z.enum(["CALL", "EMAIL", "MEETING"]),
          subject: z.string().min(1).max(180),
          body: z.string().max(4000).optional(),
          occurredAt: z.string().optional()
        })
      ),
      req.body
    );
    await assertCrmRelations(req.user!.organizationId, input);
    const activity = await prisma.activity.create({
      data: {
        ...input,
        organizationId: req.user!.organizationId,
        actorId: req.user!.id,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date()
      }
    });
    res.status(201).json({ activity });
  })
);

router.post(
  "/notes",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(
      relationSchema.and(z.object({ body: z.string().min(1).max(10000) })),
      req.body
    );
    await assertCrmRelations(req.user!.organizationId, input);
    const note = await prisma.note.create({
      data: {
        ...input,
        organizationId: req.user!.organizationId,
        authorId: req.user!.id
      },
      include: { author: { select: { firstName: true, lastName: true } } }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      contactId: input.contactId || undefined,
      companyId: input.companyId || undefined,
      dealId: input.dealId || undefined,
      leadId: input.leadId || undefined,
      type: "NOTE",
      subject: "Added a note",
      body: input.body.slice(0, 500)
    });
    res.status(201).json({ note });
  })
);

router.delete(
  "/notes/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const note = await prisma.note.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!note) throw new HttpError("Note not found", 404);
    await prisma.note.delete({ where: { id: note.id } });
    res.status(204).end();
  })
);

export default router;
