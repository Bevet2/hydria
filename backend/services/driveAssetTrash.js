// Soft delete / restore for the native Drive libraries in the private OS.
// Binary revisions and checksums are immutable. No permanent purge or ACLs.
import { db } from "../db/sqlite.js";
import { AppError } from "../utils/errors.js";

const TABLES = new Set([
  "drive_pdf_assets", "drive_image_assets",
  "drive_design_assets", "drive_photo_project_assets"
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function migrateDriveTrashColumn(database, table) {
  if (!TABLES.has(table)) throw new Error("Unknown Drive asset table");
  const columns = new Set(database.prepare("PRAGMA table_info(" + table + ")").all().map(c => c.name));
  if (!columns.has("deleted_at")) {
    database.exec("ALTER TABLE " + table + " ADD COLUMN deleted_at TEXT");
  }
}

export function createDriveTrashHandler({ table, initialize, operation }) {
  if (!TABLES.has(table) || typeof initialize !== "function" ||
      !["trash", "restore"].includes(operation)) {
    throw new Error("Invalid Drive lifecycle configuration");
  }
  const toTrash = operation === "trash";
  const expectedState = toTrash ? "IS NULL" : "IS NOT NULL";
  return function driveAssetLifecycle(req, res, next) {
    try {
      initialize();
      const id = String(req.params.id || "");
      if (!UUID.test(id)) throw new AppError("Invalid Drive asset ID", 400);
      const { expectedRevision, expectedFilename } = req.body || {};
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
          expectedRevision > 50 || typeof expectedFilename !== "string" ||
          !expectedFilename || expectedFilename.length > 160) {
        throw new AppError("Expected filename and revision are required", 400);
      }
      const lookup = "SELECT id,filename,revision,size,sha256,updated_at,deleted_at FROM " +
        table + " WHERE id=?";
      const current = db.prepare(lookup).get(id);
      if (!current) throw new AppError("Native Drive asset not found", 404);
      if (current.revision !== expectedRevision ||
          current.filename !== expectedFilename ||
          Boolean(current.deleted_at) !== !toTrash) {
        throw new AppError("Drive asset changed. Refresh the library and retry.", 409);
      }
      const now = new Date().toISOString();
      const changed = db.prepare("UPDATE " + table + " SET deleted_at=?,updated_at=? " +
        "WHERE id=? AND revision=? AND filename=? AND deleted_at " + expectedState)
        .run(toTrash ? now : null, now, id, expectedRevision, expectedFilename);
      if (changed.changes !== 1) {
        throw new AppError("Drive asset changed. Refresh the library and retry.", 409);
      }
      res.setHeader("Cache-Control", "private, no-store");
      res.json(db.prepare(lookup).get(id));
    } catch (error) { next(error); }
  };
}
