import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ARTCRAFT_WEB_RELEASES, installArtCraftWeb, validateArtCraftBuild } from "./installArtCraftWeb.mjs";
import { unpackPdfCraftArchive } from "./installPdfCraft.mjs";
import { ARTCRAFT_EDITORS, artCraftWebPath } from "../../frontend/components/artCraftWorkspaces.js";
import { workspacePageFromSlug, parseWorkspacePagePath } from "../../frontend/components/workspaceSurfaceRegistry.js";
import { detectRasterFormat, safeImageFilename } from "../routes/driveImageAssets.js";

for (const [key,slug,folder] of [["photo","photo","photocraft"],["fig","fig","figcraft"]]) {
  assert.equal(workspacePageFromSlug(slug)?.kind, "virtual");
  assert.equal(parseWorkspacePagePath("/workspace/" + slug)?.slug, slug);
  assert.equal(ARTCRAFT_EDITORS[key].path, "/vendor/" + folder + "/index.html");
  assert.equal(artCraftWebPath(key), "/vendor/" + folder + "/index.html");
  assert.match(ARTCRAFT_WEB_RELEASES[key].sha256, /^[0-9a-f]{64}$/);
  assert.ok(ARTCRAFT_WEB_RELEASES[key].archiveUrl.startsWith("https://github.com/storytold/"));
}
assert.throws(() => artCraftWebPath("unknown"), /Unknown/);
await assert.rejects(installArtCraftWeb("fake"), /Unknown/);
await assert.rejects(
  installArtCraftWeb("photo", { fetchImpl: async () => new Response("not a distribution", { status: 200 }) }),
  /checksum mismatch/
);

// Exercise the real ZIP extractor and the two upstream asset layout contracts.
const root = await mkdtemp(path.join(tmpdir(), "hydria-artcraft-build-check-"));
try {
  for (const name of ["photo","fig"]) {
    const zip = new AdmZip();
    const prefix = name === "photo" ? "photocraft-web-0.11.1/" : "figcraft-web-0.8.0/";
    zip.addFile(prefix + "index.html", Buffer.from("<!doctype html><title>ArtCraft</title>"));
    const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
    if (name === "photo") {
      zip.addFile(prefix + "photocraft-web-boot-test_bg.wasm", wasm);
      zip.addFile(prefix + "app/photocraft-web.js", Buffer.from("export const init = 1;"));
      zip.addFile(prefix + "app/parts.txt", Buffer.from("photocraft-parts 1\nphotocraft-web-test.part-aa\n"));
      zip.addFile(prefix + "app/photocraft-web-test.part-aa", Buffer.from("gzip-mock"));
    } else {
      zip.addFile(prefix + "figcraft-web-test_bg.wasm", wasm);
    }
    const dest = path.join(root, name);
    await mkdir(dest);
    const result = await unpackPdfCraftArchive(zip.toBuffer(), dest);
    assert.ok(result.files >= 2);
    assert.equal(await validateArtCraftBuild(name, dest), true);
    assert.match(await readFile(path.join(dest,"index.html"),"utf8"), /ArtCraft/);
    if (name === "photo") {
      await writeFile(path.join(dest,"app","parts.txt"),"photocraft-parts 1\n../unsafe.part-aa\n");
      await assert.rejects(validateArtCraftBuild("photo",dest), /Unexpected PhotoCraft/);
    } else {
      await rm(path.join(dest,"figcraft-web-test_bg.wasm"));
      await assert.rejects(validateArtCraftBuild("fig",dest), /missing WASM/);
    }
  }
} finally { await rm(root,{recursive:true,force:true}); }

// Browser image preview remains constrained to raster types (no SVG/HTML).
const png = Buffer.concat([
  Buffer.from("89504e470d0a1a0a", "hex"),
  Buffer.alloc(4), Buffer.from("IHDR"), Buffer.alloc(16),
  Buffer.from("0000000049454e44", "hex"), Buffer.alloc(4)
]);
assert.equal(detectRasterFormat(png)?.mime,"image/png");
const jpeg = Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(16),Buffer.from([0xff,0xd9])]);
assert.equal(detectRasterFormat(jpeg)?.mime,"image/jpeg");
const webp = Buffer.alloc(24);webp.write("RIFF",0);webp.writeUInt32LE(16,4);webp.write("WEBP",8);
assert.equal(detectRasterFormat(webp)?.mime,"image/webp");
assert.equal(detectRasterFormat(Buffer.from("<svg><script>test</script></svg>")),null);
assert.equal(safeImageFilename("../../photo.svg",".png"),".._.._photo.svg.png");
console.log("ArtCraft registry, release contracts, ZIP validator and raster type checks passed.");
