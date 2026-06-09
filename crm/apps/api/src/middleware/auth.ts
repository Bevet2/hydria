import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { verifyAccessToken } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { hashToken } from "../lib/security.js";

const adminPrefixes = [
  "/api/api-keys",
  "/api/backups",
  "/api/compliance",
  "/api/monitoring",
  "/api/users",
  "/api/automations",
  "/api/webhooks"
];

function requiredApiScope(req: Request) {
  const path = req.originalUrl.split("?")[0] || "";
  if (adminPrefixes.some((prefix) => path.startsWith(prefix))) return "crm:admin";
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    if (path.startsWith("/api/communications") || path.startsWith("/api/integrations")) return "crm:communications";
    if (path.startsWith("/api/commercial") || path.startsWith("/api/products")) return "crm:commercial";
    return "crm:write";
  }
  return "crm:read";
}

function parseScopes(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    next(new HttpError("Authentication required", 401));
    return;
  }

  try {
    if (token.startsWith("ncrm_")) {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          keyHash: hashToken(token),
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        }
      });
      if (!apiKey) throw new Error("API key expired or revoked");
      const user = await prisma.user.findFirst({
        where: { id: apiKey.createdById, organizationId: apiKey.organizationId }
      });
      if (!user) throw new Error("API key owner not found");
      const scopes = parseScopes(apiKey.scopes);
      const required = requiredApiScope(req);
      if (!scopes.includes("crm:admin") && !scopes.includes(required)) {
        next(new HttpError(`API key requires scope ${required}`, 403));
        return;
      }
      req.user = {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
        email: user.email,
        apiKeyId: apiKey.id,
        apiKeyScopes: scopes
      };
      void prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
      next();
      return;
    }
    const payload = verifyAccessToken(token);
    if (payload.sessionId) {
      const session = await prisma.authSession.findFirst({
        where: {
          id: payload.sessionId,
          userId: payload.sub,
          organizationId: payload.organizationId,
          revokedAt: null,
          expiresAt: { gt: new Date() }
        },
        include: { user: { select: { role: true, email: true } } }
      });
      if (!session) throw new Error("Session expired or revoked");
      if (Date.now() - session.lastUsedAt.getTime() > 60_000) {
        void prisma.authSession.update({
          where: { id: session.id },
          data: { lastUsedAt: new Date() }
        }).catch(() => undefined);
      }
      payload.role = session.user.role;
      payload.email = session.user.email;
    }
    req.user = {
      id: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
      email: payload.email,
      sessionId: payload.sessionId
    };
    next();
  } catch {
    next(new HttpError("Invalid or expired token", 401));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new HttpError("Insufficient permissions", 403));
      return;
    }
    next();
  };
}

export function assertCanWrite(req: Request) {
  if (!req.user || req.user.role === "VIEWER") {
    throw new HttpError("This role is read-only", 403);
  }
}
