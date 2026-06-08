import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { assertCustomFieldEntityInOrganization } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const entityTypes = ["CONTACT", "COMPANY", "DEAL", "LEAD"] as const;
const fieldTypes = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "MULTI_SELECT"] as const;

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const requestedType = String(req.query.entityType || "").toUpperCase();
    const definitions = await prisma.customFieldDefinition.findMany({
      where: {
        organizationId: req.user!.organizationId,
        ...(entityTypes.includes(requestedType as (typeof entityTypes)[number])
          ? { entityType: requestedType as (typeof entityTypes)[number] }
          : {})
      },
      orderBy: [{ entityType: "asc" }, { label: "asc" }]
    });
    res.json({ definitions });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const input = parseBody(
      z.object({
        entityType: z.enum(entityTypes),
        key: z
          .string()
          .min(1)
          .max(60)
          .transform((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")),
        label: z.string().min(1).max(80),
        fieldType: z.enum(fieldTypes),
        required: z.boolean().default(false),
        options: z.array(z.string().min(1)).optional()
      }),
      req.body
    );
    const definition = await prisma.customFieldDefinition.create({
      data: { ...input, organizationId: req.user!.organizationId }
    });
    res.status(201).json({ definition });
  })
);

router.put(
  "/:definitionId/values/:entityId",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(z.object({ value: z.unknown() }), req.body);
    const definition = await prisma.customFieldDefinition.findFirst({
      where: { id: String(req.params.definitionId), organizationId: req.user!.organizationId }
    });
    if (!definition) throw new HttpError("Custom field not found", 404);
    await assertCustomFieldEntityInOrganization(
      req.user!.organizationId,
      definition.entityType,
      String(req.params.entityId)
    );
    const value = await prisma.customFieldValue.upsert({
      where: {
        definitionId_entityId: {
          definitionId: definition.id,
          entityId: String(req.params.entityId)
        }
      },
      update: { value: input.value as never },
      create: {
        organizationId: req.user!.organizationId,
        definitionId: definition.id,
        entityId: String(req.params.entityId),
        value: input.value as never
      }
    });
    res.json({ value });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const definition = await prisma.customFieldDefinition.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!definition) throw new HttpError("Custom field not found", 404);
    await prisma.customFieldDefinition.delete({ where: { id: definition.id } });
    res.status(204).end();
  })
);

export default router;
