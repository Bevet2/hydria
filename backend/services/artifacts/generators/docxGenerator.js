import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} from "docx";
import { parseMarkdownDocument } from "./shared.js";

export async function renderDocxArtifact({ title, markdown }) {
  const normalizedMarkdown = String(markdown || "");
  const hasExplicitTitle = /^\s*#\s+\S/m.test(normalizedMarkdown);
  const hasExplicitSections = /^\s*##+\s+\S/m.test(normalizedMarkdown);
  const documentModel = parseMarkdownDocument(normalizedMarkdown, "");
  const children = [];

  if (hasExplicitTitle && documentModel.title) {
    children.push(
      new Paragraph({
        text: documentModel.title,
        heading: HeadingLevel.TITLE
      })
    );
  }

  for (const section of documentModel.sections) {
    if (hasExplicitSections && section.heading) {
      children.push(
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_1
        })
      );
    }

    for (const paragraph of section.paragraphs) {
      children.push(
        new Paragraph({
          children: [new TextRun(paragraph)]
        })
      );
    }

    for (const bullet of section.bullets) {
      children.push(
        new Paragraph({
          text: bullet,
          bullet: {
            level: 0
          }
        })
      );
    }
  }

  const document = new Document({
    sections: [
      {
        children
      }
    ]
  });

  const buffer = await Packer.toBuffer(document);

  return {
    buffer,
    extension: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  };
}
