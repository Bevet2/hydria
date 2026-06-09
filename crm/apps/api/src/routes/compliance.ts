import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/consents", asyncRoute(async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  const consents = await prisma.consent.findMany({
    where: { organizationId: req.user!.organizationId, ...(email ? { email } : {}) },
    orderBy: { capturedAt: "desc" }
  });
  res.json({ consents });
}));

router.post("/consents", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    contactId: z.string().uuid().optional().nullable(),
    leadId: z.string().uuid().optional().nullable(),
    email: z.string().email().transform((value) => value.toLowerCase()),
    purpose: z.string().min(1).max(200),
    status: z.enum(["GRANTED", "WITHDRAWN"]),
    source: z.string().max(200).optional(),
    legalBasis: z.string().max(200).optional(),
    proof: z.record(z.unknown()).optional()
  }), req.body);
  if (input.contactId && !await prisma.contact.findFirst({ where: { id: input.contactId, organizationId: req.user!.organizationId } })) throw new HttpError("Contact not found", 404);
  if (input.leadId && !await prisma.lead.findFirst({ where: { id: input.leadId, organizationId: req.user!.organizationId } })) throw new HttpError("Lead not found", 404);
  const consent = await prisma.consent.create({
    data: {
      ...input,
      organizationId: req.user!.organizationId,
      proof: input.proof as Prisma.InputJsonValue | undefined,
      withdrawnAt: input.status === "WITHDRAWN" ? new Date() : null
    }
  });
  res.status(201).json({ consent });
}));

router.get("/privacy-requests", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const requests = await prisma.privacyRequest.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { createdAt: "desc" }
  });
  res.json({ requests });
}));

router.post("/privacy-requests", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    type: z.enum(["EXPORT", "ANONYMIZE", "DELETE"]),
    subjectEmail: z.string().email().transform((value) => value.toLowerCase())
  }), req.body);
  const request = await prisma.privacyRequest.create({
    data: { ...input, organizationId: req.user!.organizationId, requestedById: req.user!.id }
  });
  res.status(201).json({ request });
}));

router.post("/privacy-requests/:id/process", requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({ confirmation: z.string().optional() }), req.body);
  const request = await prisma.privacyRequest.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId }
  });
  if (!request) throw new HttpError("Privacy request not found", 404);
  if (request.status === "COMPLETED") throw new HttpError("Privacy request already completed", 409);
  if (request.type !== "EXPORT" && input.confirmation !== request.subjectEmail) {
    throw new HttpError("Confirm the subject email before anonymization or deletion", 400);
  }
  await prisma.privacyRequest.update({ where: { id: request.id }, data: { status: "PROCESSING" } });
  const organizationId = req.user!.organizationId;
  const [contacts, leads, emails, consents, activities, tasks] = await Promise.all([
    prisma.contact.findMany({ where: { organizationId, email: request.subjectEmail } }),
    prisma.lead.findMany({ where: { organizationId, email: request.subjectEmail } }),
    prisma.emailMessage.findMany({ where: { organizationId, OR: [{ to: { contains: request.subjectEmail, mode: "insensitive" } }] } }),
    prisma.consent.findMany({ where: { organizationId, email: request.subjectEmail } }),
    prisma.activity.findMany({
      where: {
        organizationId,
        OR: [
          { contactId: { in: (await prisma.contact.findMany({ where: { organizationId, email: request.subjectEmail }, select: { id: true } })).map((item) => item.id) } },
          { leadId: { in: (await prisma.lead.findMany({ where: { organizationId, email: request.subjectEmail }, select: { id: true } })).map((item) => item.id) } }
        ]
      }
    }),
    prisma.task.findMany({
      where: {
        organizationId,
        OR: [
          { contact: { email: request.subjectEmail } },
          { lead: { email: request.subjectEmail } }
        ]
      }
    })
  ]);
  let result: Prisma.InputJsonValue;
  if (request.type === "EXPORT") {
    result = JSON.parse(JSON.stringify({ contacts, leads, emails, consents, activities, tasks })) as Prisma.InputJsonValue;
  } else {
    const marker = `anonymized-${request.id.slice(0, 8)}@invalid.local`;
    await prisma.$transaction([
      prisma.contact.updateMany({
        where: { organizationId, email: request.subjectEmail },
        data: { firstName: "Anonymized", lastName: "Contact", email: marker, phone: null, jobTitle: null, source: null }
      }),
      prisma.lead.updateMany({
        where: { organizationId, email: request.subjectEmail },
        data: { firstName: "Anonymized", lastName: "Lead", email: marker, phone: null, description: null, jobTitle: null }
      }),
      prisma.emailMessage.updateMany({
        where: { organizationId, to: { contains: request.subjectEmail, mode: "insensitive" } },
        data: { to: marker, cc: null, subject: "[anonymized]", body: "[anonymized]" }
      }),
      prisma.consent.updateMany({
        where: { organizationId, email: request.subjectEmail },
        data: { email: marker, status: "WITHDRAWN", withdrawnAt: new Date(), proof: Prisma.JsonNull }
      })
    ]);
    result = { anonymized: true, marker, contacts: contacts.length, leads: leads.length, messages: emails.length };
  }
  const completed = await prisma.privacyRequest.update({
    where: { id: request.id },
    data: { status: "COMPLETED", result, completedAt: new Date() }
  });
  res.json({ request: completed });
}));

router.get("/retention", requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: req.user!.organizationId },
    select: { retentionDays: true }
  });
  res.json(organization);
}));

router.put("/retention", requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({ retentionDays: z.coerce.number().int().min(30).max(3650) }), req.body);
  const organization = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: input,
    select: { retentionDays: true }
  });
  res.json(organization);
}));

router.post("/retention/run", requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: req.user!.organizationId } });
  const cutoff = new Date(Date.now() - organization.retentionDays * 86_400_000);
  const [auditLogs, errorEvents, webhookDeliveries] = await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { organizationId: organization.id, createdAt: { lt: cutoff } } }),
    prisma.errorEvent.deleteMany({ where: { organizationId: organization.id, createdAt: { lt: cutoff } } }),
    prisma.webhookDelivery.deleteMany({ where: { organizationId: organization.id, createdAt: { lt: cutoff } } })
  ]);
  res.json({ deleted: { auditLogs: auditLogs.count, errorEvents: errorEvents.count, webhookDeliveries: webhookDeliveries.count }, cutoff });
}));

export default router;
