import { BaseAgent } from "./BaseAgent.js";
import { shouldExecute } from "../core/executionIntent.js";

function createAgentStep(id, type, purpose) {
  return {
    id,
    type,
    provider: type,
    capability: purpose,
    purpose,
    status: "pending"
  };
}

function mergeAgentSteps(plan, injectedSteps = []) {
  if (!injectedSteps.length) {
    return plan;
  }

  const firstLlmIndex = (plan.steps || []).findIndex((step) => step.type === "llm");
  const mergedSteps =
    firstLlmIndex >= 0
      ? [
          ...(plan.steps || []).slice(0, firstLlmIndex),
          ...injectedSteps,
          ...(plan.steps || []).slice(firstLlmIndex)
        ]
      : [...(plan.steps || []), ...injectedSteps];

  return {
    ...plan,
    steps: mergedSteps
  };
}

export class OrchestratorAgent extends BaseAgent {
  constructor({ plannerAgent, strategyAgent = null }) {
    super({
      id: "orchestrator_agent",
      label: "Orchestrator Agent",
      role: "agent selection and multi-agent coordination"
    });

    this.plannerAgent = plannerAgent;
    this.strategyAgent = strategyAgent;
  }

  async execute({
    prompt,
    attachments = [],
    latestExecution = null,
    activeWorkObject = null,
    projectContinuity = null,
    internalCapabilityProfiles = []
  } = {}) {
    const planning = await this.plannerAgent.execute({
      prompt,
      attachments,
      latestExecution,
      activeWorkObject,
      projectContinuity
    });
    const strategyDecision = this.strategyAgent
      ? await this.strategyAgent.execute({
          prompt: planning.resolvedPrompt || prompt,
          classification: planning.classification,
          domainProfile: planning.domainProfile,
          reusedLearnings: planning.reusedLearnings || [],
          projectContext: planning.projectContext || null,
          executionIntent: planning.executionIntent || null,
          strategySimulation: planning.strategySimulation || null,
          intentProfile: planning.intentProfile || null,
          environmentPlan: planning.environmentPlan || null,
          environmentSimulation: planning.environmentSimulation || null,
          projectTrajectory: planning.projectTrajectory || null,
          businessSimulation: planning.businessSimulation || null,
          productPlanSimulation: planning.productPlanSimulation || null,
          impactSimulation: planning.impactSimulation || null,
          usageScenarioSimulation: planning.usageScenarioSimulation || null,
          activeWorkObject,
          internalCapabilityProfiles
        })
      : null;

    const activeAgents = ["strategy_agent", "planner_agent", "executor_agent", "critic_agent", "memory_agent"];
    const injectedSteps = [];
    const domainProfile = planning.domainProfile || planning.plan.domainProfile || null;
    const isBrowserFastPath = planning.plan.strategy === "runtime-browser-fastpath";

    const shouldExecuteProject =
      planning.executionIntent?.action === "project_scaffold" &&
      shouldExecute(
        planning.executionIntent,
        strategyDecision,
        planning.executionIntent?.planState || planning.plan?.planState || ""
      );
    const needsResearch =
      !isBrowserFastPath &&
      (
        strategyDecision?.selectedAgents?.includes("research_agent") ||
        (
          !shouldExecuteProject &&
          (
            domainProfile?.useResearchAgent ||
            attachments.length > 0 ||
            Boolean(planning.plan.webNeed)
          )
        )
      );
    const needsApiAgent =
      !isBrowserFastPath &&
      (domainProfile?.useApiAgent ||
        Boolean(planning.plan.apiNeed) ||
        planning.classification === "hybrid_task");

    if (needsResearch) {
      activeAgents.push("research_agent");
      injectedSteps.push(
        createAgentStep(
          "research_agent:context",
          "research_agent",
          "prepare_research_context"
        )
      );
    }

    if (needsApiAgent || strategyDecision?.selectedAgents?.includes("api_agent")) {
      activeAgents.push("api_agent");
      injectedSteps.push(
        createAgentStep("api_agent:strategy", "api_agent", "prepare_api_strategy")
      );
    }

    if (shouldExecuteProject) {
      activeAgents.push("project_builder");
      injectedSteps.push({
        id: "project_builder:execute",
        type: "tool",
        provider: "project-builder",
        toolId: "project_builder",
        capability: "project_scaffold",
        purpose: "execute_project_scaffold",
        status: "pending",
        executionIntent: planning.executionIntent
      });
    }

    if (
      domainProfile?.useGitAgent ||
      planning.plan.gitHubNeed ||
      strategyDecision?.selectedAgents?.includes("git_agent")
    ) {
      activeAgents.push("git_agent");
    }

    return {
      ...planning,
      strategyDecision,
      globalProjectContext: strategyDecision?.globalProjectContext || null,
      plan: mergeAgentSteps(planning.plan, injectedSteps),
      orchestration: {
        domainProfile,
        activeAgents: [...new Set(activeAgents)],
        strategyDecision,
        injectedSteps: injectedSteps.map((step) => ({
          id: step.id,
          type: step.type,
          purpose: step.purpose
        }))
      }
    };
  }
}

export default OrchestratorAgent;
