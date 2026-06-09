import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, parsePagination } from "../lib/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "MANAGER"));

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const resource = String(req.query.resource || "").trim();
    const where = {
      organizationId: req.user!.organizationId,
      ...(resource ? { resource } : {})
    };
    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      }),
      prisma.auditLog.count({ where })
    ]);
    res.json({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  })
);

export default router;
