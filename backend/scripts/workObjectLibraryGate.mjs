import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WorkObjectService from "../src/work-objects/workObject.service.js";

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
