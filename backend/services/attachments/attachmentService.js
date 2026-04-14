import { randomUUID } from "node:crypto";
import { AppError } from "../../utils/errors.js";
import config from "../../config/hydria.config.js";
import {
  extname,
  formatBytes,
  normalizeForSearch,
  normalizeWhitespace,
  tokenizeForSearch,
  truncateText
} from "./extractors/shared.js";
import {
  inferAttachmentKind,
  inferContentFamily,
  listSupportedAttachmentKinds
} from "./extractors/kinds.js";
import {
  extractContentForAttachment,
  listAttachmentExtractors as listRegisteredExtractors
} from "./extractors/extractorRegistry.js";

const PROFILE_RULES = [
  {
    tag: "resume",
    patterns: [
      "cv",
      "resume",
      "curriculum",
      "experience",
      "experiences",
      "skills",
      "competences",
      "formation",
      "education",
      "languages"
    ]
  },
  {
    tag: "invoice",
    patterns: ["invoice", "facture", "billing", "amount due", "subtotal", "vat"]
  },
  {
    tag: "contract",
    patterns: ["contract", "contrat", "terms", "agreement", "signature", "party"]
  },
  {
    tag: "report",
    patterns: ["report", "rapport", "analysis", "audit", "kpi", "summary"]
  },
  {
    tag: "specification",
    patterns: ["spec", "specification", "requirements", "prd", "architecture", "api"]
  },
  {
    tag: "dataset",
    patterns: ["dataset", "table", "sheet", "rows", "columns", "records"]
  },
  {
    tag: "presentation",
    patterns: ["slides", "deck", "presentation", "pitch"]
  }
];

function summarizeAttachmentMix(attachments) {
  return attachments.reduce((accumulator, attachment) => {
    accumulator[attachment.contentFamily] = (accumulator[attachment.contentFamily] || 0) + 1;
    return accumulator;
  }, {});
}

function looksLikeHeading(paragraph) {
  const line = paragraph.split("\n")[0].trim();
  if (!line || line.length > 80) {
    return false;
  }

  if (/^[A-Z0-9 /&+_-]{3,}$/.test(line)) {
    return true;
  }

  return /:$/.test(line);
}

function splitIntoParagraphs(text) {
  return normalizeWhitespace(text)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function buildParagraphSections(text, attachment) {
  const paragraphs = splitIntoParagraphs(text);
  if (!paragraphs.length) {
    return [];
  }

  const sections = [];
  let currentSection = null;

  for (const paragraph of paragraphs) {
    if (!currentSection || looksLikeHeading(paragraph)) {
      if (currentSection) {
        sections.push(currentSection);
      }

      const headingLine = paragraph.split("\n")[0].trim();
      const title = looksLikeHeading(paragraph)
        ? headingLine.replace(/:$/, "")
        : `${attachment.originalName} section ${sections.length + 1}`;

      currentSection = {
        title,
        content: looksLikeHeading(paragraph)
          ? paragraph.split("\n").slice(1).join("\n").trim()
          : paragraph
      };
      continue;
    }

    currentSection.content = `${currentSection.content}\n\n${paragraph}`.trim();
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function buildLineSections(text, attachment, linesPerSection = 80) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  const sections = [];

  for (let index = 0; index < lines.length; index += linesPerSection) {
    const content = lines
      .slice(index, index + linesPerSection)
      .join("\n")
      .trim();

    if (!content) {
      continue;
    }

    sections.push({
      title: `${attachment.originalName} block ${sections.length + 1}`,
      content
    });
  }

  return sections;
}

function normalizeSections(sections = [], attachment) {
  return sections
    .map((section, index) => ({
      title: normalizeWhitespace(section.title || `${attachment.originalName} section ${index + 1}`),
      content: normalizeWhitespace(section.content || "")
    }))
    .filter((section) => section.content);
}

function buildSections(text, attachment, extractedSections = []) {
  if (extractedSections.length) {
    return normalizeSections(extractedSections, attachment);
  }

  switch (attachment.kind) {
    case "code":
    case "config":
      return normalizeSections(buildLineSections(text, attachment), attachment);
    default:
      return normalizeSections(buildParagraphSections(text, attachment), attachment);
  }
}

function inferProfileTags(filename, text, kind, contentFamily) {
  const tags = new Set([kind, contentFamily]);
  const searchSpace = `${normalizeForSearch(filename)} ${normalizeForSearch(text)}`;

  if (contentFamily === "technical") {
    tags.add("technical_artifact");
  }

  if (contentFamily === "document") {
    tags.add("document");
  }

  if (contentFamily === "data") {
    tags.add("structured_data");
  }

  if (kind === "spreadsheet") {
    tags.add("tabular");
  }

  if (kind === "image") {
    tags.add("image_ocr");
  }

  for (const rule of PROFILE_RULES) {
    if (rule.patterns.some((pattern) => searchSpace.includes(pattern))) {
      tags.add(rule.tag);
    }
  }

  return [...tags];
}

function buildChunks(sections, attachment) {
  const maxChunkChars = Math.min(1400, config.attachments.maxExtractCharsPerFile);
  const chunks = [];

  for (const [sectionIndex, section] of sections.entries()) {
    const content = section.content || "";
    if (!content) {
      continue;
    }

    for (let offset = 0; offset < content.length; offset += maxChunkChars) {
      const text = content.slice(offset, offset + maxChunkChars).trim();
      if (!text) {
        continue;
      }

      chunks.push({
        id: `${attachment.id}:chunk:${chunks.length + 1}`,
        attachmentId: attachment.id,
        filename: attachment.originalName,
        kind: attachment.kind,
        contentFamily: attachment.contentFamily,
        parser: attachment.parser,
        profileTags: attachment.profileTags,
        sectionTitle: section.title || `${attachment.originalName} section ${sectionIndex + 1}`,
        text,
        chunkIndex: chunks.length,
        sectionIndex
      });
    }
  }

  if (!chunks.length && attachment.extractedText) {
    chunks.push({
      id: `${attachment.id}:chunk:1`,
      attachmentId: attachment.id,
      filename: attachment.originalName,
      kind: attachment.kind,
      contentFamily: attachment.contentFamily,
      parser: attachment.parser,
      profileTags: attachment.profileTags,
      sectionTitle: attachment.originalName,
      text: attachment.extractedText.slice(0, maxChunkChars).trim(),
      chunkIndex: 0,
      sectionIndex: 0
    });
  }

  return chunks;
}

function scoreChunkAgainstPrompt(chunk, prompt) {
  const promptTokens = new Set(tokenizeForSearch(prompt));
  const chunkTokens = tokenizeForSearch(
    `${chunk.filename} ${chunk.sectionTitle} ${chunk.text} ${chunk.profileTags?.join(" ")}`
  );
  let score = 0;

  if (!promptTokens.size) {
    return 1 - chunk.chunkIndex * 0.01;
  }

  for (const token of promptTokens) {
    if (chunkTokens.includes(token)) {
      score += 1;
    }
  }

  const normalizedPrompt = normalizeForSearch(prompt);

  if (
    (normalizedPrompt.includes("cv") || normalizedPrompt.includes("resume")) &&
    chunk.profileTags?.includes("resume")
  ) {
    score += 4;
  }

  if (
    /(sheet|row|rows|column|columns|table|dataset|csv|xlsx|excel|data)/.test(
      normalizedPrompt
    ) &&
    chunk.contentFamily === "data"
  ) {
    score += 3;
  }

  if (
    /(code|bug|debug|error|function|class|stack|trace|config|yaml|json|env)/.test(
      normalizedPrompt
    ) &&
    chunk.contentFamily === "technical"
  ) {
    score += 3;
  }

  if (
    /(image|screenshot|photo|ocr|capture|scan)/.test(normalizedPrompt) &&
    chunk.kind === "image"
  ) {
    score += 2;
  }

  if (
    /(compare|comparaison|difference|diff|vs|versus)/.test(normalizedPrompt) &&
    chunk.chunkIndex === 0
  ) {
    score += 1;
  }

  if (chunk.text.length < 40) {
    score -= 2;
  } else if (chunk.text.length > 120) {
    score += 0.75;
  }

  if (
    chunk.profileTags?.includes("resume") &&
    /(experience|skills|competence|education|formation|project|projects)/.test(
      normalizeForSearch(chunk.sectionTitle)
    )
  ) {
    score += 2;
  }

  return score - chunk.chunkIndex * 0.02;
}

function getAttachmentHandlingHint(attachment) {
  switch (attachment.kind) {
    case "code":
      return "Treat this file as source code. Focus on concrete behavior, structure, bugs, and maintainability visible in the extracted code.";
    case "config":
      return "Treat this file as configuration or structured text. Explain keys, sections, settings, and implications directly from the extracted content.";
    case "spreadsheet":
      return "Treat this file as tabular data. Use sheet names, rows, columns, and previewed values directly.";
    case "data":
      return "Treat this file as structured data. Refer to fields, records, rows, or delimited values rather than prose summaries.";
    case "presentation":
      return "Treat this file as slide content. Refer to slides, titles, bullet points, and extracted deck text.";
    case "archive":
      return "Treat this file as an inspected archive. Refer to listed entries and any extracted previews, but do not invent unseen content.";
    case "image":
      return "This image is available through OCR text and metadata only. Mention if visual details may be missing from OCR extraction.";
    case "media":
    case "binary":
      return "Only metadata is available for this file. Do not pretend full content was extracted.";
    default:
      return "Treat this file as a document and use the extracted content directly when answering.";
  }
}

function buildAttachmentSummary(attachment) {
  const parts = [
    `${attachment.originalName} (${attachment.kind}, ${attachment.sizeLabel})`,
    `family: ${attachment.contentFamily}`,
    `parser: ${attachment.parser}`,
    `extractor: ${attachment.extractorId}`
  ];

  if (attachment.parseStatus === "extracted") {
    parts.push(`extracted ${attachment.extractedCharacters} chars`);
  }

  if (attachment.parseStatus === "ocr_extracted") {
    parts.push(`OCR extracted ${attachment.extractedCharacters} chars`);
  }

  if (attachment.parseStatus === "metadata_only") {
    parts.push("metadata only");
  }

  if (attachment.warnings.length) {
    parts.push(`warnings: ${attachment.warnings.join("; ")}`);
  }

  return parts.join(" | ");
}

export function buildAttachmentToolMessage(attachment) {
  const lines = [`Attachment processed: ${attachment.summaryText}`];

  if (attachment.excerpt) {
    lines.push(`Excerpt:\n${attachment.excerpt}`);
  }

  return lines.join("\n\n");
}

export function buildAttachmentContextBlock(attachments) {
  if (!attachments.length) {
    return "";
  }

  const lines = ["Current attachments:"];

  for (const attachment of attachments) {
    lines.push(
      `- ${attachment.summaryText}${attachment.profileTags?.length ? ` | tags: ${attachment.profileTags.join(", ")}` : ""}`
    );
    lines.push(`  handling: ${getAttachmentHandlingHint(attachment)}`);
    if (attachment.excerpt) {
      lines.push(`  excerpt: ${attachment.excerpt.replace(/\n/g, " ")}`);
    }
  }

  return lines.join("\n");
}

export function selectRelevantAttachmentEvidence(
  attachments,
  prompt,
  { maxChunks = 6, maxChars = 7000 } = {}
) {
  const candidates = (attachments || [])
    .flatMap((attachment) => attachment.chunks || [])
    .map((chunk) => ({
      ...chunk,
      score: scoreChunkAgainstPrompt(chunk, prompt)
    }))
    .sort((left, right) => right.score - left.score);

  const selected = [];
  const coveredAttachments = new Set();
  let remainingChars = maxChars;

  for (const candidate of candidates) {
    if (selected.length >= maxChunks || remainingChars <= 0) {
      break;
    }

    if (
      coveredAttachments.has(candidate.attachmentId) &&
      selected.length >= Math.max(2, attachments.length)
    ) {
      continue;
    }

    const text = truncateText(candidate.text, Math.min(remainingChars, 1200));
    if (!text) {
      continue;
    }

    selected.push({
      ...candidate,
      text
    });
    coveredAttachments.add(candidate.attachmentId);
    remainingChars -= text.length;
  }

  return selected;
}

export function buildAttachmentModelMessages(attachments, evidence = []) {
  const metadataMessages = (attachments || []).map((attachment) => {
    const lines = [
      "Attached file metadata is available for direct use.",
      `Filename: ${attachment.originalName}`,
      `Kind: ${attachment.kind}`,
      `Content family: ${attachment.contentFamily}`,
      `Parser: ${attachment.parser}`,
      `Extractor: ${attachment.extractorId}`,
      `Parse status: ${attachment.parseStatus}`,
      `Summary: ${attachment.summaryText}`,
      `Handling hint: ${getAttachmentHandlingHint(attachment)}`
    ];

    if (attachment.excerpt) {
      lines.push("Extracted excerpt:");
      lines.push(attachment.excerpt);
    } else {
      lines.push(
        "No readable text could be extracted from this file. Use metadata only and say that extraction quality is insufficient if needed."
      );
    }

    return {
      role: "system",
      content: lines.join("\n\n")
    };
  });

  const evidenceMessages = evidence.map((chunk, index) => ({
    role: "system",
    content: [
      `Attachment evidence ${index + 1}:`,
      `Filename: ${chunk.filename}`,
      `Kind: ${chunk.kind}`,
      `Content family: ${chunk.contentFamily}`,
      `Section: ${chunk.sectionTitle}`,
      `Relevance score: ${chunk.score.toFixed(2)}`,
      "Use this extracted file content directly:",
      chunk.text
    ].join("\n\n")
  }));

  return [...metadataMessages, ...evidenceMessages];
}

export function buildAttachmentRoutingHint(attachments = []) {
  const hints = [];
  const kinds = new Set(attachments.map((attachment) => attachment.kind));
  const families = new Set(attachments.map((attachment) => attachment.contentFamily));

  if (families.has("technical")) {
    hints.push(
      "When technical files are attached, reason from visible code, configuration keys, and technical structure."
    );
  }

  if (families.has("data")) {
    hints.push(
      "When tabular or structured data files are attached, refer to sheets, rows, columns, headers, and sample values directly."
    );
  }

  if (kinds.has("presentation")) {
    hints.push(
      "When slide decks are attached, reason from extracted slide text and structure your answer by slide themes when relevant."
    );
  }

  if (kinds.has("archive")) {
    hints.push(
      "When archives are attached, use listed entries and extracted previews only. Do not invent files or unseen archive contents."
    );
  }

  if (kinds.has("image")) {
    hints.push(
      "When images are attached, rely on OCR text and metadata only, and mention OCR limits if visual details may be missing."
    );
  }

  if (families.has("binary_like")) {
    hints.push(
      "If a file has metadata only, do not pretend to have full content. Use filename, type, and available metadata."
    );
  }

  return hints.join(" ");
}

export function derivePromptFromAttachments(attachments) {
  if (!attachments.length) {
    return "";
  }

  const families = summarizeAttachmentMix(attachments);
  const familyCount = Object.keys(families).length;

  if (familyCount === 1 && families.technical) {
    return "Review the attached technical files and explain their structure, behavior, and any concrete issues.";
  }

  if (familyCount === 1 && families.data) {
    return "Analyze the attached data files and summarize their structure, key fields, and notable values.";
  }

  if (familyCount === 1 && families.image) {
    return "Analyze the attached images using extracted OCR text and metadata, and mention if extraction is partial.";
  }

  if (familyCount === 1 && families.document) {
    return "Analyze the attached documents and highlight the most relevant information.";
  }

  if (familyCount === 1 && families.binary_like) {
    return "Inspect the attached files using available metadata and explain what can and cannot be inferred.";
  }

  return "Analyze the attached files together, combining documents, code, data, images, and metadata as available.";
}

export function buildUserMessageContent(prompt, attachments) {
  const cleanPrompt = String(prompt || "").trim() || derivePromptFromAttachments(attachments);
  if (!attachments.length) {
    return cleanPrompt;
  }

  return [
    cleanPrompt,
    "",
    "Attached files:",
    ...attachments.map(
      (attachment) =>
        `- ${attachment.originalName} (${attachment.kind}, ${attachment.contentFamily}, ${attachment.sizeLabel})`
    )
  ].join("\n");
}

export function serializeAttachmentsForClient(attachments) {
  return attachments.map((attachment) => ({
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    kind: attachment.kind,
    contentFamily: attachment.contentFamily,
    parser: attachment.parser,
    extractorId: attachment.extractorId,
    profileTags: attachment.profileTags,
    sizeBytes: attachment.sizeBytes,
    sizeLabel: attachment.sizeLabel,
    parseStatus: attachment.parseStatus,
    summaryText: attachment.summaryText,
    excerpt: attachment.excerpt,
    sectionCount: attachment.sections?.length || 0,
    chunkCount: attachment.chunks?.length || 0
  }));
}

export function listAttachmentExtractors() {
  return {
    extractors: listRegisteredExtractors(),
    supportedKinds: listSupportedAttachmentKinds()
  };
}

export async function extractAttachments(uploadedFiles = []) {
  const files = Array.isArray(uploadedFiles) ? uploadedFiles : [];

  if (!files.length) {
    return [];
  }

  let totalCharsRemaining = config.attachments.maxTotalExtractChars;
  const attachments = [];

  for (const file of files.slice(0, config.attachments.maxFiles)) {
    const kind = inferAttachmentKind(file);
    const contentFamily = inferContentFamily(kind);
    const warnings = [];
    const originalName = file.originalname || file.filename || "attachment";
    let extractedText = "";
    let extractedSections = [];
    let parser = "metadata-only";
    let extractorId = "metadata-only";
    let parseStatus = "metadata_only";

    try {
      const extracted = await extractContentForAttachment(file, kind);
      extractedText = normalizeWhitespace(extracted.text || "");
      extractedSections = Array.isArray(extracted.sections) ? extracted.sections : [];
      parser = extracted.parser || parser;
      extractorId = extracted.extractorId || extractorId;
    } catch (error) {
      warnings.push(error.message || "Extraction failed");
    }

    if (!extractedText && ["binary", "media"].includes(kind)) {
      warnings.push("Readable text extraction is not available for this format yet");
    }

    if (!extractedText && kind === "image" && config.attachments.enableOcr) {
      warnings.push("No OCR text could be extracted from the image");
    }

    if (kind === "image" && !config.attachments.enableOcr) {
      warnings.push("OCR is disabled");
    }

    if (extractedText) {
      const allowedChars = Math.min(
        config.attachments.maxExtractCharsPerFile,
        totalCharsRemaining
      );

      if (allowedChars > 0) {
        extractedText = truncateText(extractedText, allowedChars);
        totalCharsRemaining = Math.max(0, totalCharsRemaining - extractedText.length);
        parseStatus = kind === "image" ? "ocr_extracted" : "extracted";
      } else {
        extractedText = "";
        extractedSections = [];
        warnings.push("Global attachment context budget reached");
      }
    }

    const attachment = {
      id: randomUUID(),
      originalName,
      mimeType: file.mimetype || "application/octet-stream",
      extension: extname(originalName),
      sizeBytes: file.size || 0,
      sizeLabel: formatBytes(file.size || 0),
      kind,
      contentFamily,
      parser,
      extractorId,
      parseStatus,
      extractedText,
      extractedCharacters: extractedText.length,
      excerpt: extractedText ? truncateText(extractedText, 900) : "",
      warnings
    };

    attachment.profileTags = inferProfileTags(
      originalName,
      extractedText,
      kind,
      contentFamily
    );
    attachment.sections = extractedText
      ? buildSections(extractedText, attachment, extractedSections)
      : [];
    attachment.chunks = extractedText ? buildChunks(attachment.sections, attachment) : [];
    attachment.summaryText = buildAttachmentSummary(attachment);
    attachments.push(attachment);
  }

  return attachments;
}

export function assertChatPayload(prompt, attachments) {
  if (!String(prompt || "").trim() && !attachments.length) {
    throw new AppError("prompt or at least one attachment is required", 400);
  }
}
