import fs from "node:fs";
import path from "node:path";

function listWorkspaceFiles(rootPath, currentPath = rootPath, results = []) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (["node_modules", ".git"].includes(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      listWorkspaceFiles(rootPath, absolutePath, results);
      continue;
    }

    results.push(relativePath);
  }

  return results;
}

export function buildExportManifest({
  project = null,
  workspacePath = "",
  templateId = "",
  createdFiles = [],
  mainStructure = [],
  nextCommands = [],
  delivery = {}
} = {}) {
  const exportedFiles = workspacePath && fs.existsSync(workspacePath)
    ? listWorkspaceFiles(workspacePath)
    : [...new Set(createdFiles)];

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    project: project
      ? {
          id: project.id,
          name: project.name,
          type: project.type,
          status: project.status,
          dimensions: project.dimensions || [],
          internalCapabilities: project.internalCapabilities || [],
          globalProject: project.globalProject || null
        }
      : null,
    templateId,
    workspacePath,
    mainFiles: exportedFiles.slice(0, 30),
    createdFiles,
    mainStructure,
    nextCommands,
    delivery: {
      status: delivery.status || "scaffolded",
      packageManager: delivery.packageManager || "npm",
      install: delivery.install || { status: "skipped" },
      run: delivery.run || { status: "skipped" },
      validation: delivery.validation || { status: "skipped" },
      correctionsApplied: delivery.correctionsApplied || []
    }
  };
}

export default {
  buildExportManifest
};
