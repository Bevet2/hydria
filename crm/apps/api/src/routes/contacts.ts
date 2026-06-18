import { Router } from "express";
import { rm } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody, parsePagination } from "../lib/http.js";
import { assertCrmRelations } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const attachmentRoot = path.resolve(env.ATTACHMENT_DIR);

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
    const status = String(req.query.status || "").trim();
    const companyId = String(req.query.companyId || "").trim();
    const where = {
      organizationId: req.user!.organizationId,
      ...(status ? { status } : {}),
      ...(z.string().uuid().safeParse(companyId).success ? { companyId } : {}),
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
  "/duplicates",
  asyncRoute(async (req, res) => {
    const contacts = await prisma.contact.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: [{ updatedAt: "desc" }],
      include: { company: { select: { id: true, name: true } } }
    });
    const parent = new Map(contacts.map((contact) => [contact.id, contact.id]));
    const find = (id: string): string => {
      const current = parent.get(id)!;
      if (current === id) return id;
      const root = find(current);
      parent.set(id, root);
      return root;
    };
    const union = (left: string, right: string) => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
    };
    const keys = new Map<string, string>();
    for (const contact of contacts) {
      const contactKeys = [
        contact.email ? `email:${contact.email.trim().toLowerCase()}` : "",
        `name:${contact.firstName.trim().toLowerCase()}:${contact.lastName.trim().toLowerCase()}:${contact.companyId || ""}`
      ].filter(Boolean);
      for (const key of contactKeys) {
        const existing = keys.get(key);
        if (existing) union(existing, contact.id);
        else keys.set(key, contact.id);
      }
    }
    const groups = new Map<string, typeof contacts>();
    for (const contact of contacts) {
      const root = find(contact.id);
      groups.set(root, [...(groups.get(root) || []), contact]);
    }
    res.json({
      groups: [...groups.values()]
        .filter((group) => group.length > 1)
        .map((group) => ({ contacts: group }))
    });
  })
);

router.post(
  "/bulk",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(
      z.object({
        ids: z.array(z.string().uuid()).min(1).max(100),
        action: z.enum(["UPDATE_STATUS", "ASSIGN_OWNER", "DELETE"]),
        status: z.string().trim().min(1).max(40).optional(),
        ownerId: z.string().uuid().nullable().optional()
      }),
      req.body
    );
    const organizationId = req.user!.organizationId;
    const contacts = await prisma.contact.findMany({
      where: { id: { in: input.ids }, organizationId },
      select: { id: true }
    });
    if (contacts.length !== new Set(input.ids).size) throw new HttpError("One or more contacts were not found", 404);
    if (input.action === "UPDATE_STATUS" && !input.status) throw new HttpError("Status is required", 400);
    if (input.action === "ASSIGN_OWNER") {
      await assertCrmRelations(organizationId, { ownerId: input.ownerId });
    }

    let storageKeys: string[] = [];
    if (input.action === "DELETE") {
      const attachments = await prisma.attachment.findMany({
        where: { organizationId, entityType: "CONTACT", entityId: { in: input.ids } },
        select: { storageKey: true }
      });
      storageKeys = attachments.map((attachment) => attachment.storageKey);
      await prisma.$transaction([
        prisma.attachment.deleteMany({
          where: { organizationId, entityType: "CONTACT", entityId: { in: input.ids } }
        }),
        prisma.customFieldValue.deleteMany({
          where: {
            organizationId,
            entityId: { in: input.ids },
            definition: { entityType: "CONTACT" }
          }
        }),
        prisma.contact.deleteMany({ where: { organizationId, id: { in: input.ids } } })
      ]);
      await Promise.all(storageKeys.map((storageKey) => rm(path.join(attachmentRoot, storageKey), { force: true })));
    } else {
      await prisma.contact.updateMany({
        where: { organizationId, id: { in: input.ids } },
        data: input.action === "UPDATE_STATUS"
          ? { status: input.status }
          : { ownerId: input.ownerId || null }
      });
    }
    await recordActivity({
      organizationId,
      actorId: req.user!.id,
      type: "RECORD_UPDATED",
      subject: `${input.action.toLowerCase().replaceAll("_", " ")} on ${contacts.length} contacts`,
      metadata: { contactIds: input.ids }
    });
    res.json({ updated: contacts.length });
  })
);

router.post(
  "/merge",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const input = parseBody(
      z.object({
        primaryId: z.string().uuid(),
        duplicateIds: z.array(z.string().uuid()).min(1).max(20)
      }).refine((value) => !value.duplicateIds.includes(value.primaryId), {
        message: "Primary contact cannot also be a duplicate"
      }),
      req.body
    );
    const organizationId = req.user!.organizationId;
    const ids = [input.primaryId, ...new Set(input.duplicateIds)];
    const contacts = await prisma.contact.findMany({ where: { organizationId, id: { in: ids } } });
    if (contacts.length !== ids.length) throw new HttpError("One or more contacts were not found", 404);
    const primary = contacts.find((contact) => contact.id === input.primaryId)!;
    const duplicates = contacts.filter((contact) => contact.id !== input.primaryId);

    const contact = await prisma.$transaction(async (tx) => {
      const duplicateIds = duplicates.map((item) => item.id);
      await Promise.all([
        tx.deal.updateMany({ where: { organizationId, primaryContactId: { in: duplicateIds } }, data: { primaryContactId: primary.id } }),
        tx.quote.updateMany({ where: { organizationId, contactId: { in: duplicateIds } }, data: { contactId: primary.id } }),
        tx.task.updateMany({ where: { organizationId, contactId: { in: duplicateIds } }, data: { contactId: primary.id } }),
        tx.note.updateMany({ where: { organizationId, contactId: { in: duplicateIds } }, data: { contactId: primary.id } }),
        tx.activity.updateMany({ where: { organizationId, contactId: { in: duplicateIds } }, data: { contactId: primary.id } }),
        tx.lead.updateMany({ where: { organizationId, convertedContactId: { in: duplicateIds } }, data: { convertedContactId: primary.id } }),
        tx.attachment.updateMany({
          where: { organizationId, entityType: "CONTACT", entityId: { in: duplicateIds } },
          data: { entityId: primary.id }
        })
      ]);

      const primaryValues = await tx.customFieldValue.findMany({
        where: { organizationId, entityId: primary.id, definition: { entityType: "CONTACT" } },
        select: { definitionId: true }
      });
      const occupiedDefinitions = new Set(primaryValues.map((value) => value.definitionId));
      const duplicateValues = await tx.customFieldValue.findMany({
        where: { organizationId, entityId: { in: duplicateIds }, definition: { entityType: "CONTACT" } }
      });
      for (const value of duplicateValues) {
        if (occupiedDefinitions.has(value.definitionId)) {
          await tx.customFieldValue.delete({ where: { id: value.id } });
        } else {
          await tx.customFieldValue.update({ where: { id: value.id }, data: { entityId: primary.id } });
          occupiedDefinitions.add(value.definitionId);
        }
      }

      const fallback = duplicates[0]!;
      const updated = await tx.contact.update({
        where: { id: primary.id },
        data: {
          email: primary.email || fallback.email,
          phone: primary.phone || fallback.phone,
          jobTitle: primary.jobTitle || fallback.jobTitle,
          source: primary.source || fallback.source,
          companyId: primary.companyId || fallback.companyId,
          ownerId: primary.ownerId || fallback.ownerId
        },
        include: { company: true }
      });
      await tx.contact.deleteMany({ where: { organizationId, id: { in: duplicateIds } } });
      return updated;
    });

    await recordActivity({
      organizationId,
      actorId: req.user!.id,
      contactId: contact.id,
      type: "RECORD_UPDATED",
      subject: `Merged ${duplicates.length} duplicate contact${duplicates.length > 1 ? "s" : ""}`,
      metadata: { duplicateIds: duplicates.map((item) => item.id) }
    });
    res.json({ contact, merged: duplicates.length });
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
    res.setHeader("Content-Disposition", 'attachment; filename="hydria-crm-contacts.csv"');
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
    const attachments = await prisma.attachment.findMany({
      where: { organizationId: req.user!.organizationId, entityType: "CONTACT", entityId: current.id },
      select: { storageKey: true }
    });
    await prisma.$transaction([
      prisma.attachment.deleteMany({
        where: { organizationId: req.user!.organizationId, entityType: "CONTACT", entityId: current.id }
      }),
      prisma.customFieldValue.deleteMany({
        where: {
          organizationId: req.user!.organizationId,
          entityId: current.id,
          definition: { entityType: "CONTACT" }
        }
      }),
      prisma.contact.delete({ where: { id: current.id } })
    ]);
    await Promise.all(
      attachments.map((attachment) => rm(path.join(attachmentRoot, attachment.storageKey), { force: true }))
    );
    res.status(204).end();
  })
);

export default router;
