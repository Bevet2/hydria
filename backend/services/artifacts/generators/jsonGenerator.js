import { parseMarkdownDocument } from "./shared.js";

export async function renderJsonArtifact({ title, markdown, spec, prompt }) {
  const raw = String(markdown || "").trim();
  try {
    const parsed = JSON.parse(raw);
    return {
      buffer: Buffer.from(JSON.stringify(parsed, null, 2), "utf8"),
      extension: "json",
      mimeType: "application/json; charset=utf-8"
    };
  } catch {
    // fall back to markdown-to-json conversion
  }

  const documentModel = parseMarkdownDocument(markdown, title);
  const payload = {
    title: documentModel.title,
    format: "json",
    documentType: spec?.documentType || "document",
    generatedFromPrompt: String(prompt || "").trim(),
    sections: documentModel.sections.map((section, index) => ({
      index: index + 1,
      heading: section.heading,
      paragraphs: section.paragraphs,
      bullets: section.bullets
    }))
  };

  return {
    buffer: Buffer.from(JSON.stringify(payload, null, 2), "utf8"),
    extension: "json",
    mimeType: "application/json; charset=utf-8"
  };
}
