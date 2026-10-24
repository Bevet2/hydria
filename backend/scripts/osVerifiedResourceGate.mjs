import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { IdentitySessionStore } from "../services/identity/identitySessionStore.js";
import ProjectStore from "../src/projects/project.store.js";
import WorkObjectService from "../src/work-objects/workObject.service.js";

const root = mkdtempSync(path.join(os.tmpdir(), "hydria-verified-resources-"));
const agentic = path.join(root, "agentic");
let child;

try {
  const database = new Database(path.join(root, "hydria.sqlite"));
  database.pragma("foreign_keys = ON");
  database.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  const accounts = [
    { username: "alice", password: "Alice-operator-pass-718!" },
    { username: "bob", password: "Bob-operator-pass-924!" }
  ];
  const credentials = new IdentitySessionStore(database);
  for (const account of accounts) {
    const result = database.prepare("INSERT INTO users (username, created_at, updated_at) VALUES (?, '2026', '2026')")
      .run(account.username);
    account.id = Number(result.lastInsertRowid);
    credentials.setPassword(account.id, account.password);
  }
  database.close();

  const projects = new ProjectStore({ filePath: path.join(agentic, "project-store.json") });
  const objects = new WorkObjectService({
    filePath: path.join(agentic, "work-object-store.json"),
    rootDir: path.join(agentic, "work-objects")
  });
  const aliceProject = await projects.ensureProject({ name: "Alice confidential plans", metadata: { userId: accounts[0].id } });
  const bobProject = await projects.ensureProject({ name: "Bob private budget", metadata: { userId: accounts[1].id } });
  const secret = objects.createBlankWorkObject({
    title: "Alice secret payroll", userId: accounts[0].id, projectId: aliceProject.id
  });
  const shared = objects.createBlankWorkObject({
    title: "Joint launch briefing", userId: accounts[0].id, projectId: aliceProject.id
  });
  const bobDocument = objects.createBlankWorkObject({
    title: "Bob private contract", userId: accounts[1].id, projectId: bobProject.id
  });
  objects.updateSharing({
    workObjectId: shared.id, actorUserId: accounts[0].id, visibility: "private",
    shares: [{ userId: accounts[1].id, role: "viewer" }]
  });
  await projects.updateProject(aliceProject.id, () => ({
    workObjectIds: [secret.id, shared.id],
    activeWorkObjectId: secret.id,
    graph: { nodes: [{ id: secret.id, label: "Private financial forecast" }], edges: [], workspaceFamilies: [] },
    dimensions: ["Private acquisition"],
    internalCapabilities: ["Confidential finance"],
    globalProject: { secret: "Stealth launch valuation" },
    exportArtifact: { filename: "payroll-private.pdf" }
  }));

  for (const invalidId of [null, 0, "", NaN, "invalid"]) {
    assert.throws(() => objects.get(secret.id, { actorUserId: invalidId }),
      /permission|actor|identity/i, "Explicit invalid actors cannot get owner-only documents");
  }
  assert.throws(() => objects.get(secret.id, { actorUserId: accounts[1].id, includeContent: true }),
    /permission/i, "Another account cannot read the document's file content");
  assert.equal(objects.get(shared.id, { actorUserId: accounts[1].id })?.id, shared.id);
  assert.equal(objects.get(secret.id)?.id, secret.id, "Legacy internal unscoped API remains compatible");

  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await new Promise(resolve => reservation.once("listening", resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  child = spawn(process.execPath, ["server.js"], {
    cwd: new URL("../", import.meta.url).pathname,
    env: {
      ...process.env, NODE_ENV: "test", PORT: String(port), HYDRIA_OS_DATA_DIR: root,
      HYDRIA_FLOW_CONNECTOR_TOKEN: "", HYDRIA_FLOW_SCHEDULER_ENABLED: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", data => { stderr = (stderr + data.toString()).slice(-2_000); });
  child.stdout.resume();
  const base = `http://127.0.0.1:${port}`;

  let ready = false;
  for (let trial = 0; trial < 80; trial += 1) {
    if (child.exitCode !== null) break;
    try {
      ready = (await fetch(`${base}/livez`, { signal: AbortSignal.timeout(500) })).status === 200;
      if (ready) break;
    } catch { /* Server starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `Backend failed to start: ${stderr}`);

  for (const account of accounts) {
    const response = await fetch(`${base}/api/identity/session`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: account.username, password: account.password })
    });
    assert.equal(response.status, 201);
    account.cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(account.cookie);
  }
  const request = (url, account) => fetch(`${base}${url}`, {
    headers: account ? { cookie: account.cookie } : {}
  });
  const alice = accounts[0];
  const bob = accounts[1];

  for (const url of ["/api/projects/mine", "/api/work-objects/mine", `/api/work-objects/mine/${secret.id}`]) {
    assert.equal((await request(url)).status, 401, `${url} must require a verified session`);
  }
  assert.equal((await request(`/api/projects/mine?userId=${bob.id}`, alice)).status, 403,
    "Query-string impersonation must not change the session owner");

  const aliceProjects = await request("/api/projects/mine", alice);
  assert.equal(aliceProjects.status, 200);
  assert.equal(aliceProjects.headers.get("cache-control"), "no-store");
  assert.deepEqual((await aliceProjects.json()).projects.map(project => project.id), [aliceProject.id]);
  assert.deepEqual((await (await request("/api/projects/mine", bob)).json()).projects.map(project => project.id),
    [bobProject.id]);
  assert.equal((await request(`/api/projects/mine/${bobProject.id}`, alice)).status, 404);
  assert.equal((await request(`/api/projects/mine/${aliceProject.id}`, bob)).status, 200,
    "A collaborator should only receive objects explicitly shared in this project");
  const sharedWorkspace = (await (await request(`/api/projects/mine/${aliceProject.id}`, bob)).json()).workspace;
  assert.deepEqual(sharedWorkspace.workObjects.map(object => object.id), [shared.id]);
  const sharedPayload = JSON.stringify(sharedWorkspace);
  for (const secretFragment of [
    secret.id, "Alice confidential plans", "Private financial forecast",
    "Private acquisition", "Confidential finance", "Stealth launch valuation", "payroll-private.pdf"
  ]) {
    assert.equal(sharedPayload.includes(secretFragment), false,
      `A document share must not disclose unrelated project metadata: ${secretFragment}`);
  }

  const aliceObjects = (await (await request("/api/work-objects/mine", alice)).json()).workObjects;
  assert.deepEqual(new Set(aliceObjects.map(object => object.id)), new Set([secret.id, shared.id]));
  const bobObjects = (await (await request("/api/work-objects/mine", bob)).json()).workObjects;
  assert.deepEqual(new Set(bobObjects.map(object => object.id)), new Set([bobDocument.id, shared.id]));
  assert.equal((await request(`/api/work-objects/mine/${secret.id}?content=1`, bob)).status, 403);
  assert.equal((await request(`/api/work-objects/mine/${secret.id}?content=1&userId=${alice.id}`, bob)).status, 403,
    "Spoofing the owner cannot bypass the file-content authorization check");
  const sharedDetail = await request(`/api/work-objects/mine/${shared.id}?content=1`, bob);
  assert.equal(sharedDetail.status, 200);
  assert.equal((await sharedDetail.json()).workObject.id, shared.id);
  const ownerDetail = await request(`/api/work-objects/mine/${secret.id}?content=1`, alice);
  assert.equal(ownerDetail.status, 200);
  assert.equal((await ownerDetail.json()).workObject.id, secret.id);
  assert.deepEqual((await (await request("/api/work-objects/mine/search?q=payroll", bob)).json()).results, []);
  assert.ok((await (await request("/api/work-objects/mine/search?q=payroll", alice)).json()).results
    .some(result => result.id === secret.id));

  // Mutation gate: a real cookie-authenticated editor can change only an
  // authorized document and must not overwrite an intervening revision.
  const mutate = (method, url, account, body = {}) => fetch(`${base}${url}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(account ? { cookie: account.cookie } : {})
    },
    body: JSON.stringify(body)
  });
  const scoped = (id) => `/api/work-objects/mine/${id}`;
  const firstRevision = Number(objects.get(secret.id).revision);
  const rename = { title: "Alice revised confidential plans", expectedRevision: firstRevision };

  assert.equal((await mutate("PATCH", scoped(secret.id), null, rename)).status, 401);
  assert.equal((await mutate("PATCH", scoped(secret.id), bob, rename)).status, 403);
  assert.equal((await mutate("PATCH", scoped(shared.id), bob, {
    title: "Unauthorized viewer rename", expectedRevision: Number(objects.get(shared.id).revision)
  })).status, 403);
  assert.equal((await mutate("PATCH", scoped(secret.id), bob, {
    ...rename, userId: alice.id
  })).status, 403, "A client-supplied owner ID cannot authorize a mutation");
  assert.equal((await mutate("PATCH", scoped(secret.id), alice, {
    title: " ", expectedRevision: firstRevision
  })).status, 400);
  assert.equal((await mutate("PATCH", scoped(secret.id), alice, {
    title: rename.title
  })).status, 400, "A mutation needs a concurrency precondition");
  assert.equal((await mutate("PATCH", scoped(secret.id), alice, {
    ...rename, expectedRevision: firstRevision + 1
  })).status, 409);

  const changed = await mutate("PATCH", scoped(secret.id), alice, rename);
  assert.equal(changed.status, 200);
  assert.equal(changed.headers.get("cache-control"), "no-store");
  const changedObject = (await changed.json()).workObject;
  assert.equal(changedObject.title, rename.title);
  assert.equal(changedObject.revision, firstRevision + 1);
  assert.equal(objects.get(secret.id).title, rename.title);
  assert.equal((await mutate("PATCH", scoped(secret.id), alice, rename)).status, 409,
    "Retrying a stale rename must not silently overwrite newer data");

  assert.equal((await mutate("POST", `${scoped(secret.id)}/trash`, bob, {
    expectedRevision: changedObject.revision
  })).status, 403);
  assert.equal((await mutate("POST", `${scoped(secret.id)}/trash`, alice, {
    expectedRevision: firstRevision
  })).status, 409);
  const trashed = await mutate("POST", `${scoped(secret.id)}/trash`, alice, {
    expectedRevision: changedObject.revision
  });
  assert.equal(trashed.status, 200);
  const trashedObject = (await trashed.json()).workObject;
  assert.equal(trashedObject.status, "trashed");
  assert.equal(trashedObject.revision, changedObject.revision + 1);
  assert.equal((await mutate("POST", `${scoped(secret.id)}/trash`, alice, {
    expectedRevision: trashedObject.revision
  })).status, 409, "Trashing twice must not overwrite the original recovery status");
  assert.equal((await mutate("POST", `${scoped(secret.id)}/restore`, bob, {
    expectedRevision: trashedObject.revision
  })).status, 403);
  assert.equal((await mutate("POST", `${scoped(secret.id)}/restore`, alice, {
    expectedRevision: changedObject.revision
  })).status, 409);
  const restored = await mutate("POST", `${scoped(secret.id)}/restore`, alice, {
    expectedRevision: trashedObject.revision
  });
  assert.equal(restored.status, 200);
  const restoredObject = (await restored.json()).workObject;
  assert.equal(restoredObject.status, "ready");
  assert.equal((await mutate("POST", `${scoped(secret.id)}/restore`, alice, {
    expectedRevision: restoredObject.revision
  })).status, 409, "Restoring an active document must not create an extra revision");
  assert.equal(objects.get(secret.id).title, rename.title);

  console.log("Verified resource gate: identity, isolated reads, authorized versioned rename/trash/restore enforced.");
} finally {
  if (child) {
    child.kill("SIGTERM");
    if (child.exitCode === null) await new Promise(resolve => child.once("exit", resolve));
  }
  rmSync(root, { recursive: true, force: true });
}
