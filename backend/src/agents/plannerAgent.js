import { resolveTaskPack } from "../core/taskPackResolver.js";
import { resolveConversationalRouting } from "../core/conversationRouter.js";
import { detectGitHubNeed } from "../integrations/github/github.intent.js";
import { detectBrowserNeed } from "../runtime/browser.intent.js";
import { createStepId } from "../types/primitives.js";
import agenticConfig from "../config/agenticConfig.js";
import { BaseAgent } from "./BaseAgent.js";
import { classifyAgenticRequest } from "../core/agenticClassifier.js";
import { buildAgenticExecutionPlan } from "../core/agenticPlanBuilder.js";
import { resolveDomainProfile, tunePlanForDomain } from "../core/domainRouter.js";
import {
  buildLearningGuidance,
  detectTaskSubdomain,
  detectTaskType,
  getRelevantLearnings,
  inferProjectType,
  summarizeLearningUsage
} from "../learning/learning.reuse.js";
import { detectProjectIntent } from "../projects/project.lifecycle.js";
import { resolveExecutionIntent } from "../core/executionIntent.js";
import { resolveRequestedShape } from "../core/creationShape.js";
import { extractIntentProfile } from "../core/intentKernel.js";
import { planEnvironment } from "../core/environmentPlanner.js";
import { simulateIntentRoutes, arbitrateExecutionIntent } from "../core/intentSimulation.js";
import { simulateEnvironmentScenarios, applyEnvironmentScenario } from "../core/environmentSimulation.js";
import { simulateProjectTrajectories, applyProjectTrajectory } from "../core/projectTrajectorySimulation.js";
import { simulateBusinessScenarios, applyBusinessScenario } from "../core/businessSimulation.js";
import { simulateProductPlans, applyProductPlan } from "../core/productPlanSimulation.js";
import { simulateImpactOutcomes, applyImpactOutcome } from "../core/impactSimulation.js";
import { simulateUsageScenarios, applyUsageScenario } from "../core/usageScenarioSimulation.js";
import { resolveWorkspaceRouting } from "../projects/projectGraph.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildObjective(prompt, classification, taskPack) {
  return {
    goal: String(prompt || "").trim(),
    classification,
    taskPack: taskPack?.id || "default",
    outcome:
      classification === "artifact_generation"
        ? "produce a deliverable artifact"
        : classification === "coding"
          ? "produce an actionable engineering answer"
          : "produce a grounded final answer"
  };
}

function needsAnalyticalBrowserAnswer(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(analyse|analyze|analysis|bug|bugs|issue|issues|fix|corrige|pourquoi|why|compare|compar|resume|summary|summarize|synthese|synthese|recommend|recommande|risk|risque|audit)\b/.test(
    normalized
  );
}

function isBuildOrArchitecturePrompt(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(create|build|cree|scaffold|implement|propose|architecture|design|structure|backend|frontend|dashboard|auth|jwt|node|express|react|admin)\b/.test(
    normalized
  );
}

function hasWorkObjectEditSignals(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(montre|affiche|show|display|lis|read|modifie|modifiez|mets a jour|update|improve|ameliore|revise|rewrite|reecris|edit|refactor|ajoute|add|corrige|fix|complete|continue|poursuis|transforme|convertis|evolue|developpe)\b/.test(
    normalized
  );
}

function resolveClassificationForActiveWorkObject(
  activeWorkObject = null,
  prompt = "",
  fallbackClassification = "simple_chat"
) {
  if (!activeWorkObject || !hasWorkObjectEditSignals(prompt)) {
    return fallbackClassification;
  }

  if (["document", "presentation", "dataset", "dashboard", "workflow", "design", "benchmark", "campaign", "image", "audio", "video"].includes(activeWorkObject.objectKind)) {
    return "artifact_generation";
  }

  if (["project", "code"].includes(activeWorkObject.objectKind)) {
    return "coding";
  }

  return fallbackClassification;
}

function shouldInjectKnowledgeStep(classification, attachments = []) {
  if (!agenticConfig.enableKnowledgeSearch) {
    return false;
  }

  return (
    attachments.length > 0 ||
    ["summarize", "compare", "complex_reasoning", "coding"].includes(classification)
  );
}

function toAgentSteps(plan, { classification, attachments = [] }) {
  const mapped = [];
  let index = 0;

  if (shouldInjectKnowledgeStep(classification, attachments)) {
    mapped.push({
      id: createStepId("knowledge", index++),
      type: "knowledge",
      toolId: "knowledge_search",
      provider: "local",
      capability: "knowledge_search",
      purpose: "retrieve_local_knowledge",
      status: "pending"
    });
  }

  for (const step of plan.steps.slice(0, agenticConfig.maxPlanSteps)) {
    mapped.push({
      id: createStepId(step.type, index++),
      ...step,
      status: "pending"
    });
  }

  return mapped;
}

function maybeInjectGitHubStep(gitHubNeed, indexStart = 0) {
  if (!gitHubNeed || !agenticConfig.github.enabled) {
    return {
      gitHubNeed: null,
      injectedSteps: [],
      nextIndex: indexStart
    };
  }

  return {
    gitHubNeed,
    injectedSteps: [
      {
        id: createStepId("git", indexStart),
        type: "git_agent",
        agentId: "git_agent",
        provider: "github",
        capability: "github_research",
        purpose: "github_pattern_research",
        status: "pending",
        gitHubNeed
      }
    ],
    nextIndex: indexStart + 1
  };
}

function inferGitHubSupportNeed({
  prompt = "",
  executionIntent = null,
  detectedGitHubNeed = null,
  requestedShape = null
} = {}) {
  if (detectedGitHubNeed || !agenticConfig.github.enabled) {
    return detectedGitHubNeed;
  }

  if (executionIntent?.action !== "project_scaffold") {
    return null;
  }

  const normalized = normalizeText(prompt);
  if (/\b(without github|sans github|no github|from scratch|from zero)\b/.test(normalized)) {
    return null;
  }

  const shape = requestedShape?.shape || resolveRequestedShape(prompt).shape;
  if (!["app", "code_project", "project"].includes(shape)) {
    return null;
  }

  const buildSupportSignals =
    /\b(app|application|frontend|backend|dashboard|api|site|tool|widget|platform|plateforme|workspace|editor|builder)\b/.test(
      normalized
    );
  if (!buildSupportSignals) {
    return null;
  }

  const language =
    /\btypescript\b/.test(normalized)
      ? "TypeScript"
      : /\bpython\b/.test(normalized)
        ? "Python"
        : /\bgo\b/.test(normalized)
          ? "Go"
          : /\bjava\b/.test(normalized)
            ? "Java"
            : shape === "app" || /\b(frontend|ui|web)\b/.test(normalized)
              ? "JavaScript"
              : "";

  return {
    action: "search",
    repoRef: "",
    query: prompt,
    filters: {
      language,
      minStars: 50
    },
    codeQuery: prompt
  };
}

function isBrowserDominantPrompt(prompt = "", browserNeed = null) {
  if (!browserNeed) {
    return false;
  }

  const normalized = normalizeText(prompt);
  const browserActionSignals =
    /\b(ouvre|navigue|navigate|goto|go to|visit|page|url|lien|liens|links|click|clique|fill|remplis|form|formulaire|screenshot|capture|dom|html|texte visible|visible content|liste les liens|read the page|lis la page)\b/.test(
      normalized
    );
  const engineeringSignals =
    /\b(bug|bugs|error|errors|debug|fix|corrige|issue|issues|stack|trace|lint|build|test|tests|repo|repository|workspace|code|component|composant|css|react|frontend|backend|architecture|risque|risk)\b/.test(
      normalized
    );

  return browserActionSignals && !engineeringSignals;
}

function resolveAgenticClassification({
  prompt,
  attachments = [],
  legacyClassification,
  browserNeed,
  gitHubNeed = null
}) {
  const requestedShape = resolveRequestedShape(prompt);
  if (gitHubNeed) {
    return legacyClassification;
  }

  if (["dashboard", "workflow", "design", "spreadsheet", "presentation", "document", "dataset"].includes(requestedShape.shape)) {
    return legacyClassification;
  }

  if (
    !browserNeed &&
    isBuildOrArchitecturePrompt(prompt) &&
    !["compare", "summarize", "data_lookup"].includes(legacyClassification)
  ) {
    return "coding";
  }

  if (
    !browserNeed &&
    isBuildOrArchitecturePrompt(prompt) &&
    legacyClassification === "data_lookup"
  ) {
    return "coding";
  }

  if (!browserNeed) {
    return legacyClassification;
  }

  if (["compare", "summarize", "hybrid_task", "data_lookup"].includes(legacyClassification)) {
    return legacyClassification;
  }

  if (isBrowserDominantPrompt(prompt, browserNeed) && !attachments.length) {
    return "data_lookup";
  }

  return legacyClassification;
}

function maybeInjectBrowserStep(browserNeed, indexStart = 0) {

  if (!browserNeed || !agenticConfig.runtime.allowBrowser) {
    return {
      browserNeed: null,
      injectedSteps: [],
      nextIndex: indexStart
    };
  }

  return {
    browserNeed,
    injectedSteps: [
      {
        id: createStepId("browser", indexStart),
        type: "tool",
        provider: "runtime-browser",
        toolId: "browser_automation",
        capability: `browser_${browserNeed.action || "inspect"}`,
        purpose: "browser_runtime_action",
        status: "pending",
        browserNeed
      }
    ],
    nextIndex: indexStart + 1
  };
}

function shouldUseBrowserFastPath({
  prompt,
  attachments = [],
  browserNeed,
  classification
}) {
  if (!browserNeed || !agenticConfig.runtime.allowBrowser || attachments.length) {
    return false;
  }

  if (classification !== "data_lookup") {
    return false;
  }

  if (!isBrowserDominantPrompt(prompt, browserNeed)) {
    return false;
  }

  if (needsAnalyticalBrowserAnswer(prompt)) {
    return false;
  }

  return true;
}

export class PlannerAgent extends BaseAgent {
  constructor({ learningStore = null, config = agenticConfig } = {}) {
    super({
      id: "planner_agent",
      label: "Planner Agent",
      role: "goal analysis and execution planning"
    });

    this.learningStore = learningStore;
    this.config = config;
  }

  async execute({
    prompt,
    attachments = [],
    latestExecution = null,
    activeWorkObject = null,
    projectContinuity = null
  }) {
    const routing = resolveConversationalRouting({
      prompt,
      attachments,
      latestExecution
    });
    const routedPrompt = routing.resolvedPrompt || prompt;
    const routedClassification = resolveClassificationForActiveWorkObject(
      activeWorkObject,
      routedPrompt,
      classifyAgenticRequest(routedPrompt, attachments)
    );
    const routedProjectContext = detectProjectIntent({
      prompt: routedPrompt,
      classification: routedClassification
    });
    const preliminaryIntentProfile = extractIntentProfile({
      prompt: routedPrompt,
      attachments,
      classification: routedClassification,
      activeWorkObject
    });
    const rawExecutionIntent = resolveExecutionIntent({
      prompt,
      resolvedPrompt: routedPrompt,
      latestExecution,
      classification: routedClassification,
      projectContext: routedProjectContext,
      activeWorkObject
    });
    const strategySimulation = simulateIntentRoutes({
      prompt: routedPrompt,
      intentProfile: preliminaryIntentProfile,
      executionIntent: rawExecutionIntent,
      activeWorkObject,
      projectContext: routedProjectContext,
      latestExecution
    });
    const executionIntent = arbitrateExecutionIntent(
      rawExecutionIntent,
      strategySimulation
    );
    const resolvedPrompt = executionIntent.executionPrompt || routedPrompt;
    const browserNeed = detectBrowserNeed(resolvedPrompt);
    const detectedGitHubNeed = detectGitHubNeed(resolvedPrompt);
    const gitHubNeed = inferGitHubSupportNeed({
      prompt: resolvedPrompt,
      executionIntent,
      detectedGitHubNeed,
      requestedShape: resolveRequestedShape(resolvedPrompt)
    });
    const legacyClassification = resolveClassificationForActiveWorkObject(
      activeWorkObject,
      resolvedPrompt,
      classifyAgenticRequest(resolvedPrompt, attachments)
    );
    const classification =
      executionIntent.action === "project_scaffold"
        ? "coding"
        : ["environment_create", "environment_update", "environment_transform"].includes(
              executionIntent.action
            )
          ? "artifact_generation"
          : resolveAgenticClassification({
          prompt: resolvedPrompt,
          attachments,
          legacyClassification,
          browserNeed,
          gitHubNeed
        });
    const intentProfile = extractIntentProfile({
      prompt: resolvedPrompt,
      attachments,
      classification,
      activeWorkObject
    });
    const legacyPlan = buildAgenticExecutionPlan(classification, resolvedPrompt, {
      attachments
    });
    const taskPack =
      legacyPlan.taskPack ||
      resolveTaskPack({
        classification,
        prompt: resolvedPrompt,
        attachments,
        apiNeed: legacyPlan.apiNeed,
        webNeed: legacyPlan.webNeed,
        toolNeed: legacyPlan.toolNeed
      });
    const domainProfile = resolveDomainProfile({
      prompt: resolvedPrompt,
      classification,
      taskPack,
      attachments,
      apiNeed: legacyPlan.apiNeed,
      webNeed: legacyPlan.webNeed,
      toolNeed: legacyPlan.toolNeed,
      browserNeed,
      gitHubNeed
    });
    const taskSubdomain = detectTaskSubdomain({
      prompt,
      resolvedPrompt,
      classification,
      domain: domainProfile.id
    });
    const resolvedActiveProject =
      activeWorkObject?.projectId
        ? { id: activeWorkObject.projectId }
        : projectContinuity?.activeProject?.id
          ? { id: projectContinuity.activeProject.id }
          : null;
    const projectContext = activeWorkObject?.projectId
      ? {
          isProjectTask: true,
          nameHint: activeWorkObject.title || "hydria-project",
          linkedWorkObjectId: activeWorkObject.id,
          linkedProjectId: activeWorkObject.projectId
        }
      : projectContinuity?.activeProject?.id
        ? {
            isProjectTask: true,
            nameHint: projectContinuity.activeProject.name || "hydria-project",
            linkedWorkObjectId: projectContinuity.activeWorkObject?.id || "",
            linkedProjectId: projectContinuity.activeProject.id
          }
      : detectProjectIntent({
          prompt: resolvedPrompt,
          classification
        });
    let environmentPlan = planEnvironment({
      intentProfile,
      classification,
      projectContext,
      activeWorkObject
    });
    const environmentSimulation = simulateEnvironmentScenarios({
      environmentPlan,
      intentProfile,
      executionIntent,
      activeWorkObject,
      activeProject: resolvedActiveProject,
      projectContext
    });
    environmentPlan = applyEnvironmentScenario(environmentPlan, environmentSimulation);
    const projectTrajectory = simulateProjectTrajectories({
      prompt: resolvedPrompt,
      intentProfile,
      environmentPlan,
      executionIntent,
      activeProject: resolvedActiveProject,
      activeWorkObject
    });
    environmentPlan = applyProjectTrajectory({
      environmentPlan,
      projectTrajectory
    });
    const businessSimulation = simulateBusinessScenarios({
      prompt: resolvedPrompt,
      intentProfile,
      environmentPlan,
      projectTrajectory,
      activeProject: resolvedActiveProject,
      activeWorkObject
    });
    environmentPlan = applyBusinessScenario({
      environmentPlan,
      businessSimulation,
      activeProject: activeWorkObject?.projectId ? { id: activeWorkObject.projectId } : null
    });
    const productPlanSimulation = simulateProductPlans({
      prompt: resolvedPrompt,
      intentProfile,
      environmentPlan,
      projectTrajectory,
      businessSimulation,
      activeProject: resolvedActiveProject,
      activeWorkObject
    });
    environmentPlan = applyProductPlan({
      environmentPlan,
      productPlanSimulation,
      activeProject: activeWorkObject?.projectId ? { id: activeWorkObject.projectId } : null
    });
    const impactSimulation = simulateImpactOutcomes({
      prompt: resolvedPrompt,
      intentProfile,
      projectTrajectory,
      businessSimulation,
      productPlanSimulation,
      activeProject: resolvedActiveProject,
      activeWorkObject
    });
    environmentPlan = applyImpactOutcome({
      environmentPlan,
      impactSimulation
    });
    const usageScenarioSimulation = simulateUsageScenarios({
      prompt: resolvedPrompt,
      intentProfile,
      businessSimulation,
      productPlanSimulation,
      impactSimulation,
      activeProject: resolvedActiveProject,
      activeWorkObject,
      executionIntent
    });
    environmentPlan = applyUsageScenario({
      environmentPlan,
      usageScenarioSimulation
    });
    const workspaceRouting = resolveWorkspaceRouting({
      prompt: resolvedPrompt,
      intentProfile,
      executionIntent,
      environmentPlan,
      activeProject: projectContinuity?.activeProject || null,
      activeWorkObject
    });
    environmentPlan = {
      ...environmentPlan,
      workspaceRouting
    };
    const taskType = detectTaskType({
      prompt,
      resolvedPrompt,
      classification,
      domain: domainProfile.id
    });
    const reusedLearnings =
      this.config.learning?.enabled && this.learningStore
        ? await getRelevantLearnings(
            {
              prompt,
              resolvedPrompt,
              classification,
              domain: domainProfile.id,
              subdomain: taskSubdomain,
              taskType,
              attachments,
              projectType: inferProjectType({
                classification,
                domain: domainProfile.id
              })
            },
            this.learningStore,
            {
          limit: this.config.learning.maxRelevant,
              minConfidence: this.config.learning.minConfidence
            }
          )
        : [];
    const learningGuidance = buildLearningGuidance(reusedLearnings, {
      domain: domainProfile.id,
      projectType: inferProjectType({
        classification,
        domain: domainProfile.id
      })
    });
    const reusedLearningSummary = summarizeLearningUsage(reusedLearnings);
    const tunedLegacyPlan = tunePlanForDomain(legacyPlan, domainProfile);

    if (
      shouldUseBrowserFastPath({
        prompt: resolvedPrompt,
        attachments,
        browserNeed,
        classification
      })
    ) {
      return {
        routing,
        resolvedPrompt,
        classification,
        taskPack,
        domainProfile,
        projectContext,
        intentProfile,
        environmentPlan,
        activeWorkObject,
        strategySimulation,
        environmentSimulation,
        projectTrajectory,
        businessSimulation,
        productPlanSimulation,
        impactSimulation,
        usageScenarioSimulation,
        workspaceRouting,
        reusedLearnings,
        reusedLearningSummary,
        plan: {
          ...tunedLegacyPlan,
          strategy: "runtime-browser-fastpath",
          taskPack,
          domainProfile,
          executionIntent,
          strategySimulation,
          environmentSimulation,
          projectTrajectory,
          businessSimulation,
          productPlanSimulation,
          impactSimulation,
          usageScenarioSimulation,
          workspaceRouting,
          learningGuidance,
          reusedLearnings: reusedLearningSummary,
          taskSubdomain,
          taskType,
          browserNeed,
          gitHubNeed,
          objective: buildObjective(resolvedPrompt, classification, taskPack),
          steps: [
            {
              id: createStepId("browser", 0),
              type: "tool",
              provider: "runtime-browser",
              toolId: "browser_automation",
              capability: `browser_${browserNeed.action || "inspect"}`,
              purpose: "browser_runtime_fastpath",
              status: "pending",
              browserNeed
            }
          ]
        }
      };
    }

    const baseSteps = toAgentSteps(tunedLegacyPlan, { classification, attachments });
    const browserInjection = maybeInjectBrowserStep(browserNeed, baseSteps.length + 1);
    const gitInjection = maybeInjectGitHubStep(
      gitHubNeed,
      baseSteps.length + 1 + browserInjection.injectedSteps.length
    );
    const firstLlmIndex = baseSteps.findIndex((step) => step.type === "llm");
    const preLlmInjected = [
      ...browserInjection.injectedSteps,
      ...gitInjection.injectedSteps
    ];
    const mergedSteps =
      preLlmInjected.length === 0
        ? baseSteps
        : firstLlmIndex >= 0
          ? [
              ...baseSteps.slice(0, firstLlmIndex),
              ...preLlmInjected,
              ...baseSteps.slice(firstLlmIndex)
            ]
          : [...baseSteps, ...preLlmInjected];

    const plan = {
      ...tunedLegacyPlan,
      taskPack,
      domainProfile,
      executionIntent,
      strategySimulation,
      environmentSimulation,
      projectTrajectory,
      businessSimulation,
      productPlanSimulation,
      impactSimulation,
      usageScenarioSimulation,
      learningGuidance,
      reusedLearnings: reusedLearningSummary,
      taskSubdomain,
      taskType,
      browserNeed: browserInjection.browserNeed,
      gitHubNeed: gitInjection.gitHubNeed,
      objective: buildObjective(resolvedPrompt, classification, taskPack),
      steps: mergedSteps
    };

    return {
      routing,
      resolvedPrompt,
      classification,
      taskPack,
      domainProfile,
      projectContext,
      intentProfile,
      environmentPlan,
      activeWorkObject,
      executionIntent,
      strategySimulation,
      environmentSimulation,
      projectTrajectory,
      businessSimulation,
      productPlanSimulation,
      impactSimulation,
      usageScenarioSimulation,
      workspaceRouting,
      reusedLearnings,
      reusedLearningSummary,
      learningGuidance,
      taskSubdomain,
      taskType,
      plan
    };
  }
}

export default PlannerAgent;
