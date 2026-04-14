import { synthesizeAnswers } from "../core/agenticSynthesizer.js";
import { selectImprovementStrategy } from "./evolution.strategy.js";
import { applyResponseQualityPass } from "../core/responseQualityPass.js";
import { extractLearningFromTask } from "../learning/learning.extractor.js";

function dedupeAttachmentEvidence(attachmentEvidenceUsed) {
  return [...new Map(
    (attachmentEvidenceUsed || []).map((evidence) => [
      `${evidence.attachmentId}:${evidence.sectionTitle}:${evidence.excerpt}`,
      evidence
    ])
  ).values()];
}

export class EvolutionLoop {
  constructor({
    config,
    benchmark,
    executorAgent,
    criticAgent,
    sessionManager = null
  }) {
    this.config = config;
    this.benchmark = benchmark;
    this.executorAgent = executorAgent;
    this.criticAgent = criticAgent;
    this.sessionManager = sessionManager;
  }

  async maybeImprove({
    userId,
    conversationId,
    prompt,
    attachments = [],
    classification,
    taskPack,
    domainProfile = null,
    routing,
    memoryRecall,
    plan,
    firstPass,
    firstSynthesis,
    firstCritique,
    sessionId = null,
    reusedLearnings = [],
    learningGuidance = "",
    projectType = "internal",
    strategyDecision = null
  }) {
    if (!this.config.evolution.enabled) {
      return null;
    }

    if (firstPass?.finalAnswerMode === "simple_chat_grounding") {
      return null;
    }

    if (
      plan?.strategy === "runtime-browser-fastpath" ||
      (plan?.steps || []).every(
        (step) => step.type === "tool" && step.toolId === "browser_automation"
      )
    ) {
      return null;
    }

    if ((firstCritique?.score || 0) >= this.config.evolution.retryBelowScore) {
      return null;
    }

    let bestPlan = plan;
    let bestExecution = firstPass;
    let bestSynthesis = firstSynthesis;
    let bestCritique = firstCritique;
    const attempts = [];
    const triedStrategies = new Set();

    const maxRetries = Math.min(
      this.config.evolution.maxRetries,
      Number(strategyDecision?.retryPolicy?.maxRetries || this.config.evolution.maxRetries)
    );

    for (let attemptIndex = 0; attemptIndex < maxRetries; attemptIndex += 1) {
      const strategy = selectImprovementStrategy({
        plan: bestPlan,
        critique: bestCritique,
        classification,
        prompt,
        attachments,
        triedStrategies: [...triedStrategies]
      });

      if (!strategy) {
        break;
      }

      triedStrategies.add(strategy.id);
      this.sessionManager?.recordStepRetry(
        sessionId,
        {
          id: "evolution_loop",
          type: "evolution",
          purpose: "controlled_improvement"
        },
        strategy.id
      );
      const improvedPlan = strategy.apply(bestPlan);
      const retryExecution = await this.executorAgent.execute({
        userId,
        conversationId,
        prompt,
        attachments,
        classification,
        plan: improvedPlan,
        taskPack,
        domainProfile,
        routing,
        memoryRecall,
        sessionId,
        reusedLearnings,
        learningGuidance,
        projectType,
        strategyDecision
      });

      const uniqueAttachmentEvidenceUsed = dedupeAttachmentEvidence(
        retryExecution.attachmentEvidenceUsed
      );

      const retrySynthesis = applyResponseQualityPass(
        retryExecution.finalAnswerOverride
          ? {
            finalAnswer: retryExecution.finalAnswerOverride,
            sources: [],
            selectedCandidates: retryExecution.candidates,
            judge: {
              usedJudge: false,
              mode: "evolution_artifact",
              score: 0,
              confidence: "n/a",
              decision: "artifact_generation",
              issues: [],
              candidateEvaluations: []
            }
          }
          : synthesizeAnswers(retryExecution.candidates, {
            classification,
            taskPack,
            prompt,
            plan: improvedPlan,
            domainProfile,
            attachments,
            attachmentEvidenceUsed: uniqueAttachmentEvidenceUsed,
            preferencesUsed: retryExecution.preferencesUsed,
            memoryUsed: retryExecution.memoryUsed,
            artifacts: retryExecution.artifacts,
            apiResults: retryExecution.apiResults,
            webResults: retryExecution.webResults,
            toolResults: retryExecution.toolResults,
            routingResolution: routing,
            followUpActions: retryExecution.followUpActions
          }),
        {
          classification,
          prompt,
          domainProfile,
          apiResults: retryExecution.apiResults,
          webResults: retryExecution.webResults,
          toolResults: retryExecution.toolResults,
          attachments,
          taskPack,
          routingResolution: routing,
          reusedLearnings,
          strategyDecision
        }
      );

      const retryCritique = await this.criticAgent.execute({
        prompt,
        classification,
        domainProfile,
        plan: {
          ...improvedPlan,
          steps: retryExecution.executionSteps
        },
        finalAnswer: retrySynthesis.finalAnswer,
        execution: retryExecution
      });

      const comparison = this.benchmark.compare(bestCritique, retryCritique);
      const attempt = {
        attempt: attemptIndex + 1,
        strategy,
        improvedPlan,
        retryExecution,
        retrySynthesis,
        retryCritique,
        comparison
      };

      attempts.push(attempt);
      this.benchmark.append({
        at: new Date().toISOString(),
        prompt,
        classification,
        attempt: attempt.attempt,
        strategy: strategy.id,
        baselineScore: bestCritique?.score || 0,
        retryScore: retryCritique?.score || 0,
        winner: comparison.winner,
        delta: comparison.delta
      });

      if (comparison.winner === "second") {
        bestPlan = improvedPlan;
        bestExecution = retryExecution;
        bestSynthesis = retrySynthesis;
        bestCritique = retryCritique;
      } else {
        this.sessionManager?.recordError(sessionId, {
          stepId: "evolution_loop",
          type: "evolution",
          error: `retry_strategy_not_selected:${strategy.id}`
        });
      }
    }

    if (!attempts.length) {
      return null;
    }

    const finalComparison = this.benchmark.compare(firstCritique, bestCritique);
    const bestAttempt = attempts.find(
      (attempt) => attempt.retryCritique?.score === bestCritique?.score
    ) || null;

    const learningCandidates = extractLearningFromTask(
      {
        comparison: finalComparison,
        attempts,
        strategy: bestAttempt?.strategy || attempts[0].strategy,
        retryCritique: bestCritique
      },
      {
        kind: "evolution",
        prompt,
        classification,
        domain: domainProfile?.id || classification,
        conversationId,
        project: "hydria",
        projectType
      }
    );

    return {
      strategy: bestAttempt?.strategy || attempts[0].strategy,
      improvedPlan: bestPlan,
      retryExecution: bestExecution,
      retrySynthesis: bestSynthesis,
      retryCritique: bestCritique,
      comparison: finalComparison,
      attempts,
      learningCandidates
    };
  }
}

export default EvolutionLoop;
