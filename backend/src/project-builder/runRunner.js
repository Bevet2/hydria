import { analyzeProjectRunError } from "../runtime/projectRunErrorAnalyzer.js";
import { buildCommand, readPackageJson } from "./projectUtils.js";

function resolveRunCommand({ packageManager = "npm", scripts = {} } = {}) {
  if (scripts.start) {
    return buildCommand(packageManager, "start");
  }
  if (scripts.dev) {
    return buildCommand(packageManager, "dev");
  }
  return "";
}

export async function runProjectSmoke({
  runtimeAdapter,
  workspacePath = "",
  packageManager = "npm",
  timeoutMs = 7000,
  graceMs = 600
} = {}) {
  if (!runtimeAdapter || !workspacePath) {
    return {
      status: "skipped",
      command: "",
      output: "",
      analysis: null
    };
  }

  const packageJson = readPackageJson(workspacePath);
  const scripts = packageJson.data?.scripts || {};
  const command = resolveRunCommand({
    packageManager,
    scripts
  });

  if (!command) {
    return {
      status: "failed",
      command: "",
      output: "Missing start/dev script",
      analysis: {
        type: "missing_script",
        retryable: true,
        fixable: true,
        reason: "missing_script"
      }
    };
  }

  const result = await runtimeAdapter.runMonitoredCommand({
    command,
    cwd: workspacePath,
    timeoutMs,
    graceMs,
    env: {
      PORT: "0"
    }
  });

  return {
    status: result.success ? "passed" : "failed",
    command,
    output: result.output || result.error || "",
    durationMs: result.durationMs || 0,
    readyMatched: Boolean(result.readyMatched),
    timedOutWhileRunning: Boolean(result.timedOutWhileRunning),
    analysis: result.success ? null : analyzeProjectRunError(result.output || result.error || "")
  };
}

export default {
  runProjectSmoke
};
