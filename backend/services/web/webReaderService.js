import { requestText } from "../apis/genericApiClient.js";
import { getApisByCapability } from "../registry/apiRegistry.js";
import { fetchPage } from "./browserService.js";
import { extractWebPageContent } from "./webPageExtractor.js";

function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value = "", maxChars = 420) {
  const text = cleanText(value);
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

function isValidWebUrl(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function normalizeUrl(url) {
  return String(url || "").trim();
}

function normalizeReaderText(rawText, url) {
  const text = String(rawText || "");
  const titleMatch = text.match(/^\s*Title:\s*(.+)$/im);
  const contentMatch = text.match(/Markdown Content:\s*([\s\S]+)$/i);
  const body = cleanText(contentMatch?.[1] || text);

  return {
    title: cleanText(titleMatch?.[1] || url),
    text: body,
    excerpt: truncate(body, 420),
    contentType: "text/plain"
  };
}

function buildTextResult(sourceName, providerId, url, extracted, raw, attempts = []) {
  return {
    providerId,
    sourceName,
    url,
    title: extracted.title || url,
    text: extracted.text || "",
    excerpt: extracted.excerpt || "",
    contentType: extracted.contentType || "text/plain",
    raw,
    attempts
  };
}

export async function readWebUrl(url) {
  const normalizedUrl = normalizeUrl(url);
  if (!isValidWebUrl(normalizedUrl)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  const attempts = [];
  const readerProviders = getApisByCapability("read_url");

  for (const provider of readerProviders) {
    try {
      const raw = await requestText(provider, {
        path: normalizedUrl.replace(/^https?:\/\//i, "")
      });
      const text = String(raw || "").trim();

      if (text) {
        return buildTextResult(
          provider.name,
          provider.id,
          normalizedUrl,
          normalizeReaderText(text, normalizedUrl),
          raw,
          attempts
        );
      }

      attempts.push({
        provider: provider.id,
        error: "Reader returned empty content."
      });
    } catch (error) {
      attempts.push({
        provider: provider.id,
        error: error.message
      });
    }
  }

  const page = await fetchPage(normalizedUrl);
  const extracted = extractWebPageContent(page);
  return buildTextResult(
    "Hydria Browser Fetch",
    "browser_fetch",
    normalizedUrl,
    extracted,
    extracted.text,
    attempts
  );
}
