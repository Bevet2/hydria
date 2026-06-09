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
import {
  buildWorkObjectAssetUrl,
  resolveWorkObjectRuntimeAssetPath,
  resolveWorkObjectRuntimeEntry
} from "../src/workspace/universalSurfaceService.js";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import { AppError } from "../utils/errors.js";

const router = Router();
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
const documentImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});
const DOCUMENT_IMPORT_KINDS = new Set(["pdf", "doc", "docx", "text"]);
const DOCUMENT_EXPORT_FORMATS = new Set(["pdf", "docx", "txt"]);

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

router.post("/new", (req, res, next) => {
  try {
    const workObject = workObjectService.createBlankWorkObject({
      kind: req.body?.kind || "document",
      title: req.body?.title || "",
      userId: req.body?.userId ?? null,
      conversationId: req.body?.conversationId ?? null,
      projectId: req.body?.projectId || "",
      workspaceFamilyId: req.body?.workspaceFamilyId || ""
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
      actor: "user"
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

    res.json({
      success: true,
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
