import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { decryptSecret } from "../lib/security.js";
import { prisma } from "../lib/prisma.js";
import { sendOperationalAlert } from "./alerts.js";

async function buildSnapshot(organizationId: string) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true, slug: true, retentionDays: true }
  });
  const queries = {
    companies: prisma.company.findMany({ where: { organizationId } }),
    contacts: prisma.contact.findMany({ where: { organizationId } }),
    stages: prisma.pipelineStage.findMany({ where: { organizationId } }),
    leads: prisma.lead.findMany({ where: { organizationId } }),
    deals: prisma.deal.findMany({ where: { organizationId } }),
    products: prisma.product.findMany({ where: { organizationId } }),
    dealLineItems: prisma.dealLineItem.findMany({ where: { organizationId } }),
    quotes: prisma.quote.findMany({ where: { organizationId } }),
    quoteLineItems: prisma.quoteLineItem.findMany({ where: { organizationId } }),
    tasks: prisma.task.findMany({ where: { organizationId } }),
    notes: prisma.note.findMany({ where: { organizationId } }),
    activities: prisma.activity.findMany({ where: { organizationId } }),
    customFieldDefinitions: prisma.customFieldDefinition.findMany({ where: { organizationId } }),
    customFieldValues: prisma.customFieldValue.findMany({ where: { organizationId } }),
    savedViews: prisma.savedView.findMany({ where: { organizationId } }),
    automationRules: prisma.automationRule.findMany({ where: { organizationId } }),
    automationRuns: prisma.automationRun.findMany({ where: { organizationId } }),
    emailTemplates: prisma.emailTemplate.findMany({ where: { organizationId } }),
    emailMessages: prisma.emailMessage.findMany({ where: { organizationId } }),
    calendarEvents: prisma.calendarEvent.findMany({ where: { organizationId } }),
    salesGoals: prisma.salesGoal.findMany({ where: { organizationId } }),
    quoteVersions: prisma.quoteVersion.findMany({ where: { organizationId } }),
    quoteApprovals: prisma.quoteApproval.findMany({ where: { organizationId } }),
    signatureRequests: prisma.signatureRequest.findMany({ where: { organizationId } }),
    invoices: prisma.invoice.findMany({ where: { organizationId } }),
    payments: prisma.payment.findMany({ where: { organizationId } }),
    creditNotes: prisma.creditNote.findMany({ where: { organizationId } }),
    dashboardPreferences: prisma.dashboardPreference.findMany({ where: { organizationId } }),
    consents: prisma.consent.findMany({ where: { organizationId } }),
    privacyRequests: prisma.privacyRequest.findMany({ where: { organizationId } })
  };
  const entries = await Promise.all(Object.entries(queries).map(async ([key, query]) => [key, await query] as const));
  const data = Object.fromEntries(entries);
  const attachments = await prisma.attachment.findMany({ where: { organizationId } });
  const attachmentFiles = [];
  for (const attachment of attachments) {
    const content = await readFile(path.resolve(env.ATTACHMENT_DIR, attachment.storageKey)).catch(() => null);
    if (content) attachmentFiles.push({ ...attachment, contentBase64: content.toString("base64") });
  }
  return { schemaVersion: 2, generatedAt: new Date().toISOString(), organization, data, attachments: attachmentFiles };
}

function scheduleConfig(schedule: { encryptedConfig: string | null }) {
  if (!schedule.encryptedConfig) return {} as Record<string, unknown>;
  try {
    return JSON.parse(decryptSecret(schedule.encryptedConfig)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function runScheduledBackup(organizationId: string) {
  const schedule = await prisma.backupSchedule.findUnique({ where: { organizationId } });
  if (!schedule) throw new Error("Backup schedule not found");
  const snapshot = await buildSnapshot(organizationId);
  const serialized = JSON.stringify(snapshot);
  await mkdir(path.resolve(env.BACKUP_DIR), { recursive: true });
  const filename = `${snapshot.organization.slug}-${new Date().toISOString().replaceAll(":", "-")}.json`;
  const localPath = path.join(path.resolve(env.BACKUP_DIR), filename);
  await writeFile(localPath, serialized);
  const config = scheduleConfig(schedule);
  if (schedule.target === "HTTPS") {
    const endpoint = String(config.endpoint || "");
    if (!endpoint.startsWith("https://")) throw new Error("Remote backup endpoint must use HTTPS");
    const headers = config.headers && typeof config.headers === "object" && !Array.isArray(config.headers)
      ? Object.fromEntries(Object.entries(config.headers).map(([key, value]) => [key, String(value)]))
      : {};
    const response = await fetch(endpoint, {
      method: String(config.method || "PUT"),
      headers: { "content-type": "application/json", "x-backup-filename": filename, ...headers },
      body: serialized,
      signal: AbortSignal.timeout(60_000)
    });
    if (!response.ok) throw new Error(`Remote backup failed (${response.status})`);
  }
  await prisma.backupSchedule.update({
    where: { organizationId },
    data: { lastRunAt: new Date(), lastStatus: "SUCCESS", lastError: null }
  });
  return { filename, localPath, bytes: Buffer.byteLength(serialized) };
}

function due(schedule: { cron: string; lastRunAt: Date | null }) {
  if (!schedule.lastRunAt) return true;
  const [minuteValue, hourValue] = schedule.cron.trim().split(/\s+/);
  const now = new Date();
  const minute = Number(minuteValue);
  const hour = Number(hourValue);
  if (!Number.isInteger(minute) || !Number.isInteger(hour)) return false;
  const scheduledToday = new Date(now);
  scheduledToday.setHours(hour, minute, 0, 0);
  return now >= scheduledToday && schedule.lastRunAt < scheduledToday;
}

export async function processScheduledBackups() {
  const schedules = await prisma.backupSchedule.findMany({ where: { enabled: true } });
  for (const schedule of schedules) {
    if (!due(schedule)) continue;
    try {
      await runScheduledBackup(schedule.organizationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backup failed";
      await prisma.backupSchedule.update({
        where: { organizationId: schedule.organizationId },
        data: {
          lastRunAt: new Date(),
          lastStatus: "FAILED",
          lastError: message
        }
      });
      void sendOperationalAlert({
        title: "Scheduled backup failed",
        message,
        organizationId: schedule.organizationId
      }).catch(() => undefined);
    }
  }
}
