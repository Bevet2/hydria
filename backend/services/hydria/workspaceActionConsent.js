import { randomBytes, randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../utils/errors.js";

// Consents expire on restart and after five minutes, and are single-use.
export function createConsentStore({ now = Date.now, ttlMs = 300_000 } = {}) {
  const secret = randomBytes(32);
  const pending = new Map();
  const signature = body => createHmac("sha256", secret).update(body).digest();
  return {
    issue({ call, userId, revision, entryPath }) {
      for (const [id, expiresAt] of pending) if (expiresAt <= now()) pending.delete(id);
      if (pending.size >= 1000) throw new AppError("Too many pending confirmations", 429);
      const id = randomUUID(), expiresAt = now() + ttlMs;
      // Persist only the normalized contract, not the model's redundant raw fields.
      const { raw, ...action } = call;
      const body = Buffer.from(JSON.stringify({ id, expiresAt, call: action, userId, revision, entryPath })).toString("base64url");
      if (body.length > 256_000) throw new AppError("Action is too large to confirm", 413);
      pending.set(id, expiresAt);
      return body + "." + signature(body).toString("base64url");
    },
    consume(token, userId) {
      if (typeof token !== "string" || token.length > 256_100) throw new AppError("Invalid confirmation", 400);
      const [body, mac, extra] = token.split(".");
      const supplied = Buffer.from(mac || "", "base64url");
      const expected = signature(body || "");
      if (extra || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new AppError("Invalid confirmation", 403);
      let consent;
      try { consent = JSON.parse(Buffer.from(body, "base64url").toString()); }
      catch { throw new AppError("Invalid confirmation", 400); }
      if (Number(consent.userId) !== Number(userId) || !Number.isSafeInteger(Number(userId)) || Number(userId) < 1) throw new AppError("Confirmation belongs to another profile", 403);
      if (consent.expiresAt <= now() || pending.get(consent.id) !== consent.expiresAt) throw new AppError("Confirmation expired or already used", 409);
      pending.delete(consent.id);
      return consent;
    }
  };
}
export const workspaceActionConsent = createConsentStore();
