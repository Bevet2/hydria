import { Router } from "express";
import PDFDocument from "pdfkit";
import { AppError } from "../utils/errors.js";

const router = Router();
const CANVAS_DEFAULT_WIDTH = 1800;
const CANVAS_DEFAULT_HEIGHT = 1200;
const CANVAS_LINK_COLOR = "#6b7280";
const CANVAS_SHAPES = new Set([
  "rect",
  "rounded",
  "pill",
  "circle",
  "triangle",
  "diamond",
  "hexagon",
  "parallelogram"
]);
const CANVAS_SHAPE_DIMENSIONS = {
  rect: { width: 180, height: 120 },
  rounded: { width: 180, height: 120 },
  pill: { width: 220, height: 120 },
  circle: { width: 180, height: 180 },
  triangle: { width: 220, height: 180 },
  diamond: { width: 200, height: 180 },
  hexagon: { width: 220, height: 160 },
  parallelogram: { width: 220, height: 140 }
};

function safeExportFilename(value = "hydria-canvas.pdf", extension = "pdf") {
  const fallback = `hydria-canvas.${extension}`;
  const name = String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return (name || fallback).toLowerCase().endsWith(`.${extension}`) ? name || fallback : `${name || "hydria-canvas"}.${extension}`;
}

function clampNumber(value, fallback, min = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(min, Math.round(numeric));
}

function normalizeColor(value = "", fallback = "#d1d5db") {
  const normalized = String(value || "").trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized) ? normalized : fallback;
}

function toPlainText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeDataImageSrc(value = "") {
  const match = String(value || "").match(/^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/i);
  if (!match?.[1]) {
    return null;
  }
  try {
    return Buffer.from(match[1].replace(/\s+/g, ""), "base64");
  } catch {
    return null;
  }
}

function getCanvasShapeSize(shape = "rect") {
  return CANVAS_SHAPE_DIMENSIONS[shape] || CANVAS_SHAPE_DIMENSIONS.rect;
}

function normalizeCanvasElement(raw = {}, index = 0) {
  const type = ["note", "text", "shape", "image", "video"].includes(String(raw.type || raw.kind || "").toLowerCase())
    ? String(raw.type || raw.kind || "").toLowerCase()
    : "note";
  const normalizedShape = String(raw.shape || "rect").trim().toLowerCase();
  const shape = CANVAS_SHAPES.has(normalizedShape) ? normalizedShape : "rect";
  const shapeSize = getCanvasShapeSize(shape);

  return {
    id: String(raw.id || `canvas-${index + 1}`),
    type,
    title: String(raw.title || raw.label || (type === "shape" ? "Shape" : type === "image" ? "Image" : type === "video" ? "Video" : "Untitled")).trim(),
    body: String(raw.body || raw.note || raw.text || "").trim(),
    src: String(raw.src || raw.imageUrl || raw.videoUrl || "").trim(),
    poster: String(raw.poster || raw.preview || "").trim(),
    mimeType: String(raw.mimeType || "").trim().toLowerCase(),
    x: clampNumber(raw.x, 120 + (index % 3) * 260, 0),
    y: clampNumber(raw.y, 120 + Math.floor(index / 3) * 180, 0),
    width: clampNumber(raw.width ?? raw.w, type === "shape" ? shapeSize.width : type === "video" ? 320 : 280, 80),
    height: clampNumber(raw.height ?? raw.h, type === "shape" ? shapeSize.height : type === "video" ? 220 : 160, 60),
    zIndex: clampNumber(raw.zIndex, index + 1, 1),
    color: normalizeColor(
      raw.color,
      type === "note" ? "#f6d365" : type === "text" ? "#dfe8ff" : type === "video" ? "#ffffff" : "#f4d35e"
    ),
    textColor: normalizeColor(raw.textColor, "#1f2937"),
    shape
  };
}

function normalizeCanvasLink(raw = {}, index = 0) {
  const from = String(raw.from || raw.fromId || raw.sourceId || "").trim();
  const to = String(raw.to || raw.toId || raw.targetId || "").trim();
  if (!from || !to || from === to) {
    return null;
  }
  return {
    id: String(raw.id || `canvas-link-${index + 1}`),
    from,
    to,
    label: String(raw.label || raw.title || "").trim(),
    color: normalizeColor(raw.color, CANVAS_LINK_COLOR),
    zIndex: clampNumber(raw.zIndex, index + 1, 1)
  };
}

function sanitizeCanvasLinks(items = [], elements = []) {
  const ids = new Set(elements.map((element) => element.id));
  const seen = new Set();
  return items
    .map((item, index) => normalizeCanvasLink(item, index))
    .filter((link) => {
      if (!link || !ids.has(link.from) || !ids.has(link.to)) {
        return false;
      }
      const key = `${link.from}->${link.to}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((link, index) => ({
      ...link,
      zIndex: index + 1
    }));
}

function normalizeCanvasExportPayload(body = {}) {
  const elements = Array.isArray(body.elements)
    ? body.elements.map((item, index) => normalizeCanvasElement(item, index))
    : [];
  const links = sanitizeCanvasLinks(Array.isArray(body.links) ? body.links : [], elements);

  return {
    filename: safeExportFilename(body.filename, "pdf"),
    title: String(body.title || "Canvas").trim() || "Canvas",
    boardWidth: clampNumber(body.boardWidth, CANVAS_DEFAULT_WIDTH, 320),
    boardHeight: clampNumber(body.boardHeight, CANVAS_DEFAULT_HEIGHT, 240),
    elements: elements
      .slice()
      .sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0)),
    links
  };
}

function getCanvasItemCenter(item = {}) {
  return {
    x: (Number(item.x) || 0) + ((Number(item.width) || 0) / 2),
    y: (Number(item.y) || 0) + ((Number(item.height) || 0) / 2)
  };
}

function getCanvasLinkAnchor(source = {}, target = {}) {
  const sourceCenter = getCanvasItemCenter(source);
  const targetCenter = getCanvasItemCenter(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? (Number(source.x) || 0) + (Number(source.width) || 0) : Number(source.x) || 0,
      y: sourceCenter.y
    };
  }

  return {
    x: sourceCenter.x,
    y: dy >= 0 ? (Number(source.y) || 0) + (Number(source.height) || 0) : Number(source.y) || 0
  };
}

function getCanvasCubicPoint(t = 0.5, p0 = {}, p1 = {}, p2 = {}, p3 = {}) {
  const mt = 1 - t;
  const x =
    (mt ** 3 * p0.x) +
    (3 * mt ** 2 * t * p1.x) +
    (3 * mt * t ** 2 * p2.x) +
    (t ** 3 * p3.x);
  const y =
    (mt ** 3 * p0.y) +
    (3 * mt ** 2 * t * p1.y) +
    (3 * mt * t ** 2 * p2.y) +
    (t ** 3 * p3.y);
  return { x, y };
}

function describeCanvasLinkPath(fromItem = {}, toItem = {}) {
  const start = getCanvasLinkAnchor(fromItem, toItem);
  const end = getCanvasLinkAnchor(toItem, fromItem);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const directionX = Math.sign(dx) || 1;
  const directionY = Math.sign(dy) || 1;
  const controlDistance = Math.max(
    48,
    Math.min(220, horizontal ? Math.abs(dx) * 0.45 : Math.abs(dy) * 0.45)
  );
  const controlStart = horizontal
    ? { x: start.x + (directionX * controlDistance), y: start.y }
    : { x: start.x, y: start.y + (directionY * controlDistance) };
  const controlEnd = horizontal
    ? { x: end.x - (directionX * controlDistance), y: end.y }
    : { x: end.x, y: end.y - (directionY * controlDistance) };

  return {
    start,
    end,
    controlStart,
    controlEnd,
    midpoint: getCanvasCubicPoint(0.5, start, controlStart, controlEnd, end)
  };
}

function getShapeLabelBounds(shape = "rect", x = 0, y = 0, width = 100, height = 100) {
  switch (shape) {
    case "triangle":
      return { x: x + (width * 0.22), y: y + (height * 0.44), width: width * 0.56, height: height * 0.34 };
    case "diamond":
      return { x: x + (width * 0.22), y: y + (height * 0.26), width: width * 0.56, height: height * 0.48 };
    case "hexagon":
      return { x: x + (width * 0.19), y: y + (height * 0.24), width: width * 0.62, height: height * 0.52 };
    case "parallelogram":
      return { x: x + (width * 0.16), y: y + (height * 0.24), width: width * 0.68, height: height * 0.48 };
    case "circle":
      return { x: x + (width * 0.16), y: y + (height * 0.22), width: width * 0.68, height: height * 0.56 };
    case "pill":
      return { x: x + (width * 0.14), y: y + (height * 0.24), width: width * 0.72, height: height * 0.44 };
    default:
      return { x: x + (width * 0.12), y: y + (height * 0.24), width: width * 0.76, height: height * 0.48 };
  }
}

function drawShapePath(doc, shape = "rect", x = 0, y = 0, width = 100, height = 100) {
  const right = x + width;
  const bottom = y + height;
  const midX = x + (width / 2);
  const midY = y + (height / 2);

  if (shape === "rounded") {
    doc.roundedRect(x, y, width, height, Math.min(width, height) * 0.15);
    return;
  }
  if (shape === "pill") {
    doc.roundedRect(x, y, width, height, Math.min(width, height) * 0.5);
    return;
  }
  if (shape === "circle") {
    doc.ellipse(midX, midY, width / 2, height / 2);
    return;
  }
  if (shape === "triangle") {
    doc.moveTo(midX, y).lineTo(right, bottom).lineTo(x, bottom).closePath();
    return;
  }
  if (shape === "diamond") {
    doc.moveTo(midX, y).lineTo(right, midY).lineTo(midX, bottom).lineTo(x, midY).closePath();
    return;
  }
  if (shape === "hexagon") {
    doc
      .moveTo(x + (width * 0.25), y)
      .lineTo(x + (width * 0.75), y)
      .lineTo(right, midY)
      .lineTo(x + (width * 0.75), bottom)
      .lineTo(x + (width * 0.25), bottom)
      .lineTo(x, midY)
      .closePath();
    return;
  }
  if (shape === "parallelogram") {
    doc
      .moveTo(x + (width * 0.16), y)
      .lineTo(right, y)
      .lineTo(x + (width * 0.84), bottom)
      .lineTo(x, bottom)
      .closePath();
    return;
  }
  doc.rect(x, y, width, height);
}

function drawBoardGrid(doc, x = 0, y = 0, width = 0, height = 0) {
  const step = 52;
  doc.save();
  doc.lineWidth(0.35);
  for (let offsetX = 0; offsetX <= width; offsetX += step) {
    doc.moveTo(x + offsetX, y).lineTo(x + offsetX, y + height).strokeColor("#edf1f5").stroke();
  }
  for (let offsetY = 0; offsetY <= height; offsetY += step) {
    doc.moveTo(x, y + offsetY).lineTo(x + width, y + offsetY).strokeColor("#edf1f5").stroke();
  }
  doc.restore();
}

function drawArrowHead(doc, x = 0, y = 0, angle = 0, size = 8, color = CANVAS_LINK_COLOR) {
  const leftX = x - (Math.cos(angle) * size) + (Math.sin(angle) * size * 0.48);
  const leftY = y - (Math.sin(angle) * size) - (Math.cos(angle) * size * 0.48);
  const rightX = x - (Math.cos(angle) * size) - (Math.sin(angle) * size * 0.48);
  const rightY = y - (Math.sin(angle) * size) + (Math.cos(angle) * size * 0.48);

  doc.save();
  doc
    .moveTo(x, y)
    .lineTo(leftX, leftY)
    .lineTo(rightX, rightY)
    .closePath()
    .fillColor(color)
    .fill();
  doc.restore();
}

function writeFittedCenteredText(doc, text = "", bounds = {}, options = {}) {
  const normalizedText = toPlainText(text);
  if (!normalizedText) {
    return;
  }
  const fontName = options.bold ? "Helvetica-Bold" : "Helvetica";
  const fontSize = options.fontSize || 10;
  const textWidth = Math.max(24, bounds.width || 0);
  doc.save();
  doc.font(fontName).fontSize(fontSize).fillColor(options.color || "#25313d");
  const textHeight = doc.heightOfString(normalizedText, {
    width: textWidth,
    align: "center",
    lineGap: 1
  });
  const textY = bounds.y + Math.max(0, ((bounds.height || 0) - textHeight) / 2);
  doc.text(normalizedText, bounds.x, textY, {
    width: textWidth,
    height: bounds.height,
    align: "center",
    lineGap: 1
  });
  doc.restore();
}

function drawCanvasLinks(doc, links = [], elementsById = new Map(), transform = {}) {
  links.forEach((link) => {
    const fromItem = elementsById.get(link.from);
    const toItem = elementsById.get(link.to);
    if (!fromItem || !toItem) {
      return;
    }

    const geometry = describeCanvasLinkPath(fromItem, toItem);
    const startX = transform.x(geometry.start.x);
    const startY = transform.y(geometry.start.y);
    const controlStartX = transform.x(geometry.controlStart.x);
    const controlStartY = transform.y(geometry.controlStart.y);
    const controlEndX = transform.x(geometry.controlEnd.x);
    const controlEndY = transform.y(geometry.controlEnd.y);
    const endX = transform.x(geometry.end.x);
    const endY = transform.y(geometry.end.y);
    const linkColor = normalizeColor(link.color, CANVAS_LINK_COLOR);

    doc.save();
    doc
      .moveTo(startX, startY)
      .bezierCurveTo(controlStartX, controlStartY, controlEndX, controlEndY, endX, endY)
      .lineWidth(Math.max(1.5, transform.scale * 6))
      .lineCap("round")
      .lineJoin("round")
      .strokeColor(linkColor)
      .stroke();
    doc.restore();

    drawArrowHead(
      doc,
      endX,
      endY,
      Math.atan2(endY - controlEndY, endX - controlEndX),
      Math.max(4, transform.scale * 14),
      linkColor
    );

    if (link.label) {
      const labelFontSize = Math.max(7, transform.scale * 22);
      const labelWidth = Math.max(36, doc.widthOfString(link.label, { fontSize: labelFontSize }) + (transform.scale * 26));
      const labelHeight = Math.max(16, labelFontSize + (transform.scale * 12));
      const chipX = transform.x(geometry.midpoint.x) - (labelWidth / 2);
      const chipY = transform.y(geometry.midpoint.y) - (labelHeight / 2);

      doc.save();
      doc
        .roundedRect(chipX, chipY, labelWidth, labelHeight, labelHeight / 2)
        .fillAndStroke("#ffffff", "#d5dbe3");
      doc.restore();

      doc.save();
      doc
        .font("Helvetica")
        .fontSize(labelFontSize)
        .fillColor("#374151")
        .text(link.label, chipX + (transform.scale * 8), chipY + (transform.scale * 3), {
          width: labelWidth - (transform.scale * 16),
          align: "center"
        });
      doc.restore();
    }
  });
}

function drawCanvasElement(doc, element = {}, transform = {}) {
  const x = transform.x(element.x);
  const y = transform.y(element.y);
  const width = Math.max(28, element.width * transform.scale);
  const height = Math.max(24, element.height * transform.scale);

  if (element.type === "shape") {
    drawShapePath(doc, element.shape, x, y, width, height);
    doc.save();
    doc
      .fillAndStroke(element.color || "#f4d35e", "#b28b35");
    doc.restore();

    writeFittedCenteredText(
      doc,
      element.title || "Shape",
      getShapeLabelBounds(element.shape, x, y, width, height),
      {
        bold: true,
        color: element.textColor || "#25313d",
        fontSize: Math.max(7, transform.scale * 26)
      }
    );
    return;
  }

  doc.save();
  doc.roundedRect(x, y, width, height, Math.max(10, transform.scale * 18));
  doc.fillAndStroke(element.color || "#ffffff", "#d1d5db");
  doc.restore();

  if (element.type === "image" || element.type === "video") {
    const mediaHeight = Math.max(42, height * 0.58);
    const imageX = x + (transform.scale * 10);
    const imageY = y + (transform.scale * 10);
    const imageWidth = width - (transform.scale * 20);
    const imageHeight = mediaHeight - (transform.scale * 12);
    const embeddedImageBuffer = decodeDataImageSrc(
      element.type === "video" ? (element.poster || "") : (element.src || "")
    );
    doc.save();
    doc
      .roundedRect(
        imageX,
        imageY,
        imageWidth,
        imageHeight,
        Math.max(8, transform.scale * 12)
      )
      .fillAndStroke("#f3f4f6", "#d7dde5");
    doc.restore();

    if (embeddedImageBuffer) {
      try {
        doc.save();
        doc.image(embeddedImageBuffer, imageX, imageY, {
          fit: [imageWidth, imageHeight],
          align: "center",
          valign: "center"
        });
        doc.restore();
      } catch {
        doc.save();
        doc
          .moveTo(x + (transform.scale * 20), y + mediaHeight - (transform.scale * 18))
          .lineTo(x + width - (transform.scale * 20), y + (transform.scale * 20))
          .moveTo(x + (transform.scale * 20), y + (transform.scale * 20))
          .lineTo(x + width - (transform.scale * 20), y + mediaHeight - (transform.scale * 18))
          .lineWidth(Math.max(0.8, transform.scale * 3))
          .strokeColor("#c5ced8")
          .stroke();
        doc.restore();
      }
    } else {
      doc.save();
      doc
        .moveTo(x + (transform.scale * 20), y + mediaHeight - (transform.scale * 18))
        .lineTo(x + width - (transform.scale * 20), y + (transform.scale * 20))
        .moveTo(x + (transform.scale * 20), y + (transform.scale * 20))
        .lineTo(x + width - (transform.scale * 20), y + mediaHeight - (transform.scale * 18))
        .lineWidth(Math.max(0.8, transform.scale * 3))
        .strokeColor("#c5ced8")
        .stroke();
      doc.restore();
    }

    const titleY = y + mediaHeight + (transform.scale * 2);
    doc.save();
    doc.font("Helvetica-Bold").fontSize(Math.max(7, transform.scale * 22)).fillColor(element.textColor || "#111827");
    doc.text(element.title || (element.type === "video" ? "Video" : "Image"), x + (transform.scale * 14), titleY, {
      width: width - (transform.scale * 28),
      height: height * 0.16,
      ellipsis: true
    });
    doc.restore();

    const captionY = titleY + (transform.scale * 18);
    doc.save();
    doc.font("Helvetica").fontSize(Math.max(6, transform.scale * 18)).fillColor(element.textColor || "#4b5563");
    doc.text(toPlainText(element.body || element.src || ""), x + (transform.scale * 14), captionY, {
      width: width - (transform.scale * 28),
      height: Math.max(16, height - mediaHeight - (transform.scale * 28)),
      ellipsis: true
    });
    doc.restore();
    return;
  }

  const titleX = x + (transform.scale * 14);
  const titleY = y + (transform.scale * 14);
  const titleWidth = width - (transform.scale * 28);
  const titleFontSize = Math.max(7.5, transform.scale * 22);
  const bodyFontSize = Math.max(6.5, transform.scale * 18);
  const bodyY = titleY + (transform.scale * 24);

  doc.save();
  doc.font("Helvetica-Bold").fontSize(titleFontSize).fillColor(element.textColor || "#111827");
  doc.text(element.title || "Untitled", titleX, titleY, {
    width: titleWidth,
    height: height * 0.2,
    ellipsis: true
  });
  doc.restore();

  doc.save();
  doc.font("Helvetica").fontSize(bodyFontSize).fillColor(element.textColor || "#374151");
  doc.text(toPlainText(element.body || ""), titleX, bodyY, {
    width: titleWidth,
    height: Math.max(18, height - (transform.scale * 38)),
    ellipsis: true,
    lineGap: 1
  });
  doc.restore();
}

async function buildCanvasPdfBuffer(payload = {}) {
  const { title, elements, links, boardWidth, boardHeight } = payload;
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    compress: true
  });
  const chunks = [];

  return new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 24;
    const headerHeight = 26;
    const availableWidth = pageWidth - (margin * 2);
    const availableHeight = pageHeight - (margin * 2) - headerHeight;
    const scale = Math.min(availableWidth / boardWidth, availableHeight / boardHeight);
    const boardRenderWidth = boardWidth * scale;
    const boardRenderHeight = boardHeight * scale;
    const boardX = margin + ((availableWidth - boardRenderWidth) / 2);
    const boardY = margin + headerHeight + ((availableHeight - boardRenderHeight) / 2);
    const transform = {
      scale,
      x: (value) => boardX + (value * scale),
      y: (value) => boardY + (value * scale)
    };
    const elementsById = new Map(elements.map((item) => [item.id, item]));

    doc.info.Title = title;
    doc.rect(0, 0, pageWidth, pageHeight).fill("#f5f7fb");

    doc.save();
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827");
    doc.text(title, margin, margin - 2, {
      width: pageWidth - (margin * 2),
      align: "left"
    });
    doc.restore();

    doc.save();
    doc.roundedRect(boardX, boardY, boardRenderWidth, boardRenderHeight, 18).fill("#ffffff");
    doc.roundedRect(boardX, boardY, boardRenderWidth, boardRenderHeight, 18).lineWidth(1).strokeColor("#d7dee7").stroke();
    doc.restore();

    doc.save();
    doc.roundedRect(boardX, boardY, boardRenderWidth, boardRenderHeight, 18).clip();
    drawBoardGrid(doc, boardX, boardY, boardRenderWidth, boardRenderHeight);
    drawCanvasLinks(doc, links, elementsById, transform);
    elements.forEach((element) => drawCanvasElement(doc, element, transform));
    doc.restore();

    doc.end();
  });
}

router.post("/export-pdf", async (req, res, next) => {
  try {
    const payload = normalizeCanvasExportPayload(req.body || {});
    if (!Array.isArray(req.body?.elements)) {
      throw new AppError("No canvas content provided", 400);
    }
    const buffer = await buildCanvasPdfBuffer(payload);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${payload.filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
