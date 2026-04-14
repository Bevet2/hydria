import fs from "node:fs";
import path from "node:path";
import { readPackageJson } from "./projectUtils.js";

const KNOWN_DEPENDENCY_VERSIONS = {
  bcryptjs: "^2.4.3",
  cors: "^2.8.5",
  dotenv: "^16.4.5",
  express: "^4.19.2",
  helmet: "^7.1.0",
  jsonwebtoken: "^9.0.2",
  morgan: "^1.10.0"
};

function isSafePackageName(value = "") {
  return /^[a-z0-9@/_-]+$/i.test(String(value || "").trim());
}

function listFiles(rootPath, currentPath = rootPath, results = []) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    if (["node_modules", ".git"].includes(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      listFiles(rootPath, absolutePath, results);
      continue;
    }
    results.push(absolutePath);
  }
  return results;
}

function addJsExtensionIfMissing(value = "") {
  if (!value || /\.[a-z0-9]+$/i.test(value)) {
    return value;
  }
  return `${value}.js`;
}

function patchImportPath(fileContent = "", fromPath = "", toPath = "") {
  return fileContent.split(fromPath).join(toPath);
}

export class ProjectAutoFixer {
  constructor({ runtimeAdapter }) {
    this.runtimeAdapter = runtimeAdapter;
  }

  async fixMissingEnv(workspacePath) {
    const envExample = path.join(workspacePath, ".env.example");
    const envFile = path.join(workspacePath, ".env");
    if (!fs.existsSync(envExample) || fs.existsSync(envFile)) {
      return null;
    }

    await this.runtimeAdapter.copyFile(envExample, envFile);
    return {
      type: "missing_env",
      summary: "Copied .env.example to .env",
      filesChanged: [".env"]
    };
  }

  async fixMissingScript(workspacePath) {
    const packageJson = readPackageJson(workspacePath);
    if (!packageJson.exists) {
      return null;
    }

    const scripts = packageJson.data.scripts || {};
    let changed = false;

    if (!scripts.start && fs.existsSync(path.join(workspacePath, "src", "server.js"))) {
      scripts.start = "node src/server.js";
      changed = true;
    }
    if (!scripts.dev && fs.existsSync(path.join(workspacePath, "src", "server.js"))) {
      scripts.dev = "node --watch src/server.js";
      changed = true;
    }

    if (!changed) {
      return null;
    }

    packageJson.data.scripts = scripts;
    await this.runtimeAdapter.writeJsonFile(packageJson.path, packageJson.data);
    return {
      type: "missing_script",
      summary: "Added default start/dev scripts to package.json",
      filesChanged: ["package.json"]
    };
  }

  async fixMissingDependency(workspacePath, packageName = "") {
    if (!isSafePackageName(packageName)) {
      return null;
    }

    const packageJson = readPackageJson(workspacePath);
    if (!packageJson.exists) {
      return null;
    }

    const dependencies = packageJson.data.dependencies || {};
    const devDependencies = packageJson.data.devDependencies || {};
    if (dependencies[packageName] || devDependencies[packageName]) {
      return null;
    }

    dependencies[packageName] = KNOWN_DEPENDENCY_VERSIONS[packageName] || "latest";
    packageJson.data.dependencies = dependencies;
    await this.runtimeAdapter.writeJsonFile(packageJson.path, packageJson.data);
    return {
      type: "missing_dependency",
      summary: `Added dependency ${packageName} to package.json`,
      filesChanged: ["package.json"]
    };
  }

  async fixBrokenImport(workspacePath, analysis = {}) {
    const importPath = String(analysis.importPath || "");
    const importerPath = String(analysis.importerPath || "");
    if (!importPath.startsWith(".") || !importerPath) {
      return null;
    }

    const importerAbsolute = path.isAbsolute(importerPath)
      ? importerPath
      : path.join(workspacePath, importerPath);
    if (!fs.existsSync(importerAbsolute)) {
      return null;
    }

    const targetBaseName = path.basename(importPath);
    const candidates = listFiles(workspacePath).filter((filePath) =>
      path.basename(filePath) === targetBaseName || path.basename(filePath) === addJsExtensionIfMissing(targetBaseName)
    );
    if (candidates.length !== 1) {
      return null;
    }

    const relativeTarget = path.relative(
      path.dirname(importerAbsolute),
      candidates[0]
    ).replace(/\\/g, "/");
    const normalizedTarget = relativeTarget.startsWith(".")
      ? relativeTarget
      : `./${relativeTarget}`;

    const originalContent = await this.runtimeAdapter.readFile(importerAbsolute);
    const nextContent = patchImportPath(
      originalContent,
      importPath,
      addJsExtensionIfMissing(normalizedTarget)
    );
    if (nextContent === originalContent) {
      return null;
    }

    await this.runtimeAdapter.writeFile(importerAbsolute, nextContent);
    return {
      type: "broken_import",
      summary: `Patched import ${importPath} in ${path.relative(workspacePath, importerAbsolute).replace(/\\/g, "/")}`,
      filesChanged: [path.relative(workspacePath, importerAbsolute).replace(/\\/g, "/")]
    };
  }

  async fixSimpleSyntax(workspacePath, analysis = {}) {
    const filePath = String(analysis.filePath || "");
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(workspacePath, filePath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return null;
    }

    const packageJson = readPackageJson(workspacePath);
    if (
      /cannot use import statement outside a module|unexpected token 'export'/i.test(
        String(analysis.output || "")
      ) &&
      packageJson.exists &&
      packageJson.data.type !== "module"
    ) {
      packageJson.data.type = "module";
      await this.runtimeAdapter.writeJsonFile(packageJson.path, packageJson.data);
      return {
        type: "syntax_error",
        summary: 'Set package.json "type" to "module" for ESM compatibility',
        filesChanged: ["package.json"]
      };
    }

    return null;
  }

  async applyFix({ workspacePath = "", analysis = null } = {}) {
    if (!analysis?.type) {
      return null;
    }

    if (analysis.type === "missing_env") {
      return this.fixMissingEnv(workspacePath);
    }
    if (analysis.type === "missing_script") {
      return this.fixMissingScript(workspacePath);
    }
    if (analysis.type === "missing_dependency") {
      return this.fixMissingDependency(workspacePath, analysis.packageName);
    }
    if (analysis.type === "broken_import") {
      return this.fixBrokenImport(workspacePath, analysis);
    }
    if (analysis.type === "syntax_error") {
      return this.fixSimpleSyntax(workspacePath, analysis);
    }

    return null;
  }
}

export default ProjectAutoFixer;
