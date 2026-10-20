/**
 * Install an unmodified, pinned PdfCraft WebAssembly release for Hydria OS.
 * Run from repository root: node backend/scripts/installPdfCraft.mjs
 * Requires npm ci --prefix backend. The third-party archive is NOT committed.
 *
 * Source: https://github.com/storytold/pdfcraft/releases/tag/v0.9.0
 * Upstream dual licence MIT/Apache-2.0; see NOTICE and attribution upstream.
 */
import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PDFCRAFT_VERSION = "0.9.0";
export const PDFCRAFT_URL =
  "https://github.com/storytold/pdfcraft/releases/download/v0.9.0/pdfcraft-web-0.9.0.zip";
export const PDFCRAFT_SHA256 =
  "eb465508b0623be27b07ef5145c0670c71ddd7791b4541721358b59c7e0a722e";

const maxCompressedBytes = 30 * 1024 * 1024;
const maxExtractedBytes = 85 * 1024 * 1024;
// The pinned v0.9.0 WASM is 38,987,023 bytes (about 37.2 MiB).
const maxSingleBytes = 45 * 1024 * 1024;
const maxEntries = 200;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const destination = path.join(rootDir, "frontend", "vendor", "pdfcraft");

export async function unpackPdfCraftArchive(archive, outputDir) {
  const entries = new AdmZip(archive).getEntries();
  if (!entries.length || entries.length > maxEntries) throw Error("Unexpected archive entry count");
  const index = entries.find((entry) => !entry.isDirectory &&
    /(^|\/)index\.html$/.test(entry.entryName.replaceAll("\\", "/")));
  if (!index) throw Error("PdfCraft archive lacks index.html");
  const root = index.entryName.replaceAll("\\", "/").slice(0, -"index.html".length);
  let total = 0;
  const written = new Set();
  for (const entry of entries) {
    const raw = entry.entryName.replaceAll("\\", "/");
    if (!raw.startsWith(root)) throw Error("Unrecognized archive root");
    const relative = raw.slice(root.length);
    if (!relative) continue;
    const parts = relative.split("/");
    if (parts.some((part) => part === ".." || part === "." || part.includes("\0"))) {
      throw Error("Unsafe path in release archive");
    }
    if (relative.startsWith("/") || /^[A-Za-z]:/.test(relative)) throw Error("Absolute archive path");
    if (entry.isDirectory) continue;
    if (written.has(relative)) throw Error("Duplicate path in release archive");
    written.add(relative);
    // Reject Unix symlinks: archive contents must be ordinary files only.
    const mode = (entry.attr >>> 16) & 0xf000;
    if (mode === 0xa000) throw Error("Symlinks are forbidden in PdfCraft archive");
    const length = entry.header.size;
    total += length;
    if (length > maxSingleBytes || total > maxExtractedBytes) throw Error("Oversized PdfCraft archive");
    const full = path.resolve(outputDir, relative);
    if (!full.startsWith(outputDir + path.sep)) throw Error("Archive path escapes destination");
    const data = entry.getData();
    if (data.length !== length) throw Error("Invalid archive size");
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: "wx" });
  }
  if (!written.has("index.html") || ![...written].some((name) => name.endsWith(".wasm"))) {
    throw Error("Incomplete PdfCraft web distribution");
  }
  return { files: written.size, bytes: total };
}

export async function installPdfCraft({ fetchImpl = fetch, target = destination } = {}) {
  const response = await fetchImpl(PDFCRAFT_URL, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw Error("PdfCraft release download failed: HTTP " + response.status);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxCompressedBytes) throw Error("PdfCraft download exceeds limit");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxCompressedBytes) throw Error("PdfCraft archive too large");
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== PDFCRAFT_SHA256) throw Error("PdfCraft SHA256 mismatch");
  await mkdir(path.dirname(target), { recursive: true });
  const staging = await mkdtemp(path.join(path.dirname(target), ".pdfcraft-stage-"));
  const backup = target + ".old";
  let backedUp = false;
  try {
    const result = await unpackPdfCraftArchive(bytes, staging);
    // Atomic directory switch on the same filesystem; keep previous version on failure.
    await rm(backup, { recursive: true, force: true });
    try {
      if ((await stat(target)).isDirectory()) {
        await rename(target, backup);
        backedUp = true;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rename(staging, target);
    await rm(backup, { recursive: true, force: true });
    return { version: PDFCRAFT_VERSION, sha256: digest, ...result, destination: target };
  } catch (error) {
    if (backedUp) {
      await rm(target, { recursive: true, force: true });
      await rename(backup, target);
    }
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installPdfCraft()
    .then((result) => {
      console.log("PdfCraft installed:", result.version, result.files, "files in", result.destination);
      console.log("Upstream licences and notices: https://github.com/storytold/pdfcraft");
    })
    .catch((error) => { console.error("PdfCraft installation refused:", error.message); process.exitCode = 1; });
}
