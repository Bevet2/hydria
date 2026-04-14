import fs from "node:fs";
import path from "node:path";
import { recordAgentFeedback, getTopAgents } from "./evolution.agent-feedback.js";
import { recordStrategyFeedback, getTopStrategies } from "./evolution.strategy-feedback.js";

function ensureFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, agentFeedback: {}, strategyFeedback: {} }, null, 2));
  }
}

export class EvolutionOptimizer {
  constructor({ filePath }) {
    this.filePath = filePath;
    ensureFile(filePath);
  }

  readState() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch {
      return { version: 1, agentFeedback: {}, strategyFeedback: {} };
    }
  }

  writeState(state) {
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  recordOutcome({ domain = "general", strategyId = "", activeAgents = [], score = 0, delta = 0 } = {}) {
    const state = this.readState();
    let nextAgentFeedback = state.agentFeedback || {};
    for (const agentId of activeAgents || []) {
      nextAgentFeedback = recordAgentFeedback(nextAgentFeedback, { domain, agentId, score });
    }
    const nextStrategyFeedback = strategyId
      ? recordStrategyFeedback(state.strategyFeedback || {}, { domain, strategyId, score, delta })
      : (state.strategyFeedback || {});
    this.writeState({
      ...state,
      agentFeedback: nextAgentFeedback,
      strategyFeedback: nextStrategyFeedback
    });
  }

  getRecommendations(domain = "general") {
    const state = this.readState();
    return {
      topAgents: getTopAgents(state.agentFeedback || {}, domain, 3),
      topStrategies: getTopStrategies(state.strategyFeedback || {}, domain, 3)
    };
  }
}

export default EvolutionOptimizer;
