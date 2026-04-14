import { extractDocumentLikeContent } from "./documentExtractors.js";
import { extractPresentationContent } from "./presentationExtractors.js";
import { extractArchiveContent } from "./archiveExtractors.js";

const ATTACHMENT_EXTRACTORS = [
  {
    id: "document-like",
    kinds: ["pdf", "doc", "docx", "text", "code", "config", "data", "spreadsheet", "image"],
    extract: extractDocumentLikeContent
  },
  {
    id: "presentation",
    kinds: ["presentation"],
    extract: extractPresentationContent
  },
  {
    id: "archive",
    kinds: ["archive"],
    extract: extractArchiveContent
  }
];

export async function extractContentForAttachment(file, kind) {
  const extractor = ATTACHMENT_EXTRACTORS.find((entry) => entry.kinds.includes(kind));

  if (!extractor) {
    return {
      text: "",
      parser: "metadata-only",
      extractorId: "metadata-only"
    };
  }

  const result = await extractor.extract(file, kind);
  return {
    text: result?.text || "",
    sections: Array.isArray(result?.sections) ? result.sections : [],
    parser: result?.parser || "metadata-only",
    extractorId: extractor.id
  };
}

export function listAttachmentExtractors() {
  return ATTACHMENT_EXTRACTORS.map((extractor) => ({
    id: extractor.id,
    kinds: [...extractor.kinds]
  }));
}
