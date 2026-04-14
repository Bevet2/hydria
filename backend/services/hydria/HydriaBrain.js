import { AppError } from "../../utils/errors.js";
import logger from "../../utils/logger.js";
import { durationMs } from "../../utils/time.js";
import { resolve as resolveApi } from "../apis/apiRouter.js";
import { resolveWeb } from "../web/webRouter.js";
import { resolveToolStep } from "../tools/toolRouter.js";
import { classifyRequest } from "./classifier.js";
import { buildExecutionPlan } from "./planner.js";
import { resolveConversationalRouting } from "./conversationIntentService.js";
import { buildFollowUpActions } from "./followUpActionService.js";
import { buildQualityInstruction } from "./qualityBoostService.js";
import { synthesizeAnswers } from "./synthesizer.js";
import {
  createConversation,
  createExecutionLog,
  deriveConversationTitle,
  ensureConversationForUser,
  getLatestExecutionLog,
  getUserById,
  maybeUpdateConversationTitle,
  saveMessage
} from "../memory/historyService.js";
import { buildModelContext } from "../memory/contextBuilder.js";
import {
  storeUsefulMemory,
  summarizeConversationIfNeeded
} from "../memory/memoryService.js";
import {
  buildAttachmentToolMessage,
  buildUserMessageContent,
  derivePromptFromAttachments,
  serializeAttachmentsForClient
} from "../attachments/attachmentService.js";
import { generateDocumentArtifact } from "../artifacts/documentOrchestrator.js";
import {
  callChatModel,
  callCodeModel,
  callReasoningModel
} from "../providers/llm/llmRouterService.js";

function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

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

function buildStepInstruction(
  step,
  classification,
  prompt,
  taskPack,
  preferencesUsed,
  attachments = []
) {
  const qualityInstruction = buildQualityInstruction({
    classification,
    prompt,
    purpose: step.purpose || "",
    taskPack,
    preferencesUsed
  });

  return [step.instruction, qualityInstruction].filter(Boolean).join("\n\n");
}

function normalizeCandidate(candidate) {
  if (candidate.type === "llm") {
    return {
      type: "llm",
      provider: candidate.provider,
      model: candidate.model,
      purpose: candidate.purpose,
      preview: candidate.content.slice(0, 220)
    };
  }

  if (candidate.type === "web") {
    return {
      type: "web",
      provider: candidate.provider,
      capability: candidate.capability,
      preview: candidate.summaryText
    };
  }

  if (candidate.type === "tool") {
    return {
      type: "tool",
      provider: candidate.provider,
      capability: candidate.capability,
      preview: candidate.summaryText
    };
  }

  return {
    type: "api",
    provider: candidate.provider,
    capability: candidate.capability,
    preview: candidate.summaryText
  };
}

function collectContextUsage(modelContext, memoryUsedMap, attachmentEvidenceUsed) {
  for (const memory of modelContext.memoryUsed) {
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

function dedupeAttachmentEvidence(attachmentEvidenceUsed) {
  return [...new Map(
    attachmentEvidenceUsed.map((evidence) => [
      `${evidence.attachmentId}:${evidence.sectionTitle}:${evidence.excerpt}`,
      evidence
    ])
  ).values()];
}

function hasExecutionIssues(artifacts = []) {
  return artifacts.some((artifact) => /_error$/i.test(artifact.type || ""));
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

function buildToolResultMessage(toolResult) {
  return `${toolResult.sourceName}: ${toolResult.summaryText}`;
}

function buildWebToolMessage(webResult) {
  const pages = webResult.pages || [];
  const searchResults = webResult.searchResults || [];

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

  return `Web result: ${webResult.summaryText}`;
}

async function executeLlmStep(step, contextMessages) {
  switch (step.modelKind) {
    case "code":
      return callCodeModel(contextMessages, {
        model: step.model,
        modelChain: step.modelChain
      });
    case "reasoning":
    case "agent":
      return callReasoningModel(contextMessages, {
        model: step.model,
        modelChain: step.modelChain
      });
    case "general":
    case "fast":
    default:
      return callChatModel(contextMessages, {
        model: step.model,
        modelChain: step.modelChain
      });
  }
}

class HydriaBrain {
  async processChat({ userId, conversationId, prompt, attachments = [] }) {
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

    let conversation = conversationId
      ? ensureConversationForUser(conversationId, userId)
      : createConversation({
          userId,
          title: deriveConversationTitle(effectivePrompt)
        });

    const latestExecution = getLatestExecutionLog(conversation.id);
    const routingResolution = resolveConversationalRouting({
      prompt: effectivePrompt,
      attachments,
      latestExecution
    });
    const routingPrompt = routingResolution.resolvedPrompt || effectivePrompt;
    const basePromptForExecution = buildBasePromptForExecution(
      latestExecution,
      routingResolution,
      effectivePrompt,
      routingPrompt
    );
    const classification = classifyRequest(routingPrompt, attachments);
    const plan = buildExecutionPlan(classification, routingPrompt, {
      attachments
    });
    const taskPack = plan.taskPack || null;
    const executedPlan = clonePlan(plan);
    const candidates = [];
    const artifacts = [];
    const apiResults = [];
    const webResults = [];
    const toolResults = [];
    const modelsUsed = new Set();
    const apisUsed = new Set();
    const toolsUsed = new Set();
    const memoryUsedMap = new Map();
    const attachmentEvidenceUsed = [];
    let preferencesUsed = {};

    try {
      saveMessage({
        conversationId: conversation.id,
        role: "user",
        content: buildUserMessageContent(effectivePrompt, attachments),
        classification,
        routeUsed: classification
      });
      conversation =
        maybeUpdateConversationTitle(conversation.id, effectivePrompt) || conversation;

      if (classification === "artifact_generation") {
        const generationResult = await generateDocumentArtifact({
          userId,
          conversationId: conversation.id,
          prompt: routingPrompt,
          attachments,
          plan: executedPlan
        });

        const uniqueAttachmentEvidenceUsed = dedupeAttachmentEvidence(
          generationResult.attachmentEvidenceUsed || []
        );

        saveMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: generationResult.finalAnswer,
          classification,
          routeUsed: classification,
          modelsUsed: generationResult.modelsUsed || []
        });

        for (const attachment of attachments) {
          saveMessage({
            conversationId: conversation.id,
            role: "tool",
            content: buildAttachmentToolMessage(attachment),
            classification,
            routeUsed: "attachment"
          });
        }

        for (const artifact of generationResult.artifacts || []) {
          if (artifact.type === "generated_file") {
            saveMessage({
              conversationId: conversation.id,
              role: "tool",
              content: `Generated file: ${artifact.filename} (${artifact.format}) -> ${artifact.downloadUrl}`,
              classification,
              routeUsed: "artifact_generation"
            });
          }
        }

        const storedMemories = storeUsefulMemory({
          userId,
          conversationId: conversation.id,
          prompt: effectivePrompt,
          classification
        });
        summarizeConversationIfNeeded({
          conversationId: conversation.id,
          userId
        });

        createExecutionLog({
          conversationId: conversation.id,
          classification,
          executionPlan: {
            ...executedPlan,
            originalPrompt: effectivePrompt,
            resolvedPrompt: routingPrompt,
            basePrompt: basePromptForExecution,
            followUpActions: []
          },
          durationMs: durationMs(startedAt),
          status: hasExecutionIssues(generationResult.artifacts) ? "partial_success" : "success"
        });

        return {
          success: true,
          conversationId: conversation.id,
          classification,
          strategy: plan.strategy,
          plan: executedPlan,
          taskPack,
          followUpActions: [],
          modelsUsed: generationResult.modelsUsed || [],
          apisUsed: [],
          toolsUsed: [],
          judge: {
            usedJudge: false,
            mode: "heuristic",
            confidence: "n/a",
            score: 0,
            decision: "artifact_generation",
            issues: [],
            candidateEvaluations: []
          },
          finalAnswer: generationResult.finalAnswer,
          artifacts: generationResult.artifacts || [],
          candidates: generationResult.candidates || [],
          sourcesUsed: (generationResult.candidates || [])
            .filter((candidate) => candidate.type === "llm")
            .map((candidate) => ({
              type: candidate.type,
              provider: candidate.provider,
              model: candidate.model,
              capability: null
            })),
          attachments: serializeAttachmentsForClient(attachments),
          attachmentEvidenceUsed: uniqueAttachmentEvidenceUsed,
          memoryUsed: generationResult.memoryUsed || [],
          storedMemory: storedMemories.map((memory) => ({
            id: memory.id,
            type: memory.memory_type,
            content: memory.content
          })),
          meta: {
            usedJudge: false,
            durationMs: durationMs(startedAt),
            usedFallback: generationResult.meta?.usedFallback || false
          }
        };
      }

      const apiSteps = executedPlan.steps.filter((step) => step.type === "api");
      const webSteps = executedPlan.steps.filter((step) => step.type === "web");
      const toolSteps = executedPlan.steps.filter((step) => step.type === "tool");
      const llmSteps = executedPlan.steps.filter((step) => step.type === "llm");

      for (const step of toolSteps) {
        const toolResult = await resolveToolStep(step, {
          prompt: routingPrompt,
          classification,
          attachments
        });

        if (!toolResult?.summaryText) {
          step.error = "Tool returned no summary.";
          artifacts.push({
            type: "tool_error",
            capability: step.capability,
            error: step.error
          });
          continue;
        }

        step.provider = toolResult.providerId;
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

        saveMessage({
          conversationId: conversation.id,
          role: "tool",
          content: buildToolResultMessage(toolResult),
          classification,
          routeUsed: toolResult.capability
        });

        for (const artifact of toolResult.artifacts || []) {
          if (artifact.type === "generated_file") {
            saveMessage({
              conversationId: conversation.id,
              role: "tool",
              content: `Generated file: ${artifact.filename} (${artifact.format}) -> ${artifact.downloadUrl}`,
              classification,
              routeUsed: toolResult.capability
            });
          }
        }
      }

      for (const step of webSteps) {
        const webResult = await resolveWeb(
          routingPrompt,
          classification,
          executedPlan.webNeed
        );

        if (!webResult.success) {
          step.error = webResult.error;
          artifacts.push({
            type: "web_error",
            capability: step.capability,
            error: webResult.error,
            attempts: webResult.attempts || []
          });
          continue;
        }

        step.provider = webResult.providerId;
        webResults.push(webResult);
        candidates.push({
          type: "web",
          provider: webResult.providerId,
          capability: webResult.capability,
          sourceName: webResult.sourceName,
          summaryText: webResult.summaryText
        });
        artifacts.push(...(webResult.artifacts || []));

        saveMessage({
          conversationId: conversation.id,
          role: "tool",
          content: buildWebToolMessage(webResult),
          classification,
          routeUsed: webResult.capability
        });
      }

      for (const step of apiSteps) {
        if (step.type === "api") {
          const apiResult = await resolveApi(
            routingPrompt,
            classification,
            executedPlan.apiNeed
          );

          if (!apiResult.success) {
            step.error = apiResult.error;
            artifacts.push({
              type: "api_error",
              capability: step.capability,
              error: apiResult.error,
              attempts: apiResult.attempts || []
            });
            continue;
          }

          step.provider = apiResult.providerId;
          apiResults.push(apiResult);
          apisUsed.add(apiResult.providerId);
          candidates.push({
            type: "api",
            provider: apiResult.providerId,
            capability: apiResult.capability,
            sourceName: apiResult.sourceName,
            summaryText: apiResult.summaryText
          });

          saveMessage({
            conversationId: conversation.id,
            role: "tool",
            content: `${apiResult.sourceName}: ${apiResult.summaryText}`,
            classification,
            routeUsed: apiResult.capability,
            apisUsed: [apiResult.providerId]
          });

          continue;
        }
      }

      if (llmSteps.length) {
        const modelContext = buildModelContext(
          userId,
          conversation.id,
          routingPrompt,
          {
            apiResults,
            webResults,
            toolResults,
            attachments,
            taskPack,
            routingResolution
          }
        );

        collectContextUsage(modelContext, memoryUsedMap, attachmentEvidenceUsed);
        preferencesUsed = modelContext.preferencesUsed || {};

        const llmResponses = await Promise.all(
          llmSteps.map(async (step) => {
            const messages = attachInstruction(
              modelContext.messages,
              buildStepInstruction(
                step,
                classification,
                routingPrompt,
                taskPack,
                modelContext.preferencesUsed || {},
                attachments
              ),
              attachments
            );

            const llmResponse = await executeLlmStep(step, messages);
            return {
              step,
              llmResponse
            };
          })
        );

        for (const { step, llmResponse } of llmResponses) {
          if (!llmResponse.success) {
            step.error = llmResponse.error;
            artifacts.push({
              type: "llm_error",
              purpose: step.purpose,
              error: llmResponse.error,
              attempts: llmResponse.attempts || []
            });
            continue;
          }

          step.model = llmResponse.model;
          modelsUsed.add(llmResponse.model);
          candidates.push({
            type: "llm",
            provider: llmResponse.provider,
            model: llmResponse.model,
            purpose: step.purpose,
            content: llmResponse.content
          });
        }
      }

      const uniqueAttachmentEvidenceUsed = dedupeAttachmentEvidence(attachmentEvidenceUsed);
      const followUpActions = buildFollowUpActions({
        plan: executedPlan,
        apiResults,
        webResults,
        toolResults
      });

      const synthesis = synthesizeAnswers(candidates, {
        classification,
        taskPack,
        prompt: routingPrompt,
        plan: executedPlan,
        attachments,
        attachmentEvidenceUsed: uniqueAttachmentEvidenceUsed,
        preferencesUsed,
        memoryUsed: [...memoryUsedMap.values()],
        artifacts,
        apiResults,
        webResults,
        toolResults,
        routingResolution,
        followUpActions
      });
      const finalAnswer = synthesis.finalAnswer;

      saveMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: finalAnswer,
        classification,
        routeUsed: classification,
        modelsUsed: [...modelsUsed],
        apisUsed: [...apisUsed]
      });

      for (const attachment of attachments) {
        saveMessage({
          conversationId: conversation.id,
          role: "tool",
          content: buildAttachmentToolMessage(attachment),
          classification,
          routeUsed: "attachment"
        });
      }

      const storedMemories = storeUsefulMemory({
        userId,
        conversationId: conversation.id,
        prompt: effectivePrompt,
        classification
      });
      summarizeConversationIfNeeded({
        conversationId: conversation.id,
        userId
      });

      createExecutionLog({
        conversationId: conversation.id,
        classification,
        executionPlan: {
          ...executedPlan,
          originalPrompt: effectivePrompt,
          resolvedPrompt: routingPrompt,
          basePrompt: basePromptForExecution,
          followUpActions
        },
        durationMs: durationMs(startedAt),
        status: hasExecutionIssues(artifacts) ? "partial_success" : "success"
      });

      return {
        success: true,
        conversationId: conversation.id,
        classification,
        strategy: plan.strategy,
        plan: executedPlan,
        routing: routingResolution,
        taskPack,
        followUpActions,
        modelsUsed: [...modelsUsed],
        apisUsed: [...apisUsed],
        toolsUsed: [...toolsUsed],
        judge: synthesis.judge,
        finalAnswer,
        artifacts,
        candidates: candidates.map(normalizeCandidate),
        sourcesUsed: synthesis.sources,
        attachments: serializeAttachmentsForClient(attachments),
        attachmentEvidenceUsed: uniqueAttachmentEvidenceUsed,
        memoryUsed: [...memoryUsedMap.values()],
        storedMemory: storedMemories.map((memory) => ({
          id: memory.id,
          type: memory.memory_type,
          content: memory.content
        })),
        meta: {
          usedJudge: synthesis.judge?.usedJudge || false,
          durationMs: durationMs(startedAt)
        }
      };
    } catch (error) {
      logger.error("HydriaBrain failed", {
        error: error.message,
        conversationId: conversation?.id,
        userId
      });

      if (conversation?.id) {
        createExecutionLog({
          conversationId: conversation.id,
          classification,
          executionPlan: {
            ...executedPlan,
            originalPrompt: effectivePrompt,
            resolvedPrompt: routingPrompt,
            basePrompt: basePromptForExecution,
            followUpActions: []
          },
          durationMs: durationMs(startedAt),
          status: "failed"
        });
      }

      throw error;
    }
  }
}

export default new HydriaBrain();
