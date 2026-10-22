import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { calculateNativeDriveUsage } from "../services/driveStorageUsage.js";

const db=new Database(":memory:");
try {
  const empty=calculateNativeDriveUsage(db);
  assert.deepEqual(empty.families.map(f=>f.key),["pdf","image","design","photo-project"]);
  assert.equal(empty.total.storedBytes,0);
  const families=[
    ["drive_pdf_assets","drive_pdf_versions"],
    ["drive_image_assets","drive_image_versions"],
    ["drive_design_assets","drive_design_versions"]
  ];
  for (const [assets,versions] of families) {
    db.exec("CREATE TABLE "+assets+" (id TEXT PRIMARY KEY, size INTEGER NOT NULL, deleted_at TEXT)");
    db.exec("CREATE TABLE "+versions+" (asset_id TEXT, size INTEGER NOT NULL)");
  }
  db.exec("CREATE TABLE drive_photo_project_assets (id TEXT PRIMARY KEY,size INTEGER NOT NULL)");
  const create=(table,id,size,deletedAt=null)=>
    db.prepare("INSERT INTO "+table+"(id,size,deleted_at) VALUES(?,?,?)").run(id,size,deletedAt);
  create("drive_pdf_assets","pdf-live",100);
  create("drive_pdf_assets","pdf-trash",40,"2026-10-22T08:00:00.000Z");
  const v=db.prepare("INSERT INTO drive_pdf_versions(asset_id,size) VALUES(?,?)");
  v.run("pdf-live",100); v.run("pdf-live",80); v.run("pdf-trash",40);
  create("drive_image_assets","image-live",30);
  db.prepare("INSERT INTO drive_photo_project_assets(id,size) VALUES(?,?)").run("old-photo",12);
  const result=calculateNativeDriveUsage(db);
  const pdf=result.families[0];
  assert.deepEqual({active:pdf.activeFiles,trashed:pdf.trashedFiles,
    activeBytes:pdf.activeBytes,trashedBytes:pdf.trashedBytes,storedBytes:pdf.storedBytes,
    historicalBytes:pdf.historicalBytes,versions:pdf.versions},
  {active:1,trashed:1,activeBytes:100,trashedBytes:40,storedBytes:220,
    historicalBytes:80,versions:3});
  assert.equal(result.families[1].legacyUnversionedFiles,1);
  assert.equal(result.families[1].storedBytes,30);
  assert.equal(result.families[2].storedBytes,0);
  assert.equal(result.families[3].legacyUnversionedFiles,1);
  assert.equal(result.families[3].activeFiles,1);
  assert.deepEqual(result.total,{
    activeFiles:3,trashedFiles:1,versions:5,
    activeBytes:142,trashedBytes:40,historicalBytes:80,storedBytes:262,
    legacyUnversionedFiles:2
  });
  // Migrating the legacy photo table does not change its recorded usage.
  db.exec("ALTER TABLE drive_photo_project_assets ADD COLUMN deleted_at TEXT");
  assert.equal(calculateNativeDriveUsage(db).total.storedBytes,262);
  // Trash is metadata-only, so physical indexed bytes remain stable.
  db.prepare("UPDATE drive_image_assets SET deleted_at=? WHERE id=?")
    .run("2026-10-22T08:30:00Z","image-live");
  const changed=calculateNativeDriveUsage(db);
  assert.equal(changed.total.storedBytes,262);
  assert.equal(changed.total.trashedBytes,70);
  assert.equal(changed.total.activeBytes,112);
  console.log("Native Drive storage accounting passed: versions, trash, legacy and four families.");
} finally { db.close(); }
