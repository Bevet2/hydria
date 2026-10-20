/**
 * Install verified upstream ArtCraft web builds without committing WASM bundles.
 * Private-pilot deployment: node backend/scripts/installArtCraftWeb.mjs photo
 *                       or: node backend/scripts/installArtCraftWeb.mjs fig
 *
 * Sources are immutable GitHub releases. We verify exact SHA256 and reuse the
 * hardened archive extraction routine from the existing PdfCraft installer.
 */
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unpackPdfCraftArchive } from "./installPdfCraft.mjs";

export const ARTCRAFT_WEB_RELEASES = Object.freeze({
  photo: Object.freeze({
    product: "PhotoCraft",
    version: "0.10.0",
    archiveUrl: "https://github.com/storytold/photocraft/releases/download/v0.10.0/photocraft-web-0.10.0.zip",
    sha256: "b121472d1cdc2f24530b8239c4f32843afdbc1da994244e98a2ce4835b410590",
    folder: "photocraft",
    requiredFiles: ["index.html", "app/parts.txt", "app/photocraft-web.js"]
  }),
  fig: Object.freeze({
    product: "FigCraft",
    version: "0.7.0",
    archiveUrl: "https://github.com/storytold/figcraft/releases/download/v0.7.0/figcraft-web-0.7.0.zip",
    sha256: "05cb2e373275a3c19d62757d6e50e6ba28dab232c07f91f5d1e1d5d83ad0b262",
    folder: "figcraft",
    requiredFiles: ["index.html"]
  })
});

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const MAX_ZIP_BYTES = 30 * 1024 * 1024;

export async function validateArtCraftBuild(which, staging) {
  const release = ARTCRAFT_WEB_RELEASES[which];
  if (!release) throw Error("Unknown ArtCraft product");
  for (const required of release.requiredFiles) {
    const file = path.join(staging, required);
    if (!(await stat(file)).isFile()) throw Error("Missing ArtCraft web asset: " + required);
  }
  if (which === "photo") {
    const lines = (await readFile(path.join(staging, "app", "parts.txt"), "utf8"))
      .split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
    if (lines[0] !== "photocraft-parts 1") throw Error("Unsupported PhotoCraft parts manifest");
    const parts = lines.slice(1);
    if (!parts.length || parts.some(part =>
      !/^[A-Za-z0-9._-]+\.part-[A-Za-z0-9_-]+$/.test(part)
    )) throw Error("Unexpected PhotoCraft WASM parts manifest");
    for (const part of parts) {
      const asset = path.join(staging, "app", part);
      if (!(await stat(asset)).isFile()) throw Error("Missing PhotoCraft WASM part: " + part);
    }
  } else {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(staging);
    if (!entries.some(name => /^figcraft-web-.*_bg\.wasm$/.test(name))) {
      throw Error("FigCraft distribution missing WASM");
    }
  }
  return true;
}

export async function installArtCraftWeb(which, {
  fetchImpl = fetch,
  target
} = {}) {
  const release = ARTCRAFT_WEB_RELEASES[which];
  if (!release) throw Error("Unknown ArtCraft product: use photo or fig");
  const dest = target || path.join(repoRoot, "frontend", "vendor", release.folder);
  const response = await fetchImpl(release.archiveUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000)
  });
  if (!response.ok) throw Error("ArtCraft download failed (HTTP " + response.status + ")");
  const hintedSize = Number(response.headers.get("content-length") || 0);
  if (hintedSize > MAX_ZIP_BYTES) throw Error("ArtCraft release exceeds maximum archive size");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_ZIP_BYTES) throw Error("ArtCraft release exceeds maximum archive size");
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== release.sha256) throw Error("ArtCraft release checksum mismatch");

  await mkdir(path.dirname(dest), { recursive: true });
  const staging = await mkdtemp(path.join(path.dirname(dest), "." + release.folder + "-stage-"));
  const backup = dest + ".old";
  let previousMoved = false;
  try {
    const unpacked = await unpackPdfCraftArchive(bytes, staging);
    await validateArtCraftBuild(which, staging);
    await rm(backup, { force: true, recursive: true });
    try {
      if ((await stat(dest)).isDirectory()) {
        await rename(dest, backup);
        previousMoved = true;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rename(staging, dest);
    await rm(backup, { force: true, recursive: true });
    return { product: release.product, version: release.version, digest: hash, ...unpacked, target: dest };
  } catch (error) {
    if (previousMoved) {
      await rm(dest, { recursive: true, force: true });
      await rename(backup, dest);
    }
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installArtCraftWeb(process.argv[2])
    .then((r) => console.log(r.product + " " + r.version + ": " + r.files + " files installed into " + r.target))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
