// PhotoCraft -> Hydria Drive: immutable raster revisions with optimistic writes.
// Single-owner private pilot protected by the OS production access gate.
// Per-user ACLs, content sandboxing, and global quotas are not provided here.
import { Router } from "express";
import multer from "multer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import config from "../config/hydria.config.js";
import { db } from "../db/sqlite.js";
import { AppError } from "../utils/errors.js";

export const MAX_DRIVE_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_DRIVE_IMAGE_REVISIONS = 50;
const router = Router();
const dir = path.join(config.paths.dataDir, "drive-images");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DRIVE_IMAGE_BYTES, files: 1, parts: 3, fields: 2, fieldSize: 128 }
});
let schemaReady = false;

function schema() {
  if (schemaReady) return;
  db.exec(`CREATE TABLE IF NOT EXISTS drive_image_assets (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp')),
    size INTEGER NOT NULL CHECK (size > 0),
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT
  )`);
  // Migrate existing PhotoCraft images without copying binary payloads.
  const existing = new Set(db.prepare("PRAGMA table_info(drive_image_assets)").all().map(x => x.name));
  if (!existing.has("revision")) db.exec("ALTER TABLE drive_image_assets ADD COLUMN revision INTEGER NOT NULL DEFAULT 1");
  if (!existing.has("updated_at")) db.exec("ALTER TABLE drive_image_assets ADD COLUMN updated_at TEXT");
  db.exec(`CREATE TABLE IF NOT EXISTS drive_image_versions (
    asset_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision > 0),
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL CHECK(size > 0),
    sha256 TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(asset_id, revision),
    FOREIGN KEY(asset_id) REFERENCES drive_image_assets(id) ON DELETE CASCADE
  )`);
  // Original binaries were written as <id>.<extension>. Retain this path for
  // revision 1. New versions use unguessable storage keys under the same root.
  db.exec(`INSERT OR IGNORE INTO drive_image_versions
    (asset_id, revision, filename, mime, size, sha256, storage_key, created_at)
    SELECT id, 1, filename, mime, size, sha256, id ||
      CASE mime WHEN 'image/png' THEN '.png'
                WHEN 'image/jpeg' THEN '.jpg'
                ELSE '.webp' END, created_at
    FROM drive_image_assets`);
  schemaReady = true;
}

export function detectRasterFormat(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 16) return null;
  if (bytes.length >= 32 &&
      bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
      bytes.toString("ascii", 12, 16) === "IHDR" &&
      bytes.subarray(-8, -4).toString("ascii") === "IEND") {
    return { mime: "image/png", extension: ".png" };
  }
  if (bytes.length >= 16 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
      bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) {
    return { mime: "image/jpeg", extension: ".jpg" };
  }
  if (bytes.length >= 20 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP" &&
      bytes.readUInt32LE(4) === bytes.length - 8) {
    return { mime: "image/webp", extension: ".webp" };
  }
  return null;
}
export function safeImageFilename(raw, ext) {
  const cleaned = String(raw || "image")
    .replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g, "_")
    .trim().slice(0, 120).replace(/\.(png|jpe?g|webp)$/i, "");
  return (cleaned && !/^\.+$/.test(cleaned) ? cleaned : "image") + ext;
}
function validId(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""))) {
    throw new AppError("Invalid image id", 400);
  }
  return id;
}
function validRevision(value) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 1 || revision > MAX_DRIVE_IMAGE_REVISIONS) {
    throw new AppError("Invalid image revision", 400);
  }
  return revision;
}
function getAsset(id) {
  validId(id);
  const item = db.prepare("SELECT * FROM drive_image_assets WHERE id=?").get(id);
  if (!item) throw new AppError("Image not found", 404);
  return item;
}
function getVersion(id, revision) {
  const version = db.prepare(
    "SELECT * FROM drive_image_versions WHERE asset_id=? AND revision=?"
  ).get(id, revision);
  if (!version) throw new AppError("Image version not found", 404);
  return version;
}
function prepareUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new AppError(
        err.code === "LIMIT_FILE_SIZE" ? "Image exceeds 15 MiB" : "Invalid image upload",
        err.code === "LIMIT_FILE_SIZE" ? 413 : 400
      ));
    }
    return err ? next(err) : next();
  });
}
function incomingFile(req) {
  const bytes = req.file?.buffer;
  const type = detectRasterFormat(bytes);
  if (!type) throw new AppError("Unsupported or invalid image. Use PNG, JPEG or WebP", 400);
  const filename = safeImageFilename(req.file?.originalname, type.extension);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { bytes, type, filename, sha256 };
}

router.post("/", prepareUpload, async (req, res, next) => {
  try {
    schema();
    const { bytes, type, filename, sha256 } = incomingFile(req);
    const id = randomUUID();
    const storageKey = id + type.extension;
    const now = new Date().toISOString();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const absolute = path.join(dir, storageKey);
    await writeFile(absolute, bytes, { flag: "wx", mode: 0o600 });
    try {
      db.transaction(() => {
        db.prepare(`INSERT INTO drive_image_assets
          (id, filename, mime, size, sha256, created_at, revision, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?)`)
          .run(id, filename, type.mime, bytes.length, sha256, now, now);
        db.prepare(`INSERT INTO drive_image_versions
          (asset_id, revision, filename, mime, size, sha256, storage_key, created_at)
          VALUES (?, 1, ?, ?, ?, ?, ?, ?)`)
          .run(id, filename, type.mime, bytes.length, sha256, storageKey, now);
      })();
    } catch (error) {
      await unlink(absolute).catch(() => {});
      throw error;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.status(201).json({ id, filename, mime: type.mime, size: bytes.length, sha256, revision: 1 });
  } catch (error) { next(error); }
});

router.get("/", (_req, res, next) => {
  try {
    schema();
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ items: db.prepare(`SELECT
      id, filename, mime, size, sha256, created_at, revision, updated_at
      FROM drive_image_assets ORDER BY COALESCE(updated_at, created_at) DESC, id DESC LIMIT 500`).all() });
  } catch (error) { next(error); }
});

// The modified image arrives as a new *revision of the same Drive asset*.
// expectedRevision prevents stale clients from silently replacing newer edits.
router.post("/:id/versions", prepareUpload, async (req, res, next) => {
  try {
    schema();
    const id = validId(req.params.id);
    const expected = validRevision(req.body?.expectedRevision);
    const previous = getAsset(id);
    if (previous.revision !== expected) throw new AppError("Image has a newer revision. Refresh and retry.", 409);
    if (expected >= MAX_DRIVE_IMAGE_REVISIONS) {
      throw new AppError("Image version limit reached", 409);
    }
    const { bytes, type, filename, sha256 } = incomingFile(req);
    const revision = expected + 1;
    const storageKey = randomUUID() + type.extension;
    const absolute = path.join(dir, storageKey);
    const now = new Date().toISOString();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(absolute, bytes, { flag: "wx", mode: 0o600 });
    try {
      db.transaction(() => {
        const current = getAsset(id);
        if (current.revision !== expected) {
          throw new AppError("Image has a newer revision. Refresh and retry.", 409);
        }
        const updated = db.prepare(`UPDATE drive_image_assets
          SET filename=?, mime=?, size=?, sha256=?, revision=?, updated_at=?
          WHERE id=? AND revision=?`)
          .run(filename, type.mime, bytes.length, sha256, revision, now, id, expected);
        if (updated.changes !== 1) throw new AppError("Image has a newer revision. Refresh and retry.", 409);
        db.prepare(`INSERT INTO drive_image_versions
          (asset_id, revision, filename, mime, size, sha256, storage_key, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, revision, filename, type.mime, bytes.length, sha256, storageKey, now);
      })();
    } catch (error) {
      await unlink(absolute).catch(() => {});
      throw error;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.status(201).json({ id, filename, mime: type.mime, size: bytes.length, sha256, revision });
  } catch (error) { next(error); }
});

router.get("/:id/versions", (req, res, next) => {
  try {
    schema();
    const item = getAsset(req.params.id);
    const items = db.prepare(`SELECT revision, filename, mime, size, sha256, created_at
      FROM drive_image_versions WHERE asset_id=? ORDER BY revision DESC`).all(item.id);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ id: item.id, revision: item.revision, items });
  } catch (error) { next(error); }
});

async function serve(req, res, next, disposition, requestedRevision = null) {
  try {
    schema();
    const item = getAsset(req.params.id);
    const revision = requestedRevision === null ? item.revision : validRevision(requestedRevision);
    const version = getVersion(item.id, revision);
    // storage_key is generated by Hydria, never from the user's filename.
    if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/i.test(version.storage_key)) {
      throw new AppError("Invalid stored image path", 500);
    }
    const bytes = await readFile(path.join(dir, version.storage_key));
    if (bytes.length !== version.size ||
        createHash("sha256").update(bytes).digest("hex") !== version.sha256) {
      throw new AppError("Image integrity check failed", 500);
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    if (disposition === "attachment") res.attachment(version.filename);
    else res.setHeader("Content-Disposition", "inline");
    res.type(version.mime);
    res.send(bytes);
  } catch (error) { next(error); }
}
router.get("/:id/preview", (req, res, next) => serve(req, res, next, "inline"));
router.get("/:id/download", (req, res, next) => serve(req, res, next, "attachment"));
router.get("/:id/versions/:revision/download",
  (req, res, next) => serve(req, res, next, "attachment", req.params.revision));

export default router;
