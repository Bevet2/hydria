import { Router } from "express";
import { db } from "../db/sqlite.js";
import { IdentitySessionStore } from "../services/identity/identitySessionStore.js";
import { IDENTITY_COOKIE_NAME } from "../services/identity/identityCookie.js";

const COOKIE_NAME = IDENTITY_COOKIE_NAME;

function sessionToken(req) {
  const header = req.get("cookie") || "";
  const tokens = header.split(";").map((part) => part.trim()).filter((part) =>
    part.startsWith(`${COOKIE_NAME}=`)
  );
  // Reject ambiguous cookies even when both have plausible values.
  if (tokens.length !== 1) return null;
  return tokens[0].slice(COOKIE_NAME.length + 1);
}

function serializeSessionCookie(value, { production, maxAge } = {}) {
  const flags = [`${COOKIE_NAME}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict"];
  if (production) flags.push("Secure");
  if (maxAge !== undefined) flags.push(`Max-Age=${maxAge}`);
  return flags.join("; ");
}

export function requireVerifiedIdentity(identity) {
  return (req, res, next) => {
    const user = identity.resolve(sessionToken(req));
    if (!user) return res.status(401).json({ success: false, error: "Authenticated user required" });
    const submittedIds = [req.query?.userId, req.body?.userId];
    if (submittedIds.some((candidate) => candidate !== undefined && String(candidate) !== String(user.id))) {
      return res.status(403).json({ success: false, error: "User identity mismatch" });
    }
    req.hydriaIdentity = user;
    next();
  };
}

export function createIdentityRouter({
  identity, production = false, maxAttempts = 8, attemptWindowMs = 15 * 60_000
} = {}) {
  const router = Router();
  const store = identity || new IdentitySessionStore(db);
  const failedAttempts = new Map();

  router.post("/session", (req, res) => {
    const now = store.now();
    const peer = req.ip || req.socket?.remoteAddress || "unknown";
    const previous = failedAttempts.get(peer);
    const current = previous && previous.until > now ? previous : { count: 0, until: now + attemptWindowMs };
    if (current.count >= maxAttempts) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((current.until - now) / 1000))));
      return res.status(429).json({ success: false, error: "Too many login attempts" });
    }
    const session = store.authenticate(req.body?.username, req.body?.password);
    if (!session) {
      failedAttempts.set(peer, { count: current.count + 1, until: current.until });
      // Prevent unbounded memory growth under high-cardinality abusive traffic.
      if (failedAttempts.size > 2048) failedAttempts.delete(failedAttempts.keys().next().value);
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }
    failedAttempts.delete(peer);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", serializeSessionCookie(session.token, {
      production, maxAge: Math.max(1, Math.floor((session.expiresAt - store.now()) / 1000))
    }));
    return res.status(201).json({ success: true, user: session.user, expiresAt: session.expiresAt });
  });

  router.get("/session", requireVerifiedIdentity(store), (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, user: req.hydriaIdentity });
  });

  router.delete("/session", (req, res) => {
    store.revoke(sessionToken(req));
    res.setHeader("Set-Cookie", serializeSessionCookie("", { production, maxAge: 0 }));
    return res.status(204).end();
  });

  return router;
}

export default createIdentityRouter;
