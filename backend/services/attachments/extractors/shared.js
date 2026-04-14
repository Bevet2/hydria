import path from "node:path";

export function extname(filename) {
  return path.extname(filename || "").toLowerCase();
}

export function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function normalizeForSearch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function tokenizeForSearch(text) {
  return normalizeForSearch(text)
    .split(/[^a-z0-9_+-]+/i)
    .filter((token) => token.length > 2);
}

export function truncateText(text, maxChars) {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 3)}...`;
}

export function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

export function extractXmlText(xml, pattern) {
  const matches = [];
  let match = null;

  while ((match = pattern.exec(xml))) {
    const content = decodeXmlEntities(match[1] || "")
      .replace(/<[^>]+>/g, " ")
      .trim();

    if (content) {
      matches.push(content);
    }
  }

  return matches;
}

export function buildDelimitedDataPreview(rawText, delimiter, title) {
  const lines = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const previewRows = lines.slice(0, 25).map((line) =>
    line
      .split(delimiter)
      .slice(0, 12)
      .map((value) => String(value || "").trim())
      .join(" | ")
  );

  const content = [
    `Rows previewed: ${previewRows.length}/${lines.length}`,
    "Preview:",
    ...previewRows
  ].join("\n");

  return {
    text: `${title}\n${content}`,
    sections: [
      {
        title,
        content
      }
    ]
  };
}
