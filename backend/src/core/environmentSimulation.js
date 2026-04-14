function clampScore(value = 0) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function createScenario(id, options = {}) {
  return {
    id,
    label: options.label || id,
    score: 0.18,
    fitScore: 0,
    continuityScore: 0,
    riskScore: 0,
    costScore: 0,
    targetObjectKind: options.targetObjectKind || "",
    continueCurrentObject: Boolean(options.continueCurrentObject),
    continueCurrentProject: Boolean(options.continueCurrentProject),
    createsNewObject: Boolean(options.createsNewObject),
    projectOperation: options.projectOperation || "none",
    linkToSourceObject: Boolean(options.linkToSourceObject),
    riskLevel: options.riskLevel || "low",
    costLevel: options.costLevel || "low",
    reasons: []
  };
}

function addReason(scenario, message, delta = 0, field = "") {
  scenario.reasons.push(message);
  scenario.score += delta;
  if (field && typeof scenario[field] === "number") {
    scenario[field] += delta;
  }
}

function isProjectOperation(shape = "", shouldCreateProject = false) {
  return shouldCreateProject || ["app", "code_project", "project"].includes(String(shape || "").trim().toLowerCase());
}

function isSameKind(environmentPlan = null, activeWorkObject = null) {
  return (
    Boolean(environmentPlan?.objectKind) &&
    Boolean(activeWorkObject?.objectKind) &&
    String(environmentPlan.objectKind) === String(activeWorkObject.objectKind)
  );
}

function buildScenarios({
  environmentPlan = null,
  intentProfile = null,
  executionIntent = null,
  activeWorkObject = null,
  activeProject = null,
  projectContext = null
} = {}) {
  const targetKind = environmentPlan?.objectKind || "";
  const hasProject = Boolean(activeProject?.id || projectContext?.linkedProjectId || activeWorkObject?.projectId);
  const projectShape = isProjectOperation(
    intentProfile?.requestedShape?.shape,
    environmentPlan?.shouldCreateProject
  );
  const scenarios = [];

  if (activeWorkObject && isSameKind(environmentPlan, activeWorkObject)) {
    scenarios.push(
      createScenario("continue_current_object", {
        label: "Continue current object",
        targetObjectKind: activeWorkObject.objectKind,
        continueCurrentObject: true,
        continueCurrentProject: hasProject,
        projectOperation: hasProject ? "extend_current_project" : "none",
        linkToSourceObject: false,
        createsNewObject: false,
        riskLevel: "low",
        costLevel: "low"
      })
    );
  }

  if (!projectShape) {
    scenarios.push(
      createScenario("create_new_environment", {
        label: "Create new environment",
        targetObjectKind: targetKind,
        continueCurrentObject: false,
        continueCurrentProject: hasProject,
        projectOperation: hasProject ? "extend_current_project" : "none",
        linkToSourceObject: Boolean(activeWorkObject),
        createsNewObject: true,
        riskLevel: "medium",
        costLevel: "medium"
      })
    );
  }

  if (activeWorkObject && !isSameKind(environmentPlan, activeWorkObject)) {
    scenarios.push(
      createScenario("transform_current_object", {
        label: "Transform current object",
        targetObjectKind: targetKind,
        continueCurrentObject: false,
        continueCurrentProject: hasProject,
        projectOperation:
          projectShape
            ? hasProject && !intentProfile?.explicitNewEnvironment
              ? "extend_current_project"
              : "create_new_project"
            : hasProject
              ? "extend_current_project"
              : "none",
        linkToSourceObject: true,
        createsNewObject: true,
        riskLevel: projectShape ? "high" : "medium",
        costLevel: projectShape ? "high" : "medium"
      })
    );
  }

  if (projectShape) {
    scenarios.push(
      createScenario(hasProject && !intentProfile?.explicitNewEnvironment ? "extend_current_project" : "create_new_project", {
        label: hasProject && !intentProfile?.explicitNewEnvironment ? "Extend current project" : "Create new project",
        targetObjectKind: "project",
        continueCurrentObject: false,
        continueCurrentProject: hasProject && !intentProfile?.explicitNewEnvironment,
        projectOperation: hasProject && !intentProfile?.explicitNewEnvironment ? "extend_current_project" : "create_new_project",
        linkToSourceObject: Boolean(activeWorkObject),
        createsNewObject: true,
        riskLevel: "high",
        costLevel: "high"
      })
    );
  }

  if (!scenarios.length) {
    scenarios.push(
      createScenario("generic_environment", {
        label: "Generic environment",
        targetObjectKind: targetKind || "document",
        continueCurrentObject: false,
        continueCurrentProject: hasProject,
        projectOperation: hasProject ? "extend_current_project" : "none",
        linkToSourceObject: Boolean(activeWorkObject),
        createsNewObject: true,
        riskLevel: "medium",
        costLevel: "medium"
      })
    );
  }

  return scenarios;
}

function scoreScenario(scenario, {
  environmentPlan = null,
  intentProfile = null,
  executionIntent = null,
  activeWorkObject = null,
  activeProject = null
} = {}) {
  const action = executionIntent?.action || "none";
  const continuationSignals = Boolean(intentProfile?.continuationSignals);
  const explicitNew = Boolean(intentProfile?.explicitNewEnvironment);
  const ambiguityLevel = intentProfile?.ambiguity?.level || "low";
  const requestedShape = intentProfile?.requestedShape?.shape || "unknown";
  const projectShape = isProjectOperation(requestedShape, environmentPlan?.shouldCreateProject);
  const sameKind = isSameKind(environmentPlan, activeWorkObject);

  if (scenario.targetObjectKind && scenario.targetObjectKind === environmentPlan?.objectKind) {
    addReason(scenario, "matches the target environment kind", 0.24, "fitScore");
  }

  if (projectShape && scenario.projectOperation !== "none") {
    addReason(scenario, "supports a project-level environment", 0.22, "fitScore");
  }

  if (!projectShape && scenario.projectOperation === "none" && !scenario.continueCurrentProject) {
    addReason(scenario, "keeps the environment lightweight", 0.06, "fitScore");
  }

  if (continuationSignals && scenario.continueCurrentObject) {
    addReason(scenario, "preserves continuity with the current object", 0.24, "continuityScore");
  } else if (continuationSignals && scenario.continueCurrentProject) {
    addReason(scenario, "keeps continuity inside the current project", 0.18, "continuityScore");
  }

  if (explicitNew && scenario.createsNewObject) {
    addReason(scenario, "respects the explicit request for a new environment", 0.22, "fitScore");
  } else if (explicitNew && scenario.continueCurrentObject) {
    addReason(scenario, "should not overwrite the current object when a new environment is requested", -0.3, "fitScore");
  }

  if (action === "environment_update" && scenario.id === "continue_current_object") {
    addReason(scenario, "matches the current update action", 0.24, "fitScore");
  }
  if (action === "environment_transform" && scenario.id === "transform_current_object") {
    addReason(scenario, "matches the transformation action", 0.26, "fitScore");
  }
  if (action === "environment_create" && scenario.id === "create_new_environment") {
    addReason(scenario, "matches the environment creation action", 0.22, "fitScore");
  }
  if (action === "project_scaffold" && ["extend_current_project", "create_new_project"].includes(scenario.id)) {
    addReason(scenario, "matches the project scaffold action", 0.24, "fitScore");
  }

  if (sameKind && scenario.id === "transform_current_object") {
    addReason(scenario, "transform is unnecessary when the current object already matches the target kind", -0.24, "fitScore");
  }

  if (!activeWorkObject && scenario.continueCurrentObject) {
    addReason(scenario, "cannot continue an object that does not exist", -0.35, "continuityScore");
  }

  if (!activeProject && scenario.id === "extend_current_project") {
    addReason(scenario, "cannot extend a project that does not exist", -0.35, "continuityScore");
  }

  if (ambiguityLevel === "high") {
    if (scenario.riskLevel === "high") {
      addReason(scenario, "high ambiguity increases the risk of a heavy project jump", -0.18, "riskScore");
    } else {
      addReason(scenario, "lighter environment is safer under ambiguity", 0.04, "riskScore");
    }
  }

  if (scenario.riskLevel === "low") {
    addReason(scenario, "low operational risk", 0.06, "riskScore");
  } else if (scenario.riskLevel === "medium") {
    addReason(scenario, "moderate operational risk", 0.01, "riskScore");
  } else {
    addReason(scenario, "high operational cost and coordination overhead", -0.08, "riskScore");
  }

  if (scenario.costLevel === "low") {
    addReason(scenario, "cheap to execute and persist", 0.05, "costScore");
  } else if (scenario.costLevel === "medium") {
    addReason(scenario, "moderate build and persistence cost", 0.01, "costScore");
  } else {
    addReason(scenario, "expensive path reserved for true project needs", -0.08, "costScore");
  }

  scenario.score = clampScore(scenario.score);
  scenario.fitScore = clampScore(scenario.fitScore);
  scenario.continuityScore = clampScore(scenario.continuityScore);
  scenario.riskScore = clampScore(scenario.riskScore);
  scenario.costScore = clampScore(scenario.costScore);

  return scenario;
}

export function simulateEnvironmentScenarios({
  environmentPlan = null,
  intentProfile = null,
  executionIntent = null,
  activeWorkObject = null,
  activeProject = null,
  projectContext = null
} = {}) {
  const scenarios = buildScenarios({
    environmentPlan,
    intentProfile,
    executionIntent,
    activeWorkObject,
    activeProject,
    projectContext
  }).map((scenario) =>
    scoreScenario(scenario, {
      environmentPlan,
      intentProfile,
      executionIntent,
      activeWorkObject,
      activeProject
    })
  );

  const ranked = [...scenarios].sort((left, right) => right.score - left.score);
  const primaryScenario = ranked[0] || null;

  return {
    primaryScenario,
    scenarios: ranked,
    summary: primaryScenario
      ? `${primaryScenario.id} selected with score ${primaryScenario.score}`
      : "no environment scenario"
  };
}

export function applyEnvironmentScenario(environmentPlan = null, simulation = null) {
  const selected = simulation?.primaryScenario || null;
  if (!environmentPlan || !selected) {
    return environmentPlan;
  }

  const summary =
    selected.id === "continue_current_object"
      ? `Continue the current ${environmentPlan.objectKind} inside the same environment.`
      : selected.projectOperation === "create_new_project"
        ? `Create a new project environment from this intent.`
        : selected.projectOperation === "extend_current_project"
          ? `Extend the current project with a new linked environment.`
          : `Create a new ${environmentPlan.label.toLowerCase()} and keep it persistent.`;

  return {
    ...environmentPlan,
    continueCurrentObject: selected.continueCurrentObject,
    continueCurrentProject: selected.continueCurrentProject,
    shouldCreateProject:
      environmentPlan.shouldCreateProject || selected.projectOperation !== "none",
    projectOperation: selected.projectOperation,
    linkToSourceObject: selected.linkToSourceObject,
    createsNewObject: selected.createsNewObject,
    targetObjectKind: selected.targetObjectKind || environmentPlan.objectKind,
    estimatedRisk: selected.riskLevel,
    estimatedCost: selected.costLevel,
    environmentScenario: selected,
    environmentSimulation: simulation,
    summary
  };
}

export default {
  simulateEnvironmentScenarios,
  applyEnvironmentScenario
};
