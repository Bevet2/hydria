import { GITHUB_DEFAULT_HEADERS } from "./github.types.js";

export class GitHubClientError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "GitHubClientError";
    this.status = details.status || 0;
    this.rateLimitRemaining = details.rateLimitRemaining ?? null;
    this.rateLimitResetAt = details.rateLimitResetAt || null;
    this.isRateLimit = Boolean(details.isRateLimit);
    this.responseBody = details.responseBody || "";
  }
}

function buildHeaders(token = "") {
  const headers = {
    ...GITHUB_DEFAULT_HEADERS
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export class GitHubClient {
  constructor({ apiBaseUrl, token = "" }) {
    this.apiBaseUrl = String(apiBaseUrl || "https://api.github.com").replace(/\/+$/, "");
    this.token = token;
  }

  async request(endpoint, { searchParams = {}, method = "GET" } = {}) {
    const url = new URL(
      endpoint.startsWith("http") ? endpoint : `${this.apiBaseUrl}${endpoint}`
    );

    for (const [key, value] of Object.entries(searchParams || {})) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      method,
      headers: buildHeaders(this.token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GitHubClientError(
        `GitHub API ${response.status}: ${errorText || response.statusText}`,
        {
          status: response.status,
          rateLimitRemaining: Number(response.headers.get("x-ratelimit-remaining")),
          rateLimitResetAt: response.headers.get("x-ratelimit-reset")
            ? new Date(Number(response.headers.get("x-ratelimit-reset")) * 1000).toISOString()
            : null,
          isRateLimit:
            response.status === 403 &&
            /rate limit/i.test(errorText || response.statusText || ""),
          responseBody: errorText || ""
        }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.text();
  }
}

export default GitHubClient;
