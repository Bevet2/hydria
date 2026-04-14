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

function createOutcome(id, options = {}) {
  return {
    id,
    label: options.label || id,
    score: 0.18,
    userValueEstimate: 0,
    buildCostEstimate: 0,
    transformationRiskEstimate: 0,
    continuityRoiEstimate: 0,
    timeToValueEstimate: 0,
    recommendedStrategy: options.recommendedStrategy || "",
    riskPosture: options.riskPosture || "balanced",
    reasons: []
  };
}

function addReason(outcome, message, delta = 0, field = "") {
  outcome.reasons.push(message);
  outcome.score += delta;
  if (field && typeof outcome[field] === "number") {
    outcome[field] += delta;
  }
}

function inferOutcomes({
  productPlanSimulation = null,
  businessSimulation = null
} = {}) {
  const productPlanId = productPlanSimulation?.primaryPlan?.id || "";
  const businessId = businessSimulation?.primaryScenario?.id || "";
  const outcomes = [
    createOutcome("fast_value_path", {
      label: "Fast value path",
      recommendedStrategy: "direct_environment_creation",
      riskPosture: "conservative"
    })
  ];

  if (["project_extension_plan", "operating_surface_plan"].includes(productPlanId)) {
    outcomes.push(
      createOutcome("continuity_roi_path", {
        label: "Continuity ROI path",
        recommendedStrategy: "direct_environment_creation",
        riskPosture: "balanced"
      })
    );
  }

  if (productPlanId === "project_shell_plan") {
    outcomes.push(
      createOutcome("system_foundation_path", {
        label: "System foundation path",
        recommendedStrategy: "direct_project_execution",
        riskPosture: "balanced"
      })
    );
  }

  if (productPlanId === "delivery_mvp_plan" || businessId === "mvp_launch") {
    outcomes.push(
      createOutcome("delivery_investment_path", {
        label: "Delivery investment path",
        recommendedStrategy: "validate_and_deliver",
        riskPosture: "aggressive"
      })
    );
  }

  if (["investor_asset_plan", "design_iteration_plan"].includes(productPlanId) || businessId === "investor_ready") {
    outcomes.push(
      createOutcome("safe_transform_path", {
        label: "Safe transform path",
        recommendedStrategy: "environment_transformation",
        riskPosture: "controlled"
      })
    );
  }

  if (["analytics_command_center", "automation_operator"].includes(businessId)) {
    outcomes.push(
      createOutcome("operational_leverage_path", {
        label: "Operational leverage path",
        recommendedStrategy: "direct_environment_creation",
        riskPosture: "balanced"
      })
    );
  }

  return outcomes;
}

function scoreOutcome(outcome, {
  normalizedPrompt = "",
  intentProfile = null,
  projectTrajectory = null,
  businessSimulation = null,
  productPlanSimulation = null,
  activeProject = null,
  activeWorkObject = null
} = {}) {
  const businessId = businessSimulation?.primaryScenario?.id || "";
  const productPlanId = productPlanSimulation?.primaryPlan?.id || "";
  const trajectoryId = projectTrajectory?.primaryTrajectory?.id || "";
  const ambiguity = intentProfile?.ambiguity?.level || "low";
  const hasProject = Boolean(activeProject?.id || activeWorkObject?.projectId);
  const continuationSignals = Boolean(intentProfile?.continuationSignals);
  const launchSignals = has(/\b(mvp|launch|lancer|pret|prete|ready|deploy|livr|demarre|start)\b/, normalizedPrompt);
  const investorSignals = has(/\b(investor|investisseurs?|pitch|deck|fundraising|business plan)\b/, normalizedPrompt);
  const operationalSignals = has(/\b(dashboard|analytics|workflow|automation|kpi|metrics?|pipeline|agent)\b/, normalizedPrompt);

  if (outcome.id === "delivery_investment_path") {
    if (productPlanId === "delivery_mvp_plan" || businessId === "mvp_launch") {
      addReason(outcome, "highest upside when the user wants a launchable product", 0.36, "userValueEstimate");
      addReason(outcome, "worth the higher build investment", 0.18, "buildCostEstimate");
    }
    if (trajectoryId === "full_delivery_project" || launchSignals) {
      addReason(outcome, "delivery trajectory is coherent with launch expectations", 0.24, "timeToValueEstimate");
    }
    if (ambiguity === "high") {
      addReason(outcome, "delivery investment becomes riskier under ambiguity", -0.18, "transformationRiskEstimate");
    }
  }

  if (outcome.id === "continuity_roi_path") {
    if (hasProject || ["linked_object_extension", "extend_project_shell"].includes(trajectoryId)) {
      addReason(outcome, "continuity compounds value on the current project", 0.32, "continuityRoiEstimate");
      addReason(outcome, "reuse lowers build cost for the next step", 0.14, "buildCostEstimate");
    }
    if (continuationSignals) {
      addReason(outcome, "prompt clearly signals ongoing project evolution", 0.18, "continuityRoiEstimate");
    }
  }

  if (outcome.id === "system_foundation_path") {
    if (productPlanId === "project_shell_plan") {
      addReason(outcome, "investing in the project shell increases long-term composability", 0.3, "continuityRoiEstimate");
      addReason(outcome, "the user can create many linked objects without restarting from scratch", 0.24, "userValueEstimate");
      addReason(outcome, "project shell creation keeps time-to-value acceptable while preserving structure", 0.14, "timeToValueEstimate");
    }
    if (hasProject) {
      addReason(outcome, "existing project context makes the system foundation even stronger", 0.12, "continuityRoiEstimate");
    }
  }

  if (outcome.id === "safe_transform_path") {
    if (productPlanId === "investor_asset_plan" || businessId === "investor_ready" || investorSignals) {
      addReason(outcome, "best balance between stronger framing and limited execution risk", 0.3, "userValueEstimate");
      addReason(outcome, "keeps transformation controlled instead of jumping to a full build", 0.18, "transformationRiskEstimate");
    }
  }

  if (outcome.id === "operational_leverage_path") {
    if (operationalSignals && ["analytics_command_center", "automation_operator"].includes(businessId)) {
      addReason(outcome, "operational surfaces create ongoing leverage for the user", 0.34, "userValueEstimate");
      addReason(outcome, "strong ROI when linked to recurring work", 0.18, "continuityRoiEstimate");
    }
    if (hasProject) {
      addReason(outcome, "existing project context makes the surface more valuable immediately", 0.12, "timeToValueEstimate");
    }
  }

  if (outcome.id === "fast_value_path") {
    addReason(outcome, "keeps time-to-value very short", 0.18, "timeToValueEstimate");
    addReason(outcome, "minimizes execution overhead", 0.16, "buildCostEstimate");
    if (ambiguity === "high") {
      addReason(outcome, "safer when the prompt is still ambiguous", 0.12, "transformationRiskEstimate");
    }
  }

  if (investorSignals && outcome.id === "fast_value_path") {
    addReason(outcome, "too shallow for an investor-facing outcome", -0.12, "userValueEstimate");
  }

  if (launchSignals && outcome.id === "fast_value_path") {
    addReason(outcome, "too weak for a launch-ready expectation", -0.12, "userValueEstimate");
  }

  if (operationalSignals && outcome.id === "safe_transform_path") {
    addReason(outcome, "controlled transformation is weaker than a dedicated operating surface here", -0.1, "userValueEstimate");
  }

  outcome.score = clamp(outcome.score);
  outcome.userValueEstimate = clamp(outcome.userValueEstimate);
  outcome.buildCostEstimate = clamp(outcome.buildCostEstimate);
  outcome.transformationRiskEstimate = clamp(outcome.transformationRiskEstimate);
  outcome.continuityRoiEstimate = clamp(outcome.continuityRoiEstimate);
  outcome.timeToValueEstimate = clamp(outcome.timeToValueEstimate);

  return outcome;
}

export function simulateImpactOutcomes({
  prompt = "",
  intentProfile = null,
  projectTrajectory = null,
  businessSimulation = null,
  productPlanSimulation = null,
  activeProject = null,
  activeWorkObject = null
} = {}) {
  const normalizedPrompt = normalizeText(prompt);
  const outcomes = inferOutcomes({
    productPlanSimulation,
    businessSimulation
  }).map((outcome) =>
    scoreOutcome(outcome, {
      normalizedPrompt,
      intentProfile,
      projectTrajectory,
      businessSimulation,
      productPlanSimulation,
      activeProject,
      activeWorkObject
    })
  );

  const ranked = [...outcomes].sort((left, right) => right.score - left.score);
  const primaryOutcome = ranked[0] || null;

  return {
    primaryOutcome,
    outcomes: ranked,
    summary: primaryOutcome
      ? `${primaryOutcome.id} selected with score ${primaryOutcome.score}`
      : "no impact outcome"
  };
}

export function applyImpactOutcome({
  environmentPlan = null,
  impactSimulation = null
} = {}) {
  const selected = impactSimulation?.primaryOutcome || null;
  if (!environmentPlan || !selected) {
    return environmentPlan;
  }

  const summarySuffix =
    selected.id === "delivery_investment_path"
      ? "Impact model favors launch value over build cost."
    : selected.id === "continuity_roi_path"
        ? "Impact model favors continuity ROI over fragmentation."
      : selected.id === "system_foundation_path"
        ? "Impact model favors building a reusable project foundation."
      : selected.id === "safe_transform_path"
          ? "Impact model favors a controlled transformation."
          : selected.id === "operational_leverage_path"
            ? "Impact model favors long-term operational leverage."
            : "Impact model favors the fastest useful outcome.";

  return {
    ...environmentPlan,
    recommendedStrategy:
      selected.recommendedStrategy || environmentPlan.recommendedStrategy,
    impactOutcome: selected,
    impactSimulation,
    riskPosture: selected.riskPosture,
    summary: `${environmentPlan.summary} ${summarySuffix}`.trim()
  };
}

export default {
  simulateImpactOutcomes,
  applyImpactOutcome
};
