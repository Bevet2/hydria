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

function createPlan(id, options = {}) {
  return {
    id,
    label: options.label || id,
    score: 0.2,
    userImpactScore: 0,
    continuityScore: 0,
    buildCostScore: 0,
    evolutionRiskScore: 0,
    executionConfidenceScore: 0,
    recommendedStrategy: options.recommendedStrategy || "",
    shouldUseProjectBuilder: Boolean(options.shouldUseProjectBuilder),
    deliveryDepth: options.deliveryDepth || "none",
    projectOperation: options.projectOperation || "none",
    productGoal: options.productGoal || "usable_outcome",
    experienceMode: options.experienceMode || "focused",
    reasons: []
  };
}

function addReason(plan, message, delta = 0, field = "") {
  plan.reasons.push(message);
  plan.score += delta;
  if (field && typeof plan[field] === "number") {
    plan[field] += delta;
  }
}

function unique(values = []) {
  return [...new Set((values || []).filter(Boolean))];
}

function inferCandidates({
  environmentPlan = null,
  projectTrajectory = null,
  businessSimulation = null,
  activeProject = null,
  intentProfile = null
} = {}) {
  const trajectoryId = projectTrajectory?.primaryTrajectory?.id || "";
  const businessId = businessSimulation?.primaryScenario?.id || "";
  const requestedShape = intentProfile?.requestedShape?.shape || "";
  const hasProject = Boolean(activeProject?.id);
  const candidates = [
    createPlan("lean_object_plan", {
      label: "Lean object plan",
      recommendedStrategy: "direct_environment_creation",
      shouldUseProjectBuilder: false,
      deliveryDepth: "none",
      projectOperation: hasProject ? "extend_current_project" : "none",
      productGoal: "deliver_one_strong_object",
      experienceMode: "focused"
    })
  ];

  if (
    businessId === "project_system" ||
    ["project", "app", "code_project"].includes(requestedShape) ||
    environmentPlan?.shouldCreateProject ||
    environmentPlan?.objectKind === "project"
  ) {
    candidates.push(
      createPlan("project_shell_plan", {
        label: "Project shell plan",
        recommendedStrategy: "direct_project_execution",
        shouldUseProjectBuilder: true,
        deliveryDepth: "shell",
        projectOperation: hasProject ? "extend_current_project" : "create_new_project",
        productGoal: "living_project_shell",
        experienceMode: "system"
      })
    );
  }

  if (["linked_object_extension", "extend_project_shell"].includes(trajectoryId) || hasProject) {
    candidates.push(
      createPlan("project_extension_plan", {
        label: "Project extension plan",
        recommendedStrategy: "direct_environment_creation",
        shouldUseProjectBuilder: trajectoryId === "extend_project_shell",
        deliveryDepth: trajectoryId === "extend_project_shell" ? "shell" : "none",
        projectOperation: "extend_current_project",
        productGoal: "grow_the_current_project",
        experienceMode: "linked"
      })
    );
  }

  if (businessId === "mvp_launch" || trajectoryId === "full_delivery_project") {
    candidates.push(
      createPlan("delivery_mvp_plan", {
        label: "Delivery MVP plan",
        recommendedStrategy: "validate_and_deliver",
        shouldUseProjectBuilder: true,
        deliveryDepth: "full",
        projectOperation:
          environmentPlan?.projectOperation && environmentPlan.projectOperation !== "none"
            ? environmentPlan.projectOperation
            : hasProject
              ? "extend_current_project"
              : "create_new_project",
        productGoal: "launchable_mvp",
        experienceMode: "delivery"
      })
    );
  }

  if (businessId === "investor_ready") {
    candidates.push(
      createPlan("investor_asset_plan", {
        label: "Investor asset plan",
        recommendedStrategy: "environment_transformation",
        shouldUseProjectBuilder: false,
        deliveryDepth: "none",
        projectOperation: hasProject ? "extend_current_project" : "none",
        productGoal: "investor_ready_asset",
        experienceMode: "narrative"
      })
    );
  }

  if (["analytics_command_center", "automation_operator"].includes(businessId)) {
    candidates.push(
      createPlan("operating_surface_plan", {
        label: "Operating surface plan",
        recommendedStrategy: "direct_environment_creation",
        shouldUseProjectBuilder: false,
        deliveryDepth: "none",
        projectOperation: hasProject ? "extend_current_project" : environmentPlan?.projectOperation || "none",
        productGoal: "operating_surface",
        experienceMode: "operations"
      })
    );
  }

  if (businessId === "product_design_sprint") {
    candidates.push(
      createPlan("design_iteration_plan", {
        label: "Design iteration plan",
        recommendedStrategy: "direct_environment_creation",
        shouldUseProjectBuilder: false,
        deliveryDepth: "none",
        projectOperation: hasProject ? "extend_current_project" : "none",
        productGoal: "iterative_design_surface",
        experienceMode: "visual"
      })
    );
  }

  return unique(candidates.map((candidate) => candidate.id)).map((id) =>
    candidates.find((candidate) => candidate.id === id)
  );
}

function scoreCandidate(plan, {
  normalizedPrompt = "",
  intentProfile = null,
  environmentPlan = null,
  projectTrajectory = null,
  businessSimulation = null,
  activeProject = null,
  activeWorkObject = null
} = {}) {
  const businessId = businessSimulation?.primaryScenario?.id || "";
  const trajectoryId = projectTrajectory?.primaryTrajectory?.id || "";
  const ambiguity = intentProfile?.ambiguity?.level || "low";
  const continuationSignals = Boolean(intentProfile?.continuationSignals);
  const explicitNew = Boolean(intentProfile?.explicitNewEnvironment);
  const hasProject = Boolean(activeProject?.id || activeWorkObject?.projectId);
  const requestedShape = intentProfile?.requestedShape?.shape || "";

  if (plan.id === "project_shell_plan") {
    if (businessId === "project_system" || ["project", "app", "code_project"].includes(requestedShape)) {
      addReason(plan, "best fit for a persistent shell that can host multiple linked objects", 0.36, "userImpactScore");
      addReason(plan, "execution stays coherent with a project-first request", 0.26, "executionConfidenceScore");
    }
    if (["new_project_branch", "extend_project_shell"].includes(trajectoryId)) {
      addReason(plan, "matches the selected project trajectory", 0.22, "continuityScore");
    }
    if (hasProject && plan.projectOperation === "extend_current_project") {
      addReason(plan, "reuses the current project shell without fragmenting the workspace", 0.16, "continuityScore");
    }
  }

  if (businessId === "mvp_launch" && plan.id === "delivery_mvp_plan") {
    addReason(plan, "best fit for a product that should actually launch", 0.36, "userImpactScore");
    addReason(plan, "execution path aligns with a delivery-oriented scenario", 0.28, "executionConfidenceScore");
  }

  if (businessId === "investor_ready" && plan.id === "investor_asset_plan") {
    addReason(plan, "best fit for an investor-facing deliverable", 0.34, "userImpactScore");
  }

  if (businessId === "analytics_command_center" && plan.id === "operating_surface_plan") {
    addReason(plan, "best fit for an operating analytics surface", 0.34, "userImpactScore");
  }

  if (businessId === "automation_operator" && plan.id === "operating_surface_plan") {
    addReason(plan, "best fit for a workflow the user will operate and refine", 0.32, "userImpactScore");
  }

  if (businessId === "product_design_sprint" && plan.id === "design_iteration_plan") {
    addReason(plan, "best fit for a visual iteration loop", 0.32, "userImpactScore");
  }

  if (plan.id === "project_extension_plan" && ["linked_object_extension", "extend_project_shell"].includes(trajectoryId)) {
    addReason(plan, "keeps the new environment attached to the active project", 0.28, "continuityScore");
  }

  if (plan.id === "lean_object_plan" && trajectoryId === "object_only") {
    addReason(plan, "a standalone object is enough here", 0.22, "continuityScore");
  }

  if (plan.id === "delivery_mvp_plan" && trajectoryId === "full_delivery_project") {
    addReason(plan, "matches the selected full-delivery trajectory", 0.32, "executionConfidenceScore");
  }

  if (continuationSignals && hasProject && plan.projectOperation === "extend_current_project") {
    addReason(plan, "preserves continuity with the current project", 0.18, "continuityScore");
  }

  if (explicitNew && plan.projectOperation === "extend_current_project") {
    addReason(plan, "extending the current project is weaker when the user asks for something new", -0.14, "continuityScore");
  }

  if (plan.id === "delivery_mvp_plan") {
    addReason(plan, "higher build cost is acceptable when launch value is strong", 0.08, "buildCostScore");
    if (ambiguity === "high") {
      addReason(plan, "full delivery is riskier under ambiguity", -0.18, "evolutionRiskScore");
    }
  } else if (plan.id === "lean_object_plan") {
    addReason(plan, "cheap plan with low execution overhead", 0.12, "buildCostScore");
    addReason(plan, "safer under ambiguity and quick iteration", 0.08, "evolutionRiskScore");
    if (["project", "app", "code_project"].includes(requestedShape) || environmentPlan?.objectKind === "project") {
      addReason(plan, "lean object mode is too weak for a project-first request", -0.18, "userImpactScore");
    }
  } else {
    addReason(plan, "balanced build cost for a richer outcome", 0.04, "buildCostScore");
  }

  if (hasProject && plan.projectOperation === "extend_current_project") {
    addReason(plan, "can leverage an existing project shell", 0.1, "executionConfidenceScore");
  }

  if (environmentPlan?.deliveryDepth === "full" && plan.id === "delivery_mvp_plan") {
    addReason(plan, "environment already points to a validated delivery loop", 0.12, "executionConfidenceScore");
  }

  if (/invest|pitch|deck/.test(normalizedPrompt) && plan.id === "lean_object_plan") {
    addReason(plan, "lean object mode is too weak for an investor-facing outcome", -0.12, "userImpactScore");
  }

  if (/dashboard|analytics|workflow|automation/.test(normalizedPrompt) && plan.id === "investor_asset_plan") {
    addReason(plan, "investor framing is misaligned with an operational surface request", -0.12, "userImpactScore");
  }

  plan.score = clamp(plan.score);
  plan.userImpactScore = clamp(plan.userImpactScore);
  plan.continuityScore = clamp(plan.continuityScore);
  plan.buildCostScore = clamp(plan.buildCostScore);
  plan.evolutionRiskScore = clamp(plan.evolutionRiskScore);
  plan.executionConfidenceScore = clamp(plan.executionConfidenceScore);

  return plan;
}

export function simulateProductPlans({
  prompt = "",
  intentProfile = null,
  environmentPlan = null,
  projectTrajectory = null,
  businessSimulation = null,
  activeProject = null,
  activeWorkObject = null
} = {}) {
  const normalizedPrompt = normalizeText(prompt);
  const candidates = inferCandidates({
    environmentPlan,
    projectTrajectory,
    businessSimulation,
    activeProject,
    intentProfile
  }).map((candidate) =>
    scoreCandidate(candidate, {
      normalizedPrompt,
      intentProfile,
      environmentPlan,
      projectTrajectory,
      businessSimulation,
      activeProject,
      activeWorkObject
    })
  );

  const ranked = [...candidates].sort((left, right) => right.score - left.score);
  const primaryPlan = ranked[0] || null;

  return {
    primaryPlan,
    plans: ranked,
    summary: primaryPlan
      ? `${primaryPlan.id} selected with score ${primaryPlan.score}`
      : "no product plan"
  };
}

export function applyProductPlan({
  environmentPlan = null,
  productPlanSimulation = null,
  activeProject = null
} = {}) {
  const selected = productPlanSimulation?.primaryPlan || null;
  if (!environmentPlan || !selected) {
    return environmentPlan;
  }

  const nextProjectOperation =
    selected.projectOperation !== "none"
      ? selected.projectOperation
      : environmentPlan.projectOperation;
  const nextShouldCreateProject =
    nextProjectOperation === "create_new_project"
      ? true
      : environmentPlan.shouldCreateProject;

  const summarySuffix =
    selected.id === "delivery_mvp_plan"
      ? "Choose the strongest launch-ready plan with validation."
      : selected.id === "project_extension_plan"
        ? "Choose the plan that enriches the current project without breaking continuity."
        : selected.id === "investor_asset_plan"
          ? "Choose the plan that produces a stronger investor-facing asset."
          : selected.id === "operating_surface_plan"
            ? "Choose the plan that maximizes operational usefulness in the workspace."
            : selected.id === "design_iteration_plan"
              ? "Choose the plan that favors visual iteration."
              : "Choose the leanest plan that still delivers a useful result.";

  return {
    ...environmentPlan,
    shouldCreateProject: nextShouldCreateProject,
    shouldUseProjectBuilder:
      environmentPlan.shouldUseProjectBuilder || selected.shouldUseProjectBuilder,
    deliveryDepth:
      selected.deliveryDepth !== "none"
        ? selected.deliveryDepth
        : environmentPlan.deliveryDepth || "none",
    projectOperation: nextProjectOperation,
    productGoal: selected.productGoal,
    experienceMode: selected.experienceMode || environmentPlan.experienceMode,
    recommendedStrategy: selected.recommendedStrategy || environmentPlan.recommendedStrategy,
    productPlan: selected,
    productPlanSimulation,
    summary: `${environmentPlan.summary} ${summarySuffix}`.trim()
  };
}

export default {
  simulateProductPlans,
  applyProductPlan
};
