import config from "../../../config/hydria.config.js";
import logger from "../../../utils/logger.js";
import { getPrimaryModelTarget, getProviderModelChain } from "../../registry/modelRegistry.js";
import { callLocalModel } from "../local/localLlmService.js";
import {
  callChatModel as callOpenRouterChatModel,
  callCodeModel as callOpenRouterCodeModel,
  callReasoningModel as callOpenRouterReasoningModel
} from "../openrouter/openrouterService.js";

function normalizeTargetChain(kind = "general", options = {}) {
  if (Array.isArray(options.modelChain) && options.modelChain.length) {
    return options.modelChain
      .map((target) => {
        if (target?.provider && target?.model) {
          return target;
        }

        if (typeof target === "string") {
          return {
            provider: options.provider || getPrimaryModelTarget(kind)?.provider || "openrouter",
            model: target
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  if (options.model) {
    return getProviderModelChain(kind, {
      provider: options.provider || getPrimaryModelTarget(kind)?.provider || "openrouter",
      model: options.model
    });
  }

  return getProviderModelChain(kind);
}

async function callOpenRouter(kind, messages, target, options = {}) {
  const requestOptions = {
    ...options,
    model: target.model,
    modelChain: [target.model]
  };

  switch (kind) {
    case "code":
      return callOpenRouterCodeModel(messages, requestOptions);
    case "reasoning":
    case "agent":
      return callOpenRouterReasoningModel(messages, requestOptions);
    case "general":
    case "fast":
    default:
      return callOpenRouterChatModel(messages, requestOptions);
  }
}

async function callTarget(kind, messages, target, options = {}) {
  if (target.provider === "local") {
    return callLocalModel(messages, {
      ...options,
      model: target.model
    });
  }

  return callOpenRouter(kind, messages, target, options);
}

async function callModel(kind, messages, options = {}) {
  if (!config.llm.enabled) {
    return {
      success: false,
      error: "No LLM provider is configured. Enable a local model or configure OpenRouter."
    };
  }

  const targetChain = normalizeTargetChain(kind, options);
  const attempts = [];

  for (const target of targetChain) {
    const result = await callTarget(kind, messages, target, options);
    if (result.success) {
      return {
        ...result,
        attempts
      };
    }

    const attempt = {
      provider: target.provider,
      model: target.model,
      error: result.error || "Unknown LLM provider error"
    };
    attempts.push(attempt);
    logger.warn("LLM route fallback triggered", attempt);
  }

  return {
    success: false,
    error: "All configured LLM providers failed.",
    attempts
  };
}

export function callChatModel(messages, options = {}) {
  return callModel("general", messages, {
    ...options,
    maxTokens: options.maxTokens ?? 950
  });
}

export function callReasoningModel(messages, options = {}) {
  return callModel("reasoning", messages, {
    ...options,
    temperature: options.temperature ?? 0.15,
    maxTokens: options.maxTokens ?? 1200
  });
}

export function callCodeModel(messages, options = {}) {
  return callModel("code", messages, {
    ...options,
    temperature: options.temperature ?? 0.1,
    maxTokens: options.maxTokens ?? 1200
  });
}
