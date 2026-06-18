import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody, parsePagination } from "../lib/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const automationAction = z.enum(["ASSIGN_OWNER", "CREATE_TASK", "SEND_EMAIL", "UPDATE_FIELD", "MOVE_DEAL_STAGE"]);
const automationStep = z.object({
  action: automationAction,
  configuration: z.record(z.unknown()),
  conditions: z.record(z.unknown()).optional(),
  delayMinutes: z.coerce.number().int().min(0).max(525_600).default(0)
});
const ruleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  trigger: z.enum(["LEAD_CREATED", "LEAD_STATUS_CHANGED", "DEAL_CREATED", "DEAL_STAGE_CHANGED", "TASK_OVERDUE", "QUOTE_ACCEPTED"]),
  action: automationAction,
  conditions: z.record(z.unknown()).default({}),
  configuration: z.record(z.unknown()),
  steps: z.array(automationStep).min(1).max(20).optional(),
  active: z.boolean().default(true),
  priority: z.coerce.number().int().min(1).max(1000).default(100)
});

router.use(requireAuth, requireRole("ADMIN", "MANAGER"));

router.get("/", asyncRoute(async (req, res) => {
  const rules = await prisma.automationRule.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
    include: { _count: { select: { runs: true } } }
  });
  res.json({ rules });
}));

router.post("/", asyncRoute(async (req, res) => {
  const input = parseBody(ruleSchema, req.body);
  const rule = await prisma.automationRule.create({
    data: {
      ...input,
      conditions: input.conditions as Prisma.InputJsonValue,
      configuration: input.configuration as Prisma.InputJsonValue,
      steps: input.steps as Prisma.InputJsonValue | undefined,
      organizationId: req.user!.organizationId,
      createdById: req.user!.id
    }
  });
  res.status(201).json({ rule });
}));

router.patch("/:id", asyncRoute(async (req, res) => {
  const input = parseBody(ruleSchema.partial(), req.body);
  const current = await prisma.automationRule.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId }
  });
  if (!current) throw new HttpError("Automation rule not found", 404);
  const rule = await prisma.automationRule.update({
    where: { id: current.id },
    data: {
      ...input,
      conditions: input.conditions as Prisma.InputJsonValue | undefined,
      configuration: input.configuration as Prisma.InputJsonValue | undefined,
      steps: input.steps as Prisma.InputJsonValue | undefined
    }
  });
  res.json({ rule });
}));

router.delete("/:id", asyncRoute(async (req, res) => {
  const result = await prisma.automationRule.deleteMany({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId }
  });
  if (!result.count) throw new HttpError("Automation rule not found", 404);
  res.status(204).end();
}));

router.get("/runs/history", asyncRoute(async (req, res) => {
  const { limit, skip, page } = parsePagination(req.query);
  const where = { organizationId: req.user!.organizationId };
  const [runs, total] = await prisma.$transaction([
    prisma.automationRun.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { rule: { select: { id: true, name: true, trigger: true, action: true } } }
    }),
    prisma.automationRun.count({ where })
  ]);
  res.json({ runs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

export default router;
