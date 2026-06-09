import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashToken, randomToken } from "../lib/security.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const scopeSchema = z.enum(["crm:read", "crm:write", "crm:communications", "crm:commercial", "crm:admin"]);
router.use(requireAuth, requireRole("ADMIN"));

router.get("/", asyncRoute(async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, prefix: true, scopes: true, lastUsedAt: true,
      expiresAt: true, revokedAt: true, createdAt: true
    }
  });
  res.json({ keys });
}));

router.post("/", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    name: z.string().min(1).max(120),
    scopes: z.array(scopeSchema).min(1).max(5).default(["crm:read"]),
    expiresAt: z.string().datetime().optional().nullable()
  }), req.body);
  const secret = randomToken(32);
  const prefix = secret.slice(0, 8);
  const token = `ncrm_${prefix}_${secret}`;
  const key = await prisma.apiKey.create({
    data: {
      organizationId: req.user!.organizationId,
      createdById: req.user!.id,
      name: input.name,
      prefix: `ncrm_${prefix}`,
      keyHash: hashToken(token),
      scopes: input.scopes,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    }
  });
  res.status(201).json({ key: { ...key, keyHash: undefined }, token });
}));

router.delete("/:id", asyncRoute(async (req, res) => {
  const result = await prisma.apiKey.updateMany({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  if (!result.count) throw new HttpError("API key not found", 404);
  res.status(204).end();
}));

export default router;
