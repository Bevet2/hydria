export function buildDeployPlan({ project } = {}) {
  return {
    ready: Boolean(project?.workspacePath),
    steps: [
      "define target environment",
      "prepare environment variables",
      "package build artifact",
      "run smoke checks after deployment"
    ]
  };
}

export default {
  buildDeployPlan
};
