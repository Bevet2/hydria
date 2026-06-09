import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { decryptSecret } from "../lib/security.js";
import { prisma } from "../lib/prisma.js";

export async function emitWebhook(
  organizationId: string,
  event: string,
  data: Record<string, unknown>
) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId, active: true }
  });
  const payload = { id: crypto.randomUUID(), event, createdAt: new Date().toISOString(), data };
  for (const endpoint of endpoints) {
    const events = Array.isArray(endpoint.events) ? endpoint.events.map(String) : [];
    if (!events.includes("*") && !events.includes(event)) continue;
    const delivery = await prisma.webhookDelivery.create({
      data: {
        organizationId,
        endpointId: endpoint.id,
        event,
        payload: payload as Prisma.InputJsonValue
      }
    });
    await prisma.backgroundJob.create({
      data: {
        organizationId,
        type: "WEBHOOK_DELIVERY",
        payload: { deliveryId: delivery.id }
      }
    });
  }
}

export async function deliverWebhook(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true }
  });
  if (!delivery) return;
  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secret = decryptSecret(delivery.endpoint.secret);
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  try {
    const response = await fetch(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-northstar-event": delivery.event,
        "x-northstar-timestamp": timestamp,
        "x-northstar-signature": signature
      },
      body,
      signal: AbortSignal.timeout(10_000)
    });
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        statusCode: response.status,
        responseBody: (await response.text()).slice(0, 2000),
        deliveredAt: response.ok ? new Date() : null,
        nextAttemptAt: response.ok ? null : new Date(Date.now() + 5 * 60_000)
      }
    });
  } catch (error) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        responseBody: error instanceof Error ? error.message : "Delivery failed",
        nextAttemptAt: new Date(Date.now() + 5 * 60_000)
      }
    });
  }
}
