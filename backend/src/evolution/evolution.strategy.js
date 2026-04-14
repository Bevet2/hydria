function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

function nextStepId(prefix, steps = []) {
  return `${prefix}_${String(steps.length + 1).padStart(2, "0")}`;
}

export function selectImprovementStrategy({
  plan,
  critique,
  classification,
  prompt,
  attachments = [],
  triedStrategies = []
}) {
  const tried = new Set(triedStrategies || []);

  function isAvailable(strategyId) {
    return !tried.has(strategyId);
  }

  if (
    classification === "simple_chat" &&
    (String(prompt || "").trim().length < 60 ||
      /\b(salut|bonjour|hello|hi|hey|bonsoir)\b/i.test(prompt))
  ) {
    return null;
  }

  const steps = plan.steps || [];
  const hasKnowledge = steps.some((step) => step.type === "knowledge");
  const hasWeb = steps.some((step) => step.type === "web");
  const hasApi = steps.some((step) => step.type === "api");
  const hasBrowser = steps.some(
    (step) => step.type === "tool" && step.toolId === "browser_automation"
  );
  const llmCount = steps.filter((step) => step.type === "llm").length;

  if (
    isAvailable("targeted_revision") &&
    critique?.needsRetry &&
    critique?.improvementPrompt
  ) {
    return {
      id: "targeted_revision",
      label: "Targeted critique revision",
      apply(inputPlan) {
        const nextPlan = clonePlan(inputPlan);
        nextPlan.steps.push({
          id: nextStepId("llm_targeted", nextPlan.steps),
          type: "llm",
          provider: "llm:auto",
          modelKind:
            classification === "coding"
              ? "code"
              : ["reasoning", "compare", "complex_reasoning", "hybrid_task"].includes(classification)
                ? "reasoning"
                : "general",
          model: "",
          modelChain: [],
          purpose: "evolution_targeted_revision",
          instruction: critique.improvementPrompt,
          status: "pending"
        });
        return nextPlan;
      }
    };
  }

  if (
    isAvailable("knowledge_boost") &&
    !hasKnowledge &&
    (attachments.length || ["coding", "summarize", "compare"].includes(classification))
  ) {
    return {
      id: "knowledge_boost",
      label: "Add local knowledge retrieval",
      apply(inputPlan) {
        const nextPlan = clonePlan(inputPlan);
        nextPlan.steps.unshift({
          id: nextStepId("knowledge_boost", nextPlan.steps),
          type: "knowledge",
          toolId: "knowledge_search",
          provider: "local",
          capability: "knowledge_search",
          purpose: "evolution_knowledge_boost",
          status: "pending"
        });
        return nextPlan;
      }
    };
  }

  if (
    isAvailable("web_grounding_boost") &&
    !hasWeb &&
    ["compare", "complex_reasoning", "hybrid_task", "simple_chat"].includes(classification)
  ) {
    return {
      id: "web_grounding_boost",
      label: "Add web grounding",
      apply(inputPlan) {
        const nextPlan = clonePlan(inputPlan);
        nextPlan.webNeed = nextPlan.webNeed || {
          routeKey: "web/search",
          capability: "web_search",
          query: prompt,
          preferSummaries: true,
          implicit: true
        };
        const insertionIndex = nextPlan.steps.findIndex((step) => step.type === "llm");
        const webStep = {
          id: nextStepId("web_boost", nextPlan.steps),
          type: "web",
          provider: "web:auto",
          capability: "web_search",
          routeKey: "web/search",
          purpose: "evolution_web_grounding",
          status: "pending"
        };
        if (insertionIndex >= 0) {
          nextPlan.steps.splice(insertionIndex, 0, webStep);
        } else {
          nextPlan.steps.push(webStep);
        }
        return nextPlan;
      }
    };
  }

  if (
    isAvailable("api_grounding_boost") &&
    !hasApi &&
    ["data_lookup", "hybrid_task"].includes(classification)
  ) {
    return {
      id: "api_grounding_boost",
      label: "Add API grounding",
      apply(inputPlan) {
        const nextPlan = clonePlan(inputPlan);
        const insertionIndex = nextPlan.steps.findIndex((step) => step.type === "llm");
        const apiStep = {
          id: nextStepId("api_boost", nextPlan.steps),
          type: "api",
          provider: "api:auto",
          capability: nextPlan.apiNeed?.capability || "api_lookup",
          purpose: "evolution_api_grounding",
          status: "pending"
        };
        if (insertionIndex >= 0) {
          nextPlan.steps.splice(insertionIndex, 0, apiStep);
        } else {
          nextPlan.steps.push(apiStep);
        }
        return nextPlan;
      }
    };
  }

  if (
    isAvailable("browser_validation_boost") &&
    !hasBrowser &&
    (String(prompt || "").match(/https?:\/\//i) || (critique?.issues || []).includes("weak_grounding"))
  ) {
    return {
      id: "browser_validation_boost",
      label: "Add runtime browser validation",
      apply(inputPlan) {
        const nextPlan = clonePlan(inputPlan);
        const insertionIndex = nextPlan.steps.findIndex((step) => step.type === "llm");
        const browserStep = {
          id: nextStepId("browser_boost", nextPlan.steps),
          type: "tool",
          provider: "runtime-browser",
          toolId: "browser_automation",
          capability: "browser_inspect",
          purpose: "evolution_browser_validation",
          status: "pending",
          browserNeed: {
            action: "inspect",
            url: ""
          }
        };
        if (insertionIndex >= 0) {
          nextPlan.steps.splice(insertionIndex, 0, browserStep);
        } else {
          nextPlan.steps.push(browserStep);
        }
        return nextPlan;
      }
    };
  }

  if (isAvailable("reasoning_retry") && llmCount < 2) {
    return {
      id: "reasoning_retry",
      label: "Add secondary reasoning pass",
      apply(inputPlan) {
        const nextPlan = clonePlan(inputPlan);
        nextPlan.steps.push({
          id: nextStepId("llm_retry", nextPlan.steps),
          type: "llm",
          provider: "llm:auto",
          modelKind: classification === "coding" ? "code" : "reasoning",
          model: "",
          modelChain: [],
          purpose: "evolution_retry",
          instruction:
            "Retry with a more explicit structure, stronger grounding, and a clearer final recommendation.",
          status: "pending"
        });
        return nextPlan;
      }
    };
  }

  if (isAvailable("structured_retry") && (critique?.issues || []).includes("weak_grounding")) {
    return {
      id: "structured_retry",
      label: "Add structured response retry",
      apply(inputPlan) {
        const nextPlan = clonePlan(inputPlan);
        nextPlan.steps.push({
          id: nextStepId("llm_structured", nextPlan.steps),
          type: "llm",
          provider: "llm:auto",
          modelKind: "general",
          model: "",
          modelChain: [],
          purpose: "evolution_structured_retry",
          instruction:
            "Answer again with a direct recommendation, 3 supporting facts, and 1 caveat.",
          status: "pending"
        });
        return nextPlan;
      }
    };
  }

  return null;
}

export default {
  selectImprovementStrategy
};
