import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} from "docx";
import { parseMarkdownDocument } from "./shared.js";

export async function renderDocxArtifact({ title, markdown }) {
  const documentModel = parseMarkdownDocument(markdown, title);
  const children = [
    new Paragraph({
      text: documentModel.title,
      heading: HeadingLevel.TITLE
    })
  ];

  for (const section of documentModel.sections) {
    children.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_1
      })
    );

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
