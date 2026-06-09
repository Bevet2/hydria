import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const sensitiveKeys = new Set(["password", "passwordHash", "token", "authorization", "secret"]);

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") {
    return typeof value === "string" && value.length > 500 ? `${value.slice(0, 500)}...` : value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 50)
      .map(([key, item]) => [
        key,
        sensitiveKeys.has(key.toLowerCase()) ? "[redacted]" : sanitize(item, depth + 1)
      ])
  );
}

function routeParts(req: Request) {
  return req.path.split("/").filter(Boolean).filter((part) => part !== "api");
}

export function auditMutations(req: Request, res: Response, next: () => void) {
  const startedAt = Date.now();
  res.on("finish", () => {
    if (!mutatingMethods.has(req.method) || !req.user || res.statusCode >= 400) return;
    const parts = routeParts(req);
    const resource = parts[0] || "unknown";
    const resourceId = parts.find((part) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part)
    );
    void prisma.auditLog.create({
      data: {
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: `${req.method.toLowerCase()}.${resource}`,
        resource,
        resourceId,
        method: req.method,
        path: req.originalUrl.split("?")[0] || req.path,
        statusCode: res.statusCode,
        metadata: sanitize({
          query: req.query,
          body: req.body,
          durationMs: Date.now() - startedAt
        }) as object
      }
    }).catch((error) => {
      console.error("Unable to write CRM audit log", error);
    });
  });
  next();
}
