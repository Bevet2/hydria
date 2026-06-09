import config from "../../../config/hydria.config.js";

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
      role: String(message?.role || "user").trim() || "user",
      content: normalizeMessageContent(message?.content)
    }))
    .filter((message) => message.content);
}

function compact(value = "", maxChars = config.hydriaCore.maxInputChars) {
  const normalized = String(value || "").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 120)).trim()}\n\n[Hydria OS truncated ${normalized.length - maxChars} chars before sending to Hydria Core]`;
}

function messagesToHydriaCoreInput(messages = [], options = {}) {
  const normalized = normalizeMessages(messages);
  const content = normalized
    .map((message) => {
      const role = message.role.toUpperCase();
      return `[${role}]\n${message.content}`;
    })
    .join("\n\n");

  return compact(
    [
      "Hydria OS is calling Hydria Core as its governed cognitive engine.",
      "Use all workspace, project, file, attachment, tool and memory context included below.",
      "Return only the user-facing answer needed by the calling OS step. Do not claim that you executed workspace changes unless the provided context proves execution happened.",
      options.kind ? `Requested reasoning kind: ${options.kind}` : "",
      content
    ]
      .filter(Boolean)
      .join("\n\n")
  );
}

function buildAskUrl() {
  const baseUrl = String(config.hydriaCore.baseUrl || "").replace(/\/+$/, "");
  return baseUrl.endsWith("/ask") ? baseUrl : `${baseUrl}/ask`;
}

export function isHydriaCoreConfigured() {
  return Boolean(config.hydriaCore.enabled && config.hydriaCore.baseUrl && config.hydriaCore.apiKey);
}

export async function callHydriaCoreModel(messages = [], options = {}) {
  if (!config.hydriaCore.enabled) {
    return {
      success: false,
      error: "Hydria Core provider is disabled. Set HYDRIA_CORE_ENABLED=true."
    };
  }

  if (!config.hydriaCore.apiKey) {
    return {
      success: false,
      error: "Hydria Core provider is missing HYDRIA_CORE_API_KEY."
    };
  }

  const timeout = withTimeout(options.timeoutMs || config.hydriaCore.timeoutMs);

  try {
    const response = await fetch(buildAskUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.hydriaCore.apiKey}`
      },
      body: JSON.stringify({
        input: messagesToHydriaCoreInput(messages, options),
        options: {
          includeSources: config.hydriaCore.includeSources,
          includeTrace: config.hydriaCore.includeTrace,
          includeDiagnostics: config.hydriaCore.includeDiagnostics
        },
        metadata: {
          source: "hydria-os",
          adapter: "hydria-core-provider-v1",
          kind: options.kind || "general",
          requestedModel: options.model || null
        }
      }),
      signal: timeout.controller.signal
    });

    const rawBody = await response.text();
    const payload = parseJsonSafely(rawBody);

    if (!response.ok) {
      throw new Error(
        payload?.error ||
          payload?.message ||
          payload?.rawText ||
          `Hydria Core returned ${response.status}`
      );
    }

    const content = String(payload?.answer || "").trim();
    if (!content) {
      throw new Error("Hydria Core returned no answer content.");
    }

    return {
      success: true,
      provider: "hydria-core",
      model: payload?.models?.model || options.model || "hydria-core-v1",
      content,
      usage: {
        durationMs: payload?.quality?.durationMs ?? null,
        confidence: payload?.confidence ?? null,
        sourceCount: payload?.tools?.sourceCount ?? payload?.sources?.length ?? 0
      },
      finishReason: null,
      raw: {
        id: payload?.id || null,
        sessionId: payload?.sessionId || null,
        category: payload?.category || null,
        language: payload?.language || null,
        tools: payload?.tools || null,
        quality: payload?.quality || null
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.name === "AbortError" ? "Hydria Core request timed out" : error.message
    };
  } finally {
    timeout.clear();
  }
}
