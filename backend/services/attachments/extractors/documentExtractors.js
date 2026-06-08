import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import zlib from "node:zlib";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";
import XLSX from "xlsx";
import config from "../../../config/hydria.config.js";
import { extname, buildDelimitedDataPreview } from "./shared.js";

const require = createRequire(import.meta.url);
const WordExtractor = require("word-extractor");

function decodePdfLiteralString(value = "") {
  return String(value || "")
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8) || 0));
}

function decodePdfHexString(value = "") {
  const hex = String(value || "").replace(/\s+/g, "");
  if (!hex) {
    return "";
  }
  const paddedHex = hex.length % 2 === 0 ? hex : `${hex}0`;
  const buffer = Buffer.from(paddedHex, "hex");
  return buffer.toString("utf8");
}

function extractPdfTextOperators(content = "") {
  const lines = [];
  const source = String(content || "");
  const operatorPattern = /(?:\[((?:.|\r|\n)*?)\]\s*TJ|(<[0-9A-Fa-f\s]+>|\((?:\\.|[^\\)])*\))\s*Tj)/g;
  let match;

  while ((match = operatorPattern.exec(source)) !== null) {
    const segment = match[1] ?? match[2] ?? "";
    const parts = [];
    const tokenPattern = /<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^\\)])*)\)/g;
    let tokenMatch;
    while ((tokenMatch = tokenPattern.exec(segment)) !== null) {
      if (tokenMatch[1] !== undefined) {
        const decodedHex = decodePdfHexString(tokenMatch[1]);
        if (decodedHex) {
          parts.push(decodedHex);
        }
      } else if (tokenMatch[2] !== undefined) {
        const decodedLiteral = decodePdfLiteralString(tokenMatch[2]);
        if (decodedLiteral) {
          parts.push(decodedLiteral);
        }
      }
    }
    const line = parts.join("").replace(/\s+/g, " ").trim();
    if (line) {
      lines.push(line);
    }
  }

  return lines.join("\n").trim();
}

function extractPdfTextFallback(buffer) {
  const binary = Buffer.isBuffer(buffer) ? buffer.toString("latin1") : String(buffer || "");
  const streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  const chunks = [];
  let match;

  while ((match = streamPattern.exec(binary)) !== null) {
    const rawStream = match[1] || "";
    const streamStart = match.index + match[0].indexOf(rawStream);
    const streamBuffer = Buffer.isBuffer(buffer)
      ? buffer.subarray(streamStart, streamStart + rawStream.length)
      : Buffer.from(rawStream, "latin1");
    const candidates = [streamBuffer];
    try {
      candidates.unshift(zlib.inflateSync(streamBuffer));
    } catch {
      // Ignore inflate failures and keep the raw stream candidate.
    }

    for (const candidate of candidates) {
      const extracted = extractPdfTextOperators(candidate.toString("latin1"));
      if (extracted) {
        chunks.push(extracted);
      }
    }
  }

  return chunks
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfContent(buffer) {
  try {
    const result = await pdfParse(buffer);
    const parsedText = String(result.text || "").trim();
    if (parsedText) {
      return {
        text: result.text || "",
        parser: "pdf-parse"
      };
    }
  } catch {
    // Fall back to the lightweight stream parser below.
  }

  const fallbackText = extractPdfTextFallback(buffer);
  return {
    text: fallbackText || "",
    parser: fallbackText ? "pdf-fallback" : "pdf-empty"
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
