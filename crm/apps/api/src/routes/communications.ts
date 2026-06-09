import { Router } from "express";
import { z } from "zod";
import { asyncRoute, HttpError, parseBody, parsePagination } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { assertCrmRelations } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { cancelProviderEvent, createProviderEvent } from "../services/integrations.js";
import { enqueueBackgroundJob } from "../services/backgroundJobs.js";

const router = Router();
router.use(requireAuth);

router.get("/templates", asyncRoute(async (req, res) => {
  const templates = await prisma.emailTemplate.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { name: "asc" }
  });
  res.json({ templates });
}));

router.post("/templates", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(z.object({
    name: z.string().min(1).max(120),
    subject: z.string().min(1).max(240),
    body: z.string().min(1).max(100_000),
    shared: z.boolean().default(true)
  }), req.body);
  const template = await prisma.emailTemplate.create({
    data: { ...input, organizationId: req.user!.organizationId, createdById: req.user!.id }
  });
  res.status(201).json({ template });
}));

router.patch("/templates/:id", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(z.object({
    name: z.string().min(1).max(120),
    subject: z.string().min(1).max(240),
    body: z.string().min(1).max(100_000),
    shared: z.boolean()
  }).partial(), req.body);
  const current = await prisma.emailTemplate.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!current) throw new HttpError("Email template not found", 404);
  res.json({ template: await prisma.emailTemplate.update({ where: { id: current.id }, data: input }) });
}));

router.delete("/templates/:id", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const result = await prisma.emailTemplate.deleteMany({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!result.count) throw new HttpError("Email template not found", 404);
  res.status(204).end();
}));

router.get("/messages", asyncRoute(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const where = { organizationId: req.user!.organizationId };
  const [messages, total] = await prisma.$transaction([
    prisma.emailMessage.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.emailMessage.count({ where })
  ]);
  res.json({ messages, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.post("/messages", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(z.object({
    connectionId: z.string().uuid(),
    contactId: z.string().uuid().optional().nullable(),
    leadId: z.string().uuid().optional().nullable(),
    to: z.string().min(3).max(1000),
    cc: z.string().max(1000).optional().nullable(),
    subject: z.string().min(1).max(240),
    body: z.string().min(1).max(100_000)
  }), req.body);
  await assertCrmRelations(req.user!.organizationId, { contactId: input.contactId, leadId: input.leadId });
  const connection = await prisma.oAuthConnection.findFirst({
    where: { id: input.connectionId, organizationId: req.user!.organizationId, userId: req.user!.id, provider: { in: ["GOOGLE", "MICROSOFT"] } }
  });
  if (!connection) throw new HttpError("Email connection not found", 404);
  const message = await prisma.emailMessage.create({
    data: {
      organizationId: req.user!.organizationId, senderId: req.user!.id,
      contactId: input.contactId, leadId: input.leadId, provider: connection.provider,
      to: input.to, cc: input.cc, subject: input.subject, body: input.body, status: "QUEUED"
    }
  });
  const job = await enqueueBackgroundJob({
    organizationId: req.user!.organizationId,
    type: "EMAIL_SEND",
    payload: { emailMessageId: message.id, connectionId: connection.id },
    runAt: new Date(Date.now() + 3000)
  });
  res.status(202).json({ message, job });
}));

router.get("/conversations", asyncRoute(async (req, res) => {
  const messages = await prisma.emailMessage.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { createdAt: "desc" },
    take: 500
  });
  const conversations = new Map<string, typeof messages>();
  for (const message of messages) {
    const key = message.conversationId || message.externalMessageId || message.id;
    conversations.set(key, [...(conversations.get(key) || []), message]);
  }
  res.json({
    conversations: [...conversations.entries()].map(([id, items]) => ({
      id,
      subject: items[0]?.subject || "(no subject)",
      contactId: items.find((item) => item.contactId)?.contactId || null,
      leadId: items.find((item) => item.leadId)?.leadId || null,
      lastMessageAt: items[0]?.createdAt,
      unreadReplies: items.filter((item) => item.direction === "INBOUND" && !item.replyReceivedAt).length,
      messages: [...items].reverse()
    }))
  });
}));

router.post("/messages/:id/reply-received", asyncRoute(async (req, res) => {
  const message = await prisma.emailMessage.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!message) throw new HttpError("Email message not found", 404);
  res.json({ message: await prisma.emailMessage.update({ where: { id: message.id }, data: { replyReceivedAt: new Date() } }) });
}));

router.get("/calendar", asyncRoute(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86_400_000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 180 * 86_400_000);
  const events = await prisma.calendarEvent.findMany({
    where: { organizationId: req.user!.organizationId, startsAt: { gte: from, lte: to } },
    orderBy: { startsAt: "asc" }
  });
  res.json({ events });
}));

router.post("/calendar", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(z.object({
    connectionId: z.string().uuid().optional().nullable(),
    contactId: z.string().uuid().optional().nullable(),
    leadId: z.string().uuid().optional().nullable(),
    dealId: z.string().uuid().optional().nullable(),
    title: z.string().min(1).max(240),
    description: z.string().max(10_000).optional().nullable(),
    location: z.string().max(500).optional().nullable(),
    attendeeEmails: z.array(z.string().email()).max(100).default([]),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime()
  }), req.body);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (endsAt <= startsAt) throw new HttpError("Event end must be after start", 400);
  await assertCrmRelations(req.user!.organizationId, input);
  const connection = input.connectionId ? await prisma.oAuthConnection.findFirst({
    where: { id: input.connectionId, organizationId: req.user!.organizationId, userId: req.user!.id, provider: { in: ["GOOGLE", "MICROSOFT"] } }
  }) : null;
  if (input.connectionId && !connection) throw new HttpError("Calendar connection not found", 404);
  const externalEventId = connection ? await createProviderEvent(connection, { ...input, startsAt, endsAt }) : null;
  const event = await prisma.calendarEvent.create({
    data: {
      organizationId: req.user!.organizationId, ownerId: req.user!.id,
      contactId: input.contactId, leadId: input.leadId, dealId: input.dealId,
      provider: connection?.provider, externalEventId, title: input.title, description: input.description,
      location: input.location, attendeeEmails: input.attendeeEmails, startsAt, endsAt
    }
  });
  res.status(201).json({ event });
}));

router.delete("/calendar/:id", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const event = await prisma.calendarEvent.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId }
  });
  if (!event) throw new HttpError("Calendar event not found", 404);
  if (event.externalEventId && event.provider) {
    const connection = await prisma.oAuthConnection.findFirst({
      where: {
        organizationId: req.user!.organizationId,
        userId: event.ownerId,
        provider: event.provider,
        status: "ACTIVE"
      }
    });
    if (connection) await cancelProviderEvent(connection, event.externalEventId);
  }
  await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { status: "CANCELED" }
  });
  res.status(204).end();
}));

export default router;
