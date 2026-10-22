import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { IdentitySessionStore } from "../services/identity/identitySessionStore.js";
import { createIdentityRouter, requireVerifiedIdentity } from "../routes/identity.js";

const database = new Database(":memory:");
database.pragma("foreign_keys = ON");
database.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
database.exec(`
  INSERT INTO users VALUES (1, 'arnaud', '2026-10-22', '2026-10-22');
  INSERT INTO users VALUES (2, 'colleague', '2026-10-22', '2026-10-22');
  INSERT INTO users VALUES (3, 'unclaimed', '2026-10-22', '2026-10-22');
`);
let clock = Date.parse("2026-10-22T12:00:00Z");
const identity = new IdentitySessionStore(database, { now: () => clock, sessionTtlMs: 60_000 });
identity.setPassword(1, "First-account-password-aB78!");
identity.setPassword(2, "Second-account-password-83Js!");

const app = express();
app.use(express.json());
app.use("/api/identity", createIdentityRouter({ identity, production: true }));
app.use("/api/identity-limited", createIdentityRouter({
  identity, production: true, maxAttempts: 2, attemptWindowMs: 2_000
}));
app.get("/api/protected", requireVerifiedIdentity(identity), (req, res) => {
  res.json({ userId: req.hydriaIdentity.id, username: req.hydriaIdentity.username });
});
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const postLogin = (username, password) => fetch(`${base}/api/identity/session`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password })
});
const cookieValue = (response) => response.headers.get("set-cookie")?.split(";")[0];

try {
  // The legacy username-only profile is not a valid authenticated account.
  for (const [username, password] of [
    ["unclaimed", "any-password-will-not-work"],
    ["arnaud", "incorrect-but-lengthy-password"],
    ["missing", "incorrect-but-lengthy-password"]
  ]) {
    const denied = await postLogin(username, password);
    assert.equal(denied.status, 401, "Unprovisioned or invalid credentials must not issue a session");
    assert.equal(denied.headers.get("set-cookie"), null);
    assert.equal((await denied.json()).error, "Invalid username or password");
  }
  assert.equal((await fetch(`${base}/api/identity/session`)).status, 401);
  assert.equal((await fetch(`${base}/api/protected?userId=1`)).status, 401,
    "A bare userId must never authenticate the caller");

  const first = await postLogin("arnaud", "First-account-password-aB78!");
  const second = await postLogin("colleague", "Second-account-password-83Js!");
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.match(first.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(first.headers.get("set-cookie"), /Secure/i);
  assert.match(first.headers.get("set-cookie"), /SameSite=Strict/i);
  assert.match(first.headers.get("set-cookie"), /Path=\//i);
  const firstCookie = cookieValue(first);
  const secondCookie = cookieValue(second);
  assert.notEqual(firstCookie, secondCookie, "Two accounts must never share a session secret");
  assert.doesNotMatch(firstCookie, /arnaud|colleague|password/i,
    "Session cookie must be opaque, not contain user identity or password");

  const firstHeaders = { cookie: firstCookie };
  const secondHeaders = { cookie: secondCookie };
  const me = await fetch(`${base}/api/identity/session`, { headers: firstHeaders });
  assert.equal(me.status, 200);
  assert.deepEqual((await me.json()).user, { id: 1, username: "arnaud" });
  const another = await fetch(`${base}/api/protected`, { headers: secondHeaders });
  assert.deepEqual(await another.json(), { userId: 2, username: "colleague" });

  assert.equal((await fetch(`${base}/api/protected?userId=2`, { headers: firstHeaders })).status, 403,
    "An authenticated user must not override identity with somebody else's query ID");
  assert.equal((await fetch(`${base}/api/protected?userId=1`, { headers: firstHeaders })).status, 200);
  assert.equal((await fetch(`${base}/api/protected?userId=invalid`, { headers: firstHeaders })).status, 403);
  assert.equal((await fetch(`${base}/api/protected`, {
    headers: { cookie: `${firstCookie}; ${secondCookie}` }
  })).status, 401, "Ambiguous duplicate session cookies must fail closed");

  const logout = await fetch(`${base}/api/identity/session`, { method: "DELETE", headers: firstHeaders });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(`${base}/api/protected`, { headers: firstHeaders })).status, 401,
    "Logging out invalidates a stolen/replayed token");
  assert.equal((await fetch(`${base}/api/protected`, { headers: secondHeaders })).status, 200,
    "Logging out of another account must not revoke this account");

  const old = await postLogin("arnaud", "First-account-password-aB78!");
  const oldCookie = cookieValue(old);
  identity.setPassword(1, "Rotated-account-password-95K!");
  assert.equal((await fetch(`${base}/api/protected`, { headers: { cookie: oldCookie } })).status, 401,
    "Changing a password must revoke every preexisting session");
  assert.equal((await postLogin("arnaud", "First-account-password-aB78!")).status, 401);
  const renewed = await postLogin("arnaud", "Rotated-account-password-95K!");
  assert.equal(renewed.status, 201);
  clock += 60_001;
  assert.equal((await fetch(`${base}/api/protected`, {
    headers: { cookie: cookieValue(renewed) }
  })).status, 401, "Expired sessions must not be accepted");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.equal((await fetch(`${base}/api/identity-limited/session`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "arnaud", password: "wrong-password" })
    })).status, 401);
  }
  const locked = await fetch(`${base}/api/identity-limited/session`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "arnaud", password: "Rotated-account-password-95K!" })
  });
  assert.equal(locked.status, 429, "Credential stuffing must be throttled before verifying passwords");
  assert.equal(locked.headers.get("set-cookie"), null);
  clock += 2_001;
  assert.equal((await fetch(`${base}/api/identity-limited/session`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "arnaud", password: "Rotated-account-password-95K!" })
  })).status, 201, "A temporary lockout must expire");
  console.log("Hydria identity sessions: password verification, opaque cookies, account binding, revocation and expiration passed.");
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  database.close();
}
