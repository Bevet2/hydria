import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { enqueueBackgroundJob } from "./jobQueue.js";

export type SequenceStep = {
  type: "EMAIL" | "TASK";
  delayDays: number;
  subject?: string;
  body?: string;
  title?: string;
};

export function calculateLeadScore(input: {
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  rating?: string | null;
  annualRevenue?: number | Prisma.Decimal | null;
  employeeCount?: number | null;
  source?: string | null;
}) {
  let score = 0;
  if (input.email) score += 10;
  if (input.phone) score += 10;
  if (input.jobTitle) score += 10;
  if (input.rating === "HOT") score += 30;
  else if (input.rating === "WARM") score += 15;
  if (Number(input.annualRevenue || 0) >= 1_000_000) score += 20;
  else if (Number(input.annualRevenue || 0) >= 100_000) score += 10;
  if (Number(input.employeeCount || 0) >= 50) score += 10;
  if (["Referral", "Partner", "Event"].includes(String(input.source || ""))) score += 10;
  return Math.min(100, score);
}

function sequenceSteps(value: Prisma.JsonValue): SequenceStep[] {
  if (!Array.isArray(value)) return [];
  return value.filter((step): step is SequenceStep => {
    if (!step || typeof step !== "object" || Array.isArray(step)) return false;
    return ["EMAIL", "TASK"].includes(String((step as Record<string, unknown>).type));
  }).map((step) => ({
    type: step.type,
    delayDays: Math.max(0, Number(step.delayDays || 0)),
    subject: step.subject ? String(step.subject) : undefined,
    body: step.body ? String(step.body) : undefined,
    title: step.title ? String(step.title) : undefined
  }));
}

export async function scheduleSequenceEnrollment(enrollmentId: string) {
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { sequence: true }
  });
  if (!enrollment || enrollment.status !== "ACTIVE") return null;
  const steps = sequenceSteps(enrollment.sequence.steps);
  const step = steps[enrollment.currentStep];
  if (!step) {
    return prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", completedAt: new Date(), nextRunAt: null }
    });
  }
  const runAt = new Date(Date.now() + step.delayDays * 86_400_000);
  await prisma.sequenceEnrollment.update({ where: { id: enrollment.id }, data: { nextRunAt: runAt } });
  return enqueueBackgroundJob({
    organizationId: enrollment.organizationId,
    type: "SEQUENCE_STEP",
    payload: { enrollmentId: enrollment.id },
    runAt
  });
}

export async function executeSequenceStep(enrollmentId: string) {
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { sequence: true }
  });
  if (!enrollment || enrollment.status !== "ACTIVE") return { skipped: true };
  const steps = sequenceSteps(enrollment.sequence.steps);
  const step = steps[enrollment.currentStep];
  if (!step) {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", completedAt: new Date(), nextRunAt: null }
    });
    return { completed: true };
  }

  if (step.type === "EMAIL") {
    const message = await prisma.emailMessage.create({
      data: {
        organizationId: enrollment.organizationId,
        senderId: enrollment.sequence.createdById,
        leadId: enrollment.leadId,
        contactId: enrollment.contactId,
        to: enrollment.email,
        subject: step.subject || "Follow-up",
        body: step.body || "",
        status: "QUEUED"
      }
    });
    await enqueueBackgroundJob({
      organizationId: enrollment.organizationId,
      type: "EMAIL_SEND",
      payload: { emailMessageId: message.id }
    });
  } else {
    await prisma.task.create({
      data: {
        organizationId: enrollment.organizationId,
        createdById: enrollment.sequence.createdById,
        assignedToId: enrollment.sequence.createdById,
        leadId: enrollment.leadId,
        contactId: enrollment.contactId,
        title: step.title || "Sequence follow-up",
        description: step.body,
        dueAt: new Date()
      }
    });
  }

  await prisma.sequenceEnrollment.update({
    where: { id: enrollment.id },
    data: { currentStep: { increment: 1 }, lastRunAt: new Date(), nextRunAt: null }
  });
  await scheduleSequenceEnrollment(enrollment.id);
  return { completedStep: enrollment.currentStep, type: step.type };
}
