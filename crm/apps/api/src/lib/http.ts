import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public details: unknown = null
  ) {
    super(message);
  }
}

export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function parseBody<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError("Validation failed", 400, result.error.flatten());
  }
  return result.data as z.infer<T>;
}

// Zod 4 applies field defaults even to object.partial() schemas. For PATCH
// requests that would silently overwrite omitted fields (notably recurrence),
// retain only the keys supplied by the caller after normal validation.
export function parsePatchBody<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const parsed = parseBody(schema, value);
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  return Object.fromEntries(Object.entries(parsed).filter(([key]) =>
    Object.prototype.hasOwnProperty.call(value, key))) as z.infer<T>;
}

export function parsePagination(query: Request["query"]) {
  const page = Math.max(1, Number.parseInt(String(query.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || "25"), 10) || 25));
  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}
