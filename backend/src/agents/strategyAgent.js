import { BaseAgent } from "./BaseAgent.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isProjectPrompt(prompt = "") {
  return /\b(project|app|dashboard|workspace|api|backend|frontend|builder|deploy)\b/i.test(String(prompt || ""));
}

function needsDeliveryValidation(prompt = "") {
  return /\b(prete?|pret|lancer|launch|ready to run|assure qu.?elle demarre|validate the run|valide le run|demarre|start it)\b/i.test(
    normalizeText(prompt)
  );
}

export class StrategyAgent extends BaseAgent {
  constructor({
    patternLibrary = null,
    evolutionOptimizer = null,
    globalProjectService = null
  } = {}) {
    super({
      id: "strategy_agent",
      label: "Strategy Agent",
      role: "meta-level execution strategy selection"
    });

    this.patternLibrary = patternLibrary;
    this.evolutionOptimizer = evolutionOptimizer;
    this.globalProjectService = globalProjectService;
  }

  async execute({
    prompt,
    classification,
    domainProfile,
    reusedLearnings = [],
    projectContext = null,
    executionIntent = null,
    strategySimulation = null,
    intentProfile = null,
    environmentPlan = null,
    environmentSimulation = null,
    projectTrajectory = null,
    businessSimulation = null,
    productPlanSimulation = null,
    impactSimulation = null,
    usageScenarioSimulation = null,
    activeWorkObject = null,
    project = null,
    internalCapabilityProfiles = []
  } = {}) {
    const domain = domainProfile?.id || classification || "simple_chat";
    const recommendations = this.evolutionOptimizer?.getRecommendations(domain) || {
      topAgents: [],
      topStrategies: []
    };
    const patterns = this.patternLibrary?.search(prompt, { limit: 3 }) || [];
    const globalProjectContext = this.globalProjectService?.buildContext({
      prompt,
      classification,
      projectContext,
      activeWorkObject,
      project,
      internalCapabilityProfiles
    }) || null;
    const simulatedPrimaryAction = strategySimulation?.primaryCandidate?.action || "";
    const simulatedNonExecutionStrategy =
      !executionIntent?.readyToAct && simulatedPrimaryAction === "clarify_before_execution"
        ? "structured_reasoning"
        : !executionIntent?.readyToAct && simulatedPrimaryAction === "answer_only"
          ? ["compare", "reasoning", "complex_reasoning", "coding"].includes(classification)
            ? "structured_reasoning"
            : "fast_grounded_response"
          : "";
    const trajectoryHint = projectTrajectory?.primaryTrajectory?.id || "";
    const businessHint = businessSimulation?.primaryScenario?.id || "";
    const productPlanHint = productPlanSimulation?.primaryPlan?.id || "";
    const productRecommendedStrategy =
      productPlanSimulation?.primaryPlan?.recommendedStrategy || "";
    const impactHint = impactSimulation?.primaryOutcome?.id || "";
    const impactRecommendedStrategy =
      impactSimulation?.primaryOutcome?.recommendedStrategy || "";
    const usageHint = usageScenarioSimulation?.primaryScenario?.id || "";
    const usageRecommendedStrategy =
      usageScenarioSimulation?.primaryScenario?.recommendedStrategy || "";
    const projectScaffoldStrategy =
      executionIntent?.readyToAct && executionIntent?.action === "project_scaffold"
        ? needsDeliveryValidation(prompt)
          ? "validate_and_deliver"
          : "direct_project_execution"
        : "";
    const chosenStrategy =
      simulatedNonExecutionStrategy
        ? simulatedNonExecutionStrategy
      : projectScaffoldStrategy
        ? projectScaffoldStrategy
      : usageRecommendedStrategy === "validate_and_deliver"
        ? "validate_and_deliver"
      : usageRecommendedStrategy === "environment_transformation"
        ? "environment_transformation"
      : usageRecommendedStrategy === "direct_project_execution"
        ? "direct_project_execution"
      : usageRecommendedStrategy === "direct_environment_creation"
        ? "direct_environment_creation"
      : impactRecommendedStrategy === "validate_and_deliver"
        ? "validate_and_deliver"
      : impactRecommendedStrategy === "environment_transformation"
        ? "environment_transformation"
      : impactRecommendedStrategy === "direct_project_execution"
        ? "direct_project_execution"
      : impactRecommendedStrategy === "direct_environment_creation"
        ? "direct_environment_creation"
      : productRecommendedStrategy === "validate_and_deliver"
        ? "validate_and_deliver"
      : productRecommendedStrategy === "environment_transformation"
        ? "environment_transformation"
      : productRecommendedStrategy === "direct_project_execution"
        ? "direct_project_execution"
      : productRecommendedStrategy === "direct_environment_creation"
        ? "direct_environment_creation"
      : businessHint === "mvp_launch"
        ? "validate_and_deliver"
      : trajectoryHint === "full_delivery_project"
        ? "validate_and_deliver"
      : ["extend_project_shell", "new_project_branch"].includes(trajectoryHint)
        ? "direct_project_execution"
      : trajectoryHint === "linked_object_extension"
        ? "direct_environment_creation"
      : strategySimulation?.bestExecutable?.strategyHint &&
      executionIntent?.action === "none"
        ? strategySimulation.bestExecutable.strategyHint
      : executionIntent?.action === "environment_transform"
        ? "environment_transformation"
      : executionIntent?.action === "environment_create"
        ? "direct_environment_creation"
      : executionIntent?.action === "environment_update"
        ? "targeted_environment_update"
      : classification === "artifact_generation" && intentProfile?.actionMode === "create"
        ? "direct_environment_creation"
      : intentProfile?.actionMode === "modify" && activeWorkObject
        ? "targeted_environment_update"
      : recommendations.topStrategies?.[0]?.strategyId ||
          (domain === "github_research"
            ? "github_pattern_analysis"
            : ["coding", "compare", "reasoning", "complex_reasoning"].includes(classification)
              ? "structured_reasoning"
              : domain === "brainstorm"
                ? "diverse_ideation"
                : "fast_grounded_response");

    const selectedAgents = ["planner_agent", "executor_agent", "critic_agent", "memory_agent"];
    if (executionIntent?.readyToAct) {
      if (!executionIntent?.explicitAction && domain === "github_research") {
        selectedAgents.push("git_agent", "research_agent");
      }
    } else if (domain === "github_research") {
      selectedAgents.push("git_agent", "research_agent");
    } else if (["coding", "compare", "reasoning", "complex_reasoning"].includes(classification)) {
      selectedAgents.push("research_agent");
    }

    return {
      domain,
      chosenStrategy,
      rationale:
        usageHint === "launch_validation_loop"
          ? "Usage model favors a create-run-validate loop the user can trust immediately."
        : usageHint === "stakeholder_review_loop"
          ? "Usage model favors a review-first experience for stakeholder-facing work."
        : usageHint === "repeat_operator_loop"
          ? "Usage model favors an environment the user will operate repeatedly in the workspace."
        : usageHint === "continuous_iteration_loop"
          ? "Usage model favors keeping the same project alive and evolving it iteratively."
        : usageHint === "quick_first_success"
          ? "Usage model favors the fastest clear result for the user."
        : impactHint === "delivery_investment_path"
          ? "Impact model says a launch-ready path creates the highest value despite the heavier build cost."
        : impactHint === "continuity_roi_path"
          ? "Impact model says continuity creates more value than fragmenting the project."
        : impactHint === "safe_transform_path"
          ? "Impact model favors a controlled transformation instead of a heavier rebuild."
        : impactHint === "operational_leverage_path"
          ? "Impact model favors an operational surface that compounds value over time."
        : impactHint === "fast_value_path"
          ? "Impact model favors the fastest useful outcome."
        : productPlanHint === "delivery_mvp_plan"
          ? "Task should follow a full product plan that ends in a launch-ready MVP."
        : productPlanHint === "project_extension_plan"
          ? "Task should extend the current project coherently instead of creating a detached output."
        : productPlanHint === "investor_asset_plan"
          ? "Task should produce an investor-facing asset, not just a generic document."
        : productPlanHint === "operating_surface_plan"
          ? "Task should become an operational surface the user can act from in the workspace."
        : productPlanHint === "design_iteration_plan"
          ? "Task should favor fast visual iteration inside the current environment."
        : businessHint === "mvp_launch"
          ? "Task should land as a runnable MVP, not just as a structured artifact."
        : businessHint === "investor_ready"
          ? "Task should become an investor-facing asset with clearer business framing."
        : businessHint === "analytics_command_center"
          ? "Task should become an operational analytics surface, not a generic document."
        : businessHint === "automation_operator"
          ? "Task should become a manipulable workflow environment."
        : chosenStrategy === "direct_project_execution"
          ? "Task is explicit enough to move from analysis to execution."
          : chosenStrategy === "validate_and_deliver"
            ? "Task requires execution plus delivery validation."
          : trajectoryHint === "linked_object_extension"
            ? "Task should enrich the current project with a linked object instead of starting over."
          : chosenStrategy === "environment_transformation"
            ? "Task should transform the current object into a new environment, not overwrite it."
          : chosenStrategy === "direct_environment_creation"
            ? "Task should instantiate the right persistent object and surface directly."
          : chosenStrategy === "targeted_environment_update"
            ? "Task should continue and improve the current environment instead of starting over."
          : chosenStrategy === "github_pattern_analysis"
          ? "Prefer deterministic repository analysis and ranking."
          : chosenStrategy === "structured_reasoning"
            ? "Task requires explicit planning, critique, and refinement."
            : chosenStrategy === "diverse_ideation"
            ? "Task benefits from broader candidate diversity."
              : "Fast grounded path is enough.",
      selectedAgents: [...new Set(selectedAgents)],
      selectedTools:
        ["direct_project_execution", "validate_and_deliver"].includes(chosenStrategy)
          ? ["project_builder"]
          : [
              "direct_environment_creation",
              "targeted_environment_update",
              "environment_transformation"
            ].includes(chosenStrategy)
            ? []
          : domain === "github_research"
            ? ["search_github_repos", "analyze_repo"]
            : [],
      retryPolicy: {
        enabled:
          !executionIntent?.readyToAct &&
          !["simple_chat", "data_lookup"].includes(classification),
        maxRetries:
          executionIntent?.readyToAct
            ? 1
            : ["coding", "compare", "reasoning", "complex_reasoning"].includes(classification)
              ? 2
              : 1
      },
      reasoningDepth:
        usageHint === "launch_validation_loop" || impactHint === "delivery_investment_path"
          ? "deep"
        : executionIntent?.readyToAct && executionIntent?.action === "project_scaffold"
          ? "standard"
          : classification === "artifact_generation"
            ? "standard"
          : ["coding", "compare", "reasoning", "complex_reasoning"].includes(classification)
            ? "deep"
            : "standard",
      useMultiPassReasoning:
        !(executionIntent?.readyToAct && executionIntent?.action === "project_scaffold") &&
        (["coding", "compare", "reasoning", "complex_reasoning"].includes(classification) || domain === "github_research"),
      fastPath: ["simple_chat", "data_lookup"].includes(classification),
      enableProjectBuilder:
        executionIntent?.action === "project_scaffold" ||
        ["direct_project_execution", "validate_and_deliver"].includes(chosenStrategy),
      fallbackWidth: chosenStrategy === "github_pattern_analysis" ? 2 : 1,
      globalProjectContext,
      intentProfile,
      environmentPlan,
      environmentSimulation,
      projectTrajectory,
      businessSimulation,
      productPlanSimulation,
      impactSimulation,
      usageScenarioSimulation,
      internalCapabilitiesSelected: globalProjectContext?.selectedCapabilities || [],
      patternHints: patterns.map((pattern) => ({
        id: pattern.id,
        category: pattern.category,
        description: pattern.description
      })),
      recommendations,
      learningCount: reusedLearnings.length,
      executionIntent: executionIntent || null
      ,
      strategySimulation
    };
  }
}

export default StrategyAgent;
