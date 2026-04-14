import path from "node:path";

export const WORK_OBJECT_KINDS = [
  "project",
  "document",
  "presentation",
  "dataset",
  "code",
  "dashboard",
  "workflow",
  "design",
  "benchmark",
  "campaign",
  "image",
  "audio",
  "video"
];

const TEXT_EDITABLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".md",
  ".txt",
  ".html",
  ".css",
  ".scss",
  ".yml",
  ".yaml",
  ".env",
  ".csv",
  ".sql",
  ".xml",
  ".svg"
]);

export function safeWorkObjectSlug(value = "hydria-object") {
  return String(value || "hydria-object")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "hydria-object";
}

export function inferWorkObjectKind({
  project = null,
  format = "",
  classification = ""
} = {}) {
  if (project) {
    return "project";
  }

  const normalizedFormat = String(format || "").trim().toLowerCase();

  if (["csv", "json", "xlsx"].includes(normalizedFormat)) {
    return "dataset";
  }

  if (classification === "dashboard") {
    return "dashboard";
  }

  if (classification === "benchmark") {
    return "benchmark";
  }

  if (classification === "campaign") {
    return "campaign";
  }

  if (classification === "workflow") {
    return "workflow";
  }

  if (classification === "design") {
    return "design";
  }

  if (normalizedFormat === "image") {
    return "image";
  }

  if (classification === "audio") {
    return "audio";
  }

  if (classification === "video") {
    return "video";
  }

  if (["pptx", "odp", "svg", "image"].includes(normalizedFormat)) {
    return "presentation";
  }

  if (["md", "txt", "html", "docx", "pdf"].includes(normalizedFormat)) {
    return "document";
  }

  if (classification === "coding") {
    return "code";
  }

  return "document";
}

export function isEditableTextPath(relativePath = "") {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  const ext = path.extname(normalized).toLowerCase();

  if (normalized.endsWith(".env")) {
    return true;
  }

  return TEXT_EDITABLE_EXTENSIONS.has(ext);
}

export function inferEntryKind(relativePath = "", objectKind = "document") {
  const normalized = String(relativePath || "").replace(/\\/g, "/").toLowerCase();
  const ext = path.extname(normalized);

  if (["dashboard", "workflow", "design", "benchmark", "campaign", "image", "audio", "video"].includes(objectKind)) {
    return objectKind;
  }

  if (objectKind === "project" || [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext)) {
    return "code";
  }

  if ([".csv", ".json", ".xlsx"].includes(ext)) {
    return "dataset";
  }

  if ([".md", ".txt", ".docx", ".pdf", ".html"].includes(ext)) {
    return "document";
  }

  if ([".pptx", ".odp", ".svg"].includes(ext)) {
    return "presentation";
  }

  return objectKind;
}

export function normalizeWorkObjectEntry(entry = {}) {
  return {
    id: String(entry.id || entry.path || "").trim(),
    path: String(entry.path || "").replace(/\\/g, "/").trim(),
    label: String(entry.label || entry.path || entry.id || "entry").trim(),
    kind: String(entry.kind || "document").trim().toLowerCase(),
    editable: Boolean(entry.editable),
    primary: Boolean(entry.primary),
    contentType: String(entry.contentType || "text/plain").trim(),
    preview: String(entry.preview || "").trim(),
    sizeBytes: Number(entry.sizeBytes || 0),
    lastModifiedAt: String(entry.lastModifiedAt || "").trim()
  };
}

export function normalizeWorkObjectLinks(links = {}) {
  const normalizeIds = (value) =>
    Array.isArray(value)
      ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))]
      : [];

  return {
    projectId: String(links.projectId || "").trim(),
    artifactIds: normalizeIds(links.artifactIds),
    sourceWorkObjectId: String(links.sourceWorkObjectId || "").trim(),
    linkedLearningIds: normalizeIds(links.linkedLearningIds),
    linkedPatternIds: normalizeIds(links.linkedPatternIds),
    linkedMemoryIds: normalizeIds(links.linkedMemoryIds)
  };
}

export function normalizeWorkObject(workObject = {}) {
  const kind = WORK_OBJECT_KINDS.includes(workObject.kind)
    ? workObject.kind
    : "document";

  return {
    id: String(workObject.id || "").trim(),
    userId: Number(workObject.userId || 0),
    conversationId: Number(workObject.conversationId || 0),
    projectId: String(workObject.projectId || "").trim(),
    artifactId: String(workObject.artifactId || "").trim(),
    title: String(workObject.title || "Hydria Object").trim(),
    kind,
    status: String(workObject.status || "draft").trim().toLowerCase(),
    workspacePath: String(workObject.workspacePath || "").trim(),
    sourcePath: String(workObject.sourcePath || "").trim(),
    sourceFormat: String(workObject.sourceFormat || "text").trim().toLowerCase(),
    export: workObject.export || null,
    links: normalizeWorkObjectLinks(workObject.links || {}),
    projectType: String(workObject.projectType || "internal").trim().toLowerCase(),
    activeEntryPath: String(workObject.activeEntryPath || "").replace(/\\/g, "/").trim(),
    tags: Array.isArray(workObject.tags)
      ? [...new Set(workObject.tags.map((tag) => String(tag).trim()).filter(Boolean))]
      : [],
    entries: Array.isArray(workObject.entries)
      ? workObject.entries.map((entry) => normalizeWorkObjectEntry(entry))
      : [],
    history: Array.isArray(workObject.history) ? workObject.history : [],
    revision: Math.max(1, Number(workObject.revision || 1)),
    metadata: workObject.metadata || {},
    summary: String(workObject.summary || "").trim(),
    createdAt: String(workObject.createdAt || new Date().toISOString()),
    updatedAt: String(workObject.updatedAt || new Date().toISOString())
  };
}

export default {
  WORK_OBJECT_KINDS,
  safeWorkObjectSlug,
  inferWorkObjectKind,
  isEditableTextPath,
  inferEntryKind,
  normalizeWorkObjectEntry,
  normalizeWorkObjectLinks,
  normalizeWorkObject
};
