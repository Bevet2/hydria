import config from "../../config/hydria.config.js";
import { ExternalServiceError } from "../../utils/errors.js";
import { fetchPublicPage } from "./publicHttp.js";

export async function fetchPage(url, { headers = {} } = {}) {
  if (!config.web.enableBrowserFetch) {
    throw new ExternalServiceError("Browser fetch fallback is disabled.", "browser_fetch", 503);
  }
  try {
    return await fetchPublicPage(url, {
      timeoutMs: config.strategy.requestTimeoutMs,
      headers: { "User-Agent": `${config.appName}/1.0`, Accept: "text/html,text/plain,application/json", ...headers }
    });
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    const timeout = error.name === "TimeoutError" || error.name === "AbortError";
    throw new ExternalServiceError(timeout ? "Browser fetch timed out" : "Public web request failed", "browser_fetch", timeout ? 504 : 502);
  }
}
