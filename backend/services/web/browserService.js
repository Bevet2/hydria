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

export async function fetchPage(url, { headers = {} } = {}) {
  if (!config.web.enableBrowserFetch) {
    throw new ExternalServiceError(
      "Browser fetch fallback is disabled.",
      "browser_fetch",
      503
    );
  }

  const timeout = withTimeout(config.strategy.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": `${config.appName}/1.0 (+http://localhost:${config.port})`,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,application/json;q=0.7,*/*;q=0.5",
        ...headers
      },
      redirect: "follow",
      signal: timeout.controller.signal
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    if (!response.ok) {
      throw new ExternalServiceError(
        `Browser fetch returned ${response.status}`,
        "browser_fetch",
        response.status
      );
    }

    return {
      url: response.url || url,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      buffer
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ExternalServiceError("Browser fetch timed out", "browser_fetch", 504);
    }

    if (error instanceof ExternalServiceError) {
      throw error;
    }

    throw new ExternalServiceError(
      error.message || "Browser fetch failed",
      "browser_fetch",
      502
    );
  } finally {
    timeout.clear();
  }
}
