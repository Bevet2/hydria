import { createHash } from "node:crypto";
import config from "../../config/hydria.config.js";
import {
  AppError,
  ConfigurationError,
  ExternalServiceError
} from "../../utils/errors.js";

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

async function requestHydria(url, { method = "GET", body = null, timeoutMs = null } = {}) {
  assertConfigured();

  const timeout = withTimeout(timeoutMs || config.externalHydria.timeoutMs);

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
  timeoutMs = null
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
    body
  });
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
  getExternalHydriaCapabilities,
  getExternalHydriaStatus,
  isHydriaUuid,
  listExternalHydriaInteractions,
  normalizeHydriaSessionId
};
