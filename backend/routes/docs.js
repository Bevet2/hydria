import { Router } from "express";
import * as cheerio from "cheerio";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import PDFDocument from "pdfkit";
import { AppError } from "../utils/errors.js";

const router = Router();
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_EMBEDDED_IMAGES = 8;
const MAX_IMAGE_BYTES = 1_000_000;
const MAX_DOCUMENT_IMAGE_BYTES = 3_000_000;

function nativeImageSize(buffer, type) {
  if (type === "png") {
    if (buffer.length < 24 || buffer.subarray(0,8).toString("hex") !== "89504e470d0a1a0a") {
      throw new AppError("Invalid embedded PNG image", 400);
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new AppError("Invalid embedded JPEG image", 400);
  }
  for (let offset = 2; offset + 9 < buffer.length;) {
    if (buffer[offset] !== 0xff) { offset++; continue; }
    let marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new AppError("Unsupported embedded JPEG image", 400);
}

function parseImageLength(value) {
  const match = String(value || "").match(/^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i);
  return match ? Number(match[1]) : null;
}

function prepareEmbeddedImages($) {
  const images = new WeakMap();
  let count = 0, totalBytes = 0;
  $("img").each((_, node) => {
    const src = String(node.attribs?.src || "").trim();
    if (!src.startsWith("data:image/")) return;
    const match = src.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) return; // SVG, external URL and unsupported formats use alt fallback.
    count++;
    if (count > MAX_EMBEDDED_IMAGES) throw new AppError("Too many embedded document images (max 8)", 413);
    if (match[2].length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4) {
      throw new AppError("Document image exceeds 1 MB", 413);
    }
    const data = Buffer.from(match[2], "base64");
    totalBytes += data.length;
    if (data.length > MAX_IMAGE_BYTES || totalBytes > MAX_DOCUMENT_IMAGE_BYTES) {
      throw new AppError("Document embedded images exceed size limits", 413);
    }
    const type = match[1].toLowerCase() === "png" ? "png" : "jpg";
    const original = nativeImageSize(data, type);
    if (!original.width || !original.height || original.width > 4096 || original.height > 4096) {
      throw new AppError("Embedded image dimensions are invalid or too large", 413);
    }
    const css = String(node.attribs?.style || "");
    const cssWidth = css.match(/(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1];
    const cssHeight = css.match(/(?:^|;)\s*height\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1];
    const preferredWidth = parseImageLength(node.attribs?.width) ?? parseImageLength(cssWidth);
    const preferredHeight = parseImageLength(node.attribs?.height) ?? parseImageLength(cssHeight);
    let width = preferredWidth || (preferredHeight ? preferredHeight * original.width / original.height : Math.min(original.width, 500));
    let height = preferredHeight || width * original.height / original.width;
    const scale = Math.min(1, 520 / width, 650 / height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    images.set(node, { data, type, width, height, alt: String(node.attribs?.alt || "Image").slice(0, 200) });
  });
  return images;
}
function docxImageRun(image) {
  return new ImageRun({
    type: image.type, data: image.data,
    transformation: { width: image.width, height: image.height },
    altText: { name: image.alt || "Image", title: image.alt || "Image", description: image.alt || "Image" }
  });
}


function safeExportFilename(value = "hydria-document.docx", extension = "docx") {
  const fallback = `hydria-document.${extension}`;
  const name = String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return (name || fallback).toLowerCase().endsWith(`.${extension}`) ? name || fallback : `${name || "hydria-document"}.${extension}`;
}

function normalizeDocumentExportPayload(body = {}) {
  const html = String(body.html || "").trim();
  const title = String(body.title || "Hydria Document").trim() || "Hydria Document";
  if (!html && !String(body.text || "").trim()) {
    throw new AppError("No document content provided", 400);
  }
  return {
    title,
    html: html || `<p>${escapeHtml(String(body.text || ""))}</p>`,
    text: String(body.text || "").trim()
  };
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNodeText($, node) {
  return String($(node).text() || "").replace(/\u00a0/g, " ").trim();
}

function getTagName(node = {}) {
  return String(node?.name || "").toLowerCase();
}

function isListNode(node = {}) {
  const tagName = getTagName(node);
  return tagName === "ul" || tagName === "ol";
}

function getNodeTextWithoutNestedLists(node = {}) {
  const chunks = [];
  const walk = (currentNode) => {
    if (!currentNode) {
      return;
    }
    if (currentNode.type === "text") {
      chunks.push(currentNode.data || "");
      return;
    }
    if (currentNode.type !== "tag" || isListNode(currentNode) || getTagName(currentNode) === "table") {
      return;
    }
    (currentNode.children || []).forEach(walk);
  };
  (node.children || []).forEach(walk);
  return chunks.join(" ").replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

function parseCssStyle(value = "") {
  return String(value || "")
    .split(";")
    .map((entry) => entry.split(":"))
    .filter((entry) => entry.length >= 2)
    .reduce((style, [key, ...rawValue]) => {
      style[String(key || "").trim().toLowerCase()] = rawValue.join(":").trim();
      return style;
    }, {});
}

function normalizeHexColor(value = "") {
  const text = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) {
    return text.slice(1).toUpperCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(text)) {
    return text
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toUpperCase();
  }
  return "";
}

function parseFontSizeToHalfPoints(value = "") {
  const numeric = Number.parseFloat(String(value || "").replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  return Math.max(12, Math.round(numeric * 1.5));
}

function mergeInlineStyle(base = {}, node = {}) {
  const tagName = String(node.name || "").toLowerCase();
  const css = parseCssStyle(node.attribs?.style || "");
  const next = { ...base };
  if (["strong", "b"].includes(tagName) || /bold/i.test(css["font-weight"] || "")) {
    next.bold = true;
  }
  if (["em", "i"].includes(tagName) || /italic/i.test(css["font-style"] || "")) {
    next.italics = true;
  }
  if (["u"].includes(tagName) || /underline/i.test(css["text-decoration"] || "")) {
    next.underline = true;
  }
  if (["s", "strike", "del"].includes(tagName) || /line-through/i.test(css["text-decoration"] || "")) {
    next.strike = true;
  }
  const color = normalizeHexColor(css.color);
  if (color) {
    next.color = color;
  }
  const size = parseFontSizeToHalfPoints(css["font-size"]);
  if (size) {
    next.size = size;
  }
  return next;
}

function collectDocxTextRuns($, node, inheritedStyle = {}, images = null) {
  if (!node) {
    return [];
  }
  if (node.type === "text") {
    const text = String(node.data || "").replace(/\s+/g, " ");
    return text ? [new TextRun({ text, ...inheritedStyle, underline: inheritedStyle.underline ? {} : undefined })] : [];
  }
  if (node.type !== "tag") {
    return [];
  }
  const tagName = String(node.name || "").toLowerCase();
  if (tagName === "img" && images?.has(node)) return [docxImageRun(images.get(node))];
  if (tagName === "br") {
    return [new TextRun({ text: "\n" })];
  }
  const nextStyle = mergeInlineStyle(inheritedStyle, node);
  return (node.children || []).flatMap((child) => collectDocxTextRuns($, child, nextStyle, images));
}

function collectDocxInlineTextRuns($, node, inheritedStyle = {}, images = null) {
  if (!node) {
    return [];
  }
  if (node.type === "text") {
    const text = String(node.data || "").replace(/\s+/g, " ");
    return text.trim() ? [new TextRun({ text, ...inheritedStyle, underline: inheritedStyle.underline ? {} : undefined })] : [];
  }
  if (node.type !== "tag" || isListNode(node) || getTagName(node) === "table") {
    return [];
  }
  if (getTagName(node) === "img" && images?.has(node)) return [docxImageRun(images.get(node))];
  if (getTagName(node) === "br") {
    return [new TextRun({ text: "\n" })];
  }
  const nextStyle = mergeInlineStyle(inheritedStyle, node);
  return (node.children || []).flatMap((child) => collectDocxInlineTextRuns($, child, nextStyle, images));
}

function collectDocxListItemRuns($, itemNode, images = null) {
  const runs = (itemNode.children || []).flatMap((child) => collectDocxInlineTextRuns($, child, {}, images));
  if (runs.length) {
    return runs;
  }
  const fallbackText = getNodeTextWithoutNestedLists(itemNode);
  return fallbackText ? [new TextRun(fallbackText)] : [new TextRun("")];
}

function createDocxParagraph($, node, options = {}, images = null) {
  const runs = collectDocxTextRuns($, node, {}, images);
  const text = runs.length ? undefined : getNodeText($, node);
  return new Paragraph({
    heading: options.heading,
    bullet: options.bullet ? { level: 0 } : undefined,
    children: runs.length ? runs : [new TextRun(text || "")],
    spacing: { after: options.after ?? 160 }
  });
}

function appendDocxList(children, $, listNode, level = 0, images = null) {
  const tagName = getTagName(listNode);
  let orderedIndex = 1;
  (listNode.children || []).forEach((child) => {
    if (child.type !== "tag") {
      return;
    }
    if (getTagName(child) === "li") {
      const runs = collectDocxListItemRuns($, child, images);
      const safeLevel = Math.min(Math.max(level, 0), 8);
      if (tagName === "ol") {
        children.push(
          new Paragraph({
            children: [new TextRun(`${orderedIndex}. `), ...runs],
            indent: { left: 360 * safeLevel, hanging: safeLevel ? 180 : 0 },
            spacing: { after: 80 }
          })
        );
      } else {
        children.push(
          new Paragraph({
            bullet: { level: safeLevel },
            children: runs,
            spacing: { after: 80 }
          })
        );
      }
      orderedIndex += 1;
      (child.children || [])
        .filter((nestedChild) => nestedChild.type === "tag" && isListNode(nestedChild))
        .forEach((nestedList) => appendDocxList(children, $, nestedList, level + 1, images));
      return;
    }

    // Browsers can produce invalid-but-common contenteditable HTML such as
    // <ul><li>Parent</li><ul><li>Child</li></ul></ul>. Keep those children.
    if (isListNode(child)) {
      appendDocxList(children, $, child, level + 1, images);
    }
  });
}

function appendDocxTable(children, $, tableNode) {
  const rows = [];
  $(tableNode)
    .find("tr")
    .each((_, rowNode) => {
      const cells = [];
      $(rowNode)
        .children("th,td")
        .each((__, cellNode) => {
          const cellText = getNodeText($, cellNode);
          cells.push(
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: cellText, bold: String(cellNode.name).toLowerCase() === "th" })]
                })
              ]
            })
          );
        });
      if (cells.length) {
        rows.push(new TableRow({ children: cells }));
      }
    });
  if (rows.length) {
    children.push(
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
  }
}

function appendDocxNode(children, $, node, images = null) {
  if (!node) {
    return;
  }
  if (node.type === "text") {
    const text = String(node.data || "").trim();
    if (text) {
      children.push(new Paragraph({ children: [new TextRun(text)] }));
    }
    return;
  }
  if (node.type !== "tag") {
    return;
  }
  const tagName = getTagName(node);
  if (tagName === "h1") {
    children.push(createDocxParagraph($, node, { heading: HeadingLevel.HEADING_1, after: 220 }, images));
    return;
  }
  if (tagName === "h2") {
    children.push(createDocxParagraph($, node, { heading: HeadingLevel.HEADING_2, after: 180 }, images));
    return;
  }
  if (tagName === "h3" || tagName === "h4") {
    children.push(createDocxParagraph($, node, { heading: HeadingLevel.HEADING_3, after: 160 }, images));
    return;
  }
  if (tagName === "p" || tagName === "blockquote" || tagName === "figcaption") {
    children.push(createDocxParagraph($, node, {}, images));
    return;
  }
  if (tagName === "ul" || tagName === "ol") {
    appendDocxList(children, $, node, 0, images);
    return;
  }
  if (tagName === "table") {
    appendDocxTable(children, $, node);
    return;
  }
  if (tagName === "hr") {
    children.push(new Paragraph({ children: [new TextRun("____________________________")] }));
    return;
  }
  if (tagName === "img") {
    const image = images?.get(node);
    if (image) {
      children.push(new Paragraph({ children: [docxImageRun(image)] }));
    } else {
      const alt = String(node.attribs?.alt || "Image").trim();
      children.push(new Paragraph({ children: [new TextRun(`[${alt}]`)] }));
    }
    return;
  }
  (node.children || []).forEach((child) => appendDocxNode(children, $, child, images));
}

function extractDocsPageSettings($) {
  const node = $(".workspace-docs-page-meta").first();
  const enabled = String(node.attr("data-show-header-footer") || "") === "true";
  const pageNumbers = String(node.attr("data-show-page-numbers") || "") === "true";
  const pageMargins = ["narrow", "wide"].includes(node.attr("data-page-margins"))
    ? node.attr("data-page-margins")
    : "normal";
  const margin = pageMargins === "narrow" ? 720 : pageMargins === "wide" ? 2160 : 1440;
  const pageSize = node.attr("data-page-size") === "letter" ? "letter" : "a4";
  const orientation = node.attr("data-page-orientation") === "landscape"
    ? PageOrientation.LANDSCAPE
    : PageOrientation.PORTRAIT;
  const dimensions = pageSize === "letter"
    ? { width: 12240, height: 15840 }
    : { width: 11906, height: 16838 };
  const pageNumberStart = Math.max(1, Number.parseInt(node.attr("data-page-number-start") || "1", 10) || 1);
  const settings = {
    enabled,
    pageNumbers,
    headerText: String(node.attr("data-header-text") || ""),
    footerText: String(node.attr("data-footer-text") || ""),
    pageNumberPosition: node.attr("data-page-number-position") === "header" ? "header" : "footer",
    showPageNumberOnFirstPage: node.attr("data-page-number-show-on-first-page") !== "false",
    pageNumberStart,
    size: { ...dimensions, orientation },
    margin: {
      top: margin,
      right: margin,
      bottom: margin,
      left: margin,
      header: 540,
      footer: 540
    }
  };
  node.remove();
  return settings;
}

function buildDocxHeaderFooterParagraphs(text = "", showPageNumber = false) {
  const children = [];
  if (text) {
    children.push(new Paragraph({ children: [new TextRun(text)] }));
  }
  if (showPageNumber) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: [PageNumber.CURRENT] })]
      })
    );
  }
  return children.length ? children : [new Paragraph({ children: [] })];
}

async function buildDocxBuffer({ title, html }) {
  const $ = cheerio.load(`<main>${html}</main>`);
  const pageSettings = extractDocsPageSettings($);
  const images = prepareEmbeddedImages($);
  const children = [];
  $("main")
    .contents()
    .each((_, node) => appendDocxNode(children, $, node, images));

  const document = new Document({
    creator: "Hydria",
    title,
    settings: {
      updateFields: true
    },
    sections: [
      {
        properties: {
          page: {
            size: pageSettings.size,
            margin: pageSettings.margin,
            pageNumbers: { start: pageSettings.pageNumberStart }
          },
          titlePage: !pageSettings.showPageNumberOnFirstPage
        },
        headers:
          pageSettings.enabled || (pageSettings.pageNumbers && pageSettings.pageNumberPosition === "header")
            ? {
                default: new Header({
                  children: buildDocxHeaderFooterParagraphs(
                    pageSettings.headerText,
                    pageSettings.pageNumbers && pageSettings.pageNumberPosition === "header"
                  )
                })
              }
            : undefined,
        footers:
          pageSettings.enabled || (pageSettings.pageNumbers && pageSettings.pageNumberPosition === "footer")
            ? {
                default: new Footer({
                  children: buildDocxHeaderFooterParagraphs(
                    pageSettings.footerText,
                    pageSettings.pageNumbers && pageSettings.pageNumberPosition === "footer"
                  )
                })
              }
            : undefined,
        children: children.length ? children : [new Paragraph({ text: title, heading: HeadingLevel.TITLE })]
      }
    ]
  });
  return Packer.toBuffer(document);
}

function drawPdfTable(doc, $, tableNode) {
  const rows = [];
  $(tableNode)
    .find("tr")
    .each((_, rowNode) => {
      rows.push(
        $(rowNode)
          .children("th,td")
          .map((__, cellNode) => getNodeText($, cellNode))
          .get()
      );
    });
  if (!rows.length) {
    return;
  }
  const maxColumns = Math.max(...rows.map((row) => row.length), 1);
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cellWidth = usableWidth / maxColumns;
  const rowHeight = 24;
  rows.forEach((row, rowIndex) => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
    const y = doc.y;
    row.forEach((cell, columnIndex) => {
      const x = doc.page.margins.left + columnIndex * cellWidth;
      doc.rect(x, y, cellWidth, rowHeight).strokeColor("#d0d7de").stroke();
      doc
        .font(rowIndex === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .fillColor("#111827")
        .text(String(cell || ""), x + 5, y + 7, { width: cellWidth - 10, height: rowHeight - 8 });
    });
    doc.y = y + rowHeight;
  });
  doc.moveDown(0.6);
}

function writePdfList(doc, $, listNode, level = 0) {
  const tagName = getTagName(listNode);
  let orderedIndex = 1;
  const left = doc.page.margins.left + level * 18;
  const width = doc.page.width - doc.page.margins.right - left;

  (listNode.children || []).forEach((child) => {
    if (child.type !== "tag") {
      return;
    }
    if (getTagName(child) === "li") {
      const marker = tagName === "ol" ? `${orderedIndex}.` : "-";
      const text = getNodeTextWithoutNestedLists(child) || getNodeText($, child);
      if (text) {
        doc.font("Helvetica").fontSize(11).fillColor("#111827").text(`${marker} ${text}`, left, doc.y, {
          width,
          lineGap: 2
        });
      }
      orderedIndex += 1;
      (child.children || [])
        .filter((nestedChild) => nestedChild.type === "tag" && isListNode(nestedChild))
        .forEach((nestedList) => writePdfList(doc, $, nestedList, level + 1));
      return;
    }

    if (isListNode(child)) {
      writePdfList(doc, $, child, level + 1);
    }
  });

  if (level === 0) {
    doc.moveDown(0.45);
  }
}

function writePdfNode(doc, $, node, images = null) {
  if (!node) {
    return;
  }
  if (node.type === "text") {
    const text = String(node.data || "").trim();
    if (text) {
      doc.font("Helvetica").fontSize(11).fillColor("#111827").text(text, { lineGap: 2 });
      doc.moveDown(0.3);
    }
    return;
  }
  if (node.type !== "tag") {
    return;
  }
  const tagName = getTagName(node);
  const text = getNodeText($, node);
  if (!text && !["table", "hr", "img", "ul", "ol"].includes(tagName)) {
    (node.children || []).forEach((child) => writePdfNode(doc, $, child, images));
    return;
  }
  if (tagName === "h1") {
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#111827").text(text);
    doc.moveDown(0.55);
    return;
  }
  if (tagName === "h2") {
    doc.font("Helvetica-Bold").fontSize(17).fillColor("#111827").text(text);
    doc.moveDown(0.45);
    return;
  }
  if (tagName === "h3" || tagName === "h4") {
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text(text);
    doc.moveDown(0.35);
    return;
  }
  if ((tagName === "p" || tagName === "figure") && $(node).find("img").length) {
    (node.children || []).forEach((child) => writePdfNode(doc, $, child, images));
    doc.moveDown(0.2);
    return;
  }
  if (tagName === "p" || tagName === "blockquote" || tagName === "figcaption") {
    doc.font(tagName === "blockquote" ? "Helvetica-Oblique" : "Helvetica").fontSize(11).fillColor("#111827").text(text, { lineGap: 3 });
    doc.moveDown(0.45);
    return;
  }
  if (tagName === "ul" || tagName === "ol") {
    writePdfList(doc, $, node);
    return;
  }
  if (tagName === "table") {
    drawPdfTable(doc, $, node);
    return;
  }
  if (tagName === "hr") {
    doc.moveDown(0.25);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#d0d7de").stroke();
    doc.moveDown(0.75);
    return;
  }
  if (tagName === "img") {
    const image = images?.get(node);
    if (image) {
      const maxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const maxHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 12;
      const scale = Math.min(1, maxWidth / (image.width * 0.75),
        maxHeight / (image.height * 0.75));
      const width = image.width * 0.75 * scale;
      const height = image.height * 0.75 * scale;
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
      try {
        doc.image(image.data, doc.page.margins.left, doc.y, { width, height });
      } catch {
        throw new AppError("Unable to render embedded document image", 400);
      }
      doc.y += height + 12;
    } else {
      const alt = String(node.attribs?.alt || "Image").trim();
      doc.font("Helvetica-Oblique").fontSize(10).fillColor("#4b5563").text(`[${alt}]`);
      doc.moveDown(0.45);
    }
    return;
  }
  (node.children || []).forEach((child) => writePdfNode(doc, $, child, images));
}

async function buildPdfBuffer({ title, html }) {
  const $ = cheerio.load(`<main>${html}</main>`);
  const pageSettings = extractDocsPageSettings($);
  const marginPoints = Math.max(24, Math.round((pageSettings.margin.top || 1440) / 20));
  const images = prepareEmbeddedImages($);
  const doc = new PDFDocument({
    margin: marginPoints,
    size: pageSettings.size.width === 12240 ? "LETTER" : "A4",
    layout: pageSettings.size.orientation === PageOrientation.LANDSCAPE ? "landscape" : "portrait"
  });
  const chunks = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.info.Title = title;
    $("main")
      .contents()
      .each((_, node) => writePdfNode(doc, $, node, images));
    doc.end();
  });
}

router.post("/export-docx", async (req, res, next) => {
  try {
    const payload = normalizeDocumentExportPayload(req.body || {});
    const buffer = await buildDocxBuffer(payload);
    res.setHeader("Content-Type", DOCX_MIME_TYPE);
    res.setHeader("Content-Disposition", `attachment; filename="${safeExportFilename(req.body?.filename, "docx")}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.post("/export-pdf", async (req, res, next) => {
  try {
    const payload = normalizeDocumentExportPayload(req.body || {});
    const buffer = await buildPdfBuffer(payload);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeExportFilename(req.body?.filename, "pdf")}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
