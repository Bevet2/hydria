import crypto from "node:crypto";
import type { OAuthConnection } from "@prisma/client";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { decryptSecret, encryptSecret } from "../lib/security.js";

export function createPkcePair() {
  const verifier = crypto.randomBytes(64).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function config(provider: "GOOGLE" | "MICROSOFT") {
  if (provider === "GOOGLE") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new HttpError("Google OAuth is not configured", 503);
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/calendar"]
    };
  }
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) throw new HttpError("Microsoft OAuth is not configured", 503);
  return {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "User.Read",
      "Mail.ReadWrite",
      "Mail.Send",
      "Calendars.ReadWrite"
    ]
  };
}

export function oauthAuthorizationUrl(
  provider: "GOOGLE" | "MICROSOFT",
  state: string,
  redirectUri: string,
  codeChallenge: string
) {
  const providerConfig = config(provider);
  const params = new URLSearchParams({
    client_id: providerConfig.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: providerConfig.scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });
  if (provider === "GOOGLE") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
    params.set("include_granted_scopes", "true");
  } else {
    params.set("response_mode", "query");
    params.set("prompt", "select_account");
  }
  return `${providerConfig.authorizeUrl}?${params}`;
}

export async function exchangeOAuthCode(
  provider: "GOOGLE" | "MICROSOFT",
  code: string,
  redirectUri: string,
  codeVerifier: string
) {
  const providerConfig = config(provider);
  const response = await fetch(providerConfig.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier
    })
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok || !data.access_token) throw new HttpError(`OAuth exchange failed: ${String(data.error_description || data.error || response.status)}`, 400);
  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : null,
    expiresAt: data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : null,
    scopes: String(data.scope || "").split(" ").filter(Boolean)
  };
}

export async function identifyConnection(provider: "GOOGLE" | "MICROSOFT", token: string) {
  const response = await fetch(
    provider === "GOOGLE" ? "https://www.googleapis.com/oauth2/v3/userinfo" : "https://graph.microsoft.com/v1.0/me",
    { headers: { authorization: `Bearer ${token}` } }
  );
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new HttpError("Unable to read connected account", 400);
  return provider === "GOOGLE"
    ? { id: String(data.sub || ""), email: String(data.email || "") }
    : { id: String(data.id || ""), email: String(data.mail || data.userPrincipalName || "") };
}

async function refresh(connection: OAuthConnection) {
  if (!connection.encryptedRefreshToken || !["GOOGLE", "MICROSOFT"].includes(connection.provider)) throw new HttpError("Integration token expired", 401);
  const provider = connection.provider as "GOOGLE" | "MICROSOFT";
  const providerConfig = config(provider);
  const response = await fetch(providerConfig.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      refresh_token: decryptSecret(connection.encryptedRefreshToken),
      grant_type: "refresh_token",
      ...(provider === "MICROSOFT" ? { scope: providerConfig.scopes.join(" ") } : {})
    })
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok || !data.access_token) {
    await prisma.oAuthConnection.update({ where: { id: connection.id }, data: { status: "EXPIRED" } });
    throw new HttpError("Integration token refresh failed", 401);
  }
  return prisma.oAuthConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptSecret(String(data.access_token)),
      encryptedRefreshToken: data.refresh_token ? encryptSecret(String(data.refresh_token)) : connection.encryptedRefreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : null,
      status: "ACTIVE"
    }
  });
}

export async function accessTokenFor(connection: OAuthConnection) {
  const active = connection.expiresAt && connection.expiresAt.getTime() < Date.now() + 60_000 ? await refresh(connection) : connection;
  if (!active.encryptedAccessToken) throw new HttpError("Integration token is missing", 401);
  return decryptSecret(active.encryptedAccessToken);
}

export async function sendProviderEmail(connection: OAuthConnection, message: {
  to: string;
  cc?: string | null;
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; mimeType: string; contentBase64: string }>;
}) {
  const token = await accessTokenFor(connection);
  if (connection.provider === "GOOGLE") {
    const boundary = `northstar-${Date.now()}`;
    const sanitizedSubject = message.subject.replaceAll(/[\r\n]/g, " ");
    const header = [`To: ${message.to}`, ...(message.cc ? [`Cc: ${message.cc}`] : []), `Subject: ${sanitizedSubject}`, "MIME-Version: 1.0"];
    const raw = message.attachments?.length
      ? [
          ...header,
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          "",
          `--${boundary}`,
          "Content-Type: text/html; charset=UTF-8",
          "",
          message.body,
          ...message.attachments.flatMap((attachment) => [
            `--${boundary}`,
            `Content-Type: ${attachment.mimeType}; name="${attachment.filename.replaceAll('"', "")}"`,
            "Content-Transfer-Encoding: base64",
            `Content-Disposition: attachment; filename="${attachment.filename.replaceAll('"', "")}"`,
            "",
            attachment.contentBase64
          ]),
          `--${boundary}--`
        ].join("\r\n")
      : [...header, "Content-Type: text/html; charset=UTF-8", "", message.body].join("\r\n");
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") })
    });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new HttpError("Gmail send failed", 502);
    return {
      id: String(data.id || ""),
      metadata: { threadId: String(data.threadId || ""), direction: "OUTBOUND" }
    };
  }
  const draftResponse = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      Prefer: 'IdType="ImmutableId"'
    },
    body: JSON.stringify({
      subject: message.subject,
      body: { contentType: "HTML", content: message.body },
      toRecipients: message.to.split(",").map((address) => ({ emailAddress: { address: address.trim() } })),
      ccRecipients: message.cc ? message.cc.split(",").map((address) => ({ emailAddress: { address: address.trim() } })) : []
      ,
      attachments: (message.attachments || []).map((attachment) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: attachment.filename,
        contentType: attachment.mimeType,
        contentBytes: attachment.contentBase64
      }))
    })
  });
  const draft = await draftResponse.json() as Record<string, unknown>;
  if (!draftResponse.ok || !draft.id) throw new HttpError(`Microsoft email draft failed (${draftResponse.status})`, 502);
  const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(String(draft.id))}/send`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, Prefer: 'IdType="ImmutableId"' }
  });
  if (!sendResponse.ok) throw new HttpError(`Microsoft email send failed (${sendResponse.status})`, 502);
  return {
    id: String(draft.id),
    metadata: { conversationId: String(draft.conversationId || ""), direction: "OUTBOUND" }
  };
}

export async function createProviderEvent(connection: OAuthConnection, event: { title: string; description?: string | null; location?: string | null; startsAt: Date; endsAt: Date; attendeeEmails: string[] }) {
  const token = await accessTokenFor(connection);
  const google = connection.provider === "GOOGLE";
  const response = await fetch(google ? "https://www.googleapis.com/calendar/v3/calendars/primary/events" : "https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(google ? {
      summary: event.title, description: event.description, location: event.location,
      start: { dateTime: event.startsAt.toISOString() }, end: { dateTime: event.endsAt.toISOString() },
      attendees: event.attendeeEmails.map((email) => ({ email }))
    } : {
      subject: event.title, body: { contentType: "HTML", content: event.description || "" },
      location: { displayName: event.location || "" },
      start: { dateTime: event.startsAt.toISOString(), timeZone: "UTC" },
      end: { dateTime: event.endsAt.toISOString(), timeZone: "UTC" },
      attendees: event.attendeeEmails.map((address) => ({ emailAddress: { address }, type: "required" }))
    })
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new HttpError(`${google ? "Google" : "Microsoft"} Calendar event creation failed`, 502);
  return String(data.id || "");
}

export async function cancelProviderEvent(connection: OAuthConnection, externalEventId: string) {
  const token = await accessTokenFor(connection);
  const endpoint = connection.provider === "GOOGLE"
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(externalEventId)}`
    : `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`;
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new HttpError(`${connection.provider === "GOOGLE" ? "Google" : "Microsoft"} Calendar cancellation failed`, 502);
  }
}

async function providerJson(url: string, token: string, label: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, ...headers } });
  const data = await response.json().catch(() => ({})) as any;
  if (!response.ok) {
    throw new HttpError(`${label} synchronization failed: ${String(data.error?.message || data.error_description || response.status)}`, 502);
  }
  return data;
}

function metadataValue(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String((value as Record<string, unknown>)[key] || "");
}

async function markReply(
  organizationId: string,
  provider: "GOOGLE" | "MICROSOFT",
  conversationKey: string,
  conversationId: string
) {
  if (!conversationId) return;
  const sent = await prisma.emailMessage.findMany({
    where: { organizationId, provider, status: "SENT", replyReceivedAt: null },
    orderBy: { sentAt: "desc" }
  });
  const original = sent.find((message) => metadataValue(message.metadata, conversationKey) === conversationId);
  if (original) {
    await prisma.emailMessage.update({ where: { id: original.id }, data: { replyReceivedAt: new Date() } });
  }
}

export async function syncProviderData(connection: OAuthConnection) {
  const token = await accessTokenFor(connection);
  let messages = 0;
  let events = 0;
  if (connection.provider === "GOOGLE") {
    const list = await providerJson(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=newer_than:30d",
      token,
      "Gmail"
    );
    for (const item of list.messages || []) {
      if (await prisma.emailMessage.findFirst({ where: { organizationId: connection.organizationId, externalMessageId: item.id } })) continue;
      const message = await providerJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata`,
        token,
        "Gmail message"
      );
      const headers = Object.fromEntries((message.payload?.headers || []).map((header: any) => [String(header.name).toLowerCase(), String(header.value)]));
      const from = String(headers.from || "");
      const inbound = !connection.externalEmail || !from.toLowerCase().includes(connection.externalEmail.toLowerCase());
      if (inbound) await markReply(connection.organizationId, "GOOGLE", "threadId", String(message.threadId || ""));
      await prisma.emailMessage.create({ data: {
        organizationId: connection.organizationId, senderId: connection.userId, provider: "GOOGLE",
        externalMessageId: item.id, to: String(headers.to || connection.externalEmail || ""),
        subject: String(headers.subject || "(no subject)"), body: message.snippet || "", status: "SENT",
        sentAt: headers.date ? new Date(String(headers.date)) : new Date(),
        direction: inbound ? "INBOUND" : "OUTBOUND",
        conversationId: String(message.threadId || "") || null,
        metadata: { direction: inbound ? "INBOUND" : "OUTBOUND", from, threadId: String(message.threadId || "") }
      } });
      messages += 1;
    }
    const calendar = await providerJson(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&timeMin=${encodeURIComponent(new Date(Date.now() - 30 * 86_400_000).toISOString())}&maxResults=100`,
      token,
      "Google Calendar"
    );
    for (const item of calendar.items || []) {
      if (!item.id || !item.start?.dateTime || !item.end?.dateTime || await prisma.calendarEvent.findFirst({ where: { organizationId: connection.organizationId, externalEventId: item.id } })) continue;
      await prisma.calendarEvent.create({ data: {
        organizationId: connection.organizationId, ownerId: connection.userId, provider: "GOOGLE",
        externalEventId: item.id, title: item.summary || "(untitled)", description: item.description || null,
        location: item.location || null, attendeeEmails: (item.attendees || []).map((attendee: any) => attendee.email).filter(Boolean),
        startsAt: new Date(item.start.dateTime), endsAt: new Date(item.end.dateTime)
      } });
      events += 1;
    }
  } else if (connection.provider === "MICROSOFT") {
    const inbox = await providerJson(
      "https://graph.microsoft.com/v1.0/me/messages?$top=20&$select=id,subject,bodyPreview,toRecipients,from,sentDateTime,conversationId,isDraft",
      token,
      "Microsoft Mail",
      { Prefer: 'IdType="ImmutableId"' }
    );
    for (const item of inbox.value || []) {
      if (await prisma.emailMessage.findFirst({ where: { organizationId: connection.organizationId, externalMessageId: item.id } })) continue;
      const from = String(item.from?.emailAddress?.address || "");
      const inbound = !connection.externalEmail || from.toLowerCase() !== connection.externalEmail.toLowerCase();
      if (inbound) await markReply(connection.organizationId, "MICROSOFT", "conversationId", String(item.conversationId || ""));
      await prisma.emailMessage.create({ data: {
        organizationId: connection.organizationId, senderId: connection.userId, provider: "MICROSOFT",
        externalMessageId: item.id, to: (item.toRecipients || []).map((recipient: any) => recipient.emailAddress?.address).filter(Boolean).join(","),
        subject: item.subject || "(no subject)", body: item.bodyPreview || "", status: "SENT",
        sentAt: item.sentDateTime ? new Date(item.sentDateTime) : new Date(),
        direction: inbound ? "INBOUND" : "OUTBOUND",
        conversationId: String(item.conversationId || "") || null,
        metadata: { direction: inbound ? "INBOUND" : "OUTBOUND", from, conversationId: String(item.conversationId || "") }
      } });
      messages += 1;
    }
    const calendar = await providerJson(
      "https://graph.microsoft.com/v1.0/me/events?$top=100&$select=id,subject,bodyPreview,location,start,end,attendees",
      token,
      "Microsoft Calendar"
    );
    for (const item of calendar.value || []) {
      if (!item.id || !item.start?.dateTime || !item.end?.dateTime || await prisma.calendarEvent.findFirst({ where: { organizationId: connection.organizationId, externalEventId: item.id } })) continue;
      await prisma.calendarEvent.create({ data: {
        organizationId: connection.organizationId, ownerId: connection.userId, provider: "MICROSOFT",
        externalEventId: item.id, title: item.subject || "(untitled)", description: item.bodyPreview || null,
        location: item.location?.displayName || null, attendeeEmails: (item.attendees || []).map((attendee: any) => attendee.emailAddress?.address).filter(Boolean),
        startsAt: new Date(`${item.start.dateTime}Z`), endsAt: new Date(`${item.end.dateTime}Z`)
      } });
      events += 1;
    }
  }
  await prisma.oAuthConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date(), status: "ACTIVE" } });
  return { messages, events };
}

export function publicConnection(connection: OAuthConnection) {
  return {
    id: connection.id, provider: connection.provider, status: connection.status,
    externalEmail: connection.externalEmail, scopes: connection.scopes, expiresAt: connection.expiresAt,
    lastSyncAt: connection.lastSyncAt, createdAt: connection.createdAt, metadata: connection.metadata
  };
}
