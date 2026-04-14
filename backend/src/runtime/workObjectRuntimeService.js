import crypto from "node:crypto";
import {
  resolveWorkObjectRuntimeAssetPath,
  resolveWorkObjectRuntimeEntry
} from "../workspace/universalSurfaceService.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value = "") {
  return String(value || "").replace(/\\/g, "/");
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function inferAssetContentType(filePath = "", fallback = "application/octet-stream") {
  const normalized = String(filePath || "").toLowerCase();
  if (normalized.endsWith(".html")) {
    return "text/html";
  }
  if (normalized.endsWith(".css")) {
    return "text/css";
  }
  if (normalized.endsWith(".js") || normalized.endsWith(".mjs") || normalized.endsWith(".cjs")) {
    return "text/javascript";
  }
  if (normalized.endsWith(".json")) {
    return "application/json";
  }
  if (normalized.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (normalized.endsWith(".txt") || normalized.endsWith(".md")) {
    return "text/plain; charset=utf-8";
  }
  if (normalized.endsWith(".png")) {
    return "image/png";
  }
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalized.endsWith(".gif")) {
    return "image/gif";
  }
  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }
  if (normalized.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (normalized.endsWith(".wav")) {
    return "audio/wav";
  }
  if (normalized.endsWith(".ogg")) {
    return "audio/ogg";
  }
  return fallback;
}

function isRuntimeTextAsset(filePath = "") {
  return /\.(html|css|js|mjs|cjs|json|svg|txt|md)$/i.test(String(filePath || ""));
}

function buildSessionRenderUrl(workObjectId = "", sessionId = "") {
  return `/api/work-objects/${encodeURIComponent(
    String(workObjectId || "")
  )}/runtime/session/render?sessionId=${encodeURIComponent(String(sessionId || ""))}`;
}

function buildSessionAssetUrl(workObjectId = "", sessionId = "", entryPath = "") {
  const normalizedPath = normalizePath(entryPath);
  const encodedPath = normalizedPath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `/api/work-objects/${encodeURIComponent(
    String(workObjectId || "")
  )}/runtime/session/assets/${encodedPath}?sessionId=${encodeURIComponent(String(sessionId || ""))}`;
}

function buildRuntimeBridgeScript({ runtimeEntryPath = "" } = {}) {
  return `
  <script>
  (function () {
    if (window.__hydriaRuntimeBridgeInstalled) {
      return;
    }

    window.__hydriaRuntimeBridgeInstalled = true;
    window.__HYDRIA_RUNTIME_ENTRY_PATH__ = ${JSON.stringify(String(runtimeEntryPath || ""))};
    window.__HYDRIA_RUNTIME_SESSION_ASSET_URL__ = ${JSON.stringify("__HYDRIA_SESSION_ASSET_URL__")};

    function parseHtml(content) {
      return new DOMParser().parseFromString(String(content || ""), "text/html");
    }

    function normalizePath(value) {
      return String(value || "").replace(/\\\\/g, "/");
    }

    function isExternalUrl(value) {
      return /^(?:[a-z]+:|\\/|#|\\?)/i.test(String(value || ""));
    }

    function resolveRelativePath(fromPath, targetPath) {
      var baseParts = normalizePath(fromPath).split("/").filter(Boolean);
      if (baseParts.length) {
        baseParts.pop();
      }
      normalizePath(targetPath).split("/").forEach(function (part) {
        if (!part || part === ".") {
          return;
        }
        if (part === "..") {
          baseParts.pop();
          return;
        }
        baseParts.push(part);
      });
      return baseParts.join("/");
    }

    function buildSessionAssetUrl(rawPath) {
      if (!rawPath || isExternalUrl(rawPath)) {
        return rawPath;
      }
      var resolvedPath = resolveRelativePath(window.__HYDRIA_RUNTIME_ENTRY_PATH__ || "", rawPath);
      var template = String(window.__HYDRIA_RUNTIME_SESSION_ASSET_URL__ || "");
      return template.replace("__ENTRY_PATH__", encodeURIComponent(resolvedPath));
    }

    function ensureOverrideStyle(entryPath) {
      var selector = 'style[data-hydria-runtime-style="' + entryPath.replace(/"/g, '&quot;') + '"]';
      var node = document.head.querySelector(selector);
      if (!node) {
        node = document.createElement("style");
        node.setAttribute("data-hydria-runtime-style", entryPath);
        document.head.appendChild(node);
      }
      return node;
    }

    function cloneAttributes(fromNode, toNode) {
      if (!fromNode || !toNode) {
        return;
      }
      Array.from(toNode.attributes || []).forEach(function (attribute) {
        toNode.removeAttribute(attribute.name);
      });
      Array.from(fromNode.attributes || []).forEach(function (attribute) {
        toNode.setAttribute(attribute.name, attribute.value);
      });
    }

    function selectPatchRoot(doc) {
      return (
        doc.querySelector('[data-hydria-root]') ||
        doc.getElementById('app') ||
        doc.querySelector('main') ||
        doc.body
      );
    }

    function applyCss(entryPath, content) {
      var styleNode = ensureOverrideStyle(entryPath);
      styleNode.textContent = String(content || "");
      return true;
    }

    function applyHtml(content) {
      var nextDoc = parseHtml(content);
      if (nextDoc.title) {
        document.title = nextDoc.title;
      }
      var currentRoot = selectPatchRoot(document);
      var nextRoot = selectPatchRoot(nextDoc);
      if (!currentRoot || !nextRoot) {
        return false;
      }
      cloneAttributes(nextRoot, currentRoot);
      currentRoot.innerHTML = nextRoot.innerHTML;
      if (nextDoc.body) {
        cloneAttributes(nextDoc.body, document.body);
      }
      document.dispatchEvent(new CustomEvent("hydria:runtime-updated", {
        detail: { kind: "html" }
      }));
      return true;
    }

    window.addEventListener("message", function (event) {
      var payload = event.data || {};
      if (!payload || payload.type !== "hydria-runtime-patch") {
        return;
      }

      var applied = false;
      try {
        if (payload.patchType === "css") {
          applied = applyCss(payload.entryPath || "", payload.content || "");
        } else if (payload.patchType === "html") {
          applied = applyHtml(payload.content || "");
        }
      } catch (error) {
        applied = false;
      }

      window.parent.postMessage({
        type: "hydria-runtime-patch-ack",
        sessionId: payload.sessionId || "",
        runtimeVersion: payload.runtimeVersion || 0,
        patchType: payload.patchType || "",
        applied: applied
      }, "*");
    });

    if (typeof window.fetch === "function") {
      var originalFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        try {
          if (typeof input === "string") {
            input = buildSessionAssetUrl(input);
          } else if (input instanceof URL) {
            input = new URL(buildSessionAssetUrl(input.toString()), window.location.href);
          } else if (input && typeof input.url === "string" && input instanceof Request) {
            var nextUrl = buildSessionAssetUrl(input.url);
            if (nextUrl !== input.url) {
              input = new Request(nextUrl, input);
            }
          }
        } catch (error) {
          // Keep the original request when rewrite is not possible.
        }
        return originalFetch(input, init);
      };
    }

    window.parent.postMessage({
      type: "hydria-runtime-ready",
      runtimeEntryPath: window.__HYDRIA_RUNTIME_ENTRY_PATH__ || ""
    }, "*");
  })();
  </script>`;
}

function rewriteRuntimeHtml(
  html = "",
  { workObjectId = "", sessionId = "", entryPath = "" } = {}
) {
  const normalized = String(html || "");
  const sessionAssetUrlTemplate = `/api/work-objects/${encodeURIComponent(
    String(workObjectId || "")
  )}/runtime/session/asset?sessionId=${encodeURIComponent(String(sessionId || ""))}&path=__ENTRY_PATH__`;
  const bridge = buildRuntimeBridgeScript({ runtimeEntryPath: entryPath }).replace(
    "__HYDRIA_SESSION_ASSET_URL__",
    sessionAssetUrlTemplate
  );
  const rewritten = normalized.replace(
    /\b(src|href)=["']([^"'#][^"']*)["']/gi,
    (match, attr, rawValue) => {
      const resolvedPath = resolveWorkObjectRuntimeAssetPath(entryPath, rawValue);
      if (
        !resolvedPath ||
        /^(?:https?:|data:|blob:|mailto:|tel:|javascript:|\/)/i.test(resolvedPath)
      ) {
        return match;
      }

      const assetUrl = buildSessionAssetUrl(workObjectId, sessionId, resolvedPath);
      return `${attr}="${assetUrl}"`;
    }
  );

  if (/<head[\s>]/i.test(rewritten)) {
    return rewritten.replace(
      /<head([^>]*)>/i,
      `<head$1><meta name="viewport" content="width=device-width, initial-scale=1" />${bridge}`
    );
  }

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />${bridge}</head><body>${rewritten}</body></html>`;
}

export class WorkObjectRuntimeService {
  constructor({ store, workObjectService }) {
    this.store = store;
    this.workObjectService = workObjectService;
  }

  listSessions(filter = {}) {
    const sessions = Object.values(this.store.readState().sessions || {});
    return sessions.filter((session) => {
      if (session.type !== "work_object_runtime") {
        return false;
      }
      if (filter.sessionId && session.id !== filter.sessionId) {
        return false;
      }
      if (filter.workObjectId && session.workObjectId !== filter.workObjectId) {
        return false;
      }
      if (
        filter.userId !== undefined &&
        filter.userId !== null &&
        Number(session.userId) !== Number(filter.userId)
      ) {
        return false;
      }
      if (
        filter.conversationId !== undefined &&
        filter.conversationId !== null &&
        Number(session.conversationId) !== Number(filter.conversationId)
      ) {
        return false;
      }
      if (filter.entryPath && normalizePath(session.entryPath) !== normalizePath(filter.entryPath)) {
        return false;
      }
      return true;
    });
  }

  getSession(sessionId = "") {
    const session = this.store.getSession(String(sessionId || ""));
    if (!session || session.type !== "work_object_runtime") {
      return null;
    }
    return session;
  }

  getRuntimePaths(workObject = {}, runtimeEntryPath = "") {
    const entries = toArray(workObject.entries);
    const candidatePaths = entries
      .filter((entry) => entry?.editable && isRuntimeTextAsset(entry.path))
      .map((entry) => normalizePath(entry.path));

    const normalizedRuntimeEntry = normalizePath(runtimeEntryPath);
    if (normalizedRuntimeEntry && !candidatePaths.includes(normalizedRuntimeEntry)) {
      candidatePaths.unshift(normalizedRuntimeEntry);
    }

    return [...new Set(candidatePaths)];
  }

  buildPreview(workObjectId = "", sessionId = "") {
    return {
      state: "live",
      renderUrl: buildSessionRenderUrl(workObjectId, sessionId),
      assetBaseUrl: `/api/work-objects/${encodeURIComponent(
        String(workObjectId || "")
      )}/runtime/session/assets`,
      mode: "session"
    };
  }

  toClientSession(session = {}) {
    return {
      id: session.id,
      workObjectId: session.workObjectId,
      userId: session.userId,
      conversationId: session.conversationId,
      status: session.status || "saved",
      runtimeKind: session.runtimeKind || "html_app",
      entryPath: session.entryPath || "",
      sourceRevision: Number(session.sourceRevision || 0),
      persistedRevision: Number(session.persistedRevision || 0),
      runtimeVersion: Number(session.runtimeVersion || 1),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      preview: {
        ...(session.preview || {})
      },
      context: {
        ...(session.context || {}),
        sourceOfTruthPaths: [...new Set(toArray(session.context?.sourceOfTruthPaths))]
      },
      draft: {
        dirty: Boolean(session.draft?.dirty),
        dirtyPaths: [...new Set(toArray(session.draft?.dirtyPaths))],
        modifiedAt: session.draft?.modifiedAt || "",
        savedAt: session.draft?.savedAt || "",
        draftCount: Object.keys(session.draft?.draftsByPath || {}).length
      }
    };
  }

  enrichSession(session = {}, workObject = null) {
    if (!session) {
      return null;
    }

    const resolvedWorkObject =
      workObject || this.workObjectService.get(session.workObjectId);

    if (!resolvedWorkObject) {
      return this.toClientSession(session);
    }

    return this.toClientSession({
      ...session,
      preview: this.buildPreview(session.workObjectId, session.id),
      context: {
        ...(session.context || {}),
        sourceOfTruthPaths:
          session.context?.sourceOfTruthPaths?.length
            ? session.context.sourceOfTruthPaths
            : this.getRuntimePaths(resolvedWorkObject, session.entryPath)
      }
    });
  }

  ensureSession({
    workObjectId,
    userId = null,
    conversationId = null,
    entryPath = ""
  } = {}) {
    const workObject = this.workObjectService.get(String(workObjectId || ""));
    if (!workObject) {
      throw new Error("Work object not found");
    }

    const runtimeEntry = resolveWorkObjectRuntimeEntry(workObject, entryPath);
    if (!runtimeEntry) {
      throw new Error("This work object does not support a live runtime");
    }

    const existing =
      this.listSessions({
        workObjectId: workObject.id,
        userId,
        conversationId
      })
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))[0] || null;

    if (existing) {
      const refreshed = this.store.updateSession(existing.id, (session) => ({
        ...session,
        updatedAt: nowIso(),
        entryPath: runtimeEntry.path,
        sourceRevision: Number(workObject.revision || session.sourceRevision || 1),
        persistedRevision: Number(workObject.revision || session.persistedRevision || 1),
        status:
          Object.keys(session.draft?.draftsByPath || {}).length > 0 ? "modified" : "saved",
        preview: this.buildPreview(workObject.id, session.id),
        context: {
          ...(session.context || {}),
          sourceOfTruthPaths: this.getRuntimePaths(workObject, runtimeEntry.path)
        }
      }));
      return this.enrichSession(refreshed, workObject);
    }

    const timestamp = nowIso();
    const session = {
      id: crypto.randomUUID(),
      type: "work_object_runtime",
      workObjectId: workObject.id,
      userId,
      conversationId,
      runtimeKind: "html_app",
      entryPath: runtimeEntry.path,
      sourceRevision: Number(workObject.revision || 1),
      persistedRevision: Number(workObject.revision || 1),
      runtimeVersion: 1,
      status: "saved",
      createdAt: timestamp,
      updatedAt: timestamp,
      preview: this.buildPreview(workObject.id, "")
    };

    session.preview = this.buildPreview(workObject.id, session.id);
    session.context = {
      sourceOfTruthPaths: this.getRuntimePaths(workObject, runtimeEntry.path)
    };
    session.draft = {
      dirty: false,
      dirtyPaths: [],
      draftsByPath: {},
      modifiedAt: "",
      savedAt: timestamp
    };

    this.store.createSession(session);
    return this.enrichSession(session, workObject);
  }

  updateDraft({ sessionId, entryPath = "", content = "" } = {}) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error("Runtime session not found");
    }

    const workObject = this.workObjectService.get(session.workObjectId);
    if (!workObject) {
      throw new Error("Work object not found");
    }

    const normalizedEntryPath = normalizePath(entryPath);
    const allowedPaths = this.getRuntimePaths(workObject, session.entryPath);
    if (!allowedPaths.includes(normalizedEntryPath)) {
      throw new Error("This file is not part of the runtime session");
    }

    const persisted = this.workObjectService.readContent({
      workObjectId: workObject.id,
      entryPath: normalizedEntryPath
    });

    const nextContent = String(content || "");
    const nextDrafts = {
      ...(session.draft?.draftsByPath || {})
    };

    if (nextContent === persisted.content) {
      delete nextDrafts[normalizedEntryPath];
    } else {
      nextDrafts[normalizedEntryPath] = nextContent;
    }

    const draftPaths = Object.keys(nextDrafts);
    const timestamp = nowIso();
    const updated = this.store.updateSession(session.id, {
      ...session,
      updatedAt: timestamp,
      runtimeVersion: Number(session.runtimeVersion || 1) + 1,
      status: draftPaths.length ? "modified" : "saved",
      preview: this.buildPreview(workObject.id, session.id),
      context: {
        ...(session.context || {}),
        sourceOfTruthPaths: allowedPaths
      },
      draft: {
        ...(session.draft || {}),
        dirty: draftPaths.length > 0,
        dirtyPaths: draftPaths,
        draftsByPath: nextDrafts,
        modifiedAt: draftPaths.length ? timestamp : session.draft?.modifiedAt || "",
        savedAt: draftPaths.length ? session.draft?.savedAt || "" : timestamp
      }
    });

    return this.enrichSession(updated, workObject);
  }

  resetSession({ sessionId = "" } = {}) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error("Runtime session not found");
    }

    const workObject = this.workObjectService.get(session.workObjectId);
    if (!workObject) {
      throw new Error("Work object not found");
    }

    const timestamp = nowIso();
    const updated = this.store.updateSession(session.id, {
      ...session,
      updatedAt: timestamp,
      runtimeVersion: Number(session.runtimeVersion || 1) + 1,
      status: "saved",
      preview: this.buildPreview(workObject.id, session.id),
      context: {
        ...(session.context || {}),
        sourceOfTruthPaths: this.getRuntimePaths(workObject, session.entryPath)
      },
      draft: {
        ...(session.draft || {}),
        dirty: false,
        dirtyPaths: [],
        draftsByPath: {},
        modifiedAt: "",
        savedAt: timestamp
      }
    });

    return this.enrichSession(updated, workObject);
  }

  buildRuntimeHtml({ sessionId = "" } = {}) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error("Runtime session not found");
    }

    const workObject = this.workObjectService.get(session.workObjectId);
    if (!workObject) {
      throw new Error("Work object not found");
    }

    const persisted = this.workObjectService.readContent({
      workObjectId: workObject.id,
      entryPath: session.entryPath
    });
    const runtimeContent =
      session.draft?.draftsByPath?.[session.entryPath] ?? persisted.content;

    return {
      html: rewriteRuntimeHtml(runtimeContent, {
        workObjectId: workObject.id,
        sessionId: session.id,
        entryPath: session.entryPath
      }),
      workObject,
      session: this.enrichSession(session, workObject),
      entryPath: session.entryPath
    };
  }

  resolveRuntimeAsset({ sessionId = "", entryPath = "" } = {}) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error("Runtime session not found");
    }

    const normalizedEntryPath = normalizePath(
      resolveWorkObjectRuntimeAssetPath(session.entryPath, entryPath) || entryPath
    );
    if (!normalizedEntryPath) {
      throw new Error("Runtime asset path is required");
    }

    const draftContent = session.draft?.draftsByPath?.[normalizedEntryPath];
    if (draftContent !== undefined) {
      return {
        kind: "inline",
        entryPath: normalizedEntryPath,
        contentType: inferAssetContentType(normalizedEntryPath, "text/plain; charset=utf-8"),
        content: draftContent
      };
    }

    const asset = this.workObjectService.resolveAsset({
      workObjectId: session.workObjectId,
      entryPath: normalizedEntryPath
    });

    return {
      kind: "file",
      entryPath: normalizedEntryPath,
      absolutePath: asset.absolutePath,
      contentType: inferAssetContentType(
        asset.entry?.path || normalizedEntryPath,
        asset.entry?.contentType
      )
    };
  }

  syncPersistedUpdate({
    workObjectId,
    entryPath = "",
    content = "",
    revision = 0
  } = {}) {
    const normalizedEntryPath = normalizePath(entryPath);
    const sessions = this.listSessions({ workObjectId });
    if (!sessions.length) {
      return [];
    }

    return sessions.map((session) => {
      const nextDrafts = {
        ...(session.draft?.draftsByPath || {})
      };

      if (
        Object.prototype.hasOwnProperty.call(nextDrafts, normalizedEntryPath) &&
        String(nextDrafts[normalizedEntryPath] || "") === String(content || "")
      ) {
        delete nextDrafts[normalizedEntryPath];
      }

      const dirtyPaths = Object.keys(nextDrafts);
      const updated = this.store.updateSession(session.id, {
        ...session,
        updatedAt: nowIso(),
        sourceRevision: Number(revision || session.sourceRevision || 1),
        persistedRevision: Number(revision || session.persistedRevision || 1),
        runtimeVersion: Number(session.runtimeVersion || 1) + 1,
        status: dirtyPaths.length ? "modified" : "saved",
        preview: this.buildPreview(session.workObjectId, session.id),
        draft: {
          ...(session.draft || {}),
          dirty: dirtyPaths.length > 0,
          dirtyPaths,
          draftsByPath: nextDrafts,
          savedAt: nowIso(),
          modifiedAt: dirtyPaths.length ? session.draft?.modifiedAt || nowIso() : ""
        }
      });

      return this.toClientSession(updated);
    });
  }
}

export default WorkObjectRuntimeService;
