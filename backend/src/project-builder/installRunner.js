import { analyzeInstallError } from "../runtime/installErrorAnalyzer.js";
import { buildCommand } from "./projectUtils.js";

export async function runProjectInstall({
  runtimeAdapter,
  workspacePath = "",
  packageManager = "npm",
  timeoutMs = 180000
} = {}) {
  if (!runtimeAdapter || !workspacePath) {
    return {
      status: "skipped",
      command: "",
      output: "",
      analysis: null
    };
  }

  const command = buildCommand(packageManager, "install");
  const result = await runtimeAdapter.runCommand({
    command,
    cwd: workspacePath,
    timeoutMs
  });

  return {
    status: result.success ? "passed" : "failed",
    command,
    output: result.output || result.error || "",
    durationMs: result.durationMs || 0,
    analysis: result.success ? null : analyzeInstallError(result.output || result.error || "")
  };
}

export default {
  runProjectInstall
};
