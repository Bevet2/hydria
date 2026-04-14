import AdmZip from "adm-zip";
import { extname, extractXmlText, normalizeWhitespace } from "./shared.js";

function sortSlides(entries, prefix) {
  return entries.sort((left, right) => {
    const leftNumber =
      Number.parseInt(left.entryName.replace(prefix, "").replace(".xml", ""), 10) || 0;
    const rightNumber =
      Number.parseInt(right.entryName.replace(prefix, "").replace(".xml", ""), 10) || 0;
    return leftNumber - rightNumber;
  });
}

function extractPptxSlides(buffer) {
  const zip = new AdmZip(buffer);
  const slideEntries = sortSlides(
    zip
      .getEntries()
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.entryName)),
    "ppt/slides/slide"
  );

  const sections = slideEntries.slice(0, 20).map((entry, index) => {
    const xml = entry.getData().toString("utf8");
    const text = extractXmlText(xml, /<a:t[^>]*>(.*?)<\/a:t>/gms).join(" ");
    return {
      title: `Slide ${index + 1}`,
      content: normalizeWhitespace(text)
    };
  }).filter((section) => section.content);

  return {
    text: sections.map((section) => `${section.title}\n${section.content}`).join("\n\n"),
    sections,
    parser: "pptx-zip"
  };
}

function extractOdpSlides(buffer) {
  const zip = new AdmZip(buffer);
  const contentEntry = zip.getEntry("content.xml");

  if (!contentEntry) {
    return {
      text: "",
      parser: "odp-zip"
    };
  }

  const xml = contentEntry.getData().toString("utf8");
  const paragraphTexts = extractXmlText(xml, /<text:p[^>]*>(.*?)<\/text:p>/gms);
  const sections = [];

  for (let index = 0; index < paragraphTexts.length; index += 8) {
    const content = normalizeWhitespace(paragraphTexts.slice(index, index + 8).join(" "));
    if (!content) {
      continue;
    }

    sections.push({
      title: `Slide ${sections.length + 1}`,
      content
    });
  }

  return {
    text: sections.map((section) => `${section.title}\n${section.content}`).join("\n\n"),
    sections,
    parser: "odp-zip"
  };
}

export async function extractPresentationContent(file) {
  const extension = extname(file.originalname);

  if (extension === ".pptx") {
    return extractPptxSlides(file.buffer);
  }

  if (extension === ".odp") {
    return extractOdpSlides(file.buffer);
  }

  return {
    text: "",
    parser: "metadata-only"
  };
}
