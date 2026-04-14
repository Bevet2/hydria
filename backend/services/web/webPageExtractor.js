import * as cheerio from "cheerio";

function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value = "", maxChars = 320) {
  const text = cleanText(value);
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

function decodeBuffer(buffer, contentType = "") {
  const charsetMatch = String(contentType || "").match(/charset=([^;]+)/i);
  const encoding = charsetMatch?.[1]?.trim().toLowerCase();

  try {
    if (encoding && encoding !== "utf-8" && encoding !== "utf8") {
      return buffer.toString("utf8");
    }
  } catch {
    return buffer.toString("utf8");
  }

  return buffer.toString("utf8");
}

function extractHtmlContent(html, url) {
  const $ = cheerio.load(String(html || ""));
  $("script, style, noscript, svg, nav, footer, header, aside, form").remove();

  const candidates = [
    $("article").first(),
    $("main").first(),
    $("[role='main']").first(),
    $("body").first()
  ];
  const activeRoot = candidates.find((node) => node?.length) || $("body");
  const title =
    cleanText($("meta[property='og:title']").attr("content")) ||
    cleanText($("title").first().text()) ||
    cleanText($("h1").first().text()) ||
    url;

  const paragraphs = activeRoot
    .find("h1, h2, h3, p, li")
    .toArray()
    .map((element) => cleanText($(element).text()))
    .filter(Boolean)
    .filter((text, index, values) => values.indexOf(text) === index)
    .slice(0, 80);

  const text = paragraphs.join("\n");

  return {
    title,
    text,
    excerpt: truncate(text, 420),
    contentType: "text/html"
  };
}

export function extractWebPageContent({ url, buffer, contentType = "" }) {
  const lowerType = String(contentType || "").toLowerCase();

  if (lowerType.includes("application/json")) {
    const text = decodeBuffer(buffer, contentType);
    return {
      title: url,
      text,
      excerpt: truncate(text, 420),
      contentType: lowerType || "application/json"
    };
  }

  if (
    lowerType.includes("text/html") ||
    lowerType.includes("application/xhtml+xml") ||
    !lowerType
  ) {
    return extractHtmlContent(decodeBuffer(buffer, contentType), url);
  }

  const text = decodeBuffer(buffer, contentType);
  return {
    title: url,
    text,
    excerpt: truncate(text, 420),
    contentType: lowerType || "text/plain"
  };
}
