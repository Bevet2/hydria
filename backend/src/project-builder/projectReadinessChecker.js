import fs from "node:fs";
import path from "node:path";
import { readPackageJson } from "./projectUtils.js";

export function checkProjectReadiness({
  workspacePath = "",
  installResult = null,
  runResult = null,
  manifestPath = "",
  createdFiles = []
} = {}) {
  const packageJson = readPackageJson(workspacePath);
  const requiredFiles = [
    "package.json",
    "README.md",
    ".env.example",
    path.basename(manifestPath || "hydria.manifest.json")
  ];
  const presentFiles = requiredFiles.filter((file) =>
    fs.existsSync(path.join(workspacePath, file))
  );
  const missingFiles = requiredFiles.filter((file) => !presentFiles.includes(file));
  const hasNodeModules = fs.existsSync(path.join(workspacePath, "node_modules"));
  const hasEnv = fs.existsSync(path.join(workspacePath, ".env"));
  const scripts = packageJson.data?.scripts || {};

  const issues = [];
  if (installResult?.status !== "passed") {
    issues.push("dependencies_not_installed");
  }
  if (runResult?.status !== "passed") {
    issues.push("run_not_validated");
  }
  if (missingFiles.length) {
    issues.push("missing_essential_files");
  }
  if (!scripts.start && !scripts.dev) {
    issues.push("missing_run_script");
  }

  return {
    status: issues.length ? "failed" : "passed",
    issues,
    checks: {
      dependenciesInstalled: Boolean(hasNodeModules && installResult?.status === "passed"),
      runValidated: runResult?.status === "passed",
      essentialFilesPresent: missingFiles.length === 0,
      manifestPresent: Boolean(manifestPath && fs.existsSync(manifestPath)),
      readmePresent: presentFiles.includes("README.md"),
      envPresent: hasEnv || presentFiles.includes(".env.example")
    },
    missingFiles,
    mainFiles: [...new Set(createdFiles)].slice(0, 12)
  };
}

export default {
  checkProjectReadiness
};
