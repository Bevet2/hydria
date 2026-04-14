import fs from "node:fs/promises";
import path from "node:path";
import config from "../../config/hydria.config.js";
import { runCommand } from "./commandRunner.js";
import { inspectWorkspace } from "./workspaceInspectorService.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function truncate(value = "", maxChars = 260) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

async function findPackageJsonFiles(rootDir, currentDir = rootDir, bucket = []) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist", "build", "coverage", "data"].includes(entry.name)) {
        continue;
      }

      await findPackageJsonFiles(rootDir, absolutePath, bucket);
      continue;
    }

    if (entry.name === "package.json") {
      bucket.push(absolutePath);
    }
  }

  return bucket;
}

function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function pickScripts(prompt, scripts = {}) {
  const normalized = normalizeText(prompt);
  const wanted = [];

  if (/\btest|tests|failing|failed|bug|bugs|error|errors|debug\b/.test(normalized) && scripts.test) {
    wanted.push("test");
  }

  if (/\blint|warning|warnings|style|eslint\b/.test(normalized) && scripts.lint) {
    wanted.push("lint");
  }

  if (/\bbuild|compile|render|frontend|ui|page|preview\b/.test(normalized) && scripts.build) {
    wanted.push("build");
  }

  if (!wanted.length) {
    for (const fallback of ["lint", "test", "build"]) {
      if (scripts[fallback]) {
        wanted.push(fallback);
      }
    }
  }

  return [...new Set(wanted)].slice(0, 2);
}

async function runPackageDiagnostics(prompt) {
  const packageFiles = await findPackageJsonFiles(config.tools.workspaceRoot);
  const reports = [];

  for (const packageFile of packageFiles.slice(0, 4)) {
    const cwd = path.dirname(packageFile);
    let parsed;

    try {
      parsed = JSON.parse(await fs.readFile(packageFile, "utf8"));
    } catch {
      continue;
    }

    const scripts = parsed.scripts || {};
    const selected = pickScripts(prompt, scripts);

    for (const scriptName of selected) {
      const result = await runCommand(npmExecutable(), ["run", scriptName], {
        cwd,
        timeoutMs: Math.min(config.tools.timeoutMs, 30000)
      });

      reports.push({
        kind: "npm_script",
        cwd,
        scriptName,
        ...result
      });
    }
  }

  return reports;
}

async function runSyntaxChecks(prompt) {
  const inspection = await inspectWorkspace(prompt);
  const syntaxTargets = (inspection.normalized?.relevantFiles || [])
    .filter((file) => /\.(m?js|cjs)$/i.test(file))
    .slice(0, 3);
  const reports = [];

  for (const relativeFile of syntaxTargets) {
    const absolutePath = path.join(config.tools.workspaceRoot, relativeFile);
    const result = await runCommand(process.execPath, ["--check", absolutePath], {
      cwd: config.tools.workspaceRoot,
      timeoutMs: Math.min(config.tools.timeoutMs, 15000)
    });
    reports.push({
      kind: "syntax_check",
      file: relativeFile,
      ...result
    });
  }

  return reports;
}

export async function runDiagnostics(prompt = "") {
  const packageReports = await runPackageDiagnostics(prompt);
  const syntaxReports = await runSyntaxChecks(prompt);
  const reports = [...packageReports, ...syntaxReports];

  if (!reports.length) {
    return {
      providerId: "diagnostics_runner",
      sourceType: "tool",
      sourceName: "Diagnostics Runner",
      capability: "run_diagnostics",
      raw: { reports: [] },
      normalized: { reports: [] },
      summaryText: "No standard diagnostics were available for the current workspace."
    };
  }

  const summaryText = reports
    .map((report) => {
      const label =
        report.kind === "npm_script"
          ? `${path.relative(config.tools.workspaceRoot, report.cwd) || "."}: npm run ${report.scriptName}`
          : `${report.file}: node --check`;
      const status = report.success ? "ok" : `failed${report.exitCode !== null ? ` (${report.exitCode})` : ""}`;
      const details = truncate(report.stderr || report.stdout || "", 220);
      return `${label} -> ${status}${details ? ` | ${details}` : ""}`;
    })
    .join("\n");

  return {
    providerId: "diagnostics_runner",
    sourceType: "tool",
    sourceName: "Diagnostics Runner",
    capability: "run_diagnostics",
    raw: { reports },
    normalized: { reports },
    summaryText
  };
}
