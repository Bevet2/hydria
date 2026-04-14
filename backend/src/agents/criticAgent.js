import agenticConfig from "../config/agenticConfig.js";
import { HeuristicEvaluator } from "../evals/HeuristicEvaluator.js";
import { BaseAgent } from "./BaseAgent.js";

export class CriticAgent extends BaseAgent {
  constructor({ evaluator }) {
    super({
      id: "critic_agent",
      label: "Critic Agent",
      role: "execution quality assessment"
    });

    this.evaluator = evaluator || new HeuristicEvaluator();
  }

  async execute({
    prompt,
    classification,
    domainProfile = null,
    plan,
    finalAnswer,
    execution
  }) {
    if (!agenticConfig.enableCritic) {
      return {
        status: "skipped",
        score: 0,
        summary: "Critic disabled."
      };
    }

    const evaluation = await this.evaluator.evaluate({
      taskContext: {
        prompt,
        routingPrompt: prompt,
        classification,
        domain: domainProfile?.id || null
      },
      plan,
      execution: {
        trace: execution.executionSteps.map((step) => ({
          ...step,
          status: step.status === "completed" ? "success" : step.status
        })),
        candidates: execution.candidates,
        artifacts: execution.artifacts,
        apiResults: execution.apiResults,
        webResults: execution.webResults,
        toolResults: execution.toolResults,
        learningUsed: execution.reusedLearnings || [],
        learningCreated: execution.learningCandidates || [],
        improvementDelta: Number(execution.improvementDelta || 0)
      },
      synthesis: {
        finalAnswer
      }
    });

    return {
      ...evaluation,
      critique: {
        missing: evaluation.missingElements || [],
        fuzzy: evaluation.weaknesses || [],
        improvementPrompt: evaluation.improvementPrompt || "",
        needsRetry: Boolean(evaluation.needsRetry)
      }
    };
  }
}

export default CriticAgent;
