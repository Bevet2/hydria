function cleanEntity(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[?.!,;]+$/g, "")
    .trim();
}

function normalizePrompt(prompt) {
  return String(prompt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractUrls(prompt = "") {
  const matches = String(prompt || "").match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  return [...new Set(matches.map((url) => url.replace(/[),.;!?]+$/, "")))];
}

function stripSearchVerbs(prompt = "") {
  return cleanEntity(
    String(prompt || "")
      .replace(/https?:\/\/[^\s<>"'`]+/gi, " ")
      .replace(
        /\b(search the web|search online|search|look up|lookup|find sources|find information|research|browse|recherche web|cherche|recherche|cherche des sources|trouve des sources|lis|ouvre|open|read|resume|summarize|synthese|synthetise|analyse|analyze|explain)\b/gi,
        " "
      )
      .replace(/\b(for|sur|about|on|cette url|this url|ce lien|this link)\b/gi, " ")
  );
}

function inferSearchQuery(prompt = "") {
  const cleaned = stripSearchVerbs(prompt);
  return cleaned || cleanEntity(prompt);
}

function shouldTreatAsWebSearch(normalizedPrompt, apiNeed) {
  if (apiNeed?.category === "search") {
    return true;
  }

  return /\b(search the web|search online|find sources|find information|research|browse|recherche web|cherche des sources|trouve des sources|look up on the web|web search)\b/i.test(
    normalizedPrompt
  );
}

export function detectWebNeed(prompt = "", apiNeed = null) {
  const normalizedPrompt = normalizePrompt(prompt);
  const urls = extractUrls(prompt);

  if (urls.length) {
    return {
      routeKey: "web/read_url",
      capability: "read_url",
      urls,
      query: inferSearchQuery(prompt),
      preferSummaries: /\b(resume|summary|summarize|tl;dr|synthese|synthetise|analyse|analyze|explique|explain|compare)\b/i.test(
        normalizedPrompt
      )
    };
  }

  if (shouldTreatAsWebSearch(normalizedPrompt, apiNeed)) {
    const query = inferSearchQuery(prompt);

    if (!query) {
      return null;
    }

    return {
      routeKey: "web/search",
      capability: "web_search",
      query,
      preferSummaries: /\b(source|sources|article|articles|latest|actualite|news|resume|summary|synthese|synthetise|analyse|analyze|compare)\b/i.test(
        normalizedPrompt
      )
    };
  }

  return null;
}
