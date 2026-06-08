import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { verifyAccessToken } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    next(new HttpError("Authentication required", 401));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
      email: payload.email
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
