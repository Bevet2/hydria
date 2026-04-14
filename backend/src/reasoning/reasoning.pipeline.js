import { buildReasoningCritiquePrompt, buildReasoningRefinePrompt } from "./reasoning.refine.js";
import { buildModelFallbackStrategy } from "./modelFallbackStrategy.js";

function shouldUseMultiPass({ prompt = "", classification = "", domainProfile = null, strategyDecision = null }) {
  if (!strategyDecision?.useMultiPassReasoning) {
    return false;
  }

  if (String(prompt || "").trim().length < 80) {
    return false;
  }

  return ["coding", "compare", "reasoning", "complex_reasoning"].includes(classification) ||
    domainProfile?.id === "github_research";
}

export async function runReasoningPipeline({
  brainProvider,
  messages = [],
  step = {},
  prompt = "",
  classification = "",
  domainProfile = null,
  strategyDecision = null
} = {}) {
  const fallback = buildModelFallbackStrategy({
    classification,
    domain: domainProfile?.id || classification,
    step,
    strategyDecision
  });

  if (!shouldUseMultiPass({ prompt, classification, domainProfile, strategyDecision })) {
    const single = await brainProvider.complete({
      kind: fallback.kind,
      messages,
      options: {
        model: fallback.primary,
        modelChain: fallback.chain
      }
    });
    return {
      response: single,
      pipeline: {
        mode: "single_pass"
      }
    };
  }

  const draft = await brainProvider.complete({
    kind: fallback.kind,
    messages,
    options: {
      model: fallback.primary,
      modelChain: fallback.chain
    }
  });

  if (!draft.success) {
    return {
      response: draft,
      pipeline: {
        mode: "draft_failed"
      }
    };
  }

  const critique = await brainProvider.complete({
    kind: fallback.kind,
    messages: [
      { role: "system", content: buildReasoningCritiquePrompt({
        prompt,
        domain: domainProfile?.id || classification,
        draft: draft.content
      }) }
    ],
    options: {
      model: fallback.primary,
      modelChain: fallback.chain
    }
  });

  if (!critique.success) {
    return {
      response: draft,
      pipeline: {
        mode: "draft_only",
        draft: draft.content
      }
    };
  }

  const refined = await brainProvider.complete({
    kind: fallback.kind,
    messages: [
      { role: "system", content: buildReasoningRefinePrompt({
        prompt,
        domain: domainProfile?.id || classification,
        draft: draft.content,
        critique: critique.content
      }) }
    ],
    options: {
      model: fallback.primary,
      modelChain: fallback.chain
    }
  });

  return {
    response: refined.success ? refined : draft,
    pipeline: {
      mode: refined.success ? "multi_pass" : "draft_only",
      draft: draft.content,
      critique: critique.content
    }
  };
}

export default {
  runReasoningPipeline
};
