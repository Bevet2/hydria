import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import ProjectStore from "../src/projects/project.store.js";
import ProjectWorkspaceService from "../src/projects/projectWorkspaceService.js";

const root = mkdtempSync(path.join(os.tmpdir(), "hydria-project-isolation-"));
try {
  const objects = new WorkObjectService({
    filePath: path.join(root, "objects.json"),
    rootDir: path.join(root, "objects")
  });
  const projects = new ProjectStore({ filePath: path.join(root, "projects.json") });
  const navigator = new ProjectWorkspaceService({ projectStore: projects, workObjectService: objects });
  const project = await projects.ensureProject({ name: "Private 2026", metadata: { userId: 1 } });
  const sameNameOtherOwner = await projects.ensureProject({ name: "Private 2026", metadata: { userId: 2 } });
  assert.notEqual(sameNameOtherOwner.id, project.id,
    "Two distinct account owners must not silently share a project because of its name");
  const repeatedOwner = await projects.ensureProject({ name: "Private 2026", metadata: { userId: 1 } });
  assert.equal(repeatedOwner.id, project.id, "The same owner can resume a named project");
  const privateDocument = objects.createBlankWorkObject({
    kind: "document", title: "Private payroll", userId: 1, projectId: project.id
  });
  const sharedDocument = objects.createBlankWorkObject({
    kind: "document", title: "Shared project brief", userId: 1, projectId: project.id
  });

  // This failed before the fix: listForProject returned every unscoped object
  // whenever the requesting user owned no object in that project.
  assert.deepEqual(objects.listForProject({ projectId: project.id, userId: 3 }), [],
    "An unrelated account cannot enumerate another account's project");
  assert.equal(navigator.getWorkspace(project.id, { userId: 3 }), null,
    "An unrelated account cannot retrieve the project navigator or its metadata");
  assert.deepEqual(objects.listForProject({ projectId: project.id, userId: 2 }), [],
    "An account without an explicit share has no project access");
  for (const invalidUserId of [0, -1, NaN, "invalid", "", "01", true]) {
    assert.deepEqual(objects.listForProject({ projectId: project.id, userId: invalidUserId }), [],
      "Invalid project actor IDs must not trigger anonymous administrative listing");
    assert.deepEqual(objects.listForConversation({ userId: invalidUserId }), [],
      "Invalid library actor IDs must not expose the entire library");
    assert.deepEqual(objects.searchContent({ userId: invalidUserId, query: "payroll" }), [],
      "Invalid search actor IDs must not expose private file content");
    assert.equal(navigator.getWorkspace(project.id, { userId: invalidUserId }), null,
      "Invalid actor IDs must not obtain full project navigator metadata");
    assert.deepEqual(navigator.listProjects({ userId: invalidUserId }), [],
      "Invalid actor IDs must not list all projects");
    assert.deepEqual(projects.listProjects({ userId: invalidUserId }), [],
      "The project store itself must not treat invalid actor IDs as an unrestricted lookup");
  }

  objects.updateSharing({
    workObjectId: sharedDocument.id, actorUserId: 1, visibility: "private",
    shares: [{ userId: 2, role: "viewer" }]
  });
  assert.deepEqual(objects.listForProject({ projectId: project.id, userId: 2 }).map(x => x.id),
    [sharedDocument.id], "A collaborator only sees the object explicitly shared with them");
  assert.deepEqual(navigator.getWorkspace(project.id, { userId: 2 })?.workObjects.map(x => x.id),
    [sharedDocument.id], "The navigator must not add private objects back");
  assert.equal(objects.listForProject({ projectId: project.id, userId: 2, limit: 1 })[0]?.id,
    sharedDocument.id, "Pagination must be applied after access filtering");
  assert.deepEqual(new Set(objects.listForProject({ projectId: project.id, userId: 1 }).map(x => x.id)),
    new Set([privateDocument.id, sharedDocument.id]), "The owner retains both project documents");
  assert.equal(objects.listForProject({ projectId: project.id }).length, 2,
    "The existing single-owner internal lookup remains available");
  console.log("Hydria project isolation: unshared projects denied; explicit shares filtered; legacy internal lookup preserved.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
