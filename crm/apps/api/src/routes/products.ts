import { Prisma } from "@prisma/client";
import { Router } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { assertCanWrite, requireAuth, requireRole } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import { triggerAutomations } from "../services/automations.js";

const router = Router();

function calculateLineTotal(quantity: number, unitPrice: number, discountPercent: number) {
  return Math.round(quantity * unitPrice * (1 - discountPercent / 100) * 100) / 100;
}

const productSchema = z.object({
  name: z.string().min(1).max(160),
  sku: z.string().min(1).max(80).transform((value) => value.toUpperCase()),
  description: z.string().max(2000).optional(),
  unitPrice: z.coerce.number().nonnegative(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).default("EUR"),
  active: z.boolean().default(true)
});

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const products = await prisma.product.findMany({
      where: {
        organizationId: req.user!.organizationId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { dealLineItems: true, quoteLineItems: true } } }
    });
    res.json({ products });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const input = parseBody(productSchema, req.body);
    const product = await prisma.product.create({
      data: { ...input, organizationId: req.user!.organizationId }
    });
    res.status(201).json({ product });
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const input = parseBody(productSchema.partial(), req.body);
    const current = await prisma.product.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Product not found", 404);
    const product = await prisma.product.update({ where: { id: current.id }, data: input });
    res.json({ product });
  })
);

router.get(
  "/deals/:dealId/items",
  asyncRoute(async (req, res) => {
    const deal = await prisma.deal.findFirst({
      where: { id: String(req.params.dealId), organizationId: req.user!.organizationId }
    });
    if (!deal) throw new HttpError("Deal not found", 404);
    const items = await prisma.dealLineItem.findMany({
      where: { dealId: deal.id, organizationId: req.user!.organizationId },
      include: { product: true },
      orderBy: { createdAt: "asc" }
    });
    res.json({ items });
  })
);

router.post(
  "/deals/:dealId/items",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().positive().default(1),
        unitPrice: z.coerce.number().nonnegative().optional(),
        discountPercent: z.coerce.number().min(0).max(100).default(0)
      }),
      req.body
    );
    const organizationId = req.user!.organizationId;
    const [deal, product] = await Promise.all([
      prisma.deal.findFirst({ where: { id: String(req.params.dealId), organizationId } }),
      prisma.product.findFirst({ where: { id: input.productId, organizationId, active: true } })
    ]);
    if (!deal) throw new HttpError("Deal not found", 404);
    if (!product) throw new HttpError("Product not found", 404);
    const unitPrice = input.unitPrice ?? Number(product.unitPrice);
    const lineTotal = calculateLineTotal(input.quantity, unitPrice, input.discountPercent);
    const item = await prisma.dealLineItem.upsert({
      where: { dealId_productId: { dealId: deal.id, productId: product.id } },
      update: {
        quantity: input.quantity,
        unitPrice,
        discountPercent: input.discountPercent,
        lineTotal
      },
      create: {
        organizationId,
        dealId: deal.id,
        productId: product.id,
        quantity: input.quantity,
        unitPrice,
        discountPercent: input.discountPercent,
        lineTotal
      },
      include: { product: true }
    });
    const aggregate = await prisma.dealLineItem.aggregate({
      where: { dealId: deal.id },
      _sum: { lineTotal: true }
    });
    await prisma.deal.update({
      where: { id: deal.id },
      data: { value: Number(aggregate._sum.lineTotal || 0) }
    });
    res.status(201).json({ item, dealValue: Number(aggregate._sum.lineTotal || 0) });
  })
);

router.delete(
  "/deals/:dealId/items/:itemId",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const organizationId = req.user!.organizationId;
    const item = await prisma.dealLineItem.findFirst({
      where: {
        id: String(req.params.itemId),
        dealId: String(req.params.dealId),
        organizationId
      }
    });
    if (!item) throw new HttpError("Deal line item not found", 404);
    await prisma.dealLineItem.delete({ where: { id: item.id } });
    const aggregate = await prisma.dealLineItem.aggregate({
      where: { dealId: item.dealId },
      _sum: { lineTotal: true }
    });
    await prisma.deal.update({
      where: { id: item.dealId },
      data: { value: Number(aggregate._sum.lineTotal || 0) }
    });
    res.status(204).end();
  })
);

router.get(
  "/quotes",
  asyncRoute(async (req, res) => {
    const quotes = await prisma.quote.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        deal: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { lineItems: true } }
      }
    });
    res.json({ quotes });
  })
);

router.get(
  "/quotes/:id/pdf",
  asyncRoute(async (req, res) => {
    const quote = await prisma.quote.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      include: {
        organization: true,
        deal: true,
        company: true,
        contact: true,
        owner: true,
        lineItems: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!quote) throw new HttpError("Quote not found", 404);

    const currency = quote.deal.currency || "EUR";
    const money = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    });
    const document = new PDFDocument({ size: "A4", margin: 48 });
    const filename = `${quote.number.replace(/[^a-z0-9-]/gi, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    document.pipe(res);

    document.fontSize(10).fillColor("#167d68").text(quote.organization.name.toUpperCase());
    document.moveDown(0.5);
    document.fontSize(24).fillColor("#202823").text(`Quote ${quote.number}`);
    document.fontSize(13).fillColor("#4e5953").text(quote.name);
    document.moveDown(1.2);

    document.fontSize(10).fillColor("#6f7973");
    document.text(`Status: ${quote.status}`);
    document.text(`Created: ${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(quote.createdAt)}`);
    if (quote.validUntil) {
      document.text(`Valid until: ${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(quote.validUntil)}`);
    }
    document.moveDown();
    document.fillColor("#202823").fontSize(11).text("Customer", { underline: true });
    document.fontSize(10).fillColor("#4e5953").text(quote.company?.name || "No company");
    if (quote.contact) {
      document.text(`${quote.contact.firstName} ${quote.contact.lastName}`);
      if (quote.contact.email) document.text(quote.contact.email);
    }
    document.moveDown(1.2);

    const left = 48;
    const descriptionWidth = 240;
    document.fontSize(9).fillColor("#6f7973");
    document.text("DESCRIPTION", left, document.y, { width: descriptionWidth });
    document.text("QTY", 310, document.y, { width: 50, align: "right" });
    document.text("UNIT", 370, document.y, { width: 75, align: "right" });
    document.text("TOTAL", 455, document.y, { width: 90, align: "right" });
    document.moveDown(0.7);
    document.strokeColor("#d8ddd9").moveTo(left, document.y).lineTo(547, document.y).stroke();
    document.moveDown(0.6);

    for (const item of quote.lineItems) {
      const rowY = document.y;
      document.fillColor("#202823").fontSize(10).text(item.description, left, rowY, { width: descriptionWidth });
      document.text(String(item.quantity), 310, rowY, { width: 50, align: "right" });
      document.text(money.format(Number(item.unitPrice)), 370, rowY, { width: 75, align: "right" });
      document.text(money.format(Number(item.lineTotal)), 455, rowY, { width: 90, align: "right" });
      document.y = Math.max(document.y, rowY + 22);
    }

    document.moveDown();
    const totalsX = 350;
    document.fillColor("#4e5953").fontSize(10);
    document.text("Subtotal", totalsX, document.y, { width: 100 });
    document.text(money.format(Number(quote.subtotal)), 455, document.y - 12, { width: 90, align: "right" });
    if (Number(quote.discountPercent) > 0) {
      document.text(`Discount (${quote.discountPercent}%)`, totalsX, document.y, { width: 100 });
    }
    if (Number(quote.taxPercent) > 0) {
      document.text(`Tax (${quote.taxPercent}%)`, totalsX, document.y, { width: 100 });
    }
    document.moveDown(0.5);
    document.fontSize(13).fillColor("#202823").text("Total", totalsX, document.y, { width: 100 });
    document.text(money.format(Number(quote.total)), 455, document.y - 15, { width: 90, align: "right" });

    if (quote.notes) {
      document.moveDown(2);
      document.fontSize(10).fillColor("#202823").text("Notes", { underline: true });
      document.fillColor("#4e5953").text(quote.notes);
    }
    document.end();
  })
);

router.post(
  "/deals/:dealId/quotes",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(
      z.object({
        name: z.string().min(1).max(160),
        validUntil: z.string().optional().nullable(),
        discountPercent: z.coerce.number().min(0).max(100).default(0),
        taxPercent: z.coerce.number().min(0).max(100).default(0),
        notes: z.string().max(4000).optional()
      }),
      req.body
    );
    const organizationId = req.user!.organizationId;
    const deal = await prisma.deal.findFirst({
      where: { id: String(req.params.dealId), organizationId },
      include: { lineItems: { include: { product: true } } }
    });
    if (!deal) throw new HttpError("Deal not found", 404);
    if (!deal.lineItems.length) throw new HttpError("Add at least one product to the deal", 409);
    const subtotal = deal.lineItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
    const discounted = subtotal * (1 - input.discountPercent / 100);
    const total = Math.round(discounted * (1 + input.taxPercent / 100) * 100) / 100;
    const serial = `${new Date().getFullYear()}-${String(
      (await prisma.quote.count({ where: { organizationId } })) + 1
    ).padStart(5, "0")}`;
    const quote = await prisma.quote.create({
      data: {
        organizationId,
        ownerId: req.user!.id,
        dealId: deal.id,
        companyId: deal.companyId,
        contactId: deal.primaryContactId,
        number: serial,
        name: input.name,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        subtotal,
        discountPercent: input.discountPercent,
        taxPercent: input.taxPercent,
        total,
        notes: input.notes,
        lineItems: {
          create: deal.lineItems.map((item) => ({
            organizationId,
            productId: item.productId,
            description: item.product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            lineTotal: item.lineTotal
          }))
        }
      },
      include: { lineItems: true, deal: true, company: true, contact: true }
    });
    await recordActivity({
      organizationId,
      actorId: req.user!.id,
      dealId: deal.id,
      companyId: deal.companyId || undefined,
      contactId: deal.primaryContactId || undefined,
      type: "RECORD_CREATED",
      subject: `Created quote ${quote.number}`
    });
    await prisma.quoteVersion.create({
      data: {
        organizationId,
        quoteId: quote.id,
        version: 1,
        snapshot: JSON.parse(JSON.stringify(quote)) as Prisma.InputJsonValue,
        createdById: req.user!.id
      }
    });
    res.status(201).json({ quote });
  })
);

router.patch(
  "/quotes/:id/status",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(
      z.object({ status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]) }),
      req.body
    );
    const current = await prisma.quote.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) throw new HttpError("Quote not found", 404);
    if (["SENT", "ACCEPTED"].includes(input.status)) {
      const blockingApprovals = await prisma.quoteApproval.count({
        where: { quoteId: current.id, status: { not: "APPROVED" } }
      });
      if (blockingApprovals) throw new HttpError("All quote approvals must be completed first", 409);
    }
    const quote = await prisma.quote.update({ where: { id: current.id }, data: input });
    const quoteWithLines = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
      include: { lineItems: true }
    });
    await prisma.quoteVersion.create({
      data: {
        organizationId: req.user!.organizationId,
        quoteId: quote.id,
        version: (await prisma.quoteVersion.count({ where: { quoteId: quote.id } })) + 1,
        snapshot: JSON.parse(JSON.stringify(quoteWithLines)) as Prisma.InputJsonValue,
        createdById: req.user!.id
      }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      dealId: quote.dealId,
      companyId: quote.companyId || undefined,
      contactId: quote.contactId || undefined,
      type: "QUOTE_STATUS_CHANGED",
      subject: `Quote ${quote.number} marked ${quote.status.toLowerCase()}`
    });
    if (quote.status === "ACCEPTED" && current.status !== "ACCEPTED") {
      await triggerAutomations(req.user!.organizationId, "QUOTE_ACCEPTED", {
        entityType: "quote",
        entityId: quote.id,
        fields: {
          number: quote.number,
          total: Number(quote.total),
          dealId: quote.dealId,
          companyId: quote.companyId,
          contactId: quote.contactId
        }
      });
    }
    res.json({ quote });
  })
);

router.delete(
  "/quotes/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const quote = await prisma.quote.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!quote) throw new HttpError("Quote not found", 404);
    if (quote.status !== "DRAFT") {
      throw new HttpError("Only draft quotes can be deleted", 409);
    }
    await prisma.quote.delete({ where: { id: quote.id } });
    res.status(204).end();
  })
);

export default router;
