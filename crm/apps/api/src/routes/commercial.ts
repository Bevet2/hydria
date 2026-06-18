import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { env } from "../config/env.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { decryptSecret, hashToken, randomToken } from "../lib/security.js";
import { assertCanWrite, requireAuth, requireRole } from "../middleware/auth.js";
import { deliverAuthLink } from "../services/transactionalEmail.js";
import { enqueueBackgroundJob } from "../services/backgroundJobs.js";

const router = Router();

function snapshot(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function lineTotal(quantity: number, unitPrice: number, discountPercent: number) {
  return Math.round(quantity * unitPrice * (1 - discountPercent / 100) * 100) / 100;
}

async function createQuoteVersion(quoteId: string, organizationId: string, userId: string) {
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { lineItems: { orderBy: { createdAt: "asc" } } }
  });
  return prisma.quoteVersion.create({
    data: {
      organizationId,
      quoteId,
      version: (await prisma.quoteVersion.count({ where: { quoteId } })) + 1,
      snapshot: snapshot(quote),
      createdById: userId
    }
  });
}

async function refreshInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: true, creditNotes: true }
  });
  if (invoice.status === "VOID") return invoice;
  const paid = invoice.payments
    .filter((payment) => ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount) - Number(payment.refundedAmount), 0);
  const credits = invoice.creditNotes
    .filter((credit) => credit.status === "ISSUED")
    .reduce((sum, credit) => sum + Number(credit.amount), 0);
  const settled = Math.round((paid + credits) * 100) / 100;
  const status = paid === 0 && credits > 0 && credits >= Number(invoice.total)
    ? "REFUNDED"
    : settled >= Number(invoice.total)
      ? "PAID"
      : settled > 0
        ? "PARTIALLY_PAID"
        : invoice.dueAt && invoice.dueAt < new Date()
          ? "OVERDUE"
          : invoice.issuedAt
            ? "ISSUED"
            : "DRAFT";
  return prisma.invoice.update({
    where: { id: invoice.id },
    data: { status, paidAt: status === "PAID" ? invoice.paidAt || new Date() : null }
  });
}

router.get("/signatures/:token", asyncRoute(async (req, res) => {
  const signature = await prisma.signatureRequest.findFirst({
    where: { tokenHash: hashToken(String(req.params.token)), status: "PENDING", expiresAt: { gt: new Date() } },
    include: {
      quote: {
        include: { organization: { select: { name: true } }, company: true, contact: true, lineItems: true }
      }
    }
  });
  if (!signature) throw new HttpError("Signature request is invalid or expired", 404);
  res.json({
    signature: {
      id: signature.id,
      signerName: signature.signerName,
      signerEmail: signature.signerEmail,
      expiresAt: signature.expiresAt,
      quote: signature.quote
    }
  });
}));

router.post("/signatures/:token", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    signerName: z.string().min(2).max(160),
    accepted: z.literal(true),
    signature: z.string().min(2).max(100_000)
  }), req.body);
  const current = await prisma.signatureRequest.findFirst({
    where: { tokenHash: hashToken(String(req.params.token)), status: "PENDING", expiresAt: { gt: new Date() } },
    include: { quote: true }
  });
  if (!current) throw new HttpError("Signature request is invalid or expired", 404);
  await prisma.$transaction([
    prisma.signatureRequest.update({
      where: { id: current.id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureData: {
          signerName: input.signerName,
          signature: input.signature,
          acceptedAt: new Date().toISOString()
        }
      }
    }),
    prisma.quote.update({ where: { id: current.quoteId }, data: { status: "ACCEPTED" } })
  ]);
  res.json({ signed: true });
}));

router.post("/payments/stripe/webhook", asyncRoute(async (req, res) => {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new HttpError("Stripe webhook is not configured", 503);
  const signature = String(req.headers["stripe-signature"] || "");
  const timestamp = signature.match(/t=(\d+)/)?.[1];
  const supplied = signature.match(/v1=([a-f0-9]+)/)?.[1];
  if (!timestamp || !supplied) throw new HttpError("Invalid Stripe signature", 401);
  const expected = crypto.createHmac("sha256", env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${req.rawBody?.toString("utf8") || JSON.stringify(req.body)}`)
    .digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new HttpError("Invalid Stripe signature", 401);
  const event = req.body as any;
  if (event.type === "checkout.session.completed") {
    const externalId = String(event.data?.object?.id || "");
    const payment = await prisma.payment.findFirst({ where: { externalId }, include: { invoice: true } });
    if (payment) {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "SUCCEEDED",
            paidAt: new Date(),
            metadata: {
              checkoutSessionId: externalId,
              paymentIntentId: String(event.data?.object?.payment_intent || "")
            }
          }
        })
      ]);
      await refreshInvoiceStatus(payment.invoiceId);
    }
  }
  res.json({ received: true });
}));

router.use(requireAuth);

router.get("/goals", asyncRoute(async (req, res) => {
  const goals = await prisma.salesGoal.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: [{ periodStart: "desc" }, { name: "asc" }]
  });
  const withProgress = await Promise.all(goals.map(async (goal) => {
    const userFilter = goal.userId ? { ownerId: goal.userId } : {};
    const achieved = goal.metric === "WON_REVENUE"
      ? Number((await prisma.deal.aggregate({
          where: { organizationId: goal.organizationId, status: "WON", updatedAt: { gte: goal.periodStart, lte: goal.periodEnd }, ...userFilter },
          _sum: { value: true }
        }))._sum.value || 0)
      : goal.metric === "WON_DEALS"
        ? await prisma.deal.count({ where: { organizationId: goal.organizationId, status: "WON", updatedAt: { gte: goal.periodStart, lte: goal.periodEnd }, ...userFilter } })
        : await prisma.activity.count({ where: { organizationId: goal.organizationId, occurredAt: { gte: goal.periodStart, lte: goal.periodEnd }, actorId: goal.userId || undefined } });
    return { ...goal, achieved, progressPercent: Number(goal.target) ? Math.round(achieved / Number(goal.target) * 100) : 0 };
  }));
  res.json({ goals: withProgress });
}));

router.post("/goals", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    userId: z.string().uuid().optional().nullable(),
    name: z.string().min(1).max(120),
    metric: z.enum(["WON_REVENUE", "WON_DEALS", "ACTIVITIES"]),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    target: z.coerce.number().positive()
  }), req.body);
  if (input.userId && !await prisma.user.findFirst({ where: { id: input.userId, organizationId: req.user!.organizationId } })) throw new HttpError("User not found", 404);
  const goal = await prisma.salesGoal.create({
    data: { ...input, organizationId: req.user!.organizationId, periodStart: new Date(input.periodStart), periodEnd: new Date(input.periodEnd) }
  });
  res.status(201).json({ goal });
}));

router.delete("/goals/:id", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const result = await prisma.salesGoal.deleteMany({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!result.count) throw new HttpError("Sales goal not found", 404);
  res.status(204).end();
}));

router.get("/quotes/:id/history", asyncRoute(async (req, res) => {
  const quote = await prisma.quote.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!quote) throw new HttpError("Quote not found", 404);
  const [versions, approvals, signatures] = await Promise.all([
    prisma.quoteVersion.findMany({ where: { quoteId: quote.id }, orderBy: { version: "desc" } }),
    prisma.quoteApproval.findMany({ where: { quoteId: quote.id }, orderBy: { createdAt: "desc" } }),
    prisma.signatureRequest.findMany({ where: { quoteId: quote.id }, orderBy: { createdAt: "desc" }, select: { id: true, signerName: true, signerEmail: true, status: true, expiresAt: true, signedAt: true, createdAt: true } })
  ]);
  res.json({ versions, approvals, signatures });
}));

router.get("/quotes/:id", asyncRoute(async (req, res) => {
  const quote = await prisma.quote.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: {
      lineItems: { orderBy: { createdAt: "asc" }, include: { product: true } },
      deal: true,
      company: true,
      contact: true,
      approvals: { orderBy: { createdAt: "desc" } },
      signatures: { orderBy: { createdAt: "desc" } },
      invoices: { include: { payments: true, creditNotes: true } }
    }
  });
  if (!quote) throw new HttpError("Quote not found", 404);
  res.json({ quote });
}));

router.patch("/quotes/:id", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    name: z.string().min(1).max(160).optional(),
    validUntil: z.string().datetime().nullable().optional(),
    discountPercent: z.coerce.number().min(0).max(100).optional(),
    taxPercent: z.coerce.number().min(0).max(100).optional(),
    notes: z.string().max(4000).nullable().optional(),
    lineItems: z.array(z.object({
      productId: z.string().uuid().nullable().optional(),
      description: z.string().min(1).max(500),
      quantity: z.coerce.number().positive(),
      unitPrice: z.coerce.number().nonnegative(),
      discountPercent: z.coerce.number().min(0).max(100).default(0)
    })).min(1).max(200).optional()
  }), req.body);
  const organizationId = req.user!.organizationId;
  const current = await prisma.quote.findFirst({
    where: { id: String(req.params.id), organizationId },
    include: { lineItems: true }
  });
  if (!current) throw new HttpError("Quote not found", 404);
  if (current.status !== "DRAFT") throw new HttpError("Only draft quotes can be edited", 409);
  if (input.lineItems) {
    const productIds = input.lineItems.map((item) => item.productId).filter(Boolean) as string[];
    const validProducts = await prisma.product.count({ where: { organizationId, id: { in: productIds } } });
    if (validProducts !== new Set(productIds).size) throw new HttpError("A quote product does not belong to this organization", 400);
  }
  const lines = input.lineItems?.map((item) => ({
    ...item,
    productId: item.productId || null,
    organizationId,
    lineTotal: lineTotal(item.quantity, item.unitPrice, item.discountPercent)
  }));
  const subtotal = lines?.reduce((sum, item) => sum + item.lineTotal, 0)
    ?? current.lineItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const discountPercent = input.discountPercent ?? Number(current.discountPercent);
  const taxPercent = input.taxPercent ?? Number(current.taxPercent);
  const total = Math.round(subtotal * (1 - discountPercent / 100) * (1 + taxPercent / 100) * 100) / 100;
  const quote = await prisma.$transaction(async (tx) => {
    if (lines) {
      await tx.quoteLineItem.deleteMany({ where: { quoteId: current.id } });
      await tx.quoteLineItem.createMany({
        data: lines.map((item) => ({ ...item, quoteId: current.id }))
      });
    }
    return tx.quote.update({
      where: { id: current.id },
      data: {
        name: input.name,
        validUntil: input.validUntil === undefined ? undefined : input.validUntil ? new Date(input.validUntil) : null,
        discountPercent,
        taxPercent,
        notes: input.notes,
        subtotal,
        total
      },
      include: { lineItems: { orderBy: { createdAt: "asc" } } }
    });
  });
  await createQuoteVersion(quote.id, organizationId, req.user!.id);
  res.json({ quote });
}));

router.get("/approvals/inbox", asyncRoute(async (req, res) => {
  const approvals = await prisma.quoteApproval.findMany({
    where: {
      organizationId: req.user!.organizationId,
      status: "PENDING",
      ...(req.user!.role === "ADMIN" ? {} : { reviewerId: req.user!.id })
    },
    orderBy: { createdAt: "asc" },
    include: {
      quote: {
        include: {
          company: { select: { id: true, name: true } },
          deal: { select: { id: true, name: true, currency: true } },
          lineItems: { orderBy: { createdAt: "asc" } }
        }
      }
    }
  });
  res.json({ approvals });
}));

router.post("/quotes/:id/versions", asyncRoute(async (req, res) => {
  const quote = await prisma.quote.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: { lineItems: true }
  });
  if (!quote) throw new HttpError("Quote not found", 404);
  const version = await prisma.quoteVersion.create({
    data: {
      organizationId: req.user!.organizationId,
      quoteId: quote.id,
      version: (await prisma.quoteVersion.count({ where: { quoteId: quote.id } })) + 1,
      snapshot: snapshot(quote),
      createdById: req.user!.id
    }
  });
  res.status(201).json({ version });
}));

router.post("/quotes/:id/approvals", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({ reviewerId: z.string().uuid() }), req.body);
  const [quote, reviewer] = await Promise.all([
    prisma.quote.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } }),
    prisma.user.findFirst({ where: { id: input.reviewerId, organizationId: req.user!.organizationId } })
  ]);
  if (!quote) throw new HttpError("Quote not found", 404);
  if (!reviewer) throw new HttpError("Reviewer not found", 404);
  const approval = await prisma.quoteApproval.create({
    data: { organizationId: req.user!.organizationId, quoteId: quote.id, reviewerId: reviewer.id }
  });
  res.status(201).json({ approval });
}));

router.post("/approvals/:id/decision", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({ status: z.enum(["APPROVED", "REJECTED"]), comment: z.string().max(2000).optional() }), req.body);
  const approval = await prisma.quoteApproval.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!approval) throw new HttpError("Quote approval not found", 404);
  if (approval.reviewerId !== req.user!.id && req.user!.role !== "ADMIN") throw new HttpError("This approval is assigned to another reviewer", 403);
  res.json({ approval: await prisma.quoteApproval.update({ where: { id: approval.id }, data: { ...input, decidedAt: new Date() } }) });
}));

router.post("/quotes/:id/signatures", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    signerName: z.string().min(2).max(160),
    signerEmail: z.string().email(),
    expiresInDays: z.coerce.number().int().min(1).max(90).default(14)
  }), req.body);
  const quote = await prisma.quote.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!quote) throw new HttpError("Quote not found", 404);
  const pendingApproval = await prisma.quoteApproval.count({ where: { quoteId: quote.id, status: { not: "APPROVED" } } });
  if (pendingApproval) throw new HttpError("All quote approvals must be completed before signature", 409);
  const token = randomToken(32);
  const request = await prisma.signatureRequest.create({
    data: {
      organizationId: req.user!.organizationId,
      quoteId: quote.id,
      signerName: input.signerName,
      signerEmail: input.signerEmail,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000)
    }
  });
  const signingUrl = `${env.PUBLIC_WEB_URL}/sign-quote?token=${encodeURIComponent(token)}`;
  const emailDelivery = await deliverAuthLink({
    to: input.signerEmail,
    subject: `Signature requested for ${quote.number}`,
    introduction: `Please review and sign the quote "${quote.name}".`,
    url: signingUrl
  });
  res.status(201).json({ request, signingUrl, emailDelivery });
}));

router.get("/invoices", asyncRoute(async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { createdAt: "desc" },
    include: { quote: { select: { id: true, number: true, name: true } }, payments: true, creditNotes: true }
  });
  res.json({ invoices });
}));

router.get("/invoices/:id", asyncRoute(async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: {
      quote: { include: { company: true, contact: true, lineItems: true } },
      payments: { orderBy: { createdAt: "desc" } },
      creditNotes: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!invoice) throw new HttpError("Invoice not found", 404);
  res.json({ invoice });
}));

router.get("/invoices/:id/pdf", asyncRoute(async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: {
      organization: true,
      quote: { include: { company: true, contact: true, lineItems: { orderBy: { createdAt: "asc" } } } },
      payments: true,
      creditNotes: true
    }
  });
  if (!invoice) throw new HttpError("Invoice not found", 404);
  const money = new Intl.NumberFormat(invoice.organization.locale, {
    style: "currency",
    currency: invoice.currency,
    maximumFractionDigits: 2
  });
  const document = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("content-type", "application/pdf");
  res.setHeader("content-disposition", `attachment; filename="${invoice.number.replace(/[^a-z0-9-]/gi, "_")}.pdf"`);
  document.pipe(res);
  document.fontSize(10).fillColor(invoice.organization.brandColor).text(invoice.organization.name.toUpperCase());
  document.moveDown(0.5);
  document.fontSize(24).fillColor("#202823").text(`Invoice ${invoice.number}`);
  document.fontSize(10).fillColor("#6f7973").text(`Status: ${invoice.status}`);
  if (invoice.issuedAt) document.text(`Issued: ${new Intl.DateTimeFormat(invoice.organization.locale).format(invoice.issuedAt)}`);
  if (invoice.dueAt) document.text(`Due: ${new Intl.DateTimeFormat(invoice.organization.locale).format(invoice.dueAt)}`);
  document.moveDown();
  document.fontSize(11).fillColor("#202823").text("Customer", { underline: true });
  document.fontSize(10).fillColor("#4e5953").text(invoice.quote.company?.name || "No company");
  if (invoice.quote.contact) {
    document.text(`${invoice.quote.contact.firstName} ${invoice.quote.contact.lastName}`);
    if (invoice.quote.contact.email) document.text(invoice.quote.contact.email);
  }
  document.moveDown(1.2);
  for (const line of invoice.quote.lineItems) {
    document.fillColor("#202823").text(`${line.description} x ${line.quantity}`);
    document.fillColor("#4e5953").text(money.format(Number(line.lineTotal)), { align: "right" });
  }
  document.moveDown();
  document.fontSize(11).fillColor("#202823").text(`Subtotal: ${money.format(Number(invoice.subtotal))}`, { align: "right" });
  document.text(`Tax: ${money.format(Number(invoice.tax))}`, { align: "right" });
  document.fontSize(14).text(`Total: ${money.format(Number(invoice.total))}`, { align: "right" });
  const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount) - Number(payment.refundedAmount), 0);
  const credits = invoice.creditNotes.filter((credit) => credit.status === "ISSUED").reduce((sum, credit) => sum + Number(credit.amount), 0);
  document.fontSize(10).fillColor("#4e5953").text(`Outstanding: ${money.format(Math.max(0, Number(invoice.total) - paid - credits))}`, { align: "right" });
  document.end();
}));

router.post("/quotes/:id/send", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(z.object({
    connectionId: z.string().uuid().optional().nullable(),
    recipient: z.string().email().optional(),
    message: z.string().max(4000).optional()
  }), req.body);
  const quote = await prisma.quote.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: { contact: true, company: true, deal: true }
  });
  if (!quote) throw new HttpError("Quote not found", 404);
  const blockingApprovals = await prisma.quoteApproval.count({
    where: { quoteId: quote.id, status: { not: "APPROVED" } }
  });
  if (blockingApprovals) throw new HttpError("All quote approvals must be completed before sending", 409);
  const recipient = input.recipient || quote.contact?.email;
  if (!recipient) throw new HttpError("Quote recipient email is missing", 409);
  const message = await prisma.emailMessage.create({
    data: {
      organizationId: req.user!.organizationId,
      senderId: req.user!.id,
      contactId: quote.contactId,
      provider: input.connectionId ? (await prisma.oAuthConnection.findFirst({
        where: { id: input.connectionId, organizationId: req.user!.organizationId, userId: req.user!.id }
      }))?.provider : undefined,
      to: recipient,
      subject: `Quote ${quote.number} - ${quote.name}`,
      body: input.message || `Please find quote ${quote.number} for ${quote.total} ${quote.deal.currency}.`,
      status: "QUEUED"
    }
  });
  const job = await enqueueBackgroundJob({
    organizationId: req.user!.organizationId,
    type: "EMAIL_SEND",
    payload: { emailMessageId: message.id, ...(input.connectionId ? { connectionId: input.connectionId } : {}) }
  });
  await prisma.quote.update({ where: { id: quote.id }, data: { status: "SENT" } });
  res.status(202).json({ message, job });
}));

router.post("/invoices/:id/send", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(z.object({
    connectionId: z.string().uuid().optional().nullable(),
    recipient: z.string().email().optional(),
    message: z.string().max(4000).optional()
  }), req.body);
  const invoice = await prisma.invoice.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: { quote: { include: { contact: true, company: true } } }
  });
  if (!invoice) throw new HttpError("Invoice not found", 404);
  const recipient = input.recipient || invoice.quote.contact?.email;
  if (!recipient) throw new HttpError("Invoice recipient email is missing", 409);
  const message = await prisma.emailMessage.create({
    data: {
      organizationId: req.user!.organizationId,
      senderId: req.user!.id,
      contactId: invoice.quote.contactId,
      to: recipient,
      subject: `Invoice ${invoice.number}`,
      body: input.message || `Invoice ${invoice.number} for ${invoice.total} ${invoice.currency} is ready.${invoice.dueAt ? ` Due ${invoice.dueAt.toISOString().slice(0, 10)}.` : ""}`,
      status: "QUEUED"
    }
  });
  const job = await enqueueBackgroundJob({
    organizationId: req.user!.organizationId,
    type: "EMAIL_SEND",
    payload: { emailMessageId: message.id, ...(input.connectionId ? { connectionId: input.connectionId } : {}) }
  });
  res.status(202).json({ message, job });
}));

router.patch("/invoices/:id", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    status: z.enum(["DRAFT", "ISSUED", "VOID"]).optional(),
    dueAt: z.string().datetime().nullable().optional(),
    reminderAt: z.string().datetime().nullable().optional(),
    voidReason: z.string().max(1000).optional()
  }), req.body);
  const invoice = await prisma.invoice.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: { payments: true }
  });
  if (!invoice) throw new HttpError("Invoice not found", 404);
  if (input.status === "VOID" && invoice.payments.some((payment) => payment.status === "SUCCEEDED")) {
    throw new HttpError("A paid invoice must be refunded before it can be voided", 409);
  }
  const metadata = invoice.metadata && typeof invoice.metadata === "object" && !Array.isArray(invoice.metadata)
    ? invoice.metadata as Record<string, unknown>
    : {};
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: input.status,
      dueAt: input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null,
      reminderAt: input.reminderAt === undefined ? undefined : input.reminderAt ? new Date(input.reminderAt) : null,
      issuedAt: input.status === "ISSUED" ? invoice.issuedAt || new Date() : undefined,
      metadata: input.voidReason ? { ...metadata, voidReason: input.voidReason } : undefined
    }
  });
  res.json({ invoice: updated });
}));

router.post("/quotes/:id/invoices", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({ dueAt: z.string().datetime().optional().nullable() }), req.body);
  const [quote, organization] = await Promise.all([
    prisma.quote.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId }, include: { deal: true } }),
    prisma.organization.findUniqueOrThrow({ where: { id: req.user!.organizationId } })
  ]);
  if (!quote) throw new HttpError("Quote not found", 404);
  if (quote.status !== "ACCEPTED") throw new HttpError("Only accepted quotes can be invoiced", 409);
  const existing = await prisma.invoice.findFirst({ where: { quoteId: quote.id } });
  if (existing) throw new HttpError("This quote already has an invoice", 409);
  const serial = `${organization.invoicePrefix}-${new Date().getFullYear()}-${String((await prisma.invoice.count({ where: { organizationId: req.user!.organizationId } })) + 1).padStart(5, "0")}`;
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: req.user!.organizationId,
      quoteId: quote.id,
      number: serial,
      status: "ISSUED",
      currency: quote.deal.currency,
      subtotal: quote.subtotal,
      tax: Number(quote.total) - Number(quote.subtotal) * (1 - Number(quote.discountPercent) / 100),
      total: quote.total,
      dueAt: input.dueAt ? new Date(input.dueAt) : new Date(Date.now() + organization.paymentTermsDays * 86_400_000),
      issuedAt: new Date()
    }
  });
  res.status(201).json({ invoice });
}));

router.post("/invoices/:id/checkout", asyncRoute(async (req, res) => {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError("Stripe payment is not configured", 503);
  const input = parseBody(z.object({ successUrl: z.string().url(), cancelUrl: z.string().url() }), req.body);
  const invoice = await prisma.invoice.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!invoice) throw new HttpError("Invoice not found", 404);
  if (invoice.status === "PAID" || invoice.status === "VOID") throw new HttpError("Invoice cannot be paid", 409);
  const params = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][price_data][currency]": invoice.currency.toLowerCase(),
    "line_items[0][price_data][product_data][name]": `Invoice ${invoice.number}`,
    "line_items[0][price_data][unit_amount]": String(Math.round(Number(invoice.total) * 100)),
    "line_items[0][quantity]": "1",
    "metadata[invoiceId]": invoice.id
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: params
  });
  const session = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new HttpError("Stripe checkout creation failed", 502);
  const payment = await prisma.payment.create({
    data: {
      organizationId: req.user!.organizationId,
      invoiceId: invoice.id,
      provider: "STRIPE",
      externalId: String(session.id || ""),
      amount: invoice.total,
      currency: invoice.currency,
      checkoutUrl: String(session.url || "")
    }
  });
  res.status(201).json({ payment });
}));

router.post("/invoices/:id/payments", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    amount: z.coerce.number().positive(),
    paidAt: z.string().datetime().optional(),
    reference: z.string().max(240).optional(),
    method: z.string().min(1).max(80).default("MANUAL")
  }), req.body);
  const invoice = await prisma.invoice.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: { payments: true }
  });
  if (!invoice) throw new HttpError("Invoice not found", 404);
  if (["VOID", "REFUNDED"].includes(invoice.status)) throw new HttpError("Invoice cannot receive payments", 409);
  const paid = invoice.payments.reduce((sum, payment) =>
    sum + (["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(payment.status) ? Number(payment.amount) - Number(payment.refundedAmount) : 0), 0);
  if (input.amount > Number(invoice.total) - paid + 0.01) throw new HttpError("Payment exceeds the outstanding balance", 400);
  const payment = await prisma.payment.create({
    data: {
      organizationId: req.user!.organizationId,
      invoiceId: invoice.id,
      provider: input.method.toUpperCase(),
      status: "SUCCEEDED",
      amount: input.amount,
      currency: invoice.currency,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      metadata: input.reference ? { reference: input.reference } : undefined
    }
  });
  const updatedInvoice = await refreshInvoiceStatus(invoice.id);
  res.status(201).json({ payment, invoice: updatedInvoice });
}));

router.post("/payments/:id/refunds", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    amount: z.coerce.number().positive(),
    reason: z.string().min(1).max(1000)
  }), req.body);
  const payment = await prisma.payment.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: { invoice: true }
  });
  if (!payment) throw new HttpError("Payment not found", 404);
  if (!["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(payment.status)) throw new HttpError("Payment cannot be refunded", 409);
  const refundable = Number(payment.amount) - Number(payment.refundedAmount);
  if (input.amount > refundable + 0.01) throw new HttpError("Refund exceeds the refundable amount", 400);
  let externalRefundId: string | null = null;
  if (payment.provider === "STRIPE") {
    if (!env.STRIPE_SECRET_KEY) throw new HttpError("Stripe payment is not configured", 503);
    const metadata = payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? payment.metadata as Record<string, unknown>
      : {};
    const paymentIntentId = String(metadata.paymentIntentId || "");
    if (!paymentIntentId) throw new HttpError("Stripe payment intent is missing", 409);
    const params = new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(Math.round(input.amount * 100)),
      reason: "requested_by_customer",
      "metadata[reason]": input.reason
    });
    const response = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
      body: params
    });
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new HttpError("Stripe refund failed", 502);
    externalRefundId = String(result.id || "");
  }
  const refundedAmount = Math.round((Number(payment.refundedAmount) + input.amount) * 100) / 100;
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      refundedAmount,
      status: refundedAmount >= Number(payment.amount) ? "REFUNDED" : "PARTIALLY_REFUNDED",
      metadata: {
        ...(payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata) ? payment.metadata as Record<string, unknown> : {}),
        lastRefund: { amount: input.amount, reason: input.reason, externalRefundId, refundedAt: new Date().toISOString() }
      }
    }
  });
  const invoice = await refreshInvoiceStatus(payment.invoiceId);
  res.json({ payment: updated, invoice });
}));

router.post("/invoices/:id/credit-notes", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    amount: z.coerce.number().positive(),
    reason: z.string().min(1).max(1000),
    issue: z.boolean().default(true)
  }), req.body);
  const invoice = await prisma.invoice.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: { creditNotes: true }
  });
  if (!invoice) throw new HttpError("Invoice not found", 404);
  const existingCredits = invoice.creditNotes.filter((item) => item.status === "ISSUED")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  if (input.amount > Number(invoice.total) - existingCredits + 0.01) throw new HttpError("Credit exceeds invoice total", 400);
  const serial = `CN-${new Date().getFullYear()}-${String((await prisma.creditNote.count({
    where: { organizationId: req.user!.organizationId }
  })) + 1).padStart(5, "0")}`;
  const creditNote = await prisma.creditNote.create({
    data: {
      organizationId: req.user!.organizationId,
      invoiceId: invoice.id,
      number: serial,
      amount: input.amount,
      reason: input.reason,
      status: input.issue ? "ISSUED" : "DRAFT",
      issuedAt: input.issue ? new Date() : null
    }
  });
  const updatedInvoice = await refreshInvoiceStatus(invoice.id);
  res.status(201).json({ creditNote, invoice: updatedInvoice });
}));

router.post("/invoices/:id/reminders", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    sendAt: z.string().datetime().optional()
  }), req.body);
  const invoice = await prisma.invoice.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId }
  });
  if (!invoice) throw new HttpError("Invoice not found", 404);
  if (["PAID", "REFUNDED", "VOID"].includes(invoice.status)) throw new HttpError("Invoice does not require a reminder", 409);
  const runAt = input.sendAt ? new Date(input.sendAt) : new Date();
  const job = await enqueueBackgroundJob({
    organizationId: req.user!.organizationId,
    type: "INVOICE_REMINDER",
    payload: { invoiceId: invoice.id },
    runAt
  });
  await prisma.invoice.update({ where: { id: invoice.id }, data: { reminderAt: runAt } });
  res.status(202).json({ job });
}));

router.post("/invoices/:id/push/:connectionId", asyncRoute(async (req, res) => {
  const [invoice, connection] = await Promise.all([
    prisma.invoice.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId }, include: { quote: true } }),
    prisma.oAuthConnection.findFirst({ where: { id: String(req.params.connectionId), organizationId: req.user!.organizationId, provider: "ACCOUNTING" } })
  ]);
  if (!invoice) throw new HttpError("Invoice not found", 404);
  if (!connection) throw new HttpError("Accounting connection not found", 404);
  const metadata = connection.metadata && typeof connection.metadata === "object" && !Array.isArray(connection.metadata) ? connection.metadata as Record<string, unknown> : {};
  if (!metadata.endpoint) throw new HttpError("Accounting connector endpoint is missing", 409);
  const response = await fetch(String(metadata.endpoint), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(connection.encryptedAccessToken ? { authorization: `Bearer ${decryptSecret(connection.encryptedAccessToken)}` } : {})
    },
    body: JSON.stringify(invoice)
  });
  if (!response.ok) throw new HttpError(`Accounting connector failed (${response.status})`, 502);
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  await prisma.invoice.update({ where: { id: invoice.id }, data: { externalId: String(result.id || invoice.externalId || "") } });
  res.json({ pushed: true, externalId: result.id || null });
}));

export default router;
