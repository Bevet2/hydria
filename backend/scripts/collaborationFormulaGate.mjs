import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { calculateWorkbook } from "../services/sheets/formulaEngine.js";
import WorkObjectCollaborationService from "../src/work-objects/workObjectCollaboration.service.js";
import WorkObjectService from "../src/work-objects/workObject.service.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "hydria-collaboration-gate-"));

try {
  const workObjectService = new WorkObjectService({
    filePath: path.join(root, "store.json"),
    rootDir: path.join(root, "objects")
  });
  const collaboration = new WorkObjectCollaborationService({ workObjectService });
  const document = workObjectService.createBlankWorkObject({
    kind: "document",
    title: "Collaborative document",
    userId: 1,
    workspaceFamilyId: "document_knowledge"
  });
  const initialDocument = workObjectService.get(document.id, { includeContent: true });
  const initialText = initialDocument.file.content;
  const first = collaboration.apply({
    workObjectId: document.id,
    entryPath: initialDocument.file.path,
    actorUserId: 1,
    clientId: "client-a",
    baseVersion: 0,
    operation: {
      id: "operation-a",
      kind: "text.splice",
      index: initialText.length,
      deleteCount: 0,
      insert: "\nAlice"
    }
  });
  const second = collaboration.apply({
    workObjectId: document.id,
    entryPath: initialDocument.file.path,
    actorUserId: 1,
    clientId: "client-b",
    baseVersion: 0,
    operation: {
      id: "operation-b",
      kind: "text.splice",
      index: initialText.length,
      deleteCount: 0,
      insert: "\nBob"
    }
  });
  assert.equal(first.version, 1);
  assert.equal(second.version, 2);
  assert.match(second.content, /Alice/);
  assert.match(second.content, /Bob/);
  const duplicate = collaboration.apply({
    workObjectId: document.id,
    entryPath: initialDocument.file.path,
    actorUserId: 1,
    clientId: "client-b",
    baseVersion: 0,
    operation: {
      id: "operation-b",
      kind: "text.splice",
      index: initialText.length,
      deleteCount: 0,
      insert: "\nBob"
    }
  });
  assert.equal(duplicate.version, 2, "Operation retries must be idempotent");
  const flushed = await collaboration.flush({
    workObjectId: document.id,
    entryPath: initialDocument.file.path
  });
  assert.equal(flushed.workObject.revision, initialDocument.revision + 1);
  const persisted = workObjectService.get(document.id, { includeContent: true });
  assert.match(persisted.file.content, /Alice/);
  assert.match(persisted.file.content, /Bob/);

  const workbook = {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: "sheet-1",
    sheets: [{
      id: "sheet-1",
      name: "Sheet 1",
      columns: ["A", "B", "Total"],
      rows: [
        ["10", "0.5", "=A2+B2"],
        ["1", "2", "=SUM(A2:B3)"],
        ["=B4", "=A4", ""]
      ]
    }]
  };
  const calculation = calculateWorkbook({ model: workbook });
  assert.equal(calculation.formulaValues["sheet-1"]["1:2"], 10.5);
  assert.equal(calculation.formulaValues["sheet-1"]["2:2"], 13.5);
  assert.equal(calculation.formulaValues["sheet-1"]["3:0"], "#CYCLE!");
  workbook.sheets[0].rows[0][0] = "20";
  const incremental = calculateWorkbook({
    model: workbook,
    engineId: calculation.engineId
  });
  assert.equal(incremental.formulaValues["sheet-1"]["1:2"], 20.5);
  assert.equal(incremental.formulaValues["sheet-1"]["2:2"], 23.5);

  console.log(JSON.stringify({
    success: true,
    collaborationVersion: duplicate.version,
    persistedRevision: flushed.workObject.revision,
    formulaCount: incremental.formulaCount,
    circularReferences: incremental.errors.length
  }));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
