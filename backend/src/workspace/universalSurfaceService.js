import path from "node:path";

function normalizePath(value = "") {
  return String(value || "").replace(/\\/g, "/");
}

function getExtension(filePath = "") {
  const normalized = normalizePath(filePath).toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  return lastDot >= 0 ? normalized.slice(lastDot) : "";
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);
const DATA_EXTENSIONS = new Set([".json", ".csv", ".tsv", ".xlsx"]);
const DOCUMENT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".html", ".pdf"]);
const CODE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".css",
  ".scss",
  ".yml",
  ".yaml",
  ".sql",
  ".xml"
]);

function toLabel(id = "") {
  return String(id || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildWorkObjectAssetUrl(workObjectId = "", entryPath = "") {
  const normalizedPath = normalizePath(entryPath);
  const encodedPath = normalizedPath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  return normalizedPath
    ? `/api/work-objects/${encodeURIComponent(String(workObjectId || ""))}/assets/${encodedPath}`
    : "";
}

export function buildWorkObjectRuntimeUrl(workObjectId = "", entryPath = "") {
  const normalizedPath = normalizePath(entryPath);
  const suffix = normalizedPath
    ? `?entryPath=${encodeURIComponent(normalizedPath)}`
    : "";
  return `/api/work-objects/${encodeURIComponent(String(workObjectId || ""))}/runtime${suffix}`;
}

export function inferEntrySurfaceType(entryPath = "", contentType = "", objectKind = "document") {
  const normalizedPath = normalizePath(entryPath).toLowerCase();
  const normalizedContentType = String(contentType || "").toLowerCase();
  const extension = getExtension(normalizedPath);

  if (objectKind === "dashboard") {
    return "dashboard";
  }

  if (objectKind === "workflow") {
    return "workflow";
  }

  if (objectKind === "design") {
    return "design";
  }

  if (objectKind === "benchmark") {
    return "benchmark";
  }

  if (objectKind === "campaign") {
    return "campaign";
  }

  if (objectKind === "image") {
    return "media";
  }

  if (objectKind === "audio") {
    return "audio";
  }

  if (objectKind === "video") {
    return "video";
  }

  if (IMAGE_EXTENSIONS.has(extension) || normalizedContentType.startsWith("image/")) {
    return "media";
  }

  if (AUDIO_EXTENSIONS.has(extension) || normalizedContentType.startsWith("audio/")) {
    return "media";
  }

  if (VIDEO_EXTENSIONS.has(extension) || normalizedContentType.startsWith("video/")) {
    return "media";
  }

  if (
    extension === ".html" ||
    extension === ".svg" ||
    /(?:^|\/)(public|dist|preview)\//.test(normalizedPath) ||
    /text\/html|image\/svg\+xml/.test(normalizedContentType)
  ) {
    return "app";
  }

  if (DATA_EXTENSIONS.has(extension) || /json|csv|spreadsheet/.test(normalizedContentType)) {
    return "data";
  }

  if (CODE_EXTENSIONS.has(extension) || objectKind === "code") {
    return "code";
  }

  if (objectKind === "presentation") {
    return "presentation";
  }

  if (objectKind === "project" && !normalizedPath) {
    return "project";
  }

  if (DOCUMENT_EXTENSIONS.has(extension) || objectKind === "document") {
    return "document";
  }

  if (objectKind === "project") {
    return "project";
  }

  return "generic";
}

function isRuntimeSurfaceCandidate(entry = {}) {
  return inferEntrySurfaceType(entry.path, entry.contentType, "project") === "app";
}

export function resolveWorkObjectRuntimeEntry(workObject = {}, preferredEntryPath = "") {
  const entries = Array.isArray(workObject.entries) ? workObject.entries : [];
  const normalizedPreferred = normalizePath(preferredEntryPath);
  const preferredEntry = entries.find((entry) => entry.path === normalizedPreferred);
  if (preferredEntry && isRuntimeSurfaceCandidate(preferredEntry)) {
    return preferredEntry;
  }

  const preferredPaths = [
    "index.html",
    "public/index.html",
    "dist/index.html",
    "preview/index.html",
    "app/index.html",
    "app.html"
  ];

  for (const preferredPath of preferredPaths) {
    const match = entries.find((entry) => normalizePath(entry.path) === preferredPath);
    if (match && isRuntimeSurfaceCandidate(match)) {
      return match;
    }
  }

  return entries.find((entry) => isRuntimeSurfaceCandidate(entry)) || null;
}

export function resolveWorkObjectRuntimeAssetPath(baseEntryPath = "", relativeAssetPath = "") {
  const normalizedBase = normalizePath(baseEntryPath);
  const normalizedRelative = normalizePath(relativeAssetPath);

  if (
    !normalizedRelative ||
    normalizedRelative.startsWith("#") ||
    normalizedRelative.startsWith("/") ||
    /^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(normalizedRelative)
  ) {
    return normalizedRelative;
  }

  const baseDir = path.posix.dirname(normalizedBase || "");
  return path.posix.normalize(path.posix.join(baseDir, normalizedRelative));
}

function createSurface(id, options = {}) {
  return {
    id,
    label: options.label || toLabel(id),
    enabled: options.enabled !== false,
    primary: Boolean(options.primary),
    mode: options.mode || id,
    description: options.description || ""
  };
}

function dedupeSurfaces(surfaces = []) {
  return [...new Map(
    (surfaces || [])
      .filter((surface) => surface?.enabled !== false)
      .map((surface) => [surface.id, surface])
  ).values()];
}

function chooseDefaultSurface(availableSurfaces = [], { objectKind = "", entrySurface = "" } = {}) {
  const preferredByKind = {
    dataset: ["data", "preview", "structure", "edit"],
    presentation: ["presentation", "preview", "structure", "edit"],
    dashboard: ["dashboard", "data", "preview", "edit"],
    benchmark: ["benchmark", "data", "preview", "structure", "edit"],
    campaign: ["campaign", "preview", "structure", "edit"],
    workflow: ["workflow", "preview", "structure", "edit"],
    design: ["design", "preview", "structure", "edit"],
    image: ["media", "preview", "edit"],
    audio: ["audio", "preview", "media", "edit"],
    video: ["video", "preview", "media", "edit"],
    code: ["code", "preview", "edit"],
    project: ["live", "overview", "preview", "structure", "edit"]
  };
  const preferredBySurface = {
    app: ["live", "app", "preview", "edit"],
    data: ["data", "preview", "edit"],
    benchmark: ["benchmark", "data", "preview", "edit"],
    campaign: ["campaign", "preview", "edit"],
    audio: ["audio", "preview", "media", "edit"],
    video: ["video", "preview", "media", "edit"],
    presentation: ["presentation", "preview", "structure", "edit"],
    dashboard: ["dashboard", "data", "preview", "edit"],
    workflow: ["workflow", "preview", "structure", "edit"],
    design: ["design", "preview", "structure", "edit"],
    code: ["code", "preview", "edit"],
    media: ["media", "preview"],
    document: ["preview", "structure", "edit"]
  };

  const preferredOrder = [
    ...(preferredByKind[objectKind] || []),
    ...(preferredBySurface[entrySurface] || []),
    "preview"
  ];

  for (const surfaceId of preferredOrder) {
    const match = availableSurfaces.find((surface) => surface.id === surfaceId);
    if (match) {
      return match.id;
    }
  }

  return availableSurfaces[0]?.id || "preview";
}

export function buildWorkObjectSurfaceModel({ workObject = {}, entryPath = "" } = {}) {
  const entries = Array.isArray(workObject.entries) ? workObject.entries : [];
  const previewAssetPath = normalizePath(workObject.metadata?.previewAssetPath || "");
  const previewEntry = previewAssetPath
    ? entries.find((entry) => entry.path === previewAssetPath)
    : null;
  const targetEntry =
    entries.find((entry) => entry.path === normalizePath(entryPath || workObject.activeEntryPath || "")) ||
    entries.find((entry) => entry.primary) ||
    entries[0] ||
    null;
  const previewTargetEntry =
    (["image", "audio", "video"].includes(workObject.kind || workObject.objectKind || "") && previewEntry) ||
    previewEntry ||
    targetEntry;
  const targetPath = targetEntry?.path || "";
  const previewTargetPath = previewTargetEntry?.path || targetPath;
  const objectKind = workObject.kind || workObject.objectKind || "document";
  const entrySurface = inferEntrySurfaceType(
    previewTargetPath,
    previewTargetEntry?.contentType || targetEntry?.contentType || "",
    objectKind
  );
  const assetUrl = previewTargetPath ? buildWorkObjectAssetUrl(workObject.id, previewTargetPath) : "";
  const runtimeEntry = resolveWorkObjectRuntimeEntry(workObject, targetPath);
  const runtimeUrl = runtimeEntry
    ? buildWorkObjectRuntimeUrl(workObject.id, runtimeEntry.path)
    : "";
  const editable = Boolean(targetEntry?.editable);

  const baseSurfaces = [
    createSurface("overview", {
      primary: objectKind === "project",
      description: "Project and object overview"
    }),
    createSurface("preview", {
      primary: objectKind !== "project",
      description: "Rendered user-facing view"
    }),
    createSurface("edit", {
      enabled: editable,
      description: "Direct editing surface"
    })
  ];

  if (["document", "project", "presentation"].includes(entrySurface) || objectKind === "project") {
    baseSurfaces.push(
      createSurface("structure", {
        description: "Sections, blocks and structure"
      })
    );
  }

  if (entrySurface === "code") {
    baseSurfaces.push(
      createSurface("code", {
        primary: objectKind === "code",
        description: "Readable code surface"
      })
    );
  }

  if (entrySurface === "data") {
    baseSurfaces.push(
      createSurface("data", {
        primary: objectKind === "dataset",
        description: "Structured dataset view"
      })
    );
  }

  if (entrySurface === "dashboard" || objectKind === "dashboard") {
    baseSurfaces.push(
      createSurface("dashboard", {
        primary: true,
        description: "Dashboard surface"
      })
    );
  }

  if (entrySurface === "benchmark" || objectKind === "benchmark") {
    baseSurfaces.push(
      createSurface("benchmark", {
        primary: true,
        description: "Benchmark surface"
      })
    );
  }

  if (entrySurface === "campaign" || objectKind === "campaign") {
    baseSurfaces.push(
      createSurface("campaign", {
        primary: true,
        description: "Campaign surface"
      })
    );
  }

  if (entrySurface === "audio" || objectKind === "audio") {
    baseSurfaces.push(
      createSurface("audio", {
        primary: true,
        description: "Audio brief surface"
      })
    );
  }

  if (entrySurface === "video" || objectKind === "video") {
    baseSurfaces.push(
      createSurface("video", {
        primary: true,
        description: "Video brief surface"
      })
    );
  }

  if (entrySurface === "workflow" || objectKind === "workflow") {
    baseSurfaces.push(
      createSurface("workflow", {
        primary: true,
        description: "Workflow surface"
      })
    );
  }

  if (entrySurface === "design" || objectKind === "design") {
    baseSurfaces.push(
      createSurface("design", {
        primary: true,
        description: "Design surface"
      })
    );
  }

  if (entrySurface === "media") {
    baseSurfaces.push(
      createSurface("media", {
        primary: true,
        description: "Media playback or visual asset"
      })
    );
  }

  if (entrySurface === "app") {
    baseSurfaces.push(
      createSurface("app", {
        primary: true,
        description: "Live app or HTML preview"
      })
    );
  }

  if (runtimeEntry) {
    baseSurfaces.push(
      createSurface("live", {
        primary: objectKind === "project" || entrySurface === "app",
        description: "Interactive live runtime preview"
      })
    );
  }

  if (objectKind === "presentation") {
    baseSurfaces.push(
      createSurface("presentation", {
        primary: entrySurface === "presentation",
        description: "Presentation-oriented view"
      })
    );
  }

  const availableSurfaces = dedupeSurfaces(baseSurfaces);
  const defaultSurface = chooseDefaultSurface(availableSurfaces, {
    objectKind,
    entrySurface
  });

  return {
    objectSurface: objectKind === "project" ? "project" : entrySurface,
    entrySurface,
    defaultSurface,
    availableSurfaces,
    activeEntryPath: targetPath,
    assetUrl,
    runtimeCapable: Boolean(runtimeEntry),
    runtimeEntryPath: runtimeEntry?.path || "",
    runtimeUrl,
    previewAssetPath,
    previewAssetUrl: previewAssetPath
      ? buildWorkObjectAssetUrl(workObject.id, previewAssetPath)
      : "",
    previewKind:
      entrySurface === "media"
        ? "media"
        : entrySurface === "app"
          ? "app"
          : entrySurface === "data"
            ? "data"
            : entrySurface === "code"
              ? "code"
              : entrySurface === "dashboard"
                ? "dashboard"
                : entrySurface === "benchmark"
                  ? "benchmark"
                  : entrySurface === "campaign"
                    ? "campaign"
                    : entrySurface === "audio"
                      ? "audio"
                      : entrySurface === "video"
                        ? "video"
                        : entrySurface === "workflow"
                          ? "workflow"
                          : entrySurface === "design"
                            ? "design"
                            : objectKind === "project"
                              ? "project"
                              : "document",
    supportsInlineEdit: editable,
    supportsPreview: Boolean(targetPath || objectKind === "project"),
    supportsStructuredNavigation: ["document", "project", "presentation", "code", "data", "benchmark", "campaign", "audio", "video"].includes(
      entrySurface
    ) || objectKind === "project"
  };
}

export default {
  buildWorkObjectAssetUrl,
  inferEntrySurfaceType,
  buildWorkObjectSurfaceModel
};
