import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { issueAuthToken } from "../services/authTokens.js";
import { deliverAuthLink } from "../services/transactionalEmail.js";

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
        emailVerifiedAt: new Date(),
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

router.get(
  "/invitations",
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const invitations = await prisma.authToken.findMany({
      where: {
        organizationId: req.user!.organizationId,
        type: "INVITATION",
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, metadata: true, expiresAt: true, createdAt: true }
    });
    res.json({ invitations });
  })
);

router.post(
  "/invitations",
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const input = parseBody(
      z.object({
        email: z.string().email().transform((value) => value.toLowerCase()),
        firstName: z.string().min(1).max(60),
        lastName: z.string().min(1).max(60),
        role: z.enum(["ADMIN", "MANAGER", "MEMBER", "VIEWER"]).default("MEMBER")
      }),
      req.body
    );
    if (await prisma.user.findUnique({ where: { email: input.email } })) {
      throw new HttpError("Email already in use", 409);
    }
    const invitation = await issueAuthToken({
      organizationId: req.user!.organizationId,
      createdById: req.user!.id,
      email: input.email,
      role: input.role,
      type: "INVITATION",
      ttlMs: 7 * 24 * 60 * 60_000,
      metadata: { firstName: input.firstName, lastName: input.lastName }
    });
    const invitationUrl = `${env.PUBLIC_WEB_URL}/accept-invitation?token=${encodeURIComponent(invitation.token)}`;
    const delivery = await deliverAuthLink({
      to: input.email,
      subject: "You are invited to Northstar CRM",
      introduction: "Use this link within seven days to join the CRM workspace.",
      url: invitationUrl
    });
    res.status(201).json({
      invitation: {
        id: invitation.record.id,
        email: invitation.record.email,
        role: invitation.record.role,
        expiresAt: invitation.record.expiresAt
      },
      emailDelivery: delivery,
      ...(env.NODE_ENV === "production"
        ? {}
        : {
            debugToken: invitation.token,
            debugUrl: `${env.PUBLIC_WEB_URL}/accept-invitation?token=${encodeURIComponent(invitation.token)}`
          })
    });
  })
);

router.delete(
  "/invitations/:id",
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const result = await prisma.authToken.deleteMany({
      where: {
        id: String(req.params.id),
        organizationId: req.user!.organizationId,
        type: "INVITATION",
        usedAt: null
      }
    });
    if (!result.count) throw new HttpError("Invitation not found", 404);
    res.status(204).end();
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
    if (target.role === "ADMIN" && input.role !== "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { organizationId: req.user!.organizationId, role: "ADMIN" }
      });
      if (adminCount <= 1) {
        throw new HttpError("The workspace must keep at least one administrator", 409);
      }
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
