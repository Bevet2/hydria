import assert from "node:assert/strict";
import { filterDriveObjects } from "../../frontend/components/hydriaDriveWorkspace.js";
import {
  parseWorkspacePagePath,
  workspacePageFromSlug,
  workspacePagePath,
  resolveWorkspacePageForWorkObject
} from "../../frontend/components/workspaceSurfaceRegistry.js";

const items = [
  { id: "doc-1", kind: "document", title: "Compte rendu", primaryFile: "notes/projet.md", revision: 3, updatedAt: "2026-10-01T10:00:00Z" },
  { id: "sheet-1", objectKind: "dataset", title: "Budget", primaryFile: "compta/2026.xlsx", updated_at: "2026-10-19T10:00:00Z" },
  { id: "code-1", kind: "code", title: "Application", editableFiles: ["frontend/main.ts"], updatedAt: "2026-09-20T10:00:00Z" },
  { id: "photo-1", kind: "image", title: "Visuel", updatedAt: "2026-10-15T10:00:00Z" },
  { id: "pdf-1", kind: "other", title: "<img src=x onerror=alert(1)>", updatedAt: "2026-10-15T10:00:00Z" }
];
assert.deepEqual(filterDriveObjects(items).map(x => x.id), ["sheet-1", "pdf-1", "photo-1", "doc-1", "code-1"]);
// Explicit expected recent order with name tie-break, not relying on input order.
assert.deepEqual(filterDriveObjects(items, {sort:"name"}).map(x=>x.id), ["pdf-1","code-1","sheet-1","doc-1","photo-1"]);
assert.deepEqual(filterDriveObjects(items, {kind:"document"}).map(x=>x.id), ["doc-1"]);
assert.deepEqual(filterDriveObjects(items, {kind:"other"}).map(x=>x.id), ["pdf-1","photo-1"]);
assert.deepEqual(filterDriveObjects(items, {query:"2026.xlsx"}).map(x=>x.id), ["sheet-1"]);
assert.deepEqual(filterDriveObjects(items, {query:"frontend/main.ts"}).map(x=>x.id), ["code-1"]);
assert.deepEqual(filterDriveObjects(items, {query:"PROJET"}).map(x=>x.id), ["doc-1"]);
assert.deepEqual(filterDriveObjects(items, {kind:"dataset",query:"inconnu"}), []);
assert.deepEqual(filterDriveObjects(null), []);
const drive = workspacePageFromSlug("drive");
assert.equal(drive?.kind,"virtual");
assert.equal(workspacePagePath(drive),"/workspace/drive");
assert.equal(parseWorkspacePagePath("/workspace/drive")?.slug,"drive");
assert.equal(parseWorkspacePagePath("/workspace/%E0%A4%A"),null);
assert.equal(parseWorkspacePagePath("/workspace/does-not-exist"),null);
assert.equal(resolveWorkspacePageForWorkObject(items[0])?.slug,"docs");
assert.equal(resolveWorkspacePageForWorkObject(items[1])?.slug,"sheets");
console.log("Hydria Drive filtering, native routing, and malformed URL handling passed.");
