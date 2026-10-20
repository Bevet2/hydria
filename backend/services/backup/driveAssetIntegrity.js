// Validate that the SQLite Drive catalog and its immutable binary files form
// one restorable snapshot. A checksum manifest alone cannot detect blobs that
// were already missing before the backup was created.
// This reads existing records; it never changes live user data.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{64}$/i;
const FORMATS = Object.freeze({
  pdf: {
    assets: "drive_pdf_assets", versions: "drive_pdf_versions",
    directory: "drive-pdf-assets", type: "pdf",
    ext: () => ".pdf"
  },
  image: {
    assets: "drive_image_assets", versions: "drive_image_versions",
    directory: "drive-images", type: "image",
    ext: (mime) => ({
      "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"
    })[mime]
  }
});

function fail(message) { throw new Error("Hydria Drive backup integrity: " + message); }
async function digestFile(filename) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
}
function tables(database) {
  return new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    .map((row) => row.name));
}
function validStorageKey(key, format) {
  return typeof key === "string" && /^[a-f0-9-]{36}\.(?:pdf|png|jpg|webp)$/i.test(key) &&
    UUID.test(key.slice(0, 36)) &&
    (format === "pdf" ? key.endsWith(".pdf") : /\.(png|jpg|webp)$/i.test(key));
}
export async function inspectDriveSnapshot(databaseFile, dataDir) {
  const database = new Database(databaseFile, { readonly: true, fileMustExist: true });
  const report = { checkedAssets: 0, checkedVersions: 0, checkedBytes: 0, unreferencedFiles: 0 };
  try {
    const existing = tables(database);
    for (const [format, info] of Object.entries(FORMATS)) {
      if (!existing.has(info.assets)) {
        if (existing.has(info.versions)) fail("orphan version table for " + format);
        continue;
      }
      const folder = path.join(dataDir, info.directory);
      const references = new Set();
      const assets = database.prepare("SELECT * FROM " + info.assets).all();
      const versionsExist = existing.has(info.versions);
      const allVersions = versionsExist
        ? database.prepare("SELECT * FROM " + info.versions).all()
        : [];
      const byId = new Map();
      for (const version of allVersions) {
        if (!UUID.test(String(version.asset_id))) fail("invalid " + format + " version owner id");
        if (!byId.has(version.asset_id)) byId.set(version.asset_id, []);
        byId.get(version.asset_id).push(version);
      }
      for (const asset of assets) {
        if (!UUID.test(String(asset.id))) fail("invalid " + format + " asset id");
        const expectedCurrent = Number(asset.revision ?? 1);
        if (!Number.isSafeInteger(expectedCurrent) || expectedCurrent < 1 || expectedCurrent > 50) {
          fail("invalid " + format + " current revision " + asset.id);
        }
        const versions = byId.get(asset.id) || [];
        byId.delete(asset.id);
        // Pre-revision deployments lack the versions table. Their original
        // binaries are immutable <asset-id>.<extension> and become revision 1.
        const rows = versions.length ? versions : [{
          asset_id: asset.id, revision: 1, filename: asset.filename,
          mime: asset.mime, size: asset.size, sha256: asset.sha256,
          storage_key: asset.id + (info.ext(asset.mime) || "")
        }];
        if (versions.length === 0 && expectedCurrent !== 1) {
          fail("missing " + format + " revision history for " + asset.id);
        }
        if (rows.length !== expectedCurrent) {
          fail("missing " + format + " historical revisions for " + asset.id);
        }
        const revisionNumbers = new Set();
        let latest;
        for (const row of rows) {
          const revision = Number(row.revision);
          if (!Number.isSafeInteger(revision) || revision < 1 || revision > expectedCurrent ||
              revisionNumbers.has(revision)) {
            fail("invalid " + format + " revision index for " + asset.id);
          }
          revisionNumbers.add(revision);
          if (revision === expectedCurrent) latest = row;
          if (!validStorageKey(row.storage_key, format) || references.has(row.storage_key)) {
            fail("invalid or duplicate " + format + " binary key for " + asset.id);
          }
          const expectedExtension = info.ext(row.mime);
          if (!expectedExtension || !row.storage_key.toLowerCase().endsWith(expectedExtension)) {
            fail("mismatched " + format + " file extension for " + asset.id);
          }
          if (!Number.isSafeInteger(Number(row.size)) || Number(row.size) < 1 ||
              !SHA.test(String(row.sha256))) {
            fail("invalid " + format + " checksum or byte length for " + asset.id);
          }
          references.add(row.storage_key);
          const location = path.join(folder, row.storage_key);
          let stat;
          try { stat = await lstat(location); } catch (err) {
            if (err.code === "ENOENT") fail("missing " + format + " binary for " + asset.id +
              " revision " + revision);
            throw err;
          }
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== row.size ||
              (await digestFile(location)) !== row.sha256) {
            fail("invalid " + format + " binary for " + asset.id + " revision " + revision);
          }
          report.checkedVersions++;
          report.checkedBytes += stat.size;
        }
        if (!latest || latest.size !== asset.size || latest.sha256 !== asset.sha256 ||
            (format === "image" && latest.mime !== asset.mime)) {
          fail("current " + format + " revision does not match catalog for " + asset.id);
        }
        report.checkedAssets++;
      }
      if (byId.size) fail("orphan " + format + " version metadata");
      try {
        const folderStat = await lstat(folder);
        if (!folderStat.isDirectory() || folderStat.isSymbolicLink()) {
          fail("unsafe " + format + " asset directory");
        }
        const files = await readdir(folder, { withFileTypes: true });
        for (const entry of files) {
          if (entry.isSymbolicLink() || !entry.isFile()) {
            fail("unsafe file in " + format + " asset directory");
          }
          if (!references.has(entry.name)) report.unreferencedFiles++;
        }
      } catch (err) {
        if (err.code !== "ENOENT" || assets.length) throw err;
      }
    }
    return report;
  } finally { database.close(); }
}
