import { AppError } from "../../utils/errors.js";
import logger from "../../utils/logger.js";
import { durationMs } from "../../utils/time.js";
import { synthesizeAnswers } from "./agenticSynthesizer.js";
import {
  createConversation,
  createExecutionLog,
  deriveConversationTitle,
  ensureConversationForUser,
  getLatestExecutionLog,
  getUserById,
  maybeUpdateConversationTitle,
  saveMessage
} from "../persistence/historyGateway.js";
import {
  storeUsefulMemory,
  summarizeConversationIfNeeded
} from "../memory/sqliteMemoryGateway.js";
import {
  buildAttachmentToolMessage,
  buildUserMessageContent,
  derivePromptFromAttachments,
  serializeAttachmentsForClient
} from "../attachments/attachmentGateway.js";
import HydriaBrainProvider from "./HydriaBrainProvider.js";
import agenticConfig from "../config/agenticConfig.js";
import JsonMemoryStore from "../memory/JsonMemoryStore.js";
import JsonKnowledgeStore from "../knowledge/JsonKnowledgeStore.js";
import { EvalLogStore } from "../evals/EvalLogStore.js";
import { HeuristicEvaluator } from "../evals/HeuristicEvaluator.js";
import { EvalBenchmark } from "../evals/eval.benchmark.js";
import ToolRegistry from "../tools/ToolRegistry.js";
import { PlannerAgent } from "../agents/plannerAgent.js";
import { OrchestratorAgent } from "../agents/orchestratorAgent.js";
import { ExecutorAgent } from "../agents/executorAgent.js";
import { CriticAgent } from "../agents/criticAgent.js";
import { MemoryAgent } from "../agents/memoryAgent.js";
import { ResearchAgent } from "../agents/researchAgent.js";
import { ApiAgent } from "../agents/apiAgent.js";
import { GitAgent } from "../agents/gitAgent.js";
import { AgentRegistry } from "../agents/AgentRegistry.js";
import { RuntimeStateStore } from "../runtime/runtime.state.js";
import { RuntimeSessionManager } from "../runtime/runtime.session.js";
import { RuntimePermissions } from "../runtime/runtime.permissions.js";
import { HydriaRuntimeAdapter } from "../runtime/HydriaRuntimeAdapter.js";
import { EvolutionLoop } from "../evolution/evolution.loop.js";
import { EvolutionOptimizer } from "../evolution/evolution.optimizer.js";
import { fallbackToLegacyChat } from "./legacyFallbackAdapter.js";
import ApiRegistryService from "../api-registry/api-registry.service.js";
import { applyResponseQualityPass } from "./responseQualityPass.js";
import LearningStore from "../learning/learning.store.js";
import { extractLearningFromTask } from "../learning/learning.extractor.js";
import { LearningMigrationService } from "../learning/learning.migration.js";
import {
  detectTaskSubdomain,
  detectTaskType,
  summarizeLearningUsage
} from "../learning/learning.reuse.js";
import { PatternLibrary } from "../patterns/pattern.library.js";
import { ProjectStore } from "../projects/project.store.js";
import { ProjectBuilder } from "../project-builder/projectBuilder.js";
import { detectProjectIntent, updateProjectAfterTask } from "../projects/project.lifecycle.js";
import { StrategyAgent } from "../agents/strategyAgent.js";
import WorkObjectService from "../work-objects/workObject.service.js";
import { InternalCapabilityDiscovery } from "../projects/internalCapabilityDiscovery.js";
import { GlobalProjectService } from "../projects/globalProjectService.js";
import { extractIntentProfile } from "./intentKernel.js";
import { planEnvironment, inferEnvironmentObjectKind } from "./environmentPlanner.js";
import { resolveProjectContinuity } from "./projectContinuity.js";
import { buildProjectGraph } from "../projects/projectGraph.js";

function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

function dedupeAttachmentEvidence(attachmentEvidenceUsed) {
  return [...new Map(
    (attachmentEvidenceUsed || []).map((evidence) => [
      `${evidence.attachmentId}:${evidence.sectionTitle}:${evidence.excerpt}`,
      evidence
    ])
  ).values()];
}

function hasExecutionIssues(artifacts = []) {
  return artifacts.some((artifact) => /_error$/i.test(artifact.type || ""));
}

function findProjectBuilderToolResult(toolResults = []) {
  return (
    (toolResults || []).find((result) => result?.providerId === "project_builder") || null
  );
}

function buildBasePromptForExecution(latestExecution, routingResolution, effectivePrompt, routingPrompt) {
  const previousBasePrompt =
    latestExecution?.execution_plan?.basePrompt ||
    latestExecution?.execution_plan?.resolvedPrompt ||
    latestExecution?.execution_plan?.originalPrompt ||
    "";

  if (routingResolution?.usedHistory && /^contextual_follow_up/.test(routingResolution.reason || "")) {
    return previousBasePrompt || routingPrompt || effectivePrompt;
  }

  return routingPrompt || effectivePrompt;
}

function normalizeStatus({ critique, artifacts, delivery = null }) {
  if (
    delivery &&
    !["validated", "exported", "delivered"].includes(delivery.status || "") &&
    (delivery.install?.status === "failed" || delivery.run?.status === "failed" || delivery.validation?.status === "failed")
  ) {
    return "partial_success";
  }

  if ((critique?.score || 0) >= agenticConfig.minCriticScoreForSuccess && !hasExecutionIssues(artifacts)) {
    return "success";
  }

  if (critique?.status === "failed" || (critique?.score || 0) < 35) {
    return "partial_success";
  }

  return hasExecutionIssues(artifacts) ? "partial_success" : "success";
}

function normalizeWorkspacePrompt(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isWorkspaceQuestionPrompt(prompt = "") {
  const normalized = normalizeWorkspacePrompt(prompt);
  return /^(show|display|montre|affiche|read|lis|explain|explique|why|pourquoi|what|que|resume|summarize|compare|analyse|analyze)\b/.test(
    normalized
  );
}

function isSeparateCreationPrompt(prompt = "") {
  const normalized = normalizeWorkspacePrompt(prompt);
  return /\b(new|another|nouveau|nouvelle|autre)\b/.test(normalized) &&
    /\b(project|projet|app|application|document|presentation|spreadsheet|table|sheet|dataset)\b/.test(
      normalized
    );
}

function shouldApplyPromptToActiveWorkObject({
  prompt = "",
  activeWorkObject = null,
  attachments = [],
  intentProfile = null
} = {}) {
  if (!activeWorkObject || attachments.length) {
    return false;
  }

  if (
    ![
      "document",
      "presentation",
      "dataset",
      "dashboard",
      "workflow",
      "design",
      "benchmark",
      "campaign",
      "image",
      "audio",
      "video",
      "project",
      "code"
    ].includes(activeWorkObject.objectKind)
  ) {
    return false;
  }

  if (isWorkspaceQuestionPrompt(prompt) || isSeparateCreationPrompt(prompt)) {
    return false;
  }

  const requestedKind = inferEnvironmentObjectKind(intentProfile?.requestedShape?.shape || "");
  if (
    activeWorkObject.objectKind === "project" &&
    requestedKind &&
    requestedKind !== "project"
  ) {
    return false;
  }

  if (
    intentProfile?.explicitNewEnvironment &&
    activeWorkObject.objectKind !== "project"
  ) {
    return false;
  }

  if (
    requestedKind &&
    activeWorkObject.objectKind !== "project" &&
    requestedKind !== activeWorkObject.objectKind
  ) {
    return false;
  }

  return Boolean(normalizeWorkspacePrompt(prompt));
}

function resolveActiveWorkObjectEntry(activeWorkObject = null, preferredPath = "") {
  if (!activeWorkObject) {
    return "";
  }

  const editableFiles = Array.isArray(activeWorkObject.editableFiles)
    ? activeWorkObject.editableFiles
    : [];
  const normalizedPreferred = String(preferredPath || "").trim();

  if (normalizedPreferred && editableFiles.includes(normalizedPreferred)) {
    return normalizedPreferred;
  }

  if (activeWorkObject.objectKind === "project") {
    const builderPath = editableFiles.find((entryPath) => /(^|\/)app\.config\.json$/i.test(entryPath));
    if (builderPath) {
      return builderPath;
    }
  }

  return normalizedPreferred || activeWorkObject.primaryFile || editableFiles[0] || "";
}

function findGitAgentResult(toolResults = []) {
  return (
    (toolResults || []).find(
      (result) =>
        result?.providerId === "git_agent" || result?.sourceName === "Git Agent"
    ) || null
  );
}

function findArtifactGeneratorToolResult(toolResults = []) {
  return (
    (toolResults || []).find(
      (result) => result?.providerId === "artifact_generator" || result?.capability === "artifact_generation"
    ) || null
  );
}

function dedupeLearningItems(items = []) {
  return [...new Map(
    (items || [])
      .filter((item) => item?.description)
      .map((item) => [`${item.type}:${item.category}:${item.description}`, item])
  ).values()];
}

function decorateFinalAnswerWithLearning(finalAnswer = "", learnings = [], classification = "simple_chat") {
  if (
    !learnings.length ||
    !["coding", "compare", "complex_reasoning", "hybrid_task", "artifact_generation", "brainstorm"].includes(
      classification
    )
  ) {
    return finalAnswer;
  }

  if (
    /Apprentissages deja valides|Patterns reutilises|Pattern reutilise|Strategie connue appliquee/i.test(
      finalAnswer
    )
  ) {
    return finalAnswer;
  }

  const notes = learnings
    .slice(0, 2)
    .map((item) => {
      const reuseReason = item.reuseReason || item.reuseMeta?.reuseReason || "";
      if (item.type === "mistake") {
        return `- erreur connue evitee: ${item.description}${reuseReason ? ` (${reuseReason})` : ""}`;
      }
      if (item.type === "strategy") {
        return `- strategie connue appliquee: ${item.description}${reuseReason ? ` (${reuseReason})` : ""}`;
      }
      return `- pattern reutilise: ${item.description}${reuseReason ? ` (${reuseReason})` : ""}`;
    });

  return notes.length
    ? `${finalAnswer}\n\nApprentissage reutilise\n${notes.join("\n")}`
    : finalAnswer;
}

function finalizeUserAnswer(finalSynthesis = {}, reusedLearnings = [], classification = "simple_chat") {
  if (
    ["solution_synthesis", "execution_result", "delivery_result"].includes(
      finalSynthesis?.qualityPass?.mode
    )
  ) {
    return finalSynthesis.finalAnswer || "";
  }

  return decorateFinalAnswerWithLearning(
    finalSynthesis.finalAnswer,
    reusedLearnings,
    classification
  );
}

class HydriaAutonomousBrain {
  constructor() {
    this.brainProvider = new HydriaBrainProvider();
    this.runtimeStateStore = new RuntimeStateStore({
      filePath: agenticConfig.files.runtimeState
    });
    this.sessionManager = new RuntimeSessionManager({
      stateStore: this.runtimeStateStore,
      maxActionsPerSession: agenticConfig.runtime.maxActionsPerSession,
      persistSessions: agenticConfig.runtime.persistSessions
    });
    this.permissionsManager = new RuntimePermissions({
      allowNetwork: agenticConfig.runtime.allowNetwork,
      allowBrowser: agenticConfig.runtime.allowBrowser,
      allowShell: agenticConfig.runtime.allowShell,
      allowGitClone: agenticConfig.runtime.allowGitClone,
      toolAllowlist: agenticConfig.runtime.toolAllowlist,
      browserActionAllowlist: agenticConfig.runtime.browserActionAllowlist
    });
    this.runtimeAdapter = new HydriaRuntimeAdapter({
      sessionManager: this.sessionManager
    });
    this.memoryStore = new JsonMemoryStore({
      filePath: agenticConfig.files.memoryStore,
      maxShortTermPerConversation: agenticConfig.memory.shortTermLimit,
      maxMidTermPerConversation: agenticConfig.memory.midTermLimit,
      maxLongTermPerUser: agenticConfig.memory.longTermLimit,
      maxTaskOutcomesPerUser: agenticConfig.memory.taskOutcomeLimit,
      consolidateEveryTurns: agenticConfig.memory.consolidateEveryTurns
    });
    this.knowledgeStore = new JsonKnowledgeStore({
      filePath: agenticConfig.files.knowledgeStore
    });
    this.learningStore = new LearningStore({
      filePath: agenticConfig.files.learningStore,
      maxItems: agenticConfig.learning.maxItems,
      minConfidence: agenticConfig.learning.minConfidence
    });
    this.learningMigration = new LearningMigrationService({
      learningStore: this.learningStore
    });
    this.patternLibrary = new PatternLibrary({
      filePath: agenticConfig.files.patternLibrary
    });
    this.projectStore = new ProjectStore({
      filePath: agenticConfig.files.projectStore
    });
    this.internalCapabilityDiscovery = new InternalCapabilityDiscovery({
      studioRoots: agenticConfig.internalCapabilities.studioRoots,
      musicRoots: agenticConfig.internalCapabilities.musicRoots
    });
    this.globalProjectService = new GlobalProjectService();
    this.internalCapabilityProfiles =
      agenticConfig.internalCapabilities.enabled
        ? this.internalCapabilityDiscovery.listCapabilities()
        : [];
    this.workObjectService = new WorkObjectService({
      filePath: agenticConfig.files.workObjectStore,
      rootDir: agenticConfig.files.workObjectRoot,
      brainProvider: this.brainProvider,
      projectStore: this.projectStore
    });
    this.evaluator = new HeuristicEvaluator({
      logStore: new EvalLogStore({
        filePath: agenticConfig.files.evalLog
      })
    });
    this.benchmark = new EvalBenchmark({
      filePath: agenticConfig.files.benchmarkLog,
      minImprovementDelta: agenticConfig.evals.minImprovementDelta
    });
    this.evolutionOptimizer = new EvolutionOptimizer({
      filePath: agenticConfig.files.evolutionFeedback
    });
    this.gitAgent = new GitAgent({
      config: agenticConfig,
      brainProvider: this.brainProvider
    });
    this.apiRegistryService = new ApiRegistryService();
    this.projectBuilder = new ProjectBuilder({
      runtimeAdapter: this.runtimeAdapter,
      sandboxRoot: agenticConfig.runtime.sandboxRoot,
      sessionManager: this.sessionManager
    });
    this.workObjectService.artifactExporter = this.projectBuilder.artifactExporter;
    this.toolRegistry = new ToolRegistry({
      knowledgeStore: this.knowledgeStore,
      toolLogFile: agenticConfig.files.toolLog,
      gitAgent: this.gitAgent,
      projectBuilder: this.projectBuilder,
      permissionsManager: this.permissionsManager,
      sessionManager: this.sessionManager,
      runtimeAdapter: this.runtimeAdapter,
      maxRetries: agenticConfig.runtime.maxStepRetries
    });
    this.plannerAgent = new PlannerAgent({
      learningStore: this.learningStore,
      config: agenticConfig
    });
    this.strategyAgent = new StrategyAgent({
      patternLibrary: this.patternLibrary,
      evolutionOptimizer: this.evolutionOptimizer,
      globalProjectService: this.globalProjectService
    });
    this.researchAgent = new ResearchAgent({
      knowledgeStore: this.knowledgeStore
    });
    this.apiAgent = new ApiAgent({
      apiRegistryService: this.apiRegistryService
    });
    this.orchestratorAgent = new OrchestratorAgent({
      plannerAgent: this.plannerAgent,
      strategyAgent: this.strategyAgent
    });
    this.executorAgent = new ExecutorAgent({
      brainProvider: this.brainProvider,
      toolRegistry: this.toolRegistry,
      gitAgent: this.gitAgent,
      researchAgent: this.researchAgent,
      apiAgent: this.apiAgent,
      sessionManager: this.sessionManager,
      maxStepRetries: agenticConfig.runtime.maxStepRetries
    });
    this.criticAgent = new CriticAgent({
      evaluator: this.evaluator
    });
    this.memoryAgent = new MemoryAgent({
      memoryStore: this.memoryStore,
      knowledgeStore: this.knowledgeStore,
      config: agenticConfig
    });
    this.agentRegistry = new AgentRegistry({
      agents: [
        this.orchestratorAgent,
        this.strategyAgent,
        this.plannerAgent,
        this.executorAgent,
        this.criticAgent,
        this.memoryAgent,
        this.researchAgent,
        this.apiAgent,
        this.gitAgent
      ],
      toolRegistry: this.toolRegistry
    });
    this.evolutionLoop = new EvolutionLoop({
      config: agenticConfig,
      benchmark: this.benchmark,
      executorAgent: this.executorAgent,
      criticAgent: this.criticAgent,
      sessionManager: this.sessionManager
    });
    this.learningMaintenancePromise = this.learningMigration.runMaintenance({
      maxChanges: 50
    }).catch((error) => {
      logger.warn("Hydria learning maintenance failed at startup", {
        error: error.message
      });
      return null;
    });
  }

  async ingestExecutionKnowledge({ userId, conversationId, execution, phase }) {
    if (!agenticConfig.enableKnowledgeIngestion || !execution) {
      return {
        phase,
        webInserted: 0,
        gitInserted: 0,
        errors: []
      };
    }

    const summary = {
      phase,
      webInserted: 0,
      gitInserted: 0,
      errors: []
    };

    try {
      if (execution.webResults?.length) {
        const result = await this.knowledgeStore.ingestWebResults({
          userId,
          conversationId,
          webResults: execution.webResults
        });
        summary.webInserted = result.inserted || 0;
      }
    } catch (error) {
      summary.errors.push(`web:${error.message}`);
      logger.warn("Hydria knowledge ingestion failed for web results", {
        error: error.message,
        userId,
        conversationId,
        phase
      });
    }

    try {
      const gitResult = findGitAgentResult(execution.toolResults);
      if (gitResult) {
        const result = await this.knowledgeStore.ingestGitHubResults({
          userId,
          conversationId,
          gitResult
        });
        summary.gitInserted = result.inserted || 0;
      }
    } catch (error) {
      summary.errors.push(`git:${error.message}`);
      logger.warn("Hydria knowledge ingestion failed for git results", {
        error: error.message,
        userId,
        conversationId,
        phase
      });
    }

    return summary;
  }

  async processChat({
    userId,
    conversationId,
    prompt,
    attachments = [],
    workObjectId = null,
    workObjectPath = ""
  }) {
    if (!agenticConfig.enabled) {
      return fallbackToLegacyChat({
        userId,
        conversationId,
        prompt,
        attachments
      });
    }

    const startedAt = Date.now();

    if (!userId) {
      throw new AppError("userId is required", 400);
    }

    const effectivePrompt =
      String(prompt || "").trim() || derivePromptFromAttachments(attachments);

    if (!effectivePrompt) {
      throw new AppError("prompt is required", 400);
    }

    const user = getUserById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    let activeWorkObject = workObjectId ? this.workObjectService.get(String(workObjectId)) : null;
    if (activeWorkObject && Number(activeWorkObject.userId) && Number(activeWorkObject.userId) !== Number(userId)) {
      throw new AppError("Work object does not belong to this user", 403);
    }

    if (this.learningMaintenancePromise) {
      await this.learningMaintenancePromise;
      this.learningMaintenancePromise = null;
    }

    let conversation = conversationId
      ? ensureConversationForUser(conversationId, userId)
      : createConversation({
          userId,
          title: deriveConversationTitle(effectivePrompt)
        });

    const runtimeSession = this.sessionManager.startSession({
      userId,
      conversationId: conversation.id,
      prompt: effectivePrompt
    });

    saveMessage({
      conversationId: conversation.id,
      role: "user",
      content: buildUserMessageContent(effectivePrompt, attachments),
      routeUsed: "agentic_entry"
    });
    conversation =
      maybeUpdateConversationTitle(conversation.id, effectivePrompt) || conversation;

    const latestExecution = getLatestExecutionLog(conversation.id);
    const continuity = resolveProjectContinuity({
      prompt: effectivePrompt,
      userId,
      conversationId: conversation.id,
      activeWorkObject,
      latestExecution,
      workObjectService: this.workObjectService,
      projectStore: this.projectStore
    });
    if (!activeWorkObject && continuity.activeWorkObject) {
      activeWorkObject = continuity.activeWorkObject;
    }
    const earlyIntentProfile = extractIntentProfile({
      prompt: effectivePrompt,
      attachments,
      activeWorkObject
    });
    const earlyEnvironmentPlan = planEnvironment({
      intentProfile: earlyIntentProfile,
      classification: "pending",
      projectContext:
        activeWorkObject?.projectId || continuity.activeProject?.id
          ? {
              isProjectTask: true,
              linkedProjectId: activeWorkObject?.projectId || continuity.activeProject?.id || "",
              linkedWorkObjectId: activeWorkObject?.id || "",
              nameHint: activeWorkObject?.title || continuity.activeProject?.name || ""
            }
          : null,
      activeWorkObject
    });
    const preparation = await this.memoryAgent.prepare({
      userId,
      conversationId: conversation.id,
      prompt: effectivePrompt,
      attachments
    });
    this.sessionManager.updateState(runtimeSession.id, {
      phase: "prepared",
      memoryRecall: preparation.memorySummary,
      attachmentCount: attachments.length,
      activeWorkObjectId: activeWorkObject?.id || null
    });

    const activeWorkObjectEntry = resolveActiveWorkObjectEntry(activeWorkObject, workObjectPath);
    if (
      shouldApplyPromptToActiveWorkObject({
        prompt: effectivePrompt,
        activeWorkObject,
        attachments,
        intentProfile: earlyIntentProfile
      }) &&
      activeWorkObjectEntry
    ) {
      const improved = await this.workObjectService.improveObject({
        workObjectId: activeWorkObject.id,
        prompt: effectivePrompt,
        entryPath: activeWorkObjectEntry
      });

      activeWorkObject = improved.workObject;
      const classification =
        activeWorkObject.objectKind === "project" || activeWorkObject.objectKind === "code"
          ? "coding"
          : "artifact_generation";
      const activeProject = activeWorkObject.projectId
        ? await this.projectStore.updateProject(activeWorkObject.projectId, (project) => ({
            activeWorkObjectId: activeWorkObject.id,
            ...(activeWorkObject.objectKind === "project" ? { status: "updated" } : {}),
            tasksHistory: [
              {
                prompt: effectivePrompt,
                updatedAt: new Date().toISOString(),
                mode: "active_work_object_update"
              },
              ...((project?.tasksHistory || []).slice(0, 24))
            ]
          }))
        : null;

      const finalAnswer = improved.finalAnswer;
      saveMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: finalAnswer,
        classification,
        routeUsed: "active_work_object_update"
      });

      createExecutionLog({
        conversationId: conversation.id,
        classification,
        executionPlan: {
          originalPrompt: effectivePrompt,
          resolvedPrompt: effectivePrompt,
          basePrompt: effectivePrompt,
          objective: {
            goal: effectivePrompt,
            classification,
            taskPack: "active_work_object_update",
            outcome: "update the selected work object"
          },
          agentic: {
            continuity,
            intentProfile: earlyIntentProfile,
            environmentPlan: earlyEnvironmentPlan,
            workObject: {
              id: activeWorkObject.id,
              title: activeWorkObject.title,
              type: activeWorkObject.type,
              objectKind: activeWorkObject.objectKind,
              primaryFile: activeWorkObject.primaryFile
            },
            project: activeProject
              ? {
                  id: activeProject.id,
                  name: activeProject.name,
                  type: activeProject.type,
                  status: activeProject.status,
                  workspacePath: activeProject.workspacePath
                }
              : null,
            qualityPass: {
              mode: "active_work_object_update",
              debugTraceSummary: "Applied the prompt directly to the active work object."
            }
          }
        },
        durationMs: durationMs(startedAt),
        status: "success"
      });

      this.sessionManager.updateState(runtimeSession.id, {
        phase: "evaluated",
        classification,
        activeProjectId: activeProject?.id || null
      });
      this.sessionManager.completeSession(runtimeSession.id, {
        status: "completed",
        finalClassification: classification,
        criticScore: 78
      });
      await this.runtimeAdapter.closeBrowserSession(runtimeSession.id);

      return {
        success: true,
        conversationId: conversation.id,
        classification,
        strategy: "active_work_object_update",
        routing: {
          resolvedPrompt: effectivePrompt,
          usedHistory: false,
          reason: "active_work_object_update"
        },
        executionIntent: {
          readyToAct: true,
          confidence: 0.9,
          action: "update_active_work_object",
          reason: "active_object_selected"
        },
        strategySimulation: null,
        intentProfile: earlyIntentProfile,
        environmentPlan: earlyEnvironmentPlan,
        environmentSimulation: null,
        projectTrajectory: null,
        businessSimulation: null,
        productPlanSimulation: null,
        impactSimulation: null,
        usageScenarioSimulation: null,
        projectContinuity: continuity,
        responseMode: "active_work_object_update",
        qualityPass: {
          mode: "active_work_object_update",
          debugTraceSummary: "Applied the prompt directly to the active work object."
        },
        eval: {
          status: "success",
          score: 78,
          issues: []
        },
        finalAnswer,
        modelsUsed: [],
        apisUsed: [],
        toolsUsed: ["active_work_object_update"],
        workObjects: this.workObjectService.list({
          userId,
          conversationId: conversation.id
        }),
        activeWorkObject,
        project: activeProject
          ? {
              id: activeProject.id,
              name: activeProject.name,
              type: activeProject.type,
              status: activeProject.status,
              workspacePath: activeProject.workspacePath,
              dimensions: activeProject.dimensions || [],
              internalCapabilities: activeProject.internalCapabilities || [],
              globalProject: activeProject.globalProject || null
            }
          : null,
        meta: {
          usedJudge: false,
          durationMs: durationMs(startedAt),
          criticScore: 78
        }
      };
    }

    try {
      const planning = await this.orchestratorAgent.execute({
        prompt: effectivePrompt,
        attachments,
        latestExecution,
        activeWorkObject,
        projectContinuity: continuity,
        internalCapabilityProfiles: this.internalCapabilityProfiles
      });

      const routingPrompt = planning.resolvedPrompt || effectivePrompt;
      const basePrompt = buildBasePromptForExecution(
        latestExecution,
        planning.routing,
        effectivePrompt,
        routingPrompt
      );
      const executedPlan = clonePlan(planning.plan);
      const projectContext = planning.projectContext || detectProjectIntent({
        prompt: routingPrompt,
        classification: planning.classification
      });
      const projectType =
        planning.domainProfile?.id === "github_research" ? "external" : "internal";
      const shouldKeepConversationInsideProject =
        planning.executionIntent?.readyToAct &&
        ["project_scaffold", "environment_create", "environment_update", "environment_transform"].includes(
          planning.executionIntent?.action || ""
        );
      const shouldTrackProject =
        Boolean(planning.strategyDecision?.enableProjectBuilder) ||
        Boolean(continuity.activeProject?.id) ||
        shouldKeepConversationInsideProject ||
        Boolean(planning.environmentPlan?.continueCurrentProject) ||
        Boolean(planning.workspaceRouting?.targetProjectId) ||
        ["extend_current_project", "create_new_project"].includes(
          planning.environmentPlan?.projectOperation || ""
        );
      let activeProject = null;
      if (shouldTrackProject) {
        const forceNewProject = planning.environmentPlan?.projectOperation === "create_new_project";
        activeProject = forceNewProject
          ? null
          : continuity.activeProject ||
            (projectContext.linkedProjectId &&
              this.projectStore.getProject(projectContext.linkedProjectId)) ||
            null;

        if (!activeProject) {
          const projectName =
            projectContext.nameHint && projectContext.nameHint !== "project"
              ? projectContext.nameHint
              : deriveConversationTitle(routingPrompt).replace(/\s+/g, "-").toLowerCase();
          activeProject = await this.projectStore.ensureProject({
            name: projectName,
            type: projectType,
            workspacePath: this.projectBuilder.createProjectWorkspace({
              projectName,
              projectId: conversation.id
            }),
            metadata: {
              conversationId: conversation.id,
              userId,
              intentProfile: planning.intentProfile || null,
              environmentPlan: planning.environmentPlan || null,
              workspaceRouting: planning.workspaceRouting || null,
              environmentSimulation: planning.environmentSimulation || null,
              projectTrajectory: planning.projectTrajectory || null,
              businessSimulation: planning.businessSimulation || null,
              productPlanSimulation: planning.productPlanSimulation || null,
              impactSimulation: planning.impactSimulation || null,
              usageScenarioSimulation: planning.usageScenarioSimulation || null,
              projectContinuity: continuity || null
            }
          });
        }

        if (planning.globalProjectContext && activeProject?.id) {
          activeProject =
            (await this.projectStore.updateProject(
              activeProject.id,
              this.globalProjectService.buildProjectPatch(activeProject, planning.globalProjectContext, {
                conversationId: conversation.id,
                internalCapabilities: planning.globalProjectContext.internalCapabilityIds
              })
            )) || activeProject;
        }

        if (activeProject?.id) {
          activeProject =
            (await this.projectStore.updateProject(activeProject.id, (project) => ({
              metadata: {
                ...(project.metadata || {}),
                intentProfile: planning.intentProfile || null,
                environmentPlan: planning.environmentPlan || null,
                workspaceRouting: planning.workspaceRouting || null,
                environmentSimulation: planning.environmentSimulation || null,
                projectTrajectory: planning.projectTrajectory || null,
                businessSimulation: planning.businessSimulation || null,
                productPlanSimulation: planning.productPlanSimulation || null,
                impactSimulation: planning.impactSimulation || null,
                usageScenarioSimulation: planning.usageScenarioSimulation || null,
                projectContinuity: continuity || null
              }
            }))) || activeProject;
        }
      }

      const prefersProjectShellContext =
        activeProject?.id &&
        activeWorkObject &&
        activeWorkObject.objectKind !== "project" &&
        ["environment_create", "environment_transform", "project_scaffold"].includes(
          planning.executionIntent?.action || ""
        ) &&
        /\b(ce projet|dans ce projet|pour ce projet|this project|in this project|for this project|cette app|cette application|this app|this application)\b/i.test(
          routingPrompt
        );

      let activeWorkObjectForExecution = activeWorkObject;
      let activeWorkObjectContentForExecution = this.workObjectService.getPrimaryContent(
        activeWorkObject,
        workObjectPath || activeWorkObject?.primaryFile || ""
      );

      if (prefersProjectShellContext) {
        const projectShell = this.workObjectService
          .listForProject({
            projectId: activeProject.id,
            userId,
            limit: 50
          })
          .find((item) => item.objectKind === "project");

        if (projectShell) {
          activeWorkObjectForExecution = projectShell;
          activeWorkObjectContentForExecution = this.workObjectService.getPrimaryContent(
            projectShell,
            projectShell.primaryFile || ""
          );
        }
      }

      if (activeWorkObjectForExecution?.objectKind === "project") {
        const appConfigPath =
          activeWorkObjectForExecution.files?.find((file) =>
            /(^|\/)app\.config\.json$/i.test(String(file?.path || ""))
          )?.path || "";

        if (appConfigPath) {
          const appConfigContent = this.workObjectService.getPrimaryContent(
            activeWorkObjectForExecution,
            appConfigPath
          );

          if (appConfigContent) {
            activeWorkObjectContentForExecution = appConfigContent;
          }
        }
      }

      const execution = await this.executorAgent.execute({
        userId,
        conversationId: conversation.id,
        prompt: routingPrompt,
        attachments,
        classification: planning.classification,
        plan: executedPlan,
        taskPack: planning.taskPack,
        domainProfile: planning.domainProfile,
        routing: planning.routing,
        memoryRecall: preparation.memoryRecall,
        sessionId: runtimeSession.id,
        reusedLearnings: planning.reusedLearnings || [],
        learningGuidance: planning.learningGuidance || "",
        projectType,
        strategyDecision: planning.strategyDecision || null,
        executionIntent: planning.executionIntent || null,
        project: activeProject,
        globalProjectContext: planning.globalProjectContext || null,
        activeWorkObject: activeWorkObjectForExecution,
        activeWorkObjectContext: activeWorkObjectForExecution
          ? this.workObjectService.buildContext({
              ...activeWorkObjectForExecution,
              selectedPath: workObjectPath || activeWorkObjectForExecution.primaryFile || ""
            })
          : "",
        activeWorkObjectContent: activeWorkObjectContentForExecution
      });
      const initialExecutionKnowledge = await this.ingestExecutionKnowledge({
        userId,
        conversationId: conversation.id,
        execution,
        phase: "first_pass"
      });
      this.sessionManager.updateState(runtimeSession.id, {
        phase: "executed",
        classification: planning.classification,
        objective: executedPlan.objective,
        toolCount: execution.toolsUsed.length,
        modelCount: execution.modelsUsed.length,
        knowledgeIngestion: initialExecutionKnowledge
      });

      const uniqueAttachmentEvidenceUsed = dedupeAttachmentEvidence(
        execution.attachmentEvidenceUsed
      );

      const synthesis = applyResponseQualityPass(
        execution.finalAnswerOverride
          ? {
            finalAnswer: execution.finalAnswerOverride,
            sources: execution.candidates
              .filter((candidate) => candidate.type === "llm")
              .map((candidate) => ({
                type: candidate.type,
                provider: candidate.provider,
                model: candidate.model,
                capability: null
              })),
            selectedCandidates: execution.candidates,
            judge: {
              usedJudge: false,
              mode: execution.finalAnswerMode || "agentic_artifact",
              score: 0,
              confidence: "n/a",
              decision: execution.finalAnswerMode || "artifact_generation",
              issues: [],
              candidateEvaluations: []
            }
          }
          : synthesizeAnswers(execution.candidates, {
            classification: planning.classification,
            taskPack: planning.taskPack,
            prompt: routingPrompt,
            plan: executedPlan,
            domainProfile: planning.domainProfile,
            attachments,
            attachmentEvidenceUsed: uniqueAttachmentEvidenceUsed,
            preferencesUsed: execution.preferencesUsed,
            memoryUsed: execution.memoryUsed,
            artifacts: execution.artifacts,
            apiResults: execution.apiResults,
            webResults: execution.webResults,
            toolResults: execution.toolResults,
            routingResolution: planning.routing,
            followUpActions: execution.followUpActions
          }),
        {
          classification: planning.classification,
          prompt: routingPrompt,
          domainProfile: planning.domainProfile,
          apiResults: execution.apiResults,
          webResults: execution.webResults,
          toolResults: execution.toolResults,
          attachments,
          taskPack: planning.taskPack,
          routingResolution: planning.routing,
          reusedLearnings: planning.reusedLearnings || [],
          strategyDecision: planning.strategyDecision || null
        }
      );

      const finalAnswer = synthesis.finalAnswer;
      const critique = await this.criticAgent.execute({
        prompt: routingPrompt,
        classification: planning.classification,
        domainProfile: planning.domainProfile,
        plan: {
          ...executedPlan,
          steps: execution.executionSteps
        },
        finalAnswer,
        execution
      });

      let activeExecution = execution;
      let activeSynthesis = synthesis;
      let activeCritique = critique;
      let activePlan = {
        ...executedPlan,
        steps: execution.executionSteps
      };

      const improvement = await this.evolutionLoop.maybeImprove({
        userId,
        conversationId: conversation.id,
        prompt: routingPrompt,
        attachments,
        classification: planning.classification,
        taskPack: planning.taskPack,
        routing: planning.routing,
        memoryRecall: preparation.memoryRecall,
        plan: activePlan,
        domainProfile: planning.domainProfile,
        firstPass: execution,
        firstSynthesis: synthesis,
        firstCritique: critique,
        sessionId: runtimeSession.id,
        reusedLearnings: planning.reusedLearnings || [],
        learningGuidance: planning.learningGuidance || "",
        projectType,
        strategyDecision: planning.strategyDecision || null
      });

      if (improvement?.comparison?.winner === "second") {
        activeExecution = improvement.retryExecution;
        activeSynthesis = improvement.retrySynthesis;
        activeCritique = improvement.retryCritique;
        activePlan = {
          ...improvement.improvedPlan,
          steps: improvement.retryExecution.executionSteps
        };
      }

      const finalExecution = {
        ...activeExecution,
        improvementDelta:
          improvement?.comparison?.winner === "second"
            ? Number(improvement.comparison?.delta || 0)
            : 0,
        reusedLearnings: planning.reusedLearnings || []
      };
      const finalSynthesis = activeSynthesis;
      const finalPlan = activePlan;
      const finalCritique = await this.criticAgent.execute({
        prompt: routingPrompt,
        classification: planning.classification,
        domainProfile: planning.domainProfile,
        plan: {
          ...finalPlan,
          steps: finalExecution.executionSteps
        },
        finalAnswer: finalSynthesis.finalAnswer,
        execution: finalExecution
      });
      const learningTaskContext = {
        prompt: routingPrompt,
        classification: planning.classification,
        domain: planning.domainProfile?.id || planning.classification,
        subdomain:
          planning.taskSubdomain ||
          finalPlan.taskSubdomain ||
          detectTaskSubdomain({
            prompt: routingPrompt,
            classification: planning.classification,
            domain: planning.domainProfile?.id || planning.classification
          }),
        taskType:
          planning.taskType ||
          finalPlan.taskType ||
          detectTaskType({
            prompt: routingPrompt,
            classification: planning.classification,
            domain: planning.domainProfile?.id || planning.classification
          })
      };
      const learningCandidates = dedupeLearningItems([
        ...(finalExecution.learningCandidates || []),
        ...(finalExecution.toolResults || []).flatMap((result) => result.learningCandidates || []),
        ...(improvement?.learningCandidates || []),
        ...extractLearningFromTask(
          {
            plan: finalPlan,
            executionSteps: finalExecution.executionSteps,
            artifacts: finalExecution.artifacts,
            critique: finalCritique
          },
          {
            kind: "execution",
            ...learningTaskContext,
            conversationId: conversation.id,
            project: "hydria",
            projectType: planning.domainProfile?.id === "github_research" ? "external" : "internal"
          }
        )
      ]);
      const storedLearnings =
        agenticConfig.learning.enabled && learningCandidates.length
          ? await this.learningStore.addLearningItems(learningCandidates)
          : [];
      if (storedLearnings.length) {
        await this.patternLibrary.ingestLearnings(storedLearnings);
      }
      if (agenticConfig.learning.enabled && (planning.reusedLearnings || []).length) {
        await this.learningStore.updateUsageBatch(planning.reusedLearnings, {
          success: (finalCritique?.score || 0) >= agenticConfig.minCriticScoreForSuccess,
          taskContext: learningTaskContext
        });
      }
      let finalAnswerAfterEvolution = finalizeUserAnswer(
        finalSynthesis,
        planning.reusedLearnings || [],
        planning.classification
      );
      const finalAttachmentEvidence = dedupeAttachmentEvidence(
        finalExecution.attachmentEvidenceUsed
      );
      const finalExecutionKnowledge = await this.ingestExecutionKnowledge({
        userId,
        conversationId: conversation.id,
        execution: finalExecution,
        phase: "final_pass"
      });
      const projectBuilderToolResult = findProjectBuilderToolResult(finalExecution.toolResults);
      const projectBuilderReport =
        projectBuilderToolResult?.raw ||
        (activeProject && planning.strategyDecision?.enableProjectBuilder
          ? await this.projectBuilder.run({
              project: activeProject,
              critique: finalCritique
            })
          : null);
      const deliveryReport =
        projectBuilderToolResult?.normalized?.delivery ||
        projectBuilderReport?.delivery ||
        null;
      const fallbackDeliveryReport =
        !deliveryReport && projectBuilderReport?.workspacePath
          ? {
              status: projectBuilderReport?.action === "project_delivery" ? "scaffolded" : "draft",
              workspacePath: projectBuilderReport.workspacePath,
              install: { status: "skipped" },
              run: { status: "skipped" },
              validation: { status: "skipped", issues: [] },
              correctionsApplied: [],
              export:
                projectBuilderReport?.exportArtifactId && projectBuilderReport?.exportDownloadUrl
                  ? {
                      artifactId: projectBuilderReport.exportArtifactId,
                      downloadUrl: projectBuilderReport.exportDownloadUrl,
                      filename: projectBuilderReport.exportFilename || ""
                    }
                  : null,
              mainFiles:
                projectBuilderReport?.mainFiles ||
                projectBuilderReport?.createdFiles ||
                [],
              nextCommand:
                projectBuilderReport?.nextCommand ||
                projectBuilderReport?.nextCommands?.[0] ||
                "",
              deliveryManifestPath:
                projectBuilderReport?.deliveryManifestPath ||
                projectBuilderReport?.manifestPath ||
                ""
            }
          : null;
      const effectiveDeliveryReport = deliveryReport || fallbackDeliveryReport;
      if (activeProject) {
        activeProject = await this.projectStore.updateProject(
          activeProject.id,
          updateProjectAfterTask(activeProject, {
            task: routingPrompt,
            criticScore: finalCritique.score || 0,
            buildStatus: projectBuilderReport?.build?.status || "skipped",
            testStatus: projectBuilderReport?.test?.status || "skipped",
            learnings: storedLearnings,
            delivery: effectiveDeliveryReport
          })
        );
      }
      const workObjectsCreated = [];
      const sourceWorkObjectBeforeDelivery =
        activeWorkObject && activeWorkObject.objectKind !== "project"
          ? activeWorkObject
          : null;
      if (effectiveDeliveryReport && activeProject) {
        const projectWorkObject = await this.workObjectService.registerProjectDelivery({
          userId,
          conversationId: conversation.id,
          project: activeProject,
          delivery: effectiveDeliveryReport,
          prompt: routingPrompt,
          sourceWorkObjectId: sourceWorkObjectBeforeDelivery?.id || "",
          intentProfile: planning.intentProfile || null,
          environmentPlan: planning.environmentPlan || null,
          environmentSimulation: planning.environmentSimulation || null,
          businessSimulation: planning.businessSimulation || null,
          productPlanSimulation: planning.productPlanSimulation || null,
          impactSimulation: planning.impactSimulation || null,
          usageScenarioSimulation: planning.usageScenarioSimulation || null
        });
        if (projectWorkObject) {
          activeWorkObject = projectWorkObject;
          workObjectsCreated.push(projectWorkObject);
        }
      }
      const artifactGeneratorToolResult = findArtifactGeneratorToolResult(finalExecution.toolResults);
      const artifactSourceDocument =
        artifactGeneratorToolResult?.artifactResult?.sourceDocument ||
        artifactGeneratorToolResult?.normalized?.sourceDocument ||
        null;
      const generatedArtifactForObject =
        (artifactGeneratorToolResult?.artifacts || []).find(
          (artifact) => artifact.type === "generated_file"
        ) || null;

      if (generatedArtifactForObject) {
        const projectShellWorkObject = activeProject?.id
          ? this.workObjectService
              .listForProject({
                projectId: activeProject.id,
                userId,
                limit: 50
              })
              .find((item) => item.objectKind === "project") || null
          : null;
        const artifactExecutionSource =
          activeWorkObjectForExecution ||
          activeWorkObject ||
          projectShellWorkObject ||
          null;
        const explicitSiblingDerivation =
          planning.workspaceRouting?.createSiblingObject &&
          artifactExecutionSource &&
          artifactExecutionSource.objectKind !== "project";
        const shouldReuseActiveWorkObject =
          planning.executionIntent?.action === "environment_update" &&
          artifactExecutionSource &&
          !explicitSiblingDerivation &&
          [
            "document",
            "presentation",
            "dataset",
            "dashboard",
            "workflow",
            "design",
            "benchmark",
            "campaign",
            "image",
            "audio",
            "video"
          ].includes(
            artifactExecutionSource.objectKind
          );
        const sourceWorkObjectForArtifact = shouldReuseActiveWorkObject
          ? null
          : planning.executionIntent?.action === "environment_transform" ||
              explicitSiblingDerivation
            ? artifactExecutionSource
            : projectShellWorkObject ||
              artifactExecutionSource ||
              null;
        const artifactWorkObject = await this.workObjectService.registerGeneratedArtifact({
          userId,
          conversationId: conversation.id,
          prompt: routingPrompt,
          artifact: generatedArtifactForObject,
          sourceDocument: artifactSourceDocument,
          intentProfile: planning.intentProfile || null,
          environmentPlan: planning.environmentPlan || null,
          environmentSimulation: planning.environmentSimulation || null,
          businessSimulation: planning.businessSimulation || null,
          productPlanSimulation: planning.productPlanSimulation || null,
          impactSimulation: planning.impactSimulation || null,
          usageScenarioSimulation: planning.usageScenarioSimulation || null,
          existingWorkObjectId: shouldReuseActiveWorkObject ? artifactExecutionSource.id : "",
          sourceWorkObjectId: sourceWorkObjectForArtifact?.id || "",
          projectId:
            activeProject?.id ||
            artifactExecutionSource?.projectId ||
            continuity.activeProject?.id ||
            ""
        });
        if (artifactWorkObject) {
          activeWorkObject = artifactWorkObject;
          workObjectsCreated.push(artifactWorkObject);
        }
      }

      if (!activeProject && projectBuilderReport?.workspacePath) {
        const recoveredProject = this.projectStore
          .listProjects({ userId, conversationId: conversation.id, limit: 20 })
          .find(
            (projectItem) =>
              projectItem.workspacePath === projectBuilderReport.workspacePath ||
              projectItem.name === projectBuilderReport.projectName
          );
        if (recoveredProject) {
          activeProject = recoveredProject;
        }
      }

      if (!activeWorkObject && activeProject?.id) {
        const recoveredProjectObject =
          this.workObjectService
            .listForProject({
              projectId: activeProject.id,
              userId,
              limit: 20
            })
            .find((item) => item.objectKind === "project") || null;
        if (recoveredProjectObject) {
          activeWorkObject = recoveredProjectObject;
        }
      }

      if (!activeWorkObject && effectiveDeliveryReport && activeProject?.id) {
        const recoveredProjectWorkObject = await this.workObjectService.registerProjectDelivery({
          userId,
          conversationId: conversation.id,
          project: activeProject,
          delivery: effectiveDeliveryReport,
          prompt: routingPrompt,
          sourceWorkObjectId: sourceWorkObjectBeforeDelivery?.id || "",
          intentProfile: planning.intentProfile || null,
          environmentPlan: planning.environmentPlan || null,
          environmentSimulation: planning.environmentSimulation || null,
          businessSimulation: planning.businessSimulation || null,
          productPlanSimulation: planning.productPlanSimulation || null,
          impactSimulation: planning.impactSimulation || null,
          usageScenarioSimulation: planning.usageScenarioSimulation || null
        });
        if (recoveredProjectWorkObject) {
          activeWorkObject = recoveredProjectWorkObject;
          workObjectsCreated.push(recoveredProjectWorkObject);
        }
      }

      if (planning.executionIntent?.readyToAct && !activeWorkObject) {
        logger.warn("Hydria execution request produced no visible work object", {
          conversationId: conversation.id,
          userId,
          prompt: routingPrompt,
          classification: planning.classification,
          projectId: activeProject?.id || null,
          strategy: planning.strategyDecision?.chosenStrategy || null
        });
      }

      this.evolutionOptimizer.recordOutcome({
        domain: planning.domainProfile?.id || planning.classification,
        classification: planning.classification,
        strategyId:
          planning.strategyDecision?.chosenStrategy ||
          executedPlan.strategy ||
          planning.classification,
        activeAgents:
          planning.orchestration?.activeAgents ||
          planning.strategyDecision?.selectedAgents ||
          [],
        score: finalCritique.score || 0,
        delta: Number(finalExecution.improvementDelta || 0)
      });
      this.sessionManager.updateState(runtimeSession.id, {
        phase: "evaluated",
        criticScore: finalCritique.score || 0,
        evolutionWinner: improvement?.comparison?.winner || "first",
        evolutionStrategy: improvement?.strategy?.id || null,
        finalKnowledgeIngestion: finalExecutionKnowledge,
        learningStored: storedLearnings.length,
        learningUsed: (planning.reusedLearnings || []).length,
        activeProjectId: activeProject?.id || null
      });

      if (activeProject?.id) {
        const latestProject = this.projectStore.getProject(activeProject.id) || activeProject;
        const projectWorkObjects = this.workObjectService.listForProject({
          projectId: latestProject.id,
          userId,
          limit: 100
        });
        const projectGraph = buildProjectGraph({
          project: {
            ...latestProject,
            activeWorkObjectId: activeWorkObject?.id || latestProject.activeWorkObjectId || ""
          },
          workObjects: projectWorkObjects
        });
        activeProject =
          (await this.projectStore.updateProject(latestProject.id, {
            activeWorkObjectId: activeWorkObject?.id || latestProject.activeWorkObjectId || "",
            workspaceFamilies: projectGraph.workspaceFamilies,
            graph: projectGraph,
            metadata: {
              ...(latestProject.metadata || {}),
              workspaceRouting: planning.workspaceRouting || null
            }
          })) || latestProject;
      }

      saveMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: finalAnswerAfterEvolution,
        classification: planning.classification,
        routeUsed: planning.classification,
        modelsUsed: finalExecution.modelsUsed,
        apisUsed: finalExecution.apisUsed
      });

      const suppressToolMessagesInThread =
        finalSynthesis.qualityPass?.mode === "delivery_result";

      for (const message of finalExecution.toolMessages) {
        if (suppressToolMessagesInThread) {
          continue;
        }

        saveMessage({
          conversationId: conversation.id,
          role: message.role,
          content: message.content,
          classification: planning.classification,
          routeUsed: message.routeUsed,
          apisUsed: message.apisUsed || []
        });
      }

      for (const attachment of attachments) {
        saveMessage({
          conversationId: conversation.id,
          role: "tool",
          content: buildAttachmentToolMessage(attachment),
          classification: planning.classification,
          routeUsed: "attachment"
        });
      }

      for (const artifact of finalExecution.artifacts || []) {
        if (artifact.type === "generated_file") {
          saveMessage({
            conversationId: conversation.id,
            role: "tool",
            content: `Generated file: ${artifact.filename} (${artifact.format}) -> ${artifact.downloadUrl}`,
            classification: planning.classification,
            routeUsed: "artifact_generation"
          });
        }
      }

      const storedMemory = storeUsefulMemory({
        userId,
        conversationId: conversation.id,
        prompt: effectivePrompt,
        classification: planning.classification
      });

      summarizeConversationIfNeeded({
        conversationId: conversation.id,
        userId
      });

      const memoryCommit = await this.memoryAgent.remember({
        userId,
        conversationId: conversation.id,
        prompt: effectivePrompt,
        classification: planning.classification,
        finalAnswer: finalAnswerAfterEvolution,
        critique: finalCritique,
        plan: {
          ...finalPlan,
          steps: finalExecution.executionSteps
        },
        followUpActions: finalExecution.followUpActions,
        storedMemory: storedMemory.map((memory) => ({
          type: memory.memory_type,
          content: memory.content
        })),
        evolution: improvement
          ? {
              strategy: improvement.strategy?.id || null,
              winner: improvement.comparison?.winner || "first",
              attempts: (improvement.attempts || []).map((attempt) => ({
                attempt: attempt.attempt,
                strategy: attempt.strategy.id,
                score: attempt.retryCritique?.score || 0,
                delta: attempt.comparison?.delta || 0
              }))
            }
          : null
      });
      if (activeProject) {
        await this.memoryStore.addLongTermMemory({
          userId,
          type: "project_memory",
          content: `Project ${activeProject.name} status ${activeProject.status || "draft"} for ${planning.classification}.`,
          score: Math.min(1, Number((finalCritique.score || 0) / 100)),
          tags: [planning.classification, activeProject.type, "project"],
          source: {
            conversationId: conversation.id,
            projectId: activeProject.id
          }
        });
      }

      createExecutionLog({
        conversationId: conversation.id,
        classification: planning.classification,
        executionPlan: {
          ...finalPlan,
          originalPrompt: effectivePrompt,
          resolvedPrompt: routingPrompt,
          basePrompt,
          followUpActions: finalExecution.followUpActions,
          agentic: {
            domainProfile: planning.domainProfile,
            objective: finalPlan.objective,
            intentProfile: planning.intentProfile || null,
            environmentPlan: planning.environmentPlan || null,
            continuity,
            agents: {
              orchestrator: this.orchestratorAgent.describe(),
              strategy: this.strategyAgent.describe(),
              planner: this.plannerAgent.describe(),
              executor: this.executorAgent.describe(),
              critic: this.criticAgent.describe(),
              memory: this.memoryAgent.describe(),
              research: this.researchAgent.describe(),
              api: this.apiAgent.describe(),
              git: this.gitAgent.describe()
            },
            registry: this.agentRegistry.list(),
            memory: {
              recall: preparation.memoryRecall,
              workingMemory: memoryCommit.workingMemory,
              ingestion: {
                attachments: preparation.knowledgeIngestion,
                initialExecution: initialExecutionKnowledge,
                finalExecution: finalExecutionKnowledge
              }
            },
            learning: {
              used: summarizeLearningUsage(planning.reusedLearnings || []),
              created: summarizeLearningUsage(storedLearnings || [])
            },
            workObject: activeWorkObject
              ? {
                  id: activeWorkObject.id,
                  title: activeWorkObject.title,
                  type: activeWorkObject.type,
                  objectKind: activeWorkObject.objectKind,
                  primaryFile: activeWorkObject.primaryFile
                }
              : null,
            project: activeProject
              ? {
                  id: activeProject.id,
                  name: activeProject.name,
                  type: activeProject.type,
                  status: activeProject.status,
                  workspacePath: activeProject.workspacePath,
                  dimensions: activeProject.dimensions || [],
                  internalCapabilities: activeProject.internalCapabilities || [],
                  globalProject: activeProject.globalProject || null,
                  builder: projectBuilderReport
                }
              : null,
            qualityPass: finalSynthesis.qualityPass || null,
            debugTraceSummary: finalSynthesis.qualityPass?.debugTraceSummary || null,
            critique: finalCritique,
            observationLog: finalExecution.observationLog,
            runtimeSessionId: runtimeSession.id,
            strategyDecision: planning.strategyDecision || null,
            executionIntent: planning.executionIntent || null,
            strategySimulation: planning.strategySimulation || null,
            environmentSimulation: planning.environmentSimulation || null,
            projectTrajectory: planning.projectTrajectory || null,
            businessSimulation: planning.businessSimulation || null,
            productPlanSimulation: planning.productPlanSimulation || null,
            impactSimulation: planning.impactSimulation || null,
            usageScenarioSimulation: planning.usageScenarioSimulation || null,
            evolution: improvement
              ? {
                  strategy: improvement.strategy.id,
                  winner: improvement.comparison.winner,
                  delta: improvement.comparison.delta,
                  attempts: (improvement.attempts || []).map((attempt) => ({
                    attempt: attempt.attempt,
                    strategy: attempt.strategy.id,
                    score: attempt.retryCritique?.score || 0,
                    delta: attempt.comparison?.delta || 0,
                    winner: attempt.comparison?.winner || "first"
                  }))
                }
              : null
          }
        },
        durationMs: durationMs(startedAt),
        status: normalizeStatus({
          critique: finalCritique,
          artifacts: finalExecution.artifacts,
          delivery: effectiveDeliveryReport
        })
      });
      this.sessionManager.completeSession(runtimeSession.id, {
        status: "completed",
        finalClassification: planning.classification,
        criticScore: finalCritique.score || 0
      });
      await this.runtimeAdapter.closeBrowserSession(runtimeSession.id);

      return {
        success: true,
        conversationId: conversation.id,
        classification: planning.classification,
        strategy: planning.strategyDecision?.chosenStrategy || executedPlan.strategy,
        plan: {
          ...finalPlan,
          steps: finalExecution.executionSteps
        },
        routing: planning.routing,
        taskPack: planning.taskPack,
        domainProfile: planning.domainProfile,
        strategyDecision: planning.strategyDecision || null,
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
        projectContinuity: continuity,
        followUpActions: finalExecution.followUpActions,
        modelsUsed: finalExecution.modelsUsed,
        apisUsed: finalExecution.apisUsed,
        toolsUsed: finalExecution.toolsUsed,
        judge: finalSynthesis.judge,
        qualityPass: finalSynthesis.qualityPass || null,
        responseMode: finalSynthesis.qualityPass?.mode || null,
        debugTraceSummary: finalSynthesis.qualityPass?.debugTraceSummary || null,
        eval: finalCritique,
        finalAnswer: finalAnswerAfterEvolution,
        artifacts: finalExecution.artifacts,
        candidates: finalExecution.normalizedCandidates,
        sourcesUsed: finalSynthesis.sources,
        learningUsed: summarizeLearningUsage(planning.reusedLearnings || []),
        learningCreated: summarizeLearningUsage(storedLearnings || []),
        workObjects: this.workObjectService.list({
          userId,
          conversationId: conversation.id
        }),
        activeWorkObject,
        project: activeProject
          ? {
              id: activeProject.id,
              name: activeProject.name,
              type: activeProject.type,
              status: activeProject.status,
              workspacePath: activeProject.workspacePath,
              dimensions: activeProject.dimensions || [],
              internalCapabilities: activeProject.internalCapabilities || [],
              globalProject: activeProject.globalProject || null
            }
          : null,
        projectBuilder: projectBuilderReport,
        delivery: effectiveDeliveryReport,
        attachments: serializeAttachmentsForClient(attachments),
        attachmentEvidenceUsed: finalAttachmentEvidence,
        memoryUsed: finalExecution.memoryUsed,
        storedMemory: storedMemory.map((memory) => ({
          id: memory.id,
          type: memory.memory_type,
          content: memory.content
        })),
        agentLoop: {
          objective: finalPlan.objective,
          observations: finalExecution.observationLog,
          memory: {
            recall: preparation.memoryRecall,
            ingestion: preparation.knowledgeIngestion,
            executionIngestion: {
              initial: initialExecutionKnowledge,
              final: finalExecutionKnowledge
            },
            workingMemory: memoryCommit.workingMemory,
            taskOutcome: memoryCommit.taskOutcome,
            learning: {
              used: summarizeLearningUsage(planning.reusedLearnings || []),
              created: summarizeLearningUsage(storedLearnings || [])
            }
          },
          orchestration: planning.orchestration || null,
          strategy: planning.strategyDecision || null,
          executionIntent: planning.executionIntent || null,
          strategySimulation: planning.strategySimulation || null,
          environmentSimulation: planning.environmentSimulation || null,
          projectTrajectory: planning.projectTrajectory || null,
          businessSimulation: planning.businessSimulation || null,
          productPlanSimulation: planning.productPlanSimulation || null,
          impactSimulation: planning.impactSimulation || null,
          usageScenarioSimulation: planning.usageScenarioSimulation || null,
          runtime: {
            sessionId: runtimeSession.id,
            session: this.sessionManager.getSession(runtimeSession.id)
          },
          evolution: improvement
            ? {
                strategy: improvement.strategy.id,
                winner: improvement.comparison.winner,
                delta: improvement.comparison.delta,
                attempts: (improvement.attempts || []).map((attempt) => ({
                  attempt: attempt.attempt,
                  strategy: attempt.strategy.id,
                  score: attempt.retryCritique?.score || 0,
                  delta: attempt.comparison?.delta || 0,
                  winner: attempt.comparison?.winner || "first"
                }))
              }
            : null
        },
        meta: {
          usedJudge: finalSynthesis.judge?.usedJudge || false,
          durationMs: durationMs(startedAt),
          criticScore: finalCritique.score || 0
        }
      };
    } catch (error) {
      logger.error("HydriaAutonomousBrain failed", {
        error: error.message,
        userId,
        conversationId: conversation.id
      });

      createExecutionLog({
        conversationId: conversation.id,
        classification: "agentic_failure",
        executionPlan: {
          originalPrompt: effectivePrompt,
          resolvedPrompt: effectivePrompt,
          basePrompt: effectivePrompt,
          followUpActions: [],
          agentic: {
            failed: true,
            error: error.message
          }
        },
        durationMs: durationMs(startedAt),
        status: "failed"
      });
      this.sessionManager.completeSession(runtimeSession.id, {
        status: "failed",
        error: error.message
      });
      await this.runtimeAdapter.closeBrowserSession(runtimeSession.id);

      if (agenticConfig.useLegacyFallback) {
        logger.warn("Falling back to legacy HydriaBrain after agentic failure", {
          conversationId: conversation.id
        });
        return fallbackToLegacyChat({
          userId,
          conversationId: conversation.id,
          prompt: effectivePrompt,
          attachments
        });
      }

      throw error;
    }
  }
}

const hydriaAutonomousBrain = new HydriaAutonomousBrain();

export default hydriaAutonomousBrain;
