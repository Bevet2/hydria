export function buildMonitorPlan({ project } = {}) {
  return {
    projectId: project?.id || "",
    checks: [
      "health endpoint",
      "runtime error logs",
      "build/test regression checks",
      "user-facing critical flow smoke test"
    ]
  };
}

export default {
  buildMonitorPlan
};
