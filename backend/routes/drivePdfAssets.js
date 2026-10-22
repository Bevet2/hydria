// Private single-owner Drive. OS authentication protects these routes.
import { Router } from "express";
import multer from "multer";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "../db/sqlite.js";
import config from "../config/hydria.config.js";
import { AppError } from "../utils/errors.js";
import { createDriveRenameHandler } from "../services/driveAssetRename.js";
import { createDriveTrashHandler, migrateDriveTrashColumn } from "../services/driveAssetTrash.js";

export const MAX_DRIVE_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_DRIVE_PDF_REVISIONS = 50;
const assetDir = path.join(config.paths.dataDir, "drive-pdf-assets");
const upload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: MAX_DRIVE_PDF_BYTES, files: 1, fields: 1, fieldSize: 256, parts: 2
} });
const router = Router();
let schemaReady = false;

export function migrateDrivePdfSchema(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS drive_pdf_assets (
    id TEXT PRIMARY KEY, filename TEXT NOT NULL, size INTEGER NOT NULL CHECK(size > 0),
    sha256 TEXT NOT NULL, created_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT
  )`);
  const columns = new Set(database.prepare("PRAGMA table_info(drive_pdf_assets)").all().map(x => x.name));
  if (!columns.has("revision")) database.exec("ALTER TABLE drive_pdf_assets ADD COLUMN revision INTEGER NOT NULL DEFAULT 1");
  if (!columns.has("updated_at")) database.exec("ALTER TABLE drive_pdf_assets ADD COLUMN updated_at TEXT");
  migrateDriveTrashColumn(database, "drive_pdf_assets");
  database.exec(`CREATE TABLE IF NOT EXISTS drive_pdf_versions (
    asset_id TEXT NOT NULL REFERENCES drive_pdf_assets(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL CHECK(revision > 0), filename TEXT NOT NULL,
    size INTEGER NOT NULL CHECK(size > 0), sha256 TEXT NOT NULL,
    storage_key TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(asset_id, revision)
  )`);
  // Legacy PDFs remain at their existing <id>.pdf path; no binary is rewritten.
  database.exec(`INSERT OR IGNORE INTO drive_pdf_versions
    (asset_id,revision,filename,size,sha256,storage_key,created_at)
    SELECT id,1,filename,size,sha256,id || '.pdf',created_at FROM drive_pdf_assets`);
}
function schema() {
  if (!schemaReady) { db.transaction(() => migrateDrivePdfSchema(db))(); schemaReady = true; }
}
export function safePdfName(input) {
  const cleaned = String(input || "document.pdf")
    .replace(/[\\/\x00-\x1f\x7f]/g, "_").replace(/[<>:"|?*]/g, "_").trim().slice(0, 150);
  const named = cleaned && !/^\.+$/.test(cleaned) ? cleaned : "document.pdf";
  return named.toLowerCase().endsWith(".pdf") ? named : named + ".pdf";
}
export function pdfBytesValid(bytes) {
  return Buffer.isBuffer(bytes) && bytes.length >= 14 &&
    bytes.subarray(0, 5).toString("ascii") === "%PDF-" &&
    /^\d\.\d/.test(bytes.subarray(5, 8).toString("ascii")) &&
    bytes.subarray(Math.max(0, bytes.length - 2048)).toString("latin1").includes("%%EOF");
}
function handleUpload(req, res, next) {
  upload.single("file")(req, res, error => {
    if (error instanceof multer.MulterError) return next(new AppError(
      error.code === "LIMIT_FILE_SIZE" ? "PDF exceeds the 20 MiB limit" : "Invalid PDF upload",
      error.code === "LIMIT_FILE_SIZE" ? 413 : 400));
    return error ? next(error) : next();
  });
}
function validId(id) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(id || ""))) {
    throw new AppError("Invalid PDF id", 400);
  }
  return id;
}
function validRevision(value) {
  if (!/^[1-9]\d?$/.test(String(value || "")) || Number(value) > MAX_DRIVE_PDF_REVISIONS) {
    throw new AppError("Invalid PDF revision", 400);
  }
  return Number(value);
}
function asset(id) {
  validId(id);
  const item = db.prepare("SELECT * FROM drive_pdf_assets WHERE id=? AND deleted_at IS NULL").get(id);
  if (!item) throw new AppError("PDF not found", 404);
  return item;
}
function incoming(req) {
  const bytes = req.file?.buffer;
  if (!pdfBytesValid(bytes)) throw new AppError("Invalid PDF file", 400);
  return { bytes, filename: safePdfName(req.file.originalname),
    sha256: createHash("sha256").update(bytes).digest("hex") };
}
async function writeBinary(key, bytes) {
  await mkdir(assetDir, { recursive: true, mode: 0o700 });
  const destination = path.join(assetDir, key);
  const file = await open(destination, "wx", 0o600);
  try { await file.writeFile(bytes); await file.sync(); }
  catch (error) { await unlink(destination).catch(() => {}); throw error; }
  finally { await file.close(); }
  const directory = await open(assetDir, "r");
  try { await directory.sync(); } finally { await directory.close(); }
  return destination;
}
function recordVersion(id, revision, file, key, now) {
  db.prepare(`INSERT INTO drive_pdf_versions
    (asset_id,revision,filename,size,sha256,storage_key,created_at) VALUES(?,?,?,?,?,?,?)`)
    .run(id, revision, file.filename, file.bytes.length, file.sha256, key, now);
}
function reply(res, id, revision, file) {
  res.setHeader("Cache-Control", "private, no-store");
  res.status(201).json({ id, revision, filename: file.filename, size: file.bytes.length, sha256: file.sha256 });
}
router.post("/", handleUpload, async (req, res, next) => {
  try {
    schema();
    const file = incoming(req), id = randomUUID(), key = id + ".pdf", now = new Date().toISOString();
    const location = await writeBinary(key, file.bytes);
    try {
      db.transaction(() => {
        db.prepare(`INSERT INTO drive_pdf_assets(id,filename,size,sha256,created_at,revision,updated_at)
          VALUES(?,?,?,?,?,1,?)`).run(id, file.filename, file.bytes.length, file.sha256, now, now);
        recordVersion(id, 1, file, key, now);
      })();
    } catch (error) { await unlink(location).catch(() => {}); throw error; }
    reply(res, id, 1, file);
  } catch (error) { next(error); }
});
router.get("/", (req, res, next) => {
  try {
    schema(); res.setHeader("Cache-Control", "private, no-store");
    res.json({ items: db.prepare(`SELECT id,filename,size,sha256,created_at,revision, updated_at, deleted_at
      FROM drive_pdf_assets WHERE deleted_at ${req.query?.trashed === "1" ? "IS NOT NULL" : "IS NULL"} ORDER BY COALESCE(updated_at,created_at) DESC,id DESC LIMIT 500`).all() });
  } catch (error) { next(error); }
});
router.post("/:id/versions", handleUpload, async (req, res, next) => {
  try {
    schema();
    const id = validId(req.params.id), expected = validRevision(req.body?.expectedRevision);
    if (asset(id).revision !== expected) throw new AppError("Une version plus récente existe dans Drive. Rouvrez-la ou enregistrez une copie.", 409);
    if (expected >= MAX_DRIVE_PDF_REVISIONS) throw new AppError("PDF version limit reached", 409);
    const file = incoming(req), key = randomUUID() + ".pdf", now = new Date().toISOString();
    const location = await writeBinary(key, file.bytes);
    try {
      db.transaction(() => {
        const result = db.prepare(`UPDATE drive_pdf_assets SET filename=?,size=?,sha256=?,revision=?,updated_at=?
          WHERE id=? AND revision=? AND deleted_at IS NULL`).run(file.filename, file.bytes.length, file.sha256, expected + 1, now, id, expected);
        if (result.changes !== 1) throw new AppError("Une version plus récente existe dans Drive. Rouvrez-la ou enregistrez une copie.", 409);
        recordVersion(id, expected + 1, file, key, now);
      })();
    } catch (error) { await unlink(location).catch(() => {}); throw error; }
    reply(res, id, expected + 1, file);
  } catch (error) { next(error); }
});
router.get("/:id/versions", (req, res, next) => {
  try {
    schema(); const item = asset(req.params.id);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ id: item.id, revision: item.revision, items: db.prepare(`SELECT revision,filename,size,sha256,created_at
      FROM drive_pdf_versions WHERE asset_id=? ORDER BY revision DESC`).all(item.id) });
  } catch (error) { next(error); }
});
router.get("/:id", (req, res, next) => {
  try {
    schema(); const item = asset(req.params.id);
    res.setHeader("Cache-Control", "private, no-store"); res.json(item);
  } catch (error) { next(error); }
});
async function download(req, res, next) {
  try {
    schema(); const item = asset(req.params.id);
    const revision = req.params.revision === undefined ? item.revision : validRevision(req.params.revision);
    const version = db.prepare("SELECT * FROM drive_pdf_versions WHERE asset_id=? AND revision=?").get(item.id, revision);
    if (!version) throw new AppError("PDF revision not found", 404);
    if (!/^[a-f0-9-]{36}\.pdf$/i.test(version.storage_key)) throw new AppError("Invalid PDF storage path", 500);
    const bytes = await readFile(path.join(assetDir, version.storage_key));
    if (bytes.length !== version.size || createHash("sha256").update(bytes).digest("hex") !== version.sha256) {
      throw new AppError("PDF integrity check failed", 500);
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.attachment(req.params.revision === undefined ? item.filename : version.filename); res.type("application/pdf"); res.send(bytes);
  } catch (error) { next(error); }
}
router.get("/:id/download", download);
router.get("/:id/versions/:revision/download", download);
router.patch("/:id/metadata", createDriveRenameHandler({
  table: "drive_pdf_assets", initialize: schema
}));

router.post("/:id/trash", createDriveTrashHandler({
  table: "drive_pdf_assets", initialize: schema, operation: "trash"
}));
router.post("/:id/restore", createDriveTrashHandler({
  table: "drive_pdf_assets", initialize: schema, operation: "restore"
}));

export default router;
