import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { migrateDriveImageSchema } from "../routes/driveImageAssets.js";

const dir = await mkdtemp(path.join(os.tmpdir(), "hydria-image-legacy-"));
const database = new Database(path.join(dir, "legacy.sqlite"));
try {
  database.pragma("foreign_keys=ON");
  // Real schema from the first PhotoCraft+Drive implementation, pre-revisions.
  database.exec(`CREATE TABLE drive_image_assets (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp')),
    size INTEGER NOT NULL CHECK (size > 0),
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  const id = randomUUID();
  const timestamp = "2026-10-18T12:00:00.000Z";
  database.prepare(`INSERT INTO drive_image_assets
    (id, filename, mime, size, sha256, created_at) VALUES(?, ?, ?, ?, ?, ?)`)
    .run(id, "avant-retouche.png", "image/png", 254, "a".repeat(64), timestamp);

  migrateDriveImageSchema(database);
  migrateDriveImageSchema(database); // idempotency is essential during deployment restarts
  const original = database.prepare("SELECT * FROM drive_image_assets WHERE id=?").get(id);
  assert.equal(original.revision, 1);
  assert.equal(original.filename, "avant-retouche.png");
  assert.equal(original.sha256, "a".repeat(64));
  assert.ok(database.prepare("PRAGMA table_info(drive_image_assets)").all()
    .some(column => column.name === "updated_at"));
  const versions = database.prepare(
    "SELECT * FROM drive_image_versions WHERE asset_id=? ORDER BY revision DESC"
  ).all(id);
  assert.equal(versions.length, 1);
  assert.equal(versions[0].storage_key, id + ".png");
  assert.equal(versions[0].revision, 1);
  assert.equal(versions[0].created_at, timestamp);
  assert.equal(versions[0].sha256, original.sha256);
  console.log("PhotoCraft legacy image migration passed: retained original metadata and idempotent history.");
} finally {
  database.close();
  await rm(dir, { recursive: true, force: true });
}
