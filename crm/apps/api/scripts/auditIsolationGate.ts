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
console.log("CRM real HTTP gate passed: two-tenant isolation, MFA challenge rejection, response redaction and session revocation.");
