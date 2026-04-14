import { extname } from "./shared.js";

export const CODE_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".lua",
  ".php",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".swift",
  ".ts",
  ".tsx",
  ".bat"
]);

export const CONFIG_EXTENSIONS = new Set([
  ".cfg",
  ".conf",
  ".config",
  ".env",
  ".ini",
  ".json",
  ".jsonc",
  ".properties",
  ".toml",
  ".xml",
  ".yaml",
  ".yml"
]);

export const DATA_EXTENSIONS = new Set([
  ".csv",
  ".jsonl",
  ".ndjson",
  ".tsv"
]);

export const SPREADSHEET_EXTENSIONS = new Set([
  ".ods",
  ".xls",
  ".xlsx"
]);

export const TEXT_EXTENSIONS = new Set([
  ".log",
  ".md",
  ".rtf",
  ".txt"
]);

export const PRESENTATION_EXTENSIONS = new Set([
  ".odp",
  ".ppt",
  ".pptx"
]);

export const ARCHIVE_EXTENSIONS = new Set([
  ".7z",
  ".bz2",
  ".gz",
  ".rar",
  ".tar",
  ".tgz",
  ".xz",
  ".zip"
]);

export const MEDIA_EXTENSIONS = new Set([
  ".avi",
  ".m4a",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".wav",
  ".webm"
]);

const TEXT_LIKE_ENTRY_EXTENSIONS = new Set([
  ...CODE_EXTENSIONS,
  ...CONFIG_EXTENSIONS,
  ...DATA_EXTENSIONS,
  ...TEXT_EXTENSIONS,
  ".svg"
]);

export function inferAttachmentKind(file) {
  const extension = extname(file.originalname);
  const mimeType = (file.mimetype || "").toLowerCase();

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/") || MEDIA_EXTENSIONS.has(extension)) {
    return "media";
  }

  if (extension === ".pdf" || mimeType === "application/pdf") {
    return "pdf";
  }

  if (
    extension === ".docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  if (extension === ".doc" || mimeType === "application/msword") {
    return "doc";
  }

  if (
    SPREADSHEET_EXTENSIONS.has(extension) ||
    /spreadsheetml|ms-excel|opendocument\.spreadsheet/i.test(mimeType)
  ) {
    return "spreadsheet";
  }

  if (
    PRESENTATION_EXTENSIONS.has(extension) ||
    /presentationml|ms-powerpoint|opendocument\.presentation/i.test(mimeType)
  ) {
    return "presentation";
  }

  if (
    ARCHIVE_EXTENSIONS.has(extension) ||
    /zip|compressed|x-rar|x-7z|x-tar|gzip/i.test(mimeType)
  ) {
    return "archive";
  }

  if (
    CONFIG_EXTENSIONS.has(extension) ||
    /application\/json|text\/xml|application\/xml|yaml/i.test(mimeType)
  ) {
    return "config";
  }

  if (CODE_EXTENSIONS.has(extension)) {
    return "code";
  }

  if (DATA_EXTENSIONS.has(extension)) {
    return "data";
  }

  if (TEXT_EXTENSIONS.has(extension) || mimeType.startsWith("text/")) {
    return "text";
  }

  return "binary";
}

export function inferContentFamily(kind) {
  switch (kind) {
    case "pdf":
    case "doc":
    case "docx":
    case "text":
    case "presentation":
      return "document";
    case "code":
    case "config":
      return "technical";
    case "spreadsheet":
    case "data":
      return "data";
    case "image":
      return "image";
    case "archive":
    case "binary":
    case "media":
    default:
      return "binary_like";
  }
}

export function isTextLikeArchiveEntry(filename) {
  const extension = extname(filename);
  return TEXT_LIKE_ENTRY_EXTENSIONS.has(extension);
}

export function listSupportedAttachmentKinds() {
  return [
    "pdf",
    "doc",
    "docx",
    "text",
    "code",
    "config",
    "data",
    "spreadsheet",
    "image",
    "presentation",
    "archive",
    "media",
    "binary"
  ];
}
