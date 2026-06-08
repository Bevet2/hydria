import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { assertCrmRelations } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";

const router = Router();
const taskSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().max(2000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueAt: z
    .string()
    .optional()
    .nullable()
    .transform((value) => (value ? new Date(value) : null)),
  assignedToId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable()
});

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const status = String(req.query.status || "");
    const tasks = await prisma.task.findMany({
      where: {
        organizationId: req.user!.organizationId,
        ...(status ? { status: status as "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED" } : {})
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    res.json({ tasks });
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(taskSchema, req.body);
    await assertCrmRelations(req.user!.organizationId, input);
    const task = await prisma.task.create({
      data: {
        ...input,
        organizationId: req.user!.organizationId,
        createdById: req.user!.id,
        assignedToId: input.assignedToId || req.user!.id,
        completedAt: input.status === "DONE" ? new Date() : null
      },
      include: { assignedTo: true, contact: true, company: true, deal: true, lead: true }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      contactId: task.contactId || undefined,
      companyId: task.companyId || undefined,
      dealId: task.dealId || undefined,
      leadId: task.leadId || undefined,
      type: "TASK",
      subject: `Created task ${task.title}`
    });
    res.status(201).json({ task });
  })
);

router.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(taskSchema.partial(), req.body);
    const current = await prisma.task.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Task not found", 404);
    await assertCrmRelations(req.user!.organizationId, input);
    const task = await prisma.task.update({
      where: { id: current.id },
      data: {
        ...input,
        completedAt:
          input.status === "DONE"
            ? current.completedAt || new Date()
            : input.status
              ? null
              : undefined
      },
      include: { assignedTo: true, contact: true, company: true, deal: true, lead: true }
    });
    res.json({ task });
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const current = await prisma.task.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Task not found", 404);
    await prisma.task.delete({ where: { id: current.id } });
    res.status(204).end();
  })
);

export default router;
