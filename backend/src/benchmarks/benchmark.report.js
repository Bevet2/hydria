export function buildBenchmarkReport(results = []) {
  const domainStats = {};
  for (const result of results) {
    const domain = result.domain || "unknown";
    if (!domainStats[domain]) {
      domainStats[domain] = { total: 0, scoreSum: 0 };
    }
    domainStats[domain].total += 1;
    domainStats[domain].scoreSum += Number(result.score || 0);
  }

  const domains = Object.fromEntries(
    Object.entries(domainStats).map(([domain, entry]) => [
      domain,
      {
        count: entry.total,
        averageScore: Number((entry.scoreSum / Math.max(entry.total, 1)).toFixed(2))
      }
    ])
  );

  return {
    total: results.length,
    averageScore: Number(
      (
        results.reduce((sum, result) => sum + Number(result.score || 0), 0) /
        Math.max(results.length, 1)
      ).toFixed(2)
    ),
    domains,
    results
  };
}

export default {
  buildBenchmarkReport
};
