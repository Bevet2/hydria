import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { encryptSecret, randomToken } from "../lib/security.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { enqueueBackgroundJob } from "../services/backgroundJobs.js";

const router = Router();
const schema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  events: z.array(z.string().min(1).max(120)).min(1).max(100),
  active: z.boolean().default(true)
});
router.use(requireAuth, requireRole("ADMIN"));

router.get("/", asyncRoute(async (req, res) => {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, url: true, events: true, active: true, createdAt: true, updatedAt: true }
  });
  res.json({ endpoints });
}));

router.post("/", asyncRoute(async (req, res) => {
  const input = parseBody(schema, req.body);
  const secret = randomToken(32);
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      ...input,
      organizationId: req.user!.organizationId,
      secret: encryptSecret(secret)
    },
    select: { id: true, name: true, url: true, events: true, active: true, createdAt: true }
  });
  res.status(201).json({ endpoint, secret });
}));

router.patch("/:id", asyncRoute(async (req, res) => {
  const input = parseBody(schema.partial(), req.body);
  const current = await prisma.webhookEndpoint.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId }
  });
  if (!current) throw new HttpError("Webhook not found", 404);
  const endpoint = await prisma.webhookEndpoint.update({ where: { id: current.id }, data: input });
  res.json({ endpoint: { ...endpoint, secret: undefined } });
}));

router.delete("/:id", asyncRoute(async (req, res) => {
  const result = await prisma.webhookEndpoint.deleteMany({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId }
  });
  if (!result.count) throw new HttpError("Webhook not found", 404);
  res.status(204).end();
}));

router.get("/:id/deliveries", asyncRoute(async (req, res) => {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId }
  });
  if (!endpoint) throw new HttpError("Webhook not found", 404);
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { endpointId: endpoint.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  res.json({ deliveries });
}));

router.post("/deliveries/:id/retry", asyncRoute(async (req, res) => {
  const delivery = await prisma.webhookDelivery.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId }
  });
  if (!delivery) throw new HttpError("Webhook delivery not found", 404);
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: { attempt: { increment: 1 }, nextAttemptAt: null }
  });
  const job = await enqueueBackgroundJob({
    organizationId: req.user!.organizationId,
    type: "WEBHOOK_DELIVERY",
    payload: { deliveryId: delivery.id }
  });
  res.status(202).json({ retried: true, job });
}));

export default router;
