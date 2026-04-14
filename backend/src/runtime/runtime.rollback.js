export function buildRollbackPlan({ step = {}, input = {} } = {}) {
  if (step.type === "tool" && step.toolId === "browser_automation") {
    return {
      type: "browser_reset",
      reason: "browser action failed",
      sessionId: input.sessionId || null
    };
  }

  if (step.type === "tool" && step.toolId === "artifact_generator") {
    return {
      type: "artifact_cleanup",
      reason: "artifact generation failed",
      path: input.workspacePath || ""
    };
  }

  return {
    type: "noop",
    reason: "no rollback required"
  };
}

export default {
  buildRollbackPlan
};
