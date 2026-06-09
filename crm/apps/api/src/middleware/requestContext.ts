import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  req.requestId = String(req.headers["x-request-id"] || randomUUID());
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
