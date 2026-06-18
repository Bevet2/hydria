import { Router } from "express";
import multer from "multer";
import path from "node:path";
import agenticConfig from "../src/config/agenticConfig.js";
import HydriaBrainProvider from "../src/core/HydriaBrainProvider.js";
import WorkObjectRuntimeService from "../src/runtime/workObjectRuntimeService.js";
import RuntimeStateStore from "../src/runtime/runtime.state.js";
import { extractDocumentLikeContent } from "../services/attachments/extractors/documentExtractors.js";
import { inferAttachmentKind } from "../services/attachments/extractors/kinds.js";
import { renderDocxArtifact } from "../services/artifacts/generators/docxGenerator.js";
import { renderPdfArtifact } from "../services/artifacts/generators/pdfGenerator.js";
import PptxGenJS from "pptxgenjs";
import {
  buildWorkObjectAssetUrl,
  resolveWorkObjectRuntimeAssetPath,
  resolveWorkObjectRuntimeEntry
} from "../src/workspace/universalSurfaceService.js";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import WorkObjectCollaborationService from "../src/work-objects/workObjectCollaboration.service.js";
import { AppError } from "../utils/errors.js";
import { EventEmitter } from "node:events";

const router = Router();
const workObjectEvents = new EventEmitter();
workObjectEvents.setMaxListeners(200);
const workObjectService = new WorkObjectService({
  filePath: agenticConfig.files.workObjectStore,
  rootDir: agenticConfig.files.workObjectRoot,
  brainProvider: new HydriaBrainProvider()
});
const runtimeStateStore = new RuntimeStateStore({
  filePath: agenticConfig.files.runtimeWorkObjectState
});
const workObjectRuntimeService = new WorkObjectRuntimeService({
  store: runtimeStateStore,
  workObjectService
});
const collaborationService = new WorkObjectCollaborationService({
  workObjectService,
  runtimeService: workObjectRuntimeService,
  events: workObjectEvents
});
const documentImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});
const DOCUMENT_IMPORT_KINDS = new Set(["pdf", "doc", "docx", "text"]);
const DOCUMENT_EXPORT_FORMATS = new Set(["pdf", "docx", "txt"]);
const PRESENTATION_SLIDE_META_PATTERN = /^<!--\s*hydria-slide:\s*(\{[\s\S]*\})\s*-->\s*$/i;
const PRESENTATION_SLIDE_WIDTH = 13.333;
const PRESENTATION_SLIDE_HEIGHT = 7.5;

router.get("/", (req, res) => {
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const conversationId = req.query.conversationId ? Number(req.query.conversationId) : null;

  res.json({
    success: true,
    workObjects: workObjectService.listForConversation({
      userId,
      conversationId
    })
  });
});

router.get("/search", (req, res) => {
  res.json({
    success: true,
    results: workObjectService.searchContent({
      userId: req.query.userId ? Number(req.query.userId) : null,
      query: req.query.q || req.query.query || "",
      kind: req.query.kind || "",
      limit: req.query.limit ? Number(req.query.limit) : 30
    })
  });
});

router.get("/shared/:shareToken", (req, res, next) => {
  try {
    const workObject = workObjectService.getSharedByToken(req.params.shareToken, {
      includeContent: req.query.content === "1" || Boolean(req.query.path),
      entryPath: req.query.path || req.query.entryPath || ""
    });
    if (!workObject) throw new AppError("Shared work object not found", 404);
    res.json({ success: true, workObject });
  } catch (error) {
    next(error);
  }
});

router.get("/:workObjectId", (req, res, next) => {
  try {
    const workObject = workObjectService.get(req.params.workObjectId, {
      includeContent: req.query.content === "1" || Boolean(req.query.path),
      entryPath: req.query.path || req.query.entryPath || ""
    });

    if (!workObject) {
      throw new AppError("Work object not found", 404);
    }

    res.json({
      success: true,
      workObject
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:workObjectId/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const eventName = `work-object:${req.params.workObjectId}`;
  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
  workObjectEvents.on(eventName, send);
  send({ type: "connected", workObjectId: req.params.workObjectId });
  req.on("close", () => {
    clearInterval(heartbeat);
    workObjectEvents.off(eventName, send);
  });
});

router.get("/:workObjectId/presence", (req, res) => {
  res.json({
    success: true,
    presence: workObjectService.listPresence(req.params.workObjectId)
  });
});

router.post("/:workObjectId/presence", (req, res, next) => {
  try {
    const presence = workObjectService.touchPresence({
      workObjectId: req.params.workObjectId,
      actorUserId: req.body?.userId,
      name: req.body?.name,
      entryPath: req.body?.entryPath,
      cursor: req.body?.cursor
    });
    workObjectEvents.emit(`work-object:${req.params.workObjectId}`, {
      type: "presence",
      presence
    });
    res.json({ success: true, presence });
  } catch (error) {
    next(error);
  }
});

router.delete("/:workObjectId/presence", (req, res) => {
  const presence = workObjectService.leavePresence({
    workObjectId: req.params.workObjectId,
    actorUserId: req.body?.userId || req.query.userId
  });
  workObjectEvents.emit(`work-object:${req.params.workObjectId}`, {
    type: "presence",
    presence
  });
  res.json({ success: true, presence });
});

router.get("/:workObjectId/collaboration", (req, res, next) => {
  try {
    res.json({
      success: true,
      collaboration: collaborationService.state({
        workObjectId: req.params.workObjectId,
        entryPath: req.query.entryPath || req.query.path || "",
        actorUserId: req.query.userId || null,
        shareToken: req.query.shareToken || ""
      })
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:workObjectId/collaboration/operations", (req, res, next) => {
  try {
    res.json({
      success: true,
      collaboration: collaborationService.apply({
        workObjectId: req.params.workObjectId,
        entryPath: req.body?.entryPath || req.body?.path || "",
        actorUserId: req.body?.userId ?? null,
        shareToken: req.body?.shareToken || "",
        clientId: req.body?.clientId || "",
        baseVersion: req.body?.baseVersion || 0,
        operation: req.body?.operation
      })
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:workObjectId/collaboration/flush", async (req, res, next) => {
  try {
    res.json({
      success: true,
      collaboration: await collaborationService.flush({
        workObjectId: req.params.workObjectId,
        entryPath: req.body?.entryPath || req.body?.path || ""
      })
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:workObjectId/share", (req, res, next) => {
  try {
    const workObject = workObjectService.updateSharing({
      workObjectId: req.params.workObjectId,
      actorUserId: req.body?.userId,
      visibility: req.body?.visibility,
      defaultRole: req.body?.defaultRole,
      shares: req.body?.shares
    });
    if (!workObject) throw new AppError("Work object not found", 404);
    res.json({
      success: true,
      workObject,
      shareUrl: workObject.metadata?.sharing?.shareToken
        ? `/api/work-objects/shared/${workObject.metadata.sharing.shareToken}`
        : ""
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:workObjectId/annotations", (req, res, next) => {
  try {
    const workObject = workObjectService.updateAnnotations({
      workObjectId: req.params.workObjectId,
      actorUserId: req.body?.userId,
      shareToken: req.body?.shareToken || "",
      annotations: req.body?.annotations
    });
    if (!workObject) throw new AppError("Work object not found", 404);
    workObjectEvents.emit(`work-object:${req.params.workObjectId}`, {
      type: "annotations",
      workObject
    });
    res.json({ success: true, workObject });
  } catch (error) {
    next(error);
  }
});

router.post("/:workObjectId/trash", (req, res, next) => {
  try {
    const workObject = workObjectService.trash({
      workObjectId: req.params.workObjectId,
      actorUserId: req.body?.userId
    });
    if (!workObject) throw new AppError("Work object not found", 404);
    res.json({ success: true, workObject });
  } catch (error) {
    next(error);
  }
});

router.post("/:workObjectId/restore", (req, res, next) => {
  try {
    const workObject = workObjectService.restoreFromTrash({
      workObjectId: req.params.workObjectId,
      actorUserId: req.body?.userId
    });
    if (!workObject) throw new AppError("Work object not found", 404);
    res.json({ success: true, workObject });
  } catch (error) {
    next(error);
  }
});

router.delete("/:workObjectId", (req, res, next) => {
  try {
    if (req.body?.confirmation !== "DELETE") {
      throw new AppError('Set confirmation to "DELETE" to delete permanently', 400);
    }
    const workObject = workObjectService.deletePermanently({
      workObjectId: req.params.workObjectId,
      actorUserId: req.body?.userId
    });
    if (!workObject) throw new AppError("Work object not found", 404);
    res.json({ success: true, workObject });
  } catch (error) {
    next(error);
  }
});

router.get("/:workObjectId/history", (req, res, next) => {
  try {
    const history = workObjectService.listHistory(req.params.workObjectId);
    if (!history) {
      throw new AppError("Work object not found", 404);
    }

    res.json({
      success: true,
      history
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:workObjectId/history/:historyId", (req, res, next) => {
  try {
    const snapshot = workObjectService.readHistorySnapshot(
      req.params.workObjectId,
      req.params.historyId
    );
    if (!snapshot) throw new AppError("Work object version not found", 404);
    res.json({ success: true, snapshot });
  } catch (error) {
    next(error);
  }
});

router.post("/:workObjectId/history/:historyId/restore", async (req, res, next) => {
  try {
    const workObject = await workObjectService.restoreHistory({
      workObjectId: req.params.workObjectId,
      historyId: req.params.historyId,
      actor: "user"
    });

    if (!workObject) {
      throw new AppError("Work object version not found", 404);
    }

    res.json({
      success: true,
      workObject
    });
  } catch (error) {
    next(error);
  }
});

router.post("/new", (req, res, next) => {
  try {
    const workObject = workObjectService.createBlankWorkObject({
      kind: req.body?.kind || "document",
      title: req.body?.title || "",
      userId: req.body?.userId ?? null,
      conversationId: req.body?.conversationId ?? null,
      projectId: req.body?.projectId || "",
      workspaceFamilyId: req.body?.workspaceFamilyId || "",
      metadata:
        req.body?.metadata && typeof req.body.metadata === "object"
          ? req.body.metadata
          : {}
    });

    res.json({
      success: true,
      workObject
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:workObjectId", (req, res, next) => {
  try {
    const workObject = workObjectService.updateMetadata({
      workObjectId: req.params.workObjectId,
      title: req.body?.title,
      status: req.body?.status,
      metadata:
        req.body?.metadata && typeof req.body.metadata === "object"
          ? req.body.metadata
          : null,
      actor: "user"
    });

    if (!workObject) {
      throw new AppError("Work object not found", 404);
    }

    res.json({
      success: true,
      workObject
    });
  } catch (error) {
    next(error);
  }
});

function normalizeDocumentExportTitle(value = "") {
  const safeTitle = String(value || "document")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return safeTitle || "document";
}

function formatDocumentExportTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function buildDocumentExportDownloadName(value = "", fallbackTitle = "document", extension = "pdf") {
  const normalizedExtension = String(extension || "pdf").trim().replace(/^\.+/, "").toLowerCase() || "pdf";
  const fallbackStem = `${normalizeDocumentExportTitle(fallbackTitle)}_${formatDocumentExportTimestamp()}`;
  const requestedStem = String(value || "")
    .trim()
    .replace(/\.[^.]+$/i, "");
  const safeStem = normalizeDocumentExportTitle(requestedStem);
  return `${safeStem || fallbackStem}.${normalizedExtension}`;
}

function parsePresentationMetaLine(line = "") {
  const match = String(line || "").trim().match(PRESENTATION_SLIDE_META_PATTERN);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stripPresentationMeta(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !parsePresentationMetaLine(line))
    .join("\n")
    .trim();
}

function presentationLines(value = "") {
  return stripPresentationMeta(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function presentationBullets(value = "") {
  return presentationLines(value)
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, "").trim())
    .filter(Boolean);
}

function presentationParagraphs(value = "") {
  return presentationLines(value)
    .filter((line) => !/^[-*]\s+/.test(line) && !/^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^>\s+/, "").trim())
    .filter(Boolean);
}

function normalizePptxColor(value = "", fallback = "FFFFFF") {
  const text = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.slice(1).toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(text)) return text.toUpperCase();
  return fallback;
}

function clampPptxNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function parsePresentationMarkdown(markdown = "", fallbackTitle = "Presentation") {
  const text = String(markdown || "").replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");
  const titleLine = lines.find((line) => /^#\s+/.test(line.trim()));
  const title = titleLine ? titleLine.trim().replace(/^#\s+/, "") : fallbackTitle;
  const sections = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^##\s+/.test(line.trim())) {
      if (current) sections.push(current);
      const rawTitle = line.trim().replace(/^##\s+/, "");
      current = {
        title: rawTitle.replace(/^slide\s+\d+\s*-\s*/i, "").trim() || rawTitle,
        bodyLines: [],
        meta: {}
      };
      continue;
    }
    if (!current) continue;
    const meta = parsePresentationMetaLine(rawLine);
    if (meta) {
      Object.assign(current.meta, meta);
    } else {
      current.bodyLines.push(rawLine);
    }
  }
  if (current) sections.push(current);

  const slides = sections.length
    ? sections.map((section, index) => ({
        title: section.title || `Slide ${index + 1}`,
        body: stripPresentationMeta(section.bodyLines.join("\n")),
        meta: section.meta || {}
      }))
    : [
        {
          title: title || "Slide 1",
          body: text || "Add the main point here.",
          meta: { layout: "title", theme: "default" }
        }
      ];

  return { title, slides };
}

function defaultPresentationElementsForPptx(slide = {}) {
  const layout = String(slide.meta?.layout || "content");
  const image = String(slide.meta?.image || "").trim();
  const cta = String(slide.meta?.cta || "").trim();
  const bullets = presentationBullets(slide.body);
  const paragraphs = presentationParagraphs(slide.body);
  const bodyText = bullets.length
    ? bullets.map((item) => `• ${item}`).join("\n")
    : paragraphs.join("\n") || "Main point";
  const elements = [
    {
      id: "title",
      type: "title",
      text: slide.title || "Slide",
      x: layout === "section" ? 12 : 7,
      y: layout === "section" ? 34 : 10,
      w: layout === "section" ? 76 : 72,
      h: layout === "section" ? 18 : 16,
      fontSize: layout === "section" ? 46 : 38,
      bold: true,
      color: "#111827",
      fill: "transparent",
      stroke: "transparent",
      align: layout === "section" ? "center" : "left"
    }
  ];
  if (layout !== "section") {
    elements.push({
      id: "body",
      type: "text",
      text: bodyText,
      x: 7,
      y: layout === "title" ? 34 : 28,
      w: layout === "image" || layout === "two-column" ? 42 : 58,
      h: layout === "title" ? 20 : 36,
      fontSize: bullets.length ? 22 : 20,
      color: "#374151",
      fill: "transparent",
      stroke: "transparent",
      align: "left"
    });
  }
  if (layout === "image" || image) {
    elements.push({
      id: "image",
      type: "image",
      src: image,
      text: "Image",
      x: 56,
      y: 25,
      w: 36,
      h: 44,
      fill: "#f8fafc",
      stroke: "#cbd5e1"
    });
  }
  if (cta) {
    elements.push({
      id: "cta",
      type: "shape",
      shape: "callout",
      text: cta,
      x: 62,
      y: 76,
      w: 30,
      h: 10,
      fontSize: 16,
      bold: true,
      color: "#0f172a",
      fill: "#dbeafe",
      stroke: "#93c5fd",
      align: "center"
    });
  }
  return elements;
}

function normalizePresentationElementForPptx(element = {}, index = 0) {
  const type = ["title", "text", "shape", "image"].includes(String(element.type || "").toLowerCase())
    ? String(element.type || "").toLowerCase()
    : "text";
  const shape = ["rectangle", "ellipse", "line", "callout"].includes(String(element.shape || "").toLowerCase())
    ? String(element.shape || "").toLowerCase()
    : "rectangle";
  return {
    id: String(element.id || `${type}-${index + 1}`),
    type,
    shape,
    text: String(element.text || ""),
    src: String(element.src || element.image || element.imageUrl || "").trim(),
    x: clampPptxNumber(element.x, 0, 100, 8),
    y: clampPptxNumber(element.y, 0, 100, 18),
    w: clampPptxNumber(element.w ?? element.width, 3, 100, 42),
    h: clampPptxNumber(element.h ?? element.height, 2, 100, 16),
    z: clampPptxNumber(element.z, 0, 1000, index),
    fontSize: clampPptxNumber(element.fontSize, 8, 96, type === "title" ? 38 : 20),
    bold: Boolean(element.bold || type === "title"),
    italic: Boolean(element.italic),
    underline: Boolean(element.underline),
    align: ["left", "center", "right"].includes(String(element.align || "").toLowerCase())
      ? String(element.align || "").toLowerCase()
      : "left",
    color: normalizePptxColor(element.color, type === "shape" ? "111827" : "374151"),
    fill: String(element.fill || element.background || "transparent"),
    stroke: String(element.stroke || element.borderColor || "transparent"),
    opacity: clampPptxNumber(element.opacity, 0.1, 1, 1),
    rotation: clampPptxNumber(element.rotation, -180, 180, 0)
  };
}

function pctToInches(value = 0, axis = "x") {
  const size = axis === "y" ? PRESENTATION_SLIDE_HEIGHT : PRESENTATION_SLIDE_WIDTH;
  return (Number(value || 0) / 100) * size;
}

function addPresentationElementToPptxSlide(pptx, slide, element = {}) {
  const x = pctToInches(element.x, "x");
  const y = pctToInches(element.y, "y");
  const w = pctToInches(element.w, "x");
  const h = pctToInches(element.h, "y");
  const fillColor = normalizePptxColor(element.fill, "FFFFFF");
  const strokeColor = normalizePptxColor(element.stroke, "CBD5E1");
  const hasFill = String(element.fill || "").trim() && String(element.fill).trim() !== "transparent";
  const hasStroke = String(element.stroke || "").trim() && String(element.stroke).trim() !== "transparent";
  const baseOptions = {
    x,
    y,
    w,
    h,
    margin: 0.08,
    fontSize: element.fontSize,
    color: element.color,
    bold: element.bold,
    italic: element.italic,
    underline: element.underline ? { color: element.color } : undefined,
    align: element.align,
    rotate: element.rotation || 0,
    valign: element.shape === "line" ? "mid" : "top",
    breakLine: false,
    fit: "shrink",
    fill: hasFill ? { color: fillColor, transparency: Math.round((1 - element.opacity) * 100) } : { transparency: 100 },
    line: hasStroke ? { color: strokeColor, transparency: 0 } : { transparency: 100 }
  };

  if (element.type === "image") {
    if (/^https?:\/\//i.test(element.src)) {
      slide.addText(element.text || "Image URL", {
        ...baseOptions,
        color: "475467",
        fill: { color: fillColor },
        line: { color: strokeColor },
        align: "center",
        valign: "mid"
      });
      slide.addText(element.src, {
        x: x + 0.12,
        y: y + h - 0.34,
        w: Math.max(0.6, w - 0.24),
        h: 0.22,
        fontSize: 6,
        color: "667085",
        fit: "shrink"
      });
      return;
    }
    slide.addText(element.text || "Image", {
      ...baseOptions,
      color: "475467",
      fill: { color: fillColor },
      line: { color: strokeColor },
      align: "center",
      valign: "mid"
    });
    return;
  }

  if (element.type === "shape" || element.shape === "line") {
    const shapeType =
      element.shape === "ellipse"
        ? pptx.ShapeType.ellipse
        : element.shape === "line"
          ? pptx.ShapeType.line
          : pptx.ShapeType.rect;
    if (element.shape === "line") {
      slide.addShape(shapeType, {
        x,
        y,
        w,
        h: 0,
        line: { color: strokeColor, width: 2 }
      });
      return;
    }
    slide.addText(element.text || "", {
      ...baseOptions,
      shape: shapeType,
      valign: "mid"
    });
    return;
  }

  slide.addText(element.text || "", baseOptions);
}

async function renderPptxArtifact({ title = "Presentation", markdown = "" } = {}) {
  const deck = parsePresentationMarkdown(markdown, title);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Hydria";
  pptx.company = "Hydria";
  pptx.subject = deck.title;
  pptx.title = deck.title;
  pptx.lang = "fr-FR";

  for (const deckSlide of deck.slides) {
    const slide = pptx.addSlide();
    const background = normalizePptxColor(deckSlide.meta?.background || "#ffffff", "FFFFFF");
    slide.background = { color: background };
    const elements = (Array.isArray(deckSlide.meta?.elements) && deckSlide.meta.elements.length
      ? deckSlide.meta.elements
      : defaultPresentationElementsForPptx(deckSlide)
    )
      .map((element, index) => normalizePresentationElementForPptx(element, index))
      .sort((left, right) => Number(left.z || 0) - Number(right.z || 0));
    elements.forEach((element) => addPresentationElementToPptxSlide(pptx, slide, element));
    if (deckSlide.meta?.notes) {
      slide.addNotes(String(deckSlide.meta.notes));
    }
  }

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return {
    buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  };
}

router.post("/:workObjectId/document-import", (req, res, next) => {
  documentImportUpload.single("file")(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        if (uploadError instanceof multer.MulterError) {
          throw new AppError(uploadError.message, 400);
        }
        throw uploadError;
      }

      if (!req.file) {
        throw new AppError("No file was provided for import", 400);
      }

      const inferredKind = inferAttachmentKind(req.file);
      if (!DOCUMENT_IMPORT_KINDS.has(inferredKind)) {
        throw new AppError("Unsupported import format. Use DOC, DOCX, PDF, TXT, Markdown or HTML.", 400);
      }

      const extracted =
        inferredKind === "text"
          ? {
              text: req.file.buffer.toString("utf8"),
              parser: "plain-text"
            }
          : await extractDocumentLikeContent(req.file, inferredKind);

      res.json({
        success: true,
        originalName: req.file.originalname,
        kind: inferredKind,
        parser: extracted?.parser || "plain-text",
        content: String(extracted?.text || "")
      });
    } catch (error) {
      next(error);
    }
  });
});

router.post("/:workObjectId/document-export", async (req, res, next) => {
  try {
    const requestedFormat = String(req.body?.format || "").trim().toLowerCase();
    const format = requestedFormat === "doc" ? "docx" : requestedFormat;
    if (!DOCUMENT_EXPORT_FORMATS.has(format)) {
      throw new AppError("Unsupported export format", 400);
    }

    const markdown = String(req.body?.markdown || "").replace(/\r\n/g, "\n").trim();
    if (!markdown) {
      throw new AppError("Nothing to export", 400);
    }

    const title = String(req.body?.title || "Document").trim() || "Document";
    const downloadName = buildDocumentExportDownloadName(req.body?.downloadName, title, format);

    if (format === "txt") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
      res.send(Buffer.from(`\uFEFF${markdown}`, "utf8"));
      return;
    }

    const artifact =
      format === "docx"
        ? await renderDocxArtifact({ title, markdown })
        : await renderPdfArtifact({ title, markdown });

    res.setHeader("Content-Type", artifact.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.send(artifact.buffer);
  } catch (error) {
    next(error);
  }
});

router.post("/:workObjectId/presentation-export", async (req, res, next) => {
  try {
    const markdown = String(req.body?.markdown || "").replace(/\r\n/g, "\n").trim();
    if (!markdown) {
      throw new AppError("Nothing to export", 400);
    }

    const title = String(req.body?.title || "Presentation").trim() || "Presentation";
    const downloadName = buildDocumentExportDownloadName(req.body?.downloadName, title, "pptx");
    const artifact = await renderPptxArtifact({ title, markdown });

    res.setHeader("Content-Type", artifact.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.send(artifact.buffer);
  } catch (error) {
    next(error);
  }
});

function inferAssetContentType(filePath = "", fallback = "") {
  const extension = path.extname(String(filePath || "").toLowerCase());
  const explicit = String(fallback || "").toLowerCase();
  if (explicit && explicit !== "text/plain" && explicit !== "application/octet-stream") {
    return explicit;
  }

  if ([".js", ".mjs", ".cjs"].includes(extension)) {
    return "text/javascript";
  }
  if (extension === ".css") {
    return "text/css";
  }
  if (extension === ".html") {
    return "text/html";
  }
  if (extension === ".svg") {
    return "image/svg+xml";
  }
  if (extension === ".json") {
    return "application/json";
  }
  if (extension === ".png") {
    return "image/png";
  }
  if ([".jpg", ".jpeg"].includes(extension)) {
    return "image/jpeg";
  }
  if (extension === ".gif") {
    return "image/gif";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".mp3") {
    return "audio/mpeg";
  }
  if (extension === ".wav") {
    return "audio/wav";
  }
  if (extension === ".ogg") {
    return "audio/ogg";
  }
  return fallback || "application/octet-stream";
}

function handleAssetRequest(req, res, next) {
  try {
    const wildcardPath = Array.isArray(req.params) ? req.params[0] : req.params[0];
    const entryPath = wildcardPath || req.query.path || "";
    const sessionId = String(req.query.sessionId || "");

    if (sessionId) {
      const runtimeAsset = workObjectRuntimeService.resolveRuntimeAsset({
        sessionId,
        entryPath: decodeURIComponent(String(entryPath || ""))
      });

      res.setHeader("Cache-Control", "no-store");
      res.type(inferAssetContentType(runtimeAsset.entryPath, runtimeAsset.contentType));
      if (runtimeAsset.kind === "inline") {
        res.send(runtimeAsset.content);
        return;
      }

      res.sendFile(runtimeAsset.absolutePath);
      return;
    }

    const asset = workObjectService.resolveAsset({
      workObjectId: req.params.workObjectId,
      entryPath: decodeURIComponent(String(entryPath || ""))
    });

    res.type(inferAssetContentType(asset.entry?.path || entryPath, asset.entry?.contentType));

    res.sendFile(asset.absolutePath);
  } catch (error) {
    next(error);
  }
}

router.get("/:workObjectId/assets/*", handleAssetRequest);
router.get("/:workObjectId/asset", handleAssetRequest);
router.get("/:workObjectId/runtime/session/assets/*", handleAssetRequest);
router.get("/:workObjectId/runtime/session/asset", handleAssetRequest);

function rewriteRuntimeHtml(html = "", { workObjectId = "", entryPath = "" } = {}) {
  const normalized = String(html || "");
  const rewritten = normalized.replace(
    /\b(src|href)=["']([^"'#][^"']*)["']/gi,
    (match, attr, rawValue) => {
      const resolvedPath = resolveWorkObjectRuntimeAssetPath(entryPath, rawValue);
      if (!resolvedPath || /^(?:https?:|data:|blob:|mailto:|tel:|javascript:|\/)/i.test(resolvedPath)) {
        return match;
      }

      const assetUrl = buildWorkObjectAssetUrl(workObjectId, resolvedPath);
      return `${attr}="${assetUrl}"`;
    }
  );

  if (/<head[\s>]/i.test(rewritten)) {
    return rewritten.replace(
      /<head([^>]*)>/i,
      `<head$1><meta name="viewport" content="width=device-width, initial-scale=1" />`
    );
  }

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>${rewritten}</body></html>`;
}

router.post("/:workObjectId/runtime/session", (req, res, next) => {
  try {
    const session = workObjectRuntimeService.ensureSession({
      workObjectId: req.params.workObjectId,
      userId: req.body?.userId ?? req.query.userId ?? null,
      conversationId: req.body?.conversationId ?? req.query.conversationId ?? null,
      entryPath: req.body?.entryPath || req.query.entryPath || req.query.path || ""
    });

    res.json({
      success: true,
      runtimeSession: session
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:workObjectId/runtime/session", (req, res, next) => {
  try {
    let session = null;
    if (req.query.sessionId) {
      session = workObjectRuntimeService.enrichSession(
        workObjectRuntimeService.getSession(req.query.sessionId)
      );
    } else {
      session = workObjectRuntimeService.ensureSession({
        workObjectId: req.params.workObjectId,
        userId: req.query.userId ?? null,
        conversationId: req.query.conversationId ?? null,
        entryPath: req.query.entryPath || req.query.path || ""
      });
    }

    if (!session) {
      throw new AppError("Runtime session not found", 404);
    }

    res.json({
      success: true,
      runtimeSession: session
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:workObjectId/runtime/session", (req, res, next) => {
  try {
    const runtimeSession = workObjectRuntimeService.updateDraft({
      sessionId: req.body?.sessionId,
      entryPath: req.body?.entryPath || req.body?.path || "",
      content: req.body?.content
    });

    res.json({
      success: true,
      runtimeSession
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:workObjectId/runtime/session/reset", (req, res, next) => {
  try {
    const runtimeSession = workObjectRuntimeService.resetSession({
      sessionId: req.body?.sessionId || req.query.sessionId || ""
    });

    res.json({
      success: true,
      runtimeSession
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:workObjectId/runtime/session/render", (req, res, next) => {
  try {
    const runtime = workObjectRuntimeService.buildRuntimeHtml({
      sessionId: req.query.sessionId || ""
    });

    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' data: blob:; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'; frame-ancestors 'self';"
    );
    res.type("html");
    res.send(runtime.html);
  } catch (error) {
    next(error);
  }
});

router.get("/:workObjectId/runtime", (req, res, next) => {
  try {
    if (req.query.sessionId) {
      const runtime = workObjectRuntimeService.buildRuntimeHtml({
        sessionId: req.query.sessionId || ""
      });

      res.setHeader("Cache-Control", "no-store");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self' data: blob:; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'; frame-ancestors 'self';"
      );
      res.type("html");
      res.send(runtime.html);
      return;
    }

    const workObject = workObjectService.get(req.params.workObjectId);
    if (!workObject) {
      throw new AppError("Work object not found", 404);
    }

    const runtimeEntry = resolveWorkObjectRuntimeEntry(
      workObject,
      req.query.entryPath || req.query.path || ""
    );

    if (!runtimeEntry) {
      throw new AppError("No live runtime is available for this work object", 404);
    }

    const runtimeContent = workObjectService.readContent({
      workObjectId: req.params.workObjectId,
      entryPath: runtimeEntry.path
    });

    const html = rewriteRuntimeHtml(runtimeContent.content, {
      workObjectId: req.params.workObjectId,
      entryPath: runtimeEntry.path
    });

    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' data: blob:; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'; frame-ancestors 'self';"
    );
    res.type("html");
    res.send(html);
  } catch (error) {
    next(error);
  }
});

async function handleUpdateContent(req, res, next) {
  try {
    const entryPath = req.body?.entryPath || req.body?.path || "";
    const updated = await workObjectService.updateContent({
      workObjectId: req.params.workObjectId,
      entryPath,
      content: req.body?.content,
      note: req.body?.note,
      actor: req.body?.userId ? `user:${req.body.userId}` : "user",
      actorUserId: req.body?.userId ?? null,
      shareToken: req.body?.shareToken || "",
      expectedRevision: req.body?.expectedRevision
    });

    if (!updated) {
      throw new AppError("Unable to update work object content", 400);
    }

    workObjectRuntimeService.syncPersistedUpdate({
      workObjectId: req.params.workObjectId,
      entryPath,
      content: req.body?.content,
      revision: updated.revision
    });
    collaborationService.reset({
      workObjectId: req.params.workObjectId,
      entryPath,
      content: req.body?.content,
      revision: updated.revision
    });

    res.json({
      success: true,
      workObject: updated
    });
    workObjectEvents.emit(`work-object:${req.params.workObjectId}`, {
      type: "content",
      revision: updated.revision,
      entryPath,
      actorUserId: req.body?.userId ?? null,
      workObject: updated
    });
  } catch (error) {
    next(error);
  }
}

router.patch("/:workObjectId/content", handleUpdateContent);
router.post("/:workObjectId/content", handleUpdateContent);

router.post("/:workObjectId/improve", async (req, res, next) => {
  try {
    const improved = await workObjectService.improveObject({
      workObjectId: req.params.workObjectId,
      prompt: req.body?.prompt,
      entryPath: req.body?.entryPath
    });

    if (!improved) {
      throw new AppError("Unable to improve work object", 400);
    }

    workObjectRuntimeService.syncPersistedUpdate({
      workObjectId: req.params.workObjectId,
      entryPath: improved.workObject?.file?.path || req.body?.entryPath || "",
      content: improved.workObject?.file?.content || "",
      revision: improved.workObject?.revision
    });

    res.json({
      success: true,
      finalAnswer: improved.finalAnswer,
      workObject: improved.workObject
    });
  } catch (error) {
    next(error);
  }
});

export default router;
