import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";
import XLSX from "xlsx";
import config from "../../../config/hydria.config.js";
import { extname, buildDelimitedDataPreview } from "./shared.js";

const require = createRequire(import.meta.url);
const WordExtractor = require("word-extractor");

async function extractPdfContent(buffer) {
  const result = await pdfParse(buffer);
  return {
    text: result.text || "",
    parser: "pdf-parse"
  };
}

async function extractDocxContent(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value || "",
    parser: "mammoth"
  };
}

async function extractLegacyWordContent(buffer, extension) {
  await fs.mkdir(config.paths.uploadTempDir, { recursive: true });
  const tempFile = path.join(
    config.paths.uploadTempDir,
    `${randomUUID()}${extension || ".doc"}`
  );

  try {
    await fs.writeFile(tempFile, buffer);
    const extractor = new WordExtractor();
    const document = await extractor.extract(tempFile);
    return {
      text: document.getBody ? document.getBody() : "",
      parser: "word-extractor"
    };
  } finally {
    await fs.rm(tempFile, { force: true }).catch(() => undefined);
  }
}

async function extractImageContent(buffer) {
  if (!config.attachments.enableOcr) {
    return {
      text: "",
      parser: "ocr-disabled"
    };
  }

  const result = await Tesseract.recognize(buffer, config.attachments.ocrLanguages, {
    logger: () => undefined
  });

  return {
    text: result?.data?.text || "",
    parser: "tesseract-ocr"
  };
}

function extractPlainTextContent(buffer, parser = "plain-text") {
  return {
    text: buffer.toString("utf8"),
    parser
  };
}

function extractSpreadsheetContent(buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    dense: false
  });

  const sections = [];

  for (const sheetName of workbook.SheetNames.slice(0, 6)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false
    });

    const previewRows = rows.slice(0, 30).map((row) =>
      row
        .slice(0, 12)
        .map((value) => String(value || "").trim())
        .join(" | ")
    );

    const maxColumns = rows.reduce(
      (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
      0
    );

    const content = [
      `Rows: ${rows.length}`,
      `Columns: ${maxColumns}`,
      "Preview:",
      ...previewRows
    ]
      .filter(Boolean)
      .join("\n");

    sections.push({
      title: `Sheet ${sheetName}`,
      content
    });
  }

  return {
    text: sections.map((section) => `${section.title}\n${section.content}`).join("\n\n"),
    sections,
    parser: "xlsx"
  };
}

export async function extractDocumentLikeContent(file, kind) {
  const extension = extname(file.originalname);

  switch (kind) {
    case "pdf":
      return extractPdfContent(file.buffer);
    case "docx":
      return extractDocxContent(file.buffer);
    case "doc":
      return extractLegacyWordContent(file.buffer, extension);
    case "image":
      return extractImageContent(file.buffer);
    case "spreadsheet":
      return extractSpreadsheetContent(file.buffer);
    case "data":
      if (extension === ".csv") {
        return {
          ...buildDelimitedDataPreview(file.buffer.toString("utf8"), ",", "CSV preview"),
          parser: "csv-preview"
        };
      }

      if (extension === ".tsv") {
        return {
          ...buildDelimitedDataPreview(file.buffer.toString("utf8"), "\t", "TSV preview"),
          parser: "tsv-preview"
        };
      }

      return extractPlainTextContent(file.buffer, "structured-text");
    case "code":
      return extractPlainTextContent(file.buffer, "code-text");
    case "config":
      return extractPlainTextContent(file.buffer, "config-text");
    case "text":
      return extractPlainTextContent(file.buffer, "plain-text");
    default:
      return null;
  }
}
