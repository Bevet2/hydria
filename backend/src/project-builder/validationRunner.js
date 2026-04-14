import { runProjectBuild } from "./buildRunner.js";
import { runProjectTests } from "./testRunner.js";
import { checkProjectReadiness } from "./projectReadinessChecker.js";
import { buildCommand, readPackageJson } from "./projectUtils.js";

export async function runProjectValidation({
  runtimeAdapter,
  workspacePath = "",
  packageManager = "npm",
  installResult = null,
  runResult = null,
  manifestPath = "",
  createdFiles = []
} = {}) {
  const packageJson = readPackageJson(workspacePath);
  const scripts = packageJson.data?.scripts || {};

  const shouldRunBuildAndTest = installResult?.status === "passed";
  const build = shouldRunBuildAndTest
    ? await runProjectBuild({
        runtimeAdapter,
        workspacePath,
        commands: scripts.build ? [buildCommand(packageManager, "build")] : []
      })
    : { status: "skipped", command: "", output: "" };
  const test = shouldRunBuildAndTest
    ? await runProjectTests({
        runtimeAdapter,
        workspacePath,
        commands: scripts.test ? [buildCommand(packageManager, "test")] : []
      })
    : { status: "skipped", command: "", output: "" };
  const readiness = checkProjectReadiness({
    workspacePath,
    installResult,
    runResult,
    manifestPath,
    createdFiles
  });

  return {
    status:
      readiness.status === "passed" &&
      build.status !== "failed" &&
      test.status !== "failed"
        ? "passed"
        : "failed",
    build,
    test,
    readiness
  };
}

export default {
  runProjectValidation
};
