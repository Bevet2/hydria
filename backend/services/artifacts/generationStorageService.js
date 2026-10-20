import fs from "node:fs/promises";
import path from "node:path";
import config from "../../config/hydria.config.js";
import { nowIso } from "../../utils/time.js";
import { slugifyFilename } from "./generators/shared.js";
import { atomicWriteFile } from "../../utils/durableFiles.js";
import { withKeyedLock } from "../../utils/keyedLock.js";
import { AppError } from "../../utils/errors.js";

async function ensureArtifactStorage() {
  await fs.mkdir(config.paths.generatedArtifactsDir, { recursive: true });
}

async function loadIndex() {
  await ensureArtifactStorage();

  try {
    const raw = await fs.readFile(config.paths.generatedArtifactsIndex, "utf8");
    const records = JSON.parse(raw);
    if (!Array.isArray(records)) throw Error("Invalid artifact index");
    return records;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new AppError("Artifact index is unreadable; restore a verified backup", 503);
  }
}

async function saveIndex(records) {
  await ensureArtifactStorage();
  atomicWriteFile(config.paths.generatedArtifactsIndex, JSON.stringify(records, null, 2));
}

async function upsertRecord(record) {
  return withKeyedLock(config.paths.generatedArtifactsIndex, async () => {
    const records = await loadIndex();
    const next = records.filter(entry => entry.id !== record.id);
    next.push(record);
    await saveIndex(next);
  });
}

export async function persistGeneratedArtifact({
  artifactId,
  title,
  format,
  extension,
  mimeType,
  buffer,
  conversationId,
  userId
}) {
  await ensureArtifactStorage();

  const safeBase = slugifyFilename(title || "hydria-document");
  const fileExtension = String(extension || format || "bin")
    .replace(/^\.+/, "")
    .trim();
  const filename = `${safeBase}.${fileExtension}`;
  const storedName = `${artifactId}-${filename}`;
  const absolutePath = path.join(config.paths.generatedArtifactsDir, storedName);
  await fs.writeFile(absolutePath, buffer);

  const record = {
    id: artifactId,
    title: title || "Hydria Document",
    filename,
    storedName,
    format,
    extension: fileExtension,
    mimeType,
    sizeBytes: buffer.length,
    conversationId,
    userId,
    createdAt: nowIso()
  };

  await upsertRecord(record);

  return {
    type: "generated_file",
    id: record.id,
    title: record.title,
    filename: record.filename,
    format: record.format,
    extension: record.extension,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    downloadUrl: `/api/artifacts/${record.id}/download`
  };
}

export async function persistExternalGeneratedArtifact({
  artifactId,
  title,
  format,
  extension,
  mimeType,
  absolutePath,
  sizeBytes,
  conversationId,
  userId
}) {
  await ensureArtifactStorage();

  const safeBase = slugifyFilename(title || "hydria-artifact");
  const fileExtension = String(extension || format || path.extname(absolutePath || "") || "bin")
    .replace(/^\.+/, "")
    .trim();
  const filename = `${safeBase}.${fileExtension}`;

  const record = {
    id: artifactId,
    title: title || "Hydria Artifact",
    filename,
    storedName: path.basename(absolutePath || filename),
    format,
    extension: fileExtension,
    mimeType,
    sizeBytes: Number(sizeBytes || 0),
    conversationId,
    userId,
    createdAt: nowIso(),
    absolutePath
  };

  await upsertRecord(record);

  return {
    type: "generated_file",
    id: record.id,
    title: record.title,
    filename: record.filename,
    format: record.format,
    extension: record.extension,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    downloadUrl: `/api/artifacts/${record.id}/download`
  };
}

export async function getGeneratedArtifactById(artifactId) {
  const records = await loadIndex();
  const record = records.find((entry) => entry.id === artifactId);

  if (!record) {
    return null;
  }

  return {
    ...record,
    absolutePath:
      record.absolutePath ||
      path.join(config.paths.generatedArtifactsDir, record.storedName)
  };
}
