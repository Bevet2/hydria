import { buildHtmlDocument } from "./shared.js";

export async function renderHtmlArtifact({ title, markdown }) {
  const html = buildHtmlDocument(markdown, title);

  return {
    buffer: Buffer.from(html, "utf8"),
    extension: "html",
    mimeType: "text/html; charset=utf-8"
  };
}
