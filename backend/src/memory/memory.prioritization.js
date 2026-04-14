export function computeMemoryPriority(record = {}) {
  return Number(
    (
      Number(record.score || 0.5) * 0.5 +
      Number(record.successRate || 0.5) * 0.3 +
      Math.min(Number(record.usageCount || 0), 10) * 0.02
    ).toFixed(3)
  );
}

export default {
  computeMemoryPriority
};
