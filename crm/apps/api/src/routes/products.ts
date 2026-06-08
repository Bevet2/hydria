import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { assertCanWrite, requireAuth, requireRole } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";

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
    const quote = await prisma.quote.update({ where: { id: current.id }, data: input });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      dealId: quote.dealId,
      companyId: quote.companyId || undefined,
      contactId: quote.contactId || undefined,
      type: "QUOTE_STATUS_CHANGED",
      subject: `Quote ${quote.number} marked ${quote.status.toLowerCase()}`
    });
    res.json({ quote });
  })
);

export default router;
