import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "hydria-consent-http-"));
process.env.HYDRIA_OS_DATA_DIR = temp;
const { default: express } = await import("express");
const { initDatabase, closeDatabase } = await import("../db/sqlite.js");
const { createUser } = await import("../services/memory/historyService.js");
const { default: config } = await import("../src/config/agenticConfig.js");
const { default: WorkObjectService } = await import("../src/work-objects/workObject.service.js");
const { executeWorkspaceToolCalls } = await import("../services/hydria/workspaceToolDispatcher.js");
const { default: router } = await import("../routes/hydriaApi.js");
initDatabase();
const user = createUser("consent-owner"), other = createUser("consent-other");
const service = new WorkObjectService({ filePath: config.files.workObjectStore, rootDir: config.files.workObjectRoot });
const sheet = service.createBlankWorkObject({ kind: "dataset", userId: user.id, title: "Consent", workspaceFamilyId: "data_spreadsheet" });
await service.updateContent({ workObjectId: sheet.id, actorUserId: user.id, content: JSON.stringify({
  kind: "hydria-sheet", version: 1, activeSheetId: "s1", sheets: [{ id: "s1", name: "Data", columns: ["Name"], rows: [["First"], ["Second"]] }]
}) });
const call = { type: "workspace_tool_call", target: { workObjectId: sheet.id, entryPath: sheet.primaryFile },
  payload: { toolName: "sheet.delete_row", operations: [{ type: "sheet.delete_row", target: { rowIndex: 0 } }] } };
async function propose() { return (await executeWorkspaceToolCalls({ userId: user.id, workObjectService: service, proposedActions: [call] })).results[0]; }
const app = express(); app.use(express.json()); app.use("/api/hydria", router);
app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
const url = `http://127.0.0.1:${server.address().port}/api/hydria/confirm-workspace-action`;
async function confirm(token, userId = user.id) {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, confirmationToken: token }) });
}
try {
  const pending = await propose(); assert.equal(pending.status, "needs_confirmation");
  assert.equal((await confirm(pending.confirmationToken, other.id)).status, 403);
  assert.equal((await confirm(pending.confirmationToken + "tampered")).status, 403);
  const allowed = await confirm(pending.confirmationToken); assert.equal(allowed.status, 200, await allowed.clone().text());
  assert.equal((await allowed.json()).workspaceToolResults[0].status, "completed");
  assert.equal(JSON.parse(service.readContent({ workObjectId: sheet.id }).content).sheets[0].rows.length, 1);
  assert.equal((await confirm(pending.confirmationToken)).status, 409);
  const stale = await propose();
  await service.updateContent({ workObjectId: sheet.id, actorUserId: user.id, content: service.readContent({ workObjectId: sheet.id }).content });
  assert.equal((await confirm(stale.confirmationToken)).status, 409);
  console.log("Workspace consent HTTP gate passed: approval, profile binding, tampering, replay, stale revision and persisted result.");
} finally { await new Promise(resolve => server.close(resolve)); closeDatabase(); fs.rmSync(temp, { recursive: true, force: true }); }
