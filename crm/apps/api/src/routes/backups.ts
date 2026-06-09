import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError } from "../lib/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { encryptSecret } from "../lib/security.js";
import { runScheduledBackup } from "../services/scheduledBackups.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024 } });
const storageRoot = path.resolve(env.ATTACHMENT_DIR);
const snapshotSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  organization: z.object({
    slug: z.string(),
    name: z.string(),
    retentionDays: z.number().int().positive().optional()
  }),
  generatedAt: z.string(),
  data: z.record(z.array(z.record(z.unknown()))),
  attachments: z.array(
    z.object({
      id: z.string().uuid(),
      uploadedById: z.string().uuid(),
      entityType: z.enum(["CONTACT", "COMPANY", "DEAL", "LEAD"]),
      entityId: z.string().uuid(),
      originalName: z.string(),
      mimeType: z.string(),
      size: z.number().int().nonnegative(),
      storageKey: z.string().uuid(),
      createdAt: z.string(),
      contentBase64: z.string()
    })
  )
});

router.use(requireAuth, requireRole("ADMIN"));

function rows(data: Record<string, Array<Record<string, unknown>>>, key: string) {
  return (data[key] || []) as any[];
}

function withOrganization(items: any[], organizationId: string) {
  return items.map((item) => ({ ...item, organizationId }));
}

function reviveDates(items: any[], keys: string[]) {
  return items.map((item) => ({
    ...item,
    ...Object.fromEntries(
      keys
        .filter((key) => item[key])
        .map((key) => [key, new Date(item[key])])
    )
  }));
}

router.get(
  "/schedule",
  asyncRoute(async (req, res) => {
    const schedule = await prisma.backupSchedule.findUnique({
      where: { organizationId: req.user!.organizationId },
      select: {
        id: true, enabled: true, cron: true, target: true,
        lastRunAt: true, lastStatus: true, lastError: true, updatedAt: true
      }
    });
    res.json({ schedule });
  })
);

router.put(
  "/schedule",
  asyncRoute(async (req, res) => {
    const input = z.object({
      enabled: z.boolean(),
      cron: z.string().regex(/^([0-5]?\d)\s+([01]?\d|2[0-3])\s+\*\s+\*\s+\*$/),
      target: z.enum(["LOCAL", "HTTPS"]),
      endpoint: z.string().url().optional(),
      headers: z.record(z.string()).optional()
    }).parse(req.body);
    if (input.target === "HTTPS" && !input.endpoint?.startsWith("https://")) {
      throw new HttpError("Remote backups require an HTTPS endpoint", 400);
    }
    const schedule = await prisma.backupSchedule.upsert({
      where: { organizationId: req.user!.organizationId },
      create: {
        organizationId: req.user!.organizationId,
        enabled: input.enabled,
        cron: input.cron,
        target: input.target,
        encryptedConfig: encryptSecret(JSON.stringify({ endpoint: input.endpoint, headers: input.headers || {} }))
      },
      update: {
        enabled: input.enabled,
        cron: input.cron,
        target: input.target,
        encryptedConfig: encryptSecret(JSON.stringify({ endpoint: input.endpoint, headers: input.headers || {} }))
      },
      select: { id: true, enabled: true, cron: true, target: true, lastRunAt: true, lastStatus: true, lastError: true }
    });
    res.json({ schedule });
  })
);

router.post(
  "/schedule/run",
  asyncRoute(async (req, res) => {
    const result = await runScheduledBackup(req.user!.organizationId);
    res.json({ backup: result });
  })
);

router.get(
  "/export",
  asyncRoute(async (req, res) => {
    const organizationId = req.user!.organizationId;
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true, slug: true }
    });
    const [
      companies,
      contacts,
      stages,
      leads,
      deals,
      products,
      dealLineItems,
      quotes,
      quoteLineItems,
      tasks,
      notes,
      activities,
      customFieldDefinitions,
      customFieldValues,
      savedViews,
      automationRules,
      automationRuns,
      emailTemplates,
      emailMessages,
      calendarEvents,
      salesGoals,
      quoteVersions,
      quoteApprovals,
      signatureRequests,
      invoices,
      payments,
      creditNotes,
      dashboardPreferences,
      consents,
      privacyRequests,
      attachments
    ] = await prisma.$transaction([
      prisma.company.findMany({ where: { organizationId } }),
      prisma.contact.findMany({ where: { organizationId } }),
      prisma.pipelineStage.findMany({ where: { organizationId } }),
      prisma.lead.findMany({ where: { organizationId } }),
      prisma.deal.findMany({ where: { organizationId } }),
      prisma.product.findMany({ where: { organizationId } }),
      prisma.dealLineItem.findMany({ where: { organizationId } }),
      prisma.quote.findMany({ where: { organizationId } }),
      prisma.quoteLineItem.findMany({ where: { organizationId } }),
      prisma.task.findMany({ where: { organizationId } }),
      prisma.note.findMany({ where: { organizationId } }),
      prisma.activity.findMany({ where: { organizationId } }),
      prisma.customFieldDefinition.findMany({ where: { organizationId } }),
      prisma.customFieldValue.findMany({ where: { organizationId } }),
      prisma.savedView.findMany({ where: { organizationId } }),
      prisma.automationRule.findMany({ where: { organizationId } }),
      prisma.automationRun.findMany({ where: { organizationId } }),
      prisma.emailTemplate.findMany({ where: { organizationId } }),
      prisma.emailMessage.findMany({ where: { organizationId } }),
      prisma.calendarEvent.findMany({ where: { organizationId } }),
      prisma.salesGoal.findMany({ where: { organizationId } }),
      prisma.quoteVersion.findMany({ where: { organizationId } }),
      prisma.quoteApproval.findMany({ where: { organizationId } }),
      prisma.signatureRequest.findMany({ where: { organizationId } }),
      prisma.invoice.findMany({ where: { organizationId } }),
      prisma.payment.findMany({ where: { organizationId } }),
      prisma.creditNote.findMany({ where: { organizationId } }),
      prisma.dashboardPreference.findMany({ where: { organizationId } }),
      prisma.consent.findMany({ where: { organizationId } }),
      prisma.privacyRequest.findMany({ where: { organizationId } }),
      prisma.attachment.findMany({ where: { organizationId } })
    ]);

    let attachmentBytes = 0;
    const attachmentFiles = [];
    for (const attachment of attachments) {
      const content = await readFile(path.join(storageRoot, attachment.storageKey)).catch(() => null);
      if (!content) continue;
      attachmentBytes += content.byteLength;
      if (attachmentBytes > 100 * 1024 * 1024) {
        throw new HttpError("Backup attachments exceed the 100 MB export limit", 413);
      }
      attachmentFiles.push({
        ...attachment,
        createdAt: attachment.createdAt.toISOString(),
        contentBase64: content.toString("base64")
      });
    }

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="northstar-${organization.slug}-${date}.json"`);
    res.json({
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      organization,
      data: {
        companies,
        contacts,
        stages,
        leads,
        deals,
        products,
        dealLineItems,
        quotes,
        quoteLineItems,
        tasks,
        notes,
        activities,
        customFieldDefinitions,
        customFieldValues,
        savedViews,
        automationRules,
        automationRuns,
        emailTemplates,
        emailMessages,
        calendarEvents,
        salesGoals,
        quoteVersions,
        quoteApprovals,
        signatureRequests,
        invoices,
        payments,
        creditNotes,
        dashboardPreferences,
        consents,
        privacyRequests
      },
      attachments: attachmentFiles
    });
  })
);

router.post(
  "/restore",
  upload.single("file"),
  asyncRoute(async (req, res) => {
    if (req.body.confirmation !== "RESTORE") {
      throw new HttpError('Set confirmation to "RESTORE" to replace CRM data', 400);
    }
    if (!req.file) throw new HttpError("Backup file is required", 400);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(req.file.buffer.toString("utf8"));
    } catch {
      throw new HttpError("Backup file is not valid JSON", 400);
    }
    const snapshot = snapshotSchema.parse(parsedJson);
    const organizationId = req.user!.organizationId;
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { slug: true }
    });
    if (snapshot.organization.slug !== organization.slug) {
      throw new HttpError("Backup belongs to another organization", 409);
    }
    let restoredAttachmentBytes = 0;
    const attachmentBuffers = new Map<string, Buffer>();
    for (const attachment of snapshot.attachments) {
      const content = Buffer.from(attachment.contentBase64, "base64");
      if (content.byteLength !== attachment.size) {
        throw new HttpError(`Attachment size mismatch for ${attachment.originalName}`, 400);
      }
      restoredAttachmentBytes += content.byteLength;
      if (restoredAttachmentBytes > 100 * 1024 * 1024) {
        throw new HttpError("Backup attachments exceed the 100 MB restore limit", 413);
      }
      attachmentBuffers.set(attachment.storageKey, content);
    }

    const users = await prisma.user.findMany({
      where: { organizationId },
      select: { id: true }
    });
    const userIds = new Set(users.map((user) => user.id));
    const optionalUser = (id: unknown) => typeof id === "string" && userIds.has(id) ? id : null;
    const requiredUser = (id: unknown) => optionalUser(id) || req.user!.id;
    const oldAttachments = await prisma.attachment.findMany({
      where: { organizationId },
      select: { storageKey: true }
    });
    const data = snapshot.data;

    await prisma.$transaction(async (tx) => {
      await tx.creditNote.deleteMany({ where: { organizationId } });
      await tx.payment.deleteMany({ where: { organizationId } });
      await tx.invoice.deleteMany({ where: { organizationId } });
      await tx.dashboardPreference.deleteMany({ where: { organizationId } });
      await tx.signatureRequest.deleteMany({ where: { organizationId } });
      await tx.quoteApproval.deleteMany({ where: { organizationId } });
      await tx.quoteVersion.deleteMany({ where: { organizationId } });
      await tx.salesGoal.deleteMany({ where: { organizationId } });
      await tx.calendarEvent.deleteMany({ where: { organizationId } });
      await tx.emailMessage.deleteMany({ where: { organizationId } });
      await tx.emailTemplate.deleteMany({ where: { organizationId } });
      await tx.automationRun.deleteMany({ where: { organizationId } });
      await tx.automationRule.deleteMany({ where: { organizationId } });
      await tx.consent.deleteMany({ where: { organizationId } });
      await tx.privacyRequest.deleteMany({ where: { organizationId } });
      await tx.quoteLineItem.deleteMany({ where: { organizationId } });
      await tx.quote.deleteMany({ where: { organizationId } });
      await tx.dealLineItem.deleteMany({ where: { organizationId } });
      await tx.task.deleteMany({ where: { organizationId } });
      await tx.note.deleteMany({ where: { organizationId } });
      await tx.activity.deleteMany({ where: { organizationId } });
      await tx.notification.deleteMany({ where: { organizationId } });
      await tx.customFieldValue.deleteMany({ where: { organizationId } });
      await tx.customFieldDefinition.deleteMany({ where: { organizationId } });
      await tx.attachment.deleteMany({ where: { organizationId } });
      await tx.savedView.deleteMany({ where: { organizationId } });
      await tx.lead.deleteMany({ where: { organizationId } });
      await tx.deal.deleteMany({ where: { organizationId } });
      await tx.contact.deleteMany({ where: { organizationId } });
      await tx.company.deleteMany({ where: { organizationId } });
      await tx.product.deleteMany({ where: { organizationId } });
      await tx.pipelineStage.deleteMany({ where: { organizationId } });

      const companies = reviveDates(withOrganization(rows(data, "companies"), organizationId), ["createdAt", "updatedAt"])
        .map((item) => ({ ...item, ownerId: optionalUser(item.ownerId) }));
      const contacts = reviveDates(withOrganization(rows(data, "contacts"), organizationId), ["createdAt", "updatedAt"])
        .map((item) => ({ ...item, ownerId: optionalUser(item.ownerId) }));
      const stages = reviveDates(withOrganization(rows(data, "stages"), organizationId), ["createdAt", "updatedAt"]);
      const products = reviveDates(withOrganization(rows(data, "products"), organizationId), ["createdAt", "updatedAt"]);
      const sourceLeads = reviveDates(withOrganization(rows(data, "leads"), organizationId), ["createdAt", "updatedAt", "convertedAt"]);
      const leads = sourceLeads.map((item) => ({
        ...item,
        ownerId: optionalUser(item.ownerId),
        convertedCompanyId: null,
        convertedContactId: null,
        convertedDealId: null
      }));
      const deals = reviveDates(withOrganization(rows(data, "deals"), organizationId), ["createdAt", "updatedAt", "expectedCloseAt"])
        .map((item) => ({ ...item, ownerId: optionalUser(item.ownerId) }));

      if (companies.length) await tx.company.createMany({ data: companies });
      if (contacts.length) await tx.contact.createMany({ data: contacts });
      if (stages.length) await tx.pipelineStage.createMany({ data: stages });
      if (products.length) await tx.product.createMany({ data: products });
      if (leads.length) await tx.lead.createMany({ data: leads });
      if (deals.length) await tx.deal.createMany({ data: deals });

      for (const lead of sourceLeads) {
        if (lead.convertedCompanyId || lead.convertedContactId || lead.convertedDealId) {
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              convertedCompanyId: lead.convertedCompanyId || null,
              convertedContactId: lead.convertedContactId || null,
              convertedDealId: lead.convertedDealId || null
            }
          });
        }
      }

      const dealLineItems = reviveDates(withOrganization(rows(data, "dealLineItems"), organizationId), ["createdAt", "updatedAt"]);
      const quotes = reviveDates(withOrganization(rows(data, "quotes"), organizationId), ["createdAt", "updatedAt", "validUntil"])
        .map((item) => ({ ...item, ownerId: optionalUser(item.ownerId) }));
      const quoteLineItems = reviveDates(withOrganization(rows(data, "quoteLineItems"), organizationId), ["createdAt", "updatedAt"]);
      const tasks = reviveDates(withOrganization(rows(data, "tasks"), organizationId), ["createdAt", "updatedAt", "dueAt", "completedAt"])
        .map((item) => ({
          ...item,
          createdById: requiredUser(item.createdById),
          assignedToId: optionalUser(item.assignedToId)
        }));
      const notes = reviveDates(withOrganization(rows(data, "notes"), organizationId), ["createdAt", "updatedAt"])
        .map((item) => ({ ...item, authorId: requiredUser(item.authorId) }));
      const activities = reviveDates(withOrganization(rows(data, "activities"), organizationId), ["createdAt", "occurredAt"])
        .map((item) => ({ ...item, actorId: optionalUser(item.actorId) }));
      const definitions = reviveDates(withOrganization(rows(data, "customFieldDefinitions"), organizationId), ["createdAt", "updatedAt"]);
      const values = reviveDates(withOrganization(rows(data, "customFieldValues"), organizationId), ["createdAt", "updatedAt"]);
      const savedViews = reviveDates(withOrganization(rows(data, "savedViews"), organizationId), ["createdAt", "updatedAt"])
        .map((item) => ({ ...item, userId: requiredUser(item.userId) }));

      if (dealLineItems.length) await tx.dealLineItem.createMany({ data: dealLineItems });
      if (quotes.length) await tx.quote.createMany({ data: quotes });
      if (quoteLineItems.length) await tx.quoteLineItem.createMany({ data: quoteLineItems });
      if (tasks.length) await tx.task.createMany({ data: tasks });
      if (notes.length) await tx.note.createMany({ data: notes });
      if (activities.length) await tx.activity.createMany({ data: activities });
      if (definitions.length) await tx.customFieldDefinition.createMany({ data: definitions });
      if (values.length) await tx.customFieldValue.createMany({ data: values });
      if (savedViews.length) await tx.savedView.createMany({ data: savedViews });

      const automationRules = reviveDates(
        withOrganization(rows(data, "automationRules"), organizationId),
        ["createdAt", "updatedAt"]
      ).map((item) => ({ ...item, createdById: requiredUser(item.createdById) }));
      const automationRuns = reviveDates(
        withOrganization(rows(data, "automationRuns"), organizationId),
        ["createdAt"]
      );
      const emailTemplates = reviveDates(
        withOrganization(rows(data, "emailTemplates"), organizationId),
        ["createdAt", "updatedAt"]
      ).map((item) => ({ ...item, createdById: requiredUser(item.createdById) }));
      const emailMessages = reviveDates(
        withOrganization(rows(data, "emailMessages"), organizationId),
        ["sentAt", "replyReceivedAt", "createdAt", "updatedAt"]
      ).map((item) => ({ ...item, senderId: requiredUser(item.senderId) }));
      const calendarEvents = reviveDates(
        withOrganization(rows(data, "calendarEvents"), organizationId),
        ["startsAt", "endsAt", "createdAt", "updatedAt"]
      ).map((item) => ({ ...item, ownerId: requiredUser(item.ownerId) }));
      const salesGoals = reviveDates(
        withOrganization(rows(data, "salesGoals"), organizationId),
        ["periodStart", "periodEnd", "createdAt", "updatedAt"]
      ).map((item) => ({ ...item, userId: optionalUser(item.userId) }));
      const quoteVersions = reviveDates(
        withOrganization(rows(data, "quoteVersions"), organizationId),
        ["createdAt"]
      ).map((item) => ({ ...item, createdById: requiredUser(item.createdById) }));
      const quoteApprovals = reviveDates(
        withOrganization(rows(data, "quoteApprovals"), organizationId),
        ["decidedAt", "createdAt"]
      ).map((item) => ({ ...item, reviewerId: requiredUser(item.reviewerId) }));
      const signatureRequests = reviveDates(
        withOrganization(rows(data, "signatureRequests"), organizationId),
        ["expiresAt", "signedAt", "createdAt"]
      );
      const invoices = reviveDates(
        withOrganization(rows(data, "invoices"), organizationId),
        ["dueAt", "issuedAt", "paidAt", "reminderAt", "lastReminderAt", "createdAt", "updatedAt"]
      );
      const payments = reviveDates(
        withOrganization(rows(data, "payments"), organizationId),
        ["paidAt", "createdAt", "updatedAt"]
      );
      const creditNotes = reviveDates(
        withOrganization(rows(data, "creditNotes"), organizationId),
        ["issuedAt", "createdAt", "updatedAt"]
      );
      const dashboardPreferences = reviveDates(
        withOrganization(rows(data, "dashboardPreferences"), organizationId),
        ["createdAt", "updatedAt"]
      ).map((item) => ({ ...item, userId: requiredUser(item.userId) }));
      const consents = reviveDates(
        withOrganization(rows(data, "consents"), organizationId),
        ["capturedAt", "withdrawnAt"]
      );
      const privacyRequests = reviveDates(
        withOrganization(rows(data, "privacyRequests"), organizationId),
        ["completedAt", "createdAt", "updatedAt"]
      ).map((item) => ({ ...item, requestedById: requiredUser(item.requestedById) }));

      if (automationRules.length) await tx.automationRule.createMany({ data: automationRules });
      if (automationRuns.length) await tx.automationRun.createMany({ data: automationRuns });
      if (emailTemplates.length) await tx.emailTemplate.createMany({ data: emailTemplates });
      if (emailMessages.length) await tx.emailMessage.createMany({ data: emailMessages });
      if (calendarEvents.length) await tx.calendarEvent.createMany({ data: calendarEvents });
      if (salesGoals.length) await tx.salesGoal.createMany({ data: salesGoals });
      if (quoteVersions.length) await tx.quoteVersion.createMany({ data: quoteVersions });
      if (quoteApprovals.length) await tx.quoteApproval.createMany({ data: quoteApprovals });
      if (signatureRequests.length) await tx.signatureRequest.createMany({ data: signatureRequests });
      if (invoices.length) await tx.invoice.createMany({ data: invoices });
      if (payments.length) await tx.payment.createMany({ data: payments });
      if (creditNotes.length) await tx.creditNote.createMany({ data: creditNotes });
      if (dashboardPreferences.length) await tx.dashboardPreference.createMany({ data: dashboardPreferences });
      if (consents.length) await tx.consent.createMany({ data: consents });
      if (privacyRequests.length) await tx.privacyRequest.createMany({ data: privacyRequests });

      if (snapshot.organization.retentionDays) {
        await tx.organization.update({
          where: { id: organizationId },
          data: { retentionDays: snapshot.organization.retentionDays }
        });
      }
    }, { timeout: 60_000 });

    await mkdir(storageRoot, { recursive: true });
    await Promise.all(oldAttachments.map((item) => rm(path.join(storageRoot, item.storageKey), { force: true })));
    for (const attachment of snapshot.attachments) {
      await writeFile(path.join(storageRoot, attachment.storageKey), attachmentBuffers.get(attachment.storageKey)!);
      await prisma.attachment.create({
        data: {
          id: attachment.id,
          organizationId,
          uploadedById: requiredUser(attachment.uploadedById),
          entityType: attachment.entityType,
          entityId: attachment.entityId,
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          storageKey: attachment.storageKey,
          createdAt: new Date(attachment.createdAt)
        }
      });
    }
    res.json({
      restored: true,
      generatedAt: snapshot.generatedAt,
      records: Object.values(snapshot.data).reduce((total, items) => total + items.length, 0),
      attachments: snapshot.attachments.length
    });
  })
);

export default router;
