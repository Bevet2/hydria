import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "hydria-audit-regression-"));
process.env.HYDRIA_OS_DATA_DIR = path.join(temp, "data");
const { default: WorkObjectStore } = await import("../src/work-objects/workObject.store.js");
const { default: WorkObjectService } = await import("../src/work-objects/workObject.service.js");
const { executeWorkspaceToolCalls } = await import("../services/hydria/workspaceToolDispatcher.js");
const { resolvePublicUrl, fetchPublicPage } = await import("../services/web/publicHttp.js");
const { createConsentStore } = await import("../services/hydria/workspaceActionConsent.js");
try {
  const catalog = path.join(temp, "catalog.json");
  const store = new WorkObjectStore({ filePath: catalog });
  store.save({ id: "first", title: "Original" });
  fs.writeFileSync(catalog, '{"items":[');
  assert.throws(() => store.save({ id: "second" }), /unreadable/);
  assert.equal(fs.readFileSync(catalog, "utf8"), '{"items":[');
  assert.ok(fs.existsSync(catalog + ".previous"));

  const service = new WorkObjectService({ filePath: path.join(temp, "objects.json"), rootDir: path.join(temp, "objects") });
  const doc = service.createBlankWorkObject({ kind: "document", title: "Concurrent", userId: 42 });
  service.refreshGeneratedArtifactExport = async () => { await new Promise(r => setTimeout(r, 15)); return null; };
  service.materializeGeneratedPreviewAsset = async ({ entries }) => ({ entries });
  const saves = await Promise.allSettled(["First", "Second"].map(content => service.updateContent({
    workObjectId: doc.id, actorUserId: 42, content, expectedRevision: doc.revision
  })));
  assert.equal(saves.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(saves.find(x => x.status === "rejected").reason.statusCode, 409);
  const beforeFailure = service.readContent({ workObjectId: doc.id }).content;
  service.refreshGeneratedArtifactExport = async () => { throw Error("Simulated failed export"); };
  await assert.rejects(service.updateContent({ workObjectId: doc.id, actorUserId: 42, content: "Must roll back" }), /failed export/);
  assert.equal(service.readContent({ workObjectId: doc.id }).content, beforeFailure);
  const sourceFile = service.store.get(doc.id).sourcePath;
  fs.writeFileSync(path.join(path.dirname(sourceFile), ".hydria-pending-save.json"), JSON.stringify({
    entryPath: path.basename(sourceFile), historyId: "interrupted-save", previousContent: beforeFailure
  }));
  fs.writeFileSync(sourceFile, "Interrupted uncommitted edit");
  const recovered = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import WorkObjectService from './src/work-objects/workObject.service.js';
    new WorkObjectService({filePath:process.argv[1],rootDir:process.argv[2]});
  `, service.store.filePath, service.rootDir], { cwd: path.resolve(import.meta.dirname, ".."), env: process.env });
  assert.equal(recovered.status, 0, String(recovered.stderr));
  assert.equal(fs.readFileSync(sourceFile, "utf8"), beforeFailure);

  let content = JSON.stringify({ kind: "hydria-sheet", version: 1, activeSheetId: "s1", sheets: [
    { id: "s1", name: "Data", columns: ["Name"], rows: [["Keep A"], ["Keep B"]] }
  ] });
  const fake = {
    readContent: () => ({ workObject: { id: "sheet", userId: 42, kind: "dataset", revision: 1,
      metadata: { workspaceFamilyId: "data_spreadsheet" } }, entryPath: "table.csv", content }),
    updateContent: async ({ content: next }) => { content = next; return { id: "sheet", revision: 2 }; }
  };
  const call = { type: "workspace_tool_call", target: { workObjectId: "sheet" }, riskLevel: "low", requiresConfirmation: false,
    payload: { toolName: "sheet.delete_row", operations: [{ type: "sheet.delete_row", target: { rowIndex: 0 } }] } };
  const blocked = await executeWorkspaceToolCalls({ userId: 42, workObjectService: fake, proposedActions: [call] });
  assert.equal(blocked.results[0].status, "needs_confirmation");
  assert.equal(JSON.parse(content).sheets[0].rows.length, 2);
  const allowed = await executeWorkspaceToolCalls({ userId: 42, confirmed: true, workObjectService: fake, proposedActions: [call] });
  assert.equal(allowed.executed, 1);
  assert.deepEqual(JSON.parse(content).sheets[0].rows, [["Keep B"]]);
  const imported = await executeWorkspaceToolCalls({ userId: 99, workObjectService: service, proposedActions: [
    { type: "workspace_tool_call", target: { workObjectId: doc.id }, payload: { toolName: "workspace.import_from",
      operations: [{ type: "workspace.import_from", target: { workObjectId: doc.id } }] } }
  ] });
  assert.equal(imported.results[0].status, "failed");
  assert.equal(imported.results[0].importedContent, undefined);
  let clock = 1000;
  const consents = createConsentStore({ now: () => clock, ttlMs: 100 });
  const token = consents.issue({ call, userId: 42, revision: 1, entryPath: "table.csv" });
  assert.throws(() => consents.consume(token, 99), /another profile/);
  assert.throws(() => consents.consume(token + "tampered", 42), /Invalid/);
  assert.equal(consents.consume(token, 42).revision, 1);
  assert.throws(() => consents.consume(token, 42), /already used/);
  const expired = consents.issue({ call, userId: 42, revision: 1, entryPath: "table.csv" });
  clock += 101;
  assert.throws(() => consents.consume(expired, 42), /expired/);
  await assert.rejects(executeWorkspaceToolCalls({ userId: 42, confirmed: true, expectedRevision: 0,
    workObjectService: fake, proposedActions: [call] }), /changed after confirmation/);

  for (const url of ["http://127.0.0.1", "http://2130706433", "http://[::1]", "http://[::ffff:127.0.0.1]",
    "http://169.254.169.254", "http://10.1.2.3", "http://localhost", "file:///etc/passwd", "https://user:pass@example.com"]) {
    await assert.rejects(resolvePublicUrl(url));
  }
  const resolve = async () => [{ address: "93.184.216.34", family: 4 }];
  await assert.rejects(resolvePublicUrl("https://example.com", async () => [{ address: "192.168.1.1", family: 4 }]));
  await assert.rejects(fetchPublicPage("https://example.com", { resolve,
    request: async () => ({ status: 302, location: "http://127.0.0.1/private" }) }));
  const successful = await fetchPublicPage("https://example.com", { resolve,
    request: async () => ({ status: 200, headers: { "content-type": "text/plain" }, buffer: Buffer.from("Public page") }) });
  assert.equal(successful.buffer.toString(), "Public page");

  for (const mode of ["core-first", "local-first", "openrouter-first", "openrouter-only"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { getProviderModelChain } from './services/registry/modelRegistry.js';
      const chain=getProviderModelChain('general');
      if(!chain.some(target=>target.provider==='openrouter')) process.exit(1);
    `], { cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, LLM_ROUTING_MODE: mode,
      OPENROUTER_API_KEY: "audit-placeholder", LOCAL_LLM_ENABLED: "true", HYDRIA_CORE_ENABLED: "true" } });
    assert.equal(result.status, 0, mode + ": " + result.stderr);
  }
  for (const mode of ["local-only", "core-only"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { getProviderModelChain, isProviderAllowed } from './services/registry/modelRegistry.js';
      for (const kind of ['general','premium_code','premium_general','creative']) {
        const chain=getProviderModelChain(kind,{provider:'openrouter',model:'test'});
        if(chain.some(target=>target.provider==='openrouter') || isProviderAllowed('openrouter')) process.exit(1);
      }
    `], { cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, LLM_ROUTING_MODE: mode,
      OPENROUTER_API_KEY: "audit-placeholder", LOCAL_LLM_ENABLED: "true", HYDRIA_CORE_ENABLED: "true" } });
    assert.equal(result.status, 0, mode + " privacy: " + result.stderr);
  }
  console.log("Audit regression passed: corruption, concurrent writes, rollback, destructive actions, profile import, public network and routing matrix.");
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
