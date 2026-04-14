import { classifyRuntimeFailure } from "./runtime.failureClassifier.js";

export function buildRecoveryState({ error, step = {} } = {}) {
  const failureType = classifyRuntimeFailure(error);

  return {
    stepId: step.id || "",
    type: step.type || "",
    failureType,
    suggestion:
      failureType === "browser"
        ? "retry_with_browser_reset"
        : failureType === "network"
          ? "retry_with_backoff"
          : failureType === "tool_provider"
            ? "fallback_provider_or_prudent_response"
            : failureType === "permission"
              ? "avoid_denied_tool"
              : "graceful_fallback",
    error: String(error?.message || error || ""),
    at: new Date().toISOString()
  };
}

export default {
  buildRecoveryState
};
