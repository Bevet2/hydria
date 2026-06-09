import { env } from "../config/env.js";

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendTransactionalEmail(message: TransactionalEmail) {
  if (!env.TRANSACTIONAL_EMAIL_URL) {
    return { delivered: false, reason: "not_configured" as const };
  }
  const response = await fetch(env.TRANSACTIONAL_EMAIL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.TRANSACTIONAL_EMAIL_TOKEN
        ? { authorization: `Bearer ${env.TRANSACTIONAL_EMAIL_TOKEN}` }
        : {})
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html || message.text
    }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    throw new Error(`Transactional email delivery failed (${response.status})`);
  }
  return { delivered: true as const };
}

export async function deliverAuthLink(input: {
  to: string;
  subject: string;
  introduction: string;
  url: string;
}) {
  try {
    return await sendTransactionalEmail({
      to: input.to,
      subject: input.subject,
      text: `${input.introduction}\n\n${input.url}`,
      html: `<p>${input.introduction}</p><p><a href="${input.url}">${input.url}</a></p>`
    });
  } catch (error) {
    console.error("Transactional email delivery failed", error);
    return { delivered: false, reason: "delivery_failed" as const };
  }
}
