import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { assertCrmRelations } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import { createNotification } from "../services/notifications.js";

const router = Router();
const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value ? new Date(value) : null));
const taskSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().max(2000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueAt: optionalDate,
  reminderAt: optionalDate,
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("NONE"),
  recurrenceInterval: z.coerce.number().int().min(1).max(52).default(1),
  recurrenceEndsAt: optionalDate,
  assignedToId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable()
});

function nextOccurrence(date: Date, recurrence: "DAILY" | "WEEKLY" | "MONTHLY", interval: number) {
  const next = new Date(date);
  if (recurrence === "DAILY") next.setDate(next.getDate() + interval);
  if (recurrence === "WEEKLY") next.setDate(next.getDate() + interval * 7);
  if (recurrence === "MONTHLY") next.setMonth(next.getMonth() + interval);
  return next;
}

function assertSchedule(input: {
  dueAt?: Date | null;
  reminderAt?: Date | null;
  recurrence?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  recurrenceEndsAt?: Date | null;
}) {
  if (input.recurrence && input.recurrence !== "NONE" && !input.dueAt) {
    throw new HttpError("Recurring tasks require a due date", 400);
  }
  if (input.reminderAt && input.dueAt && input.reminderAt > input.dueAt) {
    throw new HttpError("Reminder must be scheduled before the due date", 400);
  }
  if (input.recurrenceEndsAt && input.dueAt && input.recurrenceEndsAt < input.dueAt) {
    throw new HttpError("Recurrence end must be after the first due date", 400);
  }
}

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const status = String(req.query.status || "").toUpperCase();
    const priority = String(req.query.priority || "").toUpperCase();
    const assignedToId = String(req.query.assignedToId || "");
    const relationType = String(req.query.relationType || "");
    const relationId = String(req.query.relationId || "");
    const overdue = String(req.query.overdue || "") === "true";
    const recurring = String(req.query.recurring || "") === "true";
    const now = new Date();
    const tasks = await prisma.task.findMany({
      where: {
        organizationId: req.user!.organizationId,
        ...(["TODO", "IN_PROGRESS", "DONE", "CANCELED"].includes(status)
          ? { status: status as "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED" }
          : {}),
        ...(["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)
          ? { priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" }
          : {}),
        ...(assignedToId === "me"
          ? { assignedToId: req.user!.id }
          : assignedToId
            ? { assignedToId }
            : {}),
        ...(overdue
          ? {
              dueAt: { lt: now },
              status: { in: ["TODO", "IN_PROGRESS"] as ("TODO" | "IN_PROGRESS")[] }
            }
          : {}),
        ...(recurring ? { recurrence: { not: "NONE" as const } } : {}),
        ...(relationId && ["contact", "company", "deal", "lead"].includes(relationType)
          ? { [`${relationType}Id`]: relationId }
          : {})
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
    assertSchedule(input);
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
    if (task.assignedToId && task.assignedToId !== req.user!.id) {
      await createNotification({
        organizationId: req.user!.organizationId,
        userId: task.assignedToId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        eventKey: `task:${task.id}:assigned:${task.assignedToId}`,
        title: `Task assigned: ${task.title}`,
        body: task.dueAt ? "A dated task has been assigned to you." : undefined
      });
    }
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
    const schedule = {
      dueAt: input.dueAt === undefined ? current.dueAt : input.dueAt,
      reminderAt: input.reminderAt === undefined ? current.reminderAt : input.reminderAt,
      recurrence: input.recurrence === undefined ? current.recurrence : input.recurrence,
      recurrenceInterval: input.recurrenceInterval === undefined
        ? current.recurrenceInterval
        : input.recurrenceInterval,
      recurrenceEndsAt: input.recurrenceEndsAt === undefined
        ? current.recurrenceEndsAt
        : input.recurrenceEndsAt
    };
    assertSchedule(schedule);
    const completing = current.status !== "DONE" && input.status === "DONE";
    const shouldProcessRecurrence =
      completing &&
      schedule.recurrence !== "NONE" &&
      Boolean(schedule.dueAt) &&
      !current.recurrenceProcessedAt;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: current.id },
        data: {
          ...input,
          reminderSentAt: input.reminderAt !== undefined ? null : undefined,
          overdueNotifiedAt:
            input.dueAt !== undefined || (input.status && !["DONE", "CANCELED"].includes(input.status))
              ? null
              : undefined,
          recurrenceProcessedAt: shouldProcessRecurrence ? now : undefined,
          completedAt:
            input.status === "DONE"
              ? current.completedAt || now
              : input.status
                ? null
                : undefined
        },
        include: { assignedTo: true, contact: true, company: true, deal: true, lead: true }
      });

      let nextTask = null;
      if (shouldProcessRecurrence && schedule.dueAt && schedule.recurrence !== "NONE") {
        const nextDueAt = nextOccurrence(
          schedule.dueAt,
          schedule.recurrence,
          schedule.recurrenceInterval
        );
        if (!schedule.recurrenceEndsAt || nextDueAt <= schedule.recurrenceEndsAt) {
          const reminderOffset = schedule.reminderAt
            ? schedule.dueAt.getTime() - schedule.reminderAt.getTime()
            : null;
          nextTask = await tx.task.create({
            data: {
              organizationId: current.organizationId,
              createdById: current.createdById,
              assignedToId: input.assignedToId === undefined ? current.assignedToId : input.assignedToId,
              contactId: current.contactId,
              companyId: current.companyId,
              dealId: current.dealId,
              leadId: current.leadId,
              title: input.title || current.title,
              description: input.description === undefined ? current.description : input.description,
              status: "TODO",
              priority: input.priority || current.priority,
              dueAt: nextDueAt,
              reminderAt: reminderOffset === null ? null : new Date(nextDueAt.getTime() - reminderOffset),
              recurrence: schedule.recurrence,
              recurrenceInterval: schedule.recurrenceInterval,
              recurrenceEndsAt: schedule.recurrenceEndsAt,
              recurrenceSeriesId: current.recurrenceSeriesId || current.id
            }
          });
        }
      }
      return { task, nextTask };
    });

    if (
      result.task.assignedToId &&
      result.task.assignedToId !== current.assignedToId &&
      result.task.assignedToId !== req.user!.id
    ) {
      await createNotification({
        organizationId: req.user!.organizationId,
        userId: result.task.assignedToId,
        taskId: result.task.id,
        type: "TASK_ASSIGNED",
        eventKey: `task:${result.task.id}:assigned:${result.task.assignedToId}:${now.getTime()}`,
        title: `Task assigned: ${result.task.title}`,
        body: result.task.dueAt ? "A dated task has been assigned to you." : undefined
      });
    }
    if (completing && current.createdById !== req.user!.id) {
      await createNotification({
        organizationId: req.user!.organizationId,
        userId: current.createdById,
        taskId: result.task.id,
        type: "TASK_COMPLETED",
        eventKey: `task:${result.task.id}:completed`,
        title: `Task completed: ${result.task.title}`,
        body: `Completed by ${req.user!.email}`
      });
    }
    res.json(result);
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
