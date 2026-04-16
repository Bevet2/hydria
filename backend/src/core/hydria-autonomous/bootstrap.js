import HydriaBrainProvider from "../HydriaBrainProvider.js";
import agenticConfig from "../../config/agenticConfig.js";
import JsonMemoryStore from "../../memory/JsonMemoryStore.js";
import JsonKnowledgeStore from "../../knowledge/JsonKnowledgeStore.js";
import { EvalLogStore } from "../../evals/EvalLogStore.js";
import { HeuristicEvaluator } from "../../evals/HeuristicEvaluator.js";
import { EvalBenchmark } from "../../evals/eval.benchmark.js";
import ToolRegistry from "../../tools/ToolRegistry.js";
import { PlannerAgent } from "../../agents/plannerAgent.js";
import { OrchestratorAgent } from "../../agents/orchestratorAgent.js";
import { ExecutorAgent } from "../../agents/executorAgent.js";
import { CriticAgent } from "../../agents/criticAgent.js";
import { MemoryAgent } from "../../agents/memoryAgent.js";
import { ResearchAgent } from "../../agents/researchAgent.js";
import { ApiAgent } from "../../agents/apiAgent.js";
import { GitAgent } from "../../agents/gitAgent.js";
import { AgentRegistry } from "../../agents/AgentRegistry.js";
import { RuntimeStateStore } from "../../runtime/runtime.state.js";
import { RuntimeSessionManager } from "../../runtime/runtime.session.js";
import { RuntimePermissions } from "../../runtime/runtime.permissions.js";
import { HydriaRuntimeAdapter } from "../../runtime/HydriaRuntimeAdapter.js";
import { EvolutionLoop } from "../../evolution/evolution.loop.js";
import { EvolutionOptimizer } from "../../evolution/evolution.optimizer.js";
import ApiRegistryService from "../../api-registry/api-registry.service.js";
import LearningStore from "../../learning/learning.store.js";
import { LearningMigrationService } from "../../learning/learning.migration.js";
import { PatternLibrary } from "../../patterns/pattern.library.js";
import { ProjectStore } from "../../projects/project.store.js";
import { ProjectBuilder } from "../../project-builder/projectBuilder.js";
import { StrategyAgent } from "../../agents/strategyAgent.js";
import WorkObjectService from "../../work-objects/workObject.service.js";
import { InternalCapabilityDiscovery } from "../../projects/internalCapabilityDiscovery.js";
import { GlobalProjectService } from "../../projects/globalProjectService.js";

export function buildHydriaAutonomousDependencies() {
  const brainProvider = new HydriaBrainProvider();
  const runtimeStateStore = new RuntimeStateStore({
    filePath: agenticConfig.files.runtimeState
  });
  const sessionManager = new RuntimeSessionManager({
    stateStore: runtimeStateStore,
    maxActionsPerSession: agenticConfig.runtime.maxActionsPerSession,
    persistSessions: agenticConfig.runtime.persistSessions
  });
  const permissionsManager = new RuntimePermissions({
    allowNetwork: agenticConfig.runtime.allowNetwork,
    allowBrowser: agenticConfig.runtime.allowBrowser,
    allowShell: agenticConfig.runtime.allowShell,
    allowGitClone: agenticConfig.runtime.allowGitClone,
    toolAllowlist: agenticConfig.runtime.toolAllowlist,
    browserActionAllowlist: agenticConfig.runtime.browserActionAllowlist
  });
  const runtimeAdapter = new HydriaRuntimeAdapter({
    sessionManager
  });
  const memoryStore = new JsonMemoryStore({
    filePath: agenticConfig.files.memoryStore,
    maxShortTermPerConversation: agenticConfig.memory.shortTermLimit,
    maxMidTermPerConversation: agenticConfig.memory.midTermLimit,
    maxLongTermPerUser: agenticConfig.memory.longTermLimit,
    maxTaskOutcomesPerUser: agenticConfig.memory.taskOutcomeLimit,
    consolidateEveryTurns: agenticConfig.memory.consolidateEveryTurns
  });
  const knowledgeStore = new JsonKnowledgeStore({
    filePath: agenticConfig.files.knowledgeStore
  });
  const learningStore = new LearningStore({
    filePath: agenticConfig.files.learningStore,
    maxItems: agenticConfig.learning.maxItems,
    minConfidence: agenticConfig.learning.minConfidence
  });
  const learningMigration = new LearningMigrationService({
    learningStore
  });
  const patternLibrary = new PatternLibrary({
    filePath: agenticConfig.files.patternLibrary
  });
  const projectStore = new ProjectStore({
    filePath: agenticConfig.files.projectStore
  });
  const internalCapabilityDiscovery = new InternalCapabilityDiscovery({
    studioRoots: agenticConfig.internalCapabilities.studioRoots,
    musicRoots: agenticConfig.internalCapabilities.musicRoots
  });
  const globalProjectService = new GlobalProjectService();
  const internalCapabilityProfiles =
    agenticConfig.internalCapabilities.enabled
      ? internalCapabilityDiscovery.listCapabilities()
      : [];
  const workObjectService = new WorkObjectService({
    filePath: agenticConfig.files.workObjectStore,
    rootDir: agenticConfig.files.workObjectRoot,
    brainProvider,
    projectStore
  });
  const evaluator = new HeuristicEvaluator({
    logStore: new EvalLogStore({
      filePath: agenticConfig.files.evalLog
    })
  });
  const benchmark = new EvalBenchmark({
    filePath: agenticConfig.files.benchmarkLog,
    minImprovementDelta: agenticConfig.evals.minImprovementDelta
  });
  const evolutionOptimizer = new EvolutionOptimizer({
    filePath: agenticConfig.files.evolutionFeedback
  });
  const gitAgent = new GitAgent({
    config: agenticConfig,
    brainProvider
  });
  const apiRegistryService = new ApiRegistryService();
  const projectBuilder = new ProjectBuilder({
    runtimeAdapter,
    sandboxRoot: agenticConfig.runtime.sandboxRoot,
    sessionManager
  });
  workObjectService.artifactExporter = projectBuilder.artifactExporter;
  const toolRegistry = new ToolRegistry({
    knowledgeStore,
    toolLogFile: agenticConfig.files.toolLog,
    gitAgent,
    projectBuilder,
    permissionsManager,
    sessionManager,
    runtimeAdapter,
    maxRetries: agenticConfig.runtime.maxStepRetries
  });
  const plannerAgent = new PlannerAgent({
    learningStore,
    config: agenticConfig
  });
  const strategyAgent = new StrategyAgent({
    patternLibrary,
    evolutionOptimizer,
    globalProjectService
  });
  const researchAgent = new ResearchAgent({
    knowledgeStore
  });
  const apiAgent = new ApiAgent({
    apiRegistryService
  });
  const orchestratorAgent = new OrchestratorAgent({
    plannerAgent,
    strategyAgent
  });
  const executorAgent = new ExecutorAgent({
    brainProvider,
    toolRegistry,
    gitAgent,
    researchAgent,
    apiAgent,
    sessionManager,
    maxStepRetries: agenticConfig.runtime.maxStepRetries
  });
  const criticAgent = new CriticAgent({
    evaluator
  });
  const memoryAgent = new MemoryAgent({
    memoryStore,
    knowledgeStore,
    config: agenticConfig
  });
  const agentRegistry = new AgentRegistry({
    agents: [
      orchestratorAgent,
      strategyAgent,
      plannerAgent,
      executorAgent,
      criticAgent,
      memoryAgent,
      researchAgent,
      apiAgent,
      gitAgent
    ],
    toolRegistry
  });
  const evolutionLoop = new EvolutionLoop({
    config: agenticConfig,
    benchmark,
    executorAgent,
    criticAgent,
    sessionManager
  });

  return {
    brainProvider,
    runtimeStateStore,
    sessionManager,
    permissionsManager,
    runtimeAdapter,
    memoryStore,
    knowledgeStore,
    learningStore,
    learningMigration,
    patternLibrary,
    projectStore,
    internalCapabilityDiscovery,
    globalProjectService,
    internalCapabilityProfiles,
    workObjectService,
    evaluator,
    benchmark,
    evolutionOptimizer,
    gitAgent,
    apiRegistryService,
    projectBuilder,
    toolRegistry,
    plannerAgent,
    strategyAgent,
    researchAgent,
    apiAgent,
    orchestratorAgent,
    executorAgent,
    criticAgent,
    memoryAgent,
    agentRegistry,
    evolutionLoop
  };
}
