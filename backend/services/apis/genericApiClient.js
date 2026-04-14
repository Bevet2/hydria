import config from "../../config/hydria.config.js";
import { ExternalServiceError } from "../../utils/errors.js";

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

function buildUrl(apiDefinition, path = "", params = {}) {
  const rawUrl = (() => {
    if (!path) {
      return new URL(apiDefinition.baseUrl);
    }

    if (/\/https?:\/\/$/i.test(apiDefinition.baseUrl)) {
      return new URL(`${apiDefinition.baseUrl}${path.replace(/^\//, "")}`);
    }

    return new URL(path.replace(/^\//, ""), `${apiDefinition.baseUrl.replace(/\/?$/, "/")}`);
  })();

  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") {
      rawUrl.searchParams.set(key, String(value));
    }
  }

  return rawUrl;
}

function injectAuth(apiDefinition, url, headers) {
  if (apiDefinition.authType === "none") {
    return;
  }

  const envValue = process.env[apiDefinition.envKey || ""];
  if (!envValue) {
    throw new ExternalServiceError(
      `Missing configuration for ${apiDefinition.name}`,
      apiDefinition.id,
      503
    );
  }

  if (apiDefinition.authType === "bearer") {
    headers.Authorization = `Bearer ${envValue}`;
    return;
  }

  const location = apiDefinition.authLocation || "query";
  if (location === "header") {
    headers[apiDefinition.authHeaderName || "x-api-key"] = envValue;
    return;
  }

  url.searchParams.set(apiDefinition.authParamName || "api_key", envValue);
}

export async function requestJson(
  apiDefinition,
  { path = "", params = {}, headers = {}, method = "GET" } = {}
) {
  const requestHeaders = {
    Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    "User-Agent": `${config.appName}/1.0`,
    ...headers
  };
  const url = buildUrl(apiDefinition, path, params);

  injectAuth(apiDefinition, url, requestHeaders);

  const timeout = withTimeout(config.strategy.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      signal: timeout.controller.signal
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const parsed =
      contentType.includes("application/json") && text
        ? JSON.parse(text)
        : text;

    if (!response.ok) {
      throw new ExternalServiceError(
        `${apiDefinition.name} returned ${response.status}`,
        apiDefinition.id,
        response.status,
        parsed
      );
    }

    return parsed;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ExternalServiceError(
        `${apiDefinition.name} timed out`,
        apiDefinition.id,
        504
      );
    }

    if (error instanceof ExternalServiceError) {
      throw error;
    }

    throw new ExternalServiceError(
      error.message || `Request failed for ${apiDefinition.name}`,
      apiDefinition.id,
      502
    );
  } finally {
    timeout.clear();
  }
}

export async function requestText(
  apiDefinition,
  { path = "", params = {}, headers = {}, method = "GET" } = {}
) {
  const requestHeaders = {
    Accept: "text/plain, text/html, application/json;q=0.8, */*;q=0.6",
    "User-Agent": `${config.appName}/1.0`,
    ...headers
  };
  const url = buildUrl(apiDefinition, path, params);

  injectAuth(apiDefinition, url, requestHeaders);

  const timeout = withTimeout(config.strategy.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      signal: timeout.controller.signal
    });

    const text = await response.text();

    if (!response.ok) {
      throw new ExternalServiceError(
        `${apiDefinition.name} returned ${response.status}`,
        apiDefinition.id,
        response.status,
        text
      );
    }

    return text;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ExternalServiceError(
        `${apiDefinition.name} timed out`,
        apiDefinition.id,
        504
      );
    }

    if (error instanceof ExternalServiceError) {
      throw error;
    }

    throw new ExternalServiceError(
      error.message || `Request failed for ${apiDefinition.name}`,
      apiDefinition.id,
      502
    );
  } finally {
    timeout.clear();
  }
}
