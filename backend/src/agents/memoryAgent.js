import { BaseAgent } from "./BaseAgent.js";
import { buildMemoryRecallSummary } from "../memory/memory.history.js";

export class MemoryAgent extends BaseAgent {
  constructor({ memoryStore, knowledgeStore, config }) {
    super({
      id: "memory_agent",
      label: "Memory Agent",
      role: "memory recall, persistence and knowledge ingestion"
    });

    this.memoryStore = memoryStore;
    this.knowledgeStore = knowledgeStore;
    this.config = config;
  }

  async prepare({
    userId,
    conversationId,
    prompt,
    attachments = []
  }) {
    const memoryRecall = await this.memoryStore.recallContext({
      userId,
      conversationId,
      prompt,
      limit: this.config.maxMemoryHits
    });

    const knowledgeIngestion =
      this.config.enableKnowledgeIngestion && attachments.length
        ? await this.knowledgeStore.ingestAttachments({
            userId,
            conversationId,
            attachments
          })
        : {
            inserted: 0,
            totalChunks: (await this.knowledgeStore.getStats()).totalChunks
          };

    await this.memoryStore.appendShortTermEvent({
      conversationId,
      role: "user",
      content: prompt,
      metadata: {
        attachmentCount: attachments.length
      }
    });

    return {
      memoryRecall,
      memorySummary: buildMemoryRecallSummary(memoryRecall),
      knowledgeIngestion
    };
  }

  async remember({
    userId,
    conversationId,
    prompt,
    classification,
    finalAnswer,
    critique,
    plan,
    followUpActions = [],
    storedMemory = [],
    evolution = null
  }) {
    await this.memoryStore.appendShortTermEvent({
      conversationId,
      role: "assistant",
      content: finalAnswer,
      metadata: {
        classification,
        critiqueScore: critique?.score || 0
      }
    });

    const workingMemory = await this.memoryStore.setWorkingMemory(conversationId, {
      summary: finalAnswer.slice(0, 400),
      classification,
      followUpActions,
      currentPlan: {
        objective: plan.objective,
        stepCount: plan.steps.length
      }
    });

    for (const memory of storedMemory) {
      await this.memoryStore.addLongTermMemory({
        userId,
        type: memory.type,
        content: memory.content,
        score: 0.72,
        tags: [classification, "sqlite_memory"],
        source: {
          conversationId,
          origin: "sqlite_store"
        }
      });
    }

    const taskOutcome = await this.memoryStore.recordTaskOutcome({
      userId,
      conversationId,
      prompt,
      classification,
      success: (critique?.score || 0) >= this.config.minCriticScoreForSuccess,
      score: critique?.score || 0,
      summary: critique?.summary || "Execution completed.",
      outcome: finalAnswer.slice(0, 400),
      critique,
      planSnapshot: {
        objective: plan.objective,
        steps: plan.steps.map((step) => ({
          id: step.id,
          type: step.type,
          purpose: step.purpose
        })),
        evolution: evolution
          ? {
              strategy: evolution.strategy || null,
              winner: evolution.winner || null,
              attemptCount: evolution.attempts?.length || 0
            }
          : null
      }
    });

    if (evolution?.attempts?.length) {
      const bestLine =
        evolution.winner === "second" && evolution.strategy
          ? `Winning improvement strategy: ${evolution.strategy}`
          : "Baseline strategy remained the best after controlled retries.";
      await this.memoryStore.addLongTermMemory({
        userId,
        type: "strategy_pattern",
        content: `${bestLine} Classification: ${classification}.`,
        score: 0.77,
        tags: [classification, "evolution", evolution.strategy || "baseline"],
        source: {
          conversationId,
          origin: "evolution_loop"
        }
      });

      const failedAttempts = (evolution.attempts || []).filter(
        (attempt) => (attempt.score || 0) < (critique?.score || 0)
      );

      for (const attempt of failedAttempts.slice(0, 2)) {
        await this.memoryStore.addLongTermMemory({
          userId,
          type: "error_pattern",
          content: `Weak retry strategy observed: ${attempt.strategy} for ${classification}.`,
          score: 0.66,
          tags: [classification, "evolution_error", attempt.strategy || "unknown"],
          source: {
            conversationId,
            origin: "evolution_loop"
          }
        });
      }
    }

    if (!taskOutcome.success) {
      await this.memoryStore.addLongTermMemory({
        userId,
        type: "error_pattern",
        content: `Avoid repeating this weak pattern: ${taskOutcome.summary}`,
        score: 0.75,
        tags: [classification, "error_pattern"],
        source: {
          conversationId,
          origin: "critic"
        }
      });
    }

    return {
      workingMemory,
      taskOutcome
    };
  }
}

export default MemoryAgent;
