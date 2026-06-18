import { Router } from "express";
import { z } from "zod";
import { asyncRoute, parseBody } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncRoute(async (req, res) => {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: req.user!.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      brandColor: true,
      defaultCurrency: true,
      locale: true,
      timezone: true,
      defaultTaxPercent: true,
      paymentTermsDays: true,
      quotePrefix: true,
      invoicePrefix: true
    }
  });
  res.json({ organization });
}));

router.patch("/", requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    name: z.string().min(2).max(120).optional(),
    logoUrl: z.string().url().nullable().optional(),
    brandColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    defaultCurrency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
    locale: z.string().min(2).max(20).optional(),
    timezone: z.string().min(3).max(80).optional(),
    defaultTaxPercent: z.coerce.number().min(0).max(100).optional(),
    paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
    quotePrefix: z.string().min(1).max(12).regex(/^[A-Za-z0-9-]+$/).optional(),
    invoicePrefix: z.string().min(1).max(12).regex(/^[A-Za-z0-9-]+$/).optional()
  }), req.body);
  const organization = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: input
  });
  res.json({ organization });
}));

export default router;
