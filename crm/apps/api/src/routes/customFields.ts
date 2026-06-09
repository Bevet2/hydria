import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { assertCustomFieldEntityInOrganization } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const entityTypes = ["CONTACT", "COMPANY", "DEAL", "LEAD"] as const;
const fieldTypes = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "MULTI_SELECT"] as const;

function normalizeCustomFieldValue(
  definition: {
    fieldType: (typeof fieldTypes)[number];
    required: boolean;
    options: unknown;
  },
  rawValue: unknown
) {
  if (
    rawValue === null ||
    rawValue === undefined ||
    rawValue === "" ||
    (Array.isArray(rawValue) && rawValue.length === 0)
  ) {
    if (definition.required) {
      throw new HttpError("This custom field is required", 400);
    }
    return null;
  }

  if (definition.fieldType === "TEXT") {
    return z.string().max(4000).parse(rawValue);
  }
  if (definition.fieldType === "NUMBER") {
    return z.coerce.number().parse(rawValue);
  }
  if (definition.fieldType === "DATE") {
    return z.string().date().parse(rawValue);
  }
  if (definition.fieldType === "BOOLEAN") {
    if (typeof rawValue === "boolean") {
      return rawValue;
    }
    if (rawValue === "true" || rawValue === "1") {
      return true;
    }
    if (rawValue === "false" || rawValue === "0") {
      return false;
    }
    throw new HttpError("Custom field value must be a boolean", 400);
  }

  const options = Array.isArray(definition.options)
    ? definition.options.filter((option): option is string => typeof option === "string")
    : [];
  if (definition.fieldType === "SELECT") {
    const value = z.string().parse(rawValue);
    if (options.length && !options.includes(value)) {
      throw new HttpError("Custom field value is not an allowed option", 400);
    }
    return value;
  }

  const values = z.array(z.string()).parse(rawValue);
  if (options.length && values.some((value) => !options.includes(value))) {
    throw new HttpError("Custom field value contains an invalid option", 400);
  }
  return values;
}

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

router.get(
  "/values/:entityType/:entityId",
  asyncRoute(async (req, res) => {
    const entityType = String(req.params.entityType || "").toUpperCase();
    if (!entityTypes.includes(entityType as (typeof entityTypes)[number])) {
      throw new HttpError("Unsupported custom field entity type", 400);
    }
    const organizationId = req.user!.organizationId;
    const entityId = String(req.params.entityId);
    await assertCustomFieldEntityInOrganization(
      organizationId,
      entityType as (typeof entityTypes)[number],
      entityId
    );
    const definitions = await prisma.customFieldDefinition.findMany({
      where: {
        organizationId,
        entityType: entityType as (typeof entityTypes)[number]
      },
      orderBy: { label: "asc" },
      include: {
        values: {
          where: { entityId },
          take: 1
        }
      }
    });
    res.json({
      fields: definitions.map(({ values, ...definition }) => ({
        ...definition,
        value: values[0]?.value ?? null
      }))
    });
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
    const normalizedValue = normalizeCustomFieldValue(definition, input.value);
    if (normalizedValue === null) {
      await prisma.customFieldValue.deleteMany({
        where: {
          organizationId: req.user!.organizationId,
          definitionId: definition.id,
          entityId: String(req.params.entityId)
        }
      });
      res.json({ value: null });
      return;
    }
    const value = await prisma.customFieldValue.upsert({
      where: {
        definitionId_entityId: {
          definitionId: definition.id,
          entityId: String(req.params.entityId)
        }
      },
      update: { value: normalizedValue as never },
      create: {
        organizationId: req.user!.organizationId,
        definitionId: definition.id,
        entityId: String(req.params.entityId),
        value: normalizedValue as never
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
