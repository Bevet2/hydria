import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });
    res.json({ users });
  })
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const input = parseBody(
      z.object({
        email: z.string().email().transform((value) => value.toLowerCase()),
        password: z.string().min(8),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        role: z.enum(["ADMIN", "MANAGER", "MEMBER", "VIEWER"]).default("MEMBER")
      }),
      req.body
    );
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) {
      throw new HttpError("Email already in use", 409);
    }
    const user = await prisma.user.create({
      data: {
        organizationId: req.user!.organizationId,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });
    res.status(201).json({ user });
  })
);

router.patch(
  "/:id/role",
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const input = parseBody(
      z.object({ role: z.enum(["ADMIN", "MANAGER", "MEMBER", "VIEWER"]) }),
      req.body
    );
    const target = await prisma.user.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!target) {
      throw new HttpError("User not found", 404);
    }
    const user = await prisma.user.update({
      where: { id: target.id },
      data: { role: input.role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });
    res.json({ user });
  })
);

export default router;
