import type { RequestHandler } from "express";

// Defense at the serialization boundary, including nested Prisma User relations.
// Authentication services still need these fields internally.
const privateUserFields = new Set(["passwordHash", "mfaSecret", "mfaRecoveryCodes"]);
export function publicJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicJson);
  if (!value || typeof value !== "object" || value instanceof Date || Buffer.isBuffer(value)) return value;
  if ("toJSON" in value && typeof value.toJSON === "function") return publicJson(value.toJSON());
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !privateUserFields.has(key))
    .map(([key, child]) => [key, publicJson(child)]));
}
export const protectJsonResponses: RequestHandler = (_req, res, next) => {
  const send = res.json.bind(res);
  res.json = (body: unknown) => send(publicJson(body));
  next();
};
