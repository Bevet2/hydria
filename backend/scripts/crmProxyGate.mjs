import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createCrmApiProxy } from "../middleware/crmApiProxy.js";

const upstream = http.createServer(async (req, res) => {
  if (req.url === "/api/hang") return; // Deliberate hanging upstream.
  if (req.url === "/api/cookie-collision") {
    res.writeHead(200, { "Set-Cookie": [
      "hydria_identity_session=forged-by-crm; Path=/; HttpOnly",
      "crm_auth=legitimate; Path=/; HttpOnly"
    ] });
    res.end("ok");
    return;
  }
  if (req.url === "/api/disconnect") {
    req.socket.destroy();
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  res.writeHead(200, {
    "Content-Type": "application/json",
    "X-Upstream-Result": "ok",
    "Connection": "close",
    "Set-Cookie": "crm_test=1; Path=/; HttpOnly"
  });
  res.end(JSON.stringify({
    method: req.method,
    path: req.url,
    headers: req.headers,
    body: Buffer.concat(chunks).toString("utf8")
  }));
});
upstream.listen(0, "127.0.0.1");
await new Promise((resolve) => upstream.once("listening", resolve));
const upstreamUrl = "http://127.0.0.1:" + upstream.address().port + "/api";
const app = express();
app.use("/crm-api", createCrmApiProxy({
  apiUrl: upstreamUrl, timeoutMs: 220,
  publicOrigin: "https://os.example.org"
}));
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = "http://127.0.0.1:" + server.address().port;
try {
  const basic = "Basic " + Buffer.from("owner:never-forward-this").toString("base64");
  const secret = await fetch(base + "/crm-api/health?q=1", {
    headers: {
      authorization: basic,
      "proxy-authorization": "Basic malicious",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "http",
      "x-forwarded-for": "10.0.0.1",
      forwarded: "for=attacker.example"
    }
  });
  assert.equal(secret.status, 200);
  assert.equal(secret.headers.get("x-upstream-result"), "ok");
  assert.equal(secret.headers.get("set-cookie")?.includes("crm_test=1"), true);
  const basicResponse = await secret.json();
  assert.equal(basicResponse.path, "/api/health?q=1");
  assert.equal(basicResponse.headers.authorization, undefined);
  assert.equal(basicResponse.headers["proxy-authorization"], undefined);
  assert.equal(basicResponse.headers["x-forwarded-host"], "os.example.org");
  assert.equal(basicResponse.headers["x-forwarded-proto"], "https");
  assert.notEqual(basicResponse.headers["x-forwarded-for"], "10.0.0.1");
  assert.equal(basicResponse.headers.forwarded, undefined);

  const mixedCookies = await fetch(base + "/crm-api/session", {
    headers: { cookie: "crm_auth=crm-secret; hydria_identity_session=hydria-opaque-secret; ui_theme=dark" }
  });
  assert.equal(mixedCookies.status, 200);
  const forwardedCookies = (await mixedCookies.json()).headers.cookie;
  assert.equal(forwardedCookies, "crm_auth=crm-secret; ui_theme=dark",
    "The Hydria identity cookie must never cross the CRM proxy, while CRM cookies remain intact");
  const collision = await fetch(base + "/crm-api/cookie-collision");
  assert.equal(collision.status, 200);
  assert.doesNotMatch(collision.headers.get("set-cookie") || "", /hydria_identity_session=/,
    "The CRM must not be allowed to overwrite an OS identity cookie");
  assert.match(collision.headers.get("set-cookie") || "", /crm_auth=legitimate/,
    "Filtering OS identity cookies must preserve CRM's own session cookies");

  const body = '{"lead":"crm-pilot","amount":120}';
  const bearer = await fetch(base + "/crm-api/leads", {
    method: "POST",
    headers: {authorization:"Bearer crm-session-token","content-type":"application/json"},
    body
  });
  assert.equal(bearer.status, 200);
  const persisted = await bearer.json();
  assert.equal(persisted.headers.authorization, "Bearer crm-session-token");
  assert.equal(persisted.headers["content-type"], "application/json");
  assert.equal(persisted.body, body, "JSON and Bearer CRM requests must survive proxying");

  const hung = await fetch(base + "/crm-api/hang");
  assert.equal(hung.status, 504, "Hung CRM must return 504 instead of indefinitely waiting");
  const hungPayload = await hung.json();
  assert.equal(hungPayload.error, "Hydria CRM API timed out.");
  assert.equal(hungPayload.details, undefined, "Proxy must not leak upstream addresses");
  const disconnected = await fetch(base + "/crm-api/disconnect");
  assert.equal(disconnected.status, 503, "Broken upstream must return 503");
  assert.equal((await disconnected.json()).details, undefined);
  console.log("Hydria CRM proxy security, streaming, timeouts and upstream failure gate passed.");
} finally {
  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  upstream.closeAllConnections?.();
  await new Promise((resolve, reject) => upstream.close(err => err ? reject(err) : resolve()));
}
