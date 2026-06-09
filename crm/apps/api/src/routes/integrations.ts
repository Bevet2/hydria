import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { decryptSecret, encryptSecret, hashToken, randomToken } from "../lib/security.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createPkcePair,
  exchangeOAuthCode,
  identifyConnection,
  oauthAuthorizationUrl,
  publicConnection
} from "../services/integrations.js";
import { enqueueBackgroundJob } from "../services/backgroundJobs.js";

const router = Router();
const oauthProvider = z.enum(["GOOGLE", "MICROSOFT"]);

function oauthRedirectUri() {
  return env.OAUTH_REDIRECT_URL || `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/oauth/callback`;
}

router.post("/oauth/callback", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    code: z.string().min(1),
    state: z.string().min(20)
  }), req.body);
  const attempt = await prisma.oAuthAttempt.findFirst({
    where: {
      stateHash: hashToken(input.state),
      consumedAt: null,
      expiresAt: { gt: new Date() }
    }
  });
  if (!attempt || !["GOOGLE", "MICROSOFT"].includes(attempt.provider)) {
    throw new HttpError("Invalid or expired OAuth state", 400);
  }
  const provider = attempt.provider as "GOOGLE" | "MICROSOFT";
  const tokens = await exchangeOAuthCode(
    provider,
    input.code,
    attempt.redirectUri,
    decryptSecret(attempt.encryptedCodeVerifier)
  );
  const identity = await identifyConnection(provider, tokens.accessToken);
  const connection = await prisma.$transaction(async (tx) => {
    const stored = await tx.oAuthConnection.upsert({
      where: {
        organizationId_userId_provider: {
          organizationId: attempt.organizationId,
          userId: attempt.userId,
          provider
        }
      },
      create: {
        organizationId: attempt.organizationId,
        userId: attempt.userId,
        provider,
        externalAccountId: identity.id,
        externalEmail: identity.email,
        encryptedAccessToken: encryptSecret(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        scopes: tokens.scopes,
        expiresAt: tokens.expiresAt
      },
      update: {
        status: "ACTIVE",
        externalAccountId: identity.id,
        externalEmail: identity.email,
        encryptedAccessToken: encryptSecret(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
        scopes: tokens.scopes,
        expiresAt: tokens.expiresAt
      }
    });
    await tx.oAuthAttempt.update({ where: { id: attempt.id }, data: { consumedAt: new Date() } });
    return stored;
  });
  res.json({ connection: publicConnection(connection), state: input.state });
}));

router.use(requireAuth);

router.get("/oauth/config", asyncRoute(async (_req, res) => {
  res.json({
    redirectUri: oauthRedirectUri(),
    providers: {
      GOOGLE: { configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) },
      MICROSOFT: { configured: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) }
    }
  });
}));

router.get("/readiness", asyncRoute(async (req, res) => {
  const backup = await prisma.backupSchedule.findUnique({
    where: { organizationId: req.user!.organizationId },
    select: { enabled: true, target: true, lastStatus: true, lastRunAt: true }
  });
  res.json({
    services: {
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      microsoft: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
      stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
      transactionalEmail: Boolean(env.TRANSACTIONAL_EMAIL_URL),
      externalAlerts: Boolean(env.ALERT_WEBHOOK_URL),
      remoteBackup: Boolean(backup?.enabled && backup.target === "HTTPS")
    },
    backup
  });
}));

router.get("/", asyncRoute(async (req, res) => {
  const connections = await prisma.oAuthConnection.findMany({
    where: { organizationId: req.user!.organizationId, userId: req.user!.id },
    orderBy: { createdAt: "desc" }
  });
  res.json({ connections: connections.map(publicConnection) });
}));

router.post("/oauth/:provider/start", asyncRoute(async (req, res) => {
  const provider = oauthProvider.parse(String(req.params.provider).toUpperCase());
  const redirectUri = oauthRedirectUri();
  const state = randomToken(32);
  const pkce = createPkcePair();
  await prisma.$transaction([
    prisma.oAuthAttempt.deleteMany({
      where: { userId: req.user!.id, OR: [{ expiresAt: { lte: new Date() } }, { consumedAt: { not: null } }] }
    }),
    prisma.oAuthAttempt.create({
      data: {
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        provider,
        stateHash: hashToken(state),
        encryptedCodeVerifier: encryptSecret(pkce.verifier),
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60_000)
      }
    })
  ]);
  res.json({
    authorizationUrl: oauthAuthorizationUrl(provider, state, redirectUri, pkce.challenge),
    state,
    redirectUri
  });
}));

router.post("/oauth/exchange", asyncRoute(async (_req, _res) => {
  throw new HttpError("Use the public OAuth callback endpoint", 410);
}));

router.post("/custom", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    provider: z.enum(["ACCOUNTING", "SUPPORT", "MARKETING", "PAYMENT", "CUSTOM"]),
    accessToken: z.string().min(1).optional(),
    externalAccountId: z.string().max(200).optional(),
    externalEmail: z.string().email().optional(),
    metadata: z.record(z.unknown()).default({})
  }), req.body);
  const connection = await prisma.oAuthConnection.upsert({
    where: {
      organizationId_userId_provider: {
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        provider: input.provider
      }
    },
    create: {
      organizationId: req.user!.organizationId,
      userId: req.user!.id,
      provider: input.provider,
      encryptedAccessToken: input.accessToken ? encryptSecret(input.accessToken) : null,
      externalAccountId: input.externalAccountId,
      externalEmail: input.externalEmail,
      metadata: input.metadata as Prisma.InputJsonValue
    },
    update: {
      status: "ACTIVE",
      encryptedAccessToken: input.accessToken ? encryptSecret(input.accessToken) : undefined,
      externalAccountId: input.externalAccountId,
      externalEmail: input.externalEmail,
      metadata: input.metadata as Prisma.InputJsonValue
    }
  });
  res.json({ connection: publicConnection(connection) });
}));

router.post("/:id/sync", asyncRoute(async (req, res) => {
  const connection = await prisma.oAuthConnection.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId, userId: req.user!.id }
  });
  if (!connection) throw new HttpError("Integration not found", 404);
  if (!["GOOGLE", "MICROSOFT"].includes(connection.provider)) {
    await prisma.oAuthConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date() } });
    res.json({ synced: true, messages: 0, events: 0 });
    return;
  }
  const job = await enqueueBackgroundJob({
    organizationId: req.user!.organizationId,
    type: "INTEGRATION_SYNC",
    payload: { connectionId: connection.id }
  });
  res.status(202).json({ synced: false, queued: true, job });
}));

router.delete("/:id", asyncRoute(async (req, res) => {
  const result = await prisma.oAuthConnection.deleteMany({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId, userId: req.user!.id }
  });
  if (!result.count) throw new HttpError("Integration not found", 404);
  res.status(204).end();
}));

export default router;
