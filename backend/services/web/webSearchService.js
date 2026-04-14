import * as cheerio from "cheerio";
import config from "../../config/hydria.config.js";
import { ExternalServiceError } from "../../utils/errors.js";
import { requestJson } from "../apis/genericApiClient.js";
import { getApiById } from "../apis/apiCatalogService.js";

function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value = "", maxChars = 220) {
  const text = cleanText(value);
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

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

function unwrapDuckDuckGoUrl(url = "") {
  try {
    const parsed = new URL(url, "https://duckduckgo.com");
    const target = parsed.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : parsed.toString();
  } catch {
    return url;
  }
}

async function fetchDuckDuckGoHtml(query) {
  const provider = getApiById("search_duckduckgo_html");
  if (!provider) {
    throw new ExternalServiceError(
      "DuckDuckGo HTML provider is not registered.",
      "search_duckduckgo_html",
      503
    );
  }

  const timeout = withTimeout(config.strategy.requestTimeoutMs);

  try {
    const url = new URL(provider.baseUrl);
    url.searchParams.set("q", query);
    const response = await fetch(url, {
      headers: {
        "User-Agent": `${config.appName}/1.0 (+http://localhost:${config.port})`,
        Accept: "text/html,application/xhtml+xml"
      },
      signal: timeout.controller.signal
    });

    if (!response.ok) {
      throw new ExternalServiceError(
        `DuckDuckGo HTML returned ${response.status}`,
        "search_duckduckgo_html",
        response.status
      );
    }

    return await response.text();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ExternalServiceError(
        "DuckDuckGo HTML timed out",
        "search_duckduckgo_html",
        504
      );
    }

    if (error instanceof ExternalServiceError) {
      throw error;
    }

    throw new ExternalServiceError(
      error.message || "DuckDuckGo HTML search failed",
      "search_duckduckgo_html",
      502
    );
  } finally {
    timeout.clear();
  }
}

function parseDuckDuckGoResults(html) {
  const $ = cheerio.load(String(html || ""));
  const results = [];

  $(".result").each((_, element) => {
    const titleNode = $(element).find(".result__title a").first();
    const snippetNode = $(element).find(".result__snippet").first();
    const rawUrl = titleNode.attr("href") || $(element).find(".result__url").text();
    const title = cleanText(titleNode.text());
    const snippet = truncate(snippetNode.text(), 240);
    const url = unwrapDuckDuckGoUrl(rawUrl);

    if (!title || !url) {
      return;
    }

    results.push({
      title,
      url,
      snippet
    });
  });

  return results.slice(0, config.web.maxSearchResults);
}

async function fallbackInstantAnswer(query) {
  const provider = getApiById("search_duckduckgo");
  if (!provider) {
    return [];
  }

  const raw = await requestJson(provider, {
    params: {
      q: query,
      format: "json",
      no_html: 1,
      no_redirect: 1,
      skip_disambig: 1
    }
  });

  const relatedTopics = Array.isArray(raw.RelatedTopics) ? raw.RelatedTopics : [];
  const results = relatedTopics
    .flatMap((topic) => (topic.Topics ? topic.Topics : [topic]))
    .slice(0, config.web.maxSearchResults)
    .map((topic) => ({
      title: cleanText(topic.Text || raw.Heading || query),
      url: topic.FirstURL || "",
      snippet: truncate(topic.Text || raw.AbstractText || "")
    }))
    .filter((item) => item.url);

  if (!results.length && raw.AbstractURL) {
    results.push({
      title: cleanText(raw.Heading || query),
      url: raw.AbstractURL,
      snippet: truncate(raw.AbstractText || "")
    });
  }

  return results;
}

export async function searchWeb(query) {
  if (!config.web.enabled) {
    throw new ExternalServiceError("Web access is disabled.", "web_search", 503);
  }

  const attempts = [];

  try {
    const html = await fetchDuckDuckGoHtml(query);
    const results = parseDuckDuckGoResults(html);

    if (results.length) {
      return {
        providerId: "search_duckduckgo_html",
        sourceName: "DuckDuckGo HTML Search",
        query,
        results,
        summaryText: results
          .map((result) => `${result.title}: ${result.snippet || result.url}`)
          .join(" | ")
      };
    }

    attempts.push({
      provider: "search_duckduckgo_html",
      error: "No HTML results extracted."
    });
  } catch (error) {
    attempts.push({
      provider: "search_duckduckgo_html",
      error: error.message
    });
  }

  const fallbackResults = await fallbackInstantAnswer(query);
  if (fallbackResults.length) {
    return {
      providerId: "search_duckduckgo",
      sourceName: "DuckDuckGo Instant Answer",
      query,
      results: fallbackResults,
      summaryText: fallbackResults
        .map((result) => `${result.title}: ${result.snippet || result.url}`)
        .join(" | "),
      attempts
    };
  }

  throw new ExternalServiceError(
    `No web search results available for "${query}"`,
    "web_search",
    502,
    attempts
  );
}
