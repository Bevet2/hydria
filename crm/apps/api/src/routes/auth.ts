import { Prisma } from "@prisma/client";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env.js";
import { verifyMfaChallengeToken, signMfaChallengeToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import {
  createTotpSecret,
  decryptSecret,
  encryptSecret,
  hashToken,
  randomToken,
  verifyTotp
} from "../lib/security.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { findUsableAuthToken, issueAuthToken } from "../services/authTokens.js";
import { createUserSession, rotateSession } from "../services/sessions.js";
import { deliverAuthLink } from "../services/transactionalEmail.js";

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
  emailVerifiedAt?: Date | null;
  mfaEnabled?: boolean;
  organization?: { name: string; slug: string };
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    organizationId: user.organizationId,
    emailVerifiedAt: user.emailVerifiedAt || null,
    mfaEnabled: Boolean(user.mfaEnabled),
    organization: user.organization
  };
}

function tokenResponse(token: string, path: string) {
  return env.NODE_ENV === "production"
    ? {}
    : { debugToken: token, debugUrl: `${env.PUBLIC_WEB_URL}${path}${encodeURIComponent(token)}` };
}

async function completeLogin(user: {
  id: string;
  organizationId: string;
  role: "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
  email: string;
  firstName: string;
  lastName: string;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  organization: { name: string; slug: string };
}, req: Parameters<typeof createUserSession>[1]) {
  const session = await createUserSession(user, req);
  return { token: session.token, refreshToken: session.refreshToken, user: publicUser(user) };
}

router.post(
  "/register",
  asyncRoute(async (req, res) => {
    const input = parseBody(registerSchema, req.body);
    if (await prisma.user.findUnique({ where: { email: input.email } })) {
      throw new HttpError("An account already exists for this email", 409);
    }
    const slugBase = input.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "workspace";
    const slug = `${slugBase}-${Date.now().toString(36)}`;
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
          passwordHash: await bcrypt.hash(input.password, 12),
          firstName: input.firstName,
          lastName: input.lastName,
          role: "ADMIN"
        },
        include: { organization: true }
      });
    });
    const verification = await issueAuthToken({
      organizationId: user.organizationId,
      userId: user.id,
      email: user.email,
      type: "EMAIL_VERIFICATION",
      ttlMs: 24 * 60 * 60_000
    });
    const verificationUrl = `${env.PUBLIC_WEB_URL}/verify-email?token=${encodeURIComponent(verification.token)}`;
    const delivery = await deliverAuthLink({
      to: user.email,
      subject: "Verify your Northstar CRM email",
      introduction: "Use this link to verify your email address.",
      url: verificationUrl
    });
    res.status(201).json({
      ...(await completeLogin(user, req)),
      emailDelivery: delivery,
      ...tokenResponse(verification.token, "/verify-email?token=")
    });
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
    if (user.mfaEnabled) {
      res.json({ mfaRequired: true, challengeToken: signMfaChallengeToken(user.id) });
      return;
    }
    res.json(await completeLogin(user, req));
  })
);

router.post(
  "/login/mfa",
  asyncRoute(async (req, res) => {
    const input = parseBody(
      z.object({ challengeToken: z.string().min(1), code: z.string().min(6).max(32) }),
      req.body
    );
    let userId = "";
    try {
      userId = verifyMfaChallengeToken(input.challengeToken).sub;
    } catch {
      throw new HttpError("Invalid or expired MFA challenge", 401);
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { organization: true } });
    if (!user?.mfaEnabled || !user.mfaSecret) throw new HttpError("MFA is not enabled", 409);
    const recoveryCodes = Array.isArray(user.mfaRecoveryCodes) ? user.mfaRecoveryCodes as string[] : [];
    const recoveryHash = hashToken(input.code.trim().toUpperCase());
    const recoveryIndex = recoveryCodes.indexOf(recoveryHash);
    const valid = verifyTotp(decryptSecret(user.mfaSecret), input.code) || recoveryIndex >= 0;
    if (!valid) throw new HttpError("Invalid MFA code", 401);
    if (recoveryIndex >= 0) {
      recoveryCodes.splice(recoveryIndex, 1);
      await prisma.user.update({ where: { id: user.id }, data: { mfaRecoveryCodes: recoveryCodes } });
    }
    res.json(await completeLogin(user, req));
  })
);

router.post(
  "/refresh",
  asyncRoute(async (req, res) => {
    const input = parseBody(z.object({ refreshToken: z.string().min(20) }), req.body);
    const refreshed = await rotateSession(input.refreshToken, req);
    if (!refreshed) throw new HttpError("Invalid or expired refresh token", 401);
    res.json(refreshed);
  })
);

router.post(
  "/forgot-password",
  asyncRoute(async (req, res) => {
    const input = parseBody(z.object({ email: z.string().email().transform((value) => value.toLowerCase()) }), req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    let debug = {};
    if (user) {
      const reset = await issueAuthToken({
        organizationId: user.organizationId,
        userId: user.id,
        email: user.email,
        type: "PASSWORD_RESET",
        ttlMs: 60 * 60_000
      });
      await deliverAuthLink({
        to: user.email,
        subject: "Reset your Northstar CRM password",
        introduction: "Use this link within one hour to reset your password.",
        url: `${env.PUBLIC_WEB_URL}/reset-password?token=${encodeURIComponent(reset.token)}`
      });
      debug = tokenResponse(reset.token, "/reset-password?token=");
    }
    res.json({ accepted: true, ...debug });
  })
);

router.post(
  "/accept-invitation",
  asyncRoute(async (req, res) => {
    const input = parseBody(
      z.object({ token: z.string().min(20), password: z.string().min(10).max(200) }),
      req.body
    );
    const invitation = await findUsableAuthToken(input.token, "INVITATION");
    if (!invitation?.role) throw new HttpError("Invalid or expired invitation", 400);
    const invitationRole = invitation.role;
    if (await prisma.user.findUnique({ where: { email: invitation.email } })) {
      throw new HttpError("An account already exists for this email", 409);
    }
    const metadata = invitation.metadata && typeof invitation.metadata === "object" && !Array.isArray(invitation.metadata)
      ? invitation.metadata as Record<string, unknown>
      : {};
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: invitation.organizationId,
          email: invitation.email,
          passwordHash: await bcrypt.hash(input.password, 12),
          firstName: String(metadata.firstName || "Invited"),
          lastName: String(metadata.lastName || "User"),
          role: invitationRole,
          emailVerifiedAt: new Date()
        },
        include: { organization: true }
      });
      await tx.authToken.update({ where: { id: invitation.id }, data: { usedAt: new Date(), userId: created.id } });
      return created;
    });
    res.status(201).json(await completeLogin(user, req));
  })
);

router.post(
  "/reset-password",
  asyncRoute(async (req, res) => {
    const input = parseBody(z.object({ token: z.string().min(20), password: z.string().min(10).max(200) }), req.body);
    const record = await findUsableAuthToken(input.token, "PASSWORD_RESET");
    if (!record?.userId) throw new HttpError("Invalid or expired password reset token", 400);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await bcrypt.hash(input.password, 12) }
      }),
      prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);
    res.json({ reset: true });
  })
);

router.post(
  "/verify-email",
  asyncRoute(async (req, res) => {
    const input = parseBody(z.object({ token: z.string().min(20) }), req.body);
    const record = await findUsableAuthToken(input.token, "EMAIL_VERIFICATION");
    if (!record?.userId) throw new HttpError("Invalid or expired verification token", 400);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })
    ]);
    res.json({ verified: true });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { id: req.user!.id, organizationId: req.user!.organizationId },
      include: { organization: true }
    });
    if (!user) throw new HttpError("User not found", 404);
    res.json({ user: publicUser(user) });
  })
);

router.post(
  "/verification/request",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (user.emailVerifiedAt) {
      res.json({ verified: true });
      return;
    }
    const verification = await issueAuthToken({
      organizationId: user.organizationId,
      userId: user.id,
      email: user.email,
      type: "EMAIL_VERIFICATION",
      ttlMs: 24 * 60 * 60_000
    });
    const delivery = await deliverAuthLink({
      to: user.email,
      subject: "Verify your Northstar CRM email",
      introduction: "Use this link to verify your email address.",
      url: `${env.PUBLIC_WEB_URL}/verify-email?token=${encodeURIComponent(verification.token)}`
    });
    res.json({ sent: true, emailDelivery: delivery, ...tokenResponse(verification.token, "/verify-email?token=") });
  })
);

router.get(
  "/sessions",
  requireAuth,
  asyncRoute(async (req, res) => {
    const sessions = await prisma.authSession.findMany({
      where: { userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true
      }
    });
    res.json({ sessions, currentSessionId: req.user!.sessionId || null });
  })
);

router.delete(
  "/sessions/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const result = await prisma.authSession.updateMany({
      where: { id: String(req.params.id), userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    if (!result.count) throw new HttpError("Session not found", 404);
    res.status(204).end();
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.user!.sessionId) {
      await prisma.authSession.updateMany({
        where: { id: req.user!.sessionId, userId: req.user!.id },
        data: { revokedAt: new Date() }
      });
    }
    res.status(204).end();
  })
);

router.post(
  "/logout-all",
  requireAuth,
  asyncRoute(async (req, res) => {
    await prisma.authSession.updateMany({
      where: { userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    res.status(204).end();
  })
);

router.post(
  "/mfa/setup",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const secret = createTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: encryptSecret(secret),
        mfaEnabled: false,
        mfaRecoveryCodes: Prisma.JsonNull
      }
    });
    const issuer = encodeURIComponent("Northstar CRM");
    const label = encodeURIComponent(`Northstar CRM:${user.email}`);
    res.json({ secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}` });
  })
);

router.post(
  "/mfa/enable",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = parseBody(z.object({ code: z.string().length(6) }), req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.mfaSecret || !verifyTotp(decryptSecret(user.mfaSecret), input.code)) {
      throw new HttpError("Invalid MFA code", 400);
    }
    const recoveryCodes = Array.from({ length: 8 }, () => randomToken(8).toUpperCase());
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaRecoveryCodes: recoveryCodes.map(hashToken) }
    });
    res.json({ enabled: true, recoveryCodes });
  })
);

router.post(
  "/mfa/disable",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = parseBody(z.object({ code: z.string().min(6).max(32) }), req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.mfaSecret || !verifyTotp(decryptSecret(user.mfaSecret), input.code)) {
      throw new HttpError("Invalid MFA code", 400);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaRecoveryCodes: Prisma.JsonNull
      }
    });
    res.json({ enabled: false });
  })
);

export default router;
