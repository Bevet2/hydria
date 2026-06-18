import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError } from "../lib/http.js";
import { assertWorkspaceEntityInOrganization } from "../lib/tenantRelations.js";
import { assertCanWrite, requireAuth } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";

const router = Router();
const storageRoot = path.resolve(env.ATTACHMENT_DIR);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});
const entityTypeSchema = z.enum(["CONTACT", "COMPANY", "DEAL", "LEAD", "EMAIL", "TICKET"]);

function activityRelation(entityType: z.infer<typeof entityTypeSchema>, entityId: string) {
  if (entityType === "CONTACT") return { contactId: entityId };
  if (entityType === "COMPANY") return { companyId: entityId };
  if (entityType === "DEAL") return { dealId: entityId };
  if (entityType === "EMAIL" || entityType === "TICKET") return {};
  return { leadId: entityId };
}

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const entityType = entityTypeSchema.parse(String(req.query.entityType || "").toUpperCase());
    const entityId = z.string().uuid().parse(req.query.entityId);
    await assertWorkspaceEntityInOrganization(req.user!.organizationId, entityType, entityId);
    const attachments = await prisma.attachment.findMany({
      where: { organizationId: req.user!.organizationId, entityType, entityId },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } }
    });
    res.json({ attachments });
  })
);

router.post(
  "/",
  upload.single("file"),
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    if (!req.file) throw new HttpError("File is required", 400);
    const entityType = entityTypeSchema.parse(String(req.body.entityType || "").toUpperCase());
    const entityId = z.string().uuid().parse(req.body.entityId);
    await assertWorkspaceEntityInOrganization(req.user!.organizationId, entityType, entityId);
    await mkdir(storageRoot, { recursive: true });
    const storageKey = randomUUID();
    const filePath = path.join(storageRoot, storageKey);
    await writeFile(filePath, req.file.buffer, { flag: "wx" });
    try {
      const attachment = await prisma.attachment.create({
        data: {
          organizationId: req.user!.organizationId,
          uploadedById: req.user!.id,
          entityType,
          entityId,
          originalName: req.file.originalname.slice(0, 255),
          mimeType: req.file.mimetype || "application/octet-stream",
          size: req.file.size,
          storageKey
        },
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } }
      });
      await recordActivity({
        organizationId: req.user!.organizationId,
        actorId: req.user!.id,
        type: "RECORD_UPDATED",
        subject: `Attached ${attachment.originalName}`,
        metadata: { attachmentId: attachment.id },
        ...activityRelation(entityType, entityId)
      });
      res.status(201).json({ attachment });
    } catch (error) {
      await rm(filePath, { force: true });
      throw error;
    }
  })
);

router.get(
  "/:id/download",
  asyncRoute(async (req, res) => {
    const attachment = await prisma.attachment.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!attachment) throw new HttpError("Attachment not found", 404);
    const filePath = path.join(storageRoot, attachment.storageKey);
    try {
      await stat(filePath);
    } catch {
      throw new HttpError("Attachment file is missing", 410);
    }
    res.download(filePath, attachment.originalName);
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    assertCanWrite(req);
    const attachment = await prisma.attachment.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId }
    });
    if (!attachment) throw new HttpError("Attachment not found", 404);
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await rm(path.join(storageRoot, attachment.storageKey), { force: true });
    res.status(204).end();
  })
);

export default router;
