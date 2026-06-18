import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";

const router = Router();
const resourceSchema = z.enum(["CONTACTS", "COMPANIES", "LEADS", "DEALS", "TASKS", "PRODUCTS", "QUOTES", "INVOICES", "TICKETS"]);
const viewSchema = z.object({
  resource: resourceSchema,
  name: z.string().trim().min(1).max(80),
  filters: z.record(z.unknown()),
  isDefault: z.boolean().default(false)
});

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const parsed = resourceSchema.safeParse(String(req.query.resource || "").toUpperCase());
    const views = await prisma.savedView.findMany({
      where: {
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        ...(parsed.success ? { resource: parsed.data } : {})
      },
      orderBy: [{ resource: "asc" }, { name: "asc" }]
    });
    res.json({ views });
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(viewSchema, req.body);
    const view = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.savedView.updateMany({
          where: {
            organizationId: req.user!.organizationId,
            userId: req.user!.id,
            resource: input.resource
          },
          data: { isDefault: false }
        });
      }
      return tx.savedView.create({
        data: {
          organizationId: req.user!.organizationId,
          userId: req.user!.id,
          resource: input.resource,
          name: input.name,
          filters: input.filters as Prisma.InputJsonValue,
          isDefault: input.isDefault
        }
      });
    });
    res.status(201).json({ view });
  })
);

router.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(viewSchema.partial(), req.body);
    const current = await prisma.savedView.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: req.user!.organizationId,
        userId: req.user!.id
      }
    });
    if (!current) throw new HttpError("Saved view not found", 404);
    const resource = input.resource || current.resource;
    const view = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.savedView.updateMany({
          where: {
            organizationId: req.user!.organizationId,
            userId: req.user!.id,
            resource
          },
          data: { isDefault: false }
        });
      }
      return tx.savedView.update({
        where: { id: current.id },
        data: {
          ...input,
          filters: input.filters as Prisma.InputJsonValue | undefined
        }
      });
    });
    res.json({ view });
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const result = await prisma.savedView.deleteMany({
      where: {
        id: String(req.params.id),
        organizationId: req.user!.organizationId,
        userId: req.user!.id
      }
    });
    if (!result.count) throw new HttpError("Saved view not found", 404);
    res.status(204).end();
  })
);

export default router;
