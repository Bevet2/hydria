export async function renderMarkdownArtifact({ markdown }) {
  return {
    buffer: Buffer.from(String(markdown || ""), "utf8"),
    extension: "md",
    mimeType: "text/markdown; charset=utf-8"
  };
}
