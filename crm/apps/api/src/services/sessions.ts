import type { Request } from "express";
import { env } from "../config/env.js";
import { signAccessToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { hashToken, randomToken } from "../lib/security.js";

type SessionUser = {
  id: string;
  organizationId: string;
  role: "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
  email: string;
};

export async function createUserSession(user: SessionUser, req?: Request) {
  const refreshToken = randomToken(48);
  const expiresAt = new Date(Date.now() + env.SESSION_EXPIRES_DAYS * 86_400_000);
  const session = await prisma.authSession.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: String(req?.headers["user-agent"] || "").slice(0, 500) || null,
      ipAddress: String(req?.ip || req?.socket.remoteAddress || "").slice(0, 100) || null,
      expiresAt
    }
  });
  return {
    token: signAccessToken({
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
      sessionId: session.id
    }),
    refreshToken,
    session
  };
}

export async function rotateSession(refreshToken: string, req?: Request) {
  const session = await prisma.authSession.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
    include: { user: true }
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  const nextRefreshToken = randomToken(48);
  const updated = await prisma.authSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashToken(nextRefreshToken),
      lastUsedAt: new Date(),
      userAgent: String(req?.headers["user-agent"] || session.userAgent || "").slice(0, 500),
      ipAddress: String(req?.ip || req?.socket.remoteAddress || session.ipAddress || "").slice(0, 100)
    }
  });
  return {
    token: signAccessToken({
      sub: session.user.id,
      organizationId: session.user.organizationId,
      role: session.user.role,
      email: session.user.email,
      sessionId: updated.id
    }),
    refreshToken: nextRefreshToken
  };
}
