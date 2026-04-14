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

function has(pattern, value = "") {
  return pattern.test(value);
}

function unique(values = []) {
  return [...new Set((values || []).filter(Boolean))];
}

function createScenario(id, options = {}) {
  return {
    id,
    label: options.label || id,
    score: 0.18,
    userValueScore: 0,
    continuityScore: 0,
    deliveryScore: 0,
    riskScore: 0,
    experienceGoal: options.experienceGoal || "usable_outcome",
    experienceMode: options.experienceMode || "focused",
    preferredOutputs: options.preferredOutputs || [],
    preferredStrategyHint: options.preferredStrategyHint || "",
    requiresValidation: Boolean(options.requiresValidation),
    projectBias: options.projectBias || "neutral",
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

function inferCandidates({
  normalizedPrompt = "",
  intentProfile = null,
  environmentPlan = null
} = {}) {
  const requestedShape = intentProfile?.requestedShape?.shape || "unknown";
  const candidates = [
    createScenario("utility_first", {
      label: "Utility first",
      experienceGoal: "deliver a usable environment quickly",
      experienceMode: "focused",
      preferredOutputs: [environmentPlan?.objectKind || "document"],
      preferredStrategyHint: "direct_environment_creation",
      projectBias: "lightweight"
    })
  ];

  if (
    ["project", "app", "code_project"].includes(requestedShape) ||
    environmentPlan?.shouldCreateProject ||
    environmentPlan?.objectKind === "project"
  ) {
    candidates.push(
      createScenario("project_system", {
        label: "Project system",
        experienceGoal: "create a persistent project shell that can host multiple linked environments",
        experienceMode: "system",
        preferredOutputs: unique(["project", environmentPlan?.objectKind]),
        preferredStrategyHint: "direct_project_execution",
        requiresValidation: false,
        projectBias: "project"
      })
    );
  }

  if (
    ["app", "project", "code_project"].includes(requestedShape) ||
    has(/\b(mvp|launch|lancer|pret|prete|ready|deploy|livrer|delivery|run|demarre|start)\b/, normalizedPrompt)
  ) {
    candidates.push(
      createScenario("mvp_launch", {
        label: "MVP launch",
        experienceGoal: "ship a runnable product that can be validated quickly",
        experienceMode: "delivery",
        preferredOutputs: unique(["project", environmentPlan?.objectKind]),
        preferredStrategyHint: "validate_and_deliver",
        requiresValidation: true,
        projectBias: "project"
      })
    );
  }

  if (
    has(/\b(investor|investisseurs?|pitch|deck|fundraising|levee de fonds|business plan)\b/, normalizedPrompt) ||
    (requestedShape === "presentation" && has(/\b(invest|pitch|business)\b/, normalizedPrompt))
  ) {
    candidates.push(
      createScenario("investor_ready", {
        label: "Investor ready",
        experienceGoal: "produce an investor-facing asset with clear business framing",
        experienceMode: "narrative",
        preferredOutputs: unique(["presentation", "document", environmentPlan?.objectKind]),
        preferredStrategyHint: "environment_transformation",
        projectBias: "linked_extension"
      })
    );
  }

  if (
    ["dashboard", "dataset", "spreadsheet"].includes(requestedShape) ||
    has(/\b(dashboard|analytics|analytic|kpi|metrics?|reporting|insights?|data|spreadsheet|excel|tableau|sheet)\b/, normalizedPrompt)
  ) {
    candidates.push(
      createScenario("analytics_command_center", {
        label: "Analytics command center",
        experienceGoal: "turn information into an operating dashboard the user can work from",
        experienceMode: "analytics",
        preferredOutputs: unique(["dashboard", "dataset", environmentPlan?.objectKind]),
        preferredStrategyHint: "direct_environment_creation",
        projectBias: "linked_extension"
      })
    );
  }

  if (
    ["workflow"].includes(requestedShape) ||
    has(/\b(workflow|automation|agent|agents|orchestration|scheduled|event|pipeline|n8n)\b/, normalizedPrompt)
  ) {
    candidates.push(
      createScenario("automation_operator", {
        label: "Automation operator",
        experienceGoal: "build an executable workflow that coordinates actions clearly",
        experienceMode: "operations",
        preferredOutputs: unique(["workflow", "dashboard", environmentPlan?.objectKind]),
        preferredStrategyHint: "direct_environment_creation",
        projectBias: "linked_extension"
      })
    );
  }

  if (
    ["document", "presentation"].includes(requestedShape) ||
    has(/\b(document|doc|wiki|knowledge|note|notes|outline|brief|spec|presentation|slides?)\b/, normalizedPrompt)
  ) {
    candidates.push(
      createScenario("knowledge_asset", {
        label: "Knowledge asset",
        experienceGoal: "produce a clear structured asset that can be read, edited and reused",
        experienceMode: "editorial",
        preferredOutputs: unique([environmentPlan?.objectKind, "document", "presentation"]),
        preferredStrategyHint: "direct_environment_creation",
        projectBias: "neutral"
      })
    );
  }

  if (
    ["design"].includes(requestedShape) ||
    has(/\b(design|wireframe|ui|ux|figma|layout|mockup)\b/, normalizedPrompt)
  ) {
    candidates.push(
      createScenario("product_design_sprint", {
        label: "Product design sprint",
        experienceGoal: "shape a visual product surface the user can iterate on quickly",
        experienceMode: "visual",
        preferredOutputs: unique(["design", "presentation", environmentPlan?.objectKind]),
        preferredStrategyHint: "direct_environment_creation",
        projectBias: "linked_extension"
      })
    );
  }

  return candidates;
}

function scoreScenario(scenario, {
  normalizedPrompt = "",
  intentProfile = null,
  environmentPlan = null,
  projectTrajectory = null,
  activeProject = null,
  activeWorkObject = null
} = {}) {
  const requestedShape = intentProfile?.requestedShape?.shape || "unknown";
  const ambiguity = intentProfile?.ambiguity?.level || "low";
  const trajectoryId = projectTrajectory?.primaryTrajectory?.id || "";
  const hasProject = Boolean(activeProject?.id || activeWorkObject?.projectId);
  const continuationSignals = Boolean(intentProfile?.continuationSignals);
  const explicitNew = Boolean(intentProfile?.explicitNewEnvironment);
  const targetKind = environmentPlan?.objectKind || "";
  const investorSignals = has(/\b(investor|investisseurs?|pitch|deck|business plan|fundraising|levee de fonds)\b/, normalizedPrompt);
  const launchSignals = has(/\b(mvp|launch|lancer|prete?|ready|deploy|livr)\b/, normalizedPrompt);
  const analyticsSignals = has(/\b(dashboard|analytics|kpi|metrics?|reporting|insights?|excel|sheet|spreadsheet)\b/, normalizedPrompt);
  const automationSignals = has(/\b(workflow|automation|agent|agents|pipeline|n8n|scheduled|event)\b/, normalizedPrompt);
  const designSignals = has(/\b(design|wireframe|ui|ux|figma|layout|mockup)\b/, normalizedPrompt);

  if (scenario.preferredOutputs.includes(targetKind)) {
    addReason(scenario, "matches the target environment the user is implicitly asking for", 0.22, "userValueScore");
  }

  if (requestedShape !== "unknown" && scenario.preferredOutputs.includes(targetKind)) {
    addReason(scenario, "fits the requested shape directly", 0.12, "userValueScore");
  }

  if (scenario.id === "mvp_launch") {
    if (trajectoryId === "full_delivery_project") {
      addReason(scenario, "best fit for a runnable product trajectory", 0.34, "deliveryScore");
    }
    if (launchSignals) {
      addReason(scenario, "prompt explicitly asks for a launchable result", 0.28, "deliveryScore");
    }
    if (!["project", "project_first"].includes(scenario.projectBias) && targetKind !== "project") {
      addReason(scenario, "mvp launch without a project shell is incoherent", -0.16, "riskScore");
    }
  }

  if (scenario.id === "project_system") {
    if (targetKind === "project" || requestedShape === "project" || requestedShape === "app") {
      addReason(scenario, "the user is asking for a project-level environment, not a detached object", 0.34, "userValueScore");
      addReason(scenario, "a persistent shell is the right base for future objects and follow-ups", 0.22, "continuityScore");
    }
    if (hasProject) {
      addReason(scenario, "can extend the existing project shell instead of fragmenting the workspace", 0.14, "continuityScore");
    }
    if (trajectoryId === "new_project_branch" || trajectoryId === "extend_project_shell") {
      addReason(scenario, "matches the selected project trajectory", 0.2, "deliveryScore");
    }
  }

  if (scenario.id === "investor_ready") {
    if (investorSignals) {
      addReason(scenario, "prompt is investor-facing and needs stronger business framing", 0.34, "userValueScore");
    }
    if (trajectoryId === "linked_object_extension" || hasProject) {
      addReason(scenario, "best delivered as a linked asset for the current project", 0.18, "continuityScore");
    }
  }

  if (scenario.id === "analytics_command_center") {
    if (analyticsSignals) {
      addReason(scenario, "prompt is about operational data visibility", 0.34, "userValueScore");
    }
    if (trajectoryId === "linked_object_extension" || hasProject) {
      addReason(scenario, "analytics works best when linked to the active project context", 0.18, "continuityScore");
    }
  }

  if (scenario.id === "automation_operator") {
    if (automationSignals) {
      addReason(scenario, "prompt is about coordinated execution and automation", 0.34, "userValueScore");
    }
    if (hasProject || trajectoryId === "linked_object_extension") {
      addReason(scenario, "automation is more useful when attached to a persistent project", 0.14, "continuityScore");
    }
  }

  if (scenario.id === "knowledge_asset") {
    if (has(/\b(document|doc|wiki|knowledge|note|outline|brief|spec|presentation|slides?)\b/, normalizedPrompt)) {
      addReason(scenario, "prompt calls for a structured asset the user can read and edit", 0.28, "userValueScore");
    }
    if (requestedShape === "document" || requestedShape === "presentation") {
      addReason(scenario, "shape aligns with a reusable knowledge asset", 0.14, "userValueScore");
    }
  }

  if (scenario.id === "product_design_sprint") {
    if (designSignals) {
      addReason(scenario, "prompt is about visual product exploration", 0.3, "userValueScore");
    }
    if (hasProject || trajectoryId === "linked_object_extension") {
      addReason(scenario, "design work should stay attached to the product context", 0.14, "continuityScore");
    }
  }

  if (scenario.id === "utility_first") {
    addReason(scenario, "always keeps the result usable and focused", 0.12, "userValueScore");
    if (trajectoryId === "object_only") {
      addReason(scenario, "matches a standalone object trajectory", 0.1, "continuityScore");
    }
    if (requestedShape === "project" || requestedShape === "app" || targetKind === "project") {
      addReason(scenario, "utility-first is too narrow for a persistent project shell", -0.16, "userValueScore");
    }
  }

  if (investorSignals && scenario.id === "knowledge_asset") {
    addReason(scenario, "generic knowledge mode is weaker than an investor-ready framing here", -0.2, "userValueScore");
  }

  if (launchSignals && scenario.id === "utility_first") {
    addReason(scenario, "utility-first is too narrow for a launch-oriented request", -0.12, "deliveryScore");
  }

  if (analyticsSignals && scenario.id === "knowledge_asset") {
    addReason(scenario, "analytics demand should privilege an operating surface over a generic asset", -0.12, "userValueScore");
  }

  if (automationSignals && scenario.id === "utility_first") {
    addReason(scenario, "automation needs a stronger workflow bias than a generic utility mode", -0.08, "userValueScore");
  }

  if (designSignals && scenario.id === "knowledge_asset") {
    addReason(scenario, "design intent should privilege a visual sprint over a textual asset", -0.14, "userValueScore");
  }

  if (continuationSignals && hasProject && scenario.projectBias === "linked_extension") {
    addReason(scenario, "preserves momentum inside the current project", 0.16, "continuityScore");
  }

  if (explicitNew && scenario.projectBias === "linked_extension") {
    addReason(scenario, "linked extension is weaker when the user wants a fresh environment", -0.08, "continuityScore");
  }

  if (ambiguity === "high" && scenario.requiresValidation) {
    addReason(scenario, "heavy delivery should be delayed when the prompt stays ambiguous", -0.18, "riskScore");
  } else if (ambiguity === "high") {
    addReason(scenario, "lighter business mode is safer under ambiguity", 0.04, "riskScore");
  }

  if (scenario.projectBias === "project" && hasProject) {
    addReason(scenario, "can leverage the existing project shell", 0.08, "continuityScore");
  }

  scenario.score = clamp(scenario.score);
  scenario.userValueScore = clamp(scenario.userValueScore);
  scenario.continuityScore = clamp(scenario.continuityScore);
  scenario.deliveryScore = clamp(scenario.deliveryScore);
  scenario.riskScore = clamp(scenario.riskScore);

  return scenario;
}

export function simulateBusinessScenarios({
  prompt = "",
  intentProfile = null,
  environmentPlan = null,
  projectTrajectory = null,
  activeProject = null,
  activeWorkObject = null
} = {}) {
  const normalizedPrompt = normalizeText(prompt);
  const scenarios = inferCandidates({
    normalizedPrompt,
    intentProfile,
    environmentPlan
  }).map((scenario) =>
    scoreScenario(scenario, {
      normalizedPrompt,
      intentProfile,
      environmentPlan,
      projectTrajectory,
      activeProject,
      activeWorkObject
    })
  );

  const ranked = [...scenarios].sort((left, right) => right.score - left.score);
  const primaryScenario = ranked[0] || null;

  return {
    primaryScenario,
    scenarios: ranked,
    summary: primaryScenario
      ? `${primaryScenario.id} selected with score ${primaryScenario.score}`
      : "no business scenario"
  };
}

export function applyBusinessScenario({
  environmentPlan = null,
  businessSimulation = null,
  activeProject = null
} = {}) {
  const selected = businessSimulation?.primaryScenario || null;
  if (!environmentPlan || !selected) {
    return environmentPlan;
  }

  const nextProjectOperation =
    selected.id === "mvp_launch" && environmentPlan.projectOperation === "none"
      ? activeProject?.id
        ? "extend_current_project"
        : "create_new_project"
      : environmentPlan.projectOperation;

  const nextShouldCreateProject =
    selected.id === "mvp_launch"
      ? true
      : environmentPlan.shouldCreateProject;

  const nextDeliveryDepth =
    selected.requiresValidation
      ? "full"
      : environmentPlan.deliveryDepth || "none";

  const experienceSummary =
    selected.id === "mvp_launch"
      ? "Optimize for a runnable MVP the user can validate quickly."
      : selected.id === "investor_ready"
        ? "Optimize for an investor-facing asset with stronger business framing."
        : selected.id === "analytics_command_center"
          ? "Optimize for an operational analytics surface the user can act from."
          : selected.id === "automation_operator"
            ? "Optimize for a workflow the user can operate and refine."
            : selected.id === "product_design_sprint"
              ? "Optimize for a visual product surface the user can iterate on."
              : "Optimize for the most useful and immediately usable outcome.";

  return {
    ...environmentPlan,
    shouldCreateProject: nextShouldCreateProject,
    shouldUseProjectBuilder:
      environmentPlan.shouldUseProjectBuilder || selected.id === "mvp_launch",
    projectOperation: nextProjectOperation,
    deliveryDepth: nextDeliveryDepth,
    experienceGoal: selected.experienceGoal,
    experienceMode: selected.experienceMode,
    preferredOutputs: unique([
      ...(environmentPlan.preferredOutputs || []),
      ...(selected.preferredOutputs || [])
    ]),
    businessScenario: selected,
    businessSimulation,
    summary: `${environmentPlan.summary} ${experienceSummary}`.trim()
  };
}

export default {
  simulateBusinessScenarios,
  applyBusinessScenario
};
