function createTextFragment(text = "") {
  const fragment = document.createDocumentFragment();
  const pattern = /(!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    if (match[2] !== undefined && match[3]) {
      const image = document.createElement("img");
      image.src = match[3];
      image.alt = match[2] || "Embedded visual";
      image.className = "workspace-inline-image";
      fragment.appendChild(image);
    } else if (match[4] && match[5]) {
      const link = document.createElement("a");
      link.href = match[5];
      link.textContent = match[4];
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      fragment.appendChild(link);
    } else if (match[6]) {
      const code = document.createElement("code");
      code.textContent = match[6];
      fragment.appendChild(code);
    } else if (match[7]) {
      const strong = document.createElement("strong");
      strong.textContent = match[7];
      fragment.appendChild(strong);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

function normalizePath(value = "") {
  return String(value || "").replace(/\\/g, "/");
}

function friendlyPathLabel(filePath = "") {
  const normalized = normalizePath(filePath);
  if (!normalized) {
    return "";
  }

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return normalized;
  }

  return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
}

const SPREADSHEET_HISTORY_LIMIT = 80;
const spreadsheetHistoryStore = new Map();
const spreadsheetShortcutCleanupStore = new Map();
const spreadsheetSelectionStore = new Map();
const spreadsheetClipboardStore = new Map();

function cloneSpreadsheetSnapshot(model = {}) {
  return JSON.parse(JSON.stringify(model || {}));
}

function areSpreadsheetSnapshotsEqual(left = {}, right = {}) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}

const SPREADSHEET_NUMBER_FORMATS = new Set(["number", "currency", "percent", "date"]);
const SPREADSHEET_HORIZONTAL_ALIGNMENTS = new Set(["left", "center", "right"]);
const SPREADSHEET_VERTICAL_ALIGNMENTS = new Set(["top", "middle", "bottom"]);
const SPREADSHEET_BORDER_EDGES = ["top", "right", "bottom", "left"];

function normalizeSpreadsheetColor(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return "";
  }
  const hex = match[1].length === 3
    ? match[1].split("").map((char) => `${char}${char}`).join("")
    : match[1];
  return `#${hex.toLowerCase()}`;
}

function normalizeSpreadsheetBorderSpec(border = {}) {
  if (!border || typeof border !== "object" || Array.isArray(border)) {
    return null;
  }
  const normalized = {};
  SPREADSHEET_BORDER_EDGES.forEach((edge) => {
    if (border[edge]) {
      normalized[edge] = true;
    }
  });
  if (!SPREADSHEET_BORDER_EDGES.some((edge) => normalized[edge])) {
    return null;
  }
  const color = normalizeSpreadsheetColor(border.color) || "#202124";
  return { ...normalized, color };
}

function normalizeSpreadsheetCellFormat(format = {}) {
  if (typeof format === "string") {
    return SPREADSHEET_NUMBER_FORMATS.has(format) ? { numberFormat: format } : {};
  }
  if (!format || typeof format !== "object" || Array.isArray(format)) {
    return {};
  }

  const normalized = {};
  const numberFormat = String(format.numberFormat || format.format || "");
  if (SPREADSHEET_NUMBER_FORMATS.has(numberFormat)) {
    normalized.numberFormat = numberFormat;
  }
  ["bold", "italic", "underline"].forEach((flag) => {
    if (format[flag]) {
      normalized[flag] = true;
    }
  });
  const horizontalAlign = String(format.horizontalAlign || format.align || "");
  if (SPREADSHEET_HORIZONTAL_ALIGNMENTS.has(horizontalAlign)) {
    normalized.horizontalAlign = horizontalAlign;
  }
  const verticalAlign = String(format.verticalAlign || "");
  if (SPREADSHEET_VERTICAL_ALIGNMENTS.has(verticalAlign)) {
    normalized.verticalAlign = verticalAlign;
  }
  const fontSize = Number(format.fontSize);
  if (Number.isFinite(fontSize)) {
    normalized.fontSize = Math.max(8, Math.min(36, Math.round(fontSize)));
  }
  const textColor = normalizeSpreadsheetColor(format.textColor);
  if (textColor) {
    normalized.textColor = textColor;
  }
  const fillColor = normalizeSpreadsheetColor(format.fillColor);
  if (fillColor) {
    normalized.fillColor = fillColor;
  }
  const border = normalizeSpreadsheetBorderSpec(format.border);
  if (border) {
    normalized.border = border;
  }
  return normalized;
}

function isSpreadsheetCellFormatEmpty(format = {}) {
  return Object.keys(normalizeSpreadsheetCellFormat(format)).length === 0;
}

function getSpreadsheetHistoryKey(workObject = null, filePath = "") {
  const objectKey = workObject?.id || workObject?.objectId || workObject?.title || "workspace";
  const pathKey = normalizePath(filePath || workObject?.primaryFile || "sheet");
  return `${objectKey}::${pathKey}`;
}

function clampSpreadsheetIndex(value = 0, max = 0) {
  const parsed = Number(value);
  return Math.max(0, Math.min(Number.isFinite(parsed) ? Math.trunc(parsed) : 0, Math.max(0, max)));
}

function normalizeSpreadsheetSelectionState(selection = {}, rowCount = 1, columnCount = 1) {
  const maxRowIndex = Math.max(0, rowCount - 1);
  const maxColumnIndex = Math.max(0, columnCount - 1);
  const active = selection?.activeSelection || {};
  const range = selection?.selectionRange || {};
  const activeSelection = {
    rowIndex: clampSpreadsheetIndex(active.rowIndex, maxRowIndex),
    columnIndex: clampSpreadsheetIndex(active.columnIndex, maxColumnIndex)
  };

  return {
    activeSelection,
    selectionRange: {
      startRowIndex: clampSpreadsheetIndex(range.startRowIndex ?? activeSelection.rowIndex, maxRowIndex),
      startColumnIndex: clampSpreadsheetIndex(range.startColumnIndex ?? activeSelection.columnIndex, maxColumnIndex),
      endRowIndex: clampSpreadsheetIndex(range.endRowIndex ?? activeSelection.rowIndex, maxRowIndex),
      endColumnIndex: clampSpreadsheetIndex(range.endColumnIndex ?? activeSelection.columnIndex, maxColumnIndex)
    }
  };
}

function saveSpreadsheetSelectionState(historyKey = "", selection = {}, rowCount = 1, columnCount = 1) {
  spreadsheetSelectionStore.set(
    historyKey || "workspace::sheet",
    normalizeSpreadsheetSelectionState(selection, rowCount, columnCount)
  );
}

function getSpreadsheetHistoryState(historyKey = "", currentSnapshot = {}) {
  const key = historyKey || "workspace::sheet";
  let state = spreadsheetHistoryStore.get(key);
  if (!state) {
    state = {
      past: [],
      future: [],
      current: cloneSpreadsheetSnapshot(currentSnapshot)
    };
    spreadsheetHistoryStore.set(key, state);
    return state;
  }

  if (!areSpreadsheetSnapshotsEqual(state.current, currentSnapshot)) {
    state.past = [];
    state.future = [];
    state.current = cloneSpreadsheetSnapshot(currentSnapshot);
  }

  return state;
}

function registerSpreadsheetShortcutHandler(historyKey = "", previewShell = null, handlers = null) {
  const key = historyKey || "workspace::sheet";
  spreadsheetShortcutCleanupStore.get(key)?.();
  spreadsheetShortcutCleanupStore.delete(key);

  const normalizedHandlers =
    typeof handlers === "function"
      ? { keydown: handlers }
      : handlers && typeof handlers === "object"
        ? handlers
        : {};
  const registeredHandlers = Object.entries(normalizedHandlers).filter(
    ([, handler]) => typeof handler === "function"
  );

  if (!previewShell || !registeredHandlers.length) {
    return;
  }

  registeredHandlers.forEach(([eventName, handler]) => {
    document.addEventListener(eventName, handler, true);
  });
  spreadsheetShortcutCleanupStore.set(key, () => {
    registeredHandlers.forEach(([eventName, handler]) => {
      document.removeEventListener(eventName, handler, true);
    });
  });
}

function getDocumentWorkspacePreviewProfile(workObject = null) {
  const familyId = workObject?.workspaceFamilyId || "";
  const profileMap = {
    document_knowledge: {
      workspaceLabel: "Knowledge workspace",
      tabs: ["Page", "Outline", "Knowledge"],
      contextLabelA: "Knowledge posture",
      contextValueA: "Structured knowledge",
      contextLabelB: "Primary takeaway",
      ribbon: ["Knowledge", "Reading", "Reusable", "Project linked"]
    },
    project_management: {
      workspaceLabel: "Project management workspace",
      tabs: ["Board", "Tracks", "Reading"],
      contextLabelA: "Delivery posture",
      contextValueA: "Project tracks",
      contextLabelB: "Current move",
      ribbon: ["Project", "Tracks", "Dependencies", "Project linked"]
    },
    strategy_planning: {
      workspaceLabel: "Strategy workspace",
      tabs: ["Plan", "Themes", "Decision"],
      contextLabelA: "Planning posture",
      contextValueA: "Strategic board",
      contextLabelB: "Current thesis",
      ribbon: ["Strategy", "Themes", "Tradeoffs", "Project linked"]
    },
    file_storage: {
      workspaceLabel: "Storage workspace",
      tabs: ["Drive", "Folders", "Reading"],
      contextLabelA: "Storage posture",
      contextValueA: "Folder index",
      contextLabelB: "Current asset group",
      ribbon: ["Storage", "Folders", "Access", "Project linked"]
    },
    testing_qa: {
      workspaceLabel: "QA workspace",
      tabs: ["Runbook", "Suites", "Checks"],
      contextLabelA: "QA posture",
      contextValueA: "Test coverage",
      contextLabelB: "Current scenario",
      ribbon: ["QA", "Suites", "Checks", "Project linked"]
    },
    web_cms: {
      workspaceLabel: "Web & CMS workspace",
      tabs: ["Pages", "Site map", "Reading"],
      contextLabelA: "Publishing posture",
      contextValueA: "Site inventory",
      contextLabelB: "Current page",
      ribbon: ["CMS", "Pages", "Publishing", "Project linked"]
    }
  };

  return profileMap[familyId] || {
    workspaceLabel: "Document workspace",
    tabs: ["Page", "Outline", "Reading"],
    contextLabelA: "Reading posture",
    contextValueA: "Structured page",
    contextLabelB: "Primary takeaway",
    ribbon: ["Page", "Reading", "Narrative", "Project linked"]
  };
}

function getDatasetWorkspacePreviewProfile(workObject = null) {
  const familyId = workObject?.workspaceFamilyId || "";
  const profileMap = {
    data_spreadsheet: {
      workspaceLabel: "Spreadsheet workspace",
      primaryTab: "Sheet 1",
      secondaryTab: "Summary",
      formulaLabel: "Sheet fields",
      contextLabelA: "Sheet profile",
      contextValueA: "Working sheet",
      contextLabelB: "Primary fields",
      ribbonPrefix: "Sheet 1"
    },
    hr: {
      workspaceLabel: "HR workspace",
      primaryTab: "Employees",
      secondaryTab: "Summary",
      formulaLabel: "People fields",
      contextLabelA: "People profile",
      contextValueA: "Roster board",
      contextLabelB: "Primary fields",
      ribbonPrefix: "Employees"
    },
    finance: {
      workspaceLabel: "Finance workspace",
      primaryTab: "Budget",
      secondaryTab: "Summary",
      formulaLabel: "Budget fields",
      contextLabelA: "Budget profile",
      contextValueA: "Finance sheet",
      contextLabelB: "Primary fields",
      ribbonPrefix: "Budget"
    },
    crm_sales: {
      workspaceLabel: "CRM workspace",
      primaryTab: "Pipeline",
      secondaryTab: "Summary",
      formulaLabel: "Pipeline fields",
      contextLabelA: "Pipeline profile",
      contextValueA: "Sales board",
      contextLabelB: "Primary fields",
      ribbonPrefix: "Pipeline"
    },
    knowledge_graph: {
      workspaceLabel: "Knowledge graph workspace",
      primaryTab: "Entities",
      secondaryTab: "Relations",
      formulaLabel: "Entity fields",
      contextLabelA: "Graph profile",
      contextValueA: "Schema table",
      contextLabelB: "Primary fields",
      ribbonPrefix: "Entities"
    }
  };

  return profileMap[familyId] || profileMap.data_spreadsheet;
}

function toSurfaceLabel(surfaceId = "") {
  switch (String(surfaceId || "")) {
    case "live":
      return "Live";
    case "dashboard":
      return "Dashboard";
    case "benchmark":
      return "Benchmark";
    case "campaign":
      return "Campaign";
    case "audio":
      return "Audio";
    case "video":
      return "Video";
    case "workflow":
      return "Workflow";
    case "design":
      return "Design";
    case "preview":
    case "app":
      return "Preview";
    case "edit":
      return "Modify";
    case "structure":
      return "Outline";
    case "data":
      return "Data";
    case "code":
      return "Code";
    case "media":
      return "Media";
    case "presentation":
      return "Slides";
    case "overview":
      return "Overview";
    default:
      return String(surfaceId || "Preview");
  }
}

function appendInlineContent(element, text = "") {
  element.appendChild(createTextFragment(text));
}

function normalizeText(value = "") {
  return String(value || "").replace(/\r\n/g, "\n");
}

function buildWorkObjectAssetUrl(workObject = null) {
  if (!workObject?.id) {
    return "";
  }
  if (workObject.previewAssetUrl) {
    return workObject.previewAssetUrl;
  }
  const targetPath = workObject.previewAssetPath || workObject.primaryFile || "";
  if (!targetPath) {
    return "";
  }
  return `/api/work-objects/${encodeURIComponent(String(workObject.id))}/assets/${normalizePath(targetPath)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function isRichDocumentHtml(value = "") {
  return /<\s*(h1|h2|h3|h4|p|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|hr|img|figure|figcaption|div)\b/i.test(
    normalizeText(value)
  );
}

function extractRichDocumentHeadings(value = "") {
  if (!isRichDocumentHtml(value)) {
    return [];
  }
  const template = document.createElement("template");
  template.innerHTML = normalizeText(value);
  return Array.from(template.content.querySelectorAll("h1, h2, h3, h4")).map((node, index) => ({
    id: node.id || `heading-${index + 1}`,
    label: String(node.textContent || "").trim() || `Section ${index + 1}`
  }));
}

function safeJsonParse(value = "") {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return null;
  }
}

function getLineOffsets(lines = []) {
  const offsets = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }
  return offsets;
}

function createWholeFileSection(text = "") {
  return {
    id: "whole-file",
    title: "Whole file",
    block: text,
    level: 1,
    start: 0,
    bodyStart: 0,
    end: text.length
  };
}

function buildCodeBlocks(text = "", startOffset = 0) {
  const normalized = normalizeText(text);
  if (!normalized.trim()) {
    return [];
  }

  const blocks = [];
  let start = 0;
  let index = 0;
  const blockRegex = /\n{2,}/g;
  let match;

  while ((match = blockRegex.exec(normalized)) !== null) {
    const chunk = normalized.slice(start, match.index).trim();
    if (chunk) {
      const rawStart = normalized.indexOf(chunk, start);
      blocks.push({
        id: `block-${index + 1}`,
        title: chunk.split("\n")[0].slice(0, 72) || `Block ${index + 1}`,
        kind: "block",
        preview: chunk.slice(0, 140),
        block: chunk,
        start: startOffset + rawStart,
        end: startOffset + rawStart + chunk.length
      });
      index += 1;
    }
    start = match.index + match[0].length;
  }

  const tail = normalized.slice(start).trim();
  if (tail) {
    const rawStart = normalized.indexOf(tail, start);
    blocks.push({
      id: `block-${index + 1}`,
      title: tail.split("\n")[0].slice(0, 72) || `Block ${index + 1}`,
      kind: "block",
      preview: tail.slice(0, 140),
      block: tail,
      start: startOffset + rawStart,
      end: startOffset + rawStart + tail.length
    });
  }

  return blocks.length ? blocks : [{
    id: "block-1",
    title: "Whole file",
    kind: "block",
    preview: normalized.slice(0, 140),
    block: normalized,
    start: startOffset,
    end: startOffset + normalized.length
  }];
}

export function isMarkdownPath(filePath = "") {
  return /\.(md|markdown|txt)$/i.test(filePath);
}

export function isJsonPath(filePath = "") {
  return /\.json$/i.test(filePath);
}

export function isCsvPath(filePath = "") {
  return /\.(csv|tsv)$/i.test(filePath);
}

export function isCodePath(filePath = "") {
  return /\.(js|mjs|cjs|ts|tsx|jsx|css|html|yml|yaml)$/i.test(filePath);
}

export function isImagePath(filePath = "") {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(filePath);
}

export function isAudioPath(filePath = "") {
  return /\.(mp3|wav|ogg|m4a)$/i.test(filePath);
}

export function isVideoPath(filePath = "") {
  return /\.(mp4|webm|mov)$/i.test(filePath);
}

export function isHtmlPreviewPath(filePath = "") {
  return /\.(html|svg)$/i.test(filePath);
}

export function deriveWorkspaceSections(content = "", filePath = "") {
  const text = normalizeText(content);

  if (!text.trim()) {
    return [];
  }

  if (isRichDocumentHtml(text)) {
    const template = document.createElement("template");
    template.innerHTML = text;
    const headings = Array.from(template.content.querySelectorAll("h1, h2, h3, h4"));
    if (!headings.length) {
      return [createWholeFileSection(text)];
    }
    return headings.map((heading, index) => ({
      id: heading.id || `section-${index + 1}`,
      title: String(heading.textContent || "").trim() || `Section ${index + 1}`,
      block: heading.outerHTML,
      level: Number(heading.tagName.slice(1)) || 1,
      start: 0,
      bodyStart: 0,
      end: text.length
    }));
  }

  if (!isMarkdownPath(filePath)) {
    return [createWholeFileSection(text)];
  }

  const lines = text.split("\n");
  const offsets = getLineOffsets(lines);
  const headingIndexes = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (/^#{1,3}\s+/.test(lines[index].trim())) {
      headingIndexes.push(index);
    }
  }

  if (!headingIndexes.length) {
    return [createWholeFileSection(text)];
  }

  return headingIndexes.map((startIndex, position) => {
    const nextIndex = headingIndexes[position + 1] ?? lines.length;
    const blockStart = offsets[startIndex];
    const blockEnd = nextIndex < offsets.length ? offsets[nextIndex] - 1 : text.length;
    const headingLine = lines[startIndex].trim();
    const bodyStart = blockStart + lines[startIndex].length + 1;
    const block = lines.slice(startIndex, nextIndex).join("\n").trim();
    return {
      id: `section-${position + 1}`,
      title: headingLine.replace(/^#{1,3}\s+/, "").trim(),
      block,
      level: (headingLine.match(/^#{1,3}/)?.[0] || "#").length,
      start: blockStart,
      bodyStart: Math.min(bodyStart, blockEnd),
      end: blockEnd
    };
  });
}

export function applyWorkspaceSectionEdit(
  originalContent = "",
  filePath = "",
  sectionId = "",
  updatedBlock = ""
) {
  const normalized = normalizeText(originalContent);
  if (!sectionId || sectionId === "whole-file" || !isMarkdownPath(filePath)) {
    return String(updatedBlock || "");
  }

  const sections = deriveWorkspaceSections(normalized, filePath);
  const selected = sections.find((section) => section.id === sectionId);
  if (!selected) {
    return String(updatedBlock || "");
  }

  return `${normalized.slice(0, selected.start)}${String(updatedBlock || "").trim()}${normalized.slice(selected.end)}`;
}

export function deriveWorkspaceBlocks(
  content = "",
  filePath = "",
  sectionId = "",
  sections = []
) {
  const normalized = normalizeText(content);
  if (!normalized.trim()) {
    return [];
  }

  if (sectionId && sectionId !== "whole-file") {
    const selectedSection =
      sections.find((section) => section.id === sectionId) ||
      deriveWorkspaceSections(normalized, filePath).find((section) => section.id === sectionId);

    if (!selectedSection) {
      return [];
    }

    const sectionBody = normalized.slice(selectedSection.bodyStart, selectedSection.end).trim();
    if (!sectionBody) {
      return [];
    }
    return buildCodeBlocks(sectionBody, normalized.indexOf(sectionBody, selectedSection.bodyStart)).map(
      (block, index) => ({
        ...block,
        id: `section-block-${index + 1}`,
        kind: /(^[-*]\s)|(^\d+\.\s)/m.test(block.block) ? "list" : "paragraph"
      })
    );
  }

  if (isMarkdownPath(filePath)) {
    return buildCodeBlocks(normalized, 0).map((block, index) => ({
      ...block,
      id: `block-${index + 1}`,
      kind: /(^[-*]\s)|(^\d+\.\s)/m.test(block.block) ? "list" : "paragraph"
    }));
  }

  if (isJsonPath(filePath)) {
    try {
      const parsed = JSON.parse(normalized);
      return Object.keys(parsed).map((key, index) => ({
        id: `json-block-${index + 1}`,
        title: key,
        kind: "json",
        preview: JSON.stringify(parsed[key]).slice(0, 140),
        block: JSON.stringify(parsed[key], null, 2),
        start: normalized.indexOf(`"${key}"`),
        end: normalized.indexOf(`"${key}"`) + JSON.stringify(parsed[key], null, 2).length
      }));
    } catch {
      return buildCodeBlocks(normalized, 0);
    }
  }

  return buildCodeBlocks(normalized, 0).map((block, index) => ({
    ...block,
    id: `code-block-${index + 1}`,
    kind: "code"
  }));
}

export function applyWorkspaceBlockEdit(
  originalContent = "",
  filePath = "",
  sectionId = "",
  blockId = "",
  updatedBlock = "",
  sections = []
) {
  if (!blockId) {
    return String(updatedBlock || "");
  }

  const normalized = normalizeText(originalContent);
  const blocks = deriveWorkspaceBlocks(normalized, filePath, sectionId, sections);
  const selected = blocks.find((block) => block.id === blockId);

  if (!selected) {
    return normalized;
  }

  return `${normalized.slice(0, selected.start)}${String(updatedBlock || "").trim()}${normalized.slice(selected.end)}`;
}

export function matchesWorkspaceDimension(filePath = "", dimension = "") {
  const normalizedPath = normalizePath(filePath).toLowerCase();
  const normalizedDimension = String(dimension || "").toLowerCase();

  if (!normalizedDimension) {
    return true;
  }

  if (normalizedDimension === "structure") {
    return /(readme|project\.blueprint|hydria\.manifest|experience\/overview|package\.json|app\.config\.json)/.test(
      normalizedPath
    );
  }

  if (normalizedDimension === "logic") {
    return /(logic\/|src\/|architecture|server\.js|app\.js|index\.js|package\.json|app\.config\.json)/.test(
      normalizedPath
    );
  }

  if (normalizedDimension === "text" || normalizedDimension === "narrative") {
    return /(content\/|brief|overview|story|roadmap|source-work-object|readme)/.test(
      normalizedPath
    );
  }

  if (normalizedDimension === "visual") {
    return /(studio\/|visual|storyboard|presentation|slides)/.test(normalizedPath);
  }

  if (normalizedDimension === "audio") {
    return /(audio\/|track|music|sound|voice)/.test(normalizedPath);
  }

  if (normalizedDimension === "data") {
    return /\.(json|csv|xlsx)$/.test(normalizedPath) || /data\//.test(normalizedPath);
  }

  return true;
}

function renderMarkdownPreview(
  container,
  content = "",
  sections = [],
  selectedSectionId = "",
  onSectionFocus = null,
  onInlineEdit = null,
  workObject = null,
  projectWorkObjects = [],
  onProjectObjectSelect = null
) {
  const profile = getDocumentWorkspacePreviewProfile(workObject);
  const isDocsClone = workObject?.workspaceFamilyId === "document_knowledge";
  const usesRichDocument = isDocsClone && isRichDocumentHtml(content);
  let activeEditable = null;
  let docsMenuPanel = null;
  let docsMenuButtons = [];
  const normalized = normalizeText(content);
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const headings = usesRichDocument
    ? extractRichDocumentHeadings(normalized).map((entry) => `# ${entry.label}`)
    : blocks.filter((block) => /^#{1,3}\s+/.test(block));
  const listCount = blocks.filter((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    return lines.length && lines.every((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line));
  }).length;
  const insightGrid = createPreviewInsightGrid([
    { label: "Sections", value: headings.length || 1, meta: headings[0]?.replace(/^#{1,3}\s+/, "") || "Structured document" },
    { label: "Words", value: previewWordCount(normalized), meta: "Current readable draft" },
    { label: "Lists", value: listCount, meta: listCount ? "Actionable grouped content" : "Mostly narrative text" }
  ]);
  if (insightGrid && !isDocsClone) {
    container.appendChild(insightGrid);
  }

  const previewShell = document.createElement("section");
  previewShell.className = `workspace-document-preview-shell${isDocsClone ? " workspace-document-preview-shell-docs" : ""}`;

  const previewToolbar = document.createElement("div");
  previewToolbar.className = "workspace-document-preview-toolbar";
  const previewMeta = document.createElement("div");
  previewMeta.className = "workspace-code-toolbar-meta";
  const previewTitle = document.createElement("strong");
  previewTitle.textContent = headings[0]?.replace(/^#{1,3}\s+/, "") || "Document preview";
  const previewHint = document.createElement("span");
  previewHint.className = "tiny";
  previewHint.textContent = isDocsClone
    ? `Editing | Autosaved | ${previewWordCount(normalized)} words`
    : `${headings.length || 1} sections | ${previewWordCount(normalized)} words`;
  previewMeta.append(previewTitle, previewHint);
  const previewTabs = document.createElement("div");
  previewTabs.className = "workspace-code-tabs";
  (isDocsClone ? ["Editing", "Outline", "Share-ready"] : profile.tabs).forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-code-tab${index === 0 ? " is-active" : ""}`;
    chip.textContent = label;
    previewTabs.appendChild(chip);
  });
  previewToolbar.append(previewMeta, previewTabs);
  previewShell.appendChild(previewToolbar);

  let docsToolbar = null;
  let docsToolbarStatus = null;
  let shell = null;
  let docsCommitHandle = null;

  const commitDocumentShell = () => {
    if (shell) {
      onInlineEdit?.(serializeDocumentPreviewShell(shell));
    }
  };

  const focusPromptForDocs = () => {
    const promptInput = document.getElementById("prompt-input");
    if (!promptInput) {
      return;
    }
    const pageName = previewTitle.textContent || workObject?.title || "this page";
    promptInput.value = `Improve ${pageName}: rewrite it more clearly, keep the same intent and structure.`;
    promptInput.focus();
    promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
  };

  const createNewProjectDoc = () => {
    const promptInput = document.getElementById("prompt-input");
    if (!promptInput) {
      return;
    }
    const projectName = workObject?.projectName || "this project";
    promptInput.value = `Create a new document in ${projectName}: add a clear title and start the first page.`;
    promptInput.focus();
    promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
    updateDocsToolbarStatus("Prompt ready to create a new document");
  };

  const getActiveBlockTarget = () => {
    const selection = window.getSelection();
    const anchor = selection?.anchorNode || null;
    const element = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
    if (element) {
      const target = element.closest("h1, h2, h3, h4, p, blockquote, li, th, td, figcaption");
      if (target) {
        return target;
      }
    }
    return activeEditable
      ? activeEditable.closest("h1, h2, h3, h4, p, blockquote, li, th, td, figcaption")
      : null;
  };

  const applyBlockAlignment = (value = "left") => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Select a block first.");
      return;
    }
    target.style.textAlign = value;
    commitDocumentShell();
    updateDocsToolbarStatus("Saved automatically");
  };

  const applyBlockFontSize = (value = "") => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    target.style.fontSize = value || "";
    commitDocumentShell();
    updateDocsToolbarStatus("Saved automatically");
  };

  const applyBlockFontFamily = (value = "") => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    target.style.fontFamily = value || "";
    commitDocumentShell();
    updateDocsToolbarStatus("Saved automatically");
  };

  const unwrapDocsPageShell = () => {
    if (!shell) {
      return;
    }
    const rawNodes = [];
    Array.from(shell.children).forEach((child) => {
      if (child.classList?.contains("workspace-document-page-sheet")) {
        rawNodes.push(...Array.from(child.childNodes));
      } else {
        rawNodes.push(child);
      }
    });
    shell.replaceChildren(...rawNodes);
  };

  const rebuildDocsPageShell = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const rawNodes = Array.from(shell.childNodes);
    shell.innerHTML = "";
    let pageIndex = 0;
    let currentPage = document.createElement("section");
    currentPage.className = "workspace-document-page-sheet";
    currentPage.dataset.page = String(pageIndex + 1);
    for (const node of rawNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains("workspace-docs-page-break")) {
        shell.appendChild(currentPage);
        shell.appendChild(node);
        pageIndex += 1;
        currentPage = document.createElement("section");
        currentPage.className = "workspace-document-page-sheet";
        currentPage.dataset.page = String(pageIndex + 1);
        continue;
      }
      currentPage.appendChild(node);
    }
    if (currentPage.childNodes.length || !shell.children.length) {
      shell.appendChild(currentPage);
    }
  };

  const projectLinkedObjects = (projectWorkObjects || []).filter((item) => item.id !== workObject?.id);
  const projectDocs = projectLinkedObjects.filter(
    (item) => item.id !== workObject?.id && item.workspaceFamilyId === "document_knowledge"
  );
  const projectAssets = projectLinkedObjects.filter(
    (item) => item.id !== workObject?.id && ["image", "video", "audio", "dataset", "presentation", "document"].includes(item.objectKind || item.kind)
  );

  const insertProjectAsset = (assetWorkObject) => {
    if (!shell || !assetWorkObject) {
      return;
    }
    const assetType = assetWorkObject.objectKind || assetWorkObject.kind || "";
    const assetUrl = buildWorkObjectAssetUrl(assetWorkObject);
    let node = null;

    if (assetType === "image" && assetUrl) {
      const figure = document.createElement("figure");
      figure.className = "workspace-docs-figure";
      const image = document.createElement("img");
      image.src = assetUrl;
      image.alt = assetWorkObject.title || "Project image";
      image.className = "workspace-inline-image";
      const caption = document.createElement("figcaption");
      caption.textContent = assetWorkObject.title || "Project image";
      bindEditable(caption, { multiline: true });
      figure.append(image, caption);
      node = figure;
      activeEditable = caption;
    } else if (assetType === "video" && assetUrl) {
      const figure = document.createElement("figure");
      figure.className = "workspace-docs-figure";
      const video = document.createElement("video");
      video.src = assetUrl;
      video.controls = true;
      video.className = "workspace-inline-video";
      const caption = document.createElement("figcaption");
      caption.textContent = assetWorkObject.title || "Project video";
      bindEditable(caption, { multiline: true });
      figure.append(video, caption);
      node = figure;
      activeEditable = caption;
    } else if (assetType === "dataset") {
      const callout = document.createElement("blockquote");
      callout.textContent = `Table linked from project: ${assetWorkObject.title || "Dataset"} (${assetWorkObject.primaryFile || "table.csv"})`;
      bindEditable(callout, { multiline: true });
      node = callout;
      activeEditable = callout;
    } else {
      const paragraph = document.createElement("p");
      paragraph.textContent = `Linked project asset: ${assetWorkObject.title || "Project object"} (${assetWorkObject.primaryFile || assetType})`;
      bindEditable(paragraph, { multiline: true });
      node = paragraph;
      activeEditable = paragraph;
    }

    shell.appendChild(node);
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    activeEditable?.focus?.();
    commitDocumentShell();
    updateDocsToolbarStatus(`${assetWorkObject.title || "Asset"} inserted`);
  };

  const updateDocsToolbarStatus = (label = "Click in the page, then use the tools above.") => {
    if (docsToolbarStatus) {
      docsToolbarStatus.textContent = label;
    }
  };

  const bindEditable = (element, options = {}) => {
    if (isDocsClone) {
      return;
    }
    wireInlineEditable(element, {
      ...options,
      onFocus: () => {
        activeEditable = element;
        updateDocsToolbarStatus(`Editing ${element.tagName.toLowerCase()} block`);
      },
      onCommit: () => {
        commitDocumentShell();
        updateDocsToolbarStatus("Saved automatically");
      }
    });
  };

  const replaceEditableNode = (currentNode, nextNode) => {
    if (!currentNode || !nextNode || !currentNode.parentElement) {
      return;
    }
    currentNode.parentElement.replaceChild(nextNode, currentNode);
    activeEditable = nextNode;
    bindEditable(nextNode, { multiline: nextNode.tagName.toLowerCase() === "p" });
    nextNode.focus();
    commitDocumentShell();
  };

  const convertActiveBlockTag = (nextTag) => {
    const currentTarget = getActiveBlockTarget();
    if (!currentTarget) {
      updateDocsToolbarStatus("Click a paragraph or heading first.");
      return;
    }
    const currentTag = currentTarget.tagName?.toLowerCase?.() || "";
    if (!["p", "h1", "h2", "h3", "h4"].includes(currentTag)) {
      updateDocsToolbarStatus("This formatting works on headings and paragraphs.");
      return;
    }
    if (currentTag === nextTag) {
      return;
    }
    const nextNode = document.createElement(nextTag);
    nextNode.textContent = currentTarget.textContent || "";
    replaceEditableNode(currentTarget, nextNode);
  };

  const convertActiveBlockToList = (ordered = false) => {
    const currentTarget = getActiveBlockTarget();
    if (!currentTarget) {
      updateDocsToolbarStatus("Click a paragraph or list item first.");
      return;
    }
    const currentTag = currentTarget.tagName?.toLowerCase?.() || "";
    if (currentTag === "li") {
      const parent = currentTarget.parentElement;
      if (!parent) {
        return;
      }
      const nextListTag = ordered ? "ol" : "ul";
      if (parent.tagName.toLowerCase() === nextListTag) {
        return;
      }
      const nextList = document.createElement(nextListTag);
      Array.from(parent.children).forEach((child) => nextList.appendChild(child));
      parent.parentElement?.replaceChild(nextList, parent);
      Array.from(nextList.querySelectorAll(":scope > li")).forEach((li) => bindEditable(li));
      currentTarget.focus?.();
      commitDocumentShell();
      return;
    }
    if (!["p", "h1", "h2", "h3", "h4"].includes(currentTag)) {
      updateDocsToolbarStatus("This list tool works on headings, paragraphs and list items.");
      return;
    }
    const list = document.createElement(ordered ? "ol" : "ul");
    const item = document.createElement("li");
    item.textContent = currentTarget.textContent || "";
    list.appendChild(item);
    currentTarget.parentElement?.replaceChild(list, currentTarget);
    activeEditable = item;
    bindEditable(item);
    item.focus();
    commitDocumentShell();
  };

  const runInlineCommand = (command) => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click in the page first.");
      return;
    }
    target.focus();
    document.execCommand(command, false);
    commitDocumentShell();
    updateDocsToolbarStatus("Saved automatically");
  };

  const insertChecklist = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const list = document.createElement("ul");
    list.dataset.listStyle = "checklist";
    list.className = "workspace-checklist";
    ["First task", "Second task"].forEach((label) => {
      const item = document.createElement("li");
      item.dataset.checked = "false";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "workspace-checklist-box";
      checkbox.addEventListener("change", () => {
        item.dataset.checked = checkbox.checked ? "true" : "false";
        commitDocumentShell();
      });
      const text = document.createElement("span");
      text.textContent = label;
      bindEditable(text, { multiline: true });
      item.append(checkbox, text);
      list.appendChild(item);
    });
    shell.appendChild(list);
    const firstText = list.querySelector("span");
    if (firstText) {
      activeEditable = firstText;
      firstText.focus();
    }
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Checklist added");
  };

  const insertQuote = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const quote = document.createElement("blockquote");
    quote.textContent = "Add the key quote, insight or principle here.";
    bindEditable(quote, { multiline: true });
    shell.appendChild(quote);
    activeEditable = quote;
    quote.focus();
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Quote block added");
  };

  const insertDivider = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    shell.appendChild(document.createElement("hr"));
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Divider added");
  };

  const insertTable = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const table = document.createElement("table");
    table.className = "workspace-docs-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Column A", "Column B", "Column C"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      bindEditable(th);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    const tbody = document.createElement("tbody");
    for (let rowIndex = 0; rowIndex < 2; rowIndex += 1) {
      const row = document.createElement("tr");
      ["Value 1", "Value 2", "Value 3"].forEach((label) => {
        const td = document.createElement("td");
        td.textContent = label;
        bindEditable(td);
        row.appendChild(td);
      });
      tbody.appendChild(row);
    }
    table.append(thead, tbody);
    shell.appendChild(table);
    const firstCell = table.querySelector("td");
    if (firstCell) {
      activeEditable = firstCell;
      firstCell.focus();
    }
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Table inserted");
  };

  const insertImagePlaceholder = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const figure = document.createElement("figure");
    figure.className = "workspace-docs-figure";
    const image = document.createElement("img");
    image.src = "https://placehold.co/1200x720?text=Visual";
    image.alt = "Visual";
    image.className = "workspace-inline-image";
    const caption = document.createElement("figcaption");
    caption.textContent = "Add the image caption here.";
    bindEditable(caption, { multiline: true });
    figure.append(image, caption);
    shell.appendChild(figure);
    activeEditable = caption;
    caption.focus();
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Image placeholder inserted");
  };

  const insertImageFromUrl = () => {
    if (!shell) {
      return;
    }
    const url = window.prompt("Image URL");
    if (!url) {
      return;
    }
    unwrapDocsPageShell();
    const figure = document.createElement("figure");
    figure.className = "workspace-docs-figure";
    const image = document.createElement("img");
    image.src = url;
    image.alt = "Inserted image";
    image.className = "workspace-inline-image";
    const caption = document.createElement("figcaption");
    caption.textContent = "Image caption";
    bindEditable(caption, { multiline: true });
    figure.append(image, caption);
    shell.appendChild(figure);
    activeEditable = caption;
    caption.focus();
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Image inserted");
  };

  const insertPageBreak = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const breakNode = document.createElement("div");
    breakNode.className = "workspace-docs-page-break";
    breakNode.textContent = "Page break";
    const heading = document.createElement("h1");
    heading.textContent = "New page";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Start writing on the next page here.";
    bindEditable(heading);
    bindEditable(paragraph, { multiline: true });
    shell.append(breakNode, heading, paragraph);
    activeEditable = paragraph;
    paragraph.focus();
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("New page added");
  };

  const insertNewSection = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const heading = document.createElement("h2");
    heading.textContent = "New section";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Write the next section here.";
    bindEditable(heading);
    bindEditable(paragraph, { multiline: true });
    shell.append(heading, paragraph);
    activeEditable = paragraph;
    paragraph.focus();
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("New section added");
  };

  if (isDocsClone) {
    const docsMenuBar = document.createElement("div");
    docsMenuBar.className = "workspace-docs-menubar";
    docsMenuPanel = document.createElement("div");
    docsMenuPanel.className = "workspace-docs-menu-panel hidden";

    const renderDocsMenu = (menuId = "") => {
      if (!docsMenuPanel) {
        return;
      }
      docsMenuPanel.innerHTML = "";
      docsMenuButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.menu === menuId));
      if (!menuId) {
        docsMenuPanel.classList.add("hidden");
        return;
      }
      docsMenuPanel.classList.remove("hidden");

      const addMenuAction = (label, onClick, accent = false) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `workspace-docs-menu-action${accent ? " accent" : ""}`;
        button.textContent = label;
        button.addEventListener("click", () => {
          onClick?.();
          renderDocsMenu("");
        });
        docsMenuPanel.appendChild(button);
      };

      const addMenuLabel = (label) => {
        const span = document.createElement("span");
        span.className = "workspace-docs-menu-label";
        span.textContent = label;
        docsMenuPanel.appendChild(span);
      };

      if (menuId === "File") {
        addMenuAction("New page", insertPageBreak);
        addMenuAction("New section", insertNewSection);
        addMenuAction("New document in project", createNewProjectDoc, true);
        if (projectDocs.length) {
          addMenuLabel("Other docs in this project");
          projectDocs.slice(0, 6).forEach((item) => addMenuAction(item.title || "Document", () => onProjectObjectSelect?.(item)));
        }
        if (projectLinkedObjects.length) {
          addMenuLabel("Project objects");
          projectLinkedObjects.slice(0, 8).forEach((item) => addMenuAction(item.title || "Project object", () => onProjectObjectSelect?.(item)));
        }
        return;
      }

      if (menuId === "Edit") {
        addMenuAction("Undo", () => runInlineCommand("undo"));
        addMenuAction("Redo", () => runInlineCommand("redo"));
        return;
      }

      if (menuId === "View") {
        addMenuAction("Scroll to outline", () => outline.scrollIntoView({ behavior: "smooth", block: "start" }));
        addMenuAction("Scroll to page", () => shell?.scrollIntoView({ behavior: "smooth", block: "start" }));
        return;
      }

      if (menuId === "Insert") {
        addMenuAction("Checklist", insertChecklist);
        addMenuAction("Quote", insertQuote);
        addMenuAction("Divider", insertDivider);
        addMenuAction("Table", insertTable);
        addMenuAction("Image placeholder", insertImagePlaceholder);
        addMenuAction("Page", insertPageBreak);
        if (projectAssets.length) {
          addMenuLabel("Project assets");
          projectAssets.slice(0, 6).forEach((item) => addMenuAction(`Insert ${item.title || item.objectKind || "asset"}`, () => insertProjectAsset(item)));
        }
        return;
      }

      if (menuId === "Format") {
        addMenuAction("Text", () => convertActiveBlockTag("p"));
        addMenuAction("Title", () => convertActiveBlockTag("h1"));
        addMenuAction("Heading", () => convertActiveBlockTag("h2"));
        addMenuAction("Subhead", () => convertActiveBlockTag("h3"));
        addMenuAction("Left align", () => applyBlockAlignment("left"));
        addMenuAction("Center align", () => applyBlockAlignment("center"));
        return;
      }

      if (menuId === "Tools") {
        addMenuAction("Ask Hydria to improve this page", focusPromptForDocs, true);
        addMenuAction("Insert project image", () => {
          const imageAsset = projectAssets.find((item) => (item.objectKind || item.kind) === "image");
          if (imageAsset) {
            insertProjectAsset(imageAsset);
          }
        });
        return;
      }

      if (menuId === "Extensions") {
        if (projectAssets.length) {
          addMenuLabel("Connected project objects");
          projectAssets.slice(0, 8).forEach((item) => addMenuAction(item.title || "Project asset", () => insertProjectAsset(item)));
        } else {
          addMenuLabel("No reusable project assets yet");
        }
        if (projectLinkedObjects.length) {
          addMenuLabel("Open any project object");
          projectLinkedObjects.slice(0, 8).forEach((item) => addMenuAction(item.title || "Project object", () => onProjectObjectSelect?.(item)));
        }
        return;
      }

      if (menuId === "Help") {
        addMenuLabel("Click in the page, then use the toolbar or menus.");
        addMenuLabel("Use Page to create another A4 sheet.");
        addMenuLabel("Use Extensions to reuse assets from the project.");
      }
    };

    ["File", "Edit", "View", "Insert", "Format", "Tools", "Extensions", "Help"].forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-docs-menu-item";
      button.textContent = label;
      button.dataset.menu = label;
      button.addEventListener("click", () => {
        renderDocsMenu(docsMenuPanel?.dataset.openMenu === label ? "" : label);
        if (docsMenuPanel) {
          docsMenuPanel.dataset.openMenu = docsMenuPanel.dataset.openMenu === label ? "" : label;
        }
      });
      docsMenuButtons.push(button);
      docsMenuBar.appendChild(button);
    });
    const docsMenuStatus = document.createElement("span");
    docsMenuStatus.className = "workspace-docs-menubar-status";
    docsMenuStatus.textContent = "Saved to Hydria";
    docsMenuBar.appendChild(docsMenuStatus);
    previewShell.appendChild(docsMenuBar);
    previewShell.appendChild(docsMenuPanel);

    docsToolbar = document.createElement("div");
    docsToolbar.className = "workspace-docs-toolbar";

    const makeButton = (label, onClick, modifierClass = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `workspace-docs-tool${modifierClass ? ` ${modifierClass}` : ""}`;
      button.textContent = label;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", onClick);
      return button;
    };

    const styleGroup = document.createElement("div");
    styleGroup.className = "workspace-docs-tool-group";
    styleGroup.append(
      makeButton("Text", () => convertActiveBlockTag("p")),
      makeButton("Title", () => convertActiveBlockTag("h1")),
      makeButton("Heading", () => convertActiveBlockTag("h2")),
      makeButton("Subhead", () => convertActiveBlockTag("h3")),
      makeButton("Bullets", () => convertActiveBlockToList(false)),
      makeButton("Numbered", () => convertActiveBlockToList(true))
    );

    const inlineGroup = document.createElement("div");
    inlineGroup.className = "workspace-docs-tool-group";
    inlineGroup.append(
      makeButton("Bold", () => runInlineCommand("bold")),
      makeButton("Italic", () => runInlineCommand("italic")),
      makeButton("Underline", () => runInlineCommand("underline")),
      makeButton("Left", () => applyBlockAlignment("left")),
      makeButton("Center", () => applyBlockAlignment("center")),
      makeButton("Undo", () => runInlineCommand("undo")),
      makeButton("Redo", () => runInlineCommand("redo"))
    );

    const actionGroup = document.createElement("div");
    actionGroup.className = "workspace-docs-tool-group";
    actionGroup.append(
      makeButton("Checklist", insertChecklist),
      makeButton("Quote", insertQuote),
      makeButton("Divider", insertDivider),
      makeButton("Table", insertTable),
      makeButton("Image", insertImagePlaceholder),
      makeButton("Image URL", insertImageFromUrl),
      makeButton("Page", insertPageBreak),
      makeButton("New section", insertNewSection),
      makeButton("Ask Hydria", focusPromptForDocs, "workspace-docs-tool-accent")
    );

    const typographyGroup = document.createElement("div");
    typographyGroup.className = "workspace-docs-tool-group";

    const fontSelect = document.createElement("select");
    fontSelect.className = "workspace-docs-select";
    [
      { label: "Default font", value: "" },
      { label: "Arial", value: "Arial, sans-serif" },
      { label: "Georgia", value: "Georgia, serif" },
      { label: "IBM Plex Sans", value: "\"IBM Plex Sans\", sans-serif" },
      { label: "Times New Roman", value: "\"Times New Roman\", serif" }
    ].forEach((optionConfig) => {
      const option = document.createElement("option");
      option.value = optionConfig.value;
      option.textContent = optionConfig.label;
      fontSelect.appendChild(option);
    });
    fontSelect.addEventListener("change", (event) => applyBlockFontFamily(event.target.value));

    const sizeSelect = document.createElement("select");
    sizeSelect.className = "workspace-docs-select";
    [
      { label: "Auto size", value: "" },
      { label: "12", value: "12px" },
      { label: "14", value: "14px" },
      { label: "16", value: "16px" },
      { label: "18", value: "18px" },
      { label: "24", value: "24px" },
      { label: "32", value: "32px" }
    ].forEach((optionConfig) => {
      const option = document.createElement("option");
      option.value = optionConfig.value;
      option.textContent = optionConfig.label;
      sizeSelect.appendChild(option);
    });
    sizeSelect.addEventListener("change", (event) => applyBlockFontSize(event.target.value));

    typographyGroup.append(fontSelect, sizeSelect);

    docsToolbarStatus = document.createElement("span");
    docsToolbarStatus.className = "workspace-docs-toolbar-status";
    docsToolbarStatus.textContent = "Click in the page, then use the tools above.";

    docsToolbar.append(styleGroup, inlineGroup, typographyGroup, actionGroup, docsToolbarStatus);
    previewShell.appendChild(docsToolbar);

    const quickActions = document.createElement("div");
    quickActions.className = "workspace-docs-quick-actions";
    const quickLabel = document.createElement("span");
    quickLabel.className = "tiny";
    quickLabel.textContent = "Quick actions";
    const quickGroup = document.createElement("div");
    quickGroup.className = "workspace-docs-tool-group";
    quickGroup.append(
      makeButton("Add page", insertPageBreak),
      makeButton("New doc", createNewProjectDoc, "workspace-docs-tool-accent"),
      makeButton("Insert image", insertImageFromUrl)
    );
    quickActions.append(quickLabel, quickGroup);
    previewShell.appendChild(quickActions);

    const ruler = document.createElement("div");
    ruler.className = "workspace-docs-ruler";
    for (let index = 0; index < 12; index += 1) {
      const tick = document.createElement("span");
      tick.className = "workspace-docs-ruler-tick";
      tick.textContent = `${(index + 1) * 10}`;
      ruler.appendChild(tick);
    }
    previewShell.appendChild(ruler);
  }

  if (!isDocsClone) {
    const previewContext = document.createElement("div");
    previewContext.className = "workspace-document-context-grid";
    [
      {
        label: profile.contextLabelA,
        value: headings.length > 3 ? profile.contextValueA : "Short page"
      },
      {
        label: profile.contextLabelB,
        value:
          blocks.find((block) => !/^#{1,3}\s+/.test(block))?.replace(/^[-*]\s+|^\d+\.\s+/, "") ||
          "Use the editor to sharpen the first insight."
      }
    ].forEach((item) => {
      const card = document.createElement("article");
      card.className = "workspace-document-context-card";
      const label = document.createElement("span");
      label.className = "tiny";
      label.textContent = item.label;
      const text = document.createElement("p");
      text.textContent = item.value;
      card.append(label, text);
      previewContext.appendChild(card);
    });
    previewShell.appendChild(previewContext);

    const previewRibbon = document.createElement("div");
    previewRibbon.className = "workspace-flow-chip-list";
    [
      profile.ribbon[0],
      `${headings.length || 1} sections`,
      listCount ? profile.ribbon[2] : profile.ribbon[1],
      profile.ribbon[3]
    ].forEach((label, index) => {
      const chip = document.createElement("span");
      chip.className = `workspace-flow-chip${index === 0 ? " active" : ""}`;
      chip.textContent = label;
      previewRibbon.appendChild(chip);
    });
    previewShell.appendChild(previewRibbon);
  }

  const previewLayout = document.createElement("div");
  previewLayout.className = `workspace-document-preview-layout${isDocsClone ? " workspace-document-preview-layout-docs" : ""}`;
  const outline = document.createElement("aside");
  outline.className = `workspace-document-preview-outline${isDocsClone ? " workspace-document-preview-outline-docs" : ""}`;
  const outlineHeader = document.createElement("span");
  outlineHeader.className = "tiny";
  outlineHeader.textContent = isDocsClone ? "Document outline" : "Outline";
  outline.appendChild(outlineHeader);
  const outlineItems = (sections || []).filter((section) => section.id !== "whole-file");
  const fallbackOutlineItems = usesRichDocument
    ? extractRichDocumentHeadings(normalized)
    : (headings.length ? headings : ["# Document"]).slice(0, 8).map((heading, index) => ({
        id: `heading-${index + 1}`,
        label: heading.replace(/^#{1,3}\s+/, "")
      }));
  (outlineItems.length
    ? outlineItems.map((section, index) => ({
        id: section.id,
        label: section.title || `Section ${index + 1}`
      }))
    : fallbackOutlineItems).forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-mini-list-item${
      (selectedSectionId && selectedSectionId === entry.id) || (!selectedSectionId && index === 0) ? " active" : ""
    }`;
    button.textContent = entry.label;
    button.disabled = !outlineItems.length && !usesRichDocument && (!onSectionFocus || !outlineItems.length);
    if (usesRichDocument) {
      button.addEventListener("click", () => {
        const target = shell?.querySelector?.(`#${entry.id}`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          target.focus?.();
        }
      });
    } else if (onSectionFocus && outlineItems.length) {
      button.addEventListener("click", () => onSectionFocus(entry.id));
    }
    outline.appendChild(button);
  });

  if (isDocsClone && projectDocs.length) {
    const docsLabel = document.createElement("span");
    docsLabel.className = "tiny workspace-docs-side-label";
    docsLabel.textContent = "Project docs";
    outline.appendChild(docsLabel);
    projectDocs.slice(0, 6).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-mini-list-item";
      button.textContent = item.title || "Document";
      button.addEventListener("click", () => onProjectObjectSelect?.(item));
      outline.appendChild(button);
    });
  }

  if (isDocsClone && projectLinkedObjects.length) {
    const linkedLabel = document.createElement("span");
    linkedLabel.className = "tiny workspace-docs-side-label";
    linkedLabel.textContent = "Project objects";
    outline.appendChild(linkedLabel);
    projectLinkedObjects.slice(0, 8).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-mini-list-item";
      button.textContent = item.title || item.objectKind || "Object";
      button.addEventListener("click", () => onProjectObjectSelect?.(item));
      outline.appendChild(button);
    });
  }

  if (isDocsClone && projectAssets.length) {
    const assetsLabel = document.createElement("span");
    assetsLabel.className = "tiny workspace-docs-side-label";
    assetsLabel.textContent = "Project assets";
    outline.appendChild(assetsLabel);
    projectAssets.slice(0, 6).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-mini-list-item";
      button.textContent = item.title || item.objectKind || "Asset";
      button.addEventListener("click", () => insertProjectAsset(item));
      outline.appendChild(button);
    });
  }

  shell = document.createElement("article");
  shell.className = `workspace-document-shell workspace-document-preview-body${isDocsClone ? " workspace-document-preview-body-docs" : ""}`;
  if (isDocsClone) {
    shell.dataset.richDocument = "true";
  }

  if (usesRichDocument) {
    const template = document.createElement("template");
    template.innerHTML = normalized;
    shell.appendChild(template.content.cloneNode(true));
    let headingIndex = 0;
    shell.querySelectorAll("h1, h2, h3, h4").forEach((node) => {
      if (!node.id) {
        node.id = `heading-${headingIndex + 1}`;
      }
      headingIndex += 1;
      bindEditable(node, { multiline: true });
    });
    shell.querySelectorAll("p, blockquote, figcaption, th, td").forEach((node) => {
      bindEditable(node, { multiline: true });
    });
    shell.querySelectorAll("li").forEach((node) => {
      const editableTarget = node.querySelector("span") || node;
      bindEditable(editableTarget, { multiline: true });
    });
    shell.querySelectorAll(".workspace-checklist-box").forEach((checkbox) => {
      const item = checkbox.closest("li");
      if (item) {
        const shouldBeChecked = checkbox.hasAttribute("checked") || item.dataset.checked === "true";
        checkbox.checked = shouldBeChecked;
        item.dataset.checked = shouldBeChecked ? "true" : "false";
      }
      checkbox.addEventListener("change", () => {
        const currentItem = checkbox.closest("li");
        if (currentItem) {
          currentItem.dataset.checked = checkbox.checked ? "true" : "false";
        }
        commitDocumentShell();
      });
    });
  } else {
    for (const block of blocks) {
      if (/^#{1,4}\s+/.test(block)) {
        const heading = document.createElement(
          block.startsWith("####") ? "h4" : block.startsWith("###") ? "h3" : block.startsWith("##") ? "h2" : "h1"
        );
        appendInlineContent(heading, block.replace(/^#{1,4}\s+/, ""));
        bindEditable(heading);
        shell.appendChild(heading);
        continue;
      }

      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length && lines.every((line) => /^>\s*/.test(line))) {
        const quote = document.createElement("blockquote");
        quote.textContent = lines.map((line) => line.replace(/^>\s*/, "")).join("\n");
        bindEditable(quote, { multiline: true });
        shell.appendChild(quote);
        continue;
      }

      if (lines.length === 1 && /^(---|\*\*\*)$/.test(lines[0])) {
        shell.appendChild(document.createElement("hr"));
        continue;
      }

      if (lines.length >= 2 && lines[0].startsWith("|") && lines[1].startsWith("|")) {
        const rows = lines
          .filter((line, index) => !(index === 1 && /^\|\s*[-:| ]+\|\s*$/.test(line)))
          .map((line) =>
            line
              .split("|")
              .map((cell) => cell.trim())
              .filter(Boolean)
          );
        if (rows.length) {
          const table = document.createElement("table");
          table.className = "workspace-docs-table";
          const thead = document.createElement("thead");
          const headerRow = document.createElement("tr");
          rows[0].forEach((cell) => {
            const th = document.createElement("th");
            th.textContent = cell;
            bindEditable(th);
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          const tbody = document.createElement("tbody");
          rows.slice(1).forEach((cells) => {
            const row = document.createElement("tr");
            cells.forEach((cell) => {
              const td = document.createElement("td");
              td.textContent = cell;
              bindEditable(td);
              row.appendChild(td);
            });
            tbody.appendChild(row);
          });
          table.append(thead, tbody);
          shell.appendChild(table);
          continue;
        }
      }

      if (lines.length && lines.every((line) => /^-\s+\[[ xX]\]\s+/.test(line))) {
        const list = document.createElement("ul");
        list.dataset.listStyle = "checklist";
        list.className = "workspace-checklist";
        for (const line of lines) {
          const item = document.createElement("li");
          item.dataset.checked = /\[[xX]\]/.test(line) ? "true" : "false";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "workspace-checklist-box";
          checkbox.checked = item.dataset.checked === "true";
          checkbox.addEventListener("change", () => {
            item.dataset.checked = checkbox.checked ? "true" : "false";
            commitDocumentShell();
          });
          const text = document.createElement("span");
          appendInlineContent(text, line.replace(/^-\s+\[[ xX]\]\s+/, ""));
          bindEditable(text, { multiline: true });
          item.append(checkbox, text);
          list.appendChild(item);
        }
        shell.appendChild(list);
        continue;
      }

      if (lines.length && lines.every((line) => /^[-*]\s+/.test(line))) {
        const list = document.createElement("ul");
        for (const line of lines) {
          const item = document.createElement("li");
          appendInlineContent(item, line.replace(/^[-*]\s+/, ""));
          bindEditable(item);
          list.appendChild(item);
        }
        shell.appendChild(list);
        continue;
      }

      if (lines.length && lines.every((line) => /^\d+\.\s+/.test(line))) {
        const list = document.createElement("ol");
        for (const line of lines) {
          const item = document.createElement("li");
          appendInlineContent(item, line.replace(/^\d+\.\s+/, ""));
          bindEditable(item);
          list.appendChild(item);
        }
        shell.appendChild(list);
        continue;
      }

      const paragraph = document.createElement("p");
      appendInlineContent(paragraph, block);
      bindEditable(paragraph, { multiline: true });
      shell.appendChild(paragraph);
    }
  }

  if (isDocsClone) {
    if (!shell.childNodes.length) {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = "<br>";
      shell.appendChild(paragraph);
    }
    rebuildDocsPageShell();
    const canvas = document.createElement("div");
    canvas.className = "workspace-document-page-canvas";
    canvas.appendChild(shell);
    previewLayout.append(outline, canvas);
    shell.contentEditable = "true";
    shell.spellcheck = true;
    shell.classList.add("workspace-inline-editable");
    shell.dataset.placeholder = "Start typing here";
    shell.addEventListener("input", () => {
      if (docsCommitHandle) {
        window.clearTimeout(docsCommitHandle);
      }
      docsCommitHandle = window.setTimeout(() => {
        commitDocumentShell();
        updateDocsToolbarStatus("Saved automatically");
      }, 120);
    });
    shell.addEventListener("click", () => {
      updateDocsToolbarStatus("Editing page");
    });
  } else {
    previewLayout.append(outline, shell);
  }
  previewShell.appendChild(previewLayout);
  container.appendChild(previewShell);
}

function wireInlineEditable(element, { multiline = false, onCommit = null, onFocus = null } = {}) {
  if (!element || typeof onCommit !== "function") {
    return;
  }

  element.contentEditable = "true";
  element.spellcheck = true;
  element.classList.add("workspace-inline-editable");
  element.dataset.placeholder = multiline ? "Edit directly here" : "Edit";

  const commit = () => {
    onCommit();
  };

  element.addEventListener("focus", () => {
    if (typeof onFocus === "function") {
      onFocus();
    }
  });
  element.addEventListener("blur", commit);
  element.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      element.blur();
      return;
    }
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      element.blur();
    }
  });
}

function serializeDocumentPreviewShell(shell) {
  if (shell?.dataset?.richDocument === "true") {
    const clone = shell.cloneNode(true);
    clone.querySelectorAll(".workspace-document-page-sheet").forEach((page) => {
      page.replaceWith(...Array.from(page.childNodes));
    });
    clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
    clone.querySelectorAll("[spellcheck]").forEach((node) => node.removeAttribute("spellcheck"));
    clone.querySelectorAll("[data-placeholder]").forEach((node) => node.removeAttribute("data-placeholder"));
    clone.querySelectorAll(".workspace-inline-editable").forEach((node) => {
      node.classList.remove("workspace-inline-editable");
    });
    clone.querySelectorAll(".workspace-checklist-box").forEach((checkbox) => {
      const checked = checkbox.checked || checkbox.closest("li")?.dataset?.checked === "true";
      if (checked) {
        checkbox.setAttribute("checked", "checked");
      } else {
        checkbox.removeAttribute("checked");
      }
    });
    return String(clone.innerHTML || "").trim();
  }
  return Array.from(shell.children)
    .map((node) => {
      const tagName = node.tagName?.toLowerCase?.() || "";
      if (!tagName) {
        return "";
      }

      if (/^h[1-4]$/.test(tagName)) {
        const level = Number(tagName.slice(1));
        return `${"#".repeat(level)} ${String(node.textContent || "").trim()}`;
      }

      if (tagName === "p") {
        return String(node.textContent || "").trim();
      }

      if (tagName === "blockquote") {
        return String(node.textContent || "")
          .split("\n")
          .map((line) => `> ${line.trim()}`)
          .join("\n");
      }

      if (tagName === "hr") {
        return "---";
      }

      if (tagName === "ul") {
        if (node.dataset.listStyle === "checklist") {
          return Array.from(node.querySelectorAll(":scope > li"))
            .map((item) => {
              const checked = item.dataset.checked === "true" ? "x" : " ";
              return `- [${checked}] ${String(item.textContent || "").trim()}`;
            })
            .join("\n");
        }
        return Array.from(node.querySelectorAll(":scope > li"))
          .map((item) => `- ${String(item.textContent || "").trim()}`)
          .join("\n");
      }

      if (tagName === "ol") {
        return Array.from(node.querySelectorAll(":scope > li"))
          .map((item, index) => `${index + 1}. ${String(item.textContent || "").trim()}`)
          .join("\n");
      }

      if (tagName === "table") {
        const rows = Array.from(node.querySelectorAll("tr")).map((row) =>
          Array.from(row.children).map((cell) => String(cell.textContent || "").trim())
        );
        if (!rows.length) {
          return "";
        }
        const [headerRow, ...bodyRows] = rows;
        const divider = headerRow.map(() => "---");
        return [
          `| ${headerRow.join(" | ")} |`,
          `| ${divider.join(" | ")} |`,
          ...bodyRows.map((row) => `| ${row.join(" | ")} |`)
        ].join("\n");
      }

      return String(node.textContent || "").trim();
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function renderCodePreview(container, content = "", filePath = "") {
  const normalized = normalizeText(content);
  const lines = normalized.split("\n");
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const symbolItems = blocks.slice(0, 8).map((block, index) => {
    const firstLine = block.split("\n")[0] || "";
    const titleMatch = firstLine.match(/(?:function|class|const|let|var|export\s+function|export\s+const)\s+([A-Za-z0-9_$-]+)/);
    return {
      title: titleMatch?.[1] || firstLine.replace(/[{}]/g, "").trim() || `Block ${index + 1}`,
      meta: `${block.split("\n").length} lines`
    };
  });
  const diagnostics = {
    imports: lines.filter((line) => /^\s*(import|const .*require\()/.test(line)).length,
    functions: lines.filter((line) => /\b(function\s+\w+|\w+\s*=>|async\s+function|\w+\([^)]*\)\s*\{)/.test(line)).length,
    todos: lines.filter((line) => /todo|fixme/i.test(line)).length,
    tests: lines.filter((line) => /\b(describe|it|test|expect)\b/.test(line)).length
  };
  const insightGrid = createPreviewInsightGrid([
    { label: "Language", value: inferPreviewLanguage(filePath), meta: friendlyPathLabel(filePath) || "Source file" },
    { label: "Lines", value: lines.length, meta: `${lines.filter((line) => line.trim()).length} non-empty lines` },
    { label: "Blocks", value: blocks.length || 1, meta: "Hydria can focus edits block by block" }
  ]);
  if (insightGrid) {
    container.appendChild(insightGrid);
  }

  const shell = document.createElement("div");
  shell.className = "workspace-code-shell";
  const toolbar = document.createElement("div");
  toolbar.className = "workspace-code-toolbar";
  const toolbarMeta = document.createElement("div");
  toolbarMeta.className = "workspace-code-toolbar-meta";
  const fileLabel = document.createElement("strong");
  fileLabel.textContent = friendlyPathLabel(filePath) || "Source file";
  const fileHint = document.createElement("span");
  fileHint.className = "tiny";
  fileHint.textContent = `${inferPreviewLanguage(filePath)} · ${lines.length} lines`;
  toolbarMeta.append(fileLabel, fileHint);
  const toolbarTabs = document.createElement("div");
  toolbarTabs.className = "workspace-code-tabs";
  ["Explorer", "Source", "Checks"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-code-tab${index === 1 ? " is-active" : ""}`;
    tab.textContent = label;
    toolbarTabs.appendChild(tab);
  });
  toolbar.append(toolbarMeta, toolbarTabs);

  const chrome = document.createElement("div");
  chrome.className = "workspace-code-chrome";
  const activityBar = document.createElement("div");
  activityBar.className = "workspace-code-activity-bar";
  ["Files", "Search", "Run", "Git"].forEach((label, index) => {
    const item = document.createElement("span");
    item.className = `workspace-code-activity-item${index === 0 ? " is-active" : ""}`;
    item.textContent = label;
    activityBar.appendChild(item);
  });
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-code-sidebar";

  const symbolHeader = document.createElement("div");
  symbolHeader.className = "workspace-code-sidebar-header";
  symbolHeader.textContent = "Symbols";
  sidebar.appendChild(symbolHeader);

  const symbolList = document.createElement("div");
  symbolList.className = "workspace-code-symbol-list";
  if (symbolItems.length) {
    symbolItems.forEach((item) => {
      const symbol = document.createElement("div");
      symbol.className = "workspace-code-symbol";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const meta = document.createElement("span");
      meta.className = "tiny";
      meta.textContent = item.meta;
      symbol.append(title, meta);
      symbolList.appendChild(symbol);
    });
  } else {
    const empty = document.createElement("p");
    empty.className = "tiny muted";
    empty.textContent = "Hydria will expose functions and blocks here as the file grows.";
    symbolList.appendChild(empty);
  }
  sidebar.appendChild(symbolList);

  const checks = document.createElement("div");
  checks.className = "workspace-code-checks";
  [
    { label: "Imports", value: diagnostics.imports },
    { label: "Functions", value: diagnostics.functions },
    { label: "TODOs", value: diagnostics.todos },
    { label: "Tests", value: diagnostics.tests }
  ].forEach((item) => {
    const card = document.createElement("div");
    card.className = "workspace-code-check";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = String(item.value);
    card.append(label, value);
    checks.appendChild(card);
  });

  const wrapper = document.createElement("div");
  wrapper.className = "workspace-code-lines";

  lines.forEach((line, index) => {
    const row = document.createElement("div");
    row.className = "workspace-code-line";

    const gutter = document.createElement("span");
    gutter.className = "workspace-code-gutter";
    gutter.textContent = String(index + 1);

    const code = document.createElement("code");
    code.className = "workspace-code-content";
    code.textContent = line || " ";

    row.append(gutter, code);
    wrapper.appendChild(row);
  });

  const main = document.createElement("div");
  main.className = "workspace-code-main";
  main.append(checks, wrapper);

  chrome.append(activityBar, sidebar, main);
  const statusBar = document.createElement("div");
  statusBar.className = "workspace-code-statusbar";
  const statusMeta = document.createElement("span");
  statusMeta.textContent = `${inferPreviewLanguage(filePath)} | ${symbolItems.length || 1} symbols`;
  const statusHint = document.createElement("span");
  statusHint.textContent = diagnostics.todos ? `${diagnostics.todos} TODOs open` : "Ready to iterate with Hydria";
  statusBar.append(statusMeta, statusHint);
  shell.append(toolbar, chrome, statusBar);
  container.appendChild(shell);
}

function renderProjectOverview(container, { project = null, workObject = null, blocks = [] } = {}) {
  const grid = document.createElement("div");
  grid.className = "workspace-overview-grid";

  const items = [
    { label: "Project", value: project?.name || workObject?.title || "Hydria Project" },
    { label: "Status", value: project?.status || workObject?.status || "draft" },
    {
      label: "Dimensions",
      value: (project?.dimensions || workObject?.projectDimensions || []).join(", ") || "text"
    },
    {
      label: "Objects",
      value: String(project?.workObjectCount || 1)
    },
    {
      label: "Capabilities",
      value:
        (project?.internalCapabilities || workObject?.internalCapabilities || []).join(", ") ||
        "standard"
    },
    { label: "Blocks", value: String(blocks.length || 1) }
  ];

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "workspace-overview-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = item.value;
    card.append(label, value);
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function renderOutline(container, sections = [], currentSectionId = "") {
  if (!sections.length) {
    return;
  }

  const outline = document.createElement("div");
  outline.className = "workspace-outline";

  for (const section of sections) {
    const item = document.createElement("span");
    item.className = `workspace-outline-item${currentSectionId === section.id ? " active" : ""}`;
    item.textContent = section.title;
    outline.appendChild(item);
  }

  container.appendChild(outline);
}

function previewWordCount(value = "") {
  const matches = normalizeText(value).match(/\b[\p{L}\p{N}_'-]+\b/gu);
  return matches ? matches.length : 0;
}

function inferPreviewLanguage(filePath = "") {
  const normalized = String(filePath || "").toLowerCase();
  if (/(^|\/)package\.json$/.test(normalized)) {
    return "Package manifest";
  }
  if (/\.tsx?$/.test(normalized)) {
    return "TypeScript";
  }
  if (/\.jsx?$/.test(normalized)) {
    return "JavaScript";
  }
  if (/\.css$/.test(normalized)) {
    return "CSS";
  }
  if (/\.html$/.test(normalized)) {
    return "HTML";
  }
  if (/\.ya?ml$/.test(normalized)) {
    return "YAML";
  }
  if (/\.json$/.test(normalized)) {
    return "JSON";
  }
  return "Code";
}

function createPreviewInsightGrid(items = []) {
  const visibleItems = items.filter((item) => item && item.value !== undefined && item.value !== null && String(item.value).trim());
  if (!visibleItems.length) {
    return null;
  }

  const grid = document.createElement("div");
  grid.className = "workspace-preview-insight-grid";

  visibleItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "workspace-preview-insight-card";

    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;

    const value = document.createElement("strong");
    value.textContent = String(item.value);

    card.append(label, value);

    if (item.meta) {
      const meta = document.createElement("p");
      meta.className = "workspace-preview-insight-meta";
      meta.textContent = item.meta;
      card.appendChild(meta);
    }

    grid.appendChild(card);
  });

  return grid;
}

function parseCsvRows(content = "") {
  const text = normalizeText(content);
  if (!text.trim()) {
    return [];
  }

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => String(value || "").trim().length));
}

function normalizeSpreadsheetPreviewModel(model = {}, { defaultSheetName = "Sheet 1" } = {}) {
  const normalizeSheet = (sheet = {}, index = 0) => {
    const columns = Array.isArray(sheet.columns) && sheet.columns.length
      ? sheet.columns.map((value) => String(value || ""))
      : ["Column 1", "Column 2", "Column 3"];
    const width = columns.length;
    const rows = (Array.isArray(sheet.rows) && sheet.rows.length ? sheet.rows : [["", "", ""]]).map((row) =>
      Array.from({ length: width }, (_, columnIndex) => String(row?.[columnIndex] || ""))
    );
    return {
      id: String(sheet.id || `sheet-${index + 1}`),
      name: String(sheet.name || `${defaultSheetName.replace(/\s+\d+$/, "") || "Sheet"} ${index + 1}`),
      columns,
      rows,
      columnWidths:
        sheet.columnWidths && typeof sheet.columnWidths === "object" && !Array.isArray(sheet.columnWidths)
          ? { ...sheet.columnWidths }
          : {},
      rowHeights:
        sheet.rowHeights && typeof sheet.rowHeights === "object" && !Array.isArray(sheet.rowHeights)
          ? { ...sheet.rowHeights }
          : {},
      merges: Array.isArray(sheet.merges)
        ? sheet.merges
            .filter(
              (merge) =>
                merge &&
                Number.isInteger(merge.startRowIndex) &&
                Number.isInteger(merge.startColumnIndex) &&
                Number.isInteger(merge.rowSpan) &&
                Number.isInteger(merge.columnSpan) &&
                merge.rowSpan > 0 &&
                merge.columnSpan > 0
            )
            .map((merge) => ({
              startRowIndex: Number(merge.startRowIndex),
              startColumnIndex: Number(merge.startColumnIndex),
              rowSpan: Number(merge.rowSpan),
              columnSpan: Number(merge.columnSpan)
            }))
        : [],
      cellFormats:
        sheet.cellFormats && typeof sheet.cellFormats === "object" && !Array.isArray(sheet.cellFormats)
          ? { ...sheet.cellFormats }
          : {},
      filterQuery: String(sheet.filterQuery || ""),
      filterColumnIndex: Number.isInteger(sheet.filterColumnIndex) ? Number(sheet.filterColumnIndex) : -1,
      sort:
        sheet.sort && Number.isInteger(sheet.sort.columnIndex)
          ? {
              columnIndex: Number(sheet.sort.columnIndex),
              direction: sheet.sort.direction === "desc" ? "desc" : "asc"
            }
          : null,
      frozenRows: Math.max(0, Number(sheet.frozenRows || 0)),
      frozenColumns: Math.max(0, Number(sheet.frozenColumns || 0))
    };
  };

  const sheets = Array.isArray(model.sheets) && model.sheets.length
    ? model.sheets.map((sheet, index) => normalizeSheet(sheet, index))
    : [normalizeSheet(model, 0)];
  const activeSheetId = sheets.some((sheet) => sheet.id === model.activeSheetId)
    ? model.activeSheetId
    : sheets[0].id;
  const activeSheet = sheets.find((sheet) => sheet.id === activeSheetId) || sheets[0];

  return {
    kind: "hydria-sheet",
    version: 1,
    ...model,
    sheets,
    activeSheetId,
    activeSheet,
    columns: activeSheet.columns,
    rows: activeSheet.rows
  };
}

function parseSpreadsheetPreviewContent(content = "", { defaultSheetName = "Sheet 1" } = {}) {
  const raw = String(content || "").trim();
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && (parsed.kind === "hydria-sheet" || Array.isArray(parsed.sheets))) {
        return normalizeSpreadsheetPreviewModel(parsed, { defaultSheetName });
      }
    } catch {
      // Fallback to CSV parsing below.
    }
  }

  const rows = parseCsvRows(content);
  if (!rows.length) {
    return normalizeSpreadsheetPreviewModel(
      {
        sheets: [
          {
            id: "sheet-1",
            name: defaultSheetName,
            columns: ["Column 1", "Column 2", "Column 3"],
            rows: [["", "", ""]]
          }
        ]
      },
      { defaultSheetName }
    );
  }

  const [header, ...bodyRows] = rows;
  const width = Math.max(header.length || 0, ...bodyRows.map((row) => row.length), 1);
  return normalizeSpreadsheetPreviewModel(
    {
      sheets: [
        {
          id: "sheet-1",
          name: defaultSheetName,
          columns: Array.from({ length: width }, (_, index) => header[index] || `Column ${index + 1}`),
          rows: (bodyRows.length ? bodyRows : [[""]]).map((row) =>
            Array.from({ length: width }, (_, index) => row[index] || "")
          )
        }
      ]
    },
    { defaultSheetName }
  );
}

function renderSpreadsheetClonePreview(
  container,
  {
    model = { columns: ["A"], rows: [[""]] },
    profile = null,
    workObject = null,
    filePath = "",
    onGridEdit = null
  } = {}
) {
  let workbookModel = normalizeSpreadsheetPreviewModel(model, {
    defaultSheetName: profile?.sheetName || "Sheet 1"
  });
  const historyKey = getSpreadsheetHistoryKey(workObject, filePath);
  const initialHistorySnapshot = cloneSpreadsheetSnapshot(workbookModel);
  const historyState = getSpreadsheetHistoryState(historyKey, initialHistorySnapshot);
  const activeSheet = workbookModel.activeSheet;
  const minVisibleColumns = Math.max(activeSheet.columns.length, 10);
  const minVisibleRows = Math.max(activeSheet.rows.length + 1, 24);
  let sheetGrid = Array.from({ length: minVisibleRows }, (_, rowIndex) =>
    Array.from({ length: minVisibleColumns }, (_, columnIndex) =>
      rowIndex === 0
        ? activeSheet.columns[columnIndex] || ""
        : activeSheet.rows[rowIndex - 1]?.[columnIndex] || ""
    )
  );
  const initialSelectionState = normalizeSpreadsheetSelectionState(
    spreadsheetSelectionStore.get(historyKey),
    sheetGrid.length,
    sheetGrid[0]?.length || 1
  );
  const columnLetter = (index) => {
    let value = index + 1;
    let label = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      value = Math.floor((value - 1) / 26);
    }
    return label;
  };

  const addressToCoords = (address = "") => {
    const match = String(address || "").trim().toUpperCase().match(/^(\$?)([A-Z]+)(\$?)(\d+)$/);
    if (!match) {
      return null;
    }
    const [, absoluteColumn, letters, absoluteRow, rowText] = match;
    let columnIndex = 0;
    for (const letter of letters) {
      columnIndex = columnIndex * 26 + (letter.charCodeAt(0) - 64);
    }
    return {
      rowIndex: Math.max(0, Number(rowText) - 1),
      columnIndex: Math.max(0, columnIndex - 1),
      absoluteRow: absoluteRow === "$",
      absoluteColumn: absoluteColumn === "$"
    };
  };

  const coordsToAddress = (
    rowIndex = 0,
    columnIndex = 0,
    { absoluteRow = false, absoluteColumn = false } = {}
  ) => `${absoluteColumn ? "$" : ""}${columnLetter(columnIndex)}${absoluteRow ? "$" : ""}${rowIndex + 1}`;

  const ensureGridSize = (rowCount = 1, columnCount = 1) => {
    const targetRows = Math.max(1, rowCount, sheetGrid.length);
    const targetColumns = Math.max(1, columnCount, sheetGrid[0]?.length || 0);

    while (sheetGrid.length < targetRows) {
      sheetGrid.push(Array.from({ length: targetColumns }, () => ""));
    }

    sheetGrid = sheetGrid.map((row) => {
      const nextRow = [...row];
      while (nextRow.length < targetColumns) {
        nextRow.push("");
      }
      return nextRow;
    });
  };

  const getRawCellValue = (rowIndex = 0, columnIndex = 0) =>
    String(sheetGrid[rowIndex]?.[columnIndex] || "");

  const setRawCellValue = (rowIndex = 0, columnIndex = 0, value = "") => {
    ensureGridSize(rowIndex + 1, columnIndex + 1);
    sheetGrid[rowIndex][columnIndex] = String(value || "");
  };

  const trimGridToModel = () => {
    const cloned = sheetGrid.map((row) => [...row]);
    let lastColumn = 0;
    let lastRow = 0;

    cloned.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        if (String(value || "").trim()) {
          lastColumn = Math.max(lastColumn, columnIndex);
          lastRow = Math.max(lastRow, rowIndex);
        }
      });
    });

    const width = Math.max(1, lastColumn + 1);
    const height = Math.max(1, lastRow + 1);
    const normalized = Array.from({ length: height }, (_, rowIndex) =>
      Array.from({ length: width }, (_, columnIndex) => cloned[rowIndex]?.[columnIndex] || "")
    );

    const [columns = [""], ...rows] = normalized;
    return {
      columns,
      rows: rows.length ? rows : [[""]]
    };
  };

  const normalizeNumeric = (value = "") => {
    const numeric = Number(String(value || "").replace(",", "."));
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  const coerceNumeric = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    const numeric = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  };

  const coerceBoolean = (value) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (["true", "yes", "oui"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "non"].includes(normalized)) {
      return false;
    }
    const numeric = Number(normalized.replace(",", "."));
    if (Number.isFinite(numeric)) {
      return numeric !== 0;
    }
    return true;
  };

  const coerceText = (value) => {
    if (Array.isArray(value)) {
      return value.map((entry) => coerceText(entry)).join(", ");
    }
    return String(value ?? "");
  };

  const serializeFormulaValue = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    return JSON.stringify(coerceText(value));
  };

  const splitFormulaArgs = (value = "") => {
    const parts = [];
    let depth = 0;
    let current = "";
    let inQuotes = false;
    const source = String(value || "");
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (char === "\"") {
        current += char;
        if (inQuotes && next === "\"") {
          current += next;
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "(") {
        depth += 1;
        current += char;
        continue;
      }
      if (char === ")") {
        depth = Math.max(0, depth - 1);
        current += char;
        continue;
      }
      if ((char === "," || char === ";") && depth === 0 && !inQuotes) {
        parts.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    if (current.trim()) {
      parts.push(current.trim());
    }
    return parts;
  };

  const getRangeBoundsFromAddress = (range = "") => {
    const [start, end] = String(range || "").split(":");
    const startCoords = addressToCoords(start);
    const endCoords = addressToCoords(end);
    if (!startCoords || !endCoords) {
      return null;
    }
    return {
      minRow: Math.min(startCoords.rowIndex, endCoords.rowIndex),
      maxRow: Math.max(startCoords.rowIndex, endCoords.rowIndex),
      minColumn: Math.min(startCoords.columnIndex, endCoords.columnIndex),
      maxColumn: Math.max(startCoords.columnIndex, endCoords.columnIndex)
    };
  };

  const collectRangeMatrix = (range = "", stack = new Set()) => {
    const bounds = getRangeBoundsFromAddress(range);
    if (!bounds) {
      return [];
    }
    return Array.from({ length: bounds.maxRow - bounds.minRow + 1 }, (_, rowOffset) =>
      Array.from({ length: bounds.maxColumn - bounds.minColumn + 1 }, (_, columnOffset) =>
        evaluateCellValue(bounds.minRow + rowOffset, bounds.minColumn + columnOffset, stack)
      )
    );
  };

  const flattenFormulaMatrix = (matrix = []) =>
    matrix.flatMap((row) => (Array.isArray(row) ? row : [row]));

  const collectRangeValues = (range = "", stack = new Set()) => flattenFormulaMatrix(collectRangeMatrix(range, stack));

  const formatFormulaResult = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      if (Number.isInteger(value)) {
        return String(value);
      }
      return value.toFixed(2).replace(/\.?0+$/, "");
    }
    return String(value ?? "");
  };

  const normalizeFormulaExpression = (value = "") =>
    String(value || "")
      .replace(/<>/g, "!=")
      .replace(/(^|[^><!=])=([^=]|$)/g, "$1==$2")
      .replace(/\bTRUE\b/gi, "true")
      .replace(/\bFALSE\b/gi, "false");

  const evaluateFormula = (expression = "", stack = new Set()) => {
    let expr = String(expression || "").trim();
    if (!expr) {
      return "";
    }

    const evaluateFormulaArgument = (arg = "") => {
      const trimmed = String(arg || "").trim();
      if (!trimmed) {
        return "";
      }
      if (/^".*"$/.test(trimmed)) {
        return trimmed.slice(1, -1).replace(/""/g, "\"").replace(/\\"/g, "\"");
      }
      if (/^\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+$/i.test(trimmed)) {
        return collectRangeValues(trimmed, stack);
      }
      if (/^\$?[A-Z]+\$?\d+$/i.test(trimmed)) {
        return evaluateCellValueByAddress(trimmed, stack);
      }
      if (/^TRUE$/i.test(trimmed)) {
        return true;
      }
      if (/^FALSE$/i.test(trimmed)) {
        return false;
      }
      const numeric = Number(trimmed.replace(",", "."));
      if (Number.isFinite(numeric)) {
        return numeric;
      }
      return evaluateFormula(trimmed.startsWith("=") ? trimmed.slice(1) : trimmed, stack);
    };

    const collectAggregateValues = (args = []) =>
      args.flatMap((arg) => {
        const evaluated = evaluateFormulaArgument(arg);
        const values = Array.isArray(evaluated) ? evaluated : [evaluated];
        return values
          .map((entry) => coerceNumeric(entry))
          .filter((entry) => Number.isFinite(entry));
      });

    const matchesCriterion = (value, criterion = "") => {
      const rawCriterion = String(criterion ?? "").trim().replace(/^"(.*)"$/, "$1");
      if (!rawCriterion) {
        return String(value ?? "").trim() === "";
      }
      const normalizedValue = typeof value === "number" ? value : String(value ?? "").trim();
      const operatorMatch = rawCriterion.match(/^(<=|>=|<>|=|<|>)(.*)$/);
      if (!operatorMatch) {
        if (/[*?]/.test(rawCriterion)) {
          const pattern = new RegExp(
            `^${rawCriterion
              .replace(/[.+^${}()|[\]\\]/g, "\\$&")
              .replace(/\*/g, ".*")
              .replace(/\?/g, ".")}$`,
            "i"
          );
          return pattern.test(String(normalizedValue));
        }
        return String(normalizedValue).toLowerCase() === rawCriterion.toLowerCase();
      }
      const [, operator, operandSource] = operatorMatch;
      const operandRaw = operandSource.trim();
      const leftNumeric = coerceNumeric(normalizedValue);
      const rightNumeric = coerceNumeric(operandRaw);
      const useNumeric = Number.isFinite(leftNumeric) && Number.isFinite(rightNumeric);
      const left = useNumeric ? leftNumeric : String(normalizedValue).toLowerCase();
      const right = useNumeric ? rightNumeric : operandRaw.toLowerCase();
      switch (operator) {
        case "=":
          return left === right;
        case "<>":
          return left !== right;
        case ">":
          return left > right;
        case "<":
          return left < right;
        case ">=":
          return left >= right;
        case "<=":
          return left <= right;
        default:
          return false;
      }
    };

    const resolveCriterionArgument = (criterionArg = "") => {
      const trimmed = String(criterionArg ?? "").trim();
      if (!trimmed) {
        return "";
      }
      if (/^".*"$/.test(trimmed)) {
        return trimmed.slice(1, -1).replace(/""/g, "\"").replace(/\\"/g, "\"");
      }
      if (/^(<=|>=|<>|=|<|>)/.test(trimmed)) {
        return trimmed;
      }
      const evaluated = evaluateFormulaArgument(trimmed);
      return Array.isArray(evaluated) ? coerceText(evaluated[0]) : coerceText(evaluated);
    };

    const valuesForFormulaArgument = (arg = "") => {
      const evaluated = evaluateFormulaArgument(arg);
      return Array.isArray(evaluated) ? evaluated : [evaluated];
    };

    const matrixForFormulaArgument = (arg = "") => {
      const trimmed = String(arg || "").trim();
      if (/^\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+$/i.test(trimmed)) {
        return collectRangeMatrix(trimmed, stack);
      }
      const evaluated = evaluateFormulaArgument(trimmed);
      return Array.isArray(evaluated) ? [evaluated] : [[evaluated]];
    };

    const serializeFormulaMatrix = (matrix = []) => {
      const rows = Array.isArray(matrix?.[0]) ? matrix : [matrix];
      return serializeFormulaValue(rows.map((row) => row.map((entry) => coerceText(entry)).join(", ")).join("; "));
    };

    const evaluateCriteriaMask = (includeArg = "", rowCount = 0) => {
      const trimmed = String(includeArg || "").trim();
      const comparisonMatch = trimmed.match(/^(\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*(<=|>=|<>|=|<|>)\s*(.+)$/i);
      if (comparisonMatch) {
        const [, rangeAddress, operator, criterionSource] = comparisonMatch;
        const criterion = `${operator}${resolveCriterionArgument(criterionSource)}`;
        return collectRangeValues(rangeAddress, stack).slice(0, rowCount).map((entry) => matchesCriterion(entry, criterion));
      }
      const includeValues = valuesForFormulaArgument(trimmed);
      return Array.from({ length: rowCount }, (_, index) => coerceBoolean(includeValues[index] ?? includeValues[0]));
    };

    const padFormulaNumber = (value = 0, length = 2) => String(Math.trunc(Math.abs(value))).padStart(length, "0");

    const dateToFormulaText = (date) => {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return "";
      }
      return `${date.getFullYear()}-${padFormulaNumber(date.getMonth() + 1)}-${padFormulaNumber(date.getDate())}`;
    };

    const parseFormulaDate = (value) => {
      if (value instanceof Date) {
        return value;
      }
      const numeric = coerceNumeric(value);
      if (Number.isFinite(numeric) && numeric > 20000 && numeric < 80000) {
        const date = new Date(Date.UTC(1899, 11, 30));
        date.setUTCDate(date.getUTCDate() + Math.trunc(numeric));
        return date;
      }
      const parsed = new Date(coerceText(value));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const valueFromText = (value = "") => {
      const text = coerceText(value).trim();
      const percent = text.endsWith("%");
      const cleaned = text.replace(/[%\s\u00a0]/g, "").replace(/[€$£¥]/g, "").replace(",", ".");
      const numeric = Number(cleaned);
      if (!Number.isFinite(numeric)) {
        return Number.NaN;
      }
      return percent ? numeric / 100 : numeric;
    };

    const formatTextValue = (value, format = "") => {
      const formatText = coerceText(format);
      const numeric = coerceNumeric(value);
      const dateValue = parseFormulaDate(value);
      if (/y{2,4}|d{1,2}|m{1,2}/i.test(formatText) && dateValue) {
        return formatText
          .replace(/yyyy/gi, String(dateValue.getFullYear()))
          .replace(/yy/gi, String(dateValue.getFullYear()).slice(-2))
          .replace(/mm/g, padFormulaNumber(dateValue.getMonth() + 1))
          .replace(/m/g, String(dateValue.getMonth() + 1))
          .replace(/dd/gi, padFormulaNumber(dateValue.getDate()))
          .replace(/d/gi, String(dateValue.getDate()));
      }
      if (Number.isFinite(numeric)) {
        const decimalMatch = formatText.match(/0\.([0]+)/);
        const decimals = decimalMatch ? decimalMatch[1].length : 0;
        const scaled = formatText.includes("%") ? numeric * 100 : numeric;
        const formatted = decimals ? scaled.toFixed(decimals) : String(Math.round(scaled));
        if (/[$€]/.test(formatText)) {
          return `${formatted} EUR`;
        }
        return formatText.includes("%") ? `${formatted}%` : formatted;
      }
      return coerceText(value);
    };

    const functionPattern =
      /(SUMIFS|SUMIF|COUNTIFS|COUNTIF|AVERAGEIFS|AVERAGEIF|AVERAGE|AVG|SUBTOTAL|FILTER|SORT|UNIQUE|INDEX|MATCH|TODAY|NOW|DATE|TEXT|LEFT|RIGHT|MID|TRIM|VALUE|MIN|MAX|COUNT|ABS|ROUNDUP|ROUNDDOWN|ROUND|IFERROR|IF|AND|OR|NOT|CONCAT|LEN|UPPER|LOWER|VLOOKUP|XLOOKUP)\(([^()]*)\)/i;
    while (functionPattern.test(expr)) {
      expr = expr.replace(functionPattern, (_, rawName, argsSource) => {
        const fn = String(rawName || "").toUpperCase();
        const args = splitFormulaArgs(argsSource);
        const values = collectAggregateValues(args);

        switch (fn) {
          case "SUM":
            return serializeFormulaValue(values.reduce((sum, value) => sum + value, 0));
          case "SUMIF": {
            const criteriaRange = valuesForFormulaArgument(args[0]);
            const criterion = resolveCriterionArgument(args[1] || "");
            const sumValues = args.length >= 3
              ? valuesForFormulaArgument(args[2])
              : criteriaRange;
            let total = 0;
            criteriaRange.forEach((entry, index) => {
              if (matchesCriterion(entry, criterion)) {
                total += normalizeNumeric(sumValues[index] ?? sumValues[0] ?? 0);
              }
            });
            return serializeFormulaValue(total);
          }
          case "SUMIFS": {
            const sumValues = valuesForFormulaArgument(args[0]);
            const criteriaPairs = [];
            for (let index = 1; index < args.length; index += 2) {
              criteriaPairs.push({
                range: valuesForFormulaArgument(args[index]),
                criterion: resolveCriterionArgument(args[index + 1] || "")
              });
            }
            const total = sumValues.reduce((sum, value, index) => {
              const matches = criteriaPairs.every((pair) => matchesCriterion(pair.range[index], pair.criterion));
              return matches ? sum + normalizeNumeric(value) : sum;
            }, 0);
            return serializeFormulaValue(total);
          }
          case "COUNTIF": {
            const criteriaRange = valuesForFormulaArgument(args[0]);
            const criterion = resolveCriterionArgument(args[1] || "");
            return serializeFormulaValue(criteriaRange.filter((entry) => matchesCriterion(entry, criterion)).length);
          }
          case "COUNTIFS": {
            const criteriaPairs = [];
            for (let index = 0; index < args.length; index += 2) {
              criteriaPairs.push({
                range: valuesForFormulaArgument(args[index]),
                criterion: resolveCriterionArgument(args[index + 1] || "")
              });
            }
            const length = Math.max(0, ...criteriaPairs.map((pair) => pair.range.length));
            let count = 0;
            for (let index = 0; index < length; index += 1) {
              if (criteriaPairs.every((pair) => matchesCriterion(pair.range[index], pair.criterion))) {
                count += 1;
              }
            }
            return serializeFormulaValue(count);
          }
          case "AVERAGEIF": {
            const criteriaRange = valuesForFormulaArgument(args[0]);
            const criterion = resolveCriterionArgument(args[1] || "");
            const averageValues = args.length >= 3 ? valuesForFormulaArgument(args[2]) : criteriaRange;
            const matchedValues = averageValues
              .filter((value, index) => matchesCriterion(criteriaRange[index], criterion))
              .map((value) => coerceNumeric(value))
              .filter((value) => Number.isFinite(value));
            return serializeFormulaValue(
              matchedValues.length ? matchedValues.reduce((sum, value) => sum + value, 0) / matchedValues.length : 0
            );
          }
          case "AVERAGEIFS": {
            const averageValues = valuesForFormulaArgument(args[0]);
            const criteriaPairs = [];
            for (let index = 1; index < args.length; index += 2) {
              criteriaPairs.push({
                range: valuesForFormulaArgument(args[index]),
                criterion: resolveCriterionArgument(args[index + 1] || "")
              });
            }
            const matchedValues = averageValues
              .filter((value, index) => criteriaPairs.every((pair) => matchesCriterion(pair.range[index], pair.criterion)))
              .map((value) => coerceNumeric(value))
              .filter((value) => Number.isFinite(value));
            return serializeFormulaValue(
              matchedValues.length ? matchedValues.reduce((sum, value) => sum + value, 0) / matchedValues.length : 0
            );
          }
          case "AVERAGE":
          case "AVG":
            return serializeFormulaValue(
              values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
            );
          case "MIN":
            return serializeFormulaValue(values.length ? Math.min(...values) : 0);
          case "MAX":
            return serializeFormulaValue(values.length ? Math.max(...values) : 0);
          case "COUNT":
            return serializeFormulaValue(values.length);
          case "SUBTOTAL": {
            const functionNumber = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[0])) || 0) % 100;
            const subtotalValues = collectAggregateValues(args.slice(1));
            switch (functionNumber) {
              case 1:
                return serializeFormulaValue(
                  subtotalValues.length
                    ? subtotalValues.reduce((sum, value) => sum + value, 0) / subtotalValues.length
                    : 0
                );
              case 2:
                return serializeFormulaValue(subtotalValues.length);
              case 3: {
                const countAValues = args.slice(1).flatMap((arg) => valuesForFormulaArgument(arg));
                return serializeFormulaValue(countAValues.filter((entry) => String(entry ?? "").trim()).length);
              }
              case 4:
                return serializeFormulaValue(subtotalValues.length ? Math.max(...subtotalValues) : 0);
              case 5:
                return serializeFormulaValue(subtotalValues.length ? Math.min(...subtotalValues) : 0);
              case 9:
              default:
                return serializeFormulaValue(subtotalValues.reduce((sum, value) => sum + value, 0));
            }
          }
          case "INDEX": {
            const matrix = matrixForFormulaArgument(args[0]);
            const rowNumber = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0);
            const columnNumber = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 1);
            if (!matrix.length) {
              return serializeFormulaValue("#REF!");
            }
            if (rowNumber === 0) {
              return serializeFormulaMatrix(matrix.map((row) => [row[Math.max(0, columnNumber - 1)] ?? ""]));
            }
            if (columnNumber === 0) {
              return serializeFormulaMatrix([matrix[Math.max(0, rowNumber - 1)] || []]);
            }
            return serializeFormulaValue(matrix[rowNumber - 1]?.[columnNumber - 1] ?? "#REF!");
          }
          case "MATCH": {
            const lookupValue = evaluateFormulaArgument(args[0]);
            const lookupValues = valuesForFormulaArgument(args[1]);
            const matchType = args[2] === undefined ? 0 : Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 0);
            if (matchType === 0) {
              const exactIndex = lookupValues.findIndex(
                (entry) => String(entry ?? "").toLowerCase() === String(lookupValue ?? "").toLowerCase()
              );
              return serializeFormulaValue(exactIndex >= 0 ? exactIndex + 1 : "#N/A");
            }
            const lookupNumeric = coerceNumeric(lookupValue);
            const matches = lookupValues
              .map((entry, index) => ({ value: coerceNumeric(entry), index }))
              .filter((entry) => Number.isFinite(entry.value));
            const candidate = matchType < 0
              ? matches.filter((entry) => entry.value >= lookupNumeric).sort((left, right) => left.value - right.value)[0]
              : matches.filter((entry) => entry.value <= lookupNumeric).sort((left, right) => right.value - left.value)[0];
            return serializeFormulaValue(candidate ? candidate.index + 1 : "#N/A");
          }
          case "FILTER": {
            const matrix = matrixForFormulaArgument(args[0]);
            const mask = evaluateCriteriaMask(args[1], matrix.length);
            const filtered = matrix.filter((row, index) => mask[index]);
            if (!filtered.length) {
              return serializeFormulaValue(args[2] !== undefined ? evaluateFormulaArgument(args[2]) : "#CALC!");
            }
            return serializeFormulaMatrix(filtered);
          }
          case "SORT": {
            const matrix = matrixForFormulaArgument(args[0]);
            const sortIndex = Math.max(1, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 1)) - 1;
            const sortOrder = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 1);
            const sorted = [...matrix].sort((leftRow, rightRow) => {
              const left = leftRow[sortIndex] ?? "";
              const right = rightRow[sortIndex] ?? "";
              const result = String(left).localeCompare(String(right), "fr", { numeric: true, sensitivity: "base" });
              return sortOrder < 0 ? -result : result;
            });
            return serializeFormulaMatrix(sorted);
          }
          case "UNIQUE": {
            const matrix = matrixForFormulaArgument(args[0]);
            const seen = new Set();
            const uniqueRows = matrix.filter((row) => {
              const key = row.map((entry) => String(entry ?? "").toLowerCase()).join("\u001f");
              if (seen.has(key)) {
                return false;
              }
              seen.add(key);
              return true;
            });
            return serializeFormulaMatrix(uniqueRows);
          }
          case "TODAY":
            return serializeFormulaValue(dateToFormulaText(new Date()));
          case "NOW": {
            const now = new Date();
            return serializeFormulaValue(
              `${dateToFormulaText(now)} ${padFormulaNumber(now.getHours())}:${padFormulaNumber(now.getMinutes())}`
            );
          }
          case "DATE": {
            const year = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[0])) || 0);
            const month = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 1);
            const day = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 1);
            return serializeFormulaValue(dateToFormulaText(new Date(year, month - 1, day)));
          }
          case "TEXT":
            return serializeFormulaValue(formatTextValue(evaluateFormulaArgument(args[0]), evaluateFormulaArgument(args[1])));
          case "LEFT": {
            const text = coerceText(evaluateFormulaArgument(args[0]));
            const length = args[1] === undefined ? 1 : Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0));
            return serializeFormulaValue(text.slice(0, length));
          }
          case "RIGHT": {
            const text = coerceText(evaluateFormulaArgument(args[0]));
            const length = args[1] === undefined ? 1 : Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0));
            return serializeFormulaValue(text.slice(Math.max(0, text.length - length)));
          }
          case "MID": {
            const text = coerceText(evaluateFormulaArgument(args[0]));
            const start = Math.max(1, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 1));
            const length = Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 0));
            return serializeFormulaValue(text.slice(start - 1, start - 1 + length));
          }
          case "TRIM":
            return serializeFormulaValue(coerceText(evaluateFormulaArgument(args[0])).replace(/\s+/g, " ").trim());
          case "VALUE": {
            const parsed = valueFromText(evaluateFormulaArgument(args[0]));
            return serializeFormulaValue(Number.isFinite(parsed) ? parsed : "#VALUE!");
          }
          case "ABS": {
            const source = coerceNumeric(evaluateFormulaArgument(args[0]));
            return serializeFormulaValue(Number.isFinite(source) ? Math.abs(source) : 0);
          }
          case "ROUND": {
            const source = coerceNumeric(evaluateFormulaArgument(args[0]));
            const digits = Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0));
            const factor = 10 ** digits;
            return serializeFormulaValue(Number.isFinite(source) ? Math.round(source * factor) / factor : 0);
          }
          case "ROUNDUP": {
            const source = coerceNumeric(evaluateFormulaArgument(args[0]));
            const digits = Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0));
            const factor = 10 ** digits;
            return serializeFormulaValue(Number.isFinite(source) ? Math.ceil(source * factor) / factor : 0);
          }
          case "ROUNDDOWN": {
            const source = coerceNumeric(evaluateFormulaArgument(args[0]));
            const digits = Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0));
            const factor = 10 ** digits;
            return serializeFormulaValue(Number.isFinite(source) ? Math.floor(source * factor) / factor : 0);
          }
          case "IF": {
            const condition = evaluateFormulaArgument(args[0]);
            const truthy = evaluateFormulaArgument(args[1]);
            const falsy = evaluateFormulaArgument(args[2]);
            return serializeFormulaValue(coerceBoolean(condition) ? truthy : falsy);
          }
          case "IFERROR": {
            const primary = evaluateFormulaArgument(args[0]);
            const fallback = evaluateFormulaArgument(args[1]);
            return serializeFormulaValue(String(primary).startsWith("#") ? fallback : primary);
          }
          case "AND":
            return serializeFormulaValue(args.every((arg) => coerceBoolean(evaluateFormulaArgument(arg))));
          case "OR":
            return serializeFormulaValue(args.some((arg) => coerceBoolean(evaluateFormulaArgument(arg))));
          case "NOT":
            return serializeFormulaValue(!coerceBoolean(evaluateFormulaArgument(args[0])));
          case "CONCAT":
            return serializeFormulaValue(args.map((arg) => coerceText(evaluateFormulaArgument(arg))).join(""));
          case "LEN":
            return serializeFormulaValue(coerceText(evaluateFormulaArgument(args[0])).length);
          case "UPPER":
            return serializeFormulaValue(coerceText(evaluateFormulaArgument(args[0])).toUpperCase());
          case "LOWER":
            return serializeFormulaValue(coerceText(evaluateFormulaArgument(args[0])).toLowerCase());
          case "VLOOKUP": {
            const lookupValue = evaluateFormulaArgument(args[0]);
            const tableValues = Array.isArray(evaluateFormulaArgument(args[1]))
              ? evaluateFormulaArgument(args[1])
              : [];
            const columnOffset = Math.max(1, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 1)) - 1;
            const exactMatch = args[3] === undefined ? true : coerceBoolean(evaluateFormulaArgument(args[3]));
            if (!tableValues.length) {
              return serializeFormulaValue("#N/A");
            }
            const rows = [];
            const [rangeStart, rangeEnd] = String(args[1] || "").split(":");
            const startCoords = addressToCoords(rangeStart);
            const endCoords = addressToCoords(rangeEnd);
            if (startCoords && endCoords) {
              const minRow = Math.min(startCoords.rowIndex, endCoords.rowIndex);
              const maxRow = Math.max(startCoords.rowIndex, endCoords.rowIndex);
              const minColumn = Math.min(startCoords.columnIndex, endCoords.columnIndex);
              const maxColumn = Math.max(startCoords.columnIndex, endCoords.columnIndex);
              for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
                rows.push(
                  Array.from({ length: maxColumn - minColumn + 1 }, (_, offset) =>
                    evaluateCellValue(rowIndex, minColumn + offset, stack)
                  )
                );
              }
            }
            const targetRow = rows.find((row) =>
              exactMatch
                ? String(row[0] ?? "").toLowerCase() === String(lookupValue ?? "").toLowerCase()
                : String(row[0] ?? "").toLowerCase().includes(String(lookupValue ?? "").toLowerCase())
            );
            return serializeFormulaValue(targetRow?.[columnOffset] ?? "#N/A");
          }
          case "XLOOKUP": {
            const lookupValue = evaluateFormulaArgument(args[0]);
            const lookupRange = Array.isArray(evaluateFormulaArgument(args[1]))
              ? evaluateFormulaArgument(args[1])
              : [evaluateFormulaArgument(args[1])];
            const returnRange = Array.isArray(evaluateFormulaArgument(args[2]))
              ? evaluateFormulaArgument(args[2])
              : [evaluateFormulaArgument(args[2])];
            const matchIndex = lookupRange.findIndex(
              (entry) => String(entry ?? "").toLowerCase() === String(lookupValue ?? "").toLowerCase()
            );
            return serializeFormulaValue(matchIndex >= 0 ? returnRange[matchIndex] ?? "#N/A" : "#N/A");
          }
          default:
            return serializeFormulaValue(0);
        }
      });
    }

    expr = expr.replace(/(^|[^A-Z0-9_])(\$?[A-Z]+\$?\d+)(?=[^A-Z0-9_]|$)/gi, (match, prefix, address) => {
      const evaluated = evaluateCellValueByAddress(address, stack);
      return `${prefix}${serializeFormulaValue(evaluated)}`;
    });

    expr = normalizeFormulaExpression(expr);
    const sanitized = expr
      .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, "0")
      .replace(/\btrue\b/gi, "1")
      .replace(/\bfalse\b/gi, "0");

    if (/[^0-9+\-*/().,<>=!&|\s]/.test(sanitized)) {
      return "#ERROR!";
    }

    try {
      const result = Function(`"use strict"; return (${expr});`)();
      if (typeof result === "number") {
        return Number.isFinite(result) ? result : "#ERROR!";
      }
      if (typeof result === "string" || typeof result === "boolean") {
        return result;
      }
      return result ?? "";
    } catch {
      return "#ERROR!";
    }
  };

  function evaluateCellValueByAddress(address = "", stack = new Set()) {
    const coords = addressToCoords(address);
    if (!coords) {
      return "";
    }
    return evaluateCellValue(coords.rowIndex, coords.columnIndex, stack);
  }

  function evaluateCellValue(rowIndex = 0, columnIndex = 0, stack = new Set()) {
    const key = `${rowIndex}:${columnIndex}`;
    if (stack.has(key)) {
      return "#CYCLE!";
    }
    const rawValue = getRawCellValue(rowIndex, columnIndex);
    if (!rawValue.startsWith("=")) {
      return rawValue;
    }
    const nextStack = new Set(stack);
    nextStack.add(key);
    return evaluateFormula(rawValue.slice(1), nextStack);
  }

  const previewShell = document.createElement("section");
  previewShell.className = "workspace-sheet-app";

  const menuBar = document.createElement("div");
  menuBar.className = "workspace-sheet-menubar";
  const sheetMenuButtons = new Map();
  ["File", "Edit", "View", "Insert", "Format", "Data", "Tools", "Extensions", "Help"].forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-sheet-menu-button";
    button.textContent = label;
    button.setAttribute("aria-haspopup", "menu");
    sheetMenuButtons.set(label, button);
    menuBar.appendChild(button);
  });
  previewShell.appendChild(menuBar);
  const sheetMenuPanel = document.createElement("div");
  sheetMenuPanel.className = "workspace-sheet-menu-panel";
  sheetMenuPanel.hidden = true;
  sheetMenuPanel.setAttribute("role", "menu");
  previewShell.appendChild(sheetMenuPanel);
  const xlsxImportInput = document.createElement("input");
  xlsxImportInput.type = "file";
  xlsxImportInput.className = "workspace-sheet-xlsx-input";
  xlsxImportInput.accept = ".xlsx,.xlsm,.xlsb,.xls";
  xlsxImportInput.hidden = true;
  previewShell.appendChild(xlsxImportInput);

  const topBar = document.createElement("div");
  topBar.className = "workspace-sheet-topbar";
  const titleGroup = document.createElement("div");
  titleGroup.className = "workspace-sheet-title-group";
  const title = document.createElement("strong");
  title.textContent = workObject?.title || friendlyPathLabel(filePath) || profile?.sheetName || "Sheet";
  const subtitle = document.createElement("span");
  subtitle.className = "tiny";
  subtitle.textContent = `${activeSheet.rows.length + 1} rows | ${activeSheet.columns.length} columns | ${workbookModel.sheets.length} sheet${workbookModel.sheets.length > 1 ? "s" : ""}`;
  titleGroup.append(title, subtitle);
  const topTabs = document.createElement("div");
  topTabs.className = "workspace-sheet-tabs";
  [(profile?.primaryTab || "Sheet"), profile?.secondaryTab || "Summary"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-sheet-tab${index === 0 ? " active" : ""}`;
    tab.textContent = label;
    topTabs.appendChild(tab);
  });
  topBar.append(titleGroup, topTabs);
  previewShell.appendChild(topBar);

  let activeSelection = { ...initialSelectionState.activeSelection };
  let commitHandle = null;
  let suppressFormulaActivation = false;
  let fillDragState = {
    active: false,
    startRowIndex: 0,
    startColumnIndex: 0,
    endRowIndex: 0,
    endColumnIndex: 0,
    targetRowIndex: 0,
    targetColumnIndex: 0
  };
  let formulaEditState = {
    mode: null,
    rowIndex: 0,
    columnIndex: 0,
    input: null,
    selectionStart: 0,
    selectionEnd: 0
  };
  let cellTextEditState = {
    active: false,
    rowIndex: -1,
    columnIndex: -1
  };
  let preserveRangeOnNextFocus = false;

  let selectionRange = { ...initialSelectionState.selectionRange };
  let selectionDragState = {
    active: false,
    anchorRowIndex: 0,
    anchorColumnIndex: 0
  };
  let resizeState = {
    active: false,
    kind: "",
    index: -1,
    startClientX: 0,
    startClientY: 0,
    startSize: 0
  };

  const saveCurrentSelectionState = () => {
    saveSpreadsheetSelectionState(
      historyKey,
      { activeSelection, selectionRange },
      sheetGrid.length,
      sheetGrid[0]?.length || 1
    );
  };

  const getWorkbookActiveSheet = () =>
    workbookModel.sheets.find((sheet) => sheet.id === workbookModel.activeSheetId) || workbookModel.sheets[0];

  const getActiveSheetState = () => getWorkbookActiveSheet();

  const getWorkbookSnapshot = (sourceModel = workbookModel) =>
    cloneSpreadsheetSnapshot(
      normalizeSpreadsheetPreviewModel(sourceModel, {
        defaultSheetName: profile?.sheetName || "Sheet 1"
      })
    );

  let editHistorySnapshot = null;
  let suppressRerenderBlurCommit = false;

  const recordSpreadsheetHistory = (beforeSnapshot = null, afterModel = workbookModel) => {
    const before = cloneSpreadsheetSnapshot(beforeSnapshot || historyState.current || workbookModel);
    const after = getWorkbookSnapshot(afterModel);
    if (areSpreadsheetSnapshotsEqual(before, after)) {
      historyState.current = after;
      return false;
    }

    historyState.past.push(before);
    if (historyState.past.length > SPREADSHEET_HISTORY_LIMIT) {
      historyState.past.splice(0, historyState.past.length - SPREADSHEET_HISTORY_LIMIT);
    }
    historyState.future = [];
    historyState.current = after;
    return true;
  };

  const beginSpreadsheetHistoryTransaction = () => {
    if (!editHistorySnapshot) {
      persistGridIntoActiveSheet();
      editHistorySnapshot = getWorkbookSnapshot();
    }
    return editHistorySnapshot;
  };

  const clearScheduledCommit = () => {
    if (commitHandle) {
      window.clearTimeout(commitHandle);
      commitHandle = null;
    }
  };

  const applySpreadsheetHistorySnapshot = (snapshot = {}) => {
    clearScheduledCommit();
    editHistorySnapshot = null;
    workbookModel = normalizeSpreadsheetPreviewModel(cloneSpreadsheetSnapshot(snapshot), {
      defaultSheetName: profile?.sheetName || "Sheet 1"
    });
    historyState.current = getWorkbookSnapshot(workbookModel);
    suppressRerenderBlurCommit = true;
    try {
      container.innerHTML = "";
      renderSpreadsheetClonePreview(container, {
        model: cloneSpreadsheetSnapshot(workbookModel),
        profile,
        workObject,
        filePath,
        onGridEdit
      });
      onGridEdit?.(workbookModel, { refreshWorkspace: false });
    } finally {
      suppressRerenderBlurCommit = false;
    }
  };

  const undoSpreadsheetAction = () => {
    clearScheduledCommit();
    if (editHistorySnapshot) {
      const previousEditSnapshot = cloneSpreadsheetSnapshot(editHistorySnapshot);
      persistGridIntoActiveSheet();
      const currentEditSnapshot = getWorkbookSnapshot();
      editHistorySnapshot = null;
      if (!areSpreadsheetSnapshotsEqual(previousEditSnapshot, currentEditSnapshot)) {
        historyState.future.push(currentEditSnapshot);
        applySpreadsheetHistorySnapshot(previousEditSnapshot);
        return;
      }
    }
    if (!historyState.past.length) {
      return;
    }
    const previousSnapshot = historyState.past.pop();
    historyState.future.push(getWorkbookSnapshot(historyState.current));
    applySpreadsheetHistorySnapshot(previousSnapshot);
  };

  const redoSpreadsheetAction = () => {
    clearScheduledCommit();
    editHistorySnapshot = null;
    if (!historyState.future.length) {
      return;
    }
    const nextSnapshot = historyState.future.pop();
    historyState.past.push(getWorkbookSnapshot(historyState.current));
    if (historyState.past.length > SPREADSHEET_HISTORY_LIMIT) {
      historyState.past.splice(0, historyState.past.length - SPREADSHEET_HISTORY_LIMIT);
    }
    applySpreadsheetHistorySnapshot(nextSnapshot);
  };

  const persistGridIntoActiveSheet = () => {
    const trimmed = trimGridToModel();
    const currentSheet = getActiveSheetState();
    currentSheet.columns = trimmed.columns;
    currentSheet.rows = trimmed.rows;
    workbookModel = normalizeSpreadsheetPreviewModel(workbookModel, {
      defaultSheetName: profile?.sheetName || "Sheet 1"
    });
    return workbookModel;
  };

  const persistWorkbookState = (
    refreshWorkspace = false,
    { trackHistory = true, beforeSnapshot = null, updateHistoryBaseline = true } = {}
  ) => {
    saveCurrentSelectionState();
    workbookModel = normalizeSpreadsheetPreviewModel(workbookModel, {
      defaultSheetName: profile?.sheetName || "Sheet 1"
    });
    if (trackHistory) {
      recordSpreadsheetHistory(beforeSnapshot || historyState.current, workbookModel);
      editHistorySnapshot = null;
    } else if (updateHistoryBaseline) {
      historyState.current = getWorkbookSnapshot(workbookModel);
    }
    onGridEdit?.(workbookModel, { refreshWorkspace });
    return workbookModel;
  };

  const rerenderPreview = ({ persistGrid = true } = {}) => {
    if (persistGrid) {
      persistGridIntoActiveSheet();
    }
    container.innerHTML = "";
    renderSpreadsheetClonePreview(container, {
      model: workbookModel,
      profile,
      workObject,
      filePath,
      onGridEdit
    });
  };

  const commitModel = (
    refreshWorkspace = false,
    { trackHistory = true, beforeSnapshot = null, updateHistoryBaseline = true } = {}
  ) => {
    saveCurrentSelectionState();
    const nextModel = persistGridIntoActiveSheet();
    if (trackHistory) {
      recordSpreadsheetHistory(beforeSnapshot || editHistorySnapshot || historyState.current, nextModel);
      editHistorySnapshot = null;
    } else if (updateHistoryBaseline) {
      historyState.current = getWorkbookSnapshot(nextModel);
    }
    onGridEdit?.(nextModel, { refreshWorkspace });
  };

  const scheduleCommit = () => {
    if (commitHandle) {
      window.clearTimeout(commitHandle);
    }
    commitHandle = window.setTimeout(() => {
      commitModel(false, { trackHistory: false, updateHistoryBaseline: false });
      commitHandle = null;
    }, 140);
  };

  const buildColumnFormula = (name = "SUM") => {
    const columnRef = columnLetter(activeSelection.columnIndex);
    let startRow = 1;
    let endRow = Math.max(1, sheetGrid.length);
    if (activeSelection.rowIndex + 1 >= startRow && activeSelection.rowIndex + 1 <= endRow) {
      endRow = Math.max(startRow, activeSelection.rowIndex);
    }
    return `=${name}(${columnRef}${startRow}:${columnRef}${endRow})`;
  };

  const getSelectionBounds = () => ({
    minRow: Math.min(selectionRange.startRowIndex, selectionRange.endRowIndex),
    maxRow: Math.max(selectionRange.startRowIndex, selectionRange.endRowIndex),
    minColumn: Math.min(selectionRange.startColumnIndex, selectionRange.endColumnIndex),
    maxColumn: Math.max(selectionRange.startColumnIndex, selectionRange.endColumnIndex)
  });

  const setSelectionRange = ({
    startRowIndex = activeSelection.rowIndex,
    startColumnIndex = activeSelection.columnIndex,
    endRowIndex = activeSelection.rowIndex,
    endColumnIndex = activeSelection.columnIndex
  } = {}) => {
    selectionRange = {
      startRowIndex,
      startColumnIndex,
      endRowIndex,
      endColumnIndex
    };
    saveCurrentSelectionState();
  };

  const forEachSelectedCell = (callback) => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        callback(rowIndex, columnIndex);
      }
    }
  };

  const getLastUsedCell = () => {
    let rowIndex = 0;
    let columnIndex = 0;
    sheetGrid.forEach((row, currentRowIndex) => {
      row.forEach((value, currentColumnIndex) => {
        if (String(value || "").trim()) {
          rowIndex = Math.max(rowIndex, currentRowIndex);
          columnIndex = Math.max(columnIndex, currentColumnIndex);
        }
      });
    });
    return { rowIndex, columnIndex };
  };

  const getRowLastUsedColumn = (rowIndex = activeSelection.rowIndex) => {
    const row = sheetGrid[rowIndex] || [];
    for (let columnIndex = row.length - 1; columnIndex >= 0; columnIndex -= 1) {
      if (String(row[columnIndex] || "").trim()) {
        return columnIndex;
      }
    }
    return Math.max(0, row.length - 1);
  };

  const getCellFormatKey = (rowIndex = 0, columnIndex = 0) => `${rowIndex}:${columnIndex}`;

  const getCellFormat = (rowIndex = 0, columnIndex = 0) =>
    normalizeSpreadsheetCellFormat(getActiveSheetState().cellFormats?.[getCellFormatKey(rowIndex, columnIndex)] || {});

  const setCellFormat = (rowIndex = 0, columnIndex = 0, format = {}) => {
    const currentSheet = getActiveSheetState();
    if (!currentSheet.cellFormats || typeof currentSheet.cellFormats !== "object") {
      currentSheet.cellFormats = {};
    }
    const key = getCellFormatKey(rowIndex, columnIndex);
    const normalized = normalizeSpreadsheetCellFormat(format);
    if (!isSpreadsheetCellFormatEmpty(normalized)) {
      currentSheet.cellFormats[key] = normalized;
    } else {
      delete currentSheet.cellFormats[key];
    }
  };

  const updateSelectedCellFormats = (updater) => {
    if (typeof updater !== "function") {
      return;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    forEachSelectedCell((rowIndex, columnIndex) => {
      const nextFormat = normalizeSpreadsheetCellFormat(updater(getCellFormat(rowIndex, columnIndex), rowIndex, columnIndex));
      setCellFormat(rowIndex, columnIndex, nextFormat);
    });
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
  };

  const setSelectedRangeFormat = (format = "") => {
    updateSelectedCellFormats((currentFormat) => {
      const nextFormat = { ...currentFormat };
      if (format) {
        nextFormat.numberFormat = format;
      } else {
        delete nextFormat.numberFormat;
      }
      return nextFormat;
    });
  };

  const toggleSelectedTextStyle = (style = "") => {
    if (!["bold", "italic", "underline"].includes(style)) {
      return;
    }
    const nextValue = !getCellFormat(activeSelection.rowIndex, activeSelection.columnIndex)[style];
    updateSelectedCellFormats((currentFormat) => ({
      ...currentFormat,
      [style]: nextValue
    }));
  };

  const setSelectedHorizontalAlign = (alignment = "") => {
    updateSelectedCellFormats((currentFormat) => {
      const nextFormat = { ...currentFormat };
      if (SPREADSHEET_HORIZONTAL_ALIGNMENTS.has(alignment)) {
        nextFormat.horizontalAlign = alignment;
      } else {
        delete nextFormat.horizontalAlign;
      }
      return nextFormat;
    });
  };

  const setSelectedVerticalAlign = (alignment = "") => {
    updateSelectedCellFormats((currentFormat) => {
      const nextFormat = { ...currentFormat };
      if (SPREADSHEET_VERTICAL_ALIGNMENTS.has(alignment)) {
        nextFormat.verticalAlign = alignment;
      } else {
        delete nextFormat.verticalAlign;
      }
      return nextFormat;
    });
  };

  const setSelectedFontSize = (fontSize = 11) => {
    updateSelectedCellFormats((currentFormat) => ({
      ...currentFormat,
      fontSize
    }));
  };

  const adjustSelectedFontSize = (delta = 0) => {
    const currentSize = getCellFormat(activeSelection.rowIndex, activeSelection.columnIndex).fontSize || 11;
    setSelectedFontSize(currentSize + delta);
  };

  const setSelectedTextColor = (color = "") => {
    updateSelectedCellFormats((currentFormat) => {
      const nextFormat = { ...currentFormat };
      const normalizedColor = normalizeSpreadsheetColor(color);
      if (normalizedColor) {
        nextFormat.textColor = normalizedColor;
      } else {
        delete nextFormat.textColor;
      }
      return nextFormat;
    });
  };

  const setSelectedFillColor = (color = "") => {
    updateSelectedCellFormats((currentFormat) => {
      const nextFormat = { ...currentFormat };
      const normalizedColor = normalizeSpreadsheetColor(color);
      if (normalizedColor) {
        nextFormat.fillColor = normalizedColor;
      } else {
        delete nextFormat.fillColor;
      }
      return nextFormat;
    });
  };

  const setSelectedBorder = (kind = "all") => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    updateSelectedCellFormats((currentFormat, rowIndex, columnIndex) => {
      const nextFormat = { ...currentFormat };
      if (kind === "clear") {
        delete nextFormat.border;
        return nextFormat;
      }

      const border = { ...(nextFormat.border || {}), color: "#202124" };
      if (kind === "all") {
        SPREADSHEET_BORDER_EDGES.forEach((edge) => {
          border[edge] = true;
        });
      } else if (kind === "outer") {
        if (rowIndex === minRow) {
          border.top = true;
        }
        if (rowIndex === maxRow) {
          border.bottom = true;
        }
        if (columnIndex === minColumn) {
          border.left = true;
        }
        if (columnIndex === maxColumn) {
          border.right = true;
        }
      } else if (SPREADSHEET_BORDER_EDGES.includes(kind)) {
        border[kind] = true;
      }
      nextFormat.border = border;
      return nextFormat;
    });
  };

  const clearSelectedFormatting = () => {
    updateSelectedCellFormats(() => ({}));
  };

  const escapeClipboardHtml = (value = "") =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");

  const serializeClipboardCell = (value = "") => {
    const text = String(value ?? "");
    return /[\t\r\n"]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
  };

  const serializeClipboardMatrix = (matrix = []) =>
    matrix.map((row) => row.map(serializeClipboardCell).join("\t")).join("\r\n");

  const serializeClipboardHtml = (matrix = []) =>
    `<table>${matrix
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeClipboardHtml(cell)}</td>`).join("")}</tr>`)
      .join("")}</table>`;

  const detectClipboardDelimiter = (text = "") => {
    if (text.includes("\t")) {
      return "\t";
    }
    const firstLine = text
      .split(/\n/)
      .find((line) => String(line || "").trim().length);
    if (firstLine && firstLine.includes(",") && !firstLine.trim().startsWith("=")) {
      return ",";
    }
    return "\t";
  };

  const parseClipboardText = (text = "") => {
    const source = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!source.length) {
      return [];
    }
    const delimiter = detectClipboardDelimiter(source);
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (char === "\"") {
        if (inQuotes && next === "\"") {
          cell += "\"";
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === delimiter && !inQuotes) {
        row.push(cell);
        cell = "";
        continue;
      }
      if (char === "\n" && !inQuotes) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }
      cell += char;
    }

    row.push(cell);
    rows.push(row);
    while (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
      rows.pop();
    }

    const width = Math.max(1, ...rows.map((entry) => entry.length));
    return rows.map((entry) => Array.from({ length: width }, (_, index) => entry[index] ?? ""));
  };

  const getStoredClipboardPayload = () => spreadsheetClipboardStore.get(historyKey) || null;

  const setStoredClipboardPayload = (payload = null) => {
    if (payload) {
      spreadsheetClipboardStore.set(historyKey, payload);
    } else {
      spreadsheetClipboardStore.delete(historyKey);
    }
  };

  const buildClipboardPayload = (mode = "copy") => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const matrix = [];
    const formats = [];
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      const row = [];
      const formatRow = [];
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        row.push(getRawCellValue(rowIndex, columnIndex));
        formatRow.push(getCellFormat(rowIndex, columnIndex));
      }
      matrix.push(row);
      formats.push(formatRow);
    }
    const text = serializeClipboardMatrix(matrix);
    return {
      kind: "hydria-sheet-clipboard",
      mode,
      source: {
        sheetId: workbookModel.activeSheetId,
        minRow,
        minColumn,
        rowCount: maxRow - minRow + 1,
        columnCount: maxColumn - minColumn + 1
      },
      matrix,
      formats,
      text,
      html: serializeClipboardHtml(matrix)
    };
  };

  const writeClipboardPayload = (payload = null, clipboardData = null) => {
    if (!payload) {
      return false;
    }
    setStoredClipboardPayload(payload);
    syncSelectionUi();
    if (clipboardData) {
      clipboardData.setData("text/plain", payload.text);
      clipboardData.setData("text/html", payload.html);
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(payload.text).catch(() => {});
    }
    return true;
  };

  const copySelectedCells = (clipboardData = null, { mode = "copy" } = {}) =>
    writeClipboardPayload(buildClipboardPayload(mode), clipboardData);

  const cutSelectedCells = (clipboardData = null) => {
    clearScheduledCommit();
    copySelectedCells(clipboardData, { mode: "cut" });
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    forEachSelectedCell((rowIndex, columnIndex) => {
      setRawCellValue(rowIndex, columnIndex, "");
    });
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const clearSelectedCells = () => {
    clearScheduledCommit();
    setStoredClipboardPayload(null);
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    forEachSelectedCell((rowIndex, columnIndex) => {
      setRawCellValue(rowIndex, columnIndex, "");
    });
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const getClipboardPayloadForText = (text = "") => {
    const payload = getStoredClipboardPayload();
    if (payload && (!text || payload.text === text)) {
      return payload;
    }
    return null;
  };

  const pasteClipboardMatrix = (matrix = [], payload = null) => {
    const sourceHeight = matrix.length;
    const sourceWidth = Math.max(0, ...matrix.map((row) => row.length));
    if (!sourceHeight || !sourceWidth) {
      return false;
    }

    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const selectionHeight = maxRow - minRow + 1;
    const selectionWidth = maxColumn - minColumn + 1;
    const pasteHeight = selectionHeight > 1 || selectionWidth > 1
      ? Math.max(selectionHeight, sourceHeight)
      : sourceHeight;
    const pasteWidth = selectionHeight > 1 || selectionWidth > 1
      ? Math.max(selectionWidth, sourceWidth)
      : sourceWidth;
    const internalClipboard = payload?.kind === "hydria-sheet-clipboard";

    ensureGridSize(minRow + pasteHeight, minColumn + pasteWidth);
    for (let rowOffset = 0; rowOffset < pasteHeight; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < pasteWidth; columnOffset += 1) {
        const sourceRowOffset = rowOffset % sourceHeight;
        const sourceColumnOffset = columnOffset % sourceWidth;
        const targetRowIndex = minRow + rowOffset;
        const targetColumnIndex = minColumn + columnOffset;
        const sourceValue = String(matrix[sourceRowOffset]?.[sourceColumnOffset] ?? "");
        const sourceRowIndex = (payload?.source?.minRow ?? minRow) + sourceRowOffset;
        const sourceColumnIndex = (payload?.source?.minColumn ?? minColumn) + sourceColumnOffset;
        const nextValue =
          internalClipboard && payload.mode !== "cut" && sourceValue.startsWith("=")
            ? shiftFormulaReferences(
                sourceValue,
                targetRowIndex - sourceRowIndex,
                targetColumnIndex - sourceColumnIndex
              )
            : sourceValue;
        setRawCellValue(targetRowIndex, targetColumnIndex, nextValue);
        if (internalClipboard && payload.formats) {
          setCellFormat(targetRowIndex, targetColumnIndex, payload.formats[sourceRowOffset]?.[sourceColumnOffset] || "");
        }
      }
    }

    activeSelection = { rowIndex: minRow, columnIndex: minColumn };
    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      endRowIndex: minRow + pasteHeight - 1,
      endColumnIndex: minColumn + pasteWidth - 1
    });
    if (payload?.mode === "cut") {
      setStoredClipboardPayload(null);
    }
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const pasteClipboardText = (text = "", payload = null) => {
    const clipboardPayload = payload || getClipboardPayloadForText(text);
    if (!clipboardPayload && text) {
      setStoredClipboardPayload(null);
    }
    const matrix = clipboardPayload?.matrix || parseClipboardText(text);
    return pasteClipboardMatrix(matrix, clipboardPayload);
  };

  const readSystemClipboardText = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        return await navigator.clipboard.readText();
      }
    } catch {
      // The internal clipboard fallback still covers toolbar paste after in-app copy/cut.
    }
    return "";
  };

  const pasteFromClipboard = async (clipboardData = null) => {
    const eventText = clipboardData?.getData?.("text/plain") || "";
    if (eventText) {
      return pasteClipboardText(eventText, getClipboardPayloadForText(eventText));
    }
    if (clipboardData) {
      return pasteClipboardText("", getStoredClipboardPayload());
    }
    const systemText = await readSystemClipboardText();
    return pasteClipboardText(systemText, getClipboardPayloadForText(systemText) || (!systemText ? getStoredClipboardPayload() : null));
  };

  const shouldUseNativeTextClipboard = (event) => {
    const target = event.target;
    if (!target || !previewShell.contains(target)) {
      return false;
    }
    if (target === formulaInput || target === nameBox || target.isContentEditable) {
      return true;
    }
    if (target.matches?.("textarea")) {
      return true;
    }
    if (target.matches?.("input") && !target.classList.contains("workspace-sheet-cell-input")) {
      return true;
    }
    if (target.classList?.contains("workspace-sheet-cell-input")) {
      const isCellTextEdit =
        cellTextEditState.active &&
        Number(target.dataset.rowIndex || -1) === cellTextEditState.rowIndex &&
        Number(target.dataset.columnIndex || -1) === cellTextEditState.columnIndex;
      if (!isCellTextEdit) {
        return false;
      }
      return event.type === "paste" || Number(target.selectionStart ?? 0) !== Number(target.selectionEnd ?? 0);
    }
    return false;
  };

  const formatCellDisplayValue = (value, rowIndex = 0, columnIndex = 0) => {
    const format = getCellFormat(rowIndex, columnIndex);
    const numberFormat = format.numberFormat || "";
    const normalizedValue = typeof value === "string" ? value : formatFormulaResult(value);
    if (!numberFormat || normalizedValue.startsWith("#")) {
      return normalizedValue;
    }

    const numeric = Number(String(normalizedValue || "").replace(",", "."));
    if (numberFormat === "number" && Number.isFinite(numeric)) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(numeric);
    }
    if (numberFormat === "currency" && Number.isFinite(numeric)) {
      return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(numeric);
    }
    if (numberFormat === "percent" && Number.isFinite(numeric)) {
      return new Intl.NumberFormat("fr-FR", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(numeric);
    }
    if (numberFormat === "date") {
      const dateValue = new Date(normalizedValue);
      if (!Number.isNaN(dateValue.getTime())) {
        return new Intl.DateTimeFormat("fr-FR").format(dateValue);
      }
    }
    return normalizedValue;
  };

  const applyCellVisualFormat = (input, wrapper, rowIndex = 0, columnIndex = 0) => {
    const format = getCellFormat(rowIndex, columnIndex);
    input.style.fontWeight = format.bold ? "700" : "";
    input.style.fontStyle = format.italic ? "italic" : "";
    input.style.textDecoration = format.underline ? "underline" : "";
    input.style.textAlign = format.horizontalAlign || "";
    input.style.fontSize = format.fontSize ? `${format.fontSize}px` : "";
    input.style.setProperty("--sheet-cell-color", format.textColor || "#202124");
    input.style.setProperty("--sheet-cell-fill", format.fillColor || "transparent");
    wrapper.style.verticalAlign =
      format.verticalAlign === "middle" ? "middle" : format.verticalAlign === "bottom" ? "bottom" : "top";
    wrapper.style.borderTop = "";
    wrapper.style.borderRight = "";
    wrapper.style.borderBottom = "";
    wrapper.style.borderLeft = "";

    const border = normalizeSpreadsheetBorderSpec(format.border);
    if (!border) {
      return;
    }
    const borderStyle = `2px solid ${border.color || "#202124"}`;
    if (border.top) {
      wrapper.style.borderTop = borderStyle;
    }
    if (border.right) {
      wrapper.style.borderRight = borderStyle;
    }
    if (border.bottom) {
      wrapper.style.borderBottom = borderStyle;
    }
    if (border.left) {
      wrapper.style.borderLeft = borderStyle;
    }
  };

  const getColumnWidth = (columnIndex = 0) => {
    const width = Number(getActiveSheetState().columnWidths?.[String(columnIndex)] || 132);
    return clamp(width, 72, 420);
  };

  const getRowHeight = (rowIndex = 0) => {
    const height = Number(getActiveSheetState().rowHeights?.[String(rowIndex)] || 34);
    return clamp(height, 28, 240);
  };

  const setColumnWidth = (columnIndex = 0, width = 132) => {
    const currentSheet = getActiveSheetState();
    currentSheet.columnWidths = currentSheet.columnWidths || {};
    currentSheet.columnWidths[String(columnIndex)] = clamp(width, 72, 420);
  };

  const setRowHeight = (rowIndex = 0, height = 34) => {
    const currentSheet = getActiveSheetState();
    currentSheet.rowHeights = currentSheet.rowHeights || {};
    currentSheet.rowHeights[String(rowIndex)] = clamp(height, 28, 240);
  };

  const getSheetMerges = () => getActiveSheetState().merges || [];

  const findMergeAt = (rowIndex = 0, columnIndex = 0) =>
    getSheetMerges().find(
      (merge) =>
        rowIndex >= merge.startRowIndex &&
        rowIndex < merge.startRowIndex + merge.rowSpan &&
        columnIndex >= merge.startColumnIndex &&
        columnIndex < merge.startColumnIndex + merge.columnSpan
    ) || null;

  const isMergeAnchor = (rowIndex = 0, columnIndex = 0) => {
    const merge = findMergeAt(rowIndex, columnIndex);
    return Boolean(merge && merge.startRowIndex === rowIndex && merge.startColumnIndex === columnIndex);
  };

  const mergeSelectionRange = () => {
    persistGridIntoActiveSheet();
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const rowSpan = maxRow - minRow + 1;
    const columnSpan = maxColumn - minColumn + 1;
    if (rowSpan === 1 && columnSpan === 1) {
      return;
    }
    const currentSheet = getActiveSheetState();
    currentSheet.merges = (currentSheet.merges || []).filter(
      (merge) =>
        merge.startRowIndex + merge.rowSpan - 1 < minRow ||
        merge.startRowIndex > maxRow ||
        merge.startColumnIndex + merge.columnSpan - 1 < minColumn ||
        merge.startColumnIndex > maxColumn
    );
    currentSheet.merges.push({
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      rowSpan,
      columnSpan
    });
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const unmergeSelectionRange = () => {
    persistGridIntoActiveSheet();
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const currentSheet = getActiveSheetState();
    currentSheet.merges = (currentSheet.merges || []).filter(
      (merge) =>
        merge.startRowIndex + merge.rowSpan - 1 < minRow ||
        merge.startRowIndex > maxRow ||
        merge.startColumnIndex + merge.columnSpan - 1 < minColumn ||
        merge.startColumnIndex > maxColumn
    );
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const shiftFormulaReferences = (rawValue = "", rowOffset = 0, columnOffset = 0) => {
    if (!String(rawValue || "").startsWith("=")) {
      return String(rawValue || "");
    }
    return String(rawValue).replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (_, colAbs, letters, rowAbs, rowText) => {
      const coords = addressToCoords(`${colAbs}${letters}${rowAbs}${rowText}`);
      if (!coords) {
        return `${colAbs}${letters}${rowAbs}${rowText}`;
      }
      const nextRowIndex = coords.absoluteRow ? coords.rowIndex : clamp(coords.rowIndex + rowOffset, 0, 9998);
      const nextColumnIndex = coords.absoluteColumn
        ? coords.columnIndex
        : clamp(coords.columnIndex + columnOffset, 0, 9998);
      return coordsToAddress(nextRowIndex, nextColumnIndex, {
        absoluteRow: coords.absoluteRow,
        absoluteColumn: coords.absoluteColumn
      });
    });
  };

  const getFillRangeBounds = () => ({
    minRow: Math.min(fillDragState.startRowIndex, fillDragState.targetRowIndex),
    maxRow: Math.max(fillDragState.endRowIndex, fillDragState.targetRowIndex),
    minColumn: Math.min(fillDragState.startColumnIndex, fillDragState.targetColumnIndex),
    maxColumn: Math.max(fillDragState.endColumnIndex, fillDragState.targetColumnIndex)
  });

  const clearFillPreview = () => {
    table?.querySelectorAll(".is-fill-preview").forEach((node) => node.classList.remove("is-fill-preview"));
  };

  const updateFillPreview = () => {
    clearFillPreview();
    if (!fillDragState.active) {
      return;
    }
    const { minRow, maxRow, minColumn, maxColumn } = getFillRangeBounds();
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        table
          ?.querySelector(`[data-sheet-grid-cell="${rowIndex}:${columnIndex}"]`)
          ?.classList.add("is-fill-preview");
      }
    }
  };

  const findCellInputFromPointer = (clientX = 0, clientY = 0) => {
    const node = document.elementFromPoint(clientX, clientY);
    if (!node) {
      return null;
    }
    return node.matches?.("[data-sheet-grid-cell]") ? node : node.closest?.("[data-sheet-grid-cell]");
  };

  const applyFillDrag = () => {
    if (!fillDragState.active) {
      return;
    }
    const sourceMinRow = Math.min(fillDragState.startRowIndex, fillDragState.endRowIndex);
    const sourceMaxRow = Math.max(fillDragState.startRowIndex, fillDragState.endRowIndex);
    const sourceMinColumn = Math.min(fillDragState.startColumnIndex, fillDragState.endColumnIndex);
    const sourceMaxColumn = Math.max(fillDragState.startColumnIndex, fillDragState.endColumnIndex);
    const sourceHeight = sourceMaxRow - sourceMinRow + 1;
    const sourceWidth = sourceMaxColumn - sourceMinColumn + 1;
    const sourceMatrix = Array.from({ length: sourceHeight }, (_, rowOffset) =>
      Array.from({ length: sourceWidth }, (_, columnOffset) =>
        getRawCellValue(sourceMinRow + rowOffset, sourceMinColumn + columnOffset)
      )
    );
    const { minRow, maxRow, minColumn, maxColumn } = getFillRangeBounds();
    const isVerticalSeries = sourceWidth === 1 && sourceHeight >= 2 && fillDragState.targetRowIndex !== sourceMaxRow;
    const isHorizontalSeries = sourceHeight === 1 && sourceWidth >= 2 && fillDragState.targetColumnIndex !== sourceMaxColumn;

    const buildSeriesValue = (targetIndex = 0, values = []) => {
      const numericValues = values.map((value) => Number(String(value || "").replace(",", ".")));
      if (!numericValues.every((value) => Number.isFinite(value))) {
        return "";
      }
      const step = numericValues.length >= 2 ? numericValues[numericValues.length - 1] - numericValues[numericValues.length - 2] : 0;
      const nextValue = numericValues[numericValues.length - 1] + step * targetIndex;
      return Number.isInteger(nextValue) ? String(nextValue) : String(nextValue);
    };

    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        const isInsideSource =
          rowIndex >= sourceMinRow &&
          rowIndex <= sourceMaxRow &&
          columnIndex >= sourceMinColumn &&
          columnIndex <= sourceMaxColumn;
        if (isInsideSource) {
          continue;
        }

        if (isVerticalSeries && columnIndex >= sourceMinColumn && columnIndex <= sourceMaxColumn) {
          const sourceValues = sourceMatrix.map((row) => row[0]);
          const targetOffset =
            rowIndex > sourceMaxRow
              ? rowIndex - sourceMaxRow
              : -(sourceMinRow - rowIndex);
          const nextSeriesValue = buildSeriesValue(targetOffset, sourceValues);
          if (nextSeriesValue) {
            setRawCellValue(rowIndex, columnIndex, nextSeriesValue);
            continue;
          }
        }

        if (isHorizontalSeries && rowIndex >= sourceMinRow && rowIndex <= sourceMaxRow) {
          const sourceValues = sourceMatrix[0];
          const targetOffset =
            columnIndex > sourceMaxColumn
              ? columnIndex - sourceMaxColumn
              : -(sourceMinColumn - columnIndex);
          const nextSeriesValue = buildSeriesValue(targetOffset, sourceValues);
          if (nextSeriesValue) {
            setRawCellValue(rowIndex, columnIndex, nextSeriesValue);
            continue;
          }
        }

        const sourceRowOffset = ((rowIndex - sourceMinRow) % sourceHeight + sourceHeight) % sourceHeight;
        const sourceColumnOffset = ((columnIndex - sourceMinColumn) % sourceWidth + sourceWidth) % sourceWidth;
        const sourceValue = sourceMatrix[sourceRowOffset][sourceColumnOffset];
        const nextValue = String(sourceValue || "").startsWith("=")
          ? shiftFormulaReferences(
              sourceValue,
              rowIndex - (sourceMinRow + sourceRowOffset),
              columnIndex - (sourceMinColumn + sourceColumnOffset)
            )
          : sourceValue;
        setRawCellValue(rowIndex, columnIndex, nextValue);
      }
    }

    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      endRowIndex: maxRow,
      endColumnIndex: maxColumn
    });
    fillDragState.active = false;
    clearFillPreview();
    commitModel(false);
    refreshGridValues();
  };

  const handleSelectionDragMove = (event) => {
    const targetInput = findCellInputFromPointer(event.clientX, event.clientY);
    if (!selectionDragState.active || !targetInput) {
      return;
    }
    setSelectionRange({
      startRowIndex: selectionDragState.anchorRowIndex,
      startColumnIndex: selectionDragState.anchorColumnIndex,
      endRowIndex: Number(targetInput.dataset.rowIndex || selectionDragState.anchorRowIndex),
      endColumnIndex: Number(targetInput.dataset.columnIndex || selectionDragState.anchorColumnIndex)
    });
    activeSelection = {
      rowIndex: selectionRange.endRowIndex,
      columnIndex: selectionRange.endColumnIndex
    };
    saveCurrentSelectionState();
    syncSelectionUi();
  };

  const handleSelectionDragEnd = () => {
    if (!selectionDragState.active) {
      return;
    }
    selectionDragState.active = false;
    document.removeEventListener("mousemove", handleSelectionDragMove);
    document.removeEventListener("mouseup", handleSelectionDragEnd);
  };

  const handleResizeMove = (event) => {
    if (!resizeState.active) {
      return;
    }
    if (resizeState.kind === "column") {
      const nextWidth = resizeState.startSize + (event.clientX - resizeState.startClientX);
      setColumnWidth(resizeState.index, nextWidth);
    } else if (resizeState.kind === "row") {
      const nextHeight = resizeState.startSize + (event.clientY - resizeState.startClientY);
      setRowHeight(resizeState.index, nextHeight);
    }
    applyFreezeState();
    syncSelectionUi();
  };

  const handleResizeEnd = () => {
    if (!resizeState.active) {
      return;
    }
    resizeState.active = false;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const syncFormulaEditorState = ({
    mode = null,
    rowIndex = activeSelection.rowIndex,
    columnIndex = activeSelection.columnIndex,
    input = null
  } = {}) => {
    const targetInput = input || document.activeElement;
    const rawValue = String(getRawCellValue(rowIndex, columnIndex) || "");
    if (!targetInput || !rawValue.startsWith("=")) {
      formulaEditState = {
        mode: null,
        rowIndex,
        columnIndex,
        input: null,
        selectionStart: 0,
        selectionEnd: 0
      };
      return false;
    }
    formulaEditState = {
      mode,
      rowIndex,
      columnIndex,
      input: targetInput,
      selectionStart: targetInput.selectionStart ?? rawValue.length,
      selectionEnd: targetInput.selectionEnd ?? targetInput.selectionStart ?? rawValue.length
    };
    return true;
  };

  const formulaEditIsActive = () =>
    Boolean(
      formulaEditState.input &&
        document.activeElement === formulaEditState.input &&
        String(getRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex) || "").startsWith("=")
    );

  const updateFormulaReferenceHighlights = () => {
    table?.querySelectorAll(".is-formula-reference").forEach((node) => node.classList.remove("is-formula-reference"));
    if (!formulaEditIsActive()) {
      return;
    }
    const rawFormula = String(getRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex) || "");
    const references = [...new Set(rawFormula.match(/\$?[A-Z]+\$?\d+/gi) || [])];
    references.forEach((address) => {
      const coords = addressToCoords(address);
      if (!coords) {
        return;
      }
      table
        ?.querySelector(`[data-sheet-grid-cell="${coords.rowIndex}:${coords.columnIndex}"]`)
        ?.classList.add("is-formula-reference");
    });
  };

  const restoreFormulaEditorFocus = () => {
    if (!formulaEditIsActive()) {
      return;
    }
    const { input, selectionStart, selectionEnd } = formulaEditState;
    window.requestAnimationFrame(() => {
      input?.focus();
      if (typeof input?.setSelectionRange === "function") {
        input.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  };

  const insertCellReferenceIntoFormula = (rowIndex = 0, columnIndex = 0) => {
    if (!formulaEditIsActive()) {
      return false;
    }
    beginSpreadsheetHistoryTransaction();
    const address = `${columnLetter(columnIndex)}${rowIndex + 1}`;
    const editor = formulaEditState.input;
    const baseValue = String(getRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex) || "=");
    const currentValue = editor?.value?.startsWith("=") ? editor.value : baseValue;
    const start = editor?.selectionStart ?? formulaEditState.selectionStart ?? currentValue.length;
    const end = editor?.selectionEnd ?? formulaEditState.selectionEnd ?? start;
    const nextValue = `${currentValue.slice(0, start)}${address}${currentValue.slice(end)}`;

    setRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex, nextValue);
    formulaInput.value = nextValue;
    if (editor) {
      editor.value = nextValue;
    }

    formulaEditState.selectionStart = start + address.length;
    formulaEditState.selectionEnd = start + address.length;
    activeSelection = {
      rowIndex: formulaEditState.rowIndex,
      columnIndex: formulaEditState.columnIndex
    };
    saveCurrentSelectionState();

    scheduleCommit();
    refreshGridValues();
    restoreFormulaEditorFocus();
    return true;
  };

  const maybeHandleFormulaReferencePointer = (event, rowIndex = 0, columnIndex = 0) => {
    if (!formulaEditIsActive()) {
      return false;
    }
    if (
      formulaEditState.mode === "cell" &&
      formulaEditState.rowIndex === rowIndex &&
      formulaEditState.columnIndex === columnIndex
    ) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    return insertCellReferenceIntoFormula(rowIndex, columnIndex);
  };

  const insertFormulaInActiveCell = (name = "SUM", refreshWorkspace = true) => {
    setRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex, buildColumnFormula(name));
    commitModel(refreshWorkspace);
    refreshGridValues({ preserveActiveEditor: false });
  };

  const compareDataValues = (leftValue = "", rightValue = "", direction = "asc") => {
    const leftText = String(leftValue ?? "").trim();
    const rightText = String(rightValue ?? "").trim();
    if (!leftText && !rightText) {
      return 0;
    }
    if (!leftText) {
      return 1;
    }
    if (!rightText) {
      return -1;
    }
    const leftNumber = Number(leftText.replace(",", "."));
    const rightNumber = Number(rightText.replace(",", "."));
    let result = 0;
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      result = leftNumber - rightNumber;
    } else {
      const leftDate = Date.parse(leftText);
      const rightDate = Date.parse(rightText);
      if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
        result = leftDate - rightDate;
      } else {
        result = leftText.localeCompare(rightText, "fr", { numeric: true, sensitivity: "base" });
      }
    }
    return direction === "desc" ? -result : result;
  };

  const getDefaultDataBounds = () => {
    const lastUsedCell = getLastUsedCell();
    return {
      minRow: Math.min(1, Math.max(0, lastUsedCell.rowIndex)),
      maxRow: Math.max(1, lastUsedCell.rowIndex),
      minColumn: 0,
      maxColumn: Math.max(0, lastUsedCell.columnIndex, activeSelection.columnIndex)
    };
  };

  const getDataSelectionBounds = ({ preferTable = false, skipHeader = true } = {}) => {
    const bounds = getSelectionBounds();
    const hasRangeSelection = bounds.maxRow > bounds.minRow || bounds.maxColumn > bounds.minColumn;
    const nextBounds = preferTable && !hasRangeSelection ? getDefaultDataBounds() : { ...bounds };
    if (skipHeader && nextBounds.minRow === 0 && nextBounds.maxRow > 0) {
      nextBounds.minRow = 1;
    }
    return nextBounds;
  };

  const readDataRangeRow = (rowIndex = 0, minColumn = 0, maxColumn = 0) => ({
    values: Array.from({ length: maxColumn - minColumn + 1 }, (_, offset) =>
      getRawCellValue(rowIndex, minColumn + offset)
    ),
    formats: Array.from({ length: maxColumn - minColumn + 1 }, (_, offset) =>
      getCellFormat(rowIndex, minColumn + offset)
    )
  });

  const writeDataRangeRow = (rowIndex = 0, minColumn = 0, row = {}) => {
    (row.values || []).forEach((value, offset) => {
      setRawCellValue(rowIndex, minColumn + offset, value);
      setCellFormat(rowIndex, minColumn + offset, row.formats?.[offset] || {});
    });
  };

  const clearDataRange = (minRow = 0, maxRow = 0, minColumn = 0, maxColumn = 0) => {
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        setRawCellValue(rowIndex, columnIndex, "");
        setCellFormat(rowIndex, columnIndex, {});
      }
    }
  };

  const sortActiveColumn = (direction = "asc") => {
    const { minRow, maxRow, minColumn, maxColumn } = getDataSelectionBounds({
      preferTable: true,
      skipHeader: true
    });
    if (maxRow <= minRow || activeSelection.columnIndex < minColumn || activeSelection.columnIndex > maxColumn) {
      return false;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const sortColumnOffset = activeSelection.columnIndex - minColumn;
    const rows = Array.from({ length: maxRow - minRow + 1 }, (_, offset) => {
      const rowIndex = minRow + offset;
      return {
        originalIndex: rowIndex,
        ...readDataRangeRow(rowIndex, minColumn, maxColumn)
      };
    });
    rows.sort((leftRow, rightRow) => {
      const result = compareDataValues(leftRow.values[sortColumnOffset], rightRow.values[sortColumnOffset], direction);
      return result || leftRow.originalIndex - rightRow.originalIndex;
    });
    rows.forEach((row, offset) => {
      writeDataRangeRow(minRow + offset, minColumn, row);
    });
    getActiveSheetState().sort = { columnIndex: activeSelection.columnIndex, direction };
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const filterBySelectedValue = () => {
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.filterQuery = getRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex);
    nextActiveSheet.filterColumnIndex = activeSelection.columnIndex;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const removeDuplicateRows = () => {
    const { minRow, maxRow, minColumn, maxColumn } = getDataSelectionBounds({
      preferTable: true,
      skipHeader: true
    });
    if (maxRow <= minRow) {
      return false;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const seenRows = new Set();
    const uniqueRows = [];
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      const row = readDataRangeRow(rowIndex, minColumn, maxColumn);
      const key = row.values.map((value) => String(value ?? "").trim().toLocaleLowerCase("fr")).join("\u001f");
      if (seenRows.has(key)) {
        continue;
      }
      seenRows.add(key);
      uniqueRows.push(row);
    }
    uniqueRows.forEach((row, offset) => writeDataRangeRow(minRow + offset, minColumn, row));
    clearDataRange(minRow + uniqueRows.length, maxRow, minColumn, maxColumn);
    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      endRowIndex: Math.max(minRow, minRow + uniqueRows.length - 1),
      endColumnIndex: maxColumn
    });
    activeSelection = { rowIndex: minRow, columnIndex: minColumn };
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const transformSelectedTextCells = (transformer) => {
    if (typeof transformer !== "function") {
      return false;
    }
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        const value = getRawCellValue(rowIndex, columnIndex);
        if (String(value || "").startsWith("=")) {
          continue;
        }
        setRawCellValue(rowIndex, columnIndex, transformer(value));
      }
    }
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const trimSelectedWhitespace = () =>
    transformSelectedTextCells((value) => String(value ?? "").replace(/\u00a0/g, " ").trim());

  const cleanSelectedText = () =>
    transformSelectedTextCells((value) =>
      String(value ?? "")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+/g, " ")
        .trim()
    );

  const delimiterFromPromptValue = (value = "") => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
      return "";
    }
    if (["tab", "\\t"].includes(normalized)) {
      return "\t";
    }
    if (["space", " "].includes(normalized)) {
      return " ";
    }
    if (["comma", ","].includes(normalized)) {
      return ",";
    }
    if (["semicolon", ";"].includes(normalized)) {
      return ";";
    }
    return String(value).slice(0, 1);
  };

  const splitTextToColumns = () => {
    const delimiterInput = window.prompt("Delimiter: comma, semicolon, tab, space or custom", ",");
    if (delimiterInput === null) {
      return false;
    }
    const delimiter = delimiterFromPromptValue(delimiterInput);
    if (!delimiter) {
      return false;
    }
    const { minRow, maxRow, minColumn } = getSelectionBounds();
    const sourceColumn = minColumn;
    const splitRows = Array.from({ length: maxRow - minRow + 1 }, (_, offset) => {
      const rowIndex = minRow + offset;
      return {
        rowIndex,
        parts: String(getRawCellValue(rowIndex, sourceColumn) ?? "").split(delimiter),
        format: getCellFormat(rowIndex, sourceColumn)
      };
    });
    const maxParts = Math.max(1, ...splitRows.map((row) => row.parts.length));
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    ensureGridSize(maxRow + 1, sourceColumn + maxParts);
    splitRows.forEach(({ rowIndex, parts, format }) => {
      for (let offset = 0; offset < maxParts; offset += 1) {
        setRawCellValue(rowIndex, sourceColumn + offset, parts[offset] ?? "");
        setCellFormat(rowIndex, sourceColumn + offset, format);
      }
    });
    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: sourceColumn,
      endRowIndex: maxRow,
      endColumnIndex: sourceColumn + maxParts - 1
    });
    activeSelection = { rowIndex: minRow, columnIndex: sourceColumn };
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const transposeSelectionRange = () => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    if (minRow === maxRow && minColumn === maxColumn) {
      return false;
    }
    const height = maxRow - minRow + 1;
    const width = maxColumn - minColumn + 1;
    const matrix = Array.from({ length: height }, (_, rowOffset) =>
      Array.from({ length: width }, (_, columnOffset) => ({
        value: getRawCellValue(minRow + rowOffset, minColumn + columnOffset),
        format: getCellFormat(minRow + rowOffset, minColumn + columnOffset)
      }))
    );
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    clearDataRange(minRow, maxRow, minColumn, maxColumn);
    ensureGridSize(minRow + width, minColumn + height);
    for (let rowOffset = 0; rowOffset < width; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < height; columnOffset += 1) {
        const source = matrix[columnOffset][rowOffset];
        setRawCellValue(minRow + rowOffset, minColumn + columnOffset, source.value);
        setCellFormat(minRow + rowOffset, minColumn + columnOffset, source.format);
      }
    }
    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      endRowIndex: minRow + width - 1,
      endColumnIndex: minColumn + height - 1
    });
    activeSelection = { rowIndex: minRow, columnIndex: minColumn };
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const filterActiveColumn = () => {
    const nextQuery = window.prompt("Filter query", getActiveSheetState().filterQuery || "");
    if (nextQuery === null) {
      return;
    }
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.filterQuery = String(nextQuery || "");
    nextActiveSheet.filterColumnIndex = activeSelection.columnIndex;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const clearActiveFilter = () => {
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.filterQuery = "";
    nextActiveSheet.filterColumnIndex = -1;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const freezeRowsToSelection = () => {
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.frozenRows = activeSelection.rowIndex + 1;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const freezeColumnsToSelection = () => {
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.frozenColumns = activeSelection.columnIndex + 1;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const unfreezeSheet = () => {
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.frozenRows = 0;
    nextActiveSheet.frozenColumns = 0;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const insertRowAtSelection = (offset = 1) => {
    const insertIndex = clamp(activeSelection.rowIndex + offset, 0, sheetGrid.length);
    sheetGrid.splice(insertIndex, 0, Array.from({ length: sheetGrid[0].length }, () => ""));
    activeSelection = {
      rowIndex: insertIndex,
      columnIndex: activeSelection.columnIndex
    };
    setSelectionRange({
      startRowIndex: activeSelection.rowIndex,
      startColumnIndex: activeSelection.columnIndex,
      endRowIndex: activeSelection.rowIndex,
      endColumnIndex: activeSelection.columnIndex
    });
    commitModel(true);
    rerenderPreview();
  };

  const insertColumnAtSelection = (offset = 1) => {
    const insertIndex = clamp(activeSelection.columnIndex + offset, 0, (sheetGrid[0] || []).length);
    sheetGrid = sheetGrid.map((row) => {
      const nextRow = [...row];
      nextRow.splice(insertIndex, 0, "");
      return nextRow;
    });
    activeSelection = {
      rowIndex: activeSelection.rowIndex,
      columnIndex: insertIndex
    };
    setSelectionRange({
      startRowIndex: activeSelection.rowIndex,
      startColumnIndex: activeSelection.columnIndex,
      endRowIndex: activeSelection.rowIndex,
      endColumnIndex: activeSelection.columnIndex
    });
    commitModel(true);
    rerenderPreview();
  };

  const deleteActiveRow = () => {
    if (sheetGrid.length <= 1) {
      return;
    }
    sheetGrid.splice(activeSelection.rowIndex, 1);
    activeSelection = {
      rowIndex: Math.max(0, Math.min(activeSelection.rowIndex, sheetGrid.length - 1)),
      columnIndex: activeSelection.columnIndex
    };
    setSelectionRange({
      startRowIndex: activeSelection.rowIndex,
      startColumnIndex: activeSelection.columnIndex,
      endRowIndex: activeSelection.rowIndex,
      endColumnIndex: activeSelection.columnIndex
    });
    commitModel(true);
    rerenderPreview();
  };

  const deleteActiveColumn = () => {
    if ((sheetGrid[0] || []).length <= 1) {
      return;
    }
    sheetGrid = sheetGrid.map((row) => {
      const nextRow = [...row];
      nextRow.splice(activeSelection.columnIndex, 1);
      return nextRow;
    });
    activeSelection = {
      rowIndex: activeSelection.rowIndex,
      columnIndex: Math.max(0, Math.min(activeSelection.columnIndex, sheetGrid[0].length - 1))
    };
    setSelectionRange({
      startRowIndex: activeSelection.rowIndex,
      startColumnIndex: activeSelection.columnIndex,
      endRowIndex: activeSelection.rowIndex,
      endColumnIndex: activeSelection.columnIndex
    });
    commitModel(true);
    rerenderPreview();
  };

  const createSheetFromActive = ({ duplicate = false } = {}) => {
    persistGridIntoActiveSheet();
    const sourceSheet = getActiveSheetState();
    const nextIndex = workbookModel.sheets.length + 1;
    const nextSheet = duplicate
      ? {
          ...cloneSpreadsheetSnapshot(sourceSheet),
          id: `sheet-${Date.now()}`,
          name: `${sourceSheet.name || "Sheet"} copy`
        }
      : {
          id: `sheet-${Date.now()}`,
          name: `Sheet ${nextIndex}`,
          columns: Array.from({ length: Math.max(3, sourceSheet.columns?.length || 3) }, (_, index) => `Column ${index + 1}`),
          rows: [["", "", ""]],
          columnWidths: {},
          rowHeights: {},
          merges: [],
          cellFormats: {},
          filterQuery: "",
          filterColumnIndex: -1,
          sort: null,
          frozenRows: 0,
          frozenColumns: 0
        };
    workbookModel.sheets.push(nextSheet);
    workbookModel.activeSheetId = nextSheet.id;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const renameActiveSheet = () => {
    const activeSheetState = getActiveSheetState();
    const nextName = window.prompt("Sheet name", activeSheetState.name || "Sheet");
    if (!nextName) {
      return;
    }
    activeSheetState.name = String(nextName).trim() || activeSheetState.name;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const deleteActiveSheet = () => {
    if (workbookModel.sheets.length <= 1) {
      return;
    }
    const activeIndex = workbookModel.sheets.findIndex((sheet) => sheet.id === workbookModel.activeSheetId);
    const nextIndex = Math.max(0, activeIndex - 1);
    workbookModel.sheets.splice(Math.max(0, activeIndex), 1);
    workbookModel.activeSheetId = workbookModel.sheets[nextIndex]?.id || workbookModel.sheets[0]?.id;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const serializeCsvCell = (value = "") => {
    const text = String(value ?? "");
    return /[,"\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
  };

  const readSheetApiError = async (response) => {
    try {
      const payload = await response.clone().json();
      return payload?.error || payload?.message || response.statusText || "Request failed";
    } catch {
      const text = await response.text().catch(() => "");
      return text || response.statusText || "Request failed";
    }
  };

  const buildWorkbookDownloadName = () => {
    const baseName =
      String(workObject?.title || friendlyPathLabel(filePath) || getWorkbookActiveSheet()?.name || "hydria-sheet")
        .trim()
        .replace(/\.[^.]+$/, "")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/[^\w.-]+/g, "-") || "hydria-sheet";
    return `${baseName}.xlsx`;
  };

  const downloadBlobFile = (blob, filename = "hydria-sheet.xlsx") => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const exportWorkbookAsXlsx = async () => {
    try {
      const nextModel = persistGridIntoActiveSheet();
      workbookModel = nextModel;
      const filename = buildWorkbookDownloadName();
      const response = await fetch("/api/sheets/export-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          model: getWorkbookSnapshot(nextModel)
        })
      });
      if (!response.ok) {
        throw new Error(await readSheetApiError(response));
      }
      const blob = await response.blob();
      if (!blob.size) {
        throw new Error("The XLSX export is empty.");
      }
      downloadBlobFile(blob, filename);
    } catch (error) {
      window.alert(`XLSX export failed: ${error.message || error}`);
    }
  };

  const importWorkbookFromXlsxFile = async (file) => {
    if (!file) {
      return;
    }

    try {
      clearScheduledCommit();
      editHistorySnapshot = null;
      const beforeSnapshot = getWorkbookSnapshot(persistGridIntoActiveSheet());
      const formData = new FormData();
      formData.append("workbook", file);
      const response = await fetch("/api/sheets/import-xlsx", {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        throw new Error(await readSheetApiError(response));
      }
      const payload = await response.json();
      if (!payload?.success || !payload.model) {
        throw new Error("The server did not return a workbook.");
      }

      workbookModel = normalizeSpreadsheetPreviewModel(payload.model, {
        defaultSheetName: profile?.sheetName || "Sheet 1"
      });
      recordSpreadsheetHistory(beforeSnapshot, workbookModel);
      const activeImportedSheet = workbookModel.activeSheet || workbookModel.sheets[0];
      saveSpreadsheetSelectionState(
        historyKey,
        {
          activeSelection: { rowIndex: 0, columnIndex: 0 },
          selectionRange: {
            startRowIndex: 0,
            startColumnIndex: 0,
            endRowIndex: 0,
            endColumnIndex: 0
          }
        },
        Math.max(1, (activeImportedSheet?.rows?.length || 0) + 1),
        Math.max(1, activeImportedSheet?.columns?.length || 1)
      );

      suppressRerenderBlurCommit = true;
      try {
        container.innerHTML = "";
        renderSpreadsheetClonePreview(container, {
          model: cloneSpreadsheetSnapshot(workbookModel),
          profile,
          workObject,
          filePath,
          onGridEdit
        });
        onGridEdit?.(workbookModel, { refreshWorkspace: false });
      } finally {
        suppressRerenderBlurCommit = false;
      }
    } catch (error) {
      window.alert(`XLSX import failed: ${error.message || error}`);
    }
  };

  const openXlsxImportDialog = () => {
    xlsxImportInput.value = "";
    xlsxImportInput.click();
  };

  xlsxImportInput.addEventListener("change", () => {
    const [file] = Array.from(xlsxImportInput.files || []);
    xlsxImportInput.value = "";
    importWorkbookFromXlsxFile(file);
  });

  const downloadActiveSheetCsv = () => {
    const nextModel = persistGridIntoActiveSheet();
    const activeSheetState = getWorkbookActiveSheet();
    workbookModel = nextModel;
    const rows = [activeSheetState.columns, ...(activeSheetState.rows || [])];
    const csv = rows.map((row) => row.map(serializeCsvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    const safeName = String(activeSheetState.name || "sheet").trim().replace(/[^\w.-]+/g, "-") || "sheet";
    link.href = URL.createObjectURL(blob);
    link.download = `${safeName}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const recalculateSheet = () => {
    persistGridIntoActiveSheet();
    refreshGridValues({ preserveActiveEditor: false });
  };

  const showSheetStatus = () => {
    const activeSheetState = getActiveSheetState();
    window.alert(`${activeSheetState.name || "Sheet"}\n${activeSheetState.rows.length + 1} rows\n${activeSheetState.columns.length} columns`);
  };

  let sheetMenuOutsidePointerHandler = null;

  const closeSheetMenu = () => {
    sheetMenuPanel.hidden = true;
    sheetMenuPanel.innerHTML = "";
    sheetMenuButtons.forEach((button) => button.classList.remove("is-open"));
    if (sheetMenuOutsidePointerHandler) {
      document.removeEventListener("mousedown", sheetMenuOutsidePointerHandler);
      sheetMenuOutsidePointerHandler = null;
    }
  };

  const makeSheetMenuItems = (menuId = "") => {
    const oneSheetOnly = workbookModel.sheets.length <= 1;
    switch (menuId) {
      case "File":
        return [
          { label: "New sheet", onSelect: () => createSheetFromActive() },
          { label: "Duplicate sheet", onSelect: () => createSheetFromActive({ duplicate: true }) },
          { label: "Rename sheet", onSelect: renameActiveSheet },
          { label: "Delete sheet", onSelect: deleteActiveSheet, disabled: oneSheetOnly },
          { separator: true },
          { label: "Import XLSX", onSelect: openXlsxImportDialog },
          { label: "Export XLSX", onSelect: exportWorkbookAsXlsx },
          { label: "Download CSV", onSelect: downloadActiveSheetCsv }
        ];
      case "Edit":
        return [
          { label: "Undo", onSelect: undoSpreadsheetAction },
          { label: "Redo", onSelect: redoSpreadsheetAction },
          { separator: true },
          { label: "Cut", onSelect: () => cutSelectedCells() },
          { label: "Copy", onSelect: () => copySelectedCells() },
          { label: "Paste", onSelect: () => pasteFromClipboard() },
          { separator: true },
          { label: "Clear contents", onSelect: clearSelectedCells },
          { label: "Fill down", onSelect: () => fillSelectionFromEdge("down") },
          { label: "Fill right", onSelect: () => fillSelectionFromEdge("right") }
        ];
      case "View":
        return [
          { label: "Freeze to current row", onSelect: freezeRowsToSelection },
          { label: "Freeze to current column", onSelect: freezeColumnsToSelection },
          { label: "Unfreeze", onSelect: unfreezeSheet },
          { separator: true },
          { label: "Go to A1", onSelect: () => focusKeyboardSelection(0, 0) },
          {
            label: "Go to last cell",
            onSelect: () => {
              const lastUsedCell = getLastUsedCell();
              focusKeyboardSelection(lastUsedCell.rowIndex, lastUsedCell.columnIndex);
            }
          }
        ];
      case "Insert":
        return [
          { label: "Row above", onSelect: () => insertRowAtSelection(0) },
          { label: "Row below", onSelect: () => insertRowAtSelection(1) },
          { label: "Column left", onSelect: () => insertColumnAtSelection(0) },
          { label: "Column right", onSelect: () => insertColumnAtSelection(1) },
          { separator: true },
          { label: "New sheet", onSelect: () => createSheetFromActive() }
        ];
      case "Format":
        return [
          { label: "Bold", onSelect: () => toggleSelectedTextStyle("bold") },
          { label: "Italic", onSelect: () => toggleSelectedTextStyle("italic") },
          { label: "Underline", onSelect: () => toggleSelectedTextStyle("underline") },
          { separator: true },
          { label: "Number", onSelect: () => setSelectedRangeFormat("number") },
          { label: "Currency", onSelect: () => setSelectedRangeFormat("currency") },
          { label: "Percent", onSelect: () => setSelectedRangeFormat("percent") },
          { label: "Date", onSelect: () => setSelectedRangeFormat("date") },
          { label: "Clear number format", onSelect: () => setSelectedRangeFormat("") },
          { separator: true },
          { label: "Align left", onSelect: () => setSelectedHorizontalAlign("left") },
          { label: "Align center", onSelect: () => setSelectedHorizontalAlign("center") },
          { label: "Align right", onSelect: () => setSelectedHorizontalAlign("right") },
          { label: "Align top", onSelect: () => setSelectedVerticalAlign("top") },
          { label: "Align middle", onSelect: () => setSelectedVerticalAlign("middle") },
          { label: "Align bottom", onSelect: () => setSelectedVerticalAlign("bottom") },
          { separator: true },
          { label: "Font size +", onSelect: () => adjustSelectedFontSize(1) },
          { label: "Font size -", onSelect: () => adjustSelectedFontSize(-1) },
          { label: "Text black", onSelect: () => setSelectedTextColor("#202124") },
          { label: "Text red", onSelect: () => setSelectedTextColor("#c5221f") },
          { label: "Text blue", onSelect: () => setSelectedTextColor("#1a73e8") },
          { label: "Fill yellow", onSelect: () => setSelectedFillColor("#fff2cc") },
          { label: "Fill green", onSelect: () => setSelectedFillColor("#d9ead3") },
          { label: "Fill blue", onSelect: () => setSelectedFillColor("#d9eaf7") },
          { separator: true },
          { label: "All borders", onSelect: () => setSelectedBorder("all") },
          { label: "Outer border", onSelect: () => setSelectedBorder("outer") },
          { label: "Bottom border", onSelect: () => setSelectedBorder("bottom") },
          { label: "Clear borders", onSelect: () => setSelectedBorder("clear") },
          { separator: true },
          { label: "Merge cells", onSelect: mergeSelectionRange },
          { label: "Unmerge cells", onSelect: unmergeSelectionRange },
          { separator: true },
          { label: "Clear all formatting", onSelect: clearSelectedFormatting }
        ];
      case "Data":
        return [
          { label: "Sort A-Z", onSelect: () => sortActiveColumn("asc") },
          { label: "Sort Z-A", onSelect: () => sortActiveColumn("desc") },
          { separator: true },
          { label: "Create filter", onSelect: filterActiveColumn },
          { label: "Filter by selected value", onSelect: filterBySelectedValue },
          { label: "Clear filter", onSelect: clearActiveFilter },
          { separator: true },
          { label: "Remove duplicates", onSelect: removeDuplicateRows },
          { label: "Trim whitespace", onSelect: trimSelectedWhitespace },
          { label: "Clean text", onSelect: cleanSelectedText },
          { label: "Text to columns", onSelect: splitTextToColumns },
          { label: "Transpose range", onSelect: transposeSelectionRange }
        ];
      case "Tools":
        return [
          { label: "SUM", onSelect: () => insertFormulaInActiveCell("SUM") },
          { label: "AVERAGE", onSelect: () => insertFormulaInActiveCell("AVERAGE") },
          { label: "MIN", onSelect: () => insertFormulaInActiveCell("MIN") },
          { label: "MAX", onSelect: () => insertFormulaInActiveCell("MAX") },
          { label: "COUNT", onSelect: () => insertFormulaInActiveCell("COUNT") },
          { separator: true },
          { label: "Recalculate formulas", onSelect: recalculateSheet }
        ];
      case "Extensions":
        return [
          { label: "Recalculate formulas", onSelect: recalculateSheet },
          {
            label: "Clear clipboard outline",
            onSelect: () => {
              setStoredClipboardPayload(null);
              syncSelectionUi();
            }
          }
        ];
      case "Help":
        return [
          { label: "Sheet status", onSelect: showSheetStatus },
          { label: "Select used range", onSelect: selectUsedRange }
        ];
      default:
        return [];
    }
  };

  const openSheetMenu = (menuId = "", button = null) => {
    const items = makeSheetMenuItems(menuId);
    if (!button || !items.length) {
      closeSheetMenu();
      return;
    }
    sheetMenuPanel.innerHTML = "";
    sheetMenuButtons.forEach((entry) => entry.classList.toggle("is-open", entry === button));
    items.forEach((item) => {
      if (item.separator) {
        const separator = document.createElement("div");
        separator.className = "workspace-sheet-menu-separator";
        sheetMenuPanel.appendChild(separator);
        return;
      }
      const action = document.createElement("button");
      action.type = "button";
      action.className = "workspace-sheet-menu-action";
      action.textContent = item.label;
      action.disabled = Boolean(item.disabled);
      action.addEventListener("click", () => {
        if (item.disabled) {
          return;
        }
        closeSheetMenu();
        item.onSelect?.();
      });
      sheetMenuPanel.appendChild(action);
    });
    const shellRect = previewShell.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    sheetMenuPanel.hidden = false;
    sheetMenuPanel.style.left = `${buttonRect.left - shellRect.left}px`;
    sheetMenuPanel.style.top = `${buttonRect.bottom - shellRect.top + 4}px`;
    if (sheetMenuOutsidePointerHandler) {
      document.removeEventListener("mousedown", sheetMenuOutsidePointerHandler);
    }
    sheetMenuOutsidePointerHandler = (event) => {
      if (!sheetMenuPanel.contains(event.target) && !button.contains(event.target)) {
        closeSheetMenu();
      }
    };
    window.setTimeout(() => {
      if (sheetMenuOutsidePointerHandler) {
        document.addEventListener("mousedown", sheetMenuOutsidePointerHandler);
      }
    }, 0);
  };

  sheetMenuButtons.forEach((button, menuId) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!sheetMenuPanel.hidden && button.classList.contains("is-open")) {
        closeSheetMenu();
        return;
      }
      openSheetMenu(menuId, button);
    });
  });

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-sheet-toolbar";
  const toolbarGroupEdit = document.createElement("div");
  toolbarGroupEdit.className = "workspace-sheet-toolbar-group";
  const toolbarGroupFormat = document.createElement("div");
  toolbarGroupFormat.className = "workspace-sheet-toolbar-group";
  const toolbarGroupData = document.createElement("div");
  toolbarGroupData.className = "workspace-sheet-toolbar-group";
  const toolbarGroupStructure = document.createElement("div");
  toolbarGroupStructure.className = "workspace-sheet-toolbar-group";
  const makeToolbarButton = (label, onClick, accent = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-sheet-toolbar-button${accent ? " accent" : ""}`;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  };
  const makeToolbarSelect = (label = "", options = [], onChange = null) => {
    const select = document.createElement("select");
    select.className = "workspace-sheet-toolbar-select";
    select.title = label;
    options.forEach((option) => {
      const entry = document.createElement("option");
      entry.value = option.value;
      entry.textContent = option.label;
      select.appendChild(entry);
    });
    select.addEventListener("change", () => {
      onChange?.(select.value);
      select.selectedIndex = 0;
    });
    return select;
  };
  const makeToolbarColorInput = (label = "", initialValue = "#ffffff", onChange = null) => {
    const input = document.createElement("input");
    input.type = "color";
    input.className = "workspace-sheet-toolbar-color";
    input.title = label;
    input.value = normalizeSpreadsheetColor(initialValue) || "#ffffff";
    input.addEventListener("change", () => {
      onChange?.(input.value);
    });
    return input;
  };
  toolbarGroupEdit.append(
    makeToolbarButton("Undo", undoSpreadsheetAction),
    makeToolbarButton("Redo", redoSpreadsheetAction),
    makeToolbarButton("Cut", () => cutSelectedCells()),
    makeToolbarButton("Copy", () => copySelectedCells()),
    makeToolbarButton("Paste", () => {
      pasteFromClipboard();
    }),
    makeToolbarButton("SUM", () => insertFormulaInActiveCell("SUM"), true),
    makeToolbarButton("AVG", () => insertFormulaInActiveCell("AVERAGE")),
    makeToolbarButton("MIN", () => insertFormulaInActiveCell("MIN")),
    makeToolbarButton("MAX", () => insertFormulaInActiveCell("MAX")),
    makeToolbarButton("COUNT", () => insertFormulaInActiveCell("COUNT"))
  );
  toolbarGroupFormat.append(
    makeToolbarButton("B", () => toggleSelectedTextStyle("bold")),
    makeToolbarButton("I", () => toggleSelectedTextStyle("italic")),
    makeToolbarButton("U", () => toggleSelectedTextStyle("underline")),
    makeToolbarButton("L", () => setSelectedHorizontalAlign("left")),
    makeToolbarButton("C", () => setSelectedHorizontalAlign("center")),
    makeToolbarButton("R", () => setSelectedHorizontalAlign("right")),
    makeToolbarSelect(
      "Font size",
      [
        { value: "", label: "11" },
        { value: "9", label: "9" },
        { value: "10", label: "10" },
        { value: "11", label: "11" },
        { value: "12", label: "12" },
        { value: "14", label: "14" },
        { value: "16", label: "16" },
        { value: "18", label: "18" },
        { value: "24", label: "24" }
      ],
      (value) => value && setSelectedFontSize(Number(value))
    ),
    makeToolbarColorInput("Text color", "#202124", setSelectedTextColor),
    makeToolbarColorInput("Fill color", "#fff2cc", setSelectedFillColor),
    makeToolbarButton("Border", () => setSelectedBorder("all")),
    makeToolbarButton("123", () => setSelectedRangeFormat("number")),
    makeToolbarButton("EUR", () => setSelectedRangeFormat("currency")),
    makeToolbarButton("%", () => setSelectedRangeFormat("percent")),
    makeToolbarButton("Date", () => setSelectedRangeFormat("date")),
    makeToolbarButton("Clear", clearSelectedFormatting)
  );
  toolbarGroupData.append(
    makeToolbarButton("Sort A-Z", () => sortActiveColumn("asc")),
    makeToolbarButton("Sort Z-A", () => sortActiveColumn("desc")),
    makeToolbarButton("Filter", filterActiveColumn),
    makeToolbarButton("Filter value", filterBySelectedValue),
    makeToolbarButton("Clear filter", clearActiveFilter),
    makeToolbarButton("Dedupe", removeDuplicateRows),
    makeToolbarButton("Trim", trimSelectedWhitespace),
    makeToolbarButton("Split", splitTextToColumns),
    makeToolbarButton("Transpose", transposeSelectionRange),
    makeToolbarButton("Freeze row", freezeRowsToSelection),
    makeToolbarButton("Freeze col", freezeColumnsToSelection),
    makeToolbarButton("Unfreeze", unfreezeSheet)
  );
  toolbarGroupStructure.append(
    makeToolbarButton("Insert row", () => insertRowAtSelection(1)),
    makeToolbarButton("Insert column", () => insertColumnAtSelection(1)),
    makeToolbarButton("Delete row", deleteActiveRow),
    makeToolbarButton("Delete column", deleteActiveColumn),
    makeToolbarButton("Merge", mergeSelectionRange),
    makeToolbarButton("Unmerge", unmergeSelectionRange)
  );
  toolbar.append(toolbarGroupEdit, toolbarGroupFormat, toolbarGroupData, toolbarGroupStructure);
  previewShell.appendChild(toolbar);

  const formulaBar = document.createElement("div");
  formulaBar.className = "workspace-formula-bar workspace-formula-bar-live";
  const nameBox = document.createElement("input");
  nameBox.type = "text";
  nameBox.className = "workspace-sheet-name-box";
  nameBox.readOnly = true;
  const formulaLabel = document.createElement("span");
  formulaLabel.className = "tiny";
  formulaLabel.textContent = "fx";
  const formulaInput = document.createElement("input");
  formulaInput.type = "text";
  formulaInput.className = "workspace-sheet-formula-input";
  formulaBar.append(nameBox, formulaLabel, formulaInput);
  previewShell.appendChild(formulaBar);

  const gridShell = document.createElement("div");
  gridShell.className = "workspace-sheet-grid-shell";
  const table = document.createElement("table");
  table.className = "workspace-sheet-grid-table";
  const fillHandle = document.createElement("button");
  fillHandle.type = "button";
  fillHandle.className = "workspace-sheet-fill-handle";
  fillHandle.setAttribute("aria-label", "Fill selection");
  fillHandle.textContent = "";
  const clipboardOutline = document.createElement("div");
  clipboardOutline.className = "workspace-sheet-clipboard-outline";
  clipboardOutline.setAttribute("aria-hidden", "true");
  const contextMenu = document.createElement("div");
  contextMenu.className = "workspace-sheet-context-menu";
  contextMenu.hidden = true;
  gridShell.append(table, clipboardOutline, fillHandle, contextMenu);

  const closeContextMenu = () => {
    contextMenu.hidden = true;
    contextMenu.innerHTML = "";
  };

  const openContextMenu = (clientX = 0, clientY = 0, items = []) => {
    contextMenu.innerHTML = "";
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-sheet-context-action";
      button.textContent = item.label;
      button.addEventListener("click", () => {
        closeContextMenu();
        item.onSelect?.();
      });
      contextMenu.appendChild(button);
    });
    contextMenu.hidden = false;
    const shellRect = gridShell.getBoundingClientRect();
    contextMenu.style.left = `${clientX - shellRect.left + gridShell.scrollLeft}px`;
    contextMenu.style.top = `${clientY - shellRect.top + gridShell.scrollTop}px`;
    window.setTimeout(() => {
      const handleOutsidePointer = (event) => {
        if (!contextMenu.contains(event.target)) {
          closeContextMenu();
        }
      };
      document.addEventListener("mousedown", handleOutsidePointer, { once: true });
    }, 0);
  };

  const focusSelection = (
    rowIndex = 0,
    columnIndex = 0,
    { suppressFormulaEdit = false, preserveRange = false } = {}
  ) => {
    cellTextEditState = { active: false, rowIndex: -1, columnIndex: -1 };
    activeSelection = {
      rowIndex: Math.max(0, Math.min(rowIndex, sheetGrid.length - 1)),
      columnIndex: Math.max(0, Math.min(columnIndex, sheetGrid[0].length - 1))
    };
    if (!preserveRange) {
      selectionRange = {
        startRowIndex: activeSelection.rowIndex,
        startColumnIndex: activeSelection.columnIndex,
        endRowIndex: activeSelection.rowIndex,
        endColumnIndex: activeSelection.columnIndex
      };
    }
    saveCurrentSelectionState();
    suppressFormulaActivation = suppressFormulaEdit;
    syncSelectionUi();
    const target = table.querySelector(`[data-sheet-grid-cell="${activeSelection.rowIndex}:${activeSelection.columnIndex}"]`);
    preserveRangeOnNextFocus = preserveRange;
    target?.focus();
  };

  const moveSelection = (rowDelta = 0, columnDelta = 0) => {
    focusSelection(activeSelection.rowIndex + rowDelta, activeSelection.columnIndex + columnDelta, {
      suppressFormulaEdit: true
    });
  };

  const getCellInput = (rowIndex = activeSelection.rowIndex, columnIndex = activeSelection.columnIndex) =>
    table.querySelector(`[data-sheet-grid-cell="${rowIndex}:${columnIndex}"]`);

  const focusKeyboardSelection = (rowIndex = activeSelection.rowIndex, columnIndex = activeSelection.columnIndex) => {
    focusSelection(rowIndex, columnIndex, { suppressFormulaEdit: true });
  };

  const extendKeyboardSelection = (rowIndex = activeSelection.rowIndex, columnIndex = activeSelection.columnIndex) => {
    const nextRowIndex = clamp(rowIndex, 0, sheetGrid.length - 1);
    const nextColumnIndex = clamp(columnIndex, 0, (sheetGrid[0] || []).length - 1);
    activeSelection = { rowIndex: nextRowIndex, columnIndex: nextColumnIndex };
    setSelectionRange({
      startRowIndex: selectionRange.startRowIndex,
      startColumnIndex: selectionRange.startColumnIndex,
      endRowIndex: nextRowIndex,
      endColumnIndex: nextColumnIndex
    });
    preserveRangeOnNextFocus = true;
    suppressFormulaActivation = true;
    syncSelectionUi();
    getCellInput(nextRowIndex, nextColumnIndex)?.focus();
  };

  const moveKeyboardSelection = (rowIndex = activeSelection.rowIndex, columnIndex = activeSelection.columnIndex, { extend = false } = {}) => {
    if (extend) {
      extendKeyboardSelection(rowIndex, columnIndex);
      return;
    }
    focusKeyboardSelection(rowIndex, columnIndex);
  };

  const findDataBoundary = (rowDelta = 0, columnDelta = 0) => {
    const rowLimit = rowDelta > 0 ? sheetGrid.length - 1 : 0;
    const columnLimit = columnDelta > 0 ? (sheetGrid[0] || []).length - 1 : 0;
    const isFilled = (rowIndex, columnIndex) => String(getRawCellValue(rowIndex, columnIndex) || "").trim().length > 0;

    if (rowDelta) {
      let rowIndex = activeSelection.rowIndex;
      const columnIndex = activeSelection.columnIndex;
      const startsFilled = isFilled(rowIndex, columnIndex);
      while (rowIndex !== rowLimit) {
        const nextRowIndex = rowIndex + rowDelta;
        const nextFilled = isFilled(nextRowIndex, columnIndex);
        if (startsFilled && !nextFilled) {
          return { rowIndex, columnIndex };
        }
        if (!startsFilled && nextFilled) {
          return { rowIndex: nextRowIndex, columnIndex };
        }
        rowIndex = nextRowIndex;
      }
      return { rowIndex: rowLimit, columnIndex };
    }

    let columnIndex = activeSelection.columnIndex;
    const rowIndex = activeSelection.rowIndex;
    const startsFilled = isFilled(rowIndex, columnIndex);
    while (columnIndex !== columnLimit) {
      const nextColumnIndex = columnIndex + columnDelta;
      const nextFilled = isFilled(rowIndex, nextColumnIndex);
      if (startsFilled && !nextFilled) {
        return { rowIndex, columnIndex };
      }
      if (!startsFilled && nextFilled) {
        return { rowIndex, columnIndex: nextColumnIndex };
      }
      columnIndex = nextColumnIndex;
    }
    return { rowIndex, columnIndex: columnLimit };
  };

  const selectUsedRange = () => {
    const lastUsedCell = getLastUsedCell();
    activeSelection = { rowIndex: 0, columnIndex: 0 };
    setSelectionRange({
      startRowIndex: 0,
      startColumnIndex: 0,
      endRowIndex: lastUsedCell.rowIndex,
      endColumnIndex: lastUsedCell.columnIndex
    });
    preserveRangeOnNextFocus = true;
    suppressFormulaActivation = true;
    syncSelectionUi();
    getCellInput(0, 0)?.focus();
  };

  const selectAllVisibleCells = () => {
    activeSelection = { rowIndex: 0, columnIndex: 0 };
    setSelectionRange({
      startRowIndex: 0,
      startColumnIndex: 0,
      endRowIndex: sheetGrid.length - 1,
      endColumnIndex: (sheetGrid[0] || []).length - 1
    });
    preserveRangeOnNextFocus = true;
    suppressFormulaActivation = true;
    syncSelectionUi();
    getCellInput(0, 0)?.focus();
  };

  const selectActiveColumn = () => {
    setSelectionRange({
      startRowIndex: 0,
      startColumnIndex: activeSelection.columnIndex,
      endRowIndex: sheetGrid.length - 1,
      endColumnIndex: activeSelection.columnIndex
    });
    preserveRangeOnNextFocus = true;
    suppressFormulaActivation = true;
    syncSelectionUi();
    getCellInput(activeSelection.rowIndex, activeSelection.columnIndex)?.focus();
  };

  const selectActiveRow = () => {
    setSelectionRange({
      startRowIndex: activeSelection.rowIndex,
      startColumnIndex: 0,
      endRowIndex: activeSelection.rowIndex,
      endColumnIndex: (sheetGrid[0] || []).length - 1
    });
    preserveRangeOnNextFocus = true;
    suppressFormulaActivation = true;
    syncSelectionUi();
    getCellInput(activeSelection.rowIndex, activeSelection.columnIndex)?.focus();
  };

  const beginCellTextEdit = ({ initialValue = null, selectAll = false } = {}) => {
    const input = getCellInput();
    if (!input) {
      return false;
    }
    clearScheduledCommit();
    setStoredClipboardPayload(null);
    beginSpreadsheetHistoryTransaction();
    cellTextEditState = {
      active: true,
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex
    };
    const nextValue = initialValue === null ? getRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex) : initialValue;
    setRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex, nextValue);
    input.focus();
    input.value = nextValue;
    formulaInput.value = nextValue;
    syncFormulaEditorState({
      mode: "cell",
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex,
      input
    });
    if (typeof input.setSelectionRange === "function") {
      if (selectAll) {
        input.setSelectionRange(0, input.value.length);
      } else {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
    if (initialValue !== null) {
      scheduleCommit();
    }
    return true;
  };

  const commitActiveCellTextEdit = () => {
    if (!cellTextEditState.active) {
      return false;
    }
    clearScheduledCommit();
    const input = getCellInput(cellTextEditState.rowIndex, cellTextEditState.columnIndex);
    if (input) {
      setRawCellValue(cellTextEditState.rowIndex, cellTextEditState.columnIndex, input.value);
    }
    cellTextEditState = { active: false, rowIndex: -1, columnIndex: -1 };
    commitModel(false, { beforeSnapshot: editHistorySnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const cancelActiveCellTextEdit = () => {
    if (!cellTextEditState.active) {
      return false;
    }
    clearScheduledCommit();
    const snapshot = editHistorySnapshot ? cloneSpreadsheetSnapshot(editHistorySnapshot) : null;
    cellTextEditState = { active: false, rowIndex: -1, columnIndex: -1 };
    if (snapshot) {
      applySpreadsheetHistorySnapshot(snapshot);
    } else {
      refreshGridValues({ preserveActiveEditor: false });
    }
    return true;
  };

  const fillSelectionFromEdge = (direction = "down") => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const vertical = direction === "down";
    if ((vertical && maxRow <= minRow) || (!vertical && maxColumn <= minColumn)) {
      return false;
    }
    clearScheduledCommit();
    setStoredClipboardPayload(null);
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        if ((vertical && rowIndex === minRow) || (!vertical && columnIndex === minColumn)) {
          continue;
        }
        const sourceRowIndex = vertical ? minRow : rowIndex;
        const sourceColumnIndex = vertical ? columnIndex : minColumn;
        const sourceValue = getRawCellValue(sourceRowIndex, sourceColumnIndex);
        const nextValue = sourceValue.startsWith("=")
          ? shiftFormulaReferences(sourceValue, rowIndex - sourceRowIndex, columnIndex - sourceColumnIndex)
          : sourceValue;
        setRawCellValue(rowIndex, columnIndex, nextValue);
        setCellFormat(rowIndex, columnIndex, getCellFormat(sourceRowIndex, sourceColumnIndex));
      }
    }
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const syncClipboardOutlineUi = () => {
    const payload = getStoredClipboardPayload();
    const source = payload?.source;
    if (
      !source ||
      payload.kind !== "hydria-sheet-clipboard" ||
      source.sheetId !== workbookModel.activeSheetId ||
      source.rowCount <= 0 ||
      source.columnCount <= 0
    ) {
      clipboardOutline.hidden = true;
      return;
    }

    const startCell = table.querySelector(`[data-sheet-grid-cell="${source.minRow}:${source.minColumn}"]`);
    const endCell = table.querySelector(
      `[data-sheet-grid-cell="${source.minRow + source.rowCount - 1}:${source.minColumn + source.columnCount - 1}"]`
    );
    if (!startCell || !endCell) {
      clipboardOutline.hidden = true;
      return;
    }

    const startRect = startCell.getBoundingClientRect();
    const endRect = endCell.getBoundingClientRect();
    const shellRect = gridShell.getBoundingClientRect();
    const left = Math.min(startRect.left, endRect.left) - shellRect.left + gridShell.scrollLeft - 1;
    const top = Math.min(startRect.top, endRect.top) - shellRect.top + gridShell.scrollTop - 1;
    const width = Math.abs(endRect.right - startRect.left) + 2;
    const height = Math.abs(endRect.bottom - startRect.top) + 2;

    clipboardOutline.hidden = false;
    clipboardOutline.className = `workspace-sheet-clipboard-outline${payload.mode === "cut" ? " is-cut" : ""}`;
    clipboardOutline.style.left = `${left}px`;
    clipboardOutline.style.top = `${top}px`;
    clipboardOutline.style.width = `${Math.max(8, width)}px`;
    clipboardOutline.style.height = `${Math.max(8, height)}px`;
  };

  const syncSelectionUi = () => {
    saveCurrentSelectionState();
    nameBox.value = `${columnLetter(activeSelection.columnIndex)}${activeSelection.rowIndex + 1}`;
    const rawValue = getRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex);
    if (document.activeElement !== formulaInput || formulaInput.value !== rawValue) {
      formulaInput.value = rawValue;
    }
    table.querySelectorAll(".is-selected, .is-range-selected").forEach((node) => {
      node.classList.remove("is-selected");
      node.classList.remove("is-range-selected");
    });
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    forEachSelectedCell((rowIndex, columnIndex) => {
      table
        .querySelector(`[data-sheet-grid-cell="${rowIndex}:${columnIndex}"]`)
        ?.classList.add("is-range-selected");
    });
    const target = table.querySelector(
      `[data-sheet-grid-cell="${activeSelection.rowIndex}:${activeSelection.columnIndex}"]`
    );
    target?.classList.add("is-selected");

    table.querySelectorAll(".workspace-sheet-column-letter.is-selected").forEach((node) => node.classList.remove("is-selected"));
    table
      .querySelector(`[data-sheet-column-letter="${activeSelection.columnIndex}"]`)
      ?.classList.add("is-selected");

    table.querySelectorAll(".workspace-sheet-row-label.is-selected").forEach((node) => node.classList.remove("is-selected"));
    table
      .querySelector(`[data-sheet-row-label="${activeSelection.rowIndex}"]`)
      ?.classList.add("is-selected");
    syncClipboardOutlineUi();
    updateFormulaReferenceHighlights();
    const rangeTarget = table.querySelector(`[data-sheet-grid-cell="${maxRow}:${maxColumn}"]`);
    const targetRect = rangeTarget?.getBoundingClientRect();
    const shellRect = gridShell.getBoundingClientRect();
    if (targetRect && shellRect) {
      fillHandle.style.display = "block";
      fillHandle.style.left = `${targetRect.right - shellRect.left - 5}px`;
      fillHandle.style.top = `${targetRect.bottom - shellRect.top - 5}px`;
    } else {
      fillHandle.style.display = "none";
    }
  };

  const refreshGridValues = ({ preserveActiveEditor = true } = {}) => {
    table.querySelectorAll("[data-sheet-grid-cell]").forEach((input) => {
      const rowIndex = Number(input.dataset.rowIndex || 0);
      const columnIndex = Number(input.dataset.columnIndex || 0);
      if (
        preserveActiveEditor &&
        rowIndex === activeSelection.rowIndex &&
        columnIndex === activeSelection.columnIndex &&
        document.activeElement === input
      ) {
        return;
      }
      const rawValue = getRawCellValue(rowIndex, columnIndex);
      const computedValue = rawValue.startsWith("=") ? evaluateCellValue(rowIndex, columnIndex) : rawValue;
      const displayValue = formatCellDisplayValue(
        rawValue.startsWith("=") ? formatFormulaResult(computedValue) : rawValue,
        rowIndex,
        columnIndex
      );
      input.value = displayValue;
      const wrapper = input.closest("td");
      if (wrapper) {
        applyCellVisualFormat(input, wrapper, rowIndex, columnIndex);
      }
    });
    applyFilterVisibility();
    applyFreezeState();
    syncSelectionUi();
  };

  const applyFilterVisibility = () => {
    const currentSheet = getActiveSheetState();
    const query = String(currentSheet.filterQuery || "").trim().toLowerCase();
    const filterColumnIndex = Number(currentSheet.filterColumnIndex ?? -1);
    tbody.querySelectorAll("tr").forEach((row) => {
      const rowIndex = Number(row.dataset.sheetBodyRow || 0);
      if (rowIndex === 0) {
        row.style.display = "";
        return;
      }
      if (!query) {
        row.style.display = "";
        return;
      }
      const cells = Array.from({ length: sheetGrid[0].length }, (_, columnIndex) => getRawCellValue(rowIndex, columnIndex));
      const haystack =
        filterColumnIndex >= 0 && filterColumnIndex < cells.length
          ? String(cells[filterColumnIndex] || "")
          : cells.join(" ");
      row.style.display = haystack.toLowerCase().includes(query) ? "" : "none";
    });
  };

  const applyFreezeState = () => {
    const currentSheet = getActiveSheetState();
    const frozenRows = Math.max(0, Number(currentSheet.frozenRows || 0));
    const frozenColumns = Math.max(0, Number(currentSheet.frozenColumns || 0));
    const headerHeight = table.querySelector("thead tr")?.offsetHeight || 0;
    const firstColumnWidth = table.querySelector("thead th:first-child")?.offsetWidth || 52;
    const headerCells = Array.from(table.querySelectorAll("thead th"));

    headerCells.forEach((cell, index) => {
      cell.style.left = "";
      if (index > 0) {
        const width = getColumnWidth(index - 1);
        cell.style.minWidth = `${width}px`;
        cell.style.width = `${width}px`;
      }
      if (index === 0) {
        cell.style.left = "0px";
        return;
      }
      if (index <= frozenColumns) {
        let leftOffset = firstColumnWidth;
        for (let currentIndex = 1; currentIndex < index; currentIndex += 1) {
          leftOffset += headerCells[currentIndex]?.offsetWidth || 132;
        }
        cell.style.position = "sticky";
        cell.style.left = `${leftOffset}px`;
        cell.style.zIndex = "6";
      }
    });

    tbody.querySelectorAll("tr").forEach((row, rowIndex) => {
      const bodyCells = Array.from(row.children);
      row.style.height = `${getRowHeight(rowIndex)}px`;
      bodyCells.forEach((cell, columnIndex) => {
        const isRowLabel = columnIndex === 0;
        cell.style.position = "";
        cell.style.top = "";
        cell.style.left = "";
        cell.style.zIndex = "";
        if (columnIndex > 0) {
          const width = getColumnWidth(columnIndex - 1);
          cell.style.minWidth = `${width}px`;
          cell.style.width = `${width}px`;
        }

        if (rowIndex < frozenRows) {
          cell.style.position = "sticky";
          cell.style.top = `${headerHeight + rowIndex * (row.offsetHeight || 35)}px`;
          cell.style.zIndex = isRowLabel ? "7" : "6";
          cell.style.background = "#ffffff";
        }

        if (columnIndex > 0 && columnIndex <= frozenColumns) {
          let leftOffset = firstColumnWidth;
          for (let index = 1; index < columnIndex; index += 1) {
            leftOffset += bodyCells[index]?.offsetWidth || 132;
          }
          cell.style.position = "sticky";
          cell.style.left = `${leftOffset}px`;
          cell.style.zIndex = rowIndex < frozenRows ? "8" : "5";
          cell.style.background = "#ffffff";
        }

        if (isRowLabel) {
          cell.style.position = "sticky";
          cell.style.left = "0px";
          cell.style.zIndex = rowIndex < frozenRows ? "9" : "4";
          cell.style.background = "#f8f9fa";
        }
      });
    });
  };

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "workspace-sheet-corner";
  corner.textContent = "";
  headerRow.appendChild(corner);
  sheetGrid[0].forEach((_, columnIndex) => {
    const th = document.createElement("th");
    th.className = "workspace-sheet-column-letter";
    th.dataset.sheetColumnLetter = String(columnIndex);
    th.textContent = columnLetter(columnIndex);
    th.style.minWidth = `${getColumnWidth(columnIndex)}px`;
    th.style.width = `${getColumnWidth(columnIndex)}px`;
    th.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      setSelectionRange({
        startRowIndex: 0,
        startColumnIndex: columnIndex,
        endRowIndex: sheetGrid.length - 1,
        endColumnIndex: columnIndex
      });
      activeSelection = { rowIndex: activeSelection.rowIndex, columnIndex };
      syncSelectionUi();
    });
    th.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      setSelectionRange({
        startRowIndex: 0,
        startColumnIndex: columnIndex,
        endRowIndex: sheetGrid.length - 1,
        endColumnIndex: columnIndex
      });
      activeSelection = { rowIndex: activeSelection.rowIndex, columnIndex };
      syncSelectionUi();
      openContextMenu(event.clientX, event.clientY, [
        {
          label: "Cut",
          onSelect: () => cutSelectedCells()
        },
        {
          label: "Copy",
          onSelect: () => copySelectedCells()
        },
        {
          label: "Paste",
          onSelect: () => {
            pasteFromClipboard();
          }
        },
        {
          label: "Insert column right",
          onSelect: () => {
            sheetGrid = sheetGrid.map((row) => {
              const nextRow = [...row];
              nextRow.splice(columnIndex + 1, 0, "");
              return nextRow;
            });
            commitModel(true);
            rerenderPreview();
          }
        },
        {
          label: "Delete column",
          onSelect: () => {
            if ((sheetGrid[0] || []).length <= 1) {
              return;
            }
            sheetGrid = sheetGrid.map((row) => {
              const nextRow = [...row];
              nextRow.splice(columnIndex, 1);
              return nextRow;
            });
            commitModel(true);
            rerenderPreview();
          }
        },
        {
          label: "Freeze column",
          onSelect: () => {
            const currentSheet = getActiveSheetState();
            currentSheet.frozenColumns = columnIndex + 1;
            persistWorkbookState(false);
            rerenderPreview({ persistGrid: false });
          }
        }
      ]);
    });
    const resizeHandle = document.createElement("span");
    resizeHandle.className = "workspace-sheet-column-resize-handle";
    resizeHandle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();
      resizeState = {
        active: true,
        kind: "column",
        index: columnIndex,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startSize: getColumnWidth(columnIndex)
      };
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    });
    th.appendChild(resizeHandle);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  sheetGrid.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    tr.dataset.sheetBodyRow = String(rowIndex);
    const rowLabel = document.createElement("th");
    rowLabel.className = "workspace-sheet-row-label";
    rowLabel.dataset.sheetRowLabel = String(rowIndex);
    rowLabel.textContent = String(rowIndex + 1);
    rowLabel.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      setSelectionRange({
        startRowIndex: rowIndex,
        startColumnIndex: 0,
        endRowIndex: rowIndex,
        endColumnIndex: sheetGrid[0].length - 1
      });
      activeSelection = { rowIndex, columnIndex: activeSelection.columnIndex };
      syncSelectionUi();
    });
    rowLabel.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      setSelectionRange({
        startRowIndex: rowIndex,
        startColumnIndex: 0,
        endRowIndex: rowIndex,
        endColumnIndex: sheetGrid[0].length - 1
      });
      activeSelection = { rowIndex, columnIndex: activeSelection.columnIndex };
      syncSelectionUi();
      openContextMenu(event.clientX, event.clientY, [
        {
          label: "Cut",
          onSelect: () => cutSelectedCells()
        },
        {
          label: "Copy",
          onSelect: () => copySelectedCells()
        },
        {
          label: "Paste",
          onSelect: () => {
            pasteFromClipboard();
          }
        },
        {
          label: "Insert row below",
          onSelect: () => {
            sheetGrid.splice(rowIndex + 1, 0, Array.from({ length: sheetGrid[0].length }, () => ""));
            commitModel(true);
            rerenderPreview();
          }
        },
        {
          label: "Delete row",
          onSelect: () => {
            if (sheetGrid.length <= 1) {
              return;
            }
            sheetGrid.splice(rowIndex, 1);
            commitModel(true);
            rerenderPreview();
          }
        },
        {
          label: "Freeze row",
          onSelect: () => {
            const currentSheet = getActiveSheetState();
            currentSheet.frozenRows = rowIndex + 1;
            persistWorkbookState(false);
            rerenderPreview({ persistGrid: false });
          }
        }
      ]);
    });
    const rowResizeHandle = document.createElement("span");
    rowResizeHandle.className = "workspace-sheet-row-resize-handle";
    rowResizeHandle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();
      resizeState = {
        active: true,
        kind: "row",
        index: rowIndex,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startSize: getRowHeight(rowIndex)
      };
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    });
    rowLabel.appendChild(rowResizeHandle);
    tr.appendChild(rowLabel);
    row.forEach((_, columnIndex) => {
      const merge = findMergeAt(rowIndex, columnIndex);
      if (merge && !isMergeAnchor(rowIndex, columnIndex)) {
        return;
      }
      const td = document.createElement("td");
      if (merge && isMergeAnchor(rowIndex, columnIndex)) {
        td.rowSpan = merge.rowSpan;
        td.colSpan = merge.columnSpan;
        td.classList.add("workspace-sheet-merged-cell");
        td.style.minWidth = `${Array.from({ length: merge.columnSpan }, (_, offset) => getColumnWidth(columnIndex + offset)).reduce((sum, value) => sum + value, 0)}px`;
        td.style.width = td.style.minWidth;
      }
      const input = document.createElement("input");
      input.type = "text";
      input.className = "workspace-sheet-cell-input";
      input.dataset.sheetGridCell = `${rowIndex}:${columnIndex}`;
      input.dataset.rowIndex = String(rowIndex);
      input.dataset.columnIndex = String(columnIndex);
      const rawValue = getRawCellValue(rowIndex, columnIndex);
      input.value = formatCellDisplayValue(
        rawValue.startsWith("=") ? formatFormulaResult(evaluateCellValue(rowIndex, columnIndex)) : rawValue,
        rowIndex,
        columnIndex
      );
      applyCellVisualFormat(input, td, rowIndex, columnIndex);
      let preserveFormulaDisplayOnBlur = false;
      if (merge && isMergeAnchor(rowIndex, columnIndex)) {
        input.style.minHeight = `${Array.from({ length: merge.rowSpan }, (_, offset) => getRowHeight(rowIndex + offset)).reduce((sum, value) => sum + value, 0) - 2}px`;
      }
      input.addEventListener("mousedown", (event) => {
        if (maybeHandleFormulaReferencePointer(event, rowIndex, columnIndex)) {
          return;
        }
        if (event.button !== 0) {
          return;
        }
        if (event.detail >= 2) {
          cellTextEditState = { active: true, rowIndex, columnIndex };
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          setSelectionRange({
            startRowIndex: selectionRange.startRowIndex,
            startColumnIndex: selectionRange.startColumnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
        } else {
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
        }
        selectionDragState = {
          active: true,
          anchorRowIndex: event.shiftKey ? selectionRange.startRowIndex : rowIndex,
          anchorColumnIndex: event.shiftKey ? selectionRange.startColumnIndex : columnIndex
        };
        document.addEventListener("mousemove", handleSelectionDragMove);
        document.addEventListener("mouseup", handleSelectionDragEnd);
        focusSelection(rowIndex, columnIndex, { suppressFormulaEdit: true, preserveRange: true });
      });
      input.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
        if (
          rowIndex < minRow ||
          rowIndex > maxRow ||
          columnIndex < minColumn ||
          columnIndex > maxColumn
        ) {
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
          activeSelection = { rowIndex, columnIndex };
          syncSelectionUi();
        }
        openContextMenu(event.clientX, event.clientY, [
          {
            label: "Cut",
            onSelect: () => cutSelectedCells()
          },
          {
            label: "Copy",
            onSelect: () => copySelectedCells()
          },
          {
            label: "Paste",
            onSelect: () => {
              pasteFromClipboard();
            }
          },
          {
            label: "Merge selected cells",
            onSelect: mergeSelectionRange
          },
          {
            label: "Unmerge selected cells",
            onSelect: unmergeSelectionRange
          },
          {
            label: "Clear contents",
            onSelect: clearSelectedCells
          },
          {
            label: "Bold",
            onSelect: () => toggleSelectedTextStyle("bold")
          },
          {
            label: "Italic",
            onSelect: () => toggleSelectedTextStyle("italic")
          },
          {
            label: "Format number",
            onSelect: () => setSelectedRangeFormat("number")
          },
          {
            label: "Format currency",
            onSelect: () => setSelectedRangeFormat("currency")
          },
          {
            label: "Format percent",
            onSelect: () => setSelectedRangeFormat("percent")
          },
          {
            label: "Format date",
            onSelect: () => setSelectedRangeFormat("date")
          },
          {
            label: "Fill yellow",
            onSelect: () => setSelectedFillColor("#fff2cc")
          },
          {
            label: "All borders",
            onSelect: () => setSelectedBorder("all")
          }
        ]);
      });
      input.addEventListener("focus", () => {
        beginSpreadsheetHistoryTransaction();
        activeSelection = { rowIndex, columnIndex };
        const rawCellValue = getRawCellValue(rowIndex, columnIndex);
        if (suppressFormulaActivation) {
          preserveFormulaDisplayOnBlur = rawCellValue.startsWith("=");
          input.value = rawCellValue.startsWith("=")
            ? formatFormulaResult(evaluateCellValue(rowIndex, columnIndex))
            : rawCellValue;
          formulaEditState = {
            mode: null,
            rowIndex,
            columnIndex,
            input: null,
            selectionStart: 0,
            selectionEnd: 0
          };
          suppressFormulaActivation = false;
        } else {
          preserveFormulaDisplayOnBlur = false;
          input.value = rawCellValue;
          syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
        }
        if (!selectionDragState.active && !preserveRangeOnNextFocus) {
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
        }
        preserveRangeOnNextFocus = false;
        syncSelectionUi();
      });
      input.addEventListener("input", (event) => {
        beginSpreadsheetHistoryTransaction();
        preserveFormulaDisplayOnBlur = false;
        setRawCellValue(rowIndex, columnIndex, event.target.value);
        syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input: event.target });
        if (activeSelection.rowIndex === rowIndex && activeSelection.columnIndex === columnIndex) {
          formulaInput.value = event.target.value;
        }
        scheduleCommit();
        refreshGridValues();
      });
      ["click", "keyup", "select"].forEach((eventName) => {
        input.addEventListener(eventName, () => {
          if (preserveFormulaDisplayOnBlur) {
            return;
          }
          syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
        });
      });
      input.addEventListener("blur", () => {
        if (suppressRerenderBlurCommit || !previewShell.isConnected) {
          preserveFormulaDisplayOnBlur = false;
          return;
        }
        if (
          !preserveFormulaDisplayOnBlur ||
          (cellTextEditState.active &&
            cellTextEditState.rowIndex === rowIndex &&
            cellTextEditState.columnIndex === columnIndex)
        ) {
          setRawCellValue(rowIndex, columnIndex, input.value);
        }
        preserveFormulaDisplayOnBlur = false;
        syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
        commitModel(false, { beforeSnapshot: editHistorySnapshot });
        refreshGridValues();
        if (cellTextEditState.rowIndex === rowIndex && cellTextEditState.columnIndex === columnIndex) {
          cellTextEditState = { active: false, rowIndex: -1, columnIndex: -1 };
        }
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          moveSelection(1, 0);
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          moveSelection(0, event.shiftKey ? -1 : 1);
        }
      });
      td.appendChild(input);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  previewShell.appendChild(gridShell);

  const handleFillDragMove = (event) => {
    const targetInput = findCellInputFromPointer(event.clientX, event.clientY);
    if (!targetInput) {
      return;
    }
    fillDragState.targetRowIndex = Number(targetInput.dataset.rowIndex || fillDragState.targetRowIndex);
    fillDragState.targetColumnIndex = Number(targetInput.dataset.columnIndex || fillDragState.targetColumnIndex);
    updateFillPreview();
  };

  const handleFillDragEnd = () => {
    if (!fillDragState.active) {
      return;
    }
    document.removeEventListener("mousemove", handleFillDragMove);
    document.removeEventListener("mouseup", handleFillDragEnd);
    applyFillDrag();
  };

  fillHandle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    fillDragState = {
      active: true,
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      endRowIndex: maxRow,
      endColumnIndex: maxColumn,
      targetRowIndex: maxRow,
      targetColumnIndex: maxColumn
    };
    updateFillPreview();
    document.addEventListener("mousemove", handleFillDragMove);
    document.addEventListener("mouseup", handleFillDragEnd);
  });

  gridShell.addEventListener("scroll", () => {
    syncSelectionUi();
  });

  formulaInput.addEventListener("input", (event) => {
    beginSpreadsheetHistoryTransaction();
    setRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex, event.target.value);
    syncFormulaEditorState({
      mode: "formula",
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex,
      input: event.target
    });
    scheduleCommit();
    refreshGridValues();
  });
  formulaInput.addEventListener("focus", (event) => {
    beginSpreadsheetHistoryTransaction();
    syncFormulaEditorState({
      mode: "formula",
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex,
      input: event.target
    });
    syncSelectionUi();
  });
  ["click", "keyup", "select"].forEach((eventName) => {
    formulaInput.addEventListener(eventName, (event) => {
      syncFormulaEditorState({
        mode: "formula",
        rowIndex: activeSelection.rowIndex,
        columnIndex: activeSelection.columnIndex,
        input: event.target
      });
    });
  });
  formulaInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitModel(false, { beforeSnapshot: editHistorySnapshot });
      focusSelection(activeSelection.rowIndex, activeSelection.columnIndex, { suppressFormulaEdit: true });
    }
  });
  formulaInput.addEventListener("blur", () => {
    if (suppressRerenderBlurCommit || !previewShell.isConnected) {
      return;
    }
    syncFormulaEditorState({
      mode: "formula",
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex,
      input: formulaInput
    });
    commitModel(false, { beforeSnapshot: editHistorySnapshot });
    refreshGridValues();
  });

  const sheetIsKeyboardContext = (event) => {
    const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
    const targetIsInsideSheet =
      eventPath.includes(previewShell) || previewShell.contains(event.target);
    return (
      previewShell.isConnected &&
      (targetIsInsideSheet ||
        previewShell.contains(document.activeElement) ||
        document.activeElement === document.body)
    );
  };

  const stopSpreadsheetClipboardEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  const stopSpreadsheetKeyboardEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  const shouldUseNativeSpreadsheetKeyboard = (event) => {
    const target = event.target;
    if (!target || !previewShell.contains(target)) {
      return false;
    }
    if (target === formulaInput || target === nameBox || target.isContentEditable) {
      return true;
    }
    if (target.matches?.("textarea")) {
      return true;
    }
    if (target.matches?.("input") && !target.classList.contains("workspace-sheet-cell-input")) {
      return true;
    }
    return false;
  };

  const getKeyboardMoveTarget = (event) => {
    const pageStep = Math.max(1, Math.floor((gridShell.clientHeight || 340) / Math.max(1, getRowHeight(activeSelection.rowIndex))) - 2);
    const lastUsedCell = getLastUsedCell();
    switch (event.key) {
      case "ArrowUp":
        return event.ctrlKey || event.metaKey
          ? findDataBoundary(-1, 0)
          : { rowIndex: activeSelection.rowIndex - 1, columnIndex: activeSelection.columnIndex };
      case "ArrowDown":
        return event.ctrlKey || event.metaKey
          ? findDataBoundary(1, 0)
          : { rowIndex: activeSelection.rowIndex + 1, columnIndex: activeSelection.columnIndex };
      case "ArrowLeft":
        return event.ctrlKey || event.metaKey
          ? findDataBoundary(0, -1)
          : { rowIndex: activeSelection.rowIndex, columnIndex: activeSelection.columnIndex - 1 };
      case "ArrowRight":
        return event.ctrlKey || event.metaKey
          ? findDataBoundary(0, 1)
          : { rowIndex: activeSelection.rowIndex, columnIndex: activeSelection.columnIndex + 1 };
      case "Home":
        return event.ctrlKey || event.metaKey
          ? { rowIndex: 0, columnIndex: 0 }
          : { rowIndex: activeSelection.rowIndex, columnIndex: 0 };
      case "End":
        return event.ctrlKey || event.metaKey
          ? lastUsedCell
          : { rowIndex: activeSelection.rowIndex, columnIndex: getRowLastUsedColumn(activeSelection.rowIndex) };
      case "PageUp":
        return { rowIndex: activeSelection.rowIndex - pageStep, columnIndex: activeSelection.columnIndex };
      case "PageDown":
        return { rowIndex: activeSelection.rowIndex + pageStep, columnIndex: activeSelection.columnIndex };
      default:
        return null;
    }
  };

  const handleSpreadsheetKeyboardShortcut = (event) => {
    if (cellTextEditState.active) {
      if (event.key === "Escape") {
        stopSpreadsheetKeyboardEvent(event);
        cancelActiveCellTextEdit();
        return true;
      }
      if (event.key === "Enter") {
        stopSpreadsheetKeyboardEvent(event);
        const rowDelta = event.shiftKey ? -1 : 1;
        commitActiveCellTextEdit();
        focusKeyboardSelection(activeSelection.rowIndex + rowDelta, activeSelection.columnIndex);
        return true;
      }
      if (event.key === "Tab") {
        stopSpreadsheetKeyboardEvent(event);
        const columnDelta = event.shiftKey ? -1 : 1;
        commitActiveCellTextEdit();
        focusKeyboardSelection(activeSelection.rowIndex, activeSelection.columnIndex + columnDelta);
        return true;
      }
      return false;
    }

    if (shouldUseNativeSpreadsheetKeyboard(event)) {
      return false;
    }

    if (event.key === "Escape" && !sheetMenuPanel.hidden) {
      stopSpreadsheetKeyboardEvent(event);
      closeSheetMenu();
      return true;
    }

    if (event.key === "Escape" && getStoredClipboardPayload()) {
      stopSpreadsheetKeyboardEvent(event);
      setStoredClipboardPayload(null);
      syncSelectionUi();
      return true;
    }

    const key = String(event.key || "").toLowerCase();
    const hasCommandModifier = event.ctrlKey || event.metaKey;

    if (hasCommandModifier) {
      if (key === "z" && !event.shiftKey) {
        stopSpreadsheetKeyboardEvent(event);
        undoSpreadsheetAction();
        return true;
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        stopSpreadsheetKeyboardEvent(event);
        redoSpreadsheetAction();
        return true;
      }
      if (key === "a") {
        stopSpreadsheetKeyboardEvent(event);
        selectUsedRange();
        return true;
      }
      if (event.code === "Space") {
        stopSpreadsheetKeyboardEvent(event);
        if (event.shiftKey) {
          selectAllVisibleCells();
        } else {
          selectActiveColumn();
        }
        return true;
      }
      if (key === "d") {
        stopSpreadsheetKeyboardEvent(event);
        fillSelectionFromEdge("down");
        return true;
      }
      if (key === "r") {
        stopSpreadsheetKeyboardEvent(event);
        fillSelectionFromEdge("right");
        return true;
      }
      if (key === "b") {
        stopSpreadsheetKeyboardEvent(event);
        toggleSelectedTextStyle("bold");
        return true;
      }
      if (key === "i") {
        stopSpreadsheetKeyboardEvent(event);
        toggleSelectedTextStyle("italic");
        return true;
      }
      if (key === "u") {
        stopSpreadsheetKeyboardEvent(event);
        toggleSelectedTextStyle("underline");
        return true;
      }
    }

    if (!hasCommandModifier && event.shiftKey && event.code === "Space") {
      stopSpreadsheetKeyboardEvent(event);
      selectActiveRow();
      return true;
    }

    const moveTarget = getKeyboardMoveTarget(event);
    if (moveTarget) {
      stopSpreadsheetKeyboardEvent(event);
      moveKeyboardSelection(moveTarget.rowIndex, moveTarget.columnIndex, { extend: event.shiftKey });
      return true;
    }

    if (event.key === "Enter") {
      stopSpreadsheetKeyboardEvent(event);
      focusKeyboardSelection(activeSelection.rowIndex + (event.shiftKey ? -1 : 1), activeSelection.columnIndex);
      return true;
    }

    if (event.key === "Tab") {
      stopSpreadsheetKeyboardEvent(event);
      focusKeyboardSelection(activeSelection.rowIndex, activeSelection.columnIndex + (event.shiftKey ? -1 : 1));
      return true;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      stopSpreadsheetKeyboardEvent(event);
      clearSelectedCells();
      return true;
    }

    if (event.key === "F2") {
      stopSpreadsheetKeyboardEvent(event);
      beginCellTextEdit();
      return true;
    }

    if (!event.altKey && !hasCommandModifier && event.key.length === 1) {
      stopSpreadsheetKeyboardEvent(event);
      beginCellTextEdit({ initialValue: event.key });
      return true;
    }

    return false;
  };

  registerSpreadsheetShortcutHandler(historyKey, previewShell, {
    keydown: (event) => {
      if (!sheetIsKeyboardContext(event)) {
        return;
      }
      handleSpreadsheetKeyboardShortcut(event);
    },
    copy: (event) => {
      if (!sheetIsKeyboardContext(event) || shouldUseNativeTextClipboard(event)) {
        return;
      }
      stopSpreadsheetClipboardEvent(event);
      copySelectedCells(event.clipboardData);
    },
    cut: (event) => {
      if (!sheetIsKeyboardContext(event) || shouldUseNativeTextClipboard(event)) {
        return;
      }
      stopSpreadsheetClipboardEvent(event);
      cutSelectedCells(event.clipboardData);
    },
    paste: (event) => {
      if (!sheetIsKeyboardContext(event) || shouldUseNativeTextClipboard(event)) {
        return;
      }
      stopSpreadsheetClipboardEvent(event);
      pasteFromClipboard(event.clipboardData);
    }
  });

  const bottomBar = document.createElement("div");
  bottomBar.className = "workspace-sheet-bottom-bar";
  const sheetTabs = document.createElement("div");
  sheetTabs.className = "workspace-sheet-tabbar";
  const addSheetButton = document.createElement("button");
  addSheetButton.type = "button";
  addSheetButton.className = "workspace-sheet-add-button";
  addSheetButton.textContent = "+";
  addSheetButton.addEventListener("click", () => {
    persistGridIntoActiveSheet();
    const nextIndex = workbookModel.sheets.length + 1;
    workbookModel.sheets.push({
      id: `sheet-${Date.now()}`,
      name: `Sheet ${nextIndex}`,
      columns: [...getActiveSheetState().columns],
      rows: getActiveSheetState().rows.map((row) => [...row]),
      columnWidths: { ...(getActiveSheetState().columnWidths || {}) },
      rowHeights: { ...(getActiveSheetState().rowHeights || {}) },
      merges: [...(getActiveSheetState().merges || [])],
      cellFormats: {},
      filterQuery: "",
      filterColumnIndex: -1,
      sort: null,
      frozenRows: 0,
      frozenColumns: 0
    });
    workbookModel.activeSheetId = workbookModel.sheets[workbookModel.sheets.length - 1].id;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  });
  sheetTabs.appendChild(addSheetButton);
  workbookModel.sheets.forEach((sheet) => {
    const sheetTab = document.createElement("button");
    sheetTab.type = "button";
    sheetTab.className = `workspace-sheet-tab-pill${sheet.id === workbookModel.activeSheetId ? " active" : ""}`;
    sheetTab.textContent = sheet.name || "Sheet";
    sheetTab.addEventListener("click", () => {
      if (sheet.id === workbookModel.activeSheetId) {
        return;
      }
      persistGridIntoActiveSheet();
      workbookModel.activeSheetId = sheet.id;
      persistWorkbookState(false, { trackHistory: false });
      rerenderPreview({ persistGrid: false });
    });
    sheetTab.addEventListener("dblclick", () => {
      const nextName = window.prompt("Sheet name", sheet.name || "Sheet");
      if (!nextName) {
        return;
      }
      sheet.name = String(nextName).trim() || sheet.name;
      persistWorkbookState(false);
      rerenderPreview({ persistGrid: false });
    });
    sheetTabs.appendChild(sheetTab);
  });
  const status = document.createElement("div");
  status.className = "workspace-sheet-status";
  status.textContent = `${profile?.contextLabelA || "Sheet profile"}: ${getActiveSheetState().name || profile?.contextValueA || "Working sheet"}`;
  bottomBar.append(sheetTabs, status);
  previewShell.appendChild(bottomBar);

  container.appendChild(previewShell);
  applyFilterVisibility();
  applyFreezeState();
  syncSelectionUi();
}

function renderDataPreview(
  container,
  filePath = "",
  content = "",
  {
    workObject = null,
    onHeaderEdit = null,
    onCellEdit = null,
    onGridEdit = null
  } = {}
) {
  const profile = getDatasetWorkspacePreviewProfile(workObject);
  if (isJsonPath(filePath)) {
    try {
      const parsed = JSON.parse(content);
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? Object.entries(parsed).map(([key, value]) => ({ key, value }))
          : [];

      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "workspace-surface-empty";
        empty.textContent = "This dataset is empty.";
        container.appendChild(empty);
        return;
      }

      const columns = Array.isArray(rows[0])
        ? rows[0].map((_, index) => `Column ${index + 1}`)
        : Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
      const insightGrid = createPreviewInsightGrid([
        { label: "Rows", value: rows.length, meta: "JSON records visible in this workspace" },
        { label: "Columns", value: columns.length, meta: columns.slice(0, 3).join(", ") || "Structured fields" }
      ]);
      if (insightGrid) {
        container.appendChild(insightGrid);
      }

      const previewShell = document.createElement("section");
      previewShell.className = "workspace-spreadsheet-preview-shell";
      const previewToolbar = document.createElement("div");
      previewToolbar.className = "workspace-spreadsheet-preview-toolbar";
      const toolbarMeta = document.createElement("div");
      toolbarMeta.className = "workspace-code-toolbar-meta";
      const toolbarTitle = document.createElement("strong");
      toolbarTitle.textContent = workObject?.title || friendlyPathLabel(filePath) || profile.workspaceLabel;
      const toolbarHint = document.createElement("span");
      toolbarHint.className = "tiny";
      toolbarHint.textContent = `${rows.length} records | ${columns.length} fields`;
      toolbarMeta.append(toolbarTitle, toolbarHint);
      const tabs = document.createElement("div");
      tabs.className = "workspace-sheet-tabs";
      [profile.primaryTab, profile.secondaryTab].forEach((label, index) => {
        const tab = document.createElement("span");
        tab.className = `workspace-sheet-tab${index === 0 ? " active" : ""}`;
        tab.textContent = label;
        tabs.appendChild(tab);
      });
      previewToolbar.append(toolbarMeta, tabs);
      previewShell.appendChild(previewToolbar);

      const profileRow = document.createElement("div");
      profileRow.className = "workspace-document-context-grid";
      [
        { label: profile.contextLabelA, value: Array.isArray(parsed) ? profile.contextValueA : "Object dataset" },
        { label: profile.contextLabelB, value: columns[0] || "key" }
      ].forEach((item) => {
        const card = document.createElement("article");
        card.className = "workspace-document-context-card";
        const label = document.createElement("span");
        label.className = "tiny";
        label.textContent = item.label;
        const text = document.createElement("p");
        text.textContent = item.value;
        card.append(label, text);
        profileRow.appendChild(card);
      });
      previewShell.appendChild(profileRow);

      const selectionStrip = document.createElement("div");
      selectionStrip.className = "workspace-flow-chip-list";
      [
        profile.primaryTab,
        `${rows.length} rows`,
        `${columns.length} fields`,
        Array.isArray(parsed) ? "Array source" : "Object source"
      ].forEach((label, index) => {
        const chip = document.createElement("span");
        chip.className = `workspace-flow-chip${index === 0 ? " active" : ""}`;
        chip.textContent = label;
        selectionStrip.appendChild(chip);
      });
      previewShell.appendChild(selectionStrip);

      const tableShell = document.createElement("div");
      tableShell.className = "workspace-table-shell workspace-sheet-stage-table-shell";
      const table = document.createElement("table");
      table.className = "workspace-data-table";
      const headerRow = document.createElement("tr");
      columns.forEach((column) => {
        const th = document.createElement("th");
        th.textContent = column;
        headerRow.appendChild(th);
      });
      const thead = document.createElement("thead");
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      rows.slice(0, 20).forEach((row) => {
        const tr = document.createElement("tr");
        columns.forEach((column) => {
          const td = document.createElement("td");
          td.textContent =
            row && typeof row === "object" && !Array.isArray(row)
              ? JSON.stringify(row[column] ?? "")
              : JSON.stringify(row);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableShell.appendChild(table);
      previewShell.appendChild(tableShell);
      container.appendChild(previewShell);
      return;
    } catch {
      renderCodePreview(container, content, filePath);
      return;
    }
  }

  if (isCsvPath(filePath)) {
    const model = parseSpreadsheetPreviewContent(content, {
      defaultSheetName: profile?.sheetName || "Sheet 1"
    });
    renderSpreadsheetClonePreview(container, {
      model,
      profile,
      workObject,
      filePath,
      onGridEdit
    });
    return;
    const columnLetter = (index) => {
      let value = index + 1;
      let label = "";
      while (value > 0) {
        const remainder = (value - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        value = Math.floor((value - 1) / 26);
      }
      return label;
    };
    const previewShell = document.createElement("section");
    previewShell.className = "workspace-sheet-app";

    const commitModel = (refreshWorkspace = false) => {
      onGridEdit?.(
        {
          columns: [...model.columns],
          rows: model.rows.map((row) => [...row])
        },
        { refreshWorkspace }
      );
    };

    let commitHandle = null;
    const scheduleCommit = () => {
      if (commitHandle) {
        window.clearTimeout(commitHandle);
      }
      commitHandle = window.setTimeout(() => {
        commitModel(false);
        commitHandle = null;
      }, 140);
    };

    const menuBar = document.createElement("div");
    menuBar.className = "workspace-sheet-menubar";
    ["File", "Edit", "View", "Insert", "Format", "Data", "Tools", "Extensions", "Help"].forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-sheet-menu-button";
      button.textContent = label;
      menuBar.appendChild(button);
    });
    previewShell.appendChild(menuBar);

    const topBar = document.createElement("div");
    topBar.className = "workspace-sheet-topbar";
    const titleGroup = document.createElement("div");
    titleGroup.className = "workspace-sheet-title-group";
    const title = document.createElement("strong");
    title.textContent = workObject?.title || friendlyPathLabel(filePath) || profile.sheetName;
    const subtitle = document.createElement("span");
    subtitle.className = "tiny";
    subtitle.textContent = `${model.rows.length} rows | ${model.columns.length} columns`;
    titleGroup.append(title, subtitle);
    const topTabs = document.createElement("div");
    topTabs.className = "workspace-sheet-tabs";
    [profile.primaryTab, profile.secondaryTab].forEach((label, index) => {
      const tab = document.createElement("span");
      tab.className = `workspace-sheet-tab${index === 0 ? " active" : ""}`;
      tab.textContent = label;
      topTabs.appendChild(tab);
    });
    topBar.append(titleGroup, topTabs);
    previewShell.appendChild(topBar);

    const toolbar = document.createElement("div");
    toolbar.className = "workspace-sheet-toolbar";
    const makeToolbarButton = (label, onClick, accent = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `workspace-sheet-toolbar-button${accent ? " accent" : ""}`;
      button.textContent = label;
      button.addEventListener("click", onClick);
      return button;
    };
    const toolbarGroupEdit = document.createElement("div");
    toolbarGroupEdit.className = "workspace-sheet-toolbar-group";
    toolbarGroupEdit.append(
      makeToolbarButton("Undo", () => document.execCommand("undo")),
      makeToolbarButton("Redo", () => document.execCommand("redo")),
      makeToolbarButton("Bold", () => document.execCommand("bold")),
      makeToolbarButton("Italic", () => document.execCommand("italic"))
    );
    const toolbarGroupStructure = document.createElement("div");
    toolbarGroupStructure.className = "workspace-sheet-toolbar-group";
    toolbarGroupStructure.append(
      makeToolbarButton("Insert row", () => {
        model.rows.push(Array.from({ length: model.columns.length }, () => ""));
        commitModel(true);
      }),
      makeToolbarButton("Insert column", () => {
        model.columns.push(`Column ${model.columns.length + 1}`);
        model.rows = model.rows.map((row) => [...row, ""]);
        commitModel(true);
      }),
      makeToolbarButton("Delete row", () => {
        if (model.rows.length <= 1) {
          return;
        }
        model.rows = model.rows.slice(0, -1);
        commitModel(true);
      }),
      makeToolbarButton("Delete column", () => {
        if (model.columns.length <= 1) {
          return;
        }
        model.columns = model.columns.slice(0, -1);
        model.rows = model.rows.map((row) => row.slice(0, -1));
        commitModel(true);
      }),
      makeToolbarButton("Sum row", () => {
        const totals = model.columns.map((_, index) => {
          if (index === 0) {
            return "Total";
          }
          const values = model.rows
            .map((row) => Number(String(row[index] || "").replace(",", ".")))
            .filter((value) => Number.isFinite(value));
          if (!values.length) {
            return "";
          }
          const total = values.reduce((sum, value) => sum + value, 0);
          return Number.isInteger(total) ? String(total) : total.toFixed(2);
        });
        model.rows.push(totals);
        commitModel(true);
      }, true)
    );
    toolbar.append(toolbarGroupEdit, toolbarGroupStructure);
    previewShell.appendChild(toolbar);

    const formulaBar = document.createElement("div");
    formulaBar.className = "workspace-formula-bar workspace-formula-bar-live";
    const nameBox = document.createElement("input");
    nameBox.type = "text";
    nameBox.className = "workspace-sheet-name-box";
    nameBox.readOnly = true;
    const formulaLabel = document.createElement("span");
    formulaLabel.className = "tiny";
    formulaLabel.textContent = "fx";
    const formulaValue = document.createElement("input");
    formulaValue.type = "text";
    formulaValue.className = "workspace-sheet-formula-input";
    formulaBar.append(nameBox, formulaLabel, formulaValue);
    previewShell.appendChild(formulaBar);

    const gridShell = document.createElement("div");
    gridShell.className = "workspace-sheet-grid-shell";
    const table = document.createElement("table");
    table.className = "workspace-sheet-grid-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "workspace-sheet-corner";
    corner.textContent = "";
    headRow.appendChild(corner);

    let activeSelection = { kind: "header", columnIndex: 0, rowIndex: 0 };
    const cellSelector = (selection) =>
      selection.kind === "header"
        ? `[data-sheet-header-cell="${selection.columnIndex}"]`
        : `[data-sheet-body-cell="${selection.rowIndex}:${selection.columnIndex}"]`;
    const addressForSelection = (selection) =>
      selection.kind === "header"
        ? `${columnLetter(selection.columnIndex)}1`
        : `${columnLetter(selection.columnIndex)}${selection.rowIndex + 2}`;
    const getSelectionValue = (selection) =>
      selection.kind === "header"
        ? model.columns[selection.columnIndex] || ""
        : model.rows[selection.rowIndex]?.[selection.columnIndex] || "";
    const setSelectionValue = (selection, value) => {
      if (selection.kind === "header") {
        model.columns[selection.columnIndex] = value;
      } else if (model.rows[selection.rowIndex]) {
        model.rows[selection.rowIndex][selection.columnIndex] = value;
      }
    };
    const syncSelectionUi = () => {
      nameBox.value = addressForSelection(activeSelection);
      formulaValue.value = getSelectionValue(activeSelection);
      formulaValue.placeholder = activeSelection.kind === "header" ? "Column title" : "Cell value";
      table.querySelectorAll(".is-selected").forEach((node) => node.classList.remove("is-selected"));
      const target = table.querySelector(cellSelector(activeSelection));
      target?.classList.add("is-selected");
    };
    const focusSelection = (selection) => {
      activeSelection = selection;
      syncSelectionUi();
      table.querySelector(cellSelector(selection))?.focus();
    };
    const moveSelection = (selection, rowDelta = 0, columnDelta = 0) => {
      const nextColumnIndex = Math.max(0, Math.min(model.columns.length - 1, selection.columnIndex + columnDelta));
      if (selection.kind === "header") {
        if (rowDelta > 0) {
          focusSelection({ kind: "cell", rowIndex: 0, columnIndex: nextColumnIndex });
          return;
        }
        focusSelection({ kind: "header", columnIndex: nextColumnIndex, rowIndex: 0 });
        return;
      }
      const nextRowIndex = Math.max(0, Math.min(model.rows.length - 1, selection.rowIndex + rowDelta));
      focusSelection({ kind: "cell", rowIndex: nextRowIndex, columnIndex: nextColumnIndex });
    };
    const bindCellNavigation = (input, selection) => {
      input.addEventListener("focus", () => {
        activeSelection = selection;
        syncSelectionUi();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          moveSelection(selection, 1, 0);
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          moveSelection(selection, 0, event.shiftKey ? -1 : 1);
        }
      });
    };

    model.columns.forEach((_, columnIndex) => {
      const th = document.createElement("th");
      th.className = "workspace-sheet-column-letter";
      th.textContent = columnLetter(columnIndex);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const headerRow = document.createElement("tr");
    const headerRowLabel = document.createElement("th");
    headerRowLabel.className = "workspace-sheet-row-label";
    headerRowLabel.textContent = "1";
    headerRow.appendChild(headerRowLabel);
    model.columns.forEach((value, columnIndex) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.className = "workspace-sheet-header-cell-input";
      input.dataset.sheetHeaderCell = String(columnIndex);
      bindCellNavigation(input, { kind: "header", columnIndex, rowIndex: 0 });
      input.addEventListener("input", (event) => {
        model.columns[columnIndex] = event.target.value;
        if (activeSelection.kind === "header" && activeSelection.columnIndex === columnIndex) {
          syncSelectionUi();
        }
        scheduleCommit();
      });
      input.addEventListener("blur", () => {
        model.columns[columnIndex] = input.value.trim() || `Column ${columnIndex + 1}`;
        input.value = model.columns[columnIndex];
        commitModel(false);
        syncSelectionUi();
      });
      td.appendChild(input);
      headerRow.appendChild(td);
    });
    tbody.appendChild(headerRow);

    model.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      const rowLabel = document.createElement("th");
      rowLabel.className = "workspace-sheet-row-label";
      rowLabel.textContent = String(rowIndex + 2);
      tr.appendChild(rowLabel);
      model.columns.forEach((_, columnIndex) => {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "text";
        input.value = row[columnIndex] || "";
        input.className = "workspace-sheet-cell-input";
        input.dataset.sheetBodyCell = `${rowIndex}:${columnIndex}`;
        bindCellNavigation(input, { kind: "cell", rowIndex, columnIndex });
        input.addEventListener("input", (event) => {
          model.rows[rowIndex][columnIndex] = event.target.value;
          if (
            activeSelection.kind === "cell" &&
            activeSelection.rowIndex === rowIndex &&
            activeSelection.columnIndex === columnIndex
          ) {
            syncSelectionUi();
          }
          scheduleCommit();
        });
        input.addEventListener("blur", () => {
          model.rows[rowIndex][columnIndex] = input.value;
          commitModel(false);
        });
        td.appendChild(input);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    gridShell.appendChild(table);
    previewShell.appendChild(gridShell);

    formulaValue.addEventListener("input", (event) => {
      setSelectionValue(activeSelection, event.target.value);
      const target = table.querySelector(cellSelector(activeSelection));
      if (target) {
        target.value = event.target.value;
      }
      scheduleCommit();
    });
    formulaValue.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitModel(false);
        focusSelection(activeSelection);
      }
    });
    formulaValue.addEventListener("blur", () => {
      commitModel(false);
    });

    const bottomBar = document.createElement("div");
    bottomBar.className = "workspace-sheet-bottom-bar";
    const sheetTabs = document.createElement("div");
    sheetTabs.className = "workspace-sheet-tabbar";
    const addSheetButton = document.createElement("button");
    addSheetButton.type = "button";
    addSheetButton.className = "workspace-sheet-add-button";
    addSheetButton.textContent = "+";
    addSheetButton.title = "Add sheet";
    const activeSheetTab = document.createElement("button");
    activeSheetTab.type = "button";
    activeSheetTab.className = "workspace-sheet-tab-pill active";
    activeSheetTab.textContent = profile.sheetName;
    sheetTabs.append(addSheetButton, activeSheetTab);
    const status = document.createElement("div");
    status.className = "workspace-sheet-status";
    status.textContent = `${profile.contextLabelA}: ${profile.contextValueA}`;
    bottomBar.append(sheetTabs, status);
    previewShell.appendChild(bottomBar);

    container.appendChild(previewShell);
    syncSelectionUi();
    return;
  }

  renderCodePreview(container, content, filePath);
}

function stripPresentationSlideTitle(value = "") {
  return String(value || "").replace(/^slide\s+\d+\s*-\s*/i, "").trim();
}

function extractPresentationCallouts(values = []) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => {
      const pair = value.match(/^([^:]{2,32}):\s+(.+)$/);
      if (pair) {
        return {
          label: pair[1].trim(),
          value: pair[2].trim()
        };
      }

      return {
        label: "Point",
        value
      };
    })
    .slice(0, 4);
}

function parsePresentationBlock(block = "") {
  const lines = normalizeText(block)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^##\s+/i.test(line));

  const bullets = [];
  const paragraphs = [];

  for (const line of lines) {
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+|^\d+\.\s+/, "").trim());
      continue;
    }

    paragraphs.push(line);
  }

  return {
    lead: paragraphs[0] || bullets[0] || "",
    bullets: bullets.slice(0, 6),
    supporting: paragraphs.slice(1, 3),
    callouts: extractPresentationCallouts([...bullets, ...paragraphs.slice(1, 5)])
  };
}

function inferPresentationSlideTheme(title = "", parsed = {}) {
  const normalized = normalizeText(title).toLowerCase();
  if (/\b(why|problem|matters|opportunity)\b/.test(normalized)) {
    return "problem";
  }
  if (/\b(walkthrough|product|demo|overview)\b/.test(normalized)) {
    return "product";
  }
  if (/\b(proof|signal|traction|metrics|kpi)\b/.test(normalized)) {
    return "proof";
  }
  if (/\b(next|roadmap|milestone|move)\b/.test(normalized)) {
    return "roadmap";
  }
  if ((parsed.callouts || []).length >= 3) {
    return "insight";
  }
  return "default";
}

function renderPresentationPreview(
  container,
  content = "",
  sections = [],
  currentSectionId = "",
  onSlideFocus = null,
  onSlideEdit = null
) {
  const usableSections = (sections || []).filter(
    (section) => section.id !== "whole-file" && section.level >= 2
  );

  const slides = usableSections.length
    ? usableSections
    : [{
        id: "slide-1",
        title: "Slide 1",
        block: content
      }];

  const activeSlide =
    slides.find((slide) => slide.id === currentSectionId) ||
    slides[0];
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeSlide.id));
  const parsed = parsePresentationBlock(activeSlide.block || "");
  const stageTheme = inferPresentationSlideTheme(activeSlide.title, parsed);

  const stats = document.createElement("div");
  stats.className = "workspace-preview-summary";
  stats.textContent = `${slides.length} slides · deck preview`;
  stats.textContent = `${slides.length} slides | deck preview`;
  container.appendChild(stats);

  const deckShell = document.createElement("section");
  deckShell.className = "workspace-deck-shell";

  const deckToolbar = document.createElement("div");
  deckToolbar.className = "workspace-deck-toolbar";

  const deckMeta = document.createElement("div");
  deckMeta.className = "workspace-deck-meta";
  const deckTitle = document.createElement("strong");
  deckTitle.textContent = stripPresentationSlideTitle(activeSlide.title || "Slide");
  const deckPosition = document.createElement("span");
  deckPosition.className = "tiny";
  deckPosition.textContent = `Slide ${activeIndex + 1} of ${slides.length}`;
  deckMeta.append(deckTitle, deckPosition);

  const themeTokens = document.createElement("div");
  themeTokens.className = "workspace-deck-theme";
  [
    { label: "Story", active: ["default", "product"].includes(stageTheme) },
    { label: "Proof", active: ["proof", "insight"].includes(stageTheme) },
    { label: "Decision", active: ["problem", "roadmap"].includes(stageTheme) }
  ].forEach((tokenConfig) => {
    const token = document.createElement("span");
    token.className = `workspace-deck-theme-chip${tokenConfig.active ? " active" : ""}`;
    token.textContent = tokenConfig.label;
    themeTokens.appendChild(token);
  });
  deckToolbar.append(deckMeta, themeTokens);
  deckShell.appendChild(deckToolbar);

  const deckInsightRow = document.createElement("div");
  deckInsightRow.className = "workspace-document-context-grid";
  [
    {
      label: "Narrative spine",
      value: slides.slice(0, 3).map((slide) => stripPresentationSlideTitle(slide.title || "Slide")).join(" -> ")
    },
    {
      label: "Presenter focus",
      value: parsed.lead || "Use the active slide to make one decision obvious."
    }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    deckInsightRow.appendChild(card);
  });
  deckShell.appendChild(deckInsightRow);

  const deckWorkbench = document.createElement("div");
  deckWorkbench.className = "workspace-deck-preview-workbench";

  const stage = document.createElement("article");
  stage.className = `workspace-slide-stage workspace-slide-stage-${stageTheme}`;

  const stageHeader = document.createElement("div");
  stageHeader.className = "workspace-slide-stage-header";

  const stageLabelGroup = document.createElement("div");

  const stageMeta = document.createElement("span");
  stageMeta.className = "workspace-slide-kicker";
  stageMeta.textContent = `Current slide · ${slides.findIndex((slide) => slide.id === activeSlide.id) + 1}`;

  const stageTitle = document.createElement("h3");
  stageTitle.textContent = activeSlide.title || "Slide";
  stageMeta.textContent = `Slide ${activeIndex + 1} of ${slides.length}`;
  stageTitle.textContent = stripPresentationSlideTitle(activeSlide.title || "Slide");

  const commitSlideEdit = () => {
    const nextBodyParts = [];
    const nextLead = String(stageLead.textContent || "").trim();
    if (nextLead) {
      nextBodyParts.push(nextLead);
    }
    bodyColumn.querySelectorAll(".workspace-slide-paragraph").forEach((paragraph) => {
      const value = String(paragraph.textContent || "").trim();
      if (value) {
        nextBodyParts.push(value);
      }
    });
    const bulletValues = Array.from(bodyColumn.querySelectorAll(".workspace-slide-bullet-list li"))
      .map((item) => String(item.textContent || "").trim())
      .filter(Boolean)
      .map((item) => `- ${item}`);
    if (bulletValues.length) {
      nextBodyParts.push(bulletValues.join("\n"));
    }
    onSlideEdit?.(activeSlide.id, {
      title: stripPresentationSlideTitle(stageTitle.textContent || activeSlide.title || "Slide").trim() || "Slide",
      body: nextBodyParts.join("\n\n").trim()
    });
  };

  wireInlineEditable(stageTitle, {
    onCommit: commitSlideEdit
  });

  stageLabelGroup.append(stageMeta, stageTitle);

  const stageHint = document.createElement("span");
  stageHint.className = "workspace-slide-stage-hint";
  stageHint.textContent = "Presentation surface";
  stageHeader.append(stageLabelGroup, stageHint);

  const stageLead = document.createElement("p");
  stageLead.className = "workspace-slide-lead";
  stageLead.textContent =
    parsed.lead ||
    "Use this slide to make one point obvious immediately.";
  wireInlineEditable(stageLead, {
    multiline: true,
    onCommit: commitSlideEdit
  });

  const leadRail = document.createElement("div");
  leadRail.className = "workspace-slide-lead-rail";
  const leadLabel = document.createElement("span");
  leadLabel.className = "tiny";
  leadLabel.textContent = "Presenter angle";
  const leadValue = document.createElement("strong");
  leadValue.textContent =
    parsed.callouts[0]?.value ||
    parsed.supporting[0] ||
    "Sharpen the slide in edit mode to make the narrative stronger.";
  leadRail.append(leadLabel, leadValue);

  const stageGrid = document.createElement("div");
  stageGrid.className = "workspace-slide-grid";

  const bodyColumn = document.createElement("div");
  bodyColumn.className = "workspace-slide-column";
  parsed.supporting.forEach((paragraph) => {
    const block = document.createElement("p");
    block.className = "workspace-slide-paragraph";
    block.textContent = paragraph;
    wireInlineEditable(block, {
      multiline: true,
      onCommit: commitSlideEdit
    });
    bodyColumn.appendChild(block);
  });

  if (parsed.bullets.length) {
    const bulletList = document.createElement("ul");
    bulletList.className = "workspace-slide-bullet-list";
    parsed.bullets.forEach((bullet) => {
      const item = document.createElement("li");
      item.textContent = bullet;
      wireInlineEditable(item, {
        onCommit: commitSlideEdit
      });
      bulletList.appendChild(item);
    });
    bodyColumn.appendChild(bulletList);
  }

  if (!bodyColumn.childNodes.length) {
    const fallback = document.createElement("p");
    fallback.className = "workspace-slide-paragraph";
    fallback.textContent = "Open this slide in the editor to sharpen the narrative and add stronger proof.";
    wireInlineEditable(fallback, {
      multiline: true,
      onCommit: commitSlideEdit
    });
    bodyColumn.appendChild(fallback);
  }

  const insightColumn = document.createElement("div");
  insightColumn.className = "workspace-slide-insight-column";
  const insightMeta = document.createElement("span");
  insightMeta.className = "tiny";
  insightMeta.textContent = ["proof", "insight"].includes(stageTheme) ? "Signals" : "Key points";
  insightColumn.appendChild(insightMeta);

  const insightGrid = document.createElement("div");
  insightGrid.className = "workspace-slide-insight-grid";
  (parsed.callouts.length
    ? parsed.callouts
    : [{ label: "Focus", value: parsed.lead || "Clarify the message on this slide." }]).forEach((callout) => {
    const card = document.createElement("article");
    card.className = "workspace-slide-insight-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = callout.label;
    const value = document.createElement("strong");
    value.textContent = callout.value;
    card.append(label, value);
    insightGrid.appendChild(card);
  });
  insightColumn.appendChild(insightGrid);

  stageGrid.append(bodyColumn, insightColumn);
  stage.append(stageHeader, stageLead, leadRail, stageGrid);

  const strip = document.createElement("div");
  strip.className = "workspace-slide-strip";
  slides.forEach((slide, index) => {
    const card = document.createElement(onSlideFocus ? "button" : "article");
    card.className = `workspace-slide-card${slide.id === activeSlide.id ? " active" : ""}`;
    if (onSlideFocus) {
      card.type = "button";
      card.addEventListener("click", () => onSlideFocus(slide.id));
    }

    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `Slide ${index + 1}`;

    const title = document.createElement("h4");
    title.textContent = stripPresentationSlideTitle(slide.title || `Slide ${index + 1}`);

    const preview = document.createElement("p");
    preview.textContent =
      parsePresentationBlock(slide.block || "").lead ||
      "Use this slide to make one point clear and memorable.";

    card.append(meta, title, preview);
    strip.appendChild(card);
  });

  const notesPanel = document.createElement("div");
  notesPanel.className = "workspace-presentation-speaker-notes";
  const notesHeader = document.createElement("div");
  notesHeader.className = "workspace-code-toolbar-meta";
  const notesTitle = document.createElement("strong");
  notesTitle.textContent = "Speaker notes";
  const notesHint = document.createElement("span");
  notesHint.className = "tiny";
  notesHint.textContent = "How to present the active slide";
  notesHeader.append(notesTitle, notesHint);
  notesPanel.appendChild(notesHeader);
  const notesGrid = document.createElement("div");
  notesGrid.className = "workspace-document-context-grid";
  [
    {
      label: "Lead line",
      value: parsed.lead || "Open with the strongest message on the current slide."
    },
    {
      label: "Audience move",
      value: activeIndex === slides.length - 1 ? "Make the next action explicit." : activeIndex === 0 ? "Hook attention fast." : "Support the narrative with proof."
    }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    notesGrid.appendChild(card);
  });
  notesPanel.appendChild(notesGrid);

  deckWorkbench.append(strip, stage, notesPanel);
  deckShell.appendChild(deckWorkbench);
  container.appendChild(deckShell);
}

function parsePreviewNumber(value = "") {
  const normalized = String(value || "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyDeltaTone(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "neutral";
  }
  if (/^\+/.test(normalized) || /\b(up|growth|gain|lift)\b/i.test(normalized)) {
    return "positive";
  }
  if (/^-/.test(normalized) || /\b(down|drop|loss|risk)\b/i.test(normalized)) {
    return "negative";
  }
  return "neutral";
}

function renderDashboardPreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderCodePreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.summary || "Live dashboard view";
  container.appendChild(summary);

  const dashboardToolbar = document.createElement("div");
  dashboardToolbar.className = "workspace-dashboard-preview-toolbar";
  const dashboardMeta = document.createElement("div");
  dashboardMeta.className = "workspace-code-toolbar-meta";
  const dashboardTitle = document.createElement("strong");
  dashboardTitle.textContent = model.title || "Dashboard";
  const dashboardHint = document.createElement("span");
  dashboardHint.className = "tiny";
  dashboardHint.textContent = `${(model.filters || []).length} filters | ${(model.widgets || []).length} widgets`;
  dashboardMeta.append(dashboardTitle, dashboardHint);
  const dashboardTabs = document.createElement("div");
  dashboardTabs.className = "workspace-code-tabs";
  ["Overview", "Charts", "Table"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-code-tab${index === 0 ? " is-active" : ""}`;
    tab.textContent = label;
    dashboardTabs.appendChild(tab);
  });
  dashboardToolbar.append(dashboardMeta, dashboardTabs);
  container.appendChild(dashboardToolbar);

  const metricGrid = document.createElement("div");
  metricGrid.className = "workspace-overview-grid";
  (model.metrics || []).forEach((metric) => {
    const card = document.createElement("article");
    card.className = "workspace-overview-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = metric.label || "Metric";
    const value = document.createElement("strong");
    value.textContent = metric.value || "-";
    const delta = document.createElement("span");
    delta.className = "tiny";
    delta.textContent = metric.delta || "";
    card.append(label, value, delta);
    metricGrid.appendChild(card);
  });
  if (metricGrid.children.length) {
    container.appendChild(metricGrid);
  }

  const chartStrip = document.createElement("div");
  chartStrip.className = "workspace-slide-strip";
  (model.charts || []).forEach((chart, index) => {
    const card = document.createElement("article");
    card.className = "workspace-slide-card";
    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `${chart.kind || "chart"} ${index + 1}`;
    const title = document.createElement("h4");
    title.textContent = chart.title || `Chart ${index + 1}`;
    const preview = document.createElement("p");
    preview.textContent = (chart.points || [])
      .slice(0, 4)
      .map((point) => `${point.label}: ${point.value}`)
      .join(" · ");
    card.append(meta, title, preview);
    chartStrip.appendChild(card);
  });
  if (chartStrip.children.length) {
    container.appendChild(chartStrip);
  }

  if (model.table?.columns?.length) {
    renderDataPreview(
      container,
      "table.csv",
      [
        model.table.columns.join(","),
        ...(model.table.rows || []).map((row) => row.map((cell) => String(cell || "")).join(","))
      ].join("\n")
    );
  }
}

function renderWorkflowPreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderCodePreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = `${model.objective || "Workflow"} · Trigger: ${model.trigger || "manual"}`;
  container.appendChild(summary);

  const workflowToolbar = document.createElement("div");
  workflowToolbar.className = "workspace-dashboard-preview-toolbar";
  const workflowMeta = document.createElement("div");
  workflowMeta.className = "workspace-code-toolbar-meta";
  const workflowTitle = document.createElement("strong");
  workflowTitle.textContent = model.title || "Workflow";
  const workflowHint = document.createElement("span");
  workflowHint.className = "tiny";
  workflowHint.textContent = `${(model.stages || []).length} steps | ${(model.links || []).length} links`;
  workflowMeta.append(workflowTitle, workflowHint);
  const workflowTabs = document.createElement("div");
  workflowTabs.className = "workspace-code-tabs";
  ["Canvas", "Nodes", "Outputs"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-code-tab${index === 0 ? " is-active" : ""}`;
    tab.textContent = label;
    workflowTabs.appendChild(tab);
  });
  workflowToolbar.append(workflowMeta, workflowTabs);
  container.appendChild(workflowToolbar);

  const strip = document.createElement("div");
  strip.className = "workspace-slide-strip";
  (model.stages || []).forEach((stage, index) => {
    const card = document.createElement("article");
    card.className = "workspace-slide-card";
    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `Step ${index + 1} · ${stage.owner || "Hydria"}`;
    const title = document.createElement("h4");
    title.textContent = stage.label || `Step ${index + 1}`;
    const preview = document.createElement("p");
    preview.textContent = stage.note || "";
    card.append(meta, title, preview);
    strip.appendChild(card);
  });
  container.appendChild(strip);

  if ((model.automations || []).length) {
    const list = document.createElement("ul");
    (model.automations || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    container.appendChild(list);
  }
}

function renderDesignPreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderCodePreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.brief || "Design surface";
  container.appendChild(summary);

  const totalBlocks = (model.frames || []).reduce((count, frame) => count + ((frame.blocks || []).length || 0), 0);
  const designInsights = createPreviewInsightGrid([
    { label: "Frames", value: (model.frames || []).length || 0, meta: model.frames?.[0]?.name || "No frame yet" },
    { label: "Blocks", value: totalBlocks, meta: totalBlocks ? "Layout spread across frames" : "No blocks yet" },
    { label: "Palette", value: (model.palette || []).length || 0, meta: model.palette?.[0]?.name || "No color token yet" },
    { label: "Components", value: (model.components || []).length || 0, meta: model.components?.[0] || "No component vocabulary yet" }
  ]);
  if (designInsights) {
    container.appendChild(designInsights);
  }

  const palette = document.createElement("div");
  palette.className = "workspace-slide-strip";
  (model.palette || []).forEach((token) => {
    const card = document.createElement("article");
    card.className = "workspace-slide-card";
    const swatch = document.createElement("div");
    swatch.style.width = "100%";
    swatch.style.height = "64px";
    swatch.style.borderRadius = "14px";
    swatch.style.background = token.value || "#ddd";
    const title = document.createElement("h4");
    title.textContent = token.name || "Color";
    const meta = document.createElement("p");
    meta.textContent = token.value || "";
    card.append(swatch, title, meta);
    palette.appendChild(card);
  });
  if (palette.children.length) {
    container.appendChild(palette);
  }

  const frames = document.createElement("div");
  frames.className = "workspace-overview-grid";
  (model.frames || []).forEach((frameModel) => {
    const card = document.createElement("article");
    card.className = "workspace-overview-card";
    const name = document.createElement("strong");
    name.textContent = frameModel.name || "Frame";
    const goal = document.createElement("span");
    goal.className = "tiny";
    goal.textContent = frameModel.goal || "";
    card.append(name, goal);
    frames.appendChild(card);
  });
  if (frames.children.length) {
    container.appendChild(frames);
  }
}

function clampPreviewPosition(value = 0, min = 0, max = 0) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function attachPreviewDrag(element, {
  initialX = 0,
  initialY = 0,
  getBounds = () => ({ width: 0, height: 0 }),
  minX = 8,
  minY = 8,
  maxX = Number.POSITIVE_INFINITY,
  maxY = Number.POSITIVE_INFINITY,
  onCommit = null
} = {}) {
  let dragState = null;

  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;
    if (
      (target?.closest?.("button") && target !== element) ||
      target?.closest?.(".workspace-preview-ignore-drag, .workspace-preview-resize-handle, .workspace-workflow-port")
    ) {
      return;
    }

    dragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: Number(initialX) || 0,
      startY: Number(initialY) || 0,
      nextX: Number(initialX) || 0,
      nextY: Number(initialY) || 0
    };

    element.setPointerCapture?.(event.pointerId);
    element.classList.add("is-dragging");
    event.preventDefault();
  });

  element.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const bounds = getBounds() || { width: 0, height: 0 };
    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;
    dragState.nextX = clampPreviewPosition(dragState.startX + deltaX, minX, Math.max(minX, Math.min(maxX, (bounds.width || 0) - 24)));
    dragState.nextY = clampPreviewPosition(dragState.startY + deltaY, minY, Math.max(minY, Math.min(maxY, (bounds.height || 0) - 24)));
    element.style.transform = `translate(${dragState.nextX - dragState.startX}px, ${dragState.nextY - dragState.startY}px)`;
  });

  const finish = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const nextX = dragState.nextX;
    const nextY = dragState.nextY;
    element.classList.remove("is-dragging");
    element.style.transform = "";
    element.releasePointerCapture?.(event.pointerId);
    dragState = null;
    onCommit?.(nextX, nextY);
  };

  element.addEventListener("pointerup", finish);
  element.addEventListener("pointercancel", finish);
}

function attachPreviewResize(handle, {
  target = null,
  initialWidth = 160,
  initialHeight = 36,
  getBounds = () => ({ width: 0, height: 0 }),
  minWidth = 80,
  minHeight = 24,
  onCommit = null
} = {}) {
  let resizeState = null;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    resizeState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: Number(initialWidth) || 160,
      startHeight: Number(initialHeight) || 36,
      nextWidth: Number(initialWidth) || 160,
      nextHeight: Number(initialHeight) || 36
    };

    handle.setPointerCapture?.(event.pointerId);
    target?.classList?.add("is-dragging");
    event.stopPropagation();
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return;
    }

    const bounds = getBounds() || { width: 0, height: 0 };
    const deltaX = event.clientX - resizeState.startClientX;
    const deltaY = event.clientY - resizeState.startClientY;
    resizeState.nextWidth = clampPreviewPosition(
      resizeState.startWidth + deltaX,
      minWidth,
      Math.max(minWidth, (bounds.width || resizeState.startWidth) - 12)
    );
    resizeState.nextHeight = clampPreviewPosition(
      resizeState.startHeight + deltaY,
      minHeight,
      Math.max(minHeight, (bounds.height || resizeState.startHeight) - 12)
    );

    if (target) {
      target.style.width = `${resizeState.nextWidth}px`;
      target.style.height = `${resizeState.nextHeight}px`;
    }
  });

  const finish = (event) => {
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return;
    }

    const nextWidth = resizeState.nextWidth;
    const nextHeight = resizeState.nextHeight;
    target?.classList?.remove("is-dragging");
    handle.releasePointerCapture?.(event.pointerId);
    resizeState = null;
    onCommit?.(nextWidth, nextHeight);
  };

  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
}

function renderDashboardExperiencePreview(
  container,
  content = "",
  {
    activeFilter = "",
    activeWidgetId = "",
    activeChartId = "",
    onFilterToggle = null,
    onWidgetMove = null,
    onWidgetDrop = null,
    onWidgetResize = null,
    onWidgetFocus = null,
    onChartFocus = null
  } = {}
) {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderDashboardPreview(container, content);
    return;
  }

  const normalizedFilter = String(activeFilter || "").trim().toLowerCase();
  const matchesFilter = (value = "") =>
    !normalizedFilter || String(value || "").toLowerCase().includes(normalizedFilter);
  const visibleWidgets = normalizedFilter
    ? (model.widgets || []).filter(
        (widget) =>
          matchesFilter(widget.title) || matchesFilter(widget.summary) || matchesFilter(widget.type)
      )
    : model.widgets || [];
  const visibleMetrics = normalizedFilter
    ? (model.metrics || []).filter((metric) => matchesFilter(metric.label))
    : model.metrics || [];
  const visibleCharts = normalizedFilter
    ? (model.charts || []).filter((chart) => matchesFilter(chart.title))
    : model.charts || [];

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = normalizedFilter
    ? `${model.summary || "Live dashboard view"} - Focus: ${activeFilter}`
    : model.summary || "Live dashboard view";
  container.appendChild(summary);

  const dashboardInsights = createPreviewInsightGrid([
    { label: "Metrics", value: visibleMetrics.length || 0, meta: visibleMetrics[0]?.label || "No visible metric" },
    { label: "Widgets", value: visibleWidgets.length || 0, meta: visibleWidgets[0]?.title || "No visible widget" },
    { label: "Charts", value: visibleCharts.length || 0, meta: visibleCharts[0]?.title || "No visible chart" },
    { label: "Focus", value: activeFilter || "All", meta: normalizedFilter ? "Preview filter is active" : "Showing the full dashboard" }
  ]);
  if (dashboardInsights) {
    container.appendChild(dashboardInsights);
  }

  if ((model.filters || []).length) {
    const filters = document.createElement("div");
    filters.className = "workspace-flow-chip-list";
    (model.filters || []).forEach((filter) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `workspace-flow-chip workspace-flow-chip-button${
        String(filter || "") === String(activeFilter || "") ? " is-active" : ""
      }`;
      chip.textContent = filter;
      chip.addEventListener("click", () => {
        onFilterToggle?.(filter);
      });
      filters.appendChild(chip);
    });
    container.appendChild(filters);
  }

  if (visibleWidgets.length) {
    const widgetGrid = document.createElement("div");
    widgetGrid.className = "workspace-dashboard-widget-grid";
    visibleWidgets.forEach((widget) => {
      const widgetSize = ["small", "medium", "large"].includes(String(widget.size || ""))
        ? String(widget.size)
        : "medium";
      const card = document.createElement("article");
      card.className = `workspace-dashboard-widget${
        widget.id === activeWidgetId ? " is-active" : ""
      } workspace-dashboard-widget--${widgetSize}`;
      card.tabIndex = 0;
      card.draggable = true;
      card.addEventListener("click", () => onWidgetFocus?.(widget.id));
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", widget.id);
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        card.classList.remove("is-drop-target");
      });
      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        card.classList.add("is-drop-target");
      });
      card.addEventListener("dragleave", () => {
        card.classList.remove("is-drop-target");
      });
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        card.classList.remove("is-drop-target");
        const sourceId = event.dataTransfer?.getData("text/plain") || "";
        onWidgetDrop?.(sourceId, widget.id);
      });
      const meta = document.createElement("span");
      meta.className = "tiny";
      meta.textContent = `${widget.type || "widget"} · ${widgetSize}`;
      const title = document.createElement("strong");
      title.textContent = widget.title || "Widget";
      const summary = document.createElement("p");
      summary.textContent = widget.summary || "";
      const actions = document.createElement("div");
      actions.className = "workspace-surface-card-actions";
      const focusButton = document.createElement("button");
      focusButton.type = "button";
      focusButton.className = "workspace-mini-action";
      focusButton.textContent = "Edit";
      focusButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onWidgetFocus?.(widget.id);
      });
      actions.appendChild(focusButton);
      const shrinkButton = document.createElement("button");
      shrinkButton.type = "button";
      shrinkButton.className = "workspace-mini-action";
      shrinkButton.textContent = "-";
      shrinkButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onWidgetResize?.(widget.id, -1);
      });
      actions.appendChild(shrinkButton);
      const growButton = document.createElement("button");
      growButton.type = "button";
      growButton.className = "workspace-mini-action";
      growButton.textContent = "+";
      growButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onWidgetResize?.(widget.id, 1);
      });
      actions.appendChild(growButton);
      const sourceIndex = (model.widgets || []).findIndex((item) => item.id === widget.id);
      if (sourceIndex > 0) {
        const leftButton = document.createElement("button");
        leftButton.type = "button";
        leftButton.className = "workspace-mini-action";
        leftButton.textContent = "←";
        leftButton.addEventListener("click", (event) => {
          event.stopPropagation();
          onWidgetMove?.(widget.id, -1);
        });
        leftButton.textContent = "<";
        actions.appendChild(leftButton);
      }
      if (sourceIndex < (model.widgets || []).length - 1) {
        const rightButton = document.createElement("button");
        rightButton.type = "button";
        rightButton.className = "workspace-mini-action";
        rightButton.textContent = "→";
        rightButton.addEventListener("click", (event) => {
          event.stopPropagation();
          onWidgetMove?.(widget.id, 1);
        });
        rightButton.textContent = ">";
        actions.appendChild(rightButton);
      }
      card.append(meta, title, summary, actions);
      widgetGrid.appendChild(card);
    });
    container.appendChild(widgetGrid);
  }

  const shell = document.createElement("div");
  shell.className = "workspace-dashboard-shell";

  const metricGrid = document.createElement("div");
  metricGrid.className = "workspace-dashboard-metrics";
  visibleMetrics.forEach((metric) => {
    const card = document.createElement("article");
    card.className = "workspace-dashboard-kpi";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = metric.label || "Metric";
    const value = document.createElement("strong");
    value.textContent = metric.value || "-";
    const delta = document.createElement("span");
    delta.className = `workspace-dashboard-delta ${classifyDeltaTone(metric.delta)}`;
    delta.textContent = metric.delta || "Stable";
    card.append(label, value, delta);
    metricGrid.appendChild(card);
  });
  if (metricGrid.children.length) {
    shell.appendChild(metricGrid);
  }

  const activeChart =
    (model.charts || []).find((_, index) => `chart-${index + 1}` === String(activeChartId || "")) ||
    visibleCharts[0] ||
    null;
  if (activeChart) {
    const spotlight = document.createElement("article");
    spotlight.className = "workspace-dashboard-chart-card workspace-dashboard-chart-card--spotlight";
    const spotlightMeta = document.createElement("span");
    spotlightMeta.className = "tiny";
    spotlightMeta.textContent = `${activeChart.kind || "chart"} spotlight`;
    const spotlightTitle = document.createElement("h4");
    spotlightTitle.textContent = activeChart.title || "Active chart";
    const spotlightText = document.createElement("p");
    spotlightText.className = "muted";
    spotlightText.textContent = activeFilter
      ? `This view is focused on ${activeFilter}. Keep the selected chart aligned with that slice.`
      : "Use the active chart as the main story users should understand first.";
    spotlight.append(spotlightMeta, spotlightTitle, spotlightText);
    if ((activeChart.points || []).length) {
      const spotlightBars = document.createElement("div");
      spotlightBars.className = "workspace-dashboard-bars";
      const numericValues = (activeChart.points || [])
        .map((point) => parsePreviewNumber(point.value))
        .filter((value) => value !== null);
      const maxValue = numericValues.length ? Math.max(...numericValues, 1) : 1;
      (activeChart.points || []).slice(0, 8).forEach((point) => {
        const barGroup = document.createElement("div");
        barGroup.className = "workspace-dashboard-bar-group";
        const bar = document.createElement("div");
        bar.className = "workspace-dashboard-bar";
        const fill = document.createElement("div");
        fill.className = "workspace-dashboard-bar-fill";
        const numericValue = parsePreviewNumber(point.value);
        const ratio = numericValue !== null ? Math.max(10, Math.round((numericValue / maxValue) * 100)) : 36;
        fill.style.height = `${ratio}%`;
        bar.appendChild(fill);
        const pointLabel = document.createElement("span");
        pointLabel.className = "tiny";
        pointLabel.textContent = point.label || "Point";
        const pointValue = document.createElement("strong");
        pointValue.textContent = point.value || "-";
        barGroup.append(bar, pointLabel, pointValue);
        spotlightBars.appendChild(barGroup);
      });
      spotlight.appendChild(spotlightBars);
    }
    shell.appendChild(spotlight);
  }

  const chartGrid = document.createElement("div");
  chartGrid.className = "workspace-dashboard-chart-grid";
  visibleCharts.forEach((chart, index) => {
      const card = document.createElement("article");
    const chartKey = `chart-${(model.charts || []).findIndex((item) => item === chart) + 1}`;
    card.className = `workspace-dashboard-chart-card${chartKey === activeChartId ? " is-active" : ""}`;
    card.tabIndex = 0;
    card.addEventListener("click", () => onChartFocus?.(chartKey));
    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `${chart.kind || "chart"} ${index + 1}`;
    const title = document.createElement("h4");
    title.textContent = chart.title || `Chart ${index + 1}`;
    const actions = document.createElement("div");
    actions.className = "workspace-surface-card-actions";
    const focusButton = document.createElement("button");
    focusButton.type = "button";
    focusButton.className = "workspace-mini-action";
    focusButton.textContent = "Edit";
    focusButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onChartFocus?.(chartKey);
    });
    actions.appendChild(focusButton);
    card.append(meta, title, actions);

    if ((chart.points || []).length) {
      const bars = document.createElement("div");
      bars.className = "workspace-dashboard-bars";
      const numericValues = (chart.points || [])
        .map((point) => parsePreviewNumber(point.value))
        .filter((value) => value !== null);
      const maxValue = numericValues.length ? Math.max(...numericValues, 1) : 1;

      (chart.points || []).slice(0, 6).forEach((point) => {
        const barGroup = document.createElement("div");
        barGroup.className = "workspace-dashboard-bar-group";
        const bar = document.createElement("div");
        bar.className = "workspace-dashboard-bar";
        const fill = document.createElement("div");
        fill.className = "workspace-dashboard-bar-fill";
        const numericValue = parsePreviewNumber(point.value);
        const ratio = numericValue !== null ? Math.max(8, Math.round((numericValue / maxValue) * 100)) : 36;
        fill.style.height = `${ratio}%`;
        bar.appendChild(fill);
        const pointLabel = document.createElement("span");
        pointLabel.className = "tiny";
        pointLabel.textContent = point.label || "Point";
        const pointValue = document.createElement("strong");
        pointValue.textContent = point.value || "-";
        barGroup.append(bar, pointLabel, pointValue);
        bars.appendChild(barGroup);
      });

      card.appendChild(bars);
    } else {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No chart points yet.";
      card.appendChild(empty);
    }

    chartGrid.appendChild(card);
  });
  if (chartGrid.children.length) {
    shell.appendChild(chartGrid);
  }

  if (shell.children.length) {
    container.appendChild(shell);
  }

  if (model.table?.columns?.length) {
    renderDataPreview(
      container,
      "table.csv",
      [
        model.table.columns.join(","),
        ...(model.table.rows || []).map((row) => row.map((cell) => String(cell || "")).join(","))
      ].join("\n")
    );
  }
}

function renderWorkflowExperiencePreview(
  container,
  content = "",
  {
    activeStageId = "",
    activeLinkId = "",
    onStageFocus = null,
    onStageMove = null,
    onWorkflowLinkCreate = null,
    onLinkFocus = null,
    onWorkflowLinkRemove = null,
    onStagePositionChange = null
  } = {}
) {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderWorkflowPreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = `${model.objective || "Workflow"} - Trigger: ${model.trigger || "manual"}`;
  container.appendChild(summary);

  const stageNodes = Array.isArray(model.stages) ? model.stages : [];
  const stageLinks = Array.isArray(model.links) ? model.links : [];
  let pendingLinkSourceId = "";
  const stageCardMap = new Map();

  const linkHelper = document.createElement("div");
  linkHelper.className = "workspace-flow-chip-list workspace-workflow-link-builder";
  const linkHelperText = document.createElement("span");
  linkHelperText.className = "workspace-flow-chip";
  const linkHelperClear = document.createElement("button");
  linkHelperClear.type = "button";
  linkHelperClear.className = "workspace-flow-chip workspace-flow-chip-button";
  linkHelperClear.textContent = "Clear";
  linkHelperClear.addEventListener("click", () => {
    pendingLinkSourceId = "";
    refreshPendingLinkState();
  });
  linkHelper.append(linkHelperText, linkHelperClear);
  container.appendChild(linkHelper);

  function refreshPendingLinkState() {
    if (pendingLinkSourceId) {
      const sourceStage = stageNodes.find((stage) => stage.id === pendingLinkSourceId);
      linkHelperText.textContent = `Connecting from ${sourceStage?.label || "selected step"} ? click Link to on another step`;
      linkHelperClear.hidden = false;
    } else {
      linkHelperText.textContent = "Click Link from, then Link to, to connect steps directly on the canvas.";
      linkHelperClear.hidden = true;
    }

    stageCardMap.forEach((card, stageId) => {
      card.classList.toggle("is-linking-source", stageId === pendingLinkSourceId);
      const input = card.querySelector("[data-link-role='input']");
      const output = card.querySelector("[data-link-role='output']");
      if (input) {
        input.disabled = !pendingLinkSourceId || pendingLinkSourceId === stageId;
      }
      if (output) {
        output.textContent = pendingLinkSourceId === stageId ? "Linking..." : "Link from";
      }
    });
  }

  const workflowShell = document.createElement("div");
  workflowShell.className = "workspace-workflow-shell";
  const workflowCanvas = document.createElement("div");
  workflowCanvas.className = "workspace-workflow-canvas";
  workflowCanvas.addEventListener("click", (event) => {
    if (event.target === workflowCanvas) {
      pendingLinkSourceId = "";
      refreshPendingLinkState();
    }
  });

  const lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lineSvg.setAttribute("class", "workspace-workflow-lines");
  lineSvg.setAttribute("viewBox", "0 0 920 420");
  lineSvg.setAttribute("preserveAspectRatio", "none");
  workflowCanvas.appendChild(lineSvg);

  stageLinks.forEach((link) => {
    const fromStage = stageNodes.find((stage) => stage.id === link.from);
    const toStage = stageNodes.find((stage) => stage.id === link.to);
    if (!fromStage || !toStage) {
      return;
    }

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String((Number(fromStage.x) || 0) + 98));
    line.setAttribute("y1", String((Number(fromStage.y) || 0) + 56));
    line.setAttribute("x2", String((Number(toStage.x) || 0) + 98));
    line.setAttribute("y2", String((Number(toStage.y) || 0) + 56));
    line.setAttribute("class", `workspace-workflow-line${link.id === activeLinkId ? " is-active" : ""}`);
    lineSvg.appendChild(line);

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `workspace-workflow-link-chip${link.id === activeLinkId ? " is-active" : ""}`;
    chip.style.left = `${(((Number(fromStage.x) || 0) + (Number(toStage.x) || 0)) / 2) + 60}px`;
    chip.style.top = `${(((Number(fromStage.y) || 0) + (Number(toStage.y) || 0)) / 2) + 38}px`;
    chip.addEventListener("click", () => onLinkFocus?.(link.id || ""));
    const label = document.createElement("span");
    label.textContent = link.label || "Next";
    chip.appendChild(label);
    const remove = document.createElement("span");
    remove.className = "workspace-link-remove";
    remove.textContent = "?";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      onWorkflowLinkRemove?.(link.id || "");
    });
    chip.appendChild(remove);
    workflowCanvas.appendChild(chip);
  });

  stageNodes.forEach((stage, index) => {
    const card = document.createElement("article");
    card.className = `workspace-workflow-stage workspace-workflow-node${stage.id === activeStageId ? " is-active" : ""}`;
    card.tabIndex = 0;
    card.style.left = `${Number(stage.x) || 0}px`;
    card.style.top = `${Number(stage.y) || 0}px`;
    card.addEventListener("click", () => {
      if (pendingLinkSourceId && pendingLinkSourceId !== stage.id) {
        onWorkflowLinkCreate?.(pendingLinkSourceId, stage.id);
        pendingLinkSourceId = "";
        refreshPendingLinkState();
      }
      onStageFocus?.(stage.id);
    });
    attachPreviewDrag(card, {
      initialX: Number(stage.x) || 0,
      initialY: Number(stage.y) || 0,
      getBounds: () => ({ width: workflowCanvas.clientWidth || 920, height: workflowCanvas.clientHeight || 420 }),
      maxX: 920 - 212,
      maxY: 420 - 128,
      onCommit: (x, y) => onStagePositionChange?.(stage.id, x, y)
    });

    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `Step ${index + 1}`;
    const title = document.createElement("h4");
    title.textContent = stage.label || `Step ${index + 1}`;
    const owner = document.createElement("span");
    owner.className = "workspace-flow-chip";
    owner.textContent = stage.owner || "Hydria";
    const note = document.createElement("p");
    note.textContent = stage.note || "No note yet.";
    const ownerRow = document.createElement("div");
    ownerRow.className = "workspace-flow-chip-list";
    ownerRow.appendChild(owner);
    const ports = document.createElement("div");
    ports.className = "workspace-workflow-port-row";
    const outputPort = document.createElement("button");
    outputPort.type = "button";
    outputPort.className = "workspace-workflow-port workspace-workflow-port-out workspace-preview-ignore-drag";
    outputPort.dataset.linkRole = "output";
    outputPort.textContent = "Link from";
    outputPort.addEventListener("click", (event) => {
      event.stopPropagation();
      pendingLinkSourceId = stage.id;
      onStageFocus?.(stage.id);
      refreshPendingLinkState();
    });
    const inputPort = document.createElement("button");
    inputPort.type = "button";
    inputPort.className = "workspace-workflow-port workspace-workflow-port-in workspace-preview-ignore-drag";
    inputPort.dataset.linkRole = "input";
    inputPort.textContent = "Link to";
    inputPort.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!pendingLinkSourceId || pendingLinkSourceId === stage.id) {
        return;
      }
      onWorkflowLinkCreate?.(pendingLinkSourceId, stage.id);
      pendingLinkSourceId = "";
      onStageFocus?.(stage.id);
      refreshPendingLinkState();
    });
    ports.append(outputPort, inputPort);

    const actions = document.createElement("div");
    actions.className = "workspace-surface-card-actions";
    if (index > 0) {
      const leftButton = document.createElement("button");
      leftButton.type = "button";
      leftButton.className = "workspace-mini-action";
      leftButton.textContent = "<";
      leftButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onStageMove?.(stage.id, -1);
      });
      actions.appendChild(leftButton);
    }
    const focusButton = document.createElement("button");
    focusButton.type = "button";
    focusButton.className = "workspace-mini-action";
    focusButton.textContent = "Edit";
    focusButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onStageFocus?.(stage.id);
    });
    actions.appendChild(focusButton);
    if (index < stageNodes.length - 1) {
      const rightButton = document.createElement("button");
      rightButton.type = "button";
      rightButton.className = "workspace-mini-action";
      rightButton.textContent = ">";
      rightButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onStageMove?.(stage.id, 1);
      });
      actions.appendChild(rightButton);
    }

    card.append(meta, title, note, ownerRow, ports, actions);
    stageCardMap.set(stage.id, card);
    workflowCanvas.appendChild(card);
  });

  workflowShell.appendChild(workflowCanvas);

  const metaGrid = document.createElement("div");
  metaGrid.className = "workspace-workflow-meta-grid";

  if ((model.automations || []).length) {
    const automationCard = document.createElement("article");
    automationCard.className = "workspace-workflow-meta-card";
    const automationTitle = document.createElement("strong");
    automationTitle.textContent = "Automations";
    const list = document.createElement("ul");
    (model.automations || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    automationCard.append(automationTitle, list);
    metaGrid.appendChild(automationCard);
  }

  if ((model.outputs || []).length) {
    const outputsCard = document.createElement("article");
    outputsCard.className = "workspace-workflow-meta-card";
    const outputsTitle = document.createElement("strong");
    outputsTitle.textContent = "Outputs";
    const chips = document.createElement("div");
    chips.className = "workspace-flow-chip-list";
    (model.outputs || []).forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "workspace-flow-chip";
      chip.textContent = item;
      chips.appendChild(chip);
    });
    outputsCard.append(outputsTitle, chips);
    metaGrid.appendChild(outputsCard);
  }

  if (metaGrid.children.length) {
    workflowShell.appendChild(metaGrid);
  }

  container.appendChild(workflowShell);
  refreshPendingLinkState();
}
function renderDesignExperiencePreview(
  container,
  content = "",
  {
    activeFrameId = "",
    activeBlockId = "",
    onFrameFocus = null,
    onBlockFocus = null,
    onBlockMove = null,
    onBlockPositionChange = null,
    onBlockResize = null
  } = {}
) {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderDesignPreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.brief || "Design surface";
  container.appendChild(summary);

  if ((model.components || []).length) {
    const componentChips = document.createElement("div");
    componentChips.className = "workspace-flow-chip-list";
    (model.components || []).forEach((component) => {
      const chip = document.createElement("span");
      chip.className = "workspace-flow-chip";
      chip.textContent = component;
      componentChips.appendChild(chip);
    });
    container.appendChild(componentChips);
  }

  const designShell = document.createElement("div");
  designShell.className = "workspace-design-shell";
  const activeFrame =
    (model.frames || []).find((frame) => frame.id === activeFrameId) ||
    (model.frames || [])[0] ||
    null;

  const designPalette = document.createElement("div");
  designPalette.className = "workspace-design-palette";
  (model.palette || []).forEach((token) => {
    const card = document.createElement("article");
    card.className = "workspace-design-swatch";
    const swatch = document.createElement("div");
    swatch.className = "workspace-design-swatch-fill";
    swatch.style.background = token.value || "#ddd";
    const title = document.createElement("h4");
    title.textContent = token.name || "Color";
    const meta = document.createElement("p");
    meta.textContent = token.value || "";
    card.append(swatch, title, meta);
    designPalette.appendChild(card);
  });
  if (designPalette.children.length) {
    designShell.appendChild(designPalette);
  }

  if (activeFrame) {
    const stage = document.createElement("section");
    stage.className = "workspace-design-stage";
    const stageHeader = document.createElement("div");
    stageHeader.className = "workspace-design-stage-header";
    const stageMeta = document.createElement("div");
    stageMeta.className = "workspace-design-stage-meta";
    const stageTitle = document.createElement("strong");
    stageTitle.textContent = activeFrame.name || "Active frame";
    const stageGoal = document.createElement("span");
    stageGoal.className = "muted";
    stageGoal.textContent = activeFrame.goal || "Shape the active screen directly on the canvas.";
    stageMeta.append(stageTitle, stageGoal);
    const stageActions = document.createElement("div");
    stageActions.className = "workspace-flow-chip-list";
    const focusChip = document.createElement("span");
    focusChip.className = "workspace-flow-chip";
    focusChip.textContent = `${(activeFrame.blocks || []).length} layout blocks`;
    stageActions.appendChild(focusChip);
    stageHeader.append(stageMeta, stageActions);

    const stageCanvas = document.createElement("div");
    stageCanvas.className = "workspace-design-frame-canvas workspace-design-layout-canvas workspace-design-stage-canvas";

    (activeFrame.blocks || []).forEach((blockModel, blockIndex) => {
      const block = document.createElement("button");
      block.type = "button";
      block.className = `workspace-design-frame-block workspace-design-layout-block${
        activeBlockId === blockModel.id ? " is-active" : ""
      }`;
      block.style.left = `${Number(blockModel.x) || 0}px`;
      block.style.top = `${Number(blockModel.y) || 0}px`;
      block.style.width = `${Number(blockModel.w) || 160}px`;
      block.style.height = `${Number(blockModel.h) || 36}px`;
      block.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockFocus?.(activeFrame.id, blockModel.id);
      });
      attachPreviewDrag(block, {
        initialX: Number(blockModel.x) || 0,
        initialY: Number(blockModel.y) || 0,
        getBounds: () => ({ width: stageCanvas.clientWidth || 720, height: stageCanvas.clientHeight || 360 }),
        maxX: (stageCanvas.clientWidth || 720) - (Number(blockModel.w) || 160) - 12,
        maxY: (stageCanvas.clientHeight || 360) - (Number(blockModel.h) || 36) - 12,
        onCommit: (x, y) => onBlockPositionChange?.(activeFrame.id, blockModel.id, x, y)
      });

      const label = document.createElement("span");
      label.className = "workspace-design-frame-block-label";
      label.textContent = blockModel.label || `Block ${blockIndex + 1}`;
      block.appendChild(label);

      const actions = document.createElement("span");
      actions.className = "workspace-design-frame-block-actions";
      const focus = document.createElement("span");
      focus.className = "workspace-design-frame-block-action";
      focus.textContent = "Edit";
      focus.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockFocus?.(activeFrame.id, blockModel.id);
      });
      actions.appendChild(focus);
      block.appendChild(actions);

      const resizeHandle = document.createElement("span");
      resizeHandle.className = "workspace-preview-resize-handle workspace-design-resize-handle";
      resizeHandle.title = "Resize block";
      block.appendChild(resizeHandle);
      attachPreviewResize(resizeHandle, {
        target: block,
        initialWidth: Number(blockModel.w) || 160,
        initialHeight: Number(blockModel.h) || 36,
        getBounds: () => ({ width: stageCanvas.clientWidth || 720, height: stageCanvas.clientHeight || 360 }),
        minWidth: 80,
        minHeight: 24,
        onCommit: (nextWidth, nextHeight) =>
          onBlockResize?.(
            activeFrame.id,
            blockModel.id,
            (Number(nextWidth) || 160) - (Number(blockModel.w) || 160),
            (Number(nextHeight) || 36) - (Number(blockModel.h) || 36)
          )
      });
      stageCanvas.appendChild(block);
    });

    stage.append(stageHeader, stageCanvas);
    designShell.appendChild(stage);
  }

  const designFrames = document.createElement("div");
  designFrames.className = "workspace-design-frames";
  (model.frames || []).forEach((frameModel, index) => {
    const card = document.createElement("article");
    card.className = `workspace-design-frame${frameModel.id === activeFrameId ? " is-active" : ""}`;
    card.tabIndex = 0;
    card.addEventListener("click", () => onFrameFocus?.(frameModel.id));

    const canvas = document.createElement("div");
    canvas.className = "workspace-design-frame-canvas workspace-design-layout-canvas";

    (frameModel.blocks || []).forEach((blockModel, blockIndex) => {
      const block = document.createElement("button");
      block.type = "button";
      block.className = `workspace-design-frame-block workspace-design-layout-block${
        frameModel.id === activeFrameId && activeBlockId === blockModel.id ? " is-active" : ""
      }`;
      block.style.left = `${Number(blockModel.x) || 0}px`;
      block.style.top = `${Number(blockModel.y) || 0}px`;
      block.style.width = `${Number(blockModel.w) || 160}px`;
      block.style.height = `${Number(blockModel.h) || 36}px`;
      block.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockFocus?.(frameModel.id, blockModel.id);
      });
      attachPreviewDrag(block, {
        initialX: Number(blockModel.x) || 0,
        initialY: Number(blockModel.y) || 0,
        getBounds: () => ({ width: canvas.clientWidth || 280, height: canvas.clientHeight || 260 }),
        maxX: (canvas.clientWidth || 280) - (Number(blockModel.w) || 160) - 8,
        maxY: (canvas.clientHeight || 260) - (Number(blockModel.h) || 36) - 8,
        onCommit: (x, y) => onBlockPositionChange?.(frameModel.id, blockModel.id, x, y)
      });

      const label = document.createElement("span");
      label.className = "workspace-design-frame-block-label";
      label.textContent = blockModel.label || `Block ${blockIndex + 1}`;
      block.appendChild(label);

      const actions = document.createElement("span");
      actions.className = "workspace-design-frame-block-actions";
      if (blockIndex > 0) {
        const left = document.createElement("span");
        left.className = "workspace-design-frame-block-action";
        left.textContent = "<";
        left.addEventListener("click", (event) => {
          event.stopPropagation();
          onBlockMove?.(frameModel.id, blockModel.id, -1);
        });
        actions.appendChild(left);
      }
      if (blockIndex < (frameModel.blocks || []).length - 1) {
        const right = document.createElement("span");
        right.className = "workspace-design-frame-block-action";
        right.textContent = ">";
        right.addEventListener("click", (event) => {
          event.stopPropagation();
          onBlockMove?.(frameModel.id, blockModel.id, 1);
        });
        actions.appendChild(right);
      }
      if (actions.children.length) {
        block.appendChild(actions);
      }
      const resizeActions = document.createElement("span");
      resizeActions.className = "workspace-design-frame-block-actions";
      const shrink = document.createElement("span");
      shrink.className = "workspace-design-frame-block-action";
      shrink.textContent = "-";
      shrink.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockResize?.(frameModel.id, blockModel.id, -28, -10);
      });
      const grow = document.createElement("span");
      grow.className = "workspace-design-frame-block-action";
      grow.textContent = "+";
      grow.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockResize?.(frameModel.id, blockModel.id, 28, 10);
      });
      resizeActions.append(shrink, grow);
      block.appendChild(resizeActions);
      const resizeHandle = document.createElement("span");
      resizeHandle.className = "workspace-preview-resize-handle workspace-design-resize-handle";
      resizeHandle.title = "Resize block";
      block.appendChild(resizeHandle);
      attachPreviewResize(resizeHandle, {
        target: block,
        initialWidth: Number(blockModel.w) || 160,
        initialHeight: Number(blockModel.h) || 36,
        getBounds: () => ({ width: canvas.clientWidth || 280, height: canvas.clientHeight || 260 }),
        minWidth: 80,
        minHeight: 24,
        onCommit: (nextWidth, nextHeight) =>
          onBlockResize?.(
            frameModel.id,
            blockModel.id,
            (Number(nextWidth) || 160) - (Number(blockModel.w) || 160),
            (Number(nextHeight) || 36) - (Number(blockModel.h) || 36)
          )
      });
      canvas.appendChild(block);
    });

    const name = document.createElement("strong");
    name.textContent = frameModel.name || `Frame ${index + 1}`;
    const goal = document.createElement("span");
    goal.className = "muted";
    goal.textContent = frameModel.goal || `Wireframe ${index + 1}`;
    card.append(canvas, name, goal);
    designFrames.appendChild(card);
  });
  if (designFrames.children.length) {
    designShell.appendChild(designFrames);
  }

  if (designShell.children.length) {
    container.appendChild(designShell);
  }
  return;

  const shell = document.createElement("div");
  shell.className = "workspace-design-shell";

  const palette = document.createElement("div");
  palette.className = "workspace-design-palette";
  (model.palette || []).forEach((token) => {
    const card = document.createElement("article");
    card.className = "workspace-design-swatch";
    const swatch = document.createElement("div");
    swatch.className = "workspace-design-swatch-fill";
    swatch.style.background = token.value || "#ddd";
    const title = document.createElement("h4");
    title.textContent = token.name || "Color";
    const meta = document.createElement("p");
    meta.textContent = token.value || "";
    card.append(swatch, title, meta);
    palette.appendChild(card);
  });
  if (palette.children.length) {
    shell.appendChild(palette);
  }

  const frames = document.createElement("div");
  frames.className = "workspace-design-frames";
  (model.frames || []).forEach((frameModel, index) => {
    const card = document.createElement("article");
    card.className = `workspace-design-frame${frameModel.id === activeFrameId ? " is-active" : ""}`;
    card.tabIndex = 0;
    card.addEventListener("click", () => onFrameFocus?.(frameModel.id));

    const canvas = document.createElement("div");
    canvas.className = "workspace-design-frame-canvas";
    const topBar = document.createElement("div");
    topBar.className = "workspace-design-frame-header";
    const hero = document.createElement("div");
    hero.className = "workspace-design-frame-hero";
    const detailRow = document.createElement("div");
    detailRow.className = "workspace-design-frame-detail-row";
    const detailOne = document.createElement("span");
    detailOne.className = "workspace-design-frame-detail";
    const detailTwo = document.createElement("span");
    detailTwo.className = "workspace-design-frame-detail";
    const cta = document.createElement("div");
    cta.className = "workspace-design-frame-cta";
    detailRow.append(detailOne, detailTwo);
    canvas.append(topBar, hero, detailRow, cta);

    const blockList = document.createElement("div");
    blockList.className = "workspace-design-frame-blocks";
    (frameModel.blocks || []).forEach((blockLabel, blockIndex) => {
      const block = document.createElement("button");
      block.type = "button";
      block.className = `workspace-design-frame-block${
        frameModel.id === activeFrameId && activeBlockId === `block-${blockIndex + 1}` ? " is-active" : ""
      }`;
      block.textContent = blockLabel;
      block.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockFocus?.(frameModel.id, blockIndex);
      });
      const actions = document.createElement("span");
      actions.className = "workspace-design-frame-block-actions";
      if (blockIndex > 0) {
        const left = document.createElement("span");
        left.className = "workspace-design-frame-block-action";
        left.textContent = "←";
        left.addEventListener("click", (event) => {
          event.stopPropagation();
          onBlockMove?.(frameModel.id, blockIndex, -1);
        });
        actions.appendChild(left);
      }
      if (blockIndex < (frameModel.blocks || []).length - 1) {
        const right = document.createElement("span");
        right.className = "workspace-design-frame-block-action";
        right.textContent = "→";
        right.addEventListener("click", (event) => {
          event.stopPropagation();
          onBlockMove?.(frameModel.id, blockIndex, 1);
        });
        actions.appendChild(right);
      }
      if (actions.children.length) {
        block.appendChild(actions);
      }
      blockList.appendChild(block);
    });
    if (blockList.children.length) {
      canvas.appendChild(blockList);
    }

    const name = document.createElement("strong");
    name.textContent = frameModel.name || `Frame ${index + 1}`;
    const goal = document.createElement("span");
    goal.className = "muted";
    goal.textContent = frameModel.goal || `Wireframe ${index + 1}`;
    card.append(canvas, name, goal);
    frames.appendChild(card);
  });
  if (frames.children.length) {
    shell.appendChild(frames);
  }

  if (shell.children.length) {
    container.appendChild(shell);
  }
}

function renderMediaPreview(container, filePath = "", assetUrl = "") {
  const shell = document.createElement("div");
  shell.className = "workspace-media-shell";

  if (!assetUrl) {
    const empty = document.createElement("div");
    empty.className = "workspace-surface-empty";
    empty.textContent = "No previewable media asset is available for this surface.";
    shell.appendChild(empty);
    container.appendChild(shell);
    return;
  }

  if (isImagePath(filePath)) {
    const image = document.createElement("img");
    image.src = assetUrl;
    image.alt = filePath;
    shell.appendChild(image);
  } else if (isAudioPath(filePath)) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = assetUrl;
    shell.appendChild(audio);
  } else if (isVideoPath(filePath)) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = assetUrl;
    video.playsInline = true;
    shell.appendChild(video);
  } else {
    const fallback = document.createElement("a");
    fallback.href = assetUrl;
    fallback.target = "_blank";
    fallback.rel = "noreferrer noopener";
    fallback.textContent = "Open media asset";
    shell.appendChild(fallback);
  }

  container.appendChild(shell);
}

function renderBenchmarkExperiencePreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderDataPreview(container, "benchmark.json", content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.objective || "Project benchmark";
  container.appendChild(summary);

  if ((model.criteria || []).length) {
    const criteriaGrid = document.createElement("div");
    criteriaGrid.className = "workspace-overview-meta";
    (model.criteria || []).forEach((criterion) => {
      const card = document.createElement("article");
      card.className = "workspace-overview-card";
      const label = document.createElement("span");
      label.className = "tiny";
      label.textContent = criterion.label || criterion.id || "Criterion";
      const why = document.createElement("strong");
      why.textContent = criterion.why || "Review this dimension.";
      card.append(label, why);
      criteriaGrid.appendChild(card);
    });
    container.appendChild(criteriaGrid);
  }

  if ((model.competitors || []).length) {
    const competitors = document.createElement("div");
    competitors.className = "workspace-design-frames";
    (model.competitors || []).forEach((competitor, index) => {
      const card = document.createElement("article");
      card.className = "workspace-design-frame";
      const meta = document.createElement("span");
      meta.className = "tiny";
      meta.textContent = `Competitor ${index + 1}`;
      const title = document.createElement("strong");
      title.textContent = competitor.name || "Competitor";
      const positioning = document.createElement("p");
      positioning.textContent = competitor.positioning || "";
      const chips = document.createElement("div");
      chips.className = "workspace-flow-chip-list";
      Object.entries(competitor.scorecard || {}).forEach(([key, value]) => {
        const chip = document.createElement("span");
        chip.className = "workspace-flow-chip";
        chip.textContent = `${key}: ${value}/5`;
        chips.appendChild(chip);
      });
      card.append(meta, title, positioning);
      if (chips.children.length) {
        card.appendChild(chips);
      }
      competitors.appendChild(card);
    });
    container.appendChild(competitors);
  }

  if ((model.recommendations || []).length) {
    const recommendations = document.createElement("div");
    recommendations.className = "workspace-surface-card";
    const title = document.createElement("strong");
    title.textContent = "Recommendations";
    const list = document.createElement("ul");
    (model.recommendations || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    recommendations.append(title, list);
    container.appendChild(recommendations);
  }
}

function renderCampaignExperiencePreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderDataPreview(container, "campaign.json", content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.corePromise || model.objective || "Campaign surface";
  container.appendChild(summary);

  if ((model.audiences || []).length) {
    const audiences = document.createElement("div");
    audiences.className = "workspace-overview-meta";
    (model.audiences || []).forEach((audience) => {
      const card = document.createElement("article");
      card.className = "workspace-overview-card";
      const label = document.createElement("span");
      label.className = "tiny";
      label.textContent = audience.segment || "Audience";
      const message = document.createElement("strong");
      message.textContent = audience.message || "";
      const hook = document.createElement("span");
      hook.className = "muted";
      hook.textContent = audience.hook || "";
      card.append(label, message, hook);
      audiences.appendChild(card);
    });
    container.appendChild(audiences);
  }

  const columns = document.createElement("div");
  columns.className = "workspace-dashboard-chart-grid";

  if ((model.channels || []).length) {
    const card = document.createElement("article");
    card.className = "workspace-dashboard-chart-card";
    const title = document.createElement("h4");
    title.textContent = "Channels";
    const list = document.createElement("ul");
    (model.channels || []).forEach((channel) => {
      const li = document.createElement("li");
      li.textContent = `${channel.name || "Channel"} - ${channel.goal || ""}`;
      list.appendChild(li);
    });
    card.append(title, list);
    columns.appendChild(card);
  }

  if ((model.timeline || []).length) {
    const card = document.createElement("article");
    card.className = "workspace-dashboard-chart-card";
    const title = document.createElement("h4");
    title.textContent = "Timeline";
    const list = document.createElement("ul");
    (model.timeline || []).forEach((step) => {
      const li = document.createElement("li");
      li.textContent = `${step.phase || "Phase"} - ${step.focus || ""}`;
      list.appendChild(li);
    });
    card.append(title, list);
    columns.appendChild(card);
  }

  if (columns.children.length) {
    container.appendChild(columns);
  }

  if ((model.assets || []).length || (model.kpis || []).length) {
    const chips = document.createElement("div");
    chips.className = "workspace-flow-chip-list";
    [...(model.assets || []), ...(model.kpis || [])].forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "workspace-flow-chip";
      chip.textContent = item;
      chips.appendChild(chip);
    });
    container.appendChild(chips);
  }
}

function renderAudioExperiencePreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderCodePreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.objective || "Audio brief";
  container.appendChild(summary);

  const meta = document.createElement("div");
  meta.className = "workspace-flow-chip-list";
  [model.format, model.duration, model.voice?.tone].filter(Boolean).forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "workspace-flow-chip";
    chip.textContent = item;
    meta.appendChild(chip);
  });
  if (meta.children.length) {
    container.appendChild(meta);
  }

  const segments = document.createElement("div");
  segments.className = "workspace-design-frames";
  (model.segments || []).forEach((segment, index) => {
    const card = document.createElement("article");
    card.className = "workspace-design-frame";
    const metaLabel = document.createElement("span");
    metaLabel.className = "tiny";
    metaLabel.textContent = `Segment ${index + 1}`;
    const title = document.createElement("strong");
    title.textContent = segment.title || "Segment";
    const script = document.createElement("p");
    script.textContent = segment.script || segment.purpose || "";
    const cue = document.createElement("span");
    cue.className = "muted";
    cue.textContent = segment.cue || "";
    card.append(metaLabel, title, script, cue);
    segments.appendChild(card);
  });
  if (segments.children.length) {
    container.appendChild(segments);
  }
}

function renderVideoExperiencePreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderCodePreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.objective || "Video brief";
  container.appendChild(summary);

  const meta = document.createElement("div");
  meta.className = "workspace-flow-chip-list";
  [model.runtime, model.visualDirection].filter(Boolean).forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "workspace-flow-chip";
    chip.textContent = item;
    meta.appendChild(chip);
  });
  if (meta.children.length) {
    container.appendChild(meta);
  }

  const scenes = document.createElement("div");
  scenes.className = "workspace-design-frames";
  (model.scenes || []).forEach((scene, index) => {
    const card = document.createElement("article");
    card.className = "workspace-design-frame";
    const metaLabel = document.createElement("span");
    metaLabel.className = "tiny";
    metaLabel.textContent = scene.duration || `Scene ${index + 1}`;
    const title = document.createElement("strong");
    title.textContent = scene.title || `Scene ${index + 1}`;
    const visual = document.createElement("p");
    visual.textContent = scene.visual || "";
    const voiceover = document.createElement("p");
    voiceover.className = "muted";
    voiceover.textContent = scene.voiceover || scene.onScreen || "";
    card.append(metaLabel, title, visual, voiceover);
    scenes.appendChild(card);
  });
  if (scenes.children.length) {
    container.appendChild(scenes);
  }
}

function buildRuntimeAssetUrl(workObjectId = "", entryPath = "") {
  const normalized = normalizePath(entryPath);
  const encodedPath = normalized
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  return normalized
    ? `/api/work-objects/${encodeURIComponent(String(workObjectId || ""))}/assets/${encodedPath}`
    : "";
}

function resolveRuntimeAssetPath(baseEntryPath = "", relativeAssetPath = "") {
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

  const baseParts = normalizedBase.split("/").filter(Boolean);
  baseParts.pop();

  for (const part of normalizedRelative.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      baseParts.pop();
      continue;
    }
    baseParts.push(part);
  }

  return baseParts.join("/");
}

function rewriteDraftRuntimeHtml(html = "", workObject = null, runtimeEntryPath = "") {
  const normalized = String(html || "");
  if (!normalized || !workObject?.id || !runtimeEntryPath) {
    return normalized;
  }

  const rewritten = normalized.replace(
    /\b(src|href)=["']([^"'#][^"']*)["']/gi,
    (match, attr, rawValue) => {
      const resolvedPath = resolveRuntimeAssetPath(runtimeEntryPath, rawValue);
      if (!resolvedPath || /^(?:https?:|data:|blob:|mailto:|tel:|javascript:|\/)/i.test(resolvedPath)) {
        return match;
      }

      const assetUrl = buildRuntimeAssetUrl(workObject.id, resolvedPath);
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

function renderAppPreview(container, assetUrl = "", options = {}) {
  const shell = document.createElement("div");
  shell.className = "workspace-app-shell";

  if (!assetUrl && !options.srcdoc) {
    const empty = document.createElement("div");
    empty.className = "workspace-surface-empty";
    empty.textContent = "No app preview is available yet for this object.";
    shell.appendChild(empty);
    container.appendChild(shell);
    return;
  }

  const frame = document.createElement("iframe");
  frame.className = "workspace-app-frame";
  if (options.srcdoc) {
    frame.srcdoc = options.srcdoc;
  } else {
    frame.src = assetUrl;
  }
  frame.title = "Hydria app preview";
  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals");
  shell.appendChild(frame);
  container.appendChild(shell);
}

function classifyRuntimePatch(runtimePatch = {}, runtimeSession = null, surfaceModel = null) {
  const entryPath = normalizePath(runtimePatch?.entryPath || "");
  const runtimeEntryPath = normalizePath(
    surfaceModel?.runtimeEntryPath || runtimeSession?.entryPath || ""
  );

  if (!entryPath) {
    return "reload";
  }
  if (/\.css$/i.test(entryPath)) {
    return "css";
  }
  if (/\.html?$/i.test(entryPath) && entryPath === runtimeEntryPath) {
    return "html";
  }
  return "reload";
}

function applyRuntimePatch(frame, runtimePatch = null, runtimeSession = null, surfaceModel = null) {
  if (!frame?.contentWindow || !runtimePatch || !runtimeSession?.id) {
    return false;
  }

  const patchType = classifyRuntimePatch(runtimePatch, runtimeSession, surfaceModel);
  if (patchType === "reload") {
    return false;
  }

  frame.contentWindow.postMessage(
    {
      type: "hydria-runtime-patch",
      sessionId: runtimeSession.id,
      runtimeVersion: Number(runtimePatch.runtimeVersion || runtimeSession.runtimeVersion || 0),
      patchType,
      entryPath: runtimePatch.entryPath || "",
      content: runtimePatch.content || ""
    },
    "*"
  );
  return true;
}

function upsertPreviewHeader(container, { titleText = "", metaText = "", kindText = "" } = {}) {
  let header = container.querySelector(".workspace-preview-header");
  let title;
  let meta;
  let kind;

  if (!header) {
    header = document.createElement("div");
    header.className = "workspace-preview-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "workspace-preview-title-group";
    title = document.createElement("strong");
    meta = document.createElement("span");
    meta.className = "tiny";
    titleGroup.append(title, meta);

    kind = document.createElement("span");
    kind.className = "workspace-preview-kind";

    header.append(titleGroup, kind);
    container.prepend(header);
  } else {
    title = header.querySelector(".workspace-preview-title-group strong");
    meta = header.querySelector(".workspace-preview-title-group .tiny");
    kind = header.querySelector(".workspace-preview-kind");
  }

  title.textContent = titleText;
  meta.textContent = metaText;
  kind.textContent = kindText;
  return header;
}

function renderSurfaceOverview(container, { workObject = null, project = null, sections = [], blocks = [] } = {}) {
  renderProjectOverview(container, { project, workObject, blocks });
  renderOutline(container, sections, "");

  const meta = document.createElement("div");
  meta.className = "workspace-overview-grid";
  const items = [
    {
      label: "Object",
      value: workObject?.title || "Hydria object"
    },
    {
      label: "Type",
      value: workObject?.objectKind || workObject?.kind || "document"
    },
    {
      label: "Revision",
      value: String(workObject?.revision || 1)
    },
    {
      label: "Primary file",
      value: workObject?.primaryFile || "-"
    }
  ];

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "workspace-overview-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = item.value;
    card.append(label, value);
    meta.appendChild(card);
  });

  container.appendChild(meta);
}

export function renderWorkspacePreview(
  container,
  {
    workObject = null,
    project = null,
    projectWorkObjects = [],
    filePath = "",
    content = "",
    surfaceModel = null,
    currentSurfaceId = "",
    runtimeSession = null,
    runtimePatch = null,
    editorDirty = false,
    selectedSectionId = "",
    sections = [],
    blocks = [],
    currentBlockId = "",
    selectedStructuredItemId = "",
    selectedStructuredSubItemId = "",
    activePreviewFilter = "",
    onDocumentSectionFocus = null,
    onDocumentInlineEdit = null,
    onProjectObjectSelect = null,
    onPresentationSlideFocus = null,
    onPresentationSlideEdit = null,
    onDataHeaderEdit = null,
    onDataCellEdit = null,
    onDataGridEdit = null,
    onDashboardFilterToggle = null,
    onDashboardWidgetMove = null,
    onDashboardWidgetDrop = null,
    onDashboardWidgetResize = null,
    onDashboardWidgetFocus = null,
    onDashboardChartFocus = null,
    onWorkflowStageFocus = null,
    onWorkflowStageMove = null,
    onWorkflowStagePositionChange = null,
    onWorkflowLinkCreate = null,
    onWorkflowLinkFocus = null,
    onWorkflowLinkRemove = null,
    onDesignFrameFocus = null,
    onDesignBlockFocus = null,
    onDesignBlockMove = null,
    onDesignBlockPositionChange = null,
    onDesignBlockResize = null
  } = {}
) {
  if (!workObject || !filePath) {
    container.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "tiny muted";
    empty.textContent = "Select a project object or file to preview it here.";
    container.appendChild(empty);
    return;
  }

  const normalizedPath = normalizePath(filePath);
  const section =
    selectedSectionId && selectedSectionId !== "whole-file"
      ? sections.find((item) => item.id === selectedSectionId)
      : null;
  const block = currentBlockId ? blocks.find((item) => item.id === currentBlockId) : null;
  const contentToRender = block?.block || section?.block || content;
  const objectKind = workObject.objectKind || workObject.kind || "document";
  const resolvedSurfaceId = currentSurfaceId || surfaceModel?.defaultSurface || "preview";
  const assetUrl = surfaceModel?.assetUrl || "";
  const mediaPreviewPath = surfaceModel?.previewAssetPath || normalizedPath;
  const mediaPreviewUrl = surfaceModel?.previewAssetUrl || assetUrl;
  const runtimeUrl = runtimeSession?.preview?.renderUrl || surfaceModel?.runtimeUrl || "";
  const runtimeLiveUrl = runtimeUrl
    ? `${runtimeUrl}${runtimeUrl.includes("?") ? "&" : "?"}rev=${encodeURIComponent(
        String(runtimeSession?.runtimeVersion || workObject?.revision || 1)
      )}`
    : "";
  const runtimeSessionStatus = runtimeSession?.status || "";
  const fileLabel = friendlyPathLabel(normalizedPath);
  const isDocumentMarkupFile =
    isMarkdownPath(normalizedPath) ||
    (
      workObject?.workspaceFamilyId === "document_knowledge" &&
      /\.html?$/i.test(normalizedPath) &&
      isRichDocumentHtml(contentToRender)
    );
  const metaText = block
    ? `${fileLabel} · ${block.title}`
    : section
      ? `${fileLabel} · ${section.title}`
      : fileLabel;
  const kindText =
    resolvedSurfaceId === "live"
      ? runtimeSessionStatus === "modified"
        ? "Live draft"
        : "Live"
      : toSurfaceLabel(resolvedSurfaceId);

  if (resolvedSurfaceId === "live") {
    upsertPreviewHeader(container, {
      titleText: workObject.title || "Hydria Object",
      metaText,
      kindText
    });

    let shell = container.querySelector(".workspace-app-shell");
    let frame = container.querySelector(".workspace-app-frame");
    if (!shell || !frame) {
      container.querySelectorAll(":scope > :not(.workspace-preview-header)").forEach((node) => node.remove());
      shell = document.createElement("div");
      shell.className = "workspace-app-shell";
      frame = document.createElement("iframe");
      frame.className = "workspace-app-frame";
      frame.title = "Hydria app preview";
      frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals");
      shell.appendChild(frame);
      container.appendChild(shell);
    }

    if (frame.getAttribute("srcdoc")) {
      frame.removeAttribute("srcdoc");
    }
    const runtimeSessionId = String(runtimeSession?.id || "");
    const nextRuntimeVersion = String(runtimeSession?.runtimeVersion || "");
    const sameSession = frame.dataset.runtimeSessionId === runtimeSessionId;
    const sameBase = frame.dataset.runtimeBase === runtimeUrl;
    const versionChanged = frame.dataset.runtimeVersion !== nextRuntimeVersion;

    if (!sameSession || !sameBase || !frame.dataset.runtimeLoaded) {
      frame.src = runtimeLiveUrl;
      frame.dataset.runtimeSrc = runtimeLiveUrl;
      frame.dataset.runtimeBase = runtimeUrl;
      frame.dataset.runtimeSessionId = runtimeSessionId;
      frame.dataset.runtimeVersion = nextRuntimeVersion;
      frame.dataset.runtimeLoaded = "1";
      return;
    }

    if (versionChanged) {
      const patched = applyRuntimePatch(frame, runtimePatch, runtimeSession, surfaceModel);
      if (!patched) {
        if (frame.dataset.runtimeSrc !== runtimeLiveUrl) {
          frame.src = runtimeLiveUrl;
          frame.dataset.runtimeSrc = runtimeLiveUrl;
        } else if (frame.contentWindow?.location) {
          frame.contentWindow.location.replace(runtimeLiveUrl);
        }
      }
      frame.dataset.runtimeVersion = nextRuntimeVersion;
    }
    return;
  }

  container.innerHTML = "";
  const header = document.createElement("div");
  header.className = "workspace-preview-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "workspace-preview-title-group";
  const title = document.createElement("strong");
  title.textContent = workObject.title || "Hydria Object";
  const meta = document.createElement("span");
  meta.className = "tiny";
  meta.textContent = metaText.replace(/Â·/g, "-");
  titleGroup.append(title, meta);

  const kind = document.createElement("span");
  kind.className = "workspace-preview-kind";
  kind.textContent = kindText;
  header.append(titleGroup, kind);
  container.appendChild(header);

  if (resolvedSurfaceId === "overview") {
    renderSurfaceOverview(container, { workObject, project, sections, blocks });
    return;
  }

  if (resolvedSurfaceId === "edit") {
    const empty = document.createElement("div");
    empty.className = "workspace-surface-empty";
    empty.textContent = "Editing mode is active. Use the editor pane to modify the selected surface directly.";
    container.appendChild(empty);
    return;
  }

  if (resolvedSurfaceId === "app") {
    renderAppPreview(container, assetUrl);
    return;
  }

  if (resolvedSurfaceId === "media") {
    renderMediaPreview(container, mediaPreviewPath, mediaPreviewUrl);
    return;
  }

  if (resolvedSurfaceId === "benchmark") {
    renderBenchmarkExperiencePreview(container, contentToRender);
    return;
  }

  if (resolvedSurfaceId === "campaign") {
    renderCampaignExperiencePreview(container, contentToRender);
    return;
  }

  if (resolvedSurfaceId === "audio") {
    renderAudioExperiencePreview(container, contentToRender);
    return;
  }

  if (resolvedSurfaceId === "video") {
    renderVideoExperiencePreview(container, contentToRender);
    return;
  }

  if (resolvedSurfaceId === "data") {
    renderDataPreview(container, normalizedPath, contentToRender, {
      workObject,
      onHeaderEdit: onDataHeaderEdit,
      onCellEdit: onDataCellEdit,
      onGridEdit: onDataGridEdit
    });
    return;
  }

  if (resolvedSurfaceId === "dashboard") {
    renderDashboardExperiencePreview(container, contentToRender, {
      activeFilter: activePreviewFilter,
      activeWidgetId: selectedStructuredSubItemId,
      activeChartId: selectedStructuredItemId,
      onFilterToggle: onDashboardFilterToggle,
      onWidgetMove: onDashboardWidgetMove,
      onWidgetDrop: onDashboardWidgetDrop,
      onWidgetResize: onDashboardWidgetResize,
      onWidgetFocus: onDashboardWidgetFocus,
      onChartFocus: onDashboardChartFocus
    });
    return;
  }

  if (resolvedSurfaceId === "workflow") {
    renderWorkflowExperiencePreview(container, contentToRender, {
      activeStageId: selectedStructuredItemId,
      activeLinkId: selectedStructuredSubItemId,
      onStageFocus: onWorkflowStageFocus,
      onStageMove: onWorkflowStageMove,
      onStagePositionChange: onWorkflowStagePositionChange,
      onWorkflowLinkCreate,
      onLinkFocus: onWorkflowLinkFocus,
      onWorkflowLinkRemove
    });
    return;
  }

  if (resolvedSurfaceId === "design") {
    renderDesignExperiencePreview(container, contentToRender, {
      activeFrameId: selectedStructuredItemId,
      activeBlockId: selectedStructuredSubItemId,
      onFrameFocus: onDesignFrameFocus,
      onBlockFocus: onDesignBlockFocus,
      onBlockMove: onDesignBlockMove,
      onBlockPositionChange: onDesignBlockPositionChange,
      onBlockResize: onDesignBlockResize
    });
    return;
  }

  if (resolvedSurfaceId === "presentation") {
    renderPresentationPreview(
      container,
      contentToRender,
      sections,
      selectedSectionId,
      onPresentationSlideFocus,
      onPresentationSlideEdit
    );
    return;
  }

  if (resolvedSurfaceId === "code") {
    renderCodePreview(container, contentToRender, normalizedPath);
    return;
  }

  if (resolvedSurfaceId === "structure") {
    renderOutline(container, sections, selectedSectionId);
    if (isDocumentMarkupFile) {
      renderMarkdownPreview(
        container,
        contentToRender,
        sections,
        selectedSectionId,
        onDocumentSectionFocus,
        onDocumentInlineEdit,
        workObject,
        projectWorkObjects,
        onProjectObjectSelect
      );
      return;
    }
    if (isCodePath(normalizedPath) || isJsonPath(normalizedPath)) {
      renderCodePreview(container, contentToRender, normalizedPath);
      return;
    }
  }

  if (objectKind === "project") {
    renderProjectOverview(container, { project, workObject, blocks });
  }

  if (isDocumentMarkupFile) {
    if (objectKind === "presentation") {
      renderPresentationPreview(container, contentToRender, sections, selectedSectionId, onPresentationSlideFocus, onPresentationSlideEdit);
      return;
    }
    if (objectKind === "document" || objectKind === "project") {
      renderOutline(container, sections, selectedSectionId);
    }
    renderMarkdownPreview(
      container,
      contentToRender,
      sections,
      selectedSectionId,
      onDocumentSectionFocus,
      onDocumentInlineEdit,
      workObject,
      projectWorkObjects,
      onProjectObjectSelect
    );
    return;
  }

  if (isJsonPath(normalizedPath) || isCsvPath(normalizedPath)) {
    if (objectKind === "dashboard") {
      renderDashboardExperiencePreview(container, contentToRender, {
        activeFilter: activePreviewFilter,
        activeWidgetId: selectedStructuredSubItemId,
        activeChartId: selectedStructuredItemId,
        onFilterToggle: onDashboardFilterToggle,
        onWidgetMove: onDashboardWidgetMove,
        onWidgetDrop: onDashboardWidgetDrop,
        onWidgetResize: onDashboardWidgetResize,
        onWidgetFocus: onDashboardWidgetFocus,
        onChartFocus: onDashboardChartFocus
      });
      return;
    }
    if (objectKind === "workflow") {
      renderWorkflowExperiencePreview(container, contentToRender, {
        activeStageId: selectedStructuredItemId,
        activeLinkId: selectedStructuredSubItemId,
        onStageFocus: onWorkflowStageFocus,
        onStageMove: onWorkflowStageMove,
        onStagePositionChange: onWorkflowStagePositionChange,
        onWorkflowLinkCreate,
        onLinkFocus: onWorkflowLinkFocus,
        onWorkflowLinkRemove
      });
      return;
    }
    if (objectKind === "design") {
      renderDesignExperiencePreview(container, contentToRender, {
        activeFrameId: selectedStructuredItemId,
        activeBlockId: selectedStructuredSubItemId,
        onFrameFocus: onDesignFrameFocus,
        onBlockFocus: onDesignBlockFocus,
        onBlockMove: onDesignBlockMove,
        onBlockPositionChange: onDesignBlockPositionChange,
        onBlockResize: onDesignBlockResize
      });
      return;
    }
    if (objectKind === "benchmark") {
      renderBenchmarkExperiencePreview(container, contentToRender);
      return;
    }
    if (objectKind === "campaign") {
      renderCampaignExperiencePreview(container, contentToRender);
      return;
    }
    if (objectKind === "audio") {
      renderAudioExperiencePreview(container, contentToRender);
      return;
    }
    if (objectKind === "video") {
      renderVideoExperiencePreview(container, contentToRender);
      return;
    }
    renderDataPreview(container, normalizedPath, contentToRender, {
      workObject,
      onHeaderEdit: onDataHeaderEdit,
      onCellEdit: onDataCellEdit,
      onGridEdit: onDataGridEdit
    });
    return;
  }

  if (isImagePath(mediaPreviewPath) || isAudioPath(mediaPreviewPath) || isVideoPath(mediaPreviewPath)) {
    renderMediaPreview(container, mediaPreviewPath, mediaPreviewUrl);
    return;
  }

  if (isHtmlPreviewPath(normalizedPath)) {
    renderAppPreview(container, assetUrl);
    return;
  }

  if (isCodePath(normalizedPath)) {
    renderCodePreview(container, contentToRender, normalizedPath);
    return;
  }

  const pre = document.createElement("pre");
  pre.className = "workspace-code-preview";
  pre.textContent = contentToRender;
  container.appendChild(pre);
}

export function renderWorkspaceDimensionNav(
  container,
  dimensions = [],
  currentDimension = "",
  onSelect = () => {}
) {
  container.innerHTML = "";

  const values = ["all", ...dimensions.filter(Boolean)];
  for (const value of values) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-chip${
      (value === "all" ? "" : value) === currentDimension ? " active" : ""
    }`;
    button.textContent = value === "all" ? "Everything" : value;
    button.addEventListener("click", () => onSelect(value === "all" ? "" : value));
    container.appendChild(button);
  }
}

export function renderWorkspaceSurfaceNav(
  container,
  surfaces = [],
  currentSurfaceId = "",
  onSelect = () => {}
) {
  container.innerHTML = "";

  const visibleSurfaces = surfaces
    .filter((item) => item?.enabled !== false)
    .filter((surface) => surface.id !== "edit");

  container.classList.toggle("hidden", visibleSurfaces.length < 2);

  for (const surface of visibleSurfaces) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-chip${surface.id === currentSurfaceId ? " active" : ""}`;
    button.textContent = toSurfaceLabel(surface.id || surface.label);
    button.addEventListener("click", () => onSelect(surface.id));
    container.appendChild(button);
  }
}

export function renderWorkspaceBreadcrumb(
  container,
  items = []
) {
  container.innerHTML = "";

  for (const item of items.filter((entry) => entry?.value)) {
    const crumb = document.createElement("div");
    crumb.className = "workspace-crumb";

    const label = document.createElement("span");
    label.textContent = item.label;

    const value = document.createElement("strong");
    value.textContent = item.value;

    crumb.append(label, value);
    container.appendChild(crumb);
  }
}

function formatWorkspaceFamilyLabel(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  const map = {
    document_knowledge: "Document & Knowledge",
    data_spreadsheet: "Data & Spreadsheet",
    analytics_dashboard: "Analytics & Dashboard",
    development: "Development",
    app_builder: "App Builder",
    design: "Design",
    presentation: "Presentation",
    project_management: "Project Management",
    strategy_planning: "Strategy & Planning",
    workflow_automation: "Workflow & Automation",
    ai_agent: "AI & Agents",
    crm_sales: "CRM & Sales",
    operations: "Operations",
    finance: "Finance",
    hr: "HR",
    file_storage: "Files & Storage",
    testing_qa: "Testing & QA",
    web_cms: "Web & CMS",
    media: "Media",
    audio: "Audio",
    integration_api: "Integrations & API",
    knowledge_graph: "Knowledge Graph"
  };

  if (map[normalized]) {
    return map[normalized];
  }

  if (/[A-Z&]/.test(normalized) || normalized.includes(" / ")) {
    return normalized;
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatObjectKindLabel(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  const map = {
    project: "Project",
    document: "Document",
    dataset: "Spreadsheet",
    dashboard: "Dashboard",
    workflow: "Workflow",
    design: "Design",
    presentation: "Presentation",
    benchmark: "Benchmark",
    campaign: "Campaign",
    image: "Image",
    audio: "Audio",
    video: "Video",
    code: "Code"
  };

  if (map[normalized]) {
    return map[normalized];
  }

  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "";
}

function createWorkspaceChip(text = "", tone = "default") {
  if (!text) {
    return null;
  }

  const chip = document.createElement("span");
  chip.className = `workspace-mini-chip ${tone}`.trim();
  chip.textContent = text;
  return chip;
}

export function renderWorkspaceObjectList(
  container,
  workObjects = [],
  currentWorkObjectId = "",
  onSelect = () => {}
) {
  container.innerHTML = "";

  if (!workObjects.length) {
    const empty = document.createElement("div");
    empty.className = "detail-item";
    empty.textContent = "No project objects yet. Ask Hydria to add a document, table, deck, workflow or app surface.";
    container.appendChild(empty);
    return;
  }

  for (const workObject of workObjects) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-nav-item${
      currentWorkObjectId === workObject.id ? " active" : ""
    }`;
    button.addEventListener("click", () => onSelect(workObject));

    const header = document.createElement("div");
    header.className = "workspace-nav-card-header";

    const title = document.createElement("strong");
    title.textContent = workObject.title;
    const chipRow = document.createElement("div");
    chipRow.className = "workspace-chip-row";
    [
      createWorkspaceChip(formatObjectKindLabel(workObject.objectKind || workObject.kind), "kind"),
      createWorkspaceChip(
        formatWorkspaceFamilyLabel(workObject.workspaceFamilyLabel || workObject.workspaceFamilyId),
        "family"
      )
    ]
      .filter(Boolean)
      .forEach((chip) => chipRow.appendChild(chip));
    header.append(title, chipRow);

    const summary = document.createElement("span");
    summary.className = "workspace-nav-summary";
    summary.textContent =
      workObject.summary ||
      workObject.nextActionHint ||
      "Open this object and continue shaping it inside the project.";

    const meta = document.createElement("span");
    meta.className = "workspace-nav-meta";
    meta.textContent = [
      workObject.nextActionHint || "Keep shaping this object",
      workObject.primaryFile ? friendlyPathLabel(workObject.primaryFile) : "",
      workObject.status || ""
    ]
      .filter(Boolean)
      .join(" · ");

    meta.textContent = meta.textContent.replaceAll("Â·", "|");
    button.append(header, summary, meta);
    container.appendChild(button);
  }
}

export function renderWorkspaceSectionList(
  container,
  sections = [],
  currentSectionId = "",
  onSelect = () => {},
  options = {}
) {
  container.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `workspace-nav-item${!currentSectionId ? " active" : ""}`;
  allButton.innerHTML = `<strong>${options.rootLabel || "Everything"}</strong><span class="workspace-nav-meta">${options.rootMeta || "Edit the full page"}</span>`;
  allButton.addEventListener("click", () => onSelect(""));
  container.appendChild(allButton);

  for (const section of sections) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-nav-item${
      currentSectionId === section.id ? " active" : ""
    }`;
    button.style.paddingLeft = `${0.9 + Math.max(0, section.level - 1) * 0.7}rem`;

    const title = document.createElement("strong");
    title.textContent = section.title;
    const meta = document.createElement("span");
    meta.className = "workspace-nav-meta";
    meta.textContent = options.itemMetaLabel || "Part";

    button.append(title, meta);
    button.addEventListener("click", () => onSelect(section.id));
    container.appendChild(button);
  }
}

export function renderWorkspaceBlockList(
  container,
  blocks = [],
  currentBlockId = "",
  onSelect = () => {},
  options = {}
) {
  container.innerHTML = "";

  if (!blocks.length) {
    const empty = document.createElement("div");
    empty.className = "detail-item";
    empty.textContent = options.emptyLabel || "Pick a part above to focus a smaller piece.";
    container.appendChild(empty);
    return;
  }

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `workspace-nav-item${!currentBlockId ? " active" : ""}`;
  allButton.innerHTML = `<strong>${options.rootLabel || "Selected part"}</strong><span class="workspace-nav-meta">${options.rootMeta || "Edit the whole part at once"}</span>`;
  allButton.addEventListener("click", () => onSelect(""));
  container.appendChild(allButton);

  for (const block of blocks) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-nav-item${
      currentBlockId === block.id ? " active" : ""
    }`;

    const title = document.createElement("strong");
    title.textContent = block.title || "Block";
    const meta = document.createElement("span");
    meta.className = "workspace-nav-meta";
    meta.textContent = [options.itemMetaLabel || "", `${block.preview || ""}`.slice(0, 140)]
      .filter(Boolean)
      .join(" | ");

    button.append(title, meta);
    button.addEventListener("click", () => onSelect(block.id));
    container.appendChild(button);
  }
}

export function renderProjectCards(
  container,
  projects = [],
  currentProjectId = "",
  onSelect = () => {}
) {
  container.innerHTML = "";

  if (!projects.length) {
    const empty = document.createElement("div");
    empty.className = "detail-item";
    empty.textContent = "No projects yet. Start a conversation and Hydria will open the first project here.";
    container.appendChild(empty);
    return;
  }

  for (const project of projects) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `conversation-card${
      currentProjectId === project.id ? " active" : ""
    }`;
    button.addEventListener("click", () => onSelect(project));

    const title = document.createElement("strong");
    title.textContent = project.name;
    const summary = document.createElement("p");
    summary.className = "workspace-nav-summary";
    summary.textContent =
      project.globalProject?.summary ||
      `Project with ${project.workObjectCount || 0} linked objects ready to keep evolving.`;

    const chipRow = document.createElement("div");
    chipRow.className = "workspace-chip-row";
    (project.workspaceFamilies || [])
      .slice(0, 4)
      .forEach((family) => {
        const chip = createWorkspaceChip(formatWorkspaceFamilyLabel(family), "family");
        if (chip) {
          chipRow.appendChild(chip);
        }
      });

    const meta = document.createElement("p");
    meta.className = "tiny";
    meta.textContent = [
      project.linkedDimensions?.length
        ? project.linkedDimensions.join(", ")
        : project.dimensions?.join(", "),
      `${project.workObjectCount || 0} objects`,
      project.status || ""
    ]
      .filter(Boolean)
      .join(" | ");

    button.append(title, summary, chipRow, meta);
    container.appendChild(button);
  }
}

function humanizeGraphEdgeType(type = "") {
  switch (String(type || "")) {
    case "active_on":
      return "active";
    case "derived_from_project":
      return "derived from project";
    case "derived_for_communication":
      return "derived for communication";
    case "derived_for_analysis":
      return "derived for analysis";
    case "variant_of":
      return "variant";
    case "derived_from":
      return "derived from";
    default:
      return String(type || "").replace(/_/g, " ");
  }
}

export function renderWorkspaceProjectMap(
  container,
  {
    project = null,
    workObjects = [],
    currentWorkObjectId = "",
    onSelectWorkObject = () => {}
  } = {}
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  const graph = project?.graph || null;
  const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const graphEdges = Array.isArray(graph?.edges) ? graph.edges : [];
  const objectNodes = graphNodes.filter((node) => node.type === "work_object");
  const workspaceFamilies = Array.isArray(project?.workspaceFamilies) && project.workspaceFamilies.length
    ? project.workspaceFamilies
    : Array.isArray(graph?.workspaceFamilies)
      ? graph.workspaceFamilies
      : [];

  if (!project || (!objectNodes.length && !workObjects.length)) {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");

  const shell = document.createElement("section");
  shell.className = "workspace-project-map-shell";

  const header = document.createElement("div");
  header.className = "workspace-project-map-header";
  const heading = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "tiny";
  eyebrow.textContent = "Project map";
  const title = document.createElement("strong");
  title.textContent = project?.name || "Current project";
  heading.append(eyebrow, title);

  const summary = document.createElement("span");
  summary.className = "workspace-project-map-summary";
  summary.textContent = `${workObjects.length || objectNodes.length} objects linked`;
  header.append(heading, summary);
  shell.appendChild(header);

  if (workspaceFamilies.length) {
    const families = document.createElement("div");
    families.className = "workspace-project-family-list";
    workspaceFamilies.forEach((family) => {
      const chip = document.createElement("span");
      chip.className = "workspace-project-family-chip";
      chip.textContent = formatWorkspaceFamilyLabel(family);
      families.appendChild(chip);
    });
    shell.appendChild(families);
  }

  const nodeById = new Map(objectNodes.map((node) => [node.id, node]));
  const objectList = objectNodes.length
    ? objectNodes
    : workObjects.map((workObject) => ({
        id: workObject.id,
        label: workObject.title,
        objectKind: workObject.objectKind || workObject.kind || "",
        workspaceFamilyId: workObject.workspaceFamilyId || "",
        workspaceFamilyLabel: workObject.workspaceFamilyLabel || "",
        primaryFile: workObject.primaryFile || "",
        status: workObject.status || ""
      }));

  const nodeList = document.createElement("div");
  nodeList.className = "workspace-project-node-list";
  objectList.forEach((node) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-project-node${
      String(node.id) === String(currentWorkObjectId) ? " active" : ""
    }`;
    button.addEventListener("click", () => onSelectWorkObject(node.id));

    const nodeTitle = document.createElement("strong");
    nodeTitle.textContent = node.label || node.primaryFile || node.id;

    const meta = document.createElement("span");
    meta.className = "workspace-project-node-meta";
    meta.textContent = [
      formatWorkspaceFamilyLabel(node.workspaceFamilyLabel || node.workspaceFamilyId),
      formatObjectKindLabel(node.objectKind),
      node.primaryFile ? friendlyPathLabel(node.primaryFile) : "",
      node.status || ""
    ]
      .filter(Boolean)
      .join(" · ");

    meta.textContent = meta.textContent.replaceAll("Â·", "|");
    button.append(nodeTitle, meta);
    nodeList.append(button);
  });
  shell.appendChild(nodeList);

  const relevantEdges = graphEdges.filter((edge) =>
    edge.type !== "contains" && edge.type !== "opens_in_workspace"
  );
  if (relevantEdges.length) {
    const edgeList = document.createElement("div");
    edgeList.className = "workspace-project-edge-list";
    relevantEdges.forEach((edge) => {
      const item = document.createElement("div");
      item.className = "workspace-project-edge";
      const from = nodeById.get(edge.from)?.label || project?.name || edge.from;
      const to = nodeById.get(edge.to)?.label || edge.to;
      item.textContent = `${from} → ${to} (${humanizeGraphEdgeType(edge.type)})`;
      edgeList.appendChild(item);
    });
    shell.appendChild(edgeList);
  }

  container.appendChild(shell);
}
