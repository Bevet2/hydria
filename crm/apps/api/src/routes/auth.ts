import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8)
});

const registerSchema = loginSchema.extend({
  organizationName: z.string().min(2).max(80),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60)
});

function publicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  organization?: { name: string; slug: string };
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    organizationId: user.organizationId,
    organization: user.organization
  };
}

router.post(
  "/register",
  asyncRoute(async (req, res) => {
    const input = parseBody(registerSchema, req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new HttpError("An account already exists for this email", 409);
    }

    const slugBase = input.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "workspace";
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug,
          pipelineStages: {
            create: [
              { name: "New", position: 0, color: "#667b74" },
              { name: "Qualified", position: 1, color: "#397f9c" },
              { name: "Proposal", position: 2, color: "#a76b2d" },
              { name: "Won", position: 3, color: "#167d68", isWon: true },
              { name: "Lost", position: 4, color: "#9d4b4b", isLost: true }
            ]
          }
        }
      });
      return tx.user.create({
        data: {
          organizationId: organization.id,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: "ADMIN"
        },
        include: { organization: true }
      });
    });

    const token = signAccessToken({
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email
    });
    res.status(201).json({ token, user: publicUser(user) });
  })
);

router.post(
  "/login",
  asyncRoute(async (req, res) => {
    const input = parseBody(loginSchema, req.body);
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { organization: true }
    });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new HttpError("Invalid email or password", 401);
    }

    const token = signAccessToken({
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email
    });
    res.json({ token, user: publicUser(user) });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: {
        id: req.user!.id,
        organizationId: req.user!.organizationId
      },
      include: { organization: true }
    });
    if (!user) {
      throw new HttpError("User not found", 404);
    }
    res.json({ user: publicUser(user) });
  })
);

export default router;
