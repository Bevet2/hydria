import { createHash } from "node:crypto";
import config from "../../config/hydria.config.js";
import {
  AppError,
  ConfigurationError,
  ExternalServiceError
} from "../../utils/errors.js";

function withTimeout(timeoutMs, externalSignal = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  return {
    controller,
    clear() {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    }
  };
}

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export function isHydriaUuid(value = "") {
  return UUID_PATTERN.test(String(value || "").trim());
}

function stableUuidFromText(value = "") {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const chars = createHash("sha256").update(text).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function normalizeHydriaSessionId(value = "") {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return isHydriaUuid(text) ? text : stableUuidFromText(text);
}

function parseJsonMaybe(text, contentType) {
  if (!text) {
    return null;
  }

  if (!contentType.includes("application/json")) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractStreamText(payload) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";
  return [
    payload.delta,
    payload.token,
    payload.text,
    payload.content,
    payload.answer,
    payload.message?.content,
    payload.result?.delta,
    payload.result?.text,
    payload.result?.answer,
    payload.choices?.[0]?.delta?.content,
    payload.choices?.[0]?.message?.content
  ].find((value) => typeof value === "string") || "";
}

function parseStreamLine(line = "") {
  const value = String(line || "").trim();
  if (!value || value.startsWith(":") || value === "[DONE]") return null;
  const source = value.startsWith("data:") ? value.slice(5).trim() : value;
  if (!source || source === "[DONE]") return null;
  try {
    return JSON.parse(source);
  } catch {
    return source;
  }
}

function assertConfigured() {
  if (!config.externalHydria.enabled || !config.externalHydria.apiKey) {
    throw new ConfigurationError("Hydria external API key is not configured.");
  }
}

function endpointSummary(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

function urlWithQuery(rawUrl, query = {}) {
  const url = new URL(rawUrl);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function requestHydria(
  url,
  { method = "GET", body = null, timeoutMs = null, signal = null } = {}
) {
  assertConfigured();

  const timeout = withTimeout(timeoutMs || config.externalHydria.timeoutMs, signal);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${config.externalHydria.apiKey}`
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: timeout.controller.signal
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const parsed = parseJsonMaybe(text, contentType);

    if (!response.ok) {
      throw new ExternalServiceError(
        `Hydria external API returned ${response.status}`,
        "hydria_external",
        response.status,
        parsed
      );
    }

    return parsed;
  } catch (error) {
    if (error.name === "AbortError") {
      if (signal?.aborted) {
        throw new AppError("Hydria generation was stopped.", 499);
      }
      throw new ExternalServiceError(
        "Hydria external API timed out",
        "hydria_external",
        504
      );
    }

    if (error instanceof ExternalServiceError || error instanceof ConfigurationError) {
      throw error;
    }

    throw new ExternalServiceError(
      error.message || "Hydria external API request failed",
      "hydria_external",
      502
    );
  } finally {
    timeout.clear();
  }
}

export function getExternalHydriaStatus() {
  return {
    configured: config.externalHydria.enabled,
    askEndpoint: endpointSummary(config.externalHydria.apiUrl),
    coreAskEndpoint: endpointSummary(config.externalHydria.coreAskUrl),
    coreStreamEndpoint: endpointSummary(config.externalHydria.coreStreamUrl),
    capabilitiesEndpoint: endpointSummary(config.externalHydria.capabilitiesUrl),
    interactionsEndpoint: endpointSummary(config.externalHydria.interactionsUrl)
  };
}

export async function askExternalHydria({
  input,
  options = {},
  workspaceContext = null,
  sessionId = "",
  userId = "",
  projectId = "",
  metadata = null,
  timeoutMs = null
} = {}) {
  const normalizedInput = String(input || "").trim();

  if (!normalizedInput) {
    throw new AppError("Hydria external API input is required.", 400);
  }

  const body = {
    input: normalizedInput,
    options: options && typeof options === "object" ? options : {}
  };

  if (workspaceContext && typeof workspaceContext === "object") {
    body.workspaceContext = workspaceContext;
  }
  const normalizedSessionId = normalizeHydriaSessionId(sessionId);
  if (normalizedSessionId) {
    body.sessionId = normalizedSessionId;
  }
  if (userId) {
    body.userId = String(userId);
  }
  if (projectId) {
    body.projectId = String(projectId);
  }
  if (metadata && typeof metadata === "object") {
    body.metadata = metadata;
  }

  return requestHydria(config.externalHydria.apiUrl, {
    method: "POST",
    timeoutMs,
    body
  });
}

export async function askExternalHydriaCore({
  question,
  system = "",
  sessionId = "",
  mode = "chat",
  timeoutMs = null,
  signal = null
} = {}) {
  const normalizedQuestion = String(question || "").trim();

  if (!normalizedQuestion) {
    throw new AppError("Hydria Core question is required.", 400);
  }

  const body = {
    mode,
    question: normalizedQuestion
  };

  if (system) {
    body.system = String(system).slice(0, 4000);
  }

  const normalizedSessionId = normalizeHydriaSessionId(sessionId);
  if (normalizedSessionId) {
    body.sessionId = normalizedSessionId;
  }

  return requestHydria(config.externalHydria.coreAskUrl, {
    method: "POST",
    timeoutMs,
    signal,
    body
  });
}

export async function streamExternalHydriaCore({
  question,
  system = "",
  sessionId = "",
  mode = "chat",
  timeoutMs = null,
  signal = null,
  onChunk = () => {}
} = {}) {
  assertConfigured();
  const normalizedQuestion = String(question || "").trim();
  if (!normalizedQuestion) {
    throw new AppError("Hydria Core question is required.", 400);
  }

  const body = {
    mode,
    question: normalizedQuestion,
    stream: true
  };
  if (system) body.system = String(system).slice(0, 4000);
  const normalizedSessionId = normalizeHydriaSessionId(sessionId);
  if (normalizedSessionId) body.sessionId = normalizedSessionId;

  const timeout = withTimeout(timeoutMs || config.externalHydria.timeoutMs, signal);
  try {
    const response = await fetch(config.externalHydria.coreStreamUrl, {
      method: "POST",
      headers: {
        Accept: "text/event-stream, application/x-ndjson, application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.externalHydria.apiKey}`
      },
      body: JSON.stringify(body),
      signal: timeout.controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ExternalServiceError(
        `Hydria external API returned ${response.status}`,
        "hydria_external",
        response.status,
        parseJsonMaybe(text, response.headers.get("content-type") || "")
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (!response.body || contentType.includes("application/json")) {
      const text = await response.text();
      return {
        nativeStream: false,
        result: parseJsonMaybe(text, contentType),
        answer: ""
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let finalAnswer = "";
    let finalPayload = null;
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        const parsed = parseStreamLine(line);
        if (parsed === null) continue;
        if (parsed && typeof parsed === "object") {
          const eventType = String(parsed.type || parsed.event || "").toLowerCase();
          if (eventType === "error") {
            throw new ExternalServiceError(
              parsed.error || "Hydria Core streaming failed",
              "hydria_external",
              502,
              parsed
            );
          }
          if (eventType === "final" || eventType === "done") {
            finalPayload = parsed.result || parsed.response || parsed;
            finalAnswer = extractStreamText(parsed) || extractStreamText(finalPayload);
            continue;
          }
          finalPayload = parsed;
        }
        const chunk = extractStreamText(parsed);
        if (!chunk) continue;
        if (answer && chunk.startsWith(answer)) {
          const delta = chunk.slice(answer.length);
          if (delta) {
            answer += delta;
            onChunk(delta, parsed);
          }
        } else {
          answer += chunk;
          onChunk(chunk, parsed);
        }
      }
      if (done) break;
    }
    const tail = parseStreamLine(buffer);
    if (tail !== null) {
      if (tail && typeof tail === "object") finalPayload = tail;
      const eventType =
        tail && typeof tail === "object"
          ? String(tail.type || tail.event || "").toLowerCase()
          : "";
      if (eventType === "final" || eventType === "done") {
        finalPayload = tail.result || tail.response || tail;
        finalAnswer = extractStreamText(tail) || extractStreamText(finalPayload);
      }
      const chunk = eventType === "final" || eventType === "done" ? "" : extractStreamText(tail);
      if (chunk) {
        answer += chunk;
        onChunk(chunk, tail);
      }
    }
    return {
      nativeStream: true,
      result: finalPayload,
      answer: finalAnswer || answer
    };
  } catch (error) {
    if (error.name === "AbortError") {
      if (signal?.aborted) throw new AppError("Hydria generation was stopped.", 499);
      throw new ExternalServiceError(
        "Hydria external API timed out",
        "hydria_external",
        504
      );
    }
    if (
      error instanceof ExternalServiceError ||
      error instanceof ConfigurationError ||
      error instanceof AppError
    ) {
      throw error;
    }
    throw new ExternalServiceError(
      error.message || "Hydria external API streaming request failed",
      "hydria_external",
      502
    );
  } finally {
    timeout.clear();
  }
}

export async function getExternalHydriaCapabilities() {
  return requestHydria(config.externalHydria.capabilitiesUrl);
}

export async function listExternalHydriaInteractions({
  sessionId = "",
  scope = "",
  limit = 100,
  timeoutMs = null
} = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number.parseInt(String(limit || 100), 10) || 100));
  return requestHydria(urlWithQuery(config.externalHydria.interactionsUrl, {
    sessionId: normalizeHydriaSessionId(sessionId),
    scope: String(scope || "").trim(),
    limit: safeLimit
  }), { timeoutMs });
}

export default {
  askExternalHydria,
  askExternalHydriaCore,
  streamExternalHydriaCore,
  getExternalHydriaCapabilities,
  getExternalHydriaStatus,
  isHydriaUuid,
  listExternalHydriaInteractions,
  normalizeHydriaSessionId
};
