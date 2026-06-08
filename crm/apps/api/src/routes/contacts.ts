import { Router } from "express";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody, parsePagination } from "../lib/http.js";
import { assertCrmRelations } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const contactSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  jobTitle: z.string().max(120).optional(),
  status: z.string().max(40).default("lead"),
  source: z.string().max(80).optional(),
  companyId: z.string().uuid().optional().nullable(),
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
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { company: { name: { contains: search, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };
    const [contacts, total] = await prisma.$transaction([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updatedAt: "desc" }],
        include: {
          company: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { notes: true, tasks: true, activities: true } }
        }
      }),
      prisma.contact.count({ where })
    ]);
    res.json({ contacts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  })
);

router.get(
  "/export.csv",
  asyncRoute(async (req, res) => {
    const contacts = await prisma.contact.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { company: { select: { name: true } } }
    });
    const csv = stringifyCsv(
      contacts.map((contact) => ({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email || "",
        phone: contact.phone || "",
        jobTitle: contact.jobTitle || "",
        status: contact.status,
        source: contact.source || "",
        company: contact.company?.name || ""
      })),
      { header: true }
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="northstar-contacts.csv"');
    res.send(csv);
  })
);

router.post(
  "/import",
  upload.single("file"),
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    if (!req.file) {
      throw new HttpError("CSV file is required", 400);
    }
    const rows = parseCsv(req.file.buffer.toString("utf8"), {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Array<Record<string, string>>;
    if (rows.length > 2000) {
      throw new HttpError("CSV import is limited to 2000 rows", 400);
    }

    const companyNames = [
      ...new Set(
        rows
          .map((row) => row.company?.trim())
          .filter((name): name is string => Boolean(name))
      )
    ];
    const existingCompanies = await prisma.company.findMany({
      where: {
        organizationId: req.user!.organizationId,
        name: { in: companyNames }
      }
    });
    const companyMap = new Map(existingCompanies.map((company) => [company.name.toLowerCase(), company.id]));

    for (const name of companyNames) {
      if (!companyMap.has(name.toLowerCase())) {
        const company = await prisma.company.create({
          data: { organizationId: req.user!.organizationId, name }
        });
        companyMap.set(name.toLowerCase(), company.id);
      }
    }

    let imported = 0;
    const skipped: number[] = [];
    for (const [index, row] of rows.entries()) {
      const firstName = row.firstName || row.first_name || row.firstname || "";
      const lastName = row.lastName || row.last_name || row.lastname || "";
      if (!firstName.trim() || !lastName.trim()) {
        skipped.push(index + 2);
        continue;
      }
      await prisma.contact.create({
        data: {
          organizationId: req.user!.organizationId,
          ownerId: req.user!.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          jobTitle: (row.jobTitle || row.job_title || "").trim() || null,
          status: row.status?.trim() || "lead",
          source: row.source?.trim() || "csv",
          companyId: row.company ? companyMap.get(row.company.toLowerCase()) : null
        }
      });
      imported += 1;
    }

    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      type: "RECORD_CREATED",
      subject: `Imported ${imported} contacts from CSV`,
      metadata: { skipped }
    });
    res.status(201).json({ imported, skipped });
  })
);

router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const contact = await prisma.contact.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      include: {
        company: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
        primaryDeals: { include: { stage: true, company: true } },
        tasks: { orderBy: { createdAt: "desc" } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { firstName: true, lastName: true } } }
        },
        activities: { orderBy: { occurredAt: "desc" }, take: 30 }
      }
    });
    if (!contact) {
      throw new HttpError("Contact not found", 404);
    }
    const customValues = await prisma.customFieldValue.findMany({
      where: {
        organizationId: req.user!.organizationId,
        entityId: contact.id,
        definition: { entityType: "CONTACT" }
      },
      include: { definition: true }
    });
    res.json({ contact, customValues });
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(contactSchema, req.body);
    await assertCrmRelations(req.user!.organizationId, {
      ownerId: input.ownerId,
      companyId: input.companyId
    });
    const contact = await prisma.contact.create({
      data: {
        ...input,
        email: input.email || null,
        organizationId: req.user!.organizationId,
        ownerId: input.ownerId || req.user!.id
      },
      include: { company: true }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      contactId: contact.id,
      type: "RECORD_CREATED",
      subject: `Created contact ${contact.firstName} ${contact.lastName}`
    });
    res.status(201).json({ contact });
  })
);

router.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(contactSchema.partial(), req.body);
    const current = await prisma.contact.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) {
      throw new HttpError("Contact not found", 404);
    }
    await assertCrmRelations(req.user!.organizationId, {
      ownerId: input.ownerId,
      companyId: input.companyId
    });
    const contact = await prisma.contact.update({
      where: { id: current.id },
      data: { ...input, email: input.email === "" ? null : input.email },
      include: { company: true }
    });
    await recordActivity({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      contactId: contact.id,
      type: "RECORD_UPDATED",
      subject: `Updated contact ${contact.firstName} ${contact.lastName}`
    });
    res.json({ contact });
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const current = await prisma.contact.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!current) {
      throw new HttpError("Contact not found", 404);
    }
    await prisma.contact.delete({ where: { id: current.id } });
    res.status(204).end();
  })
);

export default router;
