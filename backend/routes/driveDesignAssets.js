// FigCraft .figcraft archive persistence for the private single-owner Hydria OS.
// The web editor (v0.8) has browser Open/Save, but NO stable parent messaging API.
// Users save/download their design in FigCraft, then import into Drive explicitly.
import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import config from "../config/hydria.config.js";
import { db } from "../db/sqlite.js";
import { AppError } from "../utils/errors.js";

export const MAX_DESIGN_BYTES = 30 * 1024 * 1024;
export const MAX_DESIGN_REVISIONS = 50;
const router = Router();
const directory = path.join(config.paths.dataDir, "drive-design-assets");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DESIGN_BYTES, files: 1, fields: 1, fieldSize: 64, parts: 2 }
});
let schemaReady = false;

function ensureSchema() {
  if (schemaReady) return;
  db.exec("CREATE TABLE IF NOT EXISTS drive_design_assets (" +
    "id TEXT PRIMARY KEY, filename TEXT NOT NULL, size INTEGER NOT NULL CHECK(size > 0), " +
    "sha256 TEXT NOT NULL, created_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, " +
    "updated_at TEXT NOT NULL)");
  db.exec("CREATE TABLE IF NOT EXISTS drive_design_versions (" +
    "asset_id TEXT NOT NULL REFERENCES drive_design_assets(id) ON DELETE CASCADE, " +
    "revision INTEGER NOT NULL CHECK(revision > 0), filename TEXT NOT NULL, " +
    "size INTEGER NOT NULL CHECK(size > 0), sha256 TEXT NOT NULL, " +
    "storage_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, " +
    "PRIMARY KEY(asset_id, revision))");
  schemaReady = true;
}
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(input) {
  if (!ID.test(String(input || ""))) throw new AppError("Invalid design id", 400);
  return input;
}
function validRevision(input) {
  if (!/^[1-9]\d?$/.test(String(input || "")) || Number(input) > MAX_DESIGN_REVISIONS) {
    throw new AppError("Invalid design revision", 400);
  }
  return Number(input);
}
export function safeDesignName(value) {
  let cleaned = String(value || "design.figcraft")
    .replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g, "_")
    .trim().slice(0, 128);
  if (!cleaned || /^\.+$/.test(cleaned)) cleaned = "design.figcraft";
  return cleaned.toLowerCase().endsWith(".figcraft") ? cleaned : cleaned + ".figcraft";
}

/**
 * Verify native FigCraft archive envelope without extracting or executing
 * its members. Upstream v0.8 stores format/version in document.json.
 * This is NOT a complete FigCraft parser, security sanitizer or antivirus.
 */
export function inspectFigCraftArchive(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 32 ||
      bytes.length > MAX_DESIGN_BYTES || bytes.toString("binary", 0, 4) !== "PK\x03\x04") {
    throw new AppError("Invalid FigCraft archive", 400);
  }
  let zip;
  try { zip = new AdmZip(bytes); }
  catch { throw new AppError("Corrupt FigCraft ZIP", 400); }
  const entries = zip.getEntries();
  if (!entries.length || entries.length > 400) throw new AppError("FigCraft archive entry limit exceeded", 400);
  let total = 0;
  const seen = new Set();
  for (const entry of entries) {
    const name = entry.entryName;
    if (!name || name.startsWith("/") || name.includes("\\") ||
        name.split("/").some(part => part === "." || part === "..") ||
        name.includes("\0") || /^[a-zA-Z]:/.test(name)) {
      throw new AppError("Unsafe FigCraft archive member", 400);
    }
    if (seen.has(name)) throw new AppError("Duplicate FigCraft archive member", 400);
    seen.add(name);
    if (entry.isDirectory) continue;
    // ZIP external attributes can label symlinks; never accept them.
    if (((entry.attr >>> 16) & 0xf000) === 0xa000) {
      throw new AppError("Symlinks are not permitted in FigCraft archives", 400);
    }
    const length = Number(entry.header.size);
    total += length;
    if (!Number.isSafeInteger(length) || length < 0 ||
        length > 64 * 1024 * 1024 || total > 200 * 1024 * 1024) {
      throw new AppError("FigCraft expanded archive exceeds limits", 400);
    }
  }
  const document = zip.getEntry("document.json");
  if (!document || document.isDirectory || Number(document.header.size) > 8 * 1024 * 1024) {
    throw new AppError("FigCraft document.json missing or too large", 400);
  }
  let json;
  try { json = JSON.parse(document.getData().toString("utf8")); }
  catch { throw new AppError("Invalid FigCraft document.json", 400); }
  if (!json || typeof json !== "object" || Array.isArray(json) ||
      json.format !== "figcraft" || json.version !== 1) {
    throw new AppError("Unsupported FigCraft document format/version", 400);
  }
  return { format: "figcraft", version: json.version, members: entries.length };
}
function handleUpload(req, res, next) {
  upload.single("file")(req, res, error => {
    if (error instanceof multer.MulterError) {
      return next(new AppError(error.code === "LIMIT_FILE_SIZE"
        ? "FigCraft project exceeds 30 MiB" : "Invalid FigCraft upload",
        error.code === "LIMIT_FILE_SIZE" ? 413 : 400));
    }
    return error ? next(error) : next();
  });
}
function incoming(req) {
  const bytes = req.file?.buffer;
  inspectFigCraftArchive(bytes);
  return {
    bytes,
    filename: safeDesignName(req.file?.originalname),
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}
function getAsset(id) {
  validId(id);
  const asset = db.prepare("SELECT * FROM drive_design_assets WHERE id=?").get(id);
  if (!asset) throw new AppError("FigCraft project not found", 404);
  return asset;
}
async function storeBytes(key, bytes) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const fh = await open(path.join(directory, key), "wx", 0o600);
  try { await fh.writeFile(bytes); await fh.sync(); }
  finally { await fh.close(); }
}
function respondSaved(res, asset) {
  res.setHeader("Cache-Control", "private, no-store");
  res.status(201).json(asset);
}

router.post("/", handleUpload, async (req, res, next) => {
  try {
    ensureSchema();
    const file = incoming(req), id = randomUUID(), key = id + ".figcraft";
    const now = new Date().toISOString();
    await storeBytes(key, file.bytes);
    try {
      db.transaction(() => {
        db.prepare("INSERT INTO drive_design_assets" +
          "(id,filename,size,sha256,created_at,revision,updated_at) VALUES(?,?,?,?,?,1,?)")
          .run(id, file.filename, file.bytes.length, file.sha256, now, now);
        db.prepare("INSERT INTO drive_design_versions" +
          "(asset_id,revision,filename,size,sha256,storage_key,created_at) VALUES(?,1,?,?,?,?,?)")
          .run(id, file.filename, file.bytes.length, file.sha256, key, now);
      })();
    } catch (error) {
      await unlink(path.join(directory, key)).catch(() => {});
      throw error;
    }
    respondSaved(res, { id, filename: file.filename, size: file.bytes.length,
      sha256: file.sha256, revision: 1 });
  } catch (error) { next(error); }
});
router.get("/", (_req, res, next) => {
  try {
    ensureSchema();
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ items: db.prepare("SELECT id, filename, size, sha256, created_at, " +
      "revision, updated_at FROM drive_design_assets " +
      "ORDER BY updated_at DESC,id DESC LIMIT 500").all() });
  } catch (error) { next(error); }
});
router.get("/:id", (req, res, next) => {
  try {
    ensureSchema();
    const item = getAsset(req.params.id);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ id: item.id, filename: item.filename, size: item.size,
      sha256: item.sha256, revision: item.revision });
  } catch (error) { next(error); }
});
router.post("/:id/versions", handleUpload, async (req, res, next) => {
  try {
    ensureSchema();
    const id = validId(req.params.id), expected = validRevision(req.body?.expectedRevision);
    if (expected >= MAX_DESIGN_REVISIONS) throw new AppError("FigCraft version limit reached", 409);
    const asset = getAsset(id);
    if (asset.revision !== expected) throw new AppError("FigCraft design has a newer revision", 409);
    const file = incoming(req);
    const key = randomUUID() + ".figcraft", now = new Date().toISOString();
    await storeBytes(key, file.bytes);
    try {
      db.transaction(() => {
        const result = db.prepare("UPDATE drive_design_assets SET " +
          "filename=?,size=?,sha256=?,revision=?,updated_at=? WHERE id=? AND revision=?")
          .run(file.filename, file.bytes.length, file.sha256, expected + 1, now, id, expected);
        if (result.changes !== 1) throw new AppError("FigCraft design has a newer revision", 409);
        db.prepare("INSERT INTO drive_design_versions" +
          "(asset_id,revision,filename,size,sha256,storage_key,created_at) VALUES(?,?,?,?,?,?,?)")
          .run(id, expected + 1, file.filename, file.bytes.length, file.sha256, key, now);
      })();
    } catch (error) {
      await unlink(path.join(directory, key)).catch(() => {});
      throw error;
    }
    respondSaved(res, { id, filename: file.filename, size: file.bytes.length,
      sha256: file.sha256, revision: expected + 1 });
  } catch (error) { next(error); }
});
router.get("/:id/versions", (req, res, next) => {
  try {
    ensureSchema();
    const item = getAsset(req.params.id);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ id: item.id, revision: item.revision,
      items: db.prepare("SELECT revision,filename,size,sha256,created_at " +
        "FROM drive_design_versions WHERE asset_id=? ORDER BY revision DESC").all(item.id) });
  } catch (error) { next(error); }
});
async function download(req, res, next) {
  try {
    ensureSchema();
    const asset = getAsset(req.params.id);
    const revision = req.params.revision === undefined
      ? asset.revision : validRevision(req.params.revision);
    const saved = db.prepare("SELECT * FROM drive_design_versions " +
      "WHERE asset_id=? AND revision=?").get(asset.id, revision);
    if (!saved) throw new AppError("FigCraft revision not found", 404);
    if (!/^[0-9a-f-]{36}\.figcraft$/i.test(saved.storage_key) ||
        !ID.test(saved.storage_key.slice(0, 36))) {
      throw new AppError("Invalid FigCraft storage key", 500);
    }
    const bytes = await readFile(path.join(directory, saved.storage_key));
    if (bytes.length !== saved.size ||
        createHash("sha256").update(bytes).digest("hex") !== saved.sha256) {
      throw new AppError("FigCraft project integrity check failed", 500);
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.attachment(saved.filename);
    res.type("application/octet-stream");
    res.send(bytes);
  } catch (error) { next(error); }
}
router.get("/:id/download", download);
router.get("/:id/versions/:revision/download", download);

export default router;
