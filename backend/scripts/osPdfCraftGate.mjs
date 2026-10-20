import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFCRAFT_SHA256, PDFCRAFT_VERSION, unpackPdfCraftArchive } from "./installPdfCraft.mjs";
import { pdfCraftFrameUrl } from "../../frontend/components/pdfCraftWorkbench.js";
import { parseWorkspacePagePath, workspacePageFromSlug } from "../../frontend/components/workspaceSurfaceRegistry.js";

assert.equal(PDFCRAFT_VERSION, "0.9.0");
assert.match(PDFCRAFT_SHA256, /^[a-f0-9]{64}$/);
assert.equal(pdfCraftFrameUrl(), "/vendor/pdfcraft/index.html?host=parent");
assert.equal(
  pdfCraftFrameUrl("blob:https://hydria.example/abc-123"),
  "/vendor/pdfcraft/index.html?host=parent&file=blob%3Ahttps%3A%2F%2Fhydria.example%2Fabc-123"
);
assert.throws(() => pdfCraftFrameUrl("https://evil.example/document.pdf"));
assert.equal(workspacePageFromSlug("pdf")?.kind, "virtual");
assert.equal(parseWorkspacePagePath("/workspace/pdf")?.slug, "pdf");

const zip = new AdmZip();
zip.addFile("pdfcraft-web-0.9.0/index.html", Buffer.from("<!doctype html><title>PdfCraft</title>"));
zip.addFile("pdfcraft-web-0.9.0/test_bg.wasm", Buffer.from([0,97,115,109,1,0,0,0]));
zip.addFile("pdfcraft-web-0.9.0/test.js", Buffer.from("export default 'ok';"));
const directory = await mkdtemp(path.join(os.tmpdir(), "hydria-pdfcraft-test-"));
try {
  const result = await unpackPdfCraftArchive(zip.toBuffer(), directory);
  assert.equal(result.files, 3);
  assert.match((await readFile(path.join(directory, "index.html"), "utf8")), /PdfCraft/);
  assert.equal((await readFile(path.join(directory, "test_bg.wasm"))).length, 8);
  await rm(path.join(directory, "index.html"), { force: true });
  const bad = new AdmZip();
  bad.addFile("fake/index.html", Buffer.from("test"));
  await assert.rejects(unpackPdfCraftArchive(bad.toBuffer(), directory), /Incomplete/);
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log("Hydria PDF Studio route, Blob handoff, pinned installer and archive validation passed.");
