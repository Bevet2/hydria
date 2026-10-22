// Metadata-only rename for the four native Hydria Drive libraries.
// Version files and binary SHA256 are immutable; only latest file display name
// changes. No cross-user claims beyond the current private OS access model.
import path from "node:path";
import { db } from "../db/sqlite.js";
import { AppError } from "../utils/errors.js";

const ALLOWED_TABLES = new Set([
  "drive_pdf_assets", "drive_image_assets",
  "drive_photo_project_assets", "drive_design_assets"
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ILLEGAL = /[\/\\\x00-\x1f\x7f<>:"|?*]/;

export function createDriveRenameHandler({ table, initialize }) {
  if (!ALLOWED_TABLES.has(table) || typeof initialize !== "function") {
    throw new Error("Unsafe Drive rename table or schema initializer");
  }
  const lookup = "SELECT id,filename,revision,size,sha256,updated_at FROM " + table + " WHERE id=?";
  const rename = "UPDATE " + table +
    " SET filename=?,updated_at=? WHERE id=? AND revision=? AND filename=?";
  return function renameDriveNativeAsset(req, res, next) {
    try {
      initialize();
      const id = String(req.params.id || "");
      if (!UUID.test(id)) throw new AppError("Invalid Drive asset ID", 400);
      const { filename, expectedFilename, expectedRevision } = req.body || {};
      if (typeof filename !== "string" || typeof expectedFilename !== "string" ||
          !Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || expectedRevision > 50) {
        throw new AppError("Filename and expected Drive metadata are required", 400);
      }
      const proposed = filename.trim().normalize("NFC");
      if (!proposed || proposed.length > 128 || ILLEGAL.test(proposed) ||
          proposed === "." || proposed === ".." || proposed.endsWith(".")) {
        throw new AppError("Invalid Drive filename", 400);
      }
      const old = db.prepare(lookup).get(id);
      if (!old) throw new AppError("Drive asset not found", 404);
      const extension = path.extname(old.filename).toLowerCase();
      if (!extension || path.extname(proposed).toLowerCase() !== extension ||
          proposed.length <= extension.length) {
        throw new AppError("Keep the original file extension", 400);
      }
      if (old.revision !== expectedRevision || old.filename !== expectedFilename) {
        throw new AppError("This file was updated elsewhere. Refresh Drive before renaming.", 409);
      }
      if (proposed !== old.filename) {
        const updated = db.prepare(rename).run(
          proposed, new Date().toISOString(), id, expectedRevision, expectedFilename
        );
        if (updated.changes !== 1) {
          throw new AppError("This file was updated elsewhere. Refresh Drive before renaming.", 409);
        }
      }
      const item = db.prepare(lookup).get(id);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).json(item);
    } catch (error) { next(error); }
  };
}
