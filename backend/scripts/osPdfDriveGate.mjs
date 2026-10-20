import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import { filterDriveObjects } from "../../frontend/components/hydriaDriveWorkspace.js";
import { resolveWorkspacePageForWorkObject } from "../../frontend/components/workspaceSurfaceRegistry.js";

const root = await mkdtemp(path.join(os.tmpdir(), "hydria-pdf-drive-"));
const filePath = path.join(root, "store.json");
const assets = path.join(root, "objects");
const one = Buffer.from("%PDF-1.4\n1 0 obj\nendobj\n%%EOF\n", "ascii");
const two = Buffer.from("%PDF-1.5\n2 0 obj\nendobj\n%%EOF\n", "ascii");
try {
  const service = new WorkObjectService({ filePath, rootDir: assets });
  assert.throws(() => service.savePdfBinary({ buffer: one, actorUserId: 0 }), /valid user/);
  assert.throws(() => service.savePdfBinary({
    buffer: Buffer.from("not PDF %%EOF"), actorUserId: 1
  }), /Invalid PDF/);
  const created = service.savePdfBinary({
    buffer: one, actorUserId: 1, title: "Projet financier", conversationId: 3
  });
  assert.equal(created.kind, "pdf");
  assert.equal(created.revision, 1);
  assert.equal(created.userId, 1);
  assert.equal(created.entries[0].contentType, "application/pdf");
  assert.equal(created.primaryFile, "document.pdf");
  assert.equal(resolveWorkspacePageForWorkObject(created)?.slug, "pdf");
  assert.deepEqual(filterDriveObjects([created], { kind: "pdf" }).map(x => x.id), [created.id]);
  assert.equal(service.listForConversation({ userId: 1 }).length, 1);
  assert.equal(service.listForConversation({ userId: 2 }).length, 0);
  const file = service.readPdfBinary({ workObjectId: created.id, actorUserId: 1 });
  assert.deepEqual(fs.readFileSync(file.filePath), one);
  assert.throws(() => service.readPdfBinary({ workObjectId: created.id, actorUserId: 2 }), /permission/);
  assert.throws(() => service.savePdfBinary({
    buffer: two, actorUserId: 2, workObjectId: created.id, expectedRevision: 1
  }), /permission/);
  assert.throws(() => service.savePdfBinary({
    buffer: two, actorUserId: 1, workObjectId: created.id
  }), /changed/);
  const updated = service.savePdfBinary({
    buffer: two, actorUserId: 1, workObjectId: created.id, expectedRevision: 1
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.history.at(-1).type, "pdf_update");
  assert.deepEqual(fs.readFileSync(
    path.join(service.store.get(created.id).workspacePath,
      updated.history.at(-1).pdfSnapshotPath)
  ), one);
  assert.deepEqual(fs.readFileSync(service.readPdfBinary({
    workObjectId: created.id, actorUserId: 1
  }).filePath), two);
  assert.throws(() => service.savePdfBinary({
    buffer: one, actorUserId: 1, workObjectId: created.id, expectedRevision: 1
  }), /changed/);
  // Persistence survives a new service instance (no ephemeral UI-only records).
  const reopened = new WorkObjectService({ filePath, rootDir: assets });
  assert.equal(reopened.listForConversation({ userId: 1 })[0].revision, 2);
  assert.deepEqual(fs.readFileSync(reopened.readPdfBinary({
    workObjectId: created.id, actorUserId: 1
  }).filePath), two);
  console.log("Hydria PDF Drive: create, private read, revision conflict, snapshot, persistence verified.");
} finally {
  await rm(root, { recursive: true, force: true });
}
