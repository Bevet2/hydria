import { getProviderModelChain } from "../../services/registry/modelRegistry.js";

export function buildModelFallbackStrategy({
  classification = "simple_chat",
  domain = "",
  step = {},
  strategyDecision = null
} = {}) {
  let kind = step.modelKind || "general";

  if (classification === "coding") {
    kind = "code";
  } else if (
    ["compare", "reasoning", "complex_reasoning"].includes(classification) ||
    domain === "github_research"
  ) {
    kind = "reasoning";
  } else if (strategyDecision?.fastPath) {
    kind = "fast";
  }

  const chain = getProviderModelChain(kind, step.model);
  return {
    kind,
    primary: chain[0] || step.model || "",
    chain
  };
}

export default {
  buildModelFallbackStrategy
};
