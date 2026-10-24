import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import express from "express";
import * as registry from "../src/workspaces/workspaceRegistry.js";
import configRouter from "../routes/config.js";
import { WORKSPACE_PAGES } from "../../frontend/components/workspaceSurfaceRegistry.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const families = registry.listPublicWorkspaceFamilies();

// A registry entry is a product intention, not evidence of an implemented app.
assert.equal(families.length, 26);
assert.equal(families.some((family) => Object.hasOwn(family, "implemented")), false);
assert.equal(typeof registry.listProductCapabilityCoverage, "function");

const catalog = registry.listProductCapabilityCoverage();
assert.equal(Array.isArray(catalog.families), true);
assert.equal(Array.isArray(catalog.capabilities), true);
assert.equal(catalog.families.length, 28); // 26 backend families + the two ArtCraft routes
assert.equal(new Set(catalog.families.map((item) => item.id)).size, 28);
assert.deepEqual(
  new Set(catalog.families.map((entry) => entry.id)),
  new Set([...families.map((entry) => entry.id), "artcraft_photo", "artcraft_fig"])
);
assert.equal(catalog.families.every((item) => typeof item.maturity === "string"), true);
assert.deepEqual(new Set(catalog.capabilities.map((item) => item.id)).size, catalog.capabilities.length);
assert.equal(catalog.maturityLevels.includes("parity_targeted"), true);

for (const runtimeFamily of families) {
  const reviewed = catalog.families.find((entry) => entry.id === runtimeFamily.id);
  const { id, ...delivery } = reviewed;
  assert.deepEqual(runtimeFamily.delivery, delivery, `${id}: public routing status differs from catalog`);
}

const listedRoutes = [];
for (const entry of catalog.families) {
  for (const route of entry.routes) {
    const page = WORKSPACE_PAGES.find((candidate) => candidate.slug === route);
    assert.equal(page?.family, entry.id, `${entry.id}: invalid route ${route}`);
    listedRoutes.push(route);
  }
}
assert.deepEqual(new Set(listedRoutes), new Set(WORKSPACE_PAGES.map((page) => page.slug)));
assert.equal(listedRoutes.length, WORKSPACE_PAGES.length, "A route must have exactly one owning family");

for (const page of WORKSPACE_PAGES) {
  const entry = catalog.families.find((item) => item.id === page.family);
  assert.ok(entry, `Missing family for ${page.slug}`);
  assert.ok(entry.routes.includes(page.slug), `${page.slug} must be a declared route`);
  assert.notEqual(entry.maturity, "production", `${page.slug} is not production-certified`);
}

const notRouted = catalog.families.find((item) => item.id === "hr");
assert.deepEqual(notRouted.routes, []);
assert.equal(notRouted.maturity, "declared");

const videoGeneration = catalog.capabilities.find((item) => item.id === "video_generation");
const videoTimeline = catalog.capabilities.find((item) => item.id === "video_timeline");
const voiceSynthesis = catalog.capabilities.find((item) => item.id === "voice_synthesis");
assert.equal(videoGeneration.maturity, "idea");
assert.equal(videoTimeline.maturity, "prototype");
assert.equal(voiceSynthesis.maturity, "idea");
assert.equal(videoGeneration.workspaceFamilyId, "media");
assert.equal(catalog.families.some((item) => item.maturity === "production"), false);

// This validates evidence references, not the result of running those gates.
for (const entry of [...catalog.families, ...catalog.capabilities]) {
  assert.ok(catalog.maturityLevels.includes(entry.maturity), `${entry.id}: invalid maturity`);
  if (Object.hasOwn(entry, "workspaceFamilyId")) {
    assert.ok(catalog.families.some((family) => family.id === entry.workspaceFamilyId), `${entry.id}: unknown family`);
    assert.ok(entry.suites.length > 0, `${entry.id}: missing target suites`);
  }
  for (const proof of [...entry.evidence.code, ...entry.evidence.tests]) {
    const absolute = resolve(root, proof);
    assert.ok(absolute.startsWith(`${root}/`), `${entry.id}: evidence escapes repository`);
    assert.ok(existsSync(absolute), `${entry.id}: nonexistent evidence ${proof}`);
  }
  if (["prototype", "functional", "hardened", "production"].includes(entry.maturity)) {
    assert.ok(entry.evidence.code.length > 0, `${entry.id}: implementation evidence required`);
    assert.ok(entry.evidence.tests.length > 0, `${entry.id}: test evidence required`);
  }
  if (entry.maturity === "production") {
    assert.ok(entry.evidence.deployment, `${entry.id}: target deployment proof required`);
  }
}

// The public read-only endpoint must expose the same reviewed claims without
// requiring a private user session or mutating the runtime registry.
const server = express().use("/api/config", configRouter).listen(0, "127.0.0.1");
try {
  await new Promise((resolveListening, reject) => {
    if (server.listening) resolveListening();
    else {
      server.once("listening", resolveListening);
      server.once("error", reject);
    }
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/config/capability-catalog`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.catalog.capabilities.map((item) => item.id), catalog.capabilities.map((item) => item.id));
  assert.equal(body.catalog.families.some((item) => item.maturity === "production"), false);
  const publicResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/config/public`);
  assert.equal(publicResponse.status, 200);
  const publicConfig = await publicResponse.json();
  assert.equal(publicConfig.config.agentic.workspaces.length, 26);
  assert.equal(publicConfig.config.agentic.workspaces.every((item) => item.delivery?.maturity), true);
} finally {
  await new Promise((done) => server.close(done));
}

console.log(`Capability catalog verified: ${catalog.families.length} families, ${catalog.capabilities.length} user capabilities, ${WORKSPACE_PAGES.length} routes.`);
