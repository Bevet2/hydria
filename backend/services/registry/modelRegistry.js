import config from "../../config/hydria.config.js";

function uniqueTargets(values) {
  return [
    ...new Map(
      values
        .filter((value) => value?.provider && value?.model)
        .map((value) => [`${value.provider}:${value.model}`, value])
    ).values()
  ];
}

function localTarget(model) {
  return {
    provider: "local",
    model
  };
}

function openRouterTarget(model) {
  return {
    provider: "openrouter",
    model
  };
}

function isPremiumKind(kind = "general") {
  return [
    "premium_general",
    "premium_reasoning",
    "premium_code",
    "premium_fast",
    "premium_agent",
    "creative"
  ].includes(String(kind || "").toLowerCase());
}

function fallbackLocalKindForPremium(kind = "general") {
  switch (String(kind || "").toLowerCase()) {
    case "premium_code":
      return "code";
    case "premium_reasoning":
      return "reasoning";
    case "premium_fast":
      return "fast";
    case "premium_agent":
      return "agent";
    case "creative":
    case "premium_general":
    default:
      return "general";
  }
}

function getProviderOrder() {
  switch (config.llm.routingMode) {
    case "local-only":
      return ["local"];
    case "openrouter-only":
      return ["openrouter"];
    case "openrouter-first":
      return ["openrouter", "local"];
    case "local-first":
    default:
      return ["local", "openrouter"];
  }
}

function getLocalChain(kind = "general") {
  if (!config.localLlm.enabled) {
    return [];
  }

  switch (kind) {
    case "fast":
      return uniqueTargets([
        localTarget(config.localLlm.models.fast),
        localTarget(config.localLlm.models.general),
        localTarget(config.localLlm.models.fallback)
      ]);
    case "code":
      return uniqueTargets([
        localTarget(config.localLlm.models.code),
        localTarget(config.localLlm.models.general),
        localTarget(config.localLlm.models.fallback)
      ]);
    case "reasoning":
      return uniqueTargets([
        localTarget(config.localLlm.models.reasoning),
        localTarget(config.localLlm.models.general),
        localTarget(config.localLlm.models.fallback)
      ]);
    case "agent":
      return uniqueTargets([
        localTarget(config.localLlm.models.agent),
        localTarget(config.localLlm.models.reasoning),
        localTarget(config.localLlm.models.general),
        localTarget(config.localLlm.models.fallback)
      ]);
    case "general":
    default:
      return uniqueTargets([
        localTarget(config.localLlm.models.general),
        localTarget(config.localLlm.models.default),
        localTarget(config.localLlm.models.fallback)
      ]);
  }
}

function getOpenRouterChain(kind = "general") {
  if (!config.openrouter.enabled) {
    return [];
  }

  switch (kind) {
    case "creative":
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.premiumCreative),
        openRouterTarget(config.openrouter.models.premiumGeneral),
        openRouterTarget(config.openrouter.models.premiumReasoning),
        openRouterTarget(config.openrouter.models.freeGeneral),
        openRouterTarget(config.openrouter.models.defaultFree),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
    case "premium_fast":
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.premiumFast),
        openRouterTarget(config.openrouter.models.premiumGeneral),
        openRouterTarget(config.openrouter.models.premiumReasoning),
        openRouterTarget(config.openrouter.models.freeFast),
        openRouterTarget(config.openrouter.models.defaultFree),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
    case "premium_code":
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.premiumCode),
        openRouterTarget(config.openrouter.models.premiumGeneral),
        openRouterTarget(config.openrouter.models.premiumReasoning),
        openRouterTarget(config.openrouter.models.freeCode),
        openRouterTarget(config.openrouter.models.defaultFree),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
    case "premium_reasoning":
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.premiumReasoning),
        openRouterTarget(config.openrouter.models.premiumGeneral),
        openRouterTarget(config.openrouter.models.premiumCreative),
        openRouterTarget(config.openrouter.models.freeReasoning),
        openRouterTarget(config.openrouter.models.defaultFree),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
    case "premium_agent":
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.premiumAgent),
        openRouterTarget(config.openrouter.models.premiumReasoning),
        openRouterTarget(config.openrouter.models.premiumCreative),
        openRouterTarget(config.openrouter.models.freeAgent),
        openRouterTarget(config.openrouter.models.defaultFree),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
    case "premium_general":
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.premiumGeneral),
        openRouterTarget(config.openrouter.models.premiumReasoning),
        openRouterTarget(config.openrouter.models.premiumCreative),
        openRouterTarget(config.openrouter.models.freeGeneral),
        openRouterTarget(config.openrouter.models.defaultFree),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
    case "fast":
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.freeFast),
        openRouterTarget(config.openrouter.models.freeGeneral),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
    case "code":
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.freeCode),
        openRouterTarget(config.openrouter.models.freeGeneral),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
    case "reasoning":
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.freeReasoning),
        openRouterTarget(config.openrouter.models.freeGeneral),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
    case "agent":
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.freeAgent),
        openRouterTarget(config.openrouter.models.freeReasoning),
        openRouterTarget(config.openrouter.models.freeGeneral),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
    case "general":
    default:
      return uniqueTargets([
        openRouterTarget(config.openrouter.models.freeGeneral),
        openRouterTarget(config.openrouter.models.defaultFree),
        openRouterTarget(config.openrouter.models.fallback)
      ]);
  }
}

export function getModelChain(kind = "general", overrideModel = "") {
  if (overrideModel) {
    return [
      ...new Set(
        [overrideModel, config.openrouter.models.fallback].filter(Boolean)
      )
    ];
  }

  return getOpenRouterChain(kind).map((target) => target.model);
}

export function getProviderModelChain(kind = "general", override = null) {
  if (override?.provider && override?.model) {
    const fallbackChain = getProviderModelChain(kind);
    return uniqueTargets([override, ...fallbackChain]);
  }

  if (isPremiumKind(kind)) {
    return uniqueTargets([
      ...getOpenRouterChain(kind),
      ...getLocalChain(fallbackLocalKindForPremium(kind))
    ]);
  }

  const targets = [];
  for (const provider of getProviderOrder()) {
    if (provider === "local") {
      targets.push(...getLocalChain(kind));
      continue;
    }

    if (provider === "openrouter") {
      targets.push(...getOpenRouterChain(kind));
    }
  }

  return uniqueTargets(targets);
}

export function getPrimaryModelTarget(kind = "general", override = null) {
  return getProviderModelChain(kind, override)[0] || null;
}

export function getPrimaryModel(kind = "general", override = null) {
  return getPrimaryModelTarget(kind, override)?.model || "";
}

export function getPublicModelRegistry() {
  return {
    llmConfigured: config.llm.enabled,
    routingMode: config.llm.routingMode,
    primaryProvider: getPrimaryModelTarget("general")?.provider || "none",
    localConfigured: config.localLlm.enabled,
    localProviderType: config.localLlm.providerType,
    localBaseUrl: config.localLlm.baseUrl,
    localModelsDir: config.localLlm.modelsDir,
    localDefault: config.localLlm.models.default,
    localGeneral: config.localLlm.models.general,
    localCode: config.localLlm.models.code,
    localReasoning: config.localLlm.models.reasoning,
    localFast: config.localLlm.models.fast,
    localAgent: config.localLlm.models.agent,
    defaultFree: config.openrouter.models.defaultFree,
    fallback: config.openrouter.models.fallback,
    freeGeneral: config.openrouter.models.freeGeneral,
    freeCode: config.openrouter.models.freeCode,
    freeReasoning: config.openrouter.models.freeReasoning,
    freeFast: config.openrouter.models.freeFast,
    freeAgent: config.openrouter.models.freeAgent,
    premiumGeneral: config.openrouter.models.premiumGeneral,
    premiumReasoning: config.openrouter.models.premiumReasoning,
    premiumCode: config.openrouter.models.premiumCode,
    premiumCreative: config.openrouter.models.premiumCreative,
    premiumFast: config.openrouter.models.premiumFast,
    premiumAgent: config.openrouter.models.premiumAgent,
    openrouterConfigured: config.openrouter.enabled
  };
}
