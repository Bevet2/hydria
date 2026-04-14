export function buildDebugTraceSummary({ context = {}, synthesis = {} } = {}) {
  return {
    domain: context.domainProfile?.id || context.classification || "simple_chat",
    routingReason: context.routingResolution?.reason || "",
    toolCount: (context.toolResults || []).length,
    apiCount: (context.apiResults || []).length,
    webCount: (context.webResults || []).length,
    candidateCount: (synthesis.selectedCandidates || []).length,
    judgeDecision: synthesis.judge?.decision || "",
    qualityIssues: synthesis.qualityPass?.issues || []
  };
}

export default {
  buildDebugTraceSummary
};
