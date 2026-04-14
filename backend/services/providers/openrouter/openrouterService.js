import config from "../../../config/hydria.config.js";
import { getModelChain } from "../../registry/modelRegistry.js";
import logger from "../../../utils/logger.js";

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    controller,
    clear() {
      clearTimeout(timeout);
    }
  };
}

function parseJsonSafely(rawText) {
  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return {
      rawText
    };
  }
}

function extractContentPart(part) {
  if (!part) {
    return "";
  }

  if (typeof part === "string") {
    return part;
  }

  if (typeof part.text === "string") {
    return part.text;
  }

  if (typeof part.content === "string") {
    return part.content;
  }

  return "";
}

function extractMessageContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map(extractContentPart)
      .join("\n")
      .trim();
  }

  if (content && typeof content === "object") {
    return extractContentPart(content).trim();
  }

  return "";
}

async function callModel(messages, options = {}) {
  if (!config.openrouter.enabled) {
    return {
      success: false,
      error:
        "OpenRouter is not configured. Set OPENROUTER_API_KEY in backend/.env to enable LLM routing."
    };
  }

  const modelChain = options.modelChain?.length
    ? options.modelChain
    : getModelChain(options.kind || "general", options.model);
  const attempts = [];

  for (const model of modelChain) {
    const timeout = withTimeout(config.strategy.requestTimeoutMs);

    try {
      const response = await fetch(config.openrouter.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openrouter.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": config.openrouter.referer,
          "X-Title": config.appName
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 900
        }),
        signal: timeout.controller.signal
      });

      const rawBody = await response.text();
      const payload = parseJsonSafely(rawBody);
      if (!response.ok) {
        throw new Error(
          payload?.error?.message ||
            payload?.message ||
            payload?.rawText ||
            `OpenRouter returned ${response.status}`
        );
      }

      const content = extractMessageContent(payload);
      if (!content) {
        throw new Error(`No content returned by model ${model}`);
      }

      return {
        success: true,
        provider: "openrouter",
        model,
        content,
        usage: payload.usage || {},
        finishReason: payload?.choices?.[0]?.finish_reason || null,
        attempts
      };
    } catch (error) {
      attempts.push({
        model,
        error: error.name === "AbortError" ? "Request timed out" : error.message
      });
      logger.warn("OpenRouter fallback triggered", {
        model,
        error: attempts[attempts.length - 1].error
      });
    } finally {
      timeout.clear();
    }
  }

  return {
    success: false,
    error: "All configured OpenRouter models failed.",
    attempts
  };
}

export function callChatModel(messages, options = {}) {
  return callModel(messages, {
    ...options,
    kind: "general",
    modelChain: options.modelChain || getModelChain("general", options.model),
    maxTokens: options.maxTokens ?? 950
  });
}

export function callReasoningModel(messages, options = {}) {
  return callModel(messages, {
    ...options,
    kind: "reasoning",
    modelChain: options.modelChain || getModelChain("reasoning", options.model),
    temperature: options.temperature ?? 0.15,
    maxTokens: options.maxTokens ?? 1200
  });
}

export function callCodeModel(messages, options = {}) {
  return callModel(messages, {
    ...options,
    kind: "code",
    modelChain: options.modelChain || getModelChain("code", options.model),
    temperature: options.temperature ?? 0.1,
    maxTokens: options.maxTokens ?? 1200
  });
}
