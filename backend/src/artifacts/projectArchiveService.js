import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

function shouldSkipEntry(relativePath = "") {
  return /(^|\/)(node_modules|\.git)(\/|$)/i.test(relativePath);
}

function collectWorkspaceEntries(rootPath, currentPath = rootPath, results = []) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, "/");

    if (shouldSkipEntry(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectWorkspaceEntries(rootPath, absolutePath, results);
      continue;
    }

    results.push({
      absolutePath,
      relativePath
    });
  }

  return results;
}

export class ProjectArchiveService {
  constructor({ artifactRoot }) {
    this.artifactRoot = artifactRoot;
    fs.mkdirSync(this.artifactRoot, { recursive: true });
  }

  buildArchivePath({ projectName = "hydria-project", version = "0.1.0" } = {}) {
    const safeName = String(projectName || "hydria-project")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "hydria-project";
    return path.join(this.artifactRoot, `${safeName}-${version}.zip`);
  }

  async createArchive({
    workspacePath = "",
    projectName = "hydria-project",
    version = "0.1.0",
    extraFiles = []
  } = {}) {
    const zip = new AdmZip();
    const entries = collectWorkspaceEntries(workspacePath);

    for (const entry of entries) {
      const localPath = path.dirname(entry.relativePath);
      zip.addLocalFile(
        entry.absolutePath,
        localPath === "." ? "" : localPath,
        path.basename(entry.relativePath)
      );
    }

    for (const extraFile of extraFiles) {
      if (!extraFile?.absolutePath || !fs.existsSync(extraFile.absolutePath)) {
        continue;
      }

      const relativePath = String(extraFile.relativePath || path.basename(extraFile.absolutePath)).replace(/\\/g, "/");
      zip.addLocalFile(
        extraFile.absolutePath,
        path.dirname(relativePath) === "." ? "" : path.dirname(relativePath),
        path.basename(relativePath)
      );
    }

    const archivePath = this.buildArchivePath({ projectName, version });
    zip.writeZip(archivePath);

    const stats = fs.statSync(archivePath);
    return {
      absolutePath: archivePath,
      sizeBytes: stats.size
    };
  }
}

export default ProjectArchiveService;
