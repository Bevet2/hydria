import { buildModelContext } from "../core/modelContextBuilder.js";
import { buildFollowUpActions } from "../core/followUpActionBuilder.js";
import { buildQualityInstruction } from "../core/qualityInstructionBuilder.js";
import { BaseAgent } from "./BaseAgent.js";
import { resolveGroundedSimpleChatResponse } from "../core/simpleChatResponder.js";
import { buildDomainPromptTemplate } from "../prompts/domainPrompts.js";
import { summarizeLearningUsage } from "../learning/learning.reuse.js";
import { extractLearningFromTask } from "../learning/learning.extractor.js";
import { runReasoningPipeline } from "../reasoning/reasoning.pipeline.js";

function attachInstruction(messages, instruction, attachments = []) {
  const instructionParts = [instruction].filter(Boolean);

  if (attachments.length) {
    instructionParts.push(
      "Use the provided attachment contents directly. Do not say that you cannot access the attached files."
    );
  }

  if (!instructionParts.length) {
    return messages;
  }

  return [
    messages[0],
    { role: "system", content: instructionParts.join("\n\n") },
    ...messages.slice(1)
  ];
}

function buildLearningInstruction(reusedLearnings = []) {
  if (!reusedLearnings.length) {
    return "";
  }

  const patternLines = reusedLearnings
    .slice(0, 2)
    .map((item) => {
      const domainMatch = item.domainMatch || item.reuseMeta?.domainMatch || "unknown";
      const reuseReason = item.reuseReason || item.reuseMeta?.reuseReason || "relevant";
      const genericityPenalty =
        item.genericityPenalty || item.reuseMeta?.genericityPenalty || 0;
      return `- ${item.type}/${item.category}: ${item.description} (match ${domainMatch}, reason: ${reuseReason}, genericity penalty ${genericityPenalty})`;
    });

  return `Known reusable learnings:\n${patternLines.join("\n")}\nUse them when relevant, but do not overclaim beyond the current evidence.`;
}

function buildStepInstruction(
  step,
  classification,
  prompt,
  taskPack,
  preferencesUsed,
  domainProfile = null,
  attachments = [],
  reusedLearnings = []
) {
  const domainInstruction = buildDomainPromptTemplate({
    domainProfile,
    classification,
    prompt,
    purpose: step.purpose || "",
    taskPack,
    preferencesUsed
  });
  const qualityInstruction = buildQualityInstruction({
    classification,
    prompt,
    purpose: step.purpose || "",
    taskPack,
    preferencesUsed
  });

  return [
    domainInstruction,
    step.instruction,
    qualityInstruction,
    buildLearningInstruction(reusedLearnings)
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeCandidate(candidate) {
  if (candidate.type === "llm") {
    return {
      type: "llm",
      provider: candidate.provider,
      model: candidate.model,
      purpose: candidate.purpose,
      preview: String(candidate.content || "").slice(0, 220)
    };
  }

  return {
    type: candidate.type,
    provider: candidate.provider || candidate.sourceName,
    capability: candidate.capability || null,
    preview: String(candidate.summaryText || candidate.content || "").slice(0, 220)
  };
}

function buildToolMessage(result) {
  return `${result.sourceName}: ${result.summaryText}`;
}

function buildWebToolMessage(result) {
  const pages = result.pages || [];
  const searchResults = result.searchResults || [];

  if (pages.length) {
    return pages
      .slice(0, 2)
      .map((page) => `Web page: ${page.title} -> ${page.url} | ${page.excerpt || ""}`)
      .join("\n");
  }

  if (searchResults.length) {
    return searchResults
      .slice(0, 3)
      .map((item) => `Web result: ${item.title} -> ${item.url} | ${item.snippet || ""}`)
      .join("\n");
  }

  return buildToolMessage(result);
}

function collectContextUsage(modelContext, memoryUsedMap, attachmentEvidenceUsed) {
  for (const memory of modelContext.memoryUsed || []) {
    memoryUsedMap.set(`${memory.type}-${memory.id}`, memory);
  }

  if (modelContext.summaryUsed) {
    memoryUsedMap.set(`summary-${modelContext.summaryUsed.id}`, {
      type: "summary",
      id: modelContext.summaryUsed.id,
      content: modelContext.summaryUsed.content
    });
  }

  for (const evidence of modelContext.attachmentEvidenceUsed || []) {
    attachmentEvidenceUsed.push(evidence);
  }
}

function hasDisplayIntent(prompt = "") {
  const normalized = String(prompt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(montre|affiche|show|display|lis|read|ouvre|open)\b/.test(normalized);
}

function buildWorkObjectDisplayAnswer(activeWorkObject = null, content = "") {
  const lines = String(content || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const headings = lines
    .filter((line) => /^#{1,3}\s+/.test(line.trim()))
    .map((line) => line.replace(/^#{1,3}\s+/, "").trim())
    .slice(0, 8);
  const bodyPreview = lines
    .filter((line) => line.trim() && !/^#{1,3}\s+/.test(line.trim()))
    .slice(0, 10)
    .join("\n");

  return [
    `Voici ${activeWorkObject?.title || "le document"}.`,
    activeWorkObject?.primaryFile ? `Fichier actif\n- ${activeWorkObject.primaryFile}` : "",
    headings.length ? "Sections" : "",
    ...headings.map((heading) => `- ${heading}`),
    bodyPreview ? "Apercu" : "",
    bodyPreview
  ]
    .filter(Boolean)
    .join("\n");
}

export class ExecutorAgent extends BaseAgent {
  constructor({
    brainProvider,
    toolRegistry,
    gitAgent = null,
    researchAgent = null,
    apiAgent = null,
    sessionManager = null,
    maxStepRetries = 1
  }) {
    super({
      id: "executor_agent",
      label: "Executor Agent",
      role: "tool and model execution"
    });

    this.brainProvider = brainProvider;
    this.toolRegistry = toolRegistry;
    this.gitAgent = gitAgent;
    this.researchAgent = researchAgent;
    this.apiAgent = apiAgent;
    this.sessionManager = sessionManager;
    this.maxStepRetries = maxStepRetries;
  }

  async execute({
    userId,
    conversationId,
    prompt,
    attachments = [],
    classification,
    plan,
    taskPack,
    domainProfile = null,
    routing,
    memoryRecall,
    sessionId = null,
    reusedLearnings = [],
    learningGuidance = "",
    projectType = "internal",
    strategyDecision = null,
    executionIntent = null,
    project = null,
    globalProjectContext = null,
    activeWorkObject = null,
    activeWorkObjectContext = "",
    activeWorkObjectContent = ""
  }) {
    const groundedSimpleChat = resolveGroundedSimpleChatResponse({
      prompt,
      classification
    });

    if (
      activeWorkObject &&
      activeWorkObjectContent &&
      hasDisplayIntent(prompt) &&
      ["document", "presentation", "dataset", "project"].includes(activeWorkObject.objectKind)
    ) {
      const localCandidate = {
        type: "tool",
        provider: "hydria_local",
        capability: "work_object_display",
        sourceName: "Hydria Work Object",
        summaryText: buildWorkObjectDisplayAnswer(activeWorkObject, activeWorkObjectContent)
      };

      return {
        executionSteps: [
          {
            id: "local_work_object_display",
            type: "local",
            provider: "hydria_local",
            purpose: "work_object_display",
            status: "completed",
            durationMs: 0
          }
        ],
        candidates: [localCandidate],
        normalizedCandidates: [normalizeCandidate(localCandidate)],
        artifacts: [],
        apiResults: [],
        webResults: [],
        toolResults: [],
        knowledgeResults: [],
        toolMessages: [],
        modelsUsed: [],
        apisUsed: [],
        toolsUsed: [],
        memoryUsed: [],
        attachmentEvidenceUsed: [],
        preferencesUsed: {},
        followUpActions: [],
        observationLog: [
          {
            stepId: "local_work_object_display",
            type: "local",
            purpose: "work_object_display",
            status: "completed",
            provider: "hydria_local",
            error: null
          }
        ],
        finalAnswerMode: "work_object_display",
        finalAnswerOverride: localCandidate.summaryText,
        reusedLearnings: summarizeLearningUsage(reusedLearnings),
        learningCandidates: []
      };
    }

    if (groundedSimpleChat) {
      const localCandidate = {
        type: "tool",
        provider: "hydria_local",
        capability: groundedSimpleChat.reason,
        sourceName: "Hydria Local Grounding",
        summaryText: groundedSimpleChat.answer
      };

      return {
        executionSteps: [
          {
            id: "local_simple_chat_grounding",
            type: "local",
            provider: "hydria_local",
            purpose: groundedSimpleChat.reason,
            status: "completed",
            durationMs: 0
          }
        ],
        candidates: [localCandidate],
        normalizedCandidates: [normalizeCandidate(localCandidate)],
        artifacts: [],
        apiResults: [],
        webResults: [],
        toolResults: [],
        knowledgeResults: [],
        toolMessages: [],
        modelsUsed: [],
        apisUsed: [],
        toolsUsed: [],
        memoryUsed: [],
        attachmentEvidenceUsed: [],
        preferencesUsed: {},
        followUpActions: [],
        observationLog: [
          {
            stepId: "local_simple_chat_grounding",
            type: "local",
            purpose: groundedSimpleChat.reason,
            status: "completed",
            provider: "hydria_local",
            error: null
          }
        ],
        finalAnswerMode: "simple_chat_grounding",
        finalAnswerOverride: groundedSimpleChat.answer,
        reusedLearnings: summarizeLearningUsage(reusedLearnings),
        learningCandidates: []
      };
    }

    const candidates = [];
    const artifacts = [];
    const apiResults = [];
    const webResults = [];
    const toolResults = [];
    const knowledgeResults = [];
    const toolMessages = [];
    const observationLog = [];
    const modelsUsed = new Set();
    const apisUsed = new Set();
    const toolsUsed = new Set();
    const memoryUsedMap = new Map();
    const attachmentEvidenceUsed = [];
    let preferencesUsed = {};
    let finalAnswerOverride = null;
    let actionCompleted = false;
    let projectDelivery = null;

    const executionSteps = [];

    for (const step of plan.steps) {
      const stepStartedAt = Date.now();
      this.sessionManager?.recordStepStart(sessionId, step);

      try {
        if (actionCompleted && step.type === "llm") {
          executionSteps.push({
            ...step,
            status: "skipped",
            durationMs: 0
          });
          this.sessionManager?.recordStepResult(sessionId, step, {
            status: "skipped",
            durationMs: 0,
            reason: "project_action_already_completed"
          });
          continue;
        }

        if (step.type === "knowledge") {
          const knowledgeResult = await this.toolRegistry.execute("knowledge_search", {
            prompt,
            userId,
            conversationId,
            sessionId
          });

          knowledgeResults.push(knowledgeResult);
          toolResults.push(knowledgeResult);
          toolsUsed.add(knowledgeResult.providerId);
          candidates.push({
            type: "tool",
            provider: knowledgeResult.providerId,
            capability: knowledgeResult.capability,
            sourceName: knowledgeResult.sourceName,
            summaryText: knowledgeResult.summaryText
          });
          toolMessages.push({
            role: "tool",
            content: buildToolMessage(knowledgeResult),
            routeUsed: knowledgeResult.capability
          });
          executionSteps.push({
            ...step,
            status: "completed",
            durationMs: Date.now() - stepStartedAt
          });
          this.sessionManager?.recordStepResult(sessionId, step, {
            status: "completed",
            durationMs: Date.now() - stepStartedAt,
            provider: knowledgeResult.providerId,
            capability: knowledgeResult.capability
          });
          continue;
        }

        if (step.type === "api") {
          const apiResult = await this.toolRegistry.execute("api_lookup", {
            prompt,
            classification,
            apiNeed: plan.apiNeed,
            sessionId
          });

          if (!apiResult.success) {
            artifacts.push({
              type: "api_error",
              capability: step.capability,
              error: apiResult.error,
              attempts: apiResult.attempts || []
            });
            executionSteps.push({
              ...step,
              status: "failed",
              error: apiResult.error,
              durationMs: Date.now() - stepStartedAt
            });
            this.sessionManager?.recordError(sessionId, {
              stepId: step.id,
              type: step.type,
              error: apiResult.error
            });
            this.sessionManager?.recordStepResult(sessionId, step, {
              status: "failed",
              durationMs: Date.now() - stepStartedAt,
              error: apiResult.error
            });
            continue;
          }

          apiResults.push(apiResult);
          apisUsed.add(apiResult.providerId);
          candidates.push({
            type: "api",
            provider: apiResult.providerId,
            capability: apiResult.capability,
            sourceName: apiResult.sourceName,
            summaryText: apiResult.summaryText
          });
          toolMessages.push({
            role: "tool",
            content: buildToolMessage(apiResult),
            routeUsed: apiResult.capability,
            apisUsed: [apiResult.providerId]
          });
          executionSteps.push({
            ...step,
            provider: apiResult.providerId,
            status: "completed",
            durationMs: Date.now() - stepStartedAt
          });
          this.sessionManager?.recordStepResult(sessionId, step, {
            status: "completed",
            durationMs: Date.now() - stepStartedAt,
            provider: apiResult.providerId,
            capability: apiResult.capability
          });
          continue;
        }

        if (step.type === "web") {
          const webResult = await this.toolRegistry.execute("web_search", {
            prompt,
            classification,
            webNeed: plan.webNeed,
            sessionId
          });

          if (!webResult.success) {
            artifacts.push({
              type: "web_error",
              capability: step.capability,
              error: webResult.error,
              attempts: webResult.attempts || []
            });
            executionSteps.push({
              ...step,
              status: "failed",
              error: webResult.error,
              durationMs: Date.now() - stepStartedAt
            });
            this.sessionManager?.recordError(sessionId, {
              stepId: step.id,
              type: step.type,
              error: webResult.error
            });
            this.sessionManager?.recordStepResult(sessionId, step, {
              status: "failed",
              durationMs: Date.now() - stepStartedAt,
              error: webResult.error
            });
            continue;
          }

          webResults.push(webResult);
          candidates.push({
            type: "web",
            provider: webResult.providerId,
            capability: webResult.capability,
            sourceName: webResult.sourceName,
            summaryText: webResult.summaryText
          });
          artifacts.push(...(webResult.artifacts || []));
          toolMessages.push({
            role: "tool",
            content: buildWebToolMessage(webResult),
            routeUsed: webResult.capability
          });
          executionSteps.push({
            ...step,
            provider: webResult.providerId,
            status: "completed",
            durationMs: Date.now() - stepStartedAt
          });
          this.sessionManager?.recordStepResult(sessionId, step, {
            status: "completed",
            durationMs: Date.now() - stepStartedAt,
            provider: webResult.providerId,
            capability: webResult.capability
          });
          continue;
        }

        if (step.type === "tool") {
          const latestGitResearch =
            [...toolResults]
              .reverse()
              .find((result) => result?.capability === "github_research") || null;
          const toolResult = await this.toolRegistry.execute(step.toolId, {
            prompt,
            classification,
            attachments,
            conversationId,
            userId,
            sessionId,
            project,
            plan,
            taskPack,
            strategyDecision,
            executionIntent: step.executionIntent || executionIntent,
            activeWorkObject,
            activeWorkObjectContent,
            globalProjectContext,
            supportContext: {
              gitResearch: latestGitResearch
                ? {
                    normalized: latestGitResearch.normalized || null,
                    raw: latestGitResearch.raw || null,
                    summaryText: latestGitResearch.summaryText || ""
                  }
                : null
            },
            browserNeed: step.browserNeed || null,
            action: step.browserNeed?.action || null,
            url: step.browserNeed?.url || "",
            selector: step.browserNeed?.selector || "",
            value: step.browserNeed?.value || ""
          });

          toolResults.push(toolResult);
          toolsUsed.add(toolResult.providerId);
          candidates.push({
            type: "tool",
            provider: toolResult.providerId,
            capability: toolResult.capability,
            sourceName: toolResult.sourceName,
            summaryText: toolResult.summaryText
          });
          artifacts.push(...(toolResult.artifacts || []));
          toolMessages.push({
            role: "tool",
            content: buildToolMessage(toolResult),
            routeUsed: toolResult.capability
          });
          executionSteps.push({
            ...step,
            provider: toolResult.providerId,
            status: "completed",
            durationMs: Date.now() - stepStartedAt
          });
          if (
            toolResult.capability === "project_scaffold" &&
            toolResult.normalized?.finalAnswer
          ) {
            finalAnswerOverride = toolResult.normalized.finalAnswer;
            actionCompleted = true;
            projectDelivery = toolResult.normalized?.delivery || null;
          }
          this.sessionManager?.recordStepResult(sessionId, step, {
            status: "completed",
            durationMs: Date.now() - stepStartedAt,
            provider: toolResult.providerId,
            capability: toolResult.capability
          });
          continue;
        }

        if (step.type === "research_agent" && this.researchAgent) {
          const researchResult = await this.researchAgent.execute({
            prompt,
            userId,
            conversationId,
            classification,
            attachments,
            webNeed: plan.webNeed
          });

          toolResults.push(researchResult);
          toolsUsed.add(researchResult.providerId);
          candidates.push({
            type: "tool",
            provider: researchResult.providerId,
            capability: researchResult.capability,
            sourceName: researchResult.sourceName,
            summaryText: researchResult.summaryText
          });
          toolMessages.push({
            role: "tool",
            content: buildToolMessage(researchResult),
            routeUsed: researchResult.capability
          });
          executionSteps.push({
            ...step,
            provider: researchResult.providerId,
            status: "completed",
            durationMs: Date.now() - stepStartedAt
          });
          this.sessionManager?.recordStepResult(sessionId, step, {
            status: "completed",
            durationMs: Date.now() - stepStartedAt,
            provider: researchResult.providerId,
            capability: researchResult.capability
          });
          continue;
        }

        if (step.type === "api_agent" && this.apiAgent) {
          const apiAgentResult = await this.apiAgent.execute({
            prompt,
            classification,
            apiNeed: plan.apiNeed
          });

          toolResults.push(apiAgentResult);
          toolsUsed.add(apiAgentResult.providerId);
          candidates.push({
            type: "tool",
            provider: apiAgentResult.providerId,
            capability: apiAgentResult.capability,
            sourceName: apiAgentResult.sourceName,
            summaryText: apiAgentResult.summaryText
          });
          toolMessages.push({
            role: "tool",
            content: buildToolMessage(apiAgentResult),
            routeUsed: apiAgentResult.capability
          });
          executionSteps.push({
            ...step,
            provider: apiAgentResult.providerId,
            status: "completed",
            durationMs: Date.now() - stepStartedAt
          });
          this.sessionManager?.recordStepResult(sessionId, step, {
            status: "completed",
            durationMs: Date.now() - stepStartedAt,
            provider: apiAgentResult.providerId,
            capability: apiAgentResult.capability
          });
          continue;
        }

        if (step.type === "artifact") {
          const artifactToolResult = await this.toolRegistry.execute("artifact_generator", {
            userId,
            conversationId,
            prompt,
            attachments,
            plan,
            project,
            sessionId,
            activeWorkObject,
            activeWorkObjectContent
          });

          const artifactResult = artifactToolResult.artifactResult;
          toolResults.push(artifactToolResult);
          toolsUsed.add(artifactToolResult.providerId);
          finalAnswerOverride = artifactResult.finalAnswer;
          artifacts.push(...(artifactResult.artifacts || []));
          for (const candidate of artifactResult.candidates || []) {
            candidates.push(candidate);
          }
          candidates.push({
            type: "tool",
            provider: artifactToolResult.providerId,
            capability: artifactToolResult.capability,
            sourceName: artifactToolResult.sourceName,
            summaryText: artifactToolResult.summaryText
          });
          for (const model of artifactResult.modelsUsed || []) {
            modelsUsed.add(model);
          }
          for (const memory of artifactResult.memoryUsed || []) {
            memoryUsedMap.set(`${memory.type}-${memory.id}`, memory);
          }
          for (const evidence of artifactResult.attachmentEvidenceUsed || []) {
            attachmentEvidenceUsed.push(evidence);
          }
          toolMessages.push({
            role: "tool",
            content: buildToolMessage(artifactToolResult),
            routeUsed: artifactToolResult.capability
          });
          executionSteps.push({
            ...step,
            provider: artifactToolResult.providerId,
            status: "completed",
            durationMs: Date.now() - stepStartedAt
          });
          this.sessionManager?.recordStepResult(sessionId, step, {
            status: "completed",
            durationMs: Date.now() - stepStartedAt,
            provider: "artifact_generator",
            capability: "render_document"
          });
          continue;
        }

        if (step.type === "git_agent" && this.gitAgent) {
          const gitResult = await this.gitAgent.execute({
            prompt,
            filters: step.gitHubNeed?.filters || {},
            repo: step.gitHubNeed?.repoRef || "",
            action: step.gitHubNeed?.action || "search",
            existingLearnings: reusedLearnings
          });

          toolResults.push(gitResult);
          toolsUsed.add(gitResult.providerId);
          candidates.push({
            type: "tool",
            provider: gitResult.providerId,
            capability: gitResult.capability,
            sourceName: gitResult.sourceName,
            summaryText: gitResult.summaryText
          });
          toolMessages.push({
            role: "tool",
            content: buildToolMessage(gitResult),
            routeUsed: gitResult.capability
          });
          executionSteps.push({
            ...step,
            provider: gitResult.providerId,
            status: "completed",
            durationMs: Date.now() - stepStartedAt
          });
          this.sessionManager?.recordStepResult(sessionId, step, {
            status: "completed",
            durationMs: Date.now() - stepStartedAt,
            provider: gitResult.providerId,
            capability: gitResult.capability
          });
          continue;
        }

        if (step.type === "llm") {
          const modelContext = buildModelContext(userId, conversationId, prompt, {
            apiResults,
            webResults,
            toolResults,
            attachments,
            taskPack,
            routingResolution: routing,
            agenticMemory: memoryRecall
          });

          collectContextUsage(modelContext, memoryUsedMap, attachmentEvidenceUsed);
          preferencesUsed = modelContext.preferencesUsed || {};
          const messages = attachInstruction(
            modelContext.messages,
            [
              buildStepInstruction(
                step,
                classification,
                prompt,
                taskPack,
                preferencesUsed,
                domainProfile,
                attachments,
                reusedLearnings
              ),
              activeWorkObjectContext
                ? `Active work object context:\n${activeWorkObjectContext}`
                : ""
            ]
              .filter(Boolean)
              .join("\n\n"),
            attachments
          );

          if (learningGuidance) {
            messages.splice(1, 0, {
              role: "system",
              content: learningGuidance
            });
          }

          const pipelineResult = await runReasoningPipeline({
            brainProvider: this.brainProvider,
            messages,
            step,
            prompt,
            classification,
            domainProfile,
            strategyDecision
          });
          const llmResponse = pipelineResult.response;

          if (!llmResponse.success) {
            artifacts.push({
              type: "llm_error",
              purpose: step.purpose,
              error: llmResponse.error,
              attempts: llmResponse.attempts || []
            });
            executionSteps.push({
              ...step,
              status: "failed",
              error: llmResponse.error,
              durationMs: Date.now() - stepStartedAt
            });
            this.sessionManager?.recordError(sessionId, {
              stepId: step.id,
              type: step.type,
              error: llmResponse.error
            });
            this.sessionManager?.recordStepResult(sessionId, step, {
              status: "failed",
              durationMs: Date.now() - stepStartedAt,
              error: llmResponse.error
            });
            continue;
          }

          modelsUsed.add(llmResponse.model);
          candidates.push({
            type: "llm",
            provider: llmResponse.provider,
            model: llmResponse.model,
            purpose: step.purpose,
            content: llmResponse.content,
            pipeline: pipelineResult.pipeline
          });
          executionSteps.push({
            ...step,
            provider: llmResponse.provider,
            model: llmResponse.model,
            pipelineMode: pipelineResult.pipeline?.mode || "single_pass",
            status: "completed",
            durationMs: Date.now() - stepStartedAt
          });
          this.sessionManager?.recordStepResult(sessionId, step, {
            status: "completed",
            durationMs: Date.now() - stepStartedAt,
            provider: llmResponse.provider,
            model: llmResponse.model
          });
        }
      } catch (error) {
        executionSteps.push({
          ...step,
          status: "failed",
          error: error.message,
          durationMs: Date.now() - stepStartedAt
        });
        this.sessionManager?.recordError(sessionId, {
          stepId: step.id,
          type: step.type,
          error: error.message
        });
        this.sessionManager?.recordStepResult(sessionId, step, {
          status: "failed",
          durationMs: Date.now() - stepStartedAt,
          error: error.message
        });
      }
    }

    const followUpActions = buildFollowUpActions({
      plan: {
        ...plan,
        steps: executionSteps
      },
      apiResults,
      webResults,
      toolResults
    });

    observationLog.push(
      ...executionSteps.map((step) => ({
        stepId: step.id,
        type: step.type,
        purpose: step.purpose,
        status: step.status,
        provider: step.provider || null,
        error: step.error || null
      }))
    );

    const learningCandidates = extractLearningFromTask(
      {
        plan,
        executionSteps,
        artifacts,
        critique: null
      },
      {
        kind: "execution",
        prompt,
        classification,
        domain: domainProfile?.id || classification,
        conversationId,
        project: "hydria",
        projectType
      }
    );

    return {
      executionSteps,
      candidates,
      normalizedCandidates: candidates.map(normalizeCandidate),
      artifacts,
      apiResults,
      webResults,
      toolResults,
      knowledgeResults,
      toolMessages,
      modelsUsed: [...modelsUsed],
      apisUsed: [...apisUsed],
      toolsUsed: [...toolsUsed],
      memoryUsed: [...memoryUsedMap.values()],
      attachmentEvidenceUsed,
      preferencesUsed,
      followUpActions,
      observationLog,
      finalAnswerOverride,
      projectDelivery,
      reusedLearnings: summarizeLearningUsage(reusedLearnings),
      learningCandidates
    };
  }
}

export default ExecutorAgent;
