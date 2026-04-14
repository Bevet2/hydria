export function recordAgentFeedback(state = {}, { domain = "general", agentId = "", score = 0 } = {}) {
  const next = { ...(state || {}) };
  const bucket = {
    usageCount: Number(next[domain]?.[agentId]?.usageCount || 0) + 1,
    totalScore: Number(next[domain]?.[agentId]?.totalScore || 0) + Number(score || 0)
  };
  next[domain] = {
    ...(next[domain] || {}),
    [agentId]: {
      ...bucket,
      averageScore: Number((bucket.totalScore / Math.max(bucket.usageCount, 1)).toFixed(3))
    }
  };
  return next;
}

export function getTopAgents(agentFeedback = {}, domain = "general", limit = 3) {
  return Object.entries(agentFeedback?.[domain] || {})
    .map(([agentId, entry]) => ({ agentId, ...entry }))
    .sort((left, right) => right.averageScore - left.averageScore)
    .slice(0, limit);
}

export default {
  recordAgentFeedback,
  getTopAgents
};
