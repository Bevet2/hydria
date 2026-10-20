import fs from "node:fs";
import crypto from "node:crypto";
import config from "../../config/hydria.config.js";
import { AppError } from "../../utils/errors.js";

export const CRM_WORKSPACE_TOOLS = Object.freeze(JSON.parse(fs.readFileSync(
  new URL("../../../crm/apps/api/crm-workspace-tools.json", import.meta.url), "utf8"
)));


function compact(value = "", maxChars = 3000) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trim()}...`;
}

function signatureFor(timestamp, serializedBody) {
  return crypto
    .createHmac("sha256", config.crm.integrationSecret)
    .update(`${timestamp}.${serializedBody}`)
    .digest("hex");
}

async function crmRequest(path, { method = "GET", body = null, signed = false } = {}) {
  const serializedBody = body === null ? "" : JSON.stringify(body);
  const headers = {
    accept: "application/json"
  };
  if (body !== null) {
    headers["content-type"] = "application/json";
  }
  if (signed) {
    if (!config.crm.integrationSecret) throw new AppError("CRM integration secret is not configured.", 503);
    const timestamp = String(Date.now());
    headers["x-hydria-timestamp"] = timestamp;
    headers["x-hydria-signature"] = signatureFor(timestamp, serializedBody);
  }

  let response;
  try {
    response = await fetch(`${config.crm.apiUrl}${path}`, {
      method,
      headers,
      body: body === null ? undefined : serializedBody,
      signal: AbortSignal.timeout(config.crm.timeoutMs)
    });
  } catch (error) {
    throw new AppError(`CRM API is unavailable: ${error.message}`, 503);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(payload.error || `CRM API request failed (${response.status})`, response.status);
  }
  return payload;
}

function userIdentity(user = {}) {
  if (!user?.id) {
    throw new AppError("A valid Hydria user is required for CRM access.", 400);
  }
  return {
    hydriaUserId: String(user.id),
    username: compact(user.username || `Hydria user ${user.id}`, 120)
  };
}

export async function getCrmStatus() {
  try {
    const result = await crmRequest("/health");
    return {
      available: result.status === "ok",
      apiUrl: config.crm.publicApiUrl,
      webUrl: config.crm.webUrl,
      service: result.service || "hydria-crm"
    };
  } catch (error) {
    return {
      available: false,
      apiUrl: config.crm.publicApiUrl,
      webUrl: config.crm.webUrl,
      error: error.message
    };
  }
}

export function createCrmLiveWorkObject({ contentPreview = "" } = {}) {
  return {
    id: "crm-live",
    title: "Hydria CRM",
    kind: "app",
    objectKind: "app",
    workspaceFamilyId: "crm_sales",
    primaryFile: "crm://live",
    activeEntryPath: "crm://live",
    metadata: {
      workspaceFamilyId: "crm_sales",
      liveAdapter: "northstar_crm"
    },
    contentPreview
  };
}

export async function createCrmSession(user) {
  return crmRequest("/integrations/hydria/session", {
    method: "POST",
    body: userIdentity(user),
    signed: true
  });
}

export async function getCrmWorkspaceContext(user) {
  const payload = await crmRequest("/integrations/hydria/context", {
    method: "POST",
    body: userIdentity(user),
    signed: true
  });
  return {
    ...payload,
    contentPreview: JSON.stringify(payload.context || {}, null, 2)
  };
}

export async function queryCrmWorkspace(user, { resource, search = "", recordId, limit = 25 } = {}) {
  return crmRequest("/integrations/hydria/query", {
    method: "POST",
    body: {
      ...userIdentity(user),
      resource,
      search: compact(search, 300),
      ...(recordId ? { recordId } : {}),
      limit
    },
    signed: true
  });
}

export async function executeCrmWorkspaceToolCalls({
  calls = [],
  user,
  prompt = "",
  confirmed = false
} = {}) {
  if (!calls.length) {
    return { executed: 0, results: [] };
  }

  const payload = await crmRequest("/integrations/hydria/actions", {
    method: "POST",
    body: {
      ...userIdentity(user),
      prompt: compact(prompt, 4000),
      confirmed,
      workspaceToolCalls: calls
    },
    signed: true
  });
  const results = Array.isArray(payload.results) ? payload.results : [];
  return {
    executed: results.filter((result) => result.status === "completed").length,
    results
  };
}

export default {
  CRM_WORKSPACE_TOOLS,
  createCrmLiveWorkObject,
  createCrmSession,
  executeCrmWorkspaceToolCalls,
  getCrmStatus,
  getCrmWorkspaceContext,
  queryCrmWorkspace
};
