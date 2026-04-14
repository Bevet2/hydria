export const PLAN_STEP_TYPES = Object.freeze([
  "memory",
  "knowledge",
  "api",
  "web",
  "tool",
  "llm",
  "artifact"
]);

export const MEMORY_KINDS = Object.freeze([
  "short_term",
  "working",
  "long_term",
  "task_outcome"
]);

export const EVAL_STATUSES = Object.freeze(["success", "partial", "failed"]);

export function createStepId(prefix, index) {
  return `${prefix}_${String(index + 1).padStart(2, "0")}`;
}
