import logger from "../../../utils/logger.js";
import { durationMs } from "../../../utils/time.js";
import {
  createExecutionLog,
  saveMessage
} from "../../persistence/historyGateway.js";
import {
  storeUsefulMemory,
  summarizeConversationIfNeeded
} from "../../memory/sqliteMemoryGateway.js";
import {
  buildAttachmentToolMessage,
  serializeAttachmentsForClient
} from "../../attachments/attachmentGateway.js";
import { summarizeLearningUsage } from "../../learning/learning.reuse.js";
import { normalizeStatus } from "./helpers.js";

export async function finalizeAgenticSuccess({
  brain,
  userId,
  conversation,
  startedAt,
  runtimeSession,
  effectivePrompt,
  routingPrompt,
  basePrompt,
  attachments,
  preparation,
  planning,
  continuity,
  activeWorkObject,
  activeProject,
  finalExecution,
  finalSynthesis,
  finalCritique,
  finalAnswerAfterEvolution,
  finalPlan,
  finalAttachmentEvidence,
  initialExecutionKnowledge,
  finalExecutionKnowledge,
  improvement,
  storedLearnings,
  projectBuilderReport,
  effectiveDeliveryReport
}) {
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

  const memoryCommit = await brain.memoryAgent.remember({
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
    await brain.memoryStore.addLongTermMemory({
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
          orchestrator: brain.orchestratorAgent.describe(),
          strategy: brain.strategyAgent.describe(),
          planner: brain.plannerAgent.describe(),
          executor: brain.executorAgent.describe(),
          critic: brain.criticAgent.describe(),
          memory: brain.memoryAgent.describe(),
          research: brain.researchAgent.describe(),
          api: brain.apiAgent.describe(),
          git: brain.gitAgent.describe()
        },
        registry: brain.agentRegistry.list(),
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

  brain.sessionManager.completeSession(runtimeSession.id, {
    status: "completed",
    finalClassification: planning.classification,
    criticScore: finalCritique.score || 0
  });

  return {
    success: true,
    conversationId: conversation.id,
    classification: planning.classification,
    strategy: planning.strategyDecision?.chosenStrategy || finalPlan.strategy,
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
    workObjects: brain.workObjectService.list({
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
        session: brain.sessionManager.getSession(runtimeSession.id)
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
}

export async function finalizeAgenticFailure({
  brain,
  runtimeSession,
  conversation,
  effectivePrompt,
  startedAt,
  userId,
  error
}) {
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

  brain.sessionManager.completeSession(runtimeSession.id, {
    status: "failed",
    error: error.message
  });
}
