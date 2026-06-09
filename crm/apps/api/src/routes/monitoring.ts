import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncRoute } from "../lib/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { HttpError, parseBody } from "../lib/http.js";

const router = Router();
router.use(requireAuth, requireRole("ADMIN", "MANAGER"));

router.get("/summary", asyncRoute(async (req, res) => {
  const organizationId = req.user!.organizationId;
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const [errors, failedAutomations, failedWebhooks, failedEmails, activeSessions, deadLetterJobs] = await Promise.all([
    prisma.errorEvent.count({ where: { organizationId, createdAt: { gte: since } } }),
    prisma.automationRun.count({ where: { organizationId, status: "FAILED", createdAt: { gte: since } } }),
    prisma.webhookDelivery.count({ where: { organizationId, deliveredAt: null, createdAt: { gte: since } } }),
    prisma.emailMessage.count({ where: { organizationId, status: "FAILED", createdAt: { gte: since } } }),
    prisma.authSession.count({ where: { organizationId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.backgroundJob.count({ where: { organizationId, status: "DEAD_LETTER" } })
  ]);
  res.json({ since, errors, failedAutomations, failedWebhooks, failedEmails, activeSessions, deadLetterJobs });
}));

router.get("/errors", requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const errors = await prisma.errorEvent.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ errors });
}));

router.get("/jobs", requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const status = z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "DEAD_LETTER"]).optional().parse(req.query.status);
  const jobs = await prisma.backgroundJob.findMany({
    where: { organizationId: req.user!.organizationId, status },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  res.json({ jobs });
}));

router.post("/jobs/:id/retry", requireRole("ADMIN"), asyncRoute(async (req, res) => {
  parseBody(z.object({ confirmation: z.literal("RETRY") }), req.body);
  const job = await prisma.backgroundJob.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId }
  });
  if (!job) throw new HttpError("Background job not found", 404);
  const retried = await prisma.backgroundJob.update({
    where: { id: job.id },
    data: { status: "PENDING", attempts: 0, runAt: new Date(), lockedAt: null, lastError: null, completedAt: null }
  });
  res.json({ job: retried });
}));

export default router;
