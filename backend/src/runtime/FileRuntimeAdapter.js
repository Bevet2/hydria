import fs from "node:fs";
import path from "node:path";

function isWithinRoot(rootDir, candidatePath) {
  const relative = path.relative(rootDir, candidatePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export class FileRuntimeAdapter {
  constructor({ workspaceRoot }) {
    this.workspaceRoot = workspaceRoot;
  }

  resolveSafePath(targetPath) {
    const resolved = path.resolve(this.workspaceRoot, targetPath || ".");
    if (resolved !== this.workspaceRoot && !isWithinRoot(this.workspaceRoot, resolved)) {
      throw new Error(`Path is outside the workspace root: ${targetPath}`);
    }

    return resolved;
  }

  readText(targetPath, encoding = "utf8") {
    return fs.readFileSync(this.resolveSafePath(targetPath), encoding);
  }

  writeText(targetPath, content = "", encoding = "utf8") {
    const safePath = this.resolveSafePath(targetPath);
    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    fs.writeFileSync(safePath, content, encoding);
    return safePath;
  }

  writeJson(targetPath, value = {}) {
    return this.writeText(targetPath, JSON.stringify(value, null, 2));
  }

  copy(fromPath, toPath) {
    const sourcePath = this.resolveSafePath(fromPath);
    const targetPath = this.resolveSafePath(toPath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    return targetPath;
  }

  exists(targetPath) {
    return fs.existsSync(this.resolveSafePath(targetPath));
  }

  list(targetPath = ".") {
    return fs
      .readdirSync(this.resolveSafePath(targetPath), { withFileTypes: true })
      .map((entry) => ({
        name: entry.name,
        kind: entry.isDirectory() ? "directory" : "file"
      }));
  }

  stat(targetPath) {
    const stats = fs.statSync(this.resolveSafePath(targetPath));
    return {
      size: stats.size,
      isDirectory: stats.isDirectory(),
      modifiedAt: stats.mtime.toISOString()
    };
  }
}

export default FileRuntimeAdapter;
