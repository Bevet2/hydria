import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import { listPublicWorkspaceFamilies } from "../src/workspaces/workspaceRegistry.js";
import {
  WORKSPACE_PAGES,
  resolveWorkspacePageForWorkObject,
  parseWorkspacePagePath
} from "../../frontend/components/workspaceSurfaceRegistry.js";

const newPages = [
  ["projects", "project_management", "workflow", "workflow.json"],
  ["knowledge", "document_knowledge", "document", "document.html"],
  ["forms", "app_builder", "project", "index.html"],
  ["video", "media", "video", "timeline.json"],
  ["audio", "audio", "audio", "session.json"],
  ["3d", "cad_3d", "design", "scene.json"],
  ["gis", "geospatial", "dataset", "features.geojson"],
  ["erp", "operations", "dataset", "table.csv"],
  ["sites", "web_cms", "project", "index.html"],
  ["integrations", "integration_api", "workflow", "workflow.json"],
  ["qa", "testing_qa", "dataset", "table.csv"]
];

const routeSlugs = WORKSPACE_PAGES.map(({ slug }) => slug);
assert.equal(new Set(routeSlugs).size, routeSlugs.length, "Workspace URLs must be unique");
const families = new Set(listPublicWorkspaceFamilies().map(({ id }) => id));
for (const [slug, family, kind] of newPages) {
  const page = WORKSPACE_PAGES.find((item) => item.slug === slug);
  assert.ok(page, `${slug} has a navigable workspace page`);
  assert.equal(page.family, family);
  assert.equal(page.kind, kind);
  assert.ok(families.has(family), `${slug} family must be registered server-side`);
  assert.equal(parseWorkspacePagePath(`/workspace/${slug}`)?.slug, slug);
}

// Legacy objects must keep their old editor instead of being reassigned to a
// newly added page that happens to share a backend family.
assert.equal(resolveWorkspacePageForWorkObject({ kind: "document", workspaceFamilyId: "document_knowledge" })?.slug, "docs");
assert.equal(resolveWorkspacePageForWorkObject({ kind: "project", workspaceFamilyId: "app_builder" })?.slug, "app-builder");
assert.equal(resolveWorkspacePageForWorkObject({ kind: "workflow" })?.slug, "automation");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "hydria-suite-gate-"));
try {
  const service = new WorkObjectService({
    filePath: path.join(temp, "library.json"),
    rootDir: path.join(temp, "objects")
  });
  for (const [slug, family, kind, expectedFile] of newPages) {
    const created = service.createBlankWorkObject({
      kind,
      title: `Test ${slug}`,
      userId: 4,
      workspaceFamilyId: family,
      metadata: { workspacePageSlug: slug }
    });
    const opened = service.get(created.id, { includeContent: true });
    assert.equal(opened.primaryFile, expectedFile, `${slug} must not reuse a generic unrelated template`);
    assert.ok(opened.file.content.trim().length > 10, `${slug} must have editable initial content`);
    assert.equal(resolveWorkspacePageForWorkObject(opened)?.slug, slug, `${slug} must reopen in its original workspace`);
    assert.equal(opened.userId, 4, "Ownership must be persisted");
  }
  assert.equal(service.listForConversation({ userId: 4 }).length, newPages.length);
  assert.equal(service.listForConversation({ userId: 5 }).length, 0);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log(`Suite expansion verified: ${newPages.length} routes, persisted starter projects and legacy routing.`);
