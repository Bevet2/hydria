import { summarizeConversationWindow } from "./memory.history.js";

function nowIso() {
  return new Date().toISOString();
}

export function shouldConsolidateConversation(history = [], options = {}) {
  const everyTurns = options.consolidateEveryTurns || 6;
  return history.length >= everyTurns && history.length % everyTurns === 0;
}

export function consolidateConversationState(state, conversationId, options = {}) {
  const history = state.shortTerm[String(conversationId)] || [];

  if (!shouldConsolidateConversation(history, options)) {
    return null;
  }

  const midTermBucket = state.midTerm[String(conversationId)] || [];
  const summary = summarizeConversationWindow(history);

  const consolidated = {
    id: `${conversationId}-${history.length}`,
    conversationId,
    summary,
    eventCount: history.length,
    createdAt: nowIso()
  };

  state.midTerm[String(conversationId)] = [
    consolidated,
    ...midTermBucket
  ].slice(0, options.midTermLimit || 36);

  return consolidated;
}

export default {
  shouldConsolidateConversation,
  consolidateConversationState
};
