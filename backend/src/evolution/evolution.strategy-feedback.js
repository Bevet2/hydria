export function recordStrategyFeedback(state = {}, { domain = "general", strategyId = "", score = 0, delta = 0 } = {}) {
  const next = { ...(state || {}) };
  const bucket = {
    usageCount: Number(next[domain]?.[strategyId]?.usageCount || 0) + 1,
    totalScore: Number(next[domain]?.[strategyId]?.totalScore || 0) + Number(score || 0),
    totalDelta: Number(next[domain]?.[strategyId]?.totalDelta || 0) + Number(delta || 0)
  };
  next[domain] = {
    ...(next[domain] || {}),
    [strategyId]: {
      ...bucket,
      averageScore: Number((bucket.totalScore / Math.max(bucket.usageCount, 1)).toFixed(3)),
      averageDelta: Number((bucket.totalDelta / Math.max(bucket.usageCount, 1)).toFixed(3))
    }
  };
  return next;
}

export function getTopStrategies(strategyFeedback = {}, domain = "general", limit = 3) {
  return Object.entries(strategyFeedback?.[domain] || {})
    .map(([strategyId, entry]) => ({ strategyId, ...entry }))
    .sort((left, right) => right.averageScore - left.averageScore || right.averageDelta - left.averageDelta)
    .slice(0, limit);
}

export default {
  recordStrategyFeedback,
  getTopStrategies
};
