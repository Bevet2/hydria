import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { persistExternalGeneratedArtifact } from "../../services/artifacts/generationStorageService.js";
import { buildExportManifest } from "./exportManifestBuilder.js";

export class ArtifactExporter {
  constructor({ archiveService, artifactRoot }) {
    this.archiveService = archiveService;
    this.artifactRoot = artifactRoot;
    fs.mkdirSync(this.artifactRoot, { recursive: true });
  }

  async exportProject({
    project = null,
    workspacePath = "",
    templateId = "",
    createdFiles = [],
    mainStructure = [],
    nextCommands = [],
    delivery = {},
    conversationId = null,
    userId = null
  } = {}) {
    const manifest = buildExportManifest({
      project,
      workspacePath,
      templateId,
      createdFiles,
      mainStructure,
      nextCommands,
      delivery
    });
    const baseName = String(project?.name || "hydria-project")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "hydria-project";
    const manifestPath = path.join(this.artifactRoot, `${baseName}-delivery-manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    const archive = await this.archiveService.createArchive({
      workspacePath,
      projectName: project?.name || "hydria-project",
      version: project?.currentVersion || "0.1.0",
      extraFiles: [
        {
          absolutePath: manifestPath,
          relativePath: "hydria.delivery.manifest.json"
        }
      ]
    });

    const artifact = await persistExternalGeneratedArtifact({
      artifactId: randomUUID(),
      title: `${project?.name || "hydria-project"} export`,
      format: "zip",
      extension: "zip",
      mimeType: "application/zip",
      absolutePath: archive.absolutePath,
      sizeBytes: archive.sizeBytes,
      conversationId,
      userId
    });

    return {
      artifact,
      manifest,
      manifestPath,
      archivePath: archive.absolutePath,
      sizeBytes: archive.sizeBytes
    };
  }
}

export default ArtifactExporter;
