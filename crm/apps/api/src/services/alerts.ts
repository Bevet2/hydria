import { env } from "../config/env.js";

export async function sendOperationalAlert(input: {
  title: string;
  message: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!env.ALERT_WEBHOOK_URL) return { delivered: false, reason: "not_configured" as const };
  const response = await fetch(env.ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      severity: "error",
      occurredAt: new Date().toISOString(),
      ...input
    }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Alert webhook failed (${response.status})`);
  return { delivered: true as const };
}
