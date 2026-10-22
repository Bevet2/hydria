import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migrateDriveTrashColumn } from "../services/driveAssetTrash.js";

const db = new Database(":memory:");
try {
  for (const table of [
    "drive_pdf_assets","drive_image_assets",
    "drive_design_assets","drive_photo_project_assets"
  ]) {
    db.exec("CREATE TABLE "+table+" (id TEXT PRIMARY KEY, filename TEXT NOT NULL)");
    db.prepare("INSERT INTO "+table+" VALUES (?,?)").run("old-file","legacy.bin");
    migrateDriveTrashColumn(db,table);
    migrateDriveTrashColumn(db,table);
    const columns=db.prepare("PRAGMA table_info("+table+")").all().map(x=>x.name);
    assert.equal(columns.filter(x=>x==="deleted_at").length,1);
    const previous=db.prepare("SELECT * FROM "+table+" WHERE id=?").get("old-file");
    assert.equal(previous.filename,"legacy.bin");
    assert.equal(previous.deleted_at,null);
  }
  assert.throws(()=>migrateDriveTrashColumn(db,"sqlite_master"),/Unknown/);
  console.log("Drive trash migrations passed: four legacy tables and idempotency.");
} finally {
  db.close();
}
