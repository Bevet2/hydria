import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { signAccessToken, signMfaChallengeToken, verifyAccessToken, verifyMfaChallengeToken } from "../src/lib/auth.js";
import { publicJson } from "../src/middleware/publicJson.js";
import { env } from "../src/config/env.js";
import { Prisma } from "@prisma/client";

const user = { sub: randomUUID(), organizationId: randomUUID(), role: "MEMBER" as const,
  email: "audit@example.com", sessionId: randomUUID() };
const access = signAccessToken(user);
const challenge = signMfaChallengeToken(user.sub);
assert.equal(verifyAccessToken(access).organizationId, user.organizationId);
assert.equal(verifyMfaChallengeToken(challenge).sub, user.sub);
assert.throws(() => verifyAccessToken(challenge));
assert.throws(() => verifyMfaChallengeToken(access));
for (const incomplete of [{ ...user, role: undefined }, { ...user, organizationId: undefined }, { ...user, sessionId: undefined }]) {
  const token = jwt.sign({ ...incomplete, purpose: "access" }, env.JWT_SECRET,
    { algorithm: "HS256", issuer: "hydria-crm", audience: "hydria-crm-api", expiresIn: "1m" });
  assert.throws(() => verifyAccessToken(token));
}
const task = { assignedTo: { id: user.sub, passwordHash: "private", mfaSecret: "encrypted", mfaRecoveryCodes: ["private"] },
  nested: [{ child: { passwordHash: "also private", displayName: "Allowed" } }] };
assert.deepEqual(publicJson(task), { assignedTo: { id: user.sub }, nested: [{ child: { displayName: "Allowed" } }] });
assert.equal(publicJson(new Prisma.Decimal("42.25")), "42.25");
console.log("CRM audit token separation, required identity/session claims and nested response redaction passed.");
