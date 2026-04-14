import fs from "node:fs";
import path from "node:path";
import { ApiLookupTool } from "./ApiLookupTool.js";
import { WebSearchTool } from "./WebSearchTool.js";
import { WorkspaceInspectTool } from "./WorkspaceInspectTool.js";
import { DiagnosticsTool } from "./DiagnosticsTool.js";
import { PreviewTool } from "./PreviewTool.js";
import { BrowserAutomationTool } from "./BrowserAutomationTool.js";
import { KnowledgeSearchTool } from "./KnowledgeSearchTool.js";
import { ArtifactGenerationTool } from "./ArtifactGenerationTool.js";
import { ProjectBuilderTool } from "./ProjectBuilderTool.js";
import { SearchGitHubReposTool } from "./SearchGitHubReposTool.js";
import { SearchGitHubCodeTool } from "./SearchGitHubCodeTool.js";
import { CloneRepoTool } from "./CloneRepoTool.js";
import { ReadRepoFileTool } from "./ReadRepoFileTool.js";
import { AnalyzeRepoTool } from "./AnalyzeRepoTool.js";
import { executeWithRuntimeRetry } from "../runtime/runtime.retry.js";
import { classifyRuntimeFailure } from "../runtime/runtime.failureClassifier.js";
import { buildRecoveryState } from "../runtime/runtime.recovery.js";
import { buildRollbackPlan } from "../runtime/runtime.rollback.js";

function ensureLogFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "");
  }
}

export class ToolRegistry {
  constructor({
    knowledgeStore,
    toolLogFile,
    gitAgent = null,
    projectBuilder = null,
    permissionsManager = null,
    sessionManager = null,
    runtimeAdapter = null,
    maxRetries = 1
  }) {
    this.toolLogFile = toolLogFile;
    ensureLogFile(toolLogFile);
    this.tools = new Map();
    this.permissionsManager = permissionsManager;
    this.sessionManager = sessionManager;
    this.maxRetries = maxRetries;

    [
      new ApiLookupTool(),
      new WebSearchTool(),
      new WorkspaceInspectTool(),
      new DiagnosticsTool(),
      new PreviewTool({ runtimeAdapter }),
      ...(runtimeAdapter ? [new BrowserAutomationTool({ runtimeAdapter })] : []),
      new KnowledgeSearchTool({ knowledgeStore }),
      new ArtifactGenerationTool(),
      ...(projectBuilder ? [new ProjectBuilderTool({ projectBuilder })] : []),
      ...(gitAgent
        ? [
            new SearchGitHubReposTool({ gitAgent }),
            new SearchGitHubCodeTool({ gitAgent }),
            new CloneRepoTool({ gitAgent }),
            new ReadRepoFileTool({ gitAgent }),
            new AnalyzeRepoTool({ gitAgent })
          ]
        : [])
    ].forEach((tool) => {
      this.tools.set(tool.id, tool);
    });
  }

  listTools() {
    return [...this.tools.values()].map((tool) => ({
      id: tool.id,
      label: tool.label,
      description: tool.description,
      permissions: tool.permissions
    }));
  }

  get(toolId) {
    return this.tools.get(toolId) || null;
  }

  logUsage(entry) {
    fs.appendFileSync(this.toolLogFile, `${JSON.stringify(entry)}\n`);
  }

  isRetryableTool(toolId) {
    return [
      "api_lookup",
      "web_search",
      "browser_automation",
      "search_github_repos",
      "search_github_code",
      "read_repo_file",
      "analyze_repo"
    ].includes(toolId);
  }

  async execute(toolId, input = {}) {
    const tool = this.get(toolId);

    if (!tool) {
      return {
        providerId: toolId,
        sourceType: "tool",
        sourceName: toolId,
        capability: "unknown_tool",
        raw: {},
        normalized: {},
        summaryText: `Unknown tool: ${toolId}`,
        artifacts: []
      };
    }

    const permissionCheck = this.permissionsManager?.check(tool, input) || {
      allowed: true,
      denied: []
    };

    if (!permissionCheck.allowed) {
      const deniedResult = {
        success: false,
        providerId: toolId,
        sourceType: "tool",
        sourceName: tool.label,
        capability: "permission_denied",
        raw: {
          denied: permissionCheck.denied
        },
        normalized: {
          denied: permissionCheck.denied
        },
        summaryText: `Tool permission denied: ${permissionCheck.denied.join(", ")}`,
        artifacts: []
      };
      this.logUsage({
        toolId,
        at: new Date().toISOString(),
        durationMs: 0,
        conversationId: input.conversationId || null,
        userId: input.userId || null,
        success: false,
        capability: deniedResult.capability
      });
      this.sessionManager?.appendAction(input.sessionId, {
        type: "tool_denied",
        toolId,
        denied: permissionCheck.denied,
        at: new Date().toISOString()
      });
      return deniedResult;
    }

    const maxAttempts = this.isRetryableTool(toolId) ? this.maxRetries + 1 : 1;
    const retryResult = await executeWithRuntimeRetry(
      async (attempt) => {
        const startedAt = Date.now();
        const result = await tool.execute(input);

        if (result?.success === false) {
          const error = new Error(result.error || result.summaryText || `Tool ${toolId} failed`);
          error.partialResult = result;
          throw error;
        }

        this.sessionManager?.appendAction(input.sessionId, {
          type: "tool_execution",
          toolId,
          attempt,
          at: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          success: true,
          capability: result?.capability || null
        });
        this.logUsage({
          toolId,
          attempt,
          at: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          conversationId: input.conversationId || null,
          userId: input.userId || null,
          success: true,
          capability: result?.capability || null
        });

        return result;
      },
      {
        maxAttempts,
        shouldRetry: (error, attempt) =>
          attempt < maxAttempts && ["timeout", "network", "browser", "tool_provider"].includes(classifyRuntimeFailure(error)),
        onAttemptFailure: async (error, attempt) => {
          const recovery = buildRecoveryState({
            error,
            step: {
              id: `tool:${toolId}`,
              type: "tool",
              purpose: toolId
            }
          });
          this.sessionManager?.recordStepRetry(input.sessionId, {
            id: `tool:${toolId}`,
            type: "tool",
            purpose: toolId
          }, error.message);
          this.sessionManager?.recordRecovery(input.sessionId, recovery);
          this.sessionManager?.appendAction(input.sessionId, {
            type: "tool_retry",
            toolId,
            attempt,
            at: new Date().toISOString(),
            error: error.message,
            failureType: recovery.failureType
          });
        }
      }
    );

    if (retryResult.success) {
      return retryResult.value;
    }

    const lastError = retryResult.error;
    const rollback = buildRollbackPlan({
      step: {
        id: `tool:${toolId}`,
        type: "tool",
        toolId
      },
      input
    });
    this.sessionManager?.recordRollback(input.sessionId, rollback);

    const failedResult =
      lastError?.partialResult && lastError.partialResult.success === false
        ? lastError.partialResult
        : {
          success: false,
          providerId: toolId,
          sourceType: "tool",
          sourceName: tool.label,
          capability: "tool_failure",
          raw: {
            error: lastError?.message || "unknown tool error"
          },
          normalized: {
            failureType: classifyRuntimeFailure(lastError)
          },
          summaryText: lastError?.message || `Tool ${toolId} failed.`,
          artifacts: []
        };

    this.sessionManager?.appendAction(input.sessionId, {
      type: "tool_execution",
      toolId,
      at: new Date().toISOString(),
      success: false,
      capability: failedResult?.capability || null,
      error: failedResult?.error || failedResult?.summaryText || null,
      failureType: classifyRuntimeFailure(lastError)
    });
    this.logUsage({
      toolId,
      at: new Date().toISOString(),
      durationMs: 0,
      conversationId: input.conversationId || null,
      userId: input.userId || null,
      success: false,
      capability: failedResult?.capability || null
    });

    return failedResult;
  }
}

export default ToolRegistry;
