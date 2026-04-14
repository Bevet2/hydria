export async function runProjectFixLoop({
  policy,
  workspacePath = "",
  installResult = null,
  runResult = null,
  autoFixer,
  rerunInstall,
  rerunRun,
  onAttempt = null
} = {}) {
  const correctionsApplied = [];
  const attempts = [];

  let currentInstall = installResult;
  let currentRun = runResult;
  let attempt = 0;

  while (true) {
    const analysis =
      currentInstall?.status === "failed"
        ? currentInstall.analysis
        : currentRun?.status === "failed"
          ? currentRun.analysis
          : null;
    if (!analysis || !policy?.canRetry(attempt, analysis)) {
      break;
    }

    const fix = await autoFixer.applyFix({
      workspacePath,
      analysis
    });
    if (!fix) {
      break;
    }

    attempt += 1;
    correctionsApplied.push(fix);
    attempts.push({
      attempt,
      issue: analysis.type,
      fix: fix.summary
    });
    if (typeof onAttempt === "function") {
      await onAttempt({
        attempt,
        analysis,
        fix
      });
    }

    if (currentInstall?.status === "failed") {
      currentInstall = await rerunInstall();
      if (currentInstall.status !== "passed") {
        continue;
      }
      currentRun = await rerunRun();
      continue;
    }

    currentRun = await rerunRun();
  }

  const issues = [];
  if (currentInstall?.status === "failed") {
    issues.push("install_failed");
  }
  if (currentRun?.status === "failed") {
    issues.push("run_failed");
  }

  return {
    attempts,
    correctionsApplied,
    install: currentInstall,
    run: currentRun,
    issues,
    suggestedNextStep: issues.length ? "manual_fix_or_retry" : "ready_for_validation"
  };
}

export default {
  runProjectFixLoop
};
