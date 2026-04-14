import config from "../../../config/hydria.config.js";
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

function normalizeMessageContent(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content.map(extractContentPart).join("\n").trim();
  }

  if (content && typeof content === "object") {
    return extractContentPart(content).trim();
  }

  return "";
}

function normalizeMessages(messages = []) {
  return messages
    .map((message) => ({
      role: message.role,
      content: normalizeMessageContent(message.content)
    }))
    .filter((message) => message.role && message.content);
}

function buildOpenAiCompatibleUrl() {
  const baseUrl = String(config.localLlm.baseUrl || "").replace(/\/+$/, "");

  if (baseUrl.endsWith("/chat/completions")) {
    return baseUrl;
  }

  if (baseUrl.endsWith("/v1")) {
    return `${baseUrl}/chat/completions`;
  }

  return `${baseUrl}/v1/chat/completions`;
}

function extractOpenAiCompatibleContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content.map(extractContentPart).join("\n").trim();
  }

  if (content && typeof content === "object") {
    return extractContentPart(content).trim();
  }

  return "";
}

function extractOllamaContent(payload) {
  const content = payload?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  return "";
}

async function callOllama(messages, options = {}) {
  const timeout = withTimeout(options.timeoutMs || config.localLlm.timeoutMs);

  try {
    const response = await fetch(`${config.localLlm.baseUrl.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        messages: normalizeMessages(messages),
        stream: false,
        options: {
          temperature: options.temperature ?? 0.2,
          num_predict: options.maxTokens ?? 900
        }
      }),
      signal: timeout.controller.signal
    });

    const rawBody = await response.text();
    const payload = parseJsonSafely(rawBody);

    if (!response.ok) {
      throw new Error(
        payload?.error || payload?.message || payload?.rawText || `Ollama returned ${response.status}`
      );
    }

    const content = extractOllamaContent(payload);
    if (!content) {
      throw new Error(`No content returned by local model ${options.model}`);
    }

    return {
      success: true,
      provider: "ollama",
      model: options.model,
      content,
      usage: {
        promptEvalCount: payload?.prompt_eval_count ?? null,
        evalCount: payload?.eval_count ?? null
      },
      finishReason: payload?.done_reason || null
    };
  } catch (error) {
    return {
      success: false,
      error: error.name === "AbortError" ? "Local LLM request timed out" : error.message
    };
  } finally {
    timeout.clear();
  }
}

async function callOpenAiCompatible(messages, options = {}) {
  const timeout = withTimeout(options.timeoutMs || config.localLlm.timeoutMs);

  try {
    const response = await fetch(buildOpenAiCompatibleUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.localLlm.apiKey
          ? {
              Authorization: `Bearer ${config.localLlm.apiKey}`
            }
          : {})
      },
      body: JSON.stringify({
        model: options.model,
        messages: normalizeMessages(messages),
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
          `Local OpenAI-compatible provider returned ${response.status}`
      );
    }

    const content = extractOpenAiCompatibleContent(payload);
    if (!content) {
      throw new Error(`No content returned by local model ${options.model}`);
    }

    return {
      success: true,
      provider: "local-openai-compatible",
      model: options.model,
      content,
      usage: payload?.usage || {},
      finishReason: payload?.choices?.[0]?.finish_reason || null
    };
  } catch (error) {
    return {
      success: false,
      error: error.name === "AbortError" ? "Local LLM request timed out" : error.message
    };
  } finally {
    timeout.clear();
  }
}

export async function callLocalModel(messages, options = {}) {
  if (!config.localLlm.enabled) {
    return {
      success: false,
      error: "Local LLM provider is not enabled."
    };
  }

  const providerType = config.localLlm.providerType;

  if (providerType === "ollama") {
    const result = await callOllama(messages, options);
    if (!result.success) {
      logger.warn("Local Ollama call failed", {
        model: options.model,
        error: result.error
      });
    }
    return result;
  }

  const result = await callOpenAiCompatible(messages, options);
  if (!result.success) {
    logger.warn("Local OpenAI-compatible call failed", {
      model: options.model,
      error: result.error
    });
  }
  return result;
}
