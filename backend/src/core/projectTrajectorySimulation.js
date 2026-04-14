function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function clamp(value = 0) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function createTrajectory(id, options = {}) {
  return {
    id,
    label: options.label || id,
    score: 0.2,
    impactScore: 0,
    continuityScore: 0,
    executionScore: 0,
    riskScore: 0,
    shouldTrackProject: Boolean(options.shouldTrackProject),
    shouldLinkToProject: Boolean(options.shouldLinkToProject),
    shouldCreateProject: Boolean(options.shouldCreateProject),
    shouldCreateBranch: Boolean(options.shouldCreateBranch),
    shouldUseProjectBuilder: Boolean(options.shouldUseProjectBuilder),
    deliveryDepth: options.deliveryDepth || "none",
    targetOperation: options.targetOperation || "none",
    reasons: []
  };
}

function addReason(trajectory, message, delta = 0, field = "") {
  trajectory.reasons.push(message);
  trajectory.score += delta;
  if (field && typeof trajectory[field] === "number") {
    trajectory[field] += delta;
  }
}

function needsDelivery(prompt = "") {
  return /\b(prete?|pret|lancer|launch|ready to run|assure qu.?elle demarre|validate the run|valide le run|demarre|start it|deploy|livre|delivery)\b/i.test(
    normalizeText(prompt)
  );
}

function isProjectShape(shape = "") {
  return ["project", "app", "code_project"].includes(String(shape || "").trim().toLowerCase());
}

export function simulateProjectTrajectories({
  prompt = "",
  intentProfile = null,
  environmentPlan = null,
  executionIntent = null,
  activeProject = null,
  activeWorkObject = null,
  globalProjectContext = null
} = {}) {
  const normalizedPrompt = normalizeText(prompt);
  const projectShape = isProjectShape(intentProfile?.requestedShape?.shape || "");
  const hasProject = Boolean(activeProject?.id || activeWorkObject?.projectId);
  const explicitNew = Boolean(intentProfile?.explicitNewEnvironment);
  const continuationSignals = Boolean(intentProfile?.continuationSignals);
  const deliveryNeeded = needsDelivery(normalizedPrompt);
  const ambiguity = intentProfile?.ambiguity?.level || "low";
  const trajectories = [];

  if (hasProject && !projectShape) {
    trajectories.push(
      createTrajectory("linked_object_extension", {
        label: "Extend current project with linked object",
        shouldTrackProject: true,
        shouldLinkToProject: true,
        targetOperation: "extend_current_project",
        deliveryDepth: "none"
      })
    );
  }

  if (projectShape && hasProject && !explicitNew) {
    trajectories.push(
      createTrajectory("extend_project_shell", {
        label: "Extend current project shell",
        shouldTrackProject: true,
        shouldLinkToProject: true,
        shouldUseProjectBuilder: true,
        targetOperation: "extend_current_project",
        deliveryDepth: deliveryNeeded ? "full" : "shell"
      })
    );
  }

  if (projectShape && (explicitNew || !hasProject)) {
    trajectories.push(
      createTrajectory("new_project_branch", {
        label: "Create new project branch",
        shouldTrackProject: true,
        shouldCreateProject: true,
        shouldCreateBranch: hasProject || explicitNew,
        shouldUseProjectBuilder: true,
        targetOperation: "create_new_project",
        deliveryDepth: deliveryNeeded ? "full" : "shell"
      })
    );
  }

  if (projectShape && executionIntent?.action === "project_scaffold") {
    trajectories.push(
      createTrajectory("full_delivery_project", {
        label: "Project with delivery loop",
        shouldTrackProject: true,
        shouldCreateProject: !hasProject || explicitNew,
        shouldLinkToProject: hasProject && !explicitNew,
        shouldUseProjectBuilder: true,
        targetOperation:
          hasProject && !explicitNew ? "extend_current_project" : "create_new_project",
        deliveryDepth: "full"
      })
    );
  }

  if (!trajectories.length) {
    trajectories.push(
      createTrajectory("object_only", {
        label: "Standalone object",
        shouldTrackProject: false,
        shouldLinkToProject: false,
        shouldCreateProject: false,
        shouldUseProjectBuilder: false,
        targetOperation: "none",
        deliveryDepth: "none"
      })
    );
  }

  for (const trajectory of trajectories) {
    if (trajectory.targetOperation === environmentPlan?.projectOperation) {
      addReason(trajectory, "matches the selected environment scenario", 0.22, "impactScore");
    }

    if (trajectory.id === "linked_object_extension") {
      if (hasProject && !projectShape) {
        addReason(trajectory, "best fit for adding a new object inside the current project", 0.3, "impactScore");
      }
      if (continuationSignals) {
        addReason(trajectory, "keeps the project continuity visible", 0.18, "continuityScore");
      }
      addReason(trajectory, "light execution cost", 0.08, "executionScore");
    }

    if (trajectory.id === "extend_project_shell") {
      if (hasProject && projectShape && !explicitNew) {
        addReason(trajectory, "extends the current project instead of fragmenting it", 0.28, "continuityScore");
      }
      if (deliveryNeeded) {
        addReason(trajectory, "project should probably run and validate after the update", 0.08, "executionScore");
      }
    }

    if (trajectory.id === "new_project_branch") {
      if (explicitNew || !hasProject) {
        addReason(trajectory, "respects the need for a fresh project boundary", 0.28, "impactScore");
      }
      if (hasProject && explicitNew) {
        addReason(trajectory, "avoids polluting the current project", 0.14, "continuityScore");
      }
      if (deliveryNeeded) {
        addReason(trajectory, "a plain new project branch is not enough when the prompt expects a runnable delivery", -0.12, "executionScore");
      }
    }

    if (trajectory.id === "full_delivery_project") {
      if (deliveryNeeded) {
        addReason(trajectory, "delivery loop is justified by a run/launch expectation", 0.4, "executionScore");
      } else {
        addReason(trajectory, "full delivery remains useful when the task clearly targets an app or project", 0.08, "executionScore");
      }
      if (ambiguity === "high") {
        addReason(trajectory, "full delivery is riskier under ambiguity", -0.14, "riskScore");
      }
    }

    if (trajectory.id === "object_only") {
      if (!hasProject && !projectShape) {
        addReason(trajectory, "a standalone object is enough here", 0.18, "impactScore");
      }
      if (hasProject) {
        addReason(trajectory, "keeping the object detached would lose project continuity", -0.18, "continuityScore");
      }
    }

    if (ambiguity === "high" && trajectory.deliveryDepth === "full") {
      addReason(trajectory, "heavy project execution should be delayed under high ambiguity", -0.08, "riskScore");
    }

    trajectory.score = clamp(trajectory.score);
    trajectory.impactScore = clamp(trajectory.impactScore);
    trajectory.continuityScore = clamp(trajectory.continuityScore);
    trajectory.executionScore = clamp(trajectory.executionScore);
    trajectory.riskScore = clamp(trajectory.riskScore);
  }

  const ranked = [...trajectories].sort((left, right) => right.score - left.score);
  const primaryTrajectory = ranked[0] || null;

  return {
    primaryTrajectory,
    trajectories: ranked,
    summary: primaryTrajectory
      ? `${primaryTrajectory.id} selected with score ${primaryTrajectory.score}`
      : "no project trajectory"
  };
}

export function applyProjectTrajectory({
  environmentPlan = null,
  projectTrajectory = null
} = {}) {
  const selected = projectTrajectory?.primaryTrajectory || null;
  if (!environmentPlan || !selected) {
    return environmentPlan;
  }

  return {
    ...environmentPlan,
    continueCurrentProject: selected.shouldLinkToProject || environmentPlan.continueCurrentProject,
    shouldCreateProject: selected.shouldCreateProject || environmentPlan.shouldCreateProject,
    projectOperation:
      selected.targetOperation !== "none"
        ? selected.targetOperation
        : environmentPlan.projectOperation || "none",
    shouldUseProjectBuilder:
      selected.shouldUseProjectBuilder || Boolean(environmentPlan.shouldCreateProject),
    deliveryDepth: selected.deliveryDepth,
    projectTrajectory: selected,
    projectTrajectorySimulation: projectTrajectory
  };
}

export default {
  simulateProjectTrajectories,
  applyProjectTrajectory
};
