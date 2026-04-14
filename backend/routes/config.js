import { Router } from "express";
import config from "../config/hydria.config.js";
import { listAttachmentExtractors } from "../services/attachments/attachmentService.js";
import { listSupportedGenerationFormats } from "../services/artifacts/generationIntentService.js";
import { listArtifactGenerators } from "../services/artifacts/generators/generatorRegistry.js";
import { getPublicApiRegistry } from "../services/registry/apiRegistry.js";
import { getPublicModelRegistry } from "../services/registry/modelRegistry.js";
import { futureCapabilities } from "../services/future/multimodalRouter.js";
import { listToolRegistry } from "../services/tools/toolRegistry.js";
import { listTaskPacks } from "../services/hydria/taskPackService.js";
import agenticConfig from "../src/config/agenticConfig.js";
import JsonKnowledgeStore from "../src/knowledge/JsonKnowledgeStore.js";
import HydriaBrainProvider from "../src/core/HydriaBrainProvider.js";
import { GitAgent } from "../src/agents/gitAgent.js";
import { AgentRegistry } from "../src/agents/AgentRegistry.js";
import { RuntimePermissions } from "../src/runtime/runtime.permissions.js";
import { HydriaRuntimeAdapter } from "../src/runtime/HydriaRuntimeAdapter.js";
import ToolRegistry from "../src/tools/ToolRegistry.js";
import ApiRegistryService from "../src/api-registry/api-registry.service.js";
import { listPublicWorkspaceFamilies } from "../src/workspaces/workspaceRegistry.js";

const router = Router();
const publicKnowledgeStore = new JsonKnowledgeStore({
  filePath: agenticConfig.files.knowledgeStore
});
const publicToolRegistry = new ToolRegistry({
  knowledgeStore: publicKnowledgeStore,
  gitAgent: new GitAgent({
    config: agenticConfig,
    brainProvider: new HydriaBrainProvider()
  }),
  permissionsManager: new RuntimePermissions({
    allowNetwork: agenticConfig.runtime.allowNetwork,
    allowBrowser: agenticConfig.runtime.allowBrowser,
    allowShell: agenticConfig.runtime.allowShell,
    allowGitClone: agenticConfig.runtime.allowGitClone,
    toolAllowlist: agenticConfig.runtime.toolAllowlist,
    browserActionAllowlist: agenticConfig.runtime.browserActionAllowlist
  }),
  runtimeAdapter: new HydriaRuntimeAdapter(),
  toolLogFile: agenticConfig.files.toolLog
});
const publicAgentRegistry = new AgentRegistry({
  agents: [
    {
      getId() {
        return "orchestrator_agent";
      },
      describe() {
        return {
          id: "orchestrator_agent",
          label: "Orchestrator Agent",
          role: "agent selection and multi-agent coordination"
        };
      }
    },
    {
      getId() {
        return "planner_agent";
      },
      describe() {
        return {
          id: "planner_agent",
          label: "Planner Agent",
          role: "goal analysis and execution planning"
        };
      }
    },
    {
      getId() {
        return "strategy_agent";
      },
      describe() {
        return {
          id: "strategy_agent",
          label: "Strategy Agent",
          role: "meta-level strategy selection"
        };
      }
    },
    {
      getId() {
        return "executor_agent";
      },
      describe() {
        return {
          id: "executor_agent",
          label: "Executor Agent",
          role: "tool and model execution"
        };
      }
    },
    {
      getId() {
        return "critic_agent";
      },
      describe() {
        return {
          id: "critic_agent",
          label: "Critic Agent",
          role: "execution evaluation"
        };
      }
    },
    {
      getId() {
        return "memory_agent";
      },
      describe() {
        return {
          id: "memory_agent",
          label: "Memory Agent",
          role: "memory recall and commit"
        };
      }
    },
    {
      getId() {
        return "research_agent";
      },
      describe() {
        return {
          id: "research_agent",
          label: "Research Agent",
          role: "knowledge retrieval and local research context building"
        };
      }
    },
    {
      getId() {
        return "api_agent";
      },
      describe() {
        return {
          id: "api_agent",
          label: "API Agent",
          role: "api registry lookup and API strategy selection"
        };
      }
    },
    {
      getId() {
        return "git_agent";
      },
      describe() {
        return {
          id: "git_agent",
          label: "Git Agent",
          role: "github repository search and implementation pattern analysis"
        };
      }
    }
  ],
  toolRegistry: publicToolRegistry
});
const publicApiRegistryService = new ApiRegistryService();

router.get("/public", (req, res) => {
  res.json({
    success: true,
    config: {
      appName: config.appName,
      strategy: config.strategy,
      attachments: {
        maxFiles: config.attachments.maxFiles,
        maxFileSizeBytes: config.attachments.maxFileSizeBytes,
        maxExtractCharsPerFile: config.attachments.maxExtractCharsPerFile,
        maxTotalExtractChars: config.attachments.maxTotalExtractChars,
        enableOcr: config.attachments.enableOcr,
        ...listAttachmentExtractors()
      },
      generation: {
        supportedFormats: listSupportedGenerationFormats(),
        generators: listArtifactGenerators()
      },
      web: {
        enabled: config.web.enabled,
        maxSearchResults: config.web.maxSearchResults,
        maxReadPages: config.web.maxReadPages,
        enableBrowserFetch: config.web.enableBrowserFetch
      },
      tools: {
        enabled: config.tools.enabled,
        workspaceRoot: config.tools.workspaceRoot,
        timeoutMs: config.tools.timeoutMs,
        enableBrowserPreview: config.tools.enableBrowserPreview,
        registry: listToolRegistry()
      },
      judge: {
        enabled: true,
        mode: config.strategy.judgeMode
      },
      agentic: {
        enabled: agenticConfig.enabled,
        maxPlanSteps: agenticConfig.maxPlanSteps,
        maxMemoryHits: agenticConfig.maxMemoryHits,
        maxKnowledgeHits: agenticConfig.maxKnowledgeHits,
        enableCritic: agenticConfig.enableCritic,
        enableKnowledgeSearch: agenticConfig.enableKnowledgeSearch,
        enableKnowledgeIngestion: agenticConfig.enableKnowledgeIngestion,
        workspaces: listPublicWorkspaceFamilies(),
        github: {
          enabled: agenticConfig.github.enabled,
          configured: Boolean(agenticConfig.github.token),
          authMode: agenticConfig.github.token ? "authenticated" : "public",
          acceptedTokenEnvVars: ["HYDRIA_GITHUB_TOKEN", "GITHUB_TOKEN", "HYDRIA", "hydria"],
          missing: agenticConfig.github.token
            ? []
            : ["HYDRIA_GITHUB_TOKEN or GITHUB_TOKEN or HYDRIA or hydria"],
          maxRepoResults: agenticConfig.github.maxRepoResults,
          maxCodeResults: agenticConfig.github.maxCodeResults,
          maxAnalyzedRepos: agenticConfig.github.maxAnalyzedRepos,
          minStars: agenticConfig.github.minStars
        },
        runtime: {
          enabled: agenticConfig.runtime.enabled,
          maxActionsPerSession: agenticConfig.runtime.maxActionsPerSession,
          maxStepRetries: agenticConfig.runtime.maxStepRetries,
          sandboxRoot: agenticConfig.runtime.sandboxRoot,
          allowShell: agenticConfig.runtime.allowShell,
          allowNetwork: agenticConfig.runtime.allowNetwork,
          allowBrowser: agenticConfig.runtime.allowBrowser,
          allowGitClone: agenticConfig.runtime.allowGitClone,
          toolAllowlist: agenticConfig.runtime.toolAllowlist,
          browserActionAllowlist: agenticConfig.runtime.browserActionAllowlist
        },
        memory: agenticConfig.memory,
        knowledge: agenticConfig.knowledge,
        learning: agenticConfig.learning,
        evals: agenticConfig.evals,
        evolution: agenticConfig.evolution,
        workObjects: {
          enabled: true,
          rootDir: agenticConfig.files.workObjectRoot
        },
        tools: publicToolRegistry.listTools(),
        agents: publicAgentRegistry.list(),
        apiRegistry: publicApiRegistryService.getPublicSummary()
      },
      taskPacks: listTaskPacks(),
      models: getPublicModelRegistry(),
      apis: getPublicApiRegistry(),
      futureCapabilities
    }
  });
});

export default router;
