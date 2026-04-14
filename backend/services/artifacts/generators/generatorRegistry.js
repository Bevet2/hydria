import { renderPdfArtifact } from "./pdfGenerator.js";
import { renderMarkdownArtifact } from "./markdownGenerator.js";
import { renderTextArtifact } from "./textGenerator.js";
import { renderHtmlArtifact } from "./htmlGenerator.js";
import { renderJsonArtifact } from "./jsonGenerator.js";
import { renderCsvArtifact } from "./csvGenerator.js";
import { renderDocxArtifact } from "./docxGenerator.js";
import { renderPptxArtifact } from "./pptxGenerator.js";
import { renderXlsxArtifact } from "./xlsxGenerator.js";
import { renderImageArtifact } from "./imageGenerator.js";

const GENERATORS = {
  pdf: {
    id: "pdf",
    extension: "pdf",
    render: renderPdfArtifact
  },
  md: {
    id: "md",
    extension: "md",
    render: renderMarkdownArtifact
  },
  txt: {
    id: "txt",
    extension: "txt",
    render: renderTextArtifact
  },
  html: {
    id: "html",
    extension: "html",
    render: renderHtmlArtifact
  },
  json: {
    id: "json",
    extension: "json",
    render: renderJsonArtifact
  },
  csv: {
    id: "csv",
    extension: "csv",
    render: renderCsvArtifact
  },
  docx: {
    id: "docx",
    extension: "docx",
    render: renderDocxArtifact
  },
  pptx: {
    id: "pptx",
    extension: "pptx",
    render: renderPptxArtifact
  },
  xlsx: {
    id: "xlsx",
    extension: "xlsx",
    render: renderXlsxArtifact
  },
  image: {
    id: "image",
    extension: "svg",
    aliases: ["svg", "png", "jpg", "jpeg"],
    render: renderImageArtifact
  }
};

function resolveGenerator(format) {
  if (GENERATORS[format]) {
    return GENERATORS[format];
  }

  return (
    Object.values(GENERATORS).find((generator) => generator.aliases?.includes(format)) ||
    GENERATORS.pdf
  );
}

export async function renderGeneratedArtifact({
  format,
  title,
  markdown,
  spec,
  prompt
}) {
  const generator = resolveGenerator(format);
  const result = await generator.render({
    title,
    markdown,
    spec,
    prompt
  });

  return {
    ...result,
    format: generator.id,
    extension: result.extension || generator.extension || generator.id
  };
}

export function listArtifactGenerators() {
  return Object.keys(GENERATORS);
}
