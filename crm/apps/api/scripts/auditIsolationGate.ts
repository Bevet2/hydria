// Real HTTP integration test: run against a disposable CRM with PostgreSQL.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
const base = process.env.CRM_API_URL || "http://127.0.0.1:4010/api";
const suffix = randomUUID();
const password = "Audit-Isolation-42-Temporary!";
async function raw(path: string, token = "", method = "GET", body?: unknown) {
  return fetch(base + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
async function request(path: string, token = "", method = "GET", body?: unknown) {
  const response = await raw(path, token, method, body);
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${await response.clone().text()}`);
  return response.status === 204 ? {} : response.json();
}
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret].map(c => alphabet.indexOf(c).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from((bits.match(/.{8}/g) || []).map(byte => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}
const accounts = [];
for (const name of ["A", "B"]) accounts.push(await request("/auth/register", "", "POST", {
  organizationName: `Audit ${name} ${suffix}`, email: `audit-${name}-${suffix}@example.com`,
  firstName: "Audit", lastName: name, password
}));
const [a, b] = accounts;
assert.notEqual(a.user.organizationId, b.user.organizationId);
const contact = await request("/contacts", b.token, "POST", { firstName: "Tenant", lastName: "B" });
assert.equal((await raw(`/contacts/${contact.contact.id}`, a.token)).status, 404);
const list = await request("/contacts", a.token);
assert.ok(!list.contacts.some((value: { id: string }) => value.id === contact.contact.id));
const setup = await request("/auth/mfa/setup", a.token, "POST");
await request("/auth/mfa/enable", a.token, "POST", { code: totp(setup.secret) });
const login = await request("/auth/login", "", "POST", { email: a.user.email, password });
assert.equal(login.mfaRequired, true);
assert.equal((await raw("/contacts", login.challengeToken)).status, 401);
assert.equal((await raw(`/contacts/${contact.contact.id}`, login.challengeToken, "PATCH", { firstName: "Forbidden" })).status, 401);
const task = await request("/tasks", a.token, "POST", { title: "Redaction audit", assignedToId: a.user.id });
const serialized = JSON.stringify(task);
for (const field of ["passwordHash", "mfaSecret", "mfaRecoveryCodes"]) assert.ok(!serialized.includes(field), field);
assert.equal(task.task.assignedTo.id, a.user.id);
await request("/auth/logout", b.token, "POST");
assert.equal((await raw("/contacts", b.token)).status, 401);

// Real first-use race: all requests share an identity that does not yet exist.
const bridgeSecret = process.env.HYDRIA_INTEGRATION_SECRET;
assert.ok(bridgeSecret, "Configure the disposable CRM bridge secret for this gate");
const bridgeBody = JSON.stringify({ hydriaUserId: "concurrent-" + suffix, username: "Concurrent Identity" });
const timestamp = String(Date.now());
const signature = createHmac("sha256", bridgeSecret).update(`${timestamp}.${bridgeBody}`).digest("hex");
const bridgeSessions = await Promise.all(Array.from({ length: 8 }, async () => {
  const response = await fetch(base + "/integrations/hydria/session", { method: "POST", headers: {
    "content-type": "application/json", "x-hydria-timestamp": timestamp, "x-hydria-signature": signature
  }, body: bridgeBody });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}));
assert.equal(new Set(bridgeSessions.map(session => session.user.id)).size, 1);
assert.equal(new Set(bridgeSessions.map(session => session.user.organizationId)).size, 1);
assert.equal(new Set(bridgeSessions.map(session => session.token)).size, 8);
for (const session of bridgeSessions) {
  assert.equal(session.user.role, "MEMBER");
  assert.equal(JSON.stringify(session).includes("passwordHash"), false);
  const me = await request("/auth/me", session.token);
  assert.equal(me.user.id, session.user.id);
}
console.log("CRM real HTTP gate passed: tenant isolation, MFA separation, redaction, revocation and eight concurrent bridge sessions sharing one MEMBER identity.");
