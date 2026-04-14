import config from "../../config/hydria.config.js";
import { detectWebNeed } from "./webIntentService.js";
import { searchWeb } from "./webSearchService.js";
import { readWebUrl } from "./webReaderService.js";

function truncate(value = "", maxChars = 220) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

function shouldReadTopPages(prompt, classification, webNeed) {
  if (!webNeed || webNeed.routeKey !== "web/search") {
    return false;
  }

  return (
    classification === "hybrid_task" ||
    classification === "complex_reasoning" ||
    classification === "summarize" ||
    classification === "compare" ||
    webNeed.preferSummaries ||
    /\b(read|summarize|resume|analyse|analyze|compare|source|sources|article|articles)\b/i.test(
      prompt
    )
  );
}

function buildSearchSummary(searchResults, pages = []) {
  const searchText = searchResults
    .map((result, index) => `${index + 1}. ${result.title} - ${result.snippet || result.url}`)
    .join("\n");

  if (!pages.length) {
    return searchText || "No search results found.";
  }

  const pageText = pages
    .map((page, index) => `${index + 1}. ${page.title} | ${truncate(page.excerpt, 260)}`)
    .join("\n");

  return [`Search results:`, searchText, ``, `Read pages:`, pageText]
    .filter(Boolean)
    .join("\n");
}

function toWebArtifacts(searchResults = [], pages = []) {
  const artifacts = [];

  for (const result of searchResults) {
    artifacts.push({
      type: "web_result",
      provider: "web_search",
      title: result.title,
      url: result.url,
      snippet: result.snippet || ""
    });
  }

  for (const page of pages) {
    artifacts.push({
      type: "web_page",
      provider: page.providerId,
      title: page.title,
      url: page.url,
      excerpt: truncate(page.excerpt, 240)
    });
  }

  return artifacts;
}

export async function resolveWeb(prompt, classification, explicitWebNeed = null) {
  if (!config.web.enabled) {
    return {
      success: false,
      error: "Web access is disabled in configuration."
    };
  }

  const webNeed = explicitWebNeed || detectWebNeed(prompt);

  if (!webNeed) {
    return {
      success: false,
      error: "No web requirement detected."
    };
  }

  if (webNeed.routeKey === "web/read_url") {
    const pages = [];
    const attempts = [];

    for (const url of webNeed.urls.slice(0, config.web.maxReadPages)) {
      try {
        const page = await readWebUrl(url);
        pages.push(page);
      } catch (error) {
        attempts.push({
          url,
          error: error.message
        });
      }
    }

    if (!pages.length) {
      return {
        success: false,
        error: "Unable to read the requested URL.",
        webNeed,
        attempts
      };
    }

    return {
      success: true,
      providerId: pages.map((page) => page.providerId).join(","),
      sourceType: "web",
      sourceName: "Web Reader",
      capability: webNeed.capability,
      raw: { pages },
      normalized: {
        urls: webNeed.urls,
        pages: pages.map((page) => ({
          title: page.title,
          url: page.url,
          excerpt: page.excerpt
        }))
      },
      summaryText: pages
        .map((page) => `${page.title}: ${truncate(page.excerpt, 260)}`)
        .join(" | "),
      searchResults: [],
      pages,
      artifacts: toWebArtifacts([], pages),
      attempts
    };
  }

  const search = await searchWeb(webNeed.query);
  let pages = [];
  const attempts = search.attempts || [];

  if (shouldReadTopPages(prompt, classification, webNeed)) {
    for (const result of search.results.slice(0, config.web.maxReadPages)) {
      try {
        const page = await readWebUrl(result.url);
        pages.push(page);
      } catch (error) {
        attempts.push({
          url: result.url,
          error: error.message
        });
      }
    }
  }

  return {
    success: true,
    providerId: search.providerId,
    sourceType: "web",
    sourceName: search.sourceName,
    capability: webNeed.capability,
    raw: {
      searchResults: search.results,
      pages
    },
    normalized: {
      query: webNeed.query,
      results: search.results,
      pages: pages.map((page) => ({
        title: page.title,
        url: page.url,
        excerpt: page.excerpt
      }))
    },
    summaryText: buildSearchSummary(search.results, pages),
    searchResults: search.results,
    pages,
    artifacts: toWebArtifacts(search.results, pages),
    attempts
  };
}
