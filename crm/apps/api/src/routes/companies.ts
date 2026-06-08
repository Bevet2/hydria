import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody, parsePagination } from "../lib/http.js";
import { assertUserInOrganization } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";

const router = Router();

const companySchema = z.object({
  name: z.string().min(1).max(160),
  domain: z.string().max(160).optional(),
  industry: z.string().max(100).optional(),
  size: z.coerce.number().int().nonnegative().optional().nullable(),
  phone: z.string().max(40).optional(),
  website: z.string().url().optional().or(z.literal("")),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  ownerId: z.string().uuid().optional().nullable()
});

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = String(req.query.search || "").trim();
    const where = {
      organizationId: req.user!.organizationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { domain: { contains: search, mode: "insensitive" as const } },
              { industry: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const [companies, total] = await prisma.$transaction([
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { contacts: true, deals: true, tasks: true } }
        }
      }),
      prisma.company.count({ where })
    ]);
    res.json({ companies, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  })
);

router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const company = await prisma.company.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        contacts: { orderBy: { updatedAt: "desc" } },
        deals: { include: { stage: true, owner: true }, orderBy: { updatedAt: "desc" } },
        tasks: { orderBy: { createdAt: "desc" } },
        notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
        activities: { orderBy: { occurredAt: "desc" }, take: 30 }
      }
    });
    if (!company) {
      throw new HttpError("Company not found", 404);
    }
    res.json({ company });
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(companySchema, req.body);
    await assertUserInOrganization(req.user!.organizationId, input.ownerId);
    const company = await prisma.company.create({
      data: {
        ...input,
        website: input.website || null,
        organizationId: req.user!.organizationId,
        ownerId: input.ownerId || req.user!.id
      }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      companyId: company.id,
      type: "RECORD_CREATED",
      subject: `Created company ${company.name}`
    });
    res.status(201).json({ company });
  })
);

router.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(companySchema.partial(), req.body);
    const current = await prisma.company.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) {
      throw new HttpError("Company not found", 404);
    }
    await assertUserInOrganization(req.user!.organizationId, input.ownerId);
    const company = await prisma.company.update({
      where: { id: current.id },
      data: { ...input, website: input.website === "" ? null : input.website }
    });
    res.json({ company });
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const current = await prisma.company.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) {
      throw new HttpError("Company not found", 404);
    }
    await prisma.company.delete({ where: { id: current.id } });
    res.status(204).end();
  })
);

export default router;
