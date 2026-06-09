import type { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { triggerAutomations } from "./automations.js";

export async function createNotification(input: {
  organizationId: string;
  userId: string;
  taskId?: string;
  type: NotificationType;
  eventKey: string;
  title: string;
  body?: string;
}) {
  return prisma.notification.upsert({
    where: { eventKey: input.eventKey },
    update: {},
    create: input
  });
}

export async function processTaskNotifications(now = new Date()) {
  const [reminders, overdueTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignedToId: { not: null },
        status: { in: ["TODO", "IN_PROGRESS"] },
        reminderAt: { lte: now },
        reminderSentAt: null
      },
      select: {
        id: true,
        organizationId: true,
        assignedToId: true,
        title: true,
        dueAt: true
      },
      take: 500
    }),
    prisma.task.findMany({
      where: {
        assignedToId: { not: null },
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueAt: { lt: now },
        overdueNotifiedAt: null
      },
      select: {
        id: true,
        organizationId: true,
        assignedToId: true,
        title: true,
        dueAt: true
      },
      take: 500
    })
  ]);

  for (const task of reminders) {
    await createNotification({
      organizationId: task.organizationId,
      userId: task.assignedToId!,
      taskId: task.id,
      type: "TASK_REMINDER",
      eventKey: `task:${task.id}:reminder`,
      title: `Reminder: ${task.title}`,
      body: task.dueAt ? "This task is due soon." : undefined
    });
    await prisma.task.updateMany({
      where: { id: task.id, reminderSentAt: null },
      data: { reminderSentAt: now }
    });
  }

  for (const task of overdueTasks) {
    await createNotification({
      organizationId: task.organizationId,
      userId: task.assignedToId!,
      taskId: task.id,
      type: "TASK_OVERDUE",
      eventKey: `task:${task.id}:overdue`,
      title: `Overdue task: ${task.title}`,
      body: task.dueAt ? "The due date has passed." : undefined
    });
    await prisma.task.updateMany({
      where: { id: task.id, overdueNotifiedAt: null },
      data: { overdueNotifiedAt: now }
    });
    await triggerAutomations(task.organizationId, "TASK_OVERDUE", {
      entityType: "task",
      entityId: task.id,
      fields: { title: task.title, assignedToId: task.assignedToId, dueAt: task.dueAt?.toISOString() }
    });
  }

  return { reminders: reminders.length, overdue: overdueTasks.length };
}
