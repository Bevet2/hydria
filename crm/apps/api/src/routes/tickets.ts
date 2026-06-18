import { randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import type { Request } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { hashToken } from "../lib/security.js";
import { assertCrmRelations } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import { sendTransactionalEmail } from "../services/transactionalEmail.js";
import { routeTicketOwner, ticketDeadlines } from "../services/supportSla.js";

const router = Router();
const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value ? new Date(value) : null));
const ticketSchema = z.object({
  subject: z.string().min(1).max(180),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"]).default("OPEN"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  source: z.string().min(1).max(40).default("MANUAL"),
  assignedToId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  queueId: z.string().uuid().optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  dueAt: optionalDate
});
const messageSchema = z.object({
  body: z.string().min(1).max(10000),
  public: z.boolean().default(true)
});
const queueSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  firstResponseMinutes: z.coerce.number().int().min(5).max(43200).default(240),
  resolutionMinutes: z.coerce.number().int().min(15).max(129600).default(1440),
  escalationAfterMinutes: z.coerce.number().int().min(5).max(129600).default(720),
  routingStrategy: z.enum(["ROUND_ROBIN", "LEAST_OPEN"]).default("ROUND_ROBIN"),
  businessHours: z.record(z.unknown()).optional().nullable(),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(100).optional().nullable(),
  pauseStatuses: z.array(z.enum(["OPEN", "IN_PROGRESS", "WAITING"])).max(3).optional().nullable(),
  escalationPolicy: z.array(z.object({
    afterMinutes: z.coerce.number().int().min(5).max(129600),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "WAITING"]).optional()
  })).max(10).optional().nullable(),
  active: z.boolean().default(true)
});

const include = {
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  queue: true,
  _count: { select: { messages: true } }
} as const;

function optionalJson(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

type PortalTokenPayload = {
  ticketId: string;
  portalToken: string;
  email: string;
  purpose: "ticket_portal";
};

function portalAccess(req: Request) {
  const token = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError("Portal authentication required", 401);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as PortalTokenPayload;
    if (
      payload.purpose !== "ticket_portal" ||
      payload.portalToken !== String(req.params.portalToken)
    ) {
      throw new Error("Invalid portal token");
    }
    return payload;
  } catch {
    throw new HttpError("Portal session expired or invalid", 401);
  }
}

router.post(
  "/portal/:portalToken/request-access",
  asyncRoute(async (req, res) => {
    const input = z.object({ email: z.string().email() }).parse(req.body);
    const email = input.email.trim().toLowerCase();
    const ticket = await prisma.ticket.findUnique({
      where: { portalToken: String(req.params.portalToken) },
      include: { contact: { select: { email: true } } }
    });
    if (!ticket) throw new HttpError("Ticket portal not found", 404);
    const allowedEmails = [ticket.customerEmail, ticket.contact?.email]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    if (!allowedEmails.includes(email)) {
      throw new HttpError("This email is not associated with the ticket", 403);
    }
    const code = String(randomInt(100000, 1000000));
    await prisma.authToken.create({
      data: {
        organizationId: ticket.organizationId,
        email,
        type: "PORTAL_ACCESS",
        tokenHash: hashToken(code),
        expiresAt: new Date(Date.now() + 10 * 60_000),
        metadata: { ticketId: ticket.id, portalToken: ticket.portalToken }
      }
    });
    const delivery = await sendTransactionalEmail({
      to: email,
      subject: `Access code for ticket ${ticket.number}`,
      text: `Your Hydria support access code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your Hydria support access code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`
    });
    if (!delivery.delivered && env.NODE_ENV === "production") {
      throw new HttpError("Transactional email is not configured", 503);
    }
    res.json({
      sent: delivery.delivered,
      ...(env.NODE_ENV !== "production" && !delivery.delivered ? { devCode: code } : {})
    });
  })
);

router.post(
  "/portal/:portalToken/session",
  asyncRoute(async (req, res) => {
    const input = z.object({
      email: z.string().email(),
      code: z.string().regex(/^\d{6}$/)
    }).parse(req.body);
    const email = input.email.trim().toLowerCase();
    const ticket = await prisma.ticket.findUnique({
      where: { portalToken: String(req.params.portalToken) }
    });
    if (!ticket) throw new HttpError("Ticket portal not found", 404);
    const accessToken = await prisma.authToken.findFirst({
      where: {
        organizationId: ticket.organizationId,
        email,
        type: "PORTAL_ACCESS",
        tokenHash: hashToken(input.code),
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });
    const metadata =
      accessToken?.metadata && typeof accessToken.metadata === "object" &&
      !Array.isArray(accessToken.metadata)
        ? accessToken.metadata as Record<string, unknown>
        : {};
    if (!accessToken || metadata.ticketId !== ticket.id) {
      throw new HttpError("Invalid or expired access code", 401);
    }
    await prisma.authToken.update({
      where: { id: accessToken.id },
      data: { usedAt: new Date() }
    });
    const token = jwt.sign(
      {
        ticketId: ticket.id,
        portalToken: ticket.portalToken,
        email,
        purpose: "ticket_portal"
      } satisfies PortalTokenPayload,
      env.JWT_SECRET,
      { expiresIn: "2h" }
    );
    res.json({ token, expiresIn: 7200 });
  })
);

async function createTicketEvent(input: {
  organizationId: string;
  ticketId: string;
  actorId?: string | null;
  type: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.ticketEvent.create({
    data: {
      ...input,
      metadata: input.metadata as Prisma.InputJsonValue | undefined
    }
  });
}

router.get(
  "/portal/:portalToken",
  asyncRoute(async (req, res) => {
    const access = portalAccess(req);
    const ticket = await prisma.ticket.findUnique({
      where: { portalToken: access.portalToken },
      select: {
        id: true,
        number: true,
        subject: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          where: { public: true },
          orderBy: { createdAt: "asc" },
          select: {
            id: true, body: true, inbound: true, authorName: true, createdAt: true
          }
        }
      }
    });
    if (!ticket) throw new HttpError("Ticket portal not found", 404);
    res.json({ ticket });
  })
);

router.post(
  "/portal/:portalToken/messages",
  asyncRoute(async (req, res) => {
    const access = portalAccess(req);
    const input = z.object({
      body: z.string().min(1).max(10000),
      name: z.string().min(1).max(120)
    }).parse(req.body);
    const ticket = await prisma.ticket.findUnique({
      where: { portalToken: access.portalToken }
    });
    if (!ticket) throw new HttpError("Ticket portal not found", 404);
    const message = await prisma.ticketMessage.create({
      data: {
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        authorName: input.name,
        authorEmail: access.email,
        body: input.body,
        public: true,
        inbound: true
      }
    });
    await createTicketEvent({
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      type: "CUSTOMER_REPLY",
      summary: `${input.name} replied from the customer portal`
    });
    res.status(201).json({ message });
  })
);

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const status = String(req.query.status || "").toUpperCase();
    const priority = String(req.query.priority || "").toUpperCase();
    const assignedToId = String(req.query.assignedToId || "");
    const search = String(req.query.search || "").trim();
    const tickets = await prisma.ticket.findMany({
      where: {
        organizationId: req.user!.organizationId,
        ...(["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"].includes(status)
          ? { status: status as "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED" }
          : {}),
        ...(["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)
          ? { priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" }
          : {}),
        ...(assignedToId === "me"
          ? { assignedToId: req.user!.id }
          : assignedToId
            ? { assignedToId }
            : {}),
        ...(search
          ? {
              OR: [
                { number: { contains: search, mode: "insensitive" as const } },
                { subject: { contains: search, mode: "insensitive" as const } },
                { description: { contains: search, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
      include
    });
    res.json({ tickets });
  })
);

router.get(
  "/queues",
  asyncRoute(async (req, res) => {
    const queues = await prisma.supportQueue.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { tickets: true } } }
    });
    res.json({ queues });
  })
);

router.post(
  "/queues",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(queueSchema, req.body);
    const queue = await prisma.supportQueue.create({
      data: {
        ...input,
        organizationId: req.user!.organizationId,
        businessHours: optionalJson(input.businessHours),
        holidays: optionalJson(input.holidays),
        pauseStatuses: optionalJson(input.pauseStatuses),
        escalationPolicy: optionalJson(input.escalationPolicy)
      }
    });
    res.status(201).json({ queue });
  })
);

router.patch(
  "/queues/:queueId",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(queueSchema.partial(), req.body);
    const current = await prisma.supportQueue.findFirst({
      where: { id: String(req.params.queueId), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Support queue not found", 404);
    const queue = await prisma.supportQueue.update({
      where: { id: current.id },
      data: {
        ...input,
        businessHours: optionalJson(input.businessHours),
        holidays: optionalJson(input.holidays),
        pauseStatuses: optionalJson(input.pauseStatuses),
        escalationPolicy: optionalJson(input.escalationPolicy)
      }
    });
    res.json({ queue });
  })
);

router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const ticket = await prisma.ticket.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      include: {
        ...include,
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, firstName: true, lastName: true } } }
        },
        events: {
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    });
    if (!ticket) throw new HttpError("Ticket not found", 404);
    const now = new Date();
    const breached =
      !["RESOLVED", "CLOSED"].includes(ticket.status) &&
      Boolean(ticket.resolutionDueAt && ticket.resolutionDueAt < now);
    if (breached && !ticket.slaBreachedAt) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaBreachedAt: now }
      });
      ticket.slaBreachedAt = now;
    }
    res.json({ ticket });
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(ticketSchema, req.body);
    await assertCrmRelations(req.user!.organizationId, input);
    const queue = input.queueId
      ? await prisma.supportQueue.findFirst({
          where: { id: input.queueId, organizationId: req.user!.organizationId }
        })
      : await prisma.supportQueue.findFirst({
          where: { organizationId: req.user!.organizationId, active: true },
          orderBy: { createdAt: "asc" }
        });
    if (input.queueId && !queue) throw new HttpError("Support queue not found", 404);
    const createdAt = new Date();
    const deadlines = ticketDeadlines(createdAt, queue);
    const assignedToId =
      input.assignedToId ||
      await routeTicketOwner(req.user!.organizationId, queue) ||
      req.user!.id;
    const ticket = await prisma.ticket.create({
      data: {
        ...input,
        queueId: queue?.id || null,
        organizationId: req.user!.organizationId,
        createdById: req.user!.id,
        assignedToId,
        number: `T-${randomUUID().slice(0, 8).toUpperCase()}`,
        ...deadlines,
        resolvedAt: ["RESOLVED", "CLOSED"].includes(input.status) ? new Date() : null
      },
      include
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      contactId: ticket.contactId || undefined,
      companyId: ticket.companyId || undefined,
      type: "RECORD_CREATED",
      subject: `Created ticket ${ticket.number}`,
      body: ticket.subject,
      metadata: { ticketId: ticket.id }
    });
    await createTicketEvent({
      organizationId: req.user!.organizationId,
      ticketId: ticket.id,
      actorId: req.user!.id,
      type: "CREATED",
      summary: `Ticket ${ticket.number} created`
    });
    res.status(201).json({ ticket });
  })
);

router.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(ticketSchema.partial(), req.body);
    const current = await prisma.ticket.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Ticket not found", 404);
    await assertCrmRelations(req.user!.organizationId, input);
    let nextQueue = null;
    if (input.queueId) {
      nextQueue = await prisma.supportQueue.findFirst({
        where: { id: input.queueId, organizationId: req.user!.organizationId }
      });
      if (!nextQueue) throw new HttpError("Support queue not found", 404);
    }
    const closesTicket = input.status && ["RESOLVED", "CLOSED"].includes(input.status);
    const reopensTicket = input.status && !["RESOLVED", "CLOSED"].includes(input.status);
    const ticket = await prisma.ticket.update({
      where: { id: current.id },
      data: {
        ...input,
        ...(nextQueue && nextQueue.id !== current.queueId
          ? ticketDeadlines(current.createdAt, nextQueue)
          : {}),
        resolvedAt: closesTicket ? current.resolvedAt || new Date() : reopensTicket ? null : undefined
      },
      include
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      contactId: ticket.contactId || undefined,
      companyId: ticket.companyId || undefined,
      type: "RECORD_UPDATED",
      subject: `Updated ticket ${ticket.number}`,
      body: ticket.subject,
      metadata: { ticketId: ticket.id, status: ticket.status }
    });
    await createTicketEvent({
      organizationId: req.user!.organizationId,
      ticketId: ticket.id,
      actorId: req.user!.id,
      type: "UPDATED",
      summary: `Ticket updated (${ticket.status})`,
      metadata: JSON.parse(JSON.stringify(input))
    });
    res.json({ ticket });
  })
);

router.post(
  "/:id/messages",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(messageSchema, req.body);
    const ticket = await prisma.ticket.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!ticket) throw new HttpError("Ticket not found", 404);
    const message = await prisma.ticketMessage.create({
      data: {
        organizationId: req.user!.organizationId,
        ticketId: ticket.id,
        authorId: req.user!.id,
        authorName: req.user!.email,
        body: input.body,
        public: input.public,
        inbound: false
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } }
    });
    const firstRespondedAt = input.public && !ticket.firstRespondedAt ? new Date() : undefined;
    if (firstRespondedAt) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { firstRespondedAt }
      });
    }
    await createTicketEvent({
      organizationId: req.user!.organizationId,
      ticketId: ticket.id,
      actorId: req.user!.id,
      type: input.public ? "PUBLIC_REPLY" : "INTERNAL_NOTE",
      summary: input.public ? "Public reply sent" : "Internal note added"
    });
    res.status(201).json({ message });
  })
);

router.post(
  "/:id/escalate",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const ticket = await prisma.ticket.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!ticket) throw new HttpError("Ticket not found", 404);
    const escalated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        escalatedAt: new Date(),
        escalationLevel: { increment: 1 },
        priority: "URGENT",
        status: "IN_PROGRESS"
      },
      include
    });
    await createTicketEvent({
      organizationId: req.user!.organizationId,
      ticketId: ticket.id,
      actorId: req.user!.id,
      type: "ESCALATED",
      summary: "Ticket escalated to urgent"
    });
    res.json({ ticket: escalated });
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const current = await prisma.ticket.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Ticket not found", 404);
    await prisma.ticket.delete({ where: { id: current.id } });
    res.status(204).end();
  })
);

export default router;
