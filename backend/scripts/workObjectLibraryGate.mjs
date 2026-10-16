import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import { suggestDuplicateFilePath } from "../../frontend/components/workspaceFileExplorer.js";

assert.equal(suggestDuplicateFilePath("reports/summary.md",["reports/summary.md"]),"reports/summary-copy.md");
assert.equal(suggestDuplicateFilePath("README",["README","README-copy"]),"README-copy-2");
assert.equal(suggestDuplicateFilePath("Folder/DATA.CSV",["folder/data.csv","folder/data-copy.csv"]),"Folder/DATA-copy-2.CSV");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "hydria-library-gate-"));

try {
  const service = new WorkObjectService({
    filePath: path.join(root, "store.json"),
    rootDir: path.join(root, "objects")
  });
  const first = service.createBlankWorkObject({
    kind: "project",
    title: "First project",
    userId: 1,
    conversationId: 10
  });
  service.createBlankWorkObject({
    kind: "project",
    title: "Second project",
    userId: 1,
    conversationId: 20
  });
  service.createBlankWorkObject({
    kind: "project",
    title: "Other user",
    userId: 2,
    conversationId: 10
  });

  assert.equal(
    service.listForConversation({ userId: 1 }).length,
    2,
    "The user library must span conversations without leaking other users"
  );
  assert.equal(
    service.listForConversation({ userId: 1, conversationId: 10 }).length,
    1,
    "Conversation filtering must remain available"
  );
  const favorite = service.updateMetadata({
    workObjectId: first.id,
    metadata: { favorite: true }
  });
  assert.equal(favorite.metadata.favorite, true);
  const archived = service.updateMetadata({
    workObjectId: first.id,
    status: "archived"
  });
  assert.equal(archived.status, "archived");
  service.updateMetadata({ workObjectId: first.id, status: "ready" });

  const initial = service.get(first.id, { includeContent: true });
  await service.updateContent({
    workObjectId: first.id,
    entryPath: initial.file.path,
    content: "updated content",
    note: "library gate"
  });
  const history = service.listHistory(first.id);
  const restorable = history.find((entry) => entry.restorable);
  assert.ok(restorable, "Content updates must create a restorable snapshot");

  const restored = await service.restoreHistory({
    workObjectId: first.id,
    historyId: restorable.id
  });
  assert.equal(restored.file.content, initial.file.content);
  assert.equal(restored.revision, initial.revision + 2);

  // Physical file moves must update disk, metadata, active paths and search.
  const beforeMove = service.get(first.id, { includeContent: true });
  const oldFile = beforeMove.file.path;
  const movedPath = "renamed-folder/project-notes.md";
  const moved = service.moveFile({
    workObjectId: first.id,
    from: oldFile,
    to: movedPath,
    actorUserId: 1,
    expectedRevision: beforeMove.revision
  });
  assert.equal(moved.primaryFile, movedPath);
  assert.equal(service.get(first.id, { includeContent: true }).file.content, initial.file.content);
  assert.ok(service.get(first.id).entries.some((entry) => entry.path === movedPath));
  await assert.rejects(
    Promise.resolve().then(() => service.moveFile({
      workObjectId: first.id, from: movedPath, to: "../outside.md", actorUserId: 1
    })),
    (error) => error.statusCode === 400
  );
  assert.throws(() => service.moveFile({
    workObjectId: first.id, from: movedPath, to: "conflict.md",
    actorUserId: 1, expectedRevision: beforeMove.revision
  }), (error) => error.statusCode === 409);
  assert.throws(() => service.moveFile({
    workObjectId: first.id, from: movedPath, to: "other.md", actorUserId: 2
  }), (error) => error.statusCode === 403);
  assert.ok(service.listHistory(first.id).some((item) => item.type === "file_move"));

  const beforeCreate = service.get(first.id);
  const createdFile = service.createFile({
    workObjectId: first.id,
    entryPath: "reports/summary.md",
    content: "# New report",
    actorUserId: 1,
    expectedRevision: beforeCreate.revision
  });
  assert.equal(createdFile.file.path,"reports/summary.md");
  assert.equal(createdFile.file.content,"# New report");
  assert.ok(fs.existsSync(path.join(createdFile.workspacePath,"reports","summary.md")));
  assert.throws(
    () => service.createFile({ workObjectId:first.id,entryPath:"reports/summary.md",actorUserId:1 }),
    (error) => error.statusCode === 409
  );
  assert.throws(
    () => service.createFile({ workObjectId:first.id,entryPath:"../forbidden.md",actorUserId:1 }),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => service.createFile({ workObjectId:first.id,entryPath:"reports/other.md",actorUserId:2 }),
    (error) => error.statusCode === 403
  );
  assert.ok(service.listHistory(first.id).some((item) => item.type === "file_create"));
  // The UI duplication action uses readContent + the existing authorized,
  // revision-checked createFile operation, not a raw filesystem copy.
  const sourceText = service.readContent({workObjectId:first.id,entryPath:"reports/summary.md"}).content;
  const duplicated = service.createFile({
    workObjectId:first.id,entryPath:"reports/summary-copy.md",
    content:sourceText,actorUserId:1,
    expectedRevision:service.get(first.id).revision
  });
  assert.equal(duplicated.file.content,"# New report");
  assert.equal(fs.readFileSync(path.join(duplicated.workspacePath,"reports","summary-copy.md"),"utf8"),"# New report");
  assert.throws(() => service.createFile({
    workObjectId:first.id,entryPath:"reports/summary-copy.md",content:sourceText,actorUserId:1
  }), error => error.statusCode === 409);

  const searchResults = service.searchContent({
    userId: 1,
    query: "App builder workspace"
  });
  assert.ok(searchResults.some((result) => result.id === first.id));

  const shared = service.updateSharing({
    workObjectId: first.id,
    actorUserId: 1,
    visibility: "link",
    defaultRole: "commenter",
    shares: [{ userId: 2, role: "editor" }]
  });
  assert.equal(shared.metadata.sharing.visibility, "link");
  assert.ok(service.getSharedByToken(shared.metadata.sharing.shareToken));
  assert.ok(
    service.listForConversation({ userId: 2 }).some((item) => item.id === first.id),
    "Directly shared work objects must appear in the recipient library"
  );

  const annotated = service.updateAnnotations({
    workObjectId: first.id,
    actorUserId: 2,
    annotations: [{ type: "comment", body: "@owner check this" }]
  });
  assert.equal(annotated.metadata.annotations.length, 1);
  assert.equal(
    service.touchPresence({
      workObjectId: first.id,
      actorUserId: 2,
      name: "Collaborator"
    }).length,
    1
  );

  const beforeConflict = service.get(first.id, { includeContent: true });
  await assert.rejects(
    service.updateContent({
      workObjectId: first.id,
      entryPath: beforeConflict.file.path,
      content: "stale update",
      actorUserId: 2,
      expectedRevision: beforeConflict.revision - 1
    }),
    (error) => error.statusCode === 409
  );

  const trashable = service.createBlankWorkObject({
    kind: "document",
    title: "Delete me",
    userId: 1
  });
  assert.equal(
    service.trash({ workObjectId: trashable.id, actorUserId: 1 }).status,
    "trashed"
  );
  assert.equal(
    service.restoreFromTrash({ workObjectId: trashable.id, actorUserId: 1 }).status,
    "ready"
  );
  service.trash({ workObjectId: trashable.id, actorUserId: 1 });
  assert.equal(
    service.deletePermanently({ workObjectId: trashable.id, actorUserId: 1 }).id,
    trashable.id
  );

  console.log(
    JSON.stringify({
      success: true,
      libraryObjects: 2,
      historyEntries: history.length,
      restoredRevision: restored.revision,
      shared: true,
      conflictProtected: true,
      trashLifecycle: true
    })
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
