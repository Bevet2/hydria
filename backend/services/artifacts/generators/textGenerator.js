import { stripMarkdown } from "./shared.js";

export async function renderTextArtifact({ markdown }) {
  return {
    buffer: Buffer.from(stripMarkdown(markdown), "utf8"),
    extension: "txt",
    mimeType: "text/plain; charset=utf-8"
  };
}
