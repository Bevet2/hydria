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

function createScenario(id, options = {}) {
  return {
    id,
    label: options.label || id,
    score: 0.2,
    adoptionScore: 0,
    frictionReductionScore: 0,
    iterationValueScore: 0,
    executionRealityScore: 0,
    retentionScore: 0,
    workspacePriority: options.workspacePriority || "focus",
    assistantRole: options.assistantRole || "copilot",
    interactionMode: options.interactionMode || "guided",
    recommendedStrategy: options.recommendedStrategy || "",
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
  businessSimulation = null,
  productPlanSimulation = null,
  impactSimulation = null,
  activeProject = null,
  activeWorkObject = null,
  intentProfile = null
} = {}) {
  const businessId = businessSimulation?.primaryScenario?.id || "";
  const productPlanId = productPlanSimulation?.primaryPlan?.id || "";
  const impactId = impactSimulation?.primaryOutcome?.id || "";
  const hasProject = Boolean(activeProject?.id || activeWorkObject?.projectId);
  const candidates = [
    createScenario("quick_first_success", {
      label: "Quick first success",
      workspacePriority: "focus",
      assistantRole: "builder",
      interactionMode: "guided",
      recommendedStrategy: ""
    })
  ];

  if (
    ["mvp_launch"].includes(businessId) ||
    ["delivery_mvp_plan"].includes(productPlanId) ||
    ["delivery_investment_path"].includes(impactId)
  ) {
    candidates.push(
      createScenario("launch_validation_loop", {
        label: "Launch validation loop",
        workspacePriority: "delivery_first",
        assistantRole: "builder",
        interactionMode: "guided",
        recommendedStrategy: "validate_and_deliver"
      })
    );
  }

  if (
    ["investor_ready"].includes(businessId) ||
    ["investor_asset_plan"].includes(productPlanId)
  ) {
    candidates.push(
      createScenario("stakeholder_review_loop", {
        label: "Stakeholder review loop",
        workspacePriority: "review_first",
        assistantRole: "reviewer",
        interactionMode: "review",
        recommendedStrategy: "environment_transformation"
      })
    );
  }

  if (
    ["analytics_command_center", "automation_operator"].includes(businessId) ||
    ["operating_surface_plan"].includes(productPlanId)
  ) {
    candidates.push(
      createScenario("repeat_operator_loop", {
        label: "Repeat operator loop",
        workspacePriority: "operations_first",
        assistantRole: "operator",
        interactionMode: "interactive",
        recommendedStrategy: "direct_environment_creation"
      })
    );
  }

  if (
    hasProject ||
    Boolean(intentProfile?.continuationSignals) ||
    ["project_extension_plan"].includes(productPlanId) ||
    ["continuity_roi_path"].includes(impactId)
  ) {
    candidates.push(
      createScenario("continuous_iteration_loop", {
        label: "Continuous iteration loop",
        workspacePriority: "iteration_first",
        assistantRole: "copilot",
        interactionMode: "iterative",
        recommendedStrategy: ""
      })
    );
  }

  return candidates;
}

function scoreScenario(scenario, {
  normalizedPrompt = "",
  intentProfile = null,
  businessSimulation = null,
  productPlanSimulation = null,
  impactSimulation = null,
  activeProject = null,
  activeWorkObject = null,
  executionIntent = null
} = {}) {
  const businessId = businessSimulation?.primaryScenario?.id || "";
  const productPlanId = productPlanSimulation?.primaryPlan?.id || "";
  const impactId = impactSimulation?.primaryOutcome?.id || "";
  const ambiguity = intentProfile?.ambiguity?.level || "low";
  const beginner = intentProfile?.userExpertise === "beginner";
  const hasProject = Boolean(activeProject?.id || activeWorkObject?.projectId);
  const continuationSignals = Boolean(intentProfile?.continuationSignals);
  const operationalSignals = has(/\b(dashboard|analytics|workflow|automation|kpi|metrics?|pipeline|agent)\b/, normalizedPrompt);
  const reviewSignals = has(/\b(investor|investisseurs?|pitch|deck|review|presentation|slides?)\b/, normalizedPrompt);
  const launchSignals = has(/\b(mvp|launch|lancer|pret|prete|ready|deploy|livr|demarre|start)\b/, normalizedPrompt);

  if (scenario.id === "quick_first_success") {
    addReason(scenario, "always optimizes for an immediately understandable first outcome", 0.16, "adoptionScore");
    addReason(scenario, "keeps friction low by default", 0.14, "frictionReductionScore");
    if (beginner || ambiguity === "high") {
      addReason(scenario, "extra useful for beginners or ambiguous prompts", 0.14, "adoptionScore");
    }
    if (executionIntent?.action === "none") {
      addReason(scenario, "fits a non-executive reasoning path", 0.12, "executionRealityScore");
    }
  }

  if (scenario.id === "launch_validation_loop") {
    if (launchSignals || businessId === "mvp_launch" || productPlanId === "delivery_mvp_plan") {
      addReason(scenario, "best loop for creating and validating a launchable result", 0.34, "executionRealityScore");
      addReason(scenario, "gives strong user confidence when the goal is to ship", 0.24, "adoptionScore");
    }
    if (impactId === "delivery_investment_path") {
      addReason(scenario, "impact model confirms the delivery investment is worth it", 0.18, "retentionScore");
    }
  }

  if (scenario.id === "stakeholder_review_loop") {
    if (reviewSignals || businessId === "investor_ready") {
      addReason(scenario, "best loop for presenting and refining a stakeholder-facing asset", 0.32, "adoptionScore");
      addReason(scenario, "review mode reduces presentation risk", 0.2, "frictionReductionScore");
    }
    if (impactId === "safe_transform_path") {
      addReason(scenario, "impact model favors a controlled review-oriented transformation", 0.16, "executionRealityScore");
    }
  }

  if (scenario.id === "repeat_operator_loop") {
    if (operationalSignals || ["analytics_command_center", "automation_operator"].includes(businessId)) {
      addReason(scenario, "best loop for a surface the user will revisit and operate repeatedly", 0.34, "retentionScore");
      addReason(scenario, "interactive mode lowers friction for repeated usage", 0.2, "frictionReductionScore");
    }
    if (impactId === "operational_leverage_path") {
      addReason(scenario, "impact model confirms strong long-term leverage", 0.16, "iterationValueScore");
    }
  }

  if (scenario.id === "continuous_iteration_loop") {
    if (hasProject || continuationSignals) {
      addReason(scenario, "best loop for evolving a live project over multiple turns", 0.32, "iterationValueScore");
      addReason(scenario, "keeps context and momentum inside the same environment", 0.18, "retentionScore");
    }
    if (impactId === "continuity_roi_path") {
      addReason(scenario, "impact model confirms continuity has the strongest ROI", 0.2, "retentionScore");
    }
  }

  if (ambiguity === "high" && scenario.id === "launch_validation_loop") {
    addReason(scenario, "heavy launch loop is riskier while the prompt remains ambiguous", -0.14, "frictionReductionScore");
  }

  if (executionIntent?.action === "none" && scenario.recommendedStrategy) {
    addReason(scenario, "executable loop is weaker when the prompt is analytical only", -0.16, "executionRealityScore");
  }

  scenario.score = clamp(scenario.score);
  scenario.adoptionScore = clamp(scenario.adoptionScore);
  scenario.frictionReductionScore = clamp(scenario.frictionReductionScore);
  scenario.iterationValueScore = clamp(scenario.iterationValueScore);
  scenario.executionRealityScore = clamp(scenario.executionRealityScore);
  scenario.retentionScore = clamp(scenario.retentionScore);

  return scenario;
}

export function simulateUsageScenarios({
  prompt = "",
  intentProfile = null,
  businessSimulation = null,
  productPlanSimulation = null,
  impactSimulation = null,
  activeProject = null,
  activeWorkObject = null,
  executionIntent = null
} = {}) {
  const normalizedPrompt = normalizeText(prompt);
  const scenarios = inferCandidates({
    businessSimulation,
    productPlanSimulation,
    impactSimulation,
    activeProject,
    activeWorkObject,
    intentProfile
  }).map((scenario) =>
    scoreScenario(scenario, {
      normalizedPrompt,
      intentProfile,
      businessSimulation,
      productPlanSimulation,
      impactSimulation,
      activeProject,
      activeWorkObject,
      executionIntent
    })
  );

  const ranked = [...scenarios].sort((left, right) => right.score - left.score);
  const primaryScenario = ranked[0] || null;

  return {
    primaryScenario,
    scenarios: ranked,
    summary: primaryScenario
      ? `${primaryScenario.id} selected with score ${primaryScenario.score}`
      : "no usage scenario"
  };
}

export function applyUsageScenario({
  environmentPlan = null,
  usageScenarioSimulation = null
} = {}) {
  const selected = usageScenarioSimulation?.primaryScenario || null;
  if (!environmentPlan || !selected) {
    return environmentPlan;
  }

  const summarySuffix =
    selected.id === "launch_validation_loop"
      ? "Usage model favors a create-run-validate loop."
      : selected.id === "stakeholder_review_loop"
        ? "Usage model favors review and presentation clarity."
        : selected.id === "repeat_operator_loop"
          ? "Usage model favors repeat operational usage in the workspace."
          : selected.id === "continuous_iteration_loop"
            ? "Usage model favors long-lived iterative evolution."
            : "Usage model favors a fast first success.";

  return {
    ...environmentPlan,
    workspacePriority: selected.workspacePriority,
    assistantRole: selected.assistantRole,
    interactionMode: selected.interactionMode,
    recommendedStrategy:
      selected.recommendedStrategy || environmentPlan.recommendedStrategy,
    usageScenario: selected,
    usageScenarioSimulation,
    summary: `${environmentPlan.summary} ${summarySuffix}`.trim()
  };
}

export default {
  simulateUsageScenarios,
  applyUsageScenario
};
