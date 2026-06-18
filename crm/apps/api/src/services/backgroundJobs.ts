import { Prisma, type BackgroundJob } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { deliverWebhook } from "./webhooks.js";
import { sendOperationalAlert } from "./alerts.js";
import { sendProviderEmail, syncProviderData } from "./integrations.js";
import { sendTransactionalEmail } from "./transactionalEmail.js";
import { executeSequenceStep } from "./salesOps.js";
import { executeQueuedAutomationAction } from "./automations.js";
import { enqueueBackgroundJob } from "./jobQueue.js";

export { enqueueBackgroundJob } from "./jobQueue.js";

function objectPayload(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function handleEmail(job: BackgroundJob, payload: Record<string, unknown>) {
  const messageId = String(payload.emailMessageId || "");
  const message = await prisma.emailMessage.findFirst({
    where: { id: messageId, organizationId: job.organizationId }
  });
  if (!message) throw new Error("Queued email message not found");
  const connectionId = payload.connectionId ? String(payload.connectionId) : "";
  const connection = connectionId
    ? await prisma.oAuthConnection.findFirst({
        where: { id: connectionId, organizationId: job.organizationId, status: "ACTIVE" }
      })
    : await prisma.oAuthConnection.findFirst({
        where: {
          organizationId: job.organizationId,
          userId: message.senderId,
          provider: { in: ["GOOGLE", "MICROSOFT"] },
          status: "ACTIVE"
        },
        orderBy: { updatedAt: "desc" }
      });
  try {
    if (connection) {
      const attachmentRows = await prisma.attachment.findMany({
        where: { organizationId: job.organizationId, entityType: "EMAIL", entityId: message.id }
      });
      const attachments = (await Promise.all(attachmentRows.map(async (attachment) => {
        const content = await readFile(path.resolve(env.ATTACHMENT_DIR, attachment.storageKey)).catch(() => null);
        return content ? {
          filename: attachment.originalName,
          mimeType: attachment.mimeType,
          contentBase64: content.toString("base64")
        } : null;
      }))).filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment));
      const delivered = await sendProviderEmail(connection, { ...message, attachments });
      const metadata = delivered.metadata as Record<string, unknown>;
      await prisma.emailMessage.update({
        where: { id: message.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          error: null,
          externalMessageId: delivered.id,
          conversationId: String(metadata.threadId || metadata.conversationId || "") || null,
          metadata: delivered.metadata
        }
      });
      return { provider: connection.provider, externalMessageId: delivered.id };
    }
    const delivered = await sendTransactionalEmail({
      to: message.to,
      subject: message.subject,
      text: message.body,
      html: message.body
    });
    if (!delivered.delivered) throw new Error("No email provider or transactional relay is configured");
    await prisma.emailMessage.update({
      where: { id: message.id },
      data: { status: "SENT", sentAt: new Date(), error: null }
    });
    return { provider: "TRANSACTIONAL" };
  } catch (error) {
    await prisma.emailMessage.update({
      where: { id: message.id },
      data: { status: "FAILED", error: error instanceof Error ? error.message : "Email delivery failed" }
    });
    throw error;
  }
}

async function handleInvoiceReminder(job: BackgroundJob, payload: Record<string, unknown>) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: String(payload.invoiceId || ""), organizationId: job.organizationId },
    include: { quote: { include: { contact: true, company: true } } }
  });
  if (!invoice) throw new Error("Invoice not found");
  if (["PAID", "REFUNDED", "VOID"].includes(invoice.status)) return { skipped: true, status: invoice.status };
  const email = invoice.quote.contact?.email;
  if (!email) throw new Error("Invoice contact has no email");
  const result = await sendTransactionalEmail({
    to: email,
    subject: `Payment reminder for invoice ${invoice.number}`,
    text: `Invoice ${invoice.number} for ${invoice.total} ${invoice.currency} is awaiting payment.`,
    html: `<p>Invoice <strong>${invoice.number}</strong> for <strong>${invoice.total} ${invoice.currency}</strong> is awaiting payment.</p>`
  });
  if (!result.delivered) throw new Error("Transactional email relay is not configured");
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { lastReminderAt: new Date(), reminderAt: null }
  });
  return { delivered: true, to: email };
}

async function execute(job: BackgroundJob) {
  const payload = objectPayload(job.payload);
  if (job.type === "EMAIL_SEND") return handleEmail(job, payload);
  if (job.type === "WEBHOOK_DELIVERY") {
    await deliverWebhook(String(payload.deliveryId || ""));
    const delivery = await prisma.webhookDelivery.findUnique({ where: { id: String(payload.deliveryId || "") } });
    if (!delivery?.deliveredAt) throw new Error(delivery?.responseBody || "Webhook delivery failed");
    return { deliveryId: delivery.id, statusCode: delivery.statusCode };
  }
  if (job.type === "INTEGRATION_SYNC") {
    const connection = await prisma.oAuthConnection.findFirst({
      where: { id: String(payload.connectionId || ""), organizationId: job.organizationId, status: "ACTIVE" }
    });
    if (!connection) throw new Error("Integration connection not found");
    return syncProviderData(connection);
  }
  if (job.type === "AUTOMATION_ACTION") return executeQueuedAutomationAction(payload);
  if (job.type === "SEQUENCE_STEP") return executeSequenceStep(String(payload.enrollmentId || ""));
  return handleInvoiceReminder(job, payload);
}

async function claimNextJob() {
  const candidate = await prisma.backgroundJob.findFirst({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      runAt: { lte: new Date() },
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 10 * 60_000) } }]
    },
    orderBy: [{ runAt: "asc" }, { createdAt: "asc" }]
  });
  if (!candidate) return null;
  const claimed = await prisma.backgroundJob.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 10 * 60_000) } }]
    },
    data: { status: "PROCESSING", lockedAt: new Date(), attempts: { increment: 1 } }
  });
  return claimed.count ? prisma.backgroundJob.findUnique({ where: { id: candidate.id } }) : null;
}

export async function processBackgroundJobs(limit = 20) {
  let processed = 0;
  while (processed < limit) {
    const job = await claimNextJob();
    if (!job) break;
    try {
      const result = await execute(job);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          result: result as Prisma.InputJsonValue,
          completedAt: new Date(),
          lockedAt: null,
          lastError: null
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Background job failed";
      const dead = job.attempts >= job.maxAttempts;
      if (job.type === "INTEGRATION_SYNC") {
        const payload = objectPayload(job.payload);
        const connectionId = String(payload.connectionId || "");
        if (connectionId) {
          await prisma.oAuthConnection.updateMany({
            where: { id: connectionId, organizationId: job.organizationId },
            data: { status: "ERROR" }
          });
        }
      }
      const delay = Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, job.attempts - 1));
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: dead ? "DEAD_LETTER" : "FAILED",
          runAt: dead ? job.runAt : new Date(Date.now() + delay),
          lockedAt: null,
          lastError: message
        }
      });
      if (dead) {
        void sendOperationalAlert({
          title: `Background job ${job.type} entered dead-letter`,
          message,
          organizationId: job.organizationId,
          metadata: { jobId: job.id, attempts: job.attempts }
        }).catch(() => undefined);
      }
    }
    processed += 1;
  }
  return processed;
}

export async function scheduleRecurringJobs() {
  const syncBefore = new Date(Date.now() - env.INTEGRATION_SYNC_INTERVAL_MINUTES * 60_000);
  const connections = await prisma.oAuthConnection.findMany({
    where: {
      status: "ACTIVE",
      provider: { in: ["GOOGLE", "MICROSOFT"] },
      OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: syncBefore } }]
    },
    select: { id: true, organizationId: true }
  });
  for (const connection of connections) {
    const queued = await prisma.backgroundJob.count({
      where: {
        organizationId: connection.organizationId,
        type: "INTEGRATION_SYNC",
        status: { in: ["PENDING", "PROCESSING", "FAILED"] },
        payload: { path: ["connectionId"], equals: connection.id }
      }
    });
    if (!queued) {
      await enqueueBackgroundJob({
        organizationId: connection.organizationId,
        type: "INTEGRATION_SYNC",
        payload: { connectionId: connection.id }
      });
    }
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      OR: [
        { reminderAt: { lte: new Date() } },
        {
          dueAt: { lt: new Date() },
          OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: new Date(Date.now() - 7 * 86_400_000) } }]
        }
      ]
    },
    select: { id: true, organizationId: true }
  });
  for (const invoice of invoices) {
    const queued = await prisma.backgroundJob.count({
      where: {
        organizationId: invoice.organizationId,
        type: "INVOICE_REMINDER",
        status: { in: ["PENDING", "PROCESSING", "FAILED"] },
        payload: { path: ["invoiceId"], equals: invoice.id }
      }
    });
    if (!queued) {
      await enqueueBackgroundJob({
        organizationId: invoice.organizationId,
        type: "INVOICE_REMINDER",
        payload: { invoiceId: invoice.id }
      });
    }
  }
}
