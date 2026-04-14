function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractUrls(prompt = "") {
  const matches = String(prompt || "").match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  return [...new Set(matches.map((url) => url.replace(/[),.;!?]+$/, "")))];
}

function extractQuotedValue(prompt = "") {
  const match = String(prompt || "").match(/["“](.+?)["”]/);
  return match ? match[1] : "";
}

function extractSelector(prompt = "") {
  const selectorMatch =
    String(prompt || "").match(/selector\s*[:=]\s*([#.:\[\]\w='"-]+)/i) ||
    String(prompt || "").match(/\b(#[-\w]+|\.[-\w]+|\w+\[[^\]]+\])\b/);
  return selectorMatch ? selectorMatch[1] : "";
}

export function detectBrowserNeed(prompt = "") {
  const normalized = normalizeText(prompt);
  const urls = extractUrls(prompt);
  const selector = extractSelector(prompt);

  if (
    !urls.length &&
    !/\b(browser|navigue|ouvre|navigate|goto|visit|page|click|clique|fill|remplis|form|formulaire|capture|screenshot|dom|links?|liens?)\b/i.test(normalized)
  ) {
    return null;
  }

  let action = "inspect";
  if (/\b(screenshot|capture|screen)\b/i.test(normalized)) {
    action = "screenshot";
  } else if (/\b(click|clique)\b/i.test(normalized)) {
    action = "click";
  } else if (/\b(fill|remplis|type|saisis|entrez|enter)\b/i.test(normalized)) {
    action = "fill";
  } else if (/\b(links|liens)\b/i.test(normalized)) {
    action = "links";
  }

  return {
    action,
    url: urls[0] || "",
    urls,
    selector,
    value: action === "fill" ? extractQuotedValue(prompt) : "",
    needsBrowser: true
  };
}

export default {
  detectBrowserNeed
};
