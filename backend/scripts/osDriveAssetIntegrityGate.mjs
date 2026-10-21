// Independent integrity gate: catalog ↔ all immutable binary revisions,
// legacy storage, tampering, orphan reporting and backup/restore round trip.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import AdmZip from "adm-zip";
import { inspectDriveSnapshot } from "../services/backup/driveAssetIntegrity.js";
import {
  backupHydriaData, restoreHydriaBackup, verifyHydriaBackup
} from "../services/backup/osBackup.js";

const root = await mkdtemp(path.join(os.tmpdir(), "hydria-drive-backup-gate-"));
const data = path.join(root, "data");
const databaseFile = path.join(data, "hydria.sqlite");
const backup = path.join(root, "backup");
const restored = path.join(root, "restored");
const sha = (data) => createHash("sha256").update(data).digest("hex");
const pdfId = randomUUID(), imageId = randomUUID(), designId = randomUUID();
const time = "2026-10-20T12:00:00.000Z";
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\n%%EOF\n");
const png1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGN0rT7xn4GBgYGJAQoAJiUCi6vmjGkAAAAASUVORK5CYII=", "base64"
);
const png2 = Buffer.concat([png1, Buffer.from("v2")]);
const imageKey1 = imageId + ".png", imageKey2 = randomUUID() + ".png";
const pdfKey = pdfId + ".pdf";
const makeDesign = (name) => {
  const zip = new AdmZip();
  zip.addFile("document.json",Buffer.from(JSON.stringify({format:"figcraft",version:1,name,pages:[]})));
  return zip.toBuffer();
};
const design1 = makeDesign("Design before edit"), design2 = makeDesign("Design after edit");
const designKey1 = designId + ".figcraft", designKey2 = randomUUID() + ".figcraft";
await mkdir(path.join(data, "drive-pdf-assets"), { recursive: true });
await mkdir(path.join(data, "drive-images"), { recursive: true });
await mkdir(path.join(data, "drive-design-assets"), { recursive: true });
await writeFile(path.join(data, "drive-pdf-assets", pdfKey), pdf);
await writeFile(path.join(data, "drive-images", imageKey1), png1);
await writeFile(path.join(data, "drive-images", imageKey2), png2);
await writeFile(path.join(data, "drive-design-assets", designKey1), design1);
await writeFile(path.join(data, "drive-design-assets", designKey2), design2);
await writeFile(path.join(data, "drive-images", "stale-upload.png"), Buffer.from("orphan"));
const db = new Database(databaseFile);
try {
  db.pragma("foreign_keys=ON");
  db.exec(`CREATE TABLE drive_pdf_assets(
    id TEXT PRIMARY KEY, filename TEXT, size INTEGER, sha256 TEXT, created_at TEXT,
    revision INTEGER, updated_at TEXT);
    CREATE TABLE drive_pdf_versions(
    asset_id TEXT, revision INTEGER, filename TEXT, size INTEGER,
    sha256 TEXT, storage_key TEXT, created_at TEXT,
    PRIMARY KEY(asset_id,revision));
    CREATE TABLE drive_image_assets(
    id TEXT PRIMARY KEY, filename TEXT, mime TEXT, size INTEGER, sha256 TEXT,
    created_at TEXT, revision INTEGER, updated_at TEXT);
    CREATE TABLE drive_image_versions(
    asset_id TEXT, revision INTEGER, filename TEXT, mime TEXT, size INTEGER,
    sha256 TEXT, storage_key TEXT, created_at TEXT,
    PRIMARY KEY(asset_id,revision));
    CREATE TABLE drive_design_assets(
    id TEXT PRIMARY KEY, filename TEXT, size INTEGER, sha256 TEXT,
    created_at TEXT, revision INTEGER, updated_at TEXT);
    CREATE TABLE drive_design_versions(
    asset_id TEXT, revision INTEGER, filename TEXT, size INTEGER, sha256 TEXT,
    storage_key TEXT, created_at TEXT, PRIMARY KEY(asset_id,revision));`);
  db.prepare("INSERT INTO drive_pdf_assets VALUES(?,?,?,?,?,?,?)")
    .run(pdfId, "contrat.pdf", pdf.length, sha(pdf), time, 1, time);
  db.prepare("INSERT INTO drive_pdf_versions VALUES(?,?,?,?,?,?,?)")
    .run(pdfId, 1, "contrat.pdf", pdf.length, sha(pdf), pdfKey, time);
  db.prepare("INSERT INTO drive_image_assets VALUES(?,?,?,?,?,?,?,?)")
    .run(imageId, "retouche.png", "image/png", png2.length, sha(png2), time, 2, time);
  db.prepare("INSERT INTO drive_image_versions VALUES(?,?,?,?,?,?,?,?)")
    .run(imageId, 1, "original.png", "image/png", png1.length, sha(png1), imageKey1, time);
  db.prepare("INSERT INTO drive_image_versions VALUES(?,?,?,?,?,?,?,?)")
    .run(imageId, 2, "retouche.png", "image/png", png2.length, sha(png2), imageKey2, time);

  db.prepare("INSERT INTO drive_design_assets VALUES(?,?,?,?,?,?,?)")
    .run(designId,"wireframe.figcraft",design2.length,sha(design2),time,2,time);
  db.prepare("INSERT INTO drive_design_versions VALUES(?,?,?,?,?,?,?)")
    .run(designId,1,"wireframe.figcraft",design1.length,sha(design1),designKey1,time);
  db.prepare("INSERT INTO drive_design_versions VALUES(?,?,?,?,?,?,?)")
    .run(designId,2,"wireframe.figcraft",design2.length,sha(design2),designKey2,time);

  let checked = await inspectDriveSnapshot(databaseFile, data);
  assert.equal(checked.checkedAssets, 3);
  assert.equal(checked.checkedVersions, 5);
  assert.equal(checked.checkedBytes, pdf.length + png1.length + png2.length + design1.length + design2.length);
  assert.equal(checked.unreferencedFiles, 1);

  await backupHydriaData(data, backup);
  const verified = await verifyHydriaBackup(backup);
  assert.equal(verified.drive.checkedVersions, 5);
  await restoreHydriaBackup(backup, restored);
  assert.equal((await inspectDriveSnapshot(path.join(restored, "hydria.sqlite"), restored)).checkedVersions, 5);
  assert.deepEqual(await readFile(path.join(restored, "drive-images", imageKey1)), png1);
  assert.deepEqual(await readFile(path.join(restored, "drive-images", imageKey2)), png2);

  assert.deepEqual(await readFile(path.join(restored,"drive-design-assets",designKey1)),design1);
  assert.deepEqual(await readFile(path.join(restored,"drive-design-assets",designKey2)),design2);
  await unlink(path.join(data,"drive-design-assets",designKey1));
  await assert.rejects(inspectDriveSnapshot(databaseFile,data),/missing design binary/);
  await writeFile(path.join(data,"drive-design-assets",designKey1),design1);
  await writeFile(path.join(data,"drive-design-assets",designKey2),Buffer.from("corrupt"));
  await assert.rejects(inspectDriveSnapshot(databaseFile,data),/invalid design binary/);
  await writeFile(path.join(data,"drive-design-assets",designKey2),design2);

  // The manifest may match all the files a backup actually copied while a
  // referenced file was missing from the original live directory.
  await unlink(path.join(data, "drive-images", imageKey1));
  await assert.rejects(inspectDriveSnapshot(databaseFile, data), /missing image binary/);
  await assert.rejects(backupHydriaData(data, path.join(root, "invalid-backup")), /missing image binary/);
  await writeFile(path.join(data, "drive-images", imageKey1), png1);

  await writeFile(path.join(data, "drive-images", imageKey2), Buffer.from("tampered"));
  await assert.rejects(inspectDriveSnapshot(databaseFile, data), /invalid image binary/);
  await writeFile(path.join(data, "drive-images", imageKey2), png2);

  db.prepare("DELETE FROM drive_image_versions WHERE asset_id=? AND revision=1").run(imageId);
  await assert.rejects(inspectDriveSnapshot(databaseFile, data), /missing image historical revisions/);
  db.prepare("INSERT INTO drive_image_versions VALUES(?,?,?,?,?,?,?,?)")
    .run(imageId, 1, "original.png", "image/png", png1.length, sha(png1), imageKey1, time);

  // Backups predating the versions tables must still be restorable.
  db.exec("DROP TABLE drive_image_versions; DROP TABLE drive_pdf_versions;");
  db.prepare("UPDATE drive_image_assets SET revision=1,sha256=?,size=? WHERE id=?")
    .run(sha(png1), png1.length, imageId);
  // The revised bytes are now unreferenced, but a revision-1-only legacy
  // catalog must still be restorable from its original on-disk file.
  await rm(path.join(data, "drive-images", imageKey2));
  checked = await inspectDriveSnapshot(databaseFile, data);
  assert.equal(checked.checkedAssets, 3);
  assert.equal(checked.checkedVersions, 4);
  console.log("Drive snapshot gate passed: revisions, missing/corrupt blobs, backups, restore and legacy catalog.");
} finally {
  db.close();
  await rm(root, { recursive: true, force: true });
}
