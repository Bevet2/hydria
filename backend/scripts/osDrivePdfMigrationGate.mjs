import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { migrateDrivePdfSchema } from "../routes/drivePdfAssets.js";

const database = new Database(":memory:");
try {
  database.pragma("foreign_keys=ON");
  database.exec(`CREATE TABLE drive_pdf_assets (
    id TEXT PRIMARY KEY, filename TEXT NOT NULL, size INTEGER NOT NULL,
    sha256 TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  const id = randomUUID(), hash = "a".repeat(64), date = "2026-10-19T12:00:00Z";
  database.prepare("INSERT INTO drive_pdf_assets VALUES(?,?,?,?,?)").run(id, "ancien.pdf", 180, hash, date);
  migrateDrivePdfSchema(database); migrateDrivePdfSchema(database);
  const asset = database.prepare("SELECT * FROM drive_pdf_assets").get();
  assert.equal(asset.revision, 1);
  assert.equal(asset.filename, "ancien.pdf");
  assert.equal(asset.sha256, hash);
  const history = database.prepare("SELECT * FROM drive_pdf_versions").all();
  assert.equal(history.length, 1);
  assert.equal(history[0].storage_key, id + ".pdf");
  assert.equal(history[0].sha256, hash);
  assert.equal(history[0].created_at, date);
  database.prepare(`UPDATE drive_pdf_assets SET revision=2,sha256=? WHERE id=?`).run("b".repeat(64), id);
  migrateDrivePdfSchema(database);
  assert.equal(database.prepare("SELECT sha256 FROM drive_pdf_versions WHERE revision=1").get().sha256, hash);
  console.log("Legacy PDF migration passed: metadata and original storage path retained, idempotent history.");
} finally { database.close(); }
