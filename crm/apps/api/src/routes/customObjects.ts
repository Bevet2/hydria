import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { assertCanWrite, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/),
  label: z.string().min(1).max(100),
  type: z.enum(["text", "number", "date", "boolean", "select", "multi_select"]),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1).max(100)).max(100).optional()
});
const definitionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
  name: z.string().min(1).max(100),
  pluralName: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  fields: z.array(fieldSchema).max(100)
});
const recordSchema = z.object({
  displayName: z.string().min(1).max(200),
  ownerId: z.string().uuid().optional().nullable(),
  values: z.record(z.unknown()).default({})
});

router.use(requireAuth);

function validateValues(fields: z.infer<typeof fieldSchema>[], values: Record<string, unknown>) {
  const allowed = new Map(fields.map((field) => [field.key, field]));
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) throw new HttpError(`Unknown custom properties: ${unknown.join(", ")}`, 400);
  const missing = fields
    .filter((field) => field.required)
    .filter((field) => values[field.key] === undefined || values[field.key] === null || values[field.key] === "")
    .map((field) => field.label);
  if (missing.length) throw new HttpError(`Required custom properties: ${missing.join(", ")}`, 400);
}

router.get("/", asyncRoute(async (req, res) => {
  const definitions = await prisma.customObjectDefinition.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { records: true } } }
  });
  res.json({ definitions });
}));

router.post("/", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(definitionSchema, req.body);
  const definition = await prisma.customObjectDefinition.create({
    data: {
      ...input,
      organizationId: req.user!.organizationId,
      fields: input.fields as Prisma.InputJsonValue
    }
  });
  res.status(201).json({ definition });
}));

router.patch("/:definitionId", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(definitionSchema.partial(), req.body);
  const current = await prisma.customObjectDefinition.findFirst({
    where: { id: String(req.params.definitionId), organizationId: req.user!.organizationId }
  });
  if (!current) throw new HttpError("Custom object not found", 404);
  const definition = await prisma.customObjectDefinition.update({
    where: { id: current.id },
    data: {
      ...input,
      fields: input.fields as Prisma.InputJsonValue | undefined
    }
  });
  res.json({ definition });
}));

router.delete("/:definitionId", requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const current = await prisma.customObjectDefinition.findFirst({
    where: { id: String(req.params.definitionId), organizationId: req.user!.organizationId }
  });
  if (!current) throw new HttpError("Custom object not found", 404);
  await prisma.customObjectDefinition.delete({ where: { id: current.id } });
  res.status(204).end();
}));

router.get("/:definitionId/records", asyncRoute(async (req, res) => {
  const definition = await prisma.customObjectDefinition.findFirst({
    where: { id: String(req.params.definitionId), organizationId: req.user!.organizationId }
  });
  if (!definition) throw new HttpError("Custom object not found", 404);
  const search = String(req.query.search || "").trim();
  const records = await prisma.customObjectRecord.findMany({
    where: {
      organizationId: req.user!.organizationId,
      definitionId: definition.id,
      ...(search ? { displayName: { contains: search, mode: "insensitive" } } : {})
    },
    orderBy: { updatedAt: "desc" },
    take: 200
  });
  res.json({ definition, records });
}));

router.post("/:definitionId/records", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(recordSchema, req.body);
  const definition = await prisma.customObjectDefinition.findFirst({
    where: { id: String(req.params.definitionId), organizationId: req.user!.organizationId }
  });
  if (!definition) throw new HttpError("Custom object not found", 404);
  const fields = definition.fields as z.infer<typeof fieldSchema>[];
  validateValues(fields, input.values);
  if (input.ownerId) {
    const owner = await prisma.user.findFirst({
      where: { id: input.ownerId, organizationId: req.user!.organizationId }
    });
    if (!owner) throw new HttpError("Owner not found", 404);
  }
  const record = await prisma.customObjectRecord.create({
    data: {
      organizationId: req.user!.organizationId,
      definitionId: definition.id,
      ownerId: input.ownerId,
      displayName: input.displayName,
      values: input.values as Prisma.InputJsonValue
    }
  });
  res.status(201).json({ record });
}));

router.patch("/:definitionId/records/:recordId", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const input = parseBody(recordSchema.partial(), req.body);
  const definition = await prisma.customObjectDefinition.findFirst({
    where: { id: String(req.params.definitionId), organizationId: req.user!.organizationId }
  });
  const current = await prisma.customObjectRecord.findFirst({
    where: {
      id: String(req.params.recordId),
      definitionId: String(req.params.definitionId),
      organizationId: req.user!.organizationId
    }
  });
  if (!definition || !current) throw new HttpError("Custom record not found", 404);
  if (input.values) validateValues(definition.fields as z.infer<typeof fieldSchema>[], input.values);
  const record = await prisma.customObjectRecord.update({
    where: { id: current.id },
    data: {
      ...input,
      values: input.values as Prisma.InputJsonValue | undefined
    }
  });
  res.json({ record });
}));

router.delete("/:definitionId/records/:recordId", asyncRoute(async (req, res) => {
  assertCanWrite(req);
  const current = await prisma.customObjectRecord.findFirst({
    where: {
      id: String(req.params.recordId),
      definitionId: String(req.params.definitionId),
      organizationId: req.user!.organizationId
    }
  });
  if (!current) throw new HttpError("Custom record not found", 404);
  await prisma.customObjectRecord.delete({ where: { id: current.id } });
  res.status(204).end();
}));

export default router;
