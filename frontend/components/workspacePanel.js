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

function escapeRegExp(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unwrapNodeContents(node) {
  if (!node?.parentNode) {
    return;
  }
  node.replaceWith(...Array.from(node.childNodes));
}

let activeDocumentSearchShortcutCleanup = null;

const PLAIN_URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const DOCS_TEXT_COLOR_OPTIONS = [
  { label: "Default", value: "", sample: "#ffffff", outline: "rgba(73, 84, 95, 0.22)" },
  { label: "White", value: "#ffffff", sample: "#ffffff", outline: "rgba(73, 84, 95, 0.3)" },
  { label: "Black", value: "#111827", sample: "#111827" },
  { label: "Slate", value: "#334155", sample: "#334155" },
  { label: "Gray", value: "#6b7280", sample: "#6b7280" },
  { label: "Brown", value: "#7c4a21", sample: "#7c4a21" },
  { label: "Red", value: "#b42318", sample: "#b42318" },
  { label: "Crimson", value: "#c1121f", sample: "#c1121f" },
  { label: "Orange", value: "#c2410c", sample: "#c2410c" },
  { label: "Amber", value: "#b45309", sample: "#b45309" },
  { label: "Gold", value: "#a16207", sample: "#a16207" },
  { label: "Olive", value: "#4d7c0f", sample: "#4d7c0f" },
  { label: "Green", value: "#15803d", sample: "#15803d" },
  { label: "Emerald", value: "#047857", sample: "#047857" },
  { label: "Teal", value: "#0f766e", sample: "#0f766e" },
  { label: "Cyan", value: "#0e7490", sample: "#0e7490" },
  { label: "Blue", value: "#1d4ed8", sample: "#1d4ed8" },
  { label: "Indigo", value: "#4338ca", sample: "#4338ca" },
  { label: "Purple", value: "#7e22ce", sample: "#7e22ce" },
  { label: "Violet", value: "#6d28d9", sample: "#6d28d9" },
  { label: "Pink", value: "#be185d", sample: "#be185d" }
];
const DOCS_HIGHLIGHT_COLOR_OPTIONS = [
  { label: "Clear", value: "", sample: "transparent", outline: "rgba(73, 84, 95, 0.22)" },
  { label: "White", value: "#ffffff", sample: "#ffffff", outline: "rgba(73, 84, 95, 0.3)" },
  { label: "Yellow", value: "#fff2a8", sample: "#fff2a8" },
  { label: "Lemon", value: "#fde68a", sample: "#fde68a" },
  { label: "Peach", value: "#fed7aa", sample: "#fed7aa" },
  { label: "Orange", value: "#fdba74", sample: "#fdba74" },
  { label: "Coral", value: "#fca5a5", sample: "#fca5a5" },
  { label: "Pink", value: "#f9a8d4", sample: "#f9a8d4" },
  { label: "Rose", value: "#fecdd3", sample: "#fecdd3" },
  { label: "Lavender", value: "#ddd6fe", sample: "#ddd6fe" },
  { label: "Lilac", value: "#e9d5ff", sample: "#e9d5ff" },
  { label: "Sky", value: "#bae6fd", sample: "#bae6fd" },
  { label: "Blue", value: "#bfdbfe", sample: "#bfdbfe" },
  { label: "Mint", value: "#bbf7d0", sample: "#bbf7d0" },
  { label: "Green", value: "#d9f99d", sample: "#d9f99d" },
  { label: "Sage", value: "#d1fae5", sample: "#d1fae5" },
  { label: "Stone", value: "#e7e5e4", sample: "#e7e5e4" }
];
const DOCS_FONT_FAMILY_OPTIONS = [
  { label: "Default font", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, Candara, Segoe, \"Segoe UI\", Optima, Arial, sans-serif" },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Candara", value: "Candara, Calibri, Segoe, \"Segoe UI\", sans-serif" },
  { label: "Century Gothic", value: "\"Century Gothic\", Futura, Arial, sans-serif" },
  { label: "Consolas", value: "Consolas, \"Courier New\", monospace" },
  { label: "Courier New", value: "\"Courier New\", Courier, monospace" },
  { label: "Franklin Gothic", value: "\"Franklin Gothic Medium\", \"Arial Narrow\", Arial, sans-serif" },
  { label: "Garamond", value: "Garamond, Baskerville, \"Times New Roman\", serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "IBM Plex Sans", value: "\"IBM Plex Sans\", sans-serif" },
  { label: "Impact", value: "Impact, Haettenschweiler, \"Arial Narrow Bold\", sans-serif" },
  { label: "Lucida Sans", value: "\"Lucida Sans Unicode\", \"Lucida Grande\", sans-serif" },
  { label: "Palatino", value: "\"Palatino Linotype\", Palatino, \"Book Antiqua\", serif" },
  { label: "Segoe UI", value: "\"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, Verdana, sans-serif" },
  { label: "Times New Roman", value: "\"Times New Roman\", Times, serif" },
  { label: "Trebuchet MS", value: "\"Trebuchet MS\", Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" }
];
const DOCS_FONT_SIZE_OPTIONS = [
  { label: "Auto size", value: "" },
  { label: "8", value: "8px" },
  { label: "9", value: "9px" },
  { label: "10", value: "10px" },
  { label: "11", value: "11px" },
  { label: "12", value: "12px" },
  { label: "13", value: "13px" },
  { label: "14", value: "14px" },
  { label: "15", value: "15px" },
  { label: "16", value: "16px" },
  { label: "17", value: "17px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "22", value: "22px" },
  { label: "24", value: "24px" },
  { label: "26", value: "26px" },
  { label: "28", value: "28px" },
  { label: "30", value: "30px" },
  { label: "32", value: "32px" },
  { label: "36", value: "36px" },
  { label: "40", value: "40px" },
  { label: "48", value: "48px" },
  { label: "54", value: "54px" },
  { label: "60", value: "60px" },
  { label: "72", value: "72px" },
  { label: "84", value: "84px" },
  { label: "96", value: "96px" }
];
const DOCS_ALIGNMENT_OPTIONS = [
  { label: "Left align", value: "left" },
  { label: "Center align", value: "center" },
  { label: "Right align", value: "right" },
  { label: "Justify", value: "justify" }
];

function shouldLinkifyOnBreak(event) {
  return ["insertParagraph", "insertLineBreak"].includes(String(event?.inputType || ""));
}

function trimTrailingUrlPunctuation(value = "") {
  return String(value || "").replace(/[),.;!?]+$/g, "");
}

function normalizeHyperlinkHref(value = "") {
  const trimmed = trimTrailingUrlPunctuation(value);
  if (!trimmed) {
    return "";
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function createHyperlinkNode(value = "") {
  const label = trimTrailingUrlPunctuation(value);
  const href = normalizeHyperlinkHref(value);
  if (!label || !href) {
    return null;
  }

  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  link.target = "_blank";
  link.rel = "noreferrer noopener";
  return link;
}

function linkifyTextNodeUrls(textNode) {
  if (!textNode?.nodeValue || !textNode.parentElement) {
    return false;
  }

  const source = String(textNode.nodeValue || "");
  PLAIN_URL_PATTERN.lastIndex = 0;

  let match;
  let lastIndex = 0;
  let changed = false;
  const fragment = document.createDocumentFragment();

  while ((match = PLAIN_URL_PATTERN.exec(source)) !== null) {
    const rawMatch = match[0] || "";
    const cleanMatch = trimTrailingUrlPunctuation(rawMatch);
    if (!cleanMatch) {
      continue;
    }

    changed = true;
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
    }

    const link = createHyperlinkNode(cleanMatch);
    if (link) {
      fragment.appendChild(link);
    } else {
      fragment.appendChild(document.createTextNode(cleanMatch));
    }

    const trailing = rawMatch.slice(cleanMatch.length);
    if (trailing) {
      fragment.appendChild(document.createTextNode(trailing));
    }

    lastIndex = match.index + rawMatch.length;
  }

  if (!changed) {
    return false;
  }

  if (lastIndex < source.length) {
    fragment.appendChild(document.createTextNode(source.slice(lastIndex)));
  }

  textNode.replaceWith(fragment);
  return true;
}

function linkifyPlainUrlsInNode(root) {
  if (!root) {
    return false;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node?.parentElement;
      if (!parent || !String(node.nodeValue || "").trim()) {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.closest("a, code, pre, script, style, .workspace-docs-search-match")) {
        return NodeFilter.FILTER_REJECT;
      }
      PLAIN_URL_PATTERN.lastIndex = 0;
      return PLAIN_URL_PATTERN.test(String(node.nodeValue || ""))
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });

  const textNodes = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode);
    currentNode = walker.nextNode();
  }

  return textNodes.reduce((didChange, node) => linkifyTextNodeUrls(node) || didChange, false);
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
    label: normalizeLegacyDocumentTitle(node.textContent) || `Section ${index + 1}`
  }));
}

function normalizeLegacyDocumentTitle(value = "") {
  const trimmed = String(value || "").trim();
  if (/^document s1$/i.test(trimmed)) {
    return "document";
  }
  return trimmed;
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
      title: normalizeLegacyDocumentTitle(heading.textContent) || `Section ${index + 1}`,
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
  let docsMenuFieldSyncCleanup = null;
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

  let docsToolbar = null;
  let docsToolbarStatus = null;
  let shell = null;
  let outline = null;
  let docsCanvas = null;
  let docsTableControls = null;
  let docsTableContextMenu = null;
  let docsTableControlSignature = "";
  let docsCommitHandle = null;
  let normalizedLegacyHeading = false;
  let docsFullscreenButtons = [];
  let docsSavedSelectionRange = null;
  let docsSelectedMediaFigure = null;
  let restoreDocsFullscreenAfterImageImport = false;
  let docsFullscreenFallbackActive = false;
  let docsFullscreenFallbackPlaceholder = null;
  let docsFullscreenRestoreFocusHandler = null;
  let docsSearchBar = null;
  let docsSearchInput = null;
  let docsSearchCount = null;
  let docsSearchUndoButton = null;
  let docsSearchRedoButton = null;
  let docsSearchSelectAllButton = null;
  let docsSearchPreviousButton = null;
  let docsSearchNextButton = null;
  let docsSearchMatches = [];
  let docsSearchActiveIndex = -1;
  let docsSearchAllSelected = false;
  let docsSearchUndoStack = [];
  let docsSearchRedoStack = [];
  const docsSearchMatchClassName = "workspace-docs-search-match";
  const docsSearchActiveClassName = "is-active";

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
  previewTabs.className = `workspace-code-tabs${isDocsClone ? " workspace-docs-header-actions" : ""}`;
  if (isDocsClone) {
    [
      {
        label: "Edit page",
        modifier: "is-active",
        onClick: () => focusDocsPage()
      },
      {
        label: "Outline",
        onClick: () => focusDocsOutline()
      },
      {
        label: "Find",
        onClick: () => openDocumentSearch()
      },
      {
        label: "Polish",
        modifier: "is-accent",
        onClick: () => prepareShareReadyPrompt()
      }
    ].forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `workspace-code-tab workspace-docs-header-action${action.modifier ? ` ${action.modifier}` : ""}`;
      button.textContent = action.label;
      button.addEventListener("click", action.onClick);
      previewTabs.appendChild(button);
    });
  } else {
    profile.tabs.forEach((label, index) => {
      const chip = document.createElement("span");
      chip.className = `workspace-code-tab${index === 0 ? " is-active" : ""}`;
      chip.textContent = label;
      previewTabs.appendChild(chip);
    });
  }
  previewToolbar.append(previewMeta, previewTabs);
  previewShell.appendChild(previewToolbar);

  docsSearchBar = document.createElement("div");
  docsSearchBar.className = "workspace-docs-searchbar hidden";
  const docsSearchLabel = document.createElement("span");
  docsSearchLabel.className = "workspace-docs-search-label";
  docsSearchLabel.textContent = "Find in document";
  docsSearchInput = document.createElement("input");
  docsSearchInput.type = "search";
  docsSearchInput.className = "workspace-docs-search-input";
  docsSearchInput.placeholder = "Search a word or phrase";
  docsSearchInput.setAttribute("aria-label", "Find in document");
  docsSearchInput.addEventListener("input", (event) => {
    applyDocumentSearch(event.target.value, { scrollToActive: false });
  });
  docsSearchInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && String(event.key || "").toLowerCase() === "z") {
      event.preventDefault();
      undoDocumentSearchDeletion();
      return;
    }
    if (
      ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "y") ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key || "").toLowerCase() === "z")
    ) {
      event.preventDefault();
      redoDocumentSearchDeletion();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      moveDocumentSearch(event.shiftKey ? -1 : 1);
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && docsSearchAllSelected) {
      event.preventDefault();
      removeAllDocumentSearchMatches();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeDocumentSearch();
    }
  });
  docsSearchUndoButton = document.createElement("button");
  docsSearchUndoButton.type = "button";
  docsSearchUndoButton.className = "workspace-docs-search-button workspace-docs-search-icon-button";
  docsSearchUndoButton.textContent = "↶";
  docsSearchUndoButton.title = "Undo delete";
  docsSearchUndoButton.setAttribute("aria-label", "Undo delete");
  docsSearchUndoButton.disabled = true;
  docsSearchUndoButton.addEventListener("click", () => undoDocumentSearchDeletion());
  docsSearchRedoButton = document.createElement("button");
  docsSearchRedoButton.type = "button";
  docsSearchRedoButton.className = "workspace-docs-search-button workspace-docs-search-icon-button";
  docsSearchRedoButton.textContent = "↷";
  docsSearchRedoButton.title = "Redo delete";
  docsSearchRedoButton.setAttribute("aria-label", "Redo delete");
  docsSearchRedoButton.disabled = true;
  docsSearchRedoButton.addEventListener("click", () => redoDocumentSearchDeletion());
  docsSearchSelectAllButton = document.createElement("button");
  docsSearchSelectAllButton.type = "button";
  docsSearchSelectAllButton.className = "workspace-docs-search-button";
  docsSearchSelectAllButton.textContent = "Select all";
  docsSearchSelectAllButton.addEventListener("click", () => {
    setDocumentSearchAllSelected(!docsSearchAllSelected);
    updateDocsToolbarStatus(
      docsSearchAllSelected
        ? "All matches selected. Press Delete to remove them."
        : "Selection cleared"
    );
  });
  docsSearchPreviousButton = document.createElement("button");
  docsSearchPreviousButton.type = "button";
  docsSearchPreviousButton.className = "workspace-docs-search-button";
  docsSearchPreviousButton.textContent = "Previous";
  docsSearchPreviousButton.addEventListener("click", () => moveDocumentSearch(-1));
  docsSearchNextButton = document.createElement("button");
  docsSearchNextButton.type = "button";
  docsSearchNextButton.className = "workspace-docs-search-button";
  docsSearchNextButton.textContent = "Next";
  docsSearchNextButton.addEventListener("click", () => moveDocumentSearch(1));
  docsSearchCount = document.createElement("span");
  docsSearchCount.className = "workspace-docs-search-count";
  docsSearchCount.textContent = "Search";
  const docsSearchCloseButton = document.createElement("button");
  docsSearchCloseButton.type = "button";
  docsSearchCloseButton.className = "workspace-docs-search-button";
  docsSearchCloseButton.textContent = "Close";
  docsSearchCloseButton.addEventListener("click", () => closeDocumentSearch());
  docsSearchBar.append(
    docsSearchLabel,
    docsSearchInput,
    docsSearchUndoButton,
    docsSearchRedoButton,
    docsSearchSelectAllButton,
    docsSearchPreviousButton,
    docsSearchNextButton,
    docsSearchCount,
    docsSearchCloseButton
  );
  previewShell.appendChild(docsSearchBar);

  const commitDocumentShell = () => {
    if (shell) {
      onInlineEdit?.(serializeDocumentPreviewShell(shell));
    }
  };

  const focusDocumentEditingTarget = () => {
    const target = activeEditable || shell?.querySelector?.(".workspace-inline-editable") || shell;
    target?.focus?.({ preventScroll: true });
  };

  const clearDocumentSearchHighlights = () => {
    if (!shell) {
      docsSearchMatches = [];
      docsSearchActiveIndex = -1;
      docsSearchAllSelected = false;
      return;
    }
    shell.querySelectorAll(`.${docsSearchMatchClassName}`).forEach((node) => unwrapNodeContents(node));
    shell.normalize();
    docsSearchMatches = [];
    docsSearchActiveIndex = -1;
    docsSearchAllSelected = false;
  };

  const updateDocumentSearchStatus = () => {
    const totalMatches = docsSearchMatches.length;
    if (docsSearchCount) {
      if (!docsSearchInput?.value.trim()) {
        docsSearchCount.textContent = "Search";
      } else if (!totalMatches) {
        docsSearchCount.textContent = "0 results";
      } else if (docsSearchAllSelected) {
        docsSearchCount.textContent = `${totalMatches} selected`;
      } else {
        docsSearchCount.textContent = `${docsSearchActiveIndex + 1} / ${totalMatches}`;
      }
    }
    if (docsSearchUndoButton) {
      docsSearchUndoButton.disabled = !docsSearchUndoStack.length;
    }
    if (docsSearchRedoButton) {
      docsSearchRedoButton.disabled = !docsSearchRedoStack.length;
    }
    if (docsSearchSelectAllButton) {
      docsSearchSelectAllButton.disabled = !totalMatches;
      docsSearchSelectAllButton.classList.toggle("is-active", docsSearchAllSelected && totalMatches > 0);
    }
    if (docsSearchPreviousButton) {
      docsSearchPreviousButton.disabled = totalMatches < 2;
    }
    if (docsSearchNextButton) {
      docsSearchNextButton.disabled = totalMatches < 2;
    }
  };

  const setDocumentSearchAllSelected = (nextValue = false) => {
    docsSearchAllSelected = Boolean(nextValue && docsSearchMatches.length);
    docsSearchMatches.forEach((match) => {
      match.classList.toggle("is-selected", docsSearchAllSelected);
    });
    updateDocumentSearchStatus();
  };

  const setActiveDocumentSearchMatch = (index = 0, { scroll = true } = {}) => {
    docsSearchMatches.forEach((match) => match.classList.remove(docsSearchActiveClassName));
    if (!docsSearchMatches.length) {
      docsSearchActiveIndex = -1;
      updateDocumentSearchStatus();
      return;
    }

    const safeIndex = ((index % docsSearchMatches.length) + docsSearchMatches.length) % docsSearchMatches.length;
    docsSearchActiveIndex = safeIndex;
    const activeMatch = docsSearchMatches[safeIndex];
    activeMatch.classList.add(docsSearchActiveClassName);
    if (scroll) {
      activeMatch.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth"
      });
    }
    updateDocumentSearchStatus();
  };

  const removeAllDocumentSearchMatches = () => {
    if (!docsSearchMatches.length) {
      return 0;
    }

    const previousSnapshot =
      shell?.dataset?.richDocument === "true" ? serializeDocumentPreviewShell(shell) : "";
    if (previousSnapshot) {
      pushDocumentSearchUndoSnapshot(previousSnapshot);
    }

    const removedCount = docsSearchMatches.length;
    const matchesToRemove = [...docsSearchMatches];
    docsSearchMatches = [];
    docsSearchActiveIndex = -1;
    docsSearchAllSelected = false;
    matchesToRemove.forEach((node) => node.remove());
    commitDocumentShell();
    window.requestAnimationFrame(() => updateDocsTableControls(null, true));
    updateDocumentSearchStatus();
    updateDocsToolbarStatus(
      removedCount === 1 ? "1 occurrence deleted" : `${removedCount} occurrences deleted`
    );
    return removedCount;
  };

  const highlightDocumentSearchTextNode = (textNode, regex) => {
    if (!textNode?.nodeValue || !textNode.parentElement) {
      return;
    }

    const source = String(textNode.nodeValue || "");
    regex.lastIndex = 0;

    let match;
    let lastIndex = 0;
    let changed = false;
    const fragment = document.createDocumentFragment();

    while ((match = regex.exec(source)) !== null) {
      const value = match[0] || "";
      if (!value) {
        regex.lastIndex += 1;
        continue;
      }

      changed = true;
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
      }

      const marker = document.createElement("mark");
      marker.className = docsSearchMatchClassName;
      marker.textContent = value;
      fragment.appendChild(marker);
      docsSearchMatches.push(marker);

      lastIndex = match.index + value.length;
    }

    if (!changed) {
      return;
    }

    if (lastIndex < source.length) {
      fragment.appendChild(document.createTextNode(source.slice(lastIndex)));
    }

    textNode.replaceWith(fragment);
  };

  const applyDocumentSearch = (query = "", { preserveIndex = false, scrollToActive = true } = {}) => {
    const normalizedQuery = String(query || "").trim();
    const previousMatchText =
      preserveIndex && docsSearchMatches[docsSearchActiveIndex]
        ? String(docsSearchMatches[docsSearchActiveIndex].textContent || "")
        : "";

    clearDocumentSearchHighlights();

    if (!shell || !normalizedQuery) {
      updateDocumentSearchStatus();
      return 0;
    }

    const regex = new RegExp(escapeRegExp(normalizedQuery), "gi");
    const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node?.parentElement;
        if (!parent || !String(node.nodeValue || "").trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest(`script, style, .workspace-docs-page-control-bar, .${docsSearchMatchClassName}`)) {
          return NodeFilter.FILTER_REJECT;
        }
        regex.lastIndex = 0;
        return regex.test(String(node.nodeValue || ""))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    const textNodes = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
      regex.lastIndex = 0;
    }

    textNodes.forEach((node) => highlightDocumentSearchTextNode(node, regex));

    if (!docsSearchMatches.length) {
      docsSearchActiveIndex = -1;
      updateDocumentSearchStatus();
      updateDocsToolbarStatus(`No matches for "${normalizedQuery}"`);
      return 0;
    }

    const nextIndex = preserveIndex && previousMatchText
      ? Math.max(0, docsSearchMatches.findIndex((match) => String(match.textContent || "") === previousMatchText))
      : 0;
    setDocumentSearchAllSelected(false);
    setActiveDocumentSearchMatch(nextIndex, { scroll: scrollToActive });
    updateDocsToolbarStatus(
      docsSearchMatches.length === 1
        ? "1 match in the document"
        : `${docsSearchMatches.length} matches in the document`
    );
    return docsSearchMatches.length;
  };

  const moveDocumentSearch = (direction = 1) => {
    if (!docsSearchMatches.length) {
      applyDocumentSearch(docsSearchInput?.value || "");
      return;
    }
    setActiveDocumentSearchMatch(docsSearchActiveIndex + direction);
  };

  const closeDocumentSearch = ({ clearQuery = true } = {}) => {
    clearDocumentSearchHighlights();
    if (docsSearchBar) {
      docsSearchBar.classList.add("hidden");
    }
    if (docsSearchInput && clearQuery) {
      docsSearchInput.value = "";
    }
    updateDocumentSearchStatus();
    focusDocumentEditingTarget();
    updateDocsToolbarStatus("Search closed");
  };

  const openDocumentSearch = ({ seedFromSelection = true } = {}) => {
    if (!docsSearchBar || !docsSearchInput) {
      return;
    }

    if (seedFromSelection && !docsSearchInput.value.trim()) {
      const selection = window.getSelection();
      if (
        selection &&
        !selection.isCollapsed &&
        shell?.contains(selection.anchorNode) &&
        shell?.contains(selection.focusNode)
      ) {
        docsSearchInput.value = String(selection.toString() || "").trim();
      }
    }

    docsSearchBar.classList.remove("hidden");
    if (docsSearchInput.value.trim()) {
      applyDocumentSearch(docsSearchInput.value, { preserveIndex: true, scrollToActive: false });
    } else {
      updateDocumentSearchStatus();
    }
    docsSearchInput.focus();
    docsSearchInput.select();
    updateDocsToolbarStatus("Search opened");
  };

  const handleDocumentLinkClick = (event) => {
    const link = event.target.closest?.("a[href]");
    if (!link || !previewShell.contains(link)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const target = String(link.target || "").trim().toLowerCase();
    if (target === "_self") {
      window.location.assign(link.href);
    } else {
      window.open(link.href, target || "_blank", "noopener,noreferrer");
    }
    updateDocsToolbarStatus("Link opened");
    return true;
  };

  previewShell.addEventListener("click", (event) => {
    handleDocumentLinkClick(event);
  }, true);
  previewShell.addEventListener("keydown", (event) => {
    if ((event.key === "Delete" || event.key === "Backspace") && docsSearchAllSelected) {
      event.preventDefault();
      event.stopPropagation();
      removeAllDocumentSearchMatches();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "f") {
      event.preventDefault();
      event.stopPropagation();
      openDocumentSearch();
    }
  });
  if (typeof activeDocumentSearchShortcutCleanup === "function") {
    activeDocumentSearchShortcutCleanup();
  }
  const globalDocumentSearchShortcutHandler = (event) => {
    if (!previewShell.isConnected) {
      activeDocumentSearchShortcutCleanup?.();
      activeDocumentSearchShortcutCleanup = null;
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && docsSearchAllSelected) {
      event.preventDefault();
      removeAllDocumentSearchMatches();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "f") {
      event.preventDefault();
      openDocumentSearch();
    }
  };
  window.addEventListener("keydown", globalDocumentSearchShortcutHandler);
  activeDocumentSearchShortcutCleanup = () => {
    window.removeEventListener("keydown", globalDocumentSearchShortcutHandler);
  };
  updateDocumentSearchStatus();

  const focusDocsPage = () => {
    previewShell.scrollIntoView({ behavior: "smooth", block: "start" });
    focusDocumentEditingTarget();
    updateDocsToolbarStatus("Editing page");
  };

  const focusDocsOutline = () => {
    outline?.querySelector?.("button")?.focus?.({ preventScroll: true });
    updateDocsToolbarStatus("Outline ready");
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

  const prepareShareReadyPrompt = () => {
    const promptInput = document.getElementById("prompt-input");
    if (!promptInput) {
      return;
    }
    const pageName = previewTitle.textContent || workObject?.title || "this page";
    promptInput.value = `Make ${pageName} share-ready: tighten the writing, improve structure, and keep the current intent.`;
    promptInput.focus();
    promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
    updateDocsToolbarStatus("Prompt ready for Hydria");
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

  const getActiveInsertionAnchor = () => {
    const target = getActiveBlockTarget();
    if (!target) {
      return null;
    }
    return (
      target.closest(
        ".workspace-docs-figure, .workspace-docs-table, .workspace-checklist, ul, ol, blockquote, p, h1, h2, h3, h4, .workspace-docs-page-break"
      ) || target
    );
  };

  const getDocsEditableTargetFromNode = (node) => {
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element?.closest) {
      return null;
    }
    return element.closest("h1, h2, h3, h4, p, blockquote, li, th, td, figcaption");
  };

  const getDocsActionTargetFromNode = (node) => {
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element?.closest) {
      return null;
    }
    return element.closest(
      "img, video, figure, table, hr, li, ul, ol, blockquote, p, h1, h2, h3, h4, figcaption, th, td, .workspace-docs-page-break"
    );
  };

  const getDocsFigureTargetFromNode = (node) => {
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element?.closest) {
      return null;
    }
    return element.closest(".workspace-docs-figure");
  };

  const getDocsMediaNodeFromTarget = (target) => {
    if (target?.matches?.("img, video")) {
      return target;
    }
    return getDocsFigureTargetFromNode(target)?.querySelector?.("img, video") || null;
  };

  const isDocsMediaTarget = (target) => Boolean(getDocsFigureTargetFromNode(target) || target?.matches?.("img, video"));

  const normalizeDocsFontFamilyKey = (value = "") =>
    String(value || "")
      .split(",")[0]
      .replace(/["']/g, "")
      .trim()
      .toLowerCase();

  const formatDocsFontSizeLabel = (value = "") => {
    const numericValue = Number.parseFloat(String(value || "").trim());
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return "";
    }
    return Number.isInteger(numericValue) ? String(numericValue) : String(Math.round(numericValue * 10) / 10);
  };

  const normalizeDocsFontSizeValue = (value = "") => {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      return "";
    }
    const unitMatch = trimmed.match(/^(\d+(?:\.\d+)?)(px|pt|em|rem|%)?$/i);
    if (!unitMatch) {
      return "";
    }
    const numericValue = Number.parseFloat(unitMatch[1] || "");
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return "";
    }
    const clampedValue = Math.min(400, Math.max(6, numericValue));
    const normalizedNumber = Number.isInteger(clampedValue) ? String(clampedValue) : String(Math.round(clampedValue * 10) / 10);
    const unit = (unitMatch[2] || "px").toLowerCase();
    return `${normalizedNumber}${unit}`;
  };

  const getDocsStylePropertyName = (property = "") =>
    ({
      fontSize: "font-size",
      fontFamily: "font-family",
      fontWeight: "font-weight",
      fontStyle: "font-style",
      textDecoration: "text-decoration",
      color: "color",
      backgroundColor: "background-color"
    }[property] || property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`));

  const getDocsSelectionRangeSnapshot = () => {
    const selection = window.getSelection();
    if (
      selection &&
      selection.rangeCount &&
      shell?.contains(selection.anchorNode) &&
      shell?.contains(selection.focusNode)
    ) {
      return selection.getRangeAt(0).cloneRange();
    }
    return docsSavedSelectionRange ? docsSavedSelectionRange.cloneRange() : null;
  };

  const getDocsFormattingSampleNode = () => {
    const range = getDocsSelectionRangeSnapshot();
    const rangeContainer = range?.startContainer || null;
    const rangeElement = rangeContainer?.nodeType === Node.TEXT_NODE ? rangeContainer.parentElement : rangeContainer;
    if (rangeElement && shell?.contains(rangeElement)) {
      return rangeElement;
    }
    return getActiveBlockTarget() || activeEditable || shell;
  };

  const getDocsCurrentFormattingState = () => {
    const sampleNode = getDocsFormattingSampleNode();
    const style = sampleNode ? window.getComputedStyle(sampleNode) : null;
    const rawFontFamily = String(style?.fontFamily || "");
    const fontFamilyLabel =
      DOCS_FONT_FAMILY_OPTIONS.find((item) => normalizeDocsFontFamilyKey(item.value || item.label) === normalizeDocsFontFamilyKey(rawFontFamily))
        ?.label ||
      rawFontFamily.split(",")[0]?.replace(/["']/g, "").trim() ||
      "Default font";
    const fontSizeLabel = formatDocsFontSizeLabel(style?.fontSize || "");
    return {
      fontFamilyLabel,
      fontFamilyValue: rawFontFamily,
      fontSizeLabel,
      fontSizeValue: normalizeDocsFontSizeValue(style?.fontSize || "") || ""
    };
  };

  const withRestoredDocsSelection = (callback) => {
    const range = getDocsSelectionRangeSnapshot();
    if (!range || range.collapsed) {
      return false;
    }
    const restored = restoreDocsSelection();
    if (!restored) {
      return false;
    }
    callback?.(window.getSelection()?.getRangeAt?.(0) || range);
    return true;
  };

  const getDocsSelectedInlineStyleWrapper = (range, block) => {
    const commonAncestor =
      range?.commonAncestorContainer?.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range?.commonAncestorContainer || null;
    const wrapper = commonAncestor?.closest?.("span") || null;
    if (!wrapper || !block?.contains(wrapper) || wrapper.closest?.(`.${docsSearchMatchClassName}`)) {
      return null;
    }
    const wrapperRange = document.createRange();
    wrapperRange.selectNodeContents(wrapper);
    const matchesStart = range.compareBoundaryPoints(Range.START_TO_START, wrapperRange) === 0;
    const matchesEnd = range.compareBoundaryPoints(Range.END_TO_END, wrapperRange) === 0;
    return matchesStart && matchesEnd ? wrapper : null;
  };

  const stripDocsInlineStyleFromNodeTree = (node, property) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    Array.from(node.childNodes).forEach((child) => stripDocsInlineStyleFromNodeTree(child, property));
    const cssProperty = getDocsStylePropertyName(property);
    node.style?.removeProperty?.(cssProperty);
    if (property === "fontSize") {
      node.style?.removeProperty?.("line-height");
      node.style?.removeProperty?.("vertical-align");
    }
    if (node.getAttribute?.("style") === "") {
      node.removeAttribute("style");
    }
    if (node.tagName === "SPAN" && !node.attributes.length) {
      node.replaceWith(...Array.from(node.childNodes));
    }
  };

  const mergeDocsInlineStylesWithoutProperty = (sourceNode, targetNode, property) => {
    if (!sourceNode?.style || !targetNode?.style) {
      return;
    }
    const ignoredProperties = new Set([getDocsStylePropertyName(property)]);
    if (property === "fontSize") {
      ignoredProperties.add("line-height");
      ignoredProperties.add("vertical-align");
    }
    Array.from(sourceNode.style).forEach((styleName) => {
      if (ignoredProperties.has(styleName) || targetNode.style.getPropertyValue(styleName)) {
        return;
      }
      const styleValue = sourceNode.style.getPropertyValue(styleName);
      if (!styleValue) {
        return;
      }
      targetNode.style.setProperty(styleName, styleValue, sourceNode.style.getPropertyPriority(styleName));
    });
  };

  const cleanupDocsInlineStyleNode = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    if (node.getAttribute?.("style") === "") {
      node.removeAttribute("style");
    }
    if (node.tagName === "SPAN" && !node.attributes.length) {
      node.replaceWith(...Array.from(node.childNodes));
    }
  };

  const liftDocsInlineStyledNode = (node, property, block) => {
    const cssProperty = getDocsStylePropertyName(property);
    let currentNode = node;
    while (currentNode?.parentElement && block?.contains(currentNode.parentElement)) {
      const parent = currentNode.parentElement;
      if (
        parent.tagName !== "SPAN" ||
        !parent.style?.getPropertyValue?.(cssProperty) ||
        parent.closest?.(`.${docsSearchMatchClassName}`)
      ) {
        break;
      }
      const grandParent = parent.parentNode;
      if (!grandParent) {
        break;
      }
      mergeDocsInlineStylesWithoutProperty(parent, currentNode, property);

      const beforeClone = parent.cloneNode(false);
      const afterClone = parent.cloneNode(false);

      while (parent.firstChild && parent.firstChild !== currentNode) {
        beforeClone.appendChild(parent.firstChild);
      }
      while (currentNode.nextSibling) {
        afterClone.appendChild(currentNode.nextSibling);
      }

      if (beforeClone.childNodes.length) {
        grandParent.insertBefore(beforeClone, parent);
      }
      grandParent.insertBefore(currentNode, parent);
      if (afterClone.childNodes.length) {
        grandParent.insertBefore(afterClone, parent);
      }
      parent.remove();

      cleanupDocsInlineStyleNode(beforeClone);
      cleanupDocsInlineStyleNode(afterClone);
      cleanupDocsInlineStyleNode(currentNode);
    }
    return currentNode;
  };

  const applyDocsSelectionInlineStyle = (property, value = "", statusLabel = "Saved automatically") => {
    if (!value) {
      return false;
    }
    let didApply = false;
    withRestoredDocsSelection((range) => {
      const activeRange = range?.cloneRange?.() || null;
      const startBlock = getDocsEditableTargetFromNode(activeRange?.startContainer || null);
      const endBlock = getDocsEditableTargetFromNode(activeRange?.endContainer || null);
      if (!activeRange || activeRange.collapsed || !startBlock || startBlock !== endBlock) {
        return;
      }
      const existingWrapper = getDocsSelectedInlineStyleWrapper(activeRange, startBlock);
      if (existingWrapper) {
        existingWrapper.style[property] = value;
        if (property === "fontSize") {
          existingWrapper.style.lineHeight = "inherit";
          existingWrapper.style.verticalAlign = "baseline";
        }
        const normalizedWrapper = liftDocsInlineStyledNode(existingWrapper, property, startBlock) || existingWrapper;
        const selection = window.getSelection();
        if (selection) {
          const nextRange = document.createRange();
          nextRange.selectNodeContents(normalizedWrapper);
          selection.removeAllRanges();
          selection.addRange(nextRange);
        }
        saveDocsSelectionRange();
        didApply = true;
        return;
      }
      const fragment = activeRange.extractContents();
      if (!fragment.childNodes.length) {
        return;
      }
      Array.from(fragment.childNodes).forEach((child) => stripDocsInlineStyleFromNodeTree(child, property));
      const span = document.createElement("span");
      span.style[property] = value;
      if (property === "fontSize") {
        span.style.lineHeight = "inherit";
        span.style.verticalAlign = "baseline";
      }
      span.appendChild(fragment);
      activeRange.insertNode(span);
      const normalizedSpan = liftDocsInlineStyledNode(span, property, startBlock) || span;
      const selection = window.getSelection();
      if (selection) {
        const nextRange = document.createRange();
        nextRange.selectNodeContents(normalizedSpan);
        selection.removeAllRanges();
        selection.addRange(nextRange);
      }
      saveDocsSelectionRange();
      didApply = true;
    });
    if (!didApply) {
      return false;
    }
    commitDocsVisualChange(statusLabel);
    return true;
  };

  const normalizeDocsMediaRotation = (value = 0) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }
    const normalized = ((numericValue % 360) + 360) % 360;
    return normalized === 360 ? 0 : normalized;
  };

  const getDocsMediaRotation = (target) => {
    const mediaNode = getDocsMediaNodeFromTarget(target);
    if (!mediaNode?.matches?.("img")) {
      return 0;
    }
    return normalizeDocsMediaRotation(mediaNode.dataset.rotation || 0);
  };

  const applyDocsMediaRotation = (target, delta = 0, absoluteValue = null) => {
    const mediaNode = getDocsMediaNodeFromTarget(target);
    if (!mediaNode?.matches?.("img")) {
      updateDocsToolbarStatus("Click an image first.");
      return;
    }
    const nextRotation = normalizeDocsMediaRotation(
      absoluteValue === null ? getDocsMediaRotation(mediaNode) + delta : absoluteValue
    );
    if (nextRotation === 0) {
      delete mediaNode.dataset.rotation;
      mediaNode.style.removeProperty("transform");
      mediaNode.style.removeProperty("transform-origin");
      commitDocsVisualChange("Image rotation reset");
      return;
    }
    mediaNode.dataset.rotation = String(nextRotation);
    mediaNode.style.transform = `rotate(${nextRotation}deg)`;
    mediaNode.style.transformOrigin = "center center";
    commitDocsVisualChange("Image rotated");
  };

  const removeDocsFigureSelectionChrome = (figure) => {
    if (!figure) {
      return;
    }
    figure.classList.remove("is-media-selected", "is-dragging");
    figure.querySelectorAll(".workspace-docs-image-resize-handle").forEach((node) => node.remove());
  };

  const clearDocsMediaSelection = (preserveFigure = null) => {
    if (docsSelectedMediaFigure && docsSelectedMediaFigure !== preserveFigure) {
      removeDocsFigureSelectionChrome(docsSelectedMediaFigure);
    }
    docsSelectedMediaFigure = preserveFigure?.isConnected ? preserveFigure : null;
  };

  const setDocsMediaFigureWidth = (figure, nextWidth) => {
    const mediaNode = getDocsMediaNodeFromTarget(figure);
    const safeWidth = clampPreviewPosition(Number(nextWidth) || 0, 120, Math.max(120, Number(nextWidth) || 120));
    figure.style.width = `${safeWidth}px`;
    if (mediaNode?.matches?.("img")) {
      mediaNode.style.width = "100%";
      mediaNode.style.maxWidth = "100%";
    }
  };

  const beginDocsMediaResize = (figure, direction, event) => {
    if (event.button !== 0) {
      return;
    }
    const mediaNode = getDocsMediaNodeFromTarget(figure);
    const page = getDocsPageSheetFromNode(figure);
    if (!mediaNode?.matches?.("img") || !page) {
      return;
    }

    const pageRect = page.getBoundingClientRect();
    const figureRect = figure.getBoundingClientRect();
    const startWidth = figureRect.width || mediaNode.getBoundingClientRect().width || 240;
    const startLeft = Number.parseFloat(figure.style.left || "0") || 0;
    const widthRatio =
      figureRect.height > 0 ? startWidth / figureRect.height : startWidth / Math.max(mediaNode.getBoundingClientRect().height || 1, 1);
    const minWidth = 120;
    const maxWidthEast = Math.max(minWidth, pageRect.right - figureRect.left - 24);
    const maxWidthWest = Math.max(minWidth, figureRect.right - pageRect.left - 24);
    let resized = false;

    selectDocsMediaFigure(figure);
    figure.classList.add("is-dragging");
    event.target?.setPointerCapture?.(event.pointerId);

    const handleMove = (moveEvent) => {
      if (moveEvent.pointerId !== event.pointerId) {
        return;
      }
      const deltaX = moveEvent.clientX - event.clientX;
      const deltaY = moveEvent.clientY - event.clientY;
      const widthDeltaX = direction.includes("e") ? deltaX : direction.includes("w") ? -deltaX : 0;
      const widthDeltaY =
        (direction.includes("s") ? deltaY : direction.includes("n") ? -deltaY : 0) * Math.max(widthRatio || 1, 0.5);
      const widthDelta = Math.abs(widthDeltaX) >= Math.abs(widthDeltaY) ? widthDeltaX : widthDeltaY;
      const nextWidth = clampPreviewPosition(
        startWidth + widthDelta,
        minWidth,
        direction.includes("w") ? maxWidthWest : maxWidthEast
      );
      setDocsMediaFigureWidth(figure, nextWidth);
      if (direction.includes("w")) {
        figure.style.left = `${startLeft + (startWidth - nextWidth)}px`;
      }
      resized = resized || Math.abs(nextWidth - startWidth) > 1;
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
    };

    const finish = (finishEvent) => {
      if (finishEvent.pointerId !== event.pointerId) {
        return;
      }
      event.target?.releasePointerCapture?.(event.pointerId);
      event.target?.removeEventListener?.("pointermove", handleMove);
      event.target?.removeEventListener?.("pointerup", finish);
      event.target?.removeEventListener?.("pointercancel", finish);
      figure.classList.remove("is-dragging");
      if (resized) {
        commitDocsVisualChange("Image resized");
      }
    };

    event.target?.addEventListener?.("pointermove", handleMove);
    event.target?.addEventListener?.("pointerup", finish);
    event.target?.addEventListener?.("pointercancel", finish);
    event.preventDefault();
    event.stopPropagation();
  };

  const ensureDocsMediaResizeHandles = (figure) => {
    if (!figure || figure.querySelector(".workspace-docs-image-resize-handle")) {
      return;
    }
    ["nw", "ne", "sw", "se"].forEach((direction) => {
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = `workspace-docs-image-resize-handle is-${direction}`;
      handle.contentEditable = "false";
      handle.setAttribute("aria-label", `Resize image from ${direction}`);
      handle.addEventListener("pointerdown", (event) => beginDocsMediaResize(figure, direction, event));
      figure.appendChild(handle);
    });
  };

  const selectDocsMediaFigure = (figure) => {
    if (!figure || !getDocsMediaNodeFromTarget(figure)?.matches?.("img")) {
      return null;
    }
    clearDocsMediaSelection(figure);
    docsSelectedMediaFigure = figure;
    figure.classList.add("is-media-selected");
    ensureDocsMediaResizeHandles(figure);
    return figure;
  };

  const beginDocsMediaDrag = (figure, mediaNode, event) => {
    if (event.button !== 0 || !mediaNode?.matches?.("img")) {
      return;
    }
    if (event.target?.closest?.(".workspace-docs-image-resize-handle")) {
      return;
    }
    const page = getDocsPageSheetFromNode(figure);
    if (!page) {
      return;
    }
    const pageRect = page.getBoundingClientRect();
    const figureRect = figure.getBoundingClientRect();
    const startLeft = Number.parseFloat(figure.style.left || "0") || 0;
    const startTop = Number.parseFloat(figure.style.top || "0") || 0;
    const minLeft = startLeft + (pageRect.left + 24 - figureRect.left);
    const maxLeft = startLeft + (pageRect.right - figureRect.width - 24 - figureRect.left);
    const minTop = startTop + (pageRect.top + 24 - figureRect.top);
    const maxTop = startTop + (pageRect.bottom - figureRect.height - 24 - figureRect.top);
    let moved = false;

    selectDocsMediaFigure(figure);
    figure.classList.add("is-dragging");
    mediaNode.setPointerCapture?.(event.pointerId);

    const handleMove = (moveEvent) => {
      if (moveEvent.pointerId !== event.pointerId) {
        return;
      }
      const deltaX = moveEvent.clientX - event.clientX;
      const deltaY = moveEvent.clientY - event.clientY;
      const nextLeft = clampPreviewPosition(startLeft + deltaX, Math.min(minLeft, maxLeft), Math.max(minLeft, maxLeft));
      const nextTop = clampPreviewPosition(startTop + deltaY, Math.min(minTop, maxTop), Math.max(minTop, maxTop));
      figure.style.left = `${nextLeft}px`;
      figure.style.top = `${nextTop}px`;
      moved = moved || Math.abs(nextLeft - startLeft) > 1 || Math.abs(nextTop - startTop) > 1;
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
    };

    const finish = (finishEvent) => {
      if (finishEvent.pointerId !== event.pointerId) {
        return;
      }
      mediaNode.releasePointerCapture?.(event.pointerId);
      mediaNode.removeEventListener("pointermove", handleMove);
      mediaNode.removeEventListener("pointerup", finish);
      mediaNode.removeEventListener("pointercancel", finish);
      figure.classList.remove("is-dragging");
      if (moved) {
        commitDocsVisualChange("Image moved");
      }
    };

    mediaNode.addEventListener("pointermove", handleMove);
    mediaNode.addEventListener("pointerup", finish);
    mediaNode.addEventListener("pointercancel", finish);
    event.preventDefault();
    event.stopPropagation();
  };

  const syncActiveEditableFromNode = (node) => {
    const editableTarget =
      getDocsEditableTargetFromNode(node) ||
      getDocsActionTargetFromNode(node)?.querySelector?.("figcaption, p, h1, h2, h3, h4, li, td, th") ||
      null;
    if (editableTarget) {
      activeEditable = editableTarget;
    }
    return editableTarget;
  };

  const saveDocsSelectionRange = () => {
    const selection = window.getSelection();
    if (
      selection &&
      selection.rangeCount &&
      shell?.contains(selection.anchorNode) &&
      shell?.contains(selection.focusNode)
    ) {
      docsSavedSelectionRange = selection.getRangeAt(0).cloneRange();
      return true;
    }
    docsSavedSelectionRange = null;
    return false;
  };

  const restoreDocsSelection = () => {
    if (!docsSavedSelectionRange) {
      return false;
    }
    const selection = window.getSelection();
    if (!selection) {
      return false;
    }
    selection.removeAllRanges();
    selection.addRange(docsSavedSelectionRange);
    return true;
  };

  const getDocsPageSheetFromNode = (node) => {
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element?.closest) {
      return null;
    }
    const page = element.closest(".workspace-document-page-sheet");
    if (page && shell?.contains(page)) {
      return page;
    }
    return null;
  };

  const getActiveDocsPageSheet = (anchor = null) => {
    const selection = window.getSelection();
    const selectionPage = getDocsPageSheetFromNode(selection?.anchorNode || null);
    if (selectionPage) {
      return selectionPage;
    }
    const anchorPage = getDocsPageSheetFromNode(anchor);
    if (anchorPage) {
      return anchorPage;
    }
    const activePage = getDocsPageSheetFromNode(activeEditable);
    if (activePage) {
      return activePage;
    }
    return (
      shell?.querySelector(".workspace-document-page-sheet:last-of-type") ||
      shell?.querySelector(".workspace-document-page-sheet") ||
      shell
    );
  };

  const isDocsCanvasFullscreen = () => Boolean(previewShell && document.fullscreenElement === previewShell);
  const isDocsFullscreenActive = () => isDocsCanvasFullscreen() || docsFullscreenFallbackActive;

  const mountDocsPreviewShellInBody = () => {
    if (!previewShell || !document.body || previewShell.parentElement === document.body) {
      return;
    }
    docsFullscreenFallbackPlaceholder = document.createComment("workspace-docs-fullscreen-placeholder");
    previewShell.parentElement?.insertBefore(docsFullscreenFallbackPlaceholder, previewShell);
    document.body.appendChild(previewShell);
  };

  const unmountDocsPreviewShellFromBody = () => {
    if (!previewShell || previewShell.parentElement !== document.body) {
      return;
    }
    if (docsFullscreenFallbackPlaceholder?.parentNode) {
      docsFullscreenFallbackPlaceholder.parentNode.insertBefore(previewShell, docsFullscreenFallbackPlaceholder);
      docsFullscreenFallbackPlaceholder.remove();
      docsFullscreenFallbackPlaceholder = null;
      return;
    }
    docsFullscreenFallbackPlaceholder = null;
  };

  const syncDocsFullscreenPresentation = () => {
    const keepShellMountedInBody =
      docsFullscreenFallbackActive ||
      Boolean(docsFullscreenFallbackPlaceholder && isDocsCanvasFullscreen() && previewShell?.parentElement === document.body);
    if (keepShellMountedInBody) {
      mountDocsPreviewShellInBody();
    } else {
      unmountDocsPreviewShellFromBody();
    }
    previewShell?.classList.toggle("is-fullscreen-fallback", docsFullscreenFallbackActive);
    document.body.classList.toggle("workspace-docs-fallback-open", docsFullscreenFallbackActive);
  };

  const setDocsFullscreenFallbackActive = (active = false) => {
    docsFullscreenFallbackActive = Boolean(active);
    syncDocsFullscreenPresentation();
  };

  const getDocsPageSettingsNode = () => {
    if (!shell) {
      return null;
    }
    let node = shell.querySelector(":scope > .workspace-docs-page-meta");
    if (!node) {
      node = document.createElement("div");
      node.className = "workspace-docs-page-meta";
      node.hidden = true;
      node.contentEditable = "false";
      node.setAttribute("aria-hidden", "true");
      shell.prepend(node);
    }
    return node;
  };

  const getDocsPageFormatState = () => {
    const node = shell?.querySelector?.(":scope > .workspace-docs-page-meta") || null;
    const startValue = Math.max(1, Number.parseInt(node?.dataset?.pageNumberStart || "1", 10) || 1);
    return {
      showHeaderFooter: node?.dataset?.showHeaderFooter === "true",
      showPageNumbers: node?.dataset?.showPageNumbers === "true",
      orientation: node?.dataset?.pageOrientation === "landscape" ? "landscape" : "portrait",
      pageNumberPosition: node?.dataset?.pageNumberPosition === "header" ? "header" : "footer",
      pageNumberShowOnFirstPage: node?.dataset?.pageNumberShowOnFirstPage !== "false",
      pageNumberMode: node?.dataset?.pageNumberMode === "continue" ? "continue" : "start",
      pageNumberStart: startValue
    };
  };

  const updateDocsPageFormatState = (nextState = {}, statusLabel = "Saved automatically") => {
    const node = getDocsPageSettingsNode();
    if (!node) {
      return;
    }
    const currentState = getDocsPageFormatState();
    const mergedState = {
      ...currentState,
      ...nextState
    };
    node.dataset.showHeaderFooter = mergedState.showHeaderFooter ? "true" : "false";
    node.dataset.showPageNumbers = mergedState.showPageNumbers ? "true" : "false";
    node.dataset.pageOrientation = mergedState.orientation === "landscape" ? "landscape" : "portrait";
    node.dataset.pageNumberPosition = mergedState.pageNumberPosition === "header" ? "header" : "footer";
    node.dataset.pageNumberShowOnFirstPage = mergedState.pageNumberShowOnFirstPage === false ? "false" : "true";
    node.dataset.pageNumberMode = mergedState.pageNumberMode === "continue" ? "continue" : "start";
    node.dataset.pageNumberStart = String(Math.max(1, Number.parseInt(mergedState.pageNumberStart || "1", 10) || 1));
    commitDocsLayoutChange(statusLabel, null, { rebuildPageShell: true });
  };

  const applyDocsPageChrome = (page, pageIndex = 0, formatState = getDocsPageFormatState()) => {
    if (!page) {
      return;
    }
    page.dataset.orientation = formatState.orientation === "landscape" ? "landscape" : "portrait";
    page.querySelectorAll(":scope > .workspace-docs-page-header, :scope > .workspace-docs-page-footer").forEach((node) => node.remove());
    if (!formatState.showHeaderFooter && !formatState.showPageNumbers) {
      return;
    }
    const shouldShowNumber = formatState.showPageNumbers && (formatState.pageNumberShowOnFirstPage || pageIndex > 0);
    const basePageNumber = formatState.pageNumberMode === "continue" ? 1 : Math.max(1, Number(formatState.pageNumberStart) || 1);
    const pageNumberValue = basePageNumber + pageIndex;
    const shouldRenderHeader = formatState.showHeaderFooter || (shouldShowNumber && formatState.pageNumberPosition === "header");
    const shouldRenderFooter = formatState.showHeaderFooter || (shouldShowNumber && formatState.pageNumberPosition === "footer");

    if (shouldRenderHeader) {
      const header = document.createElement("div");
      header.className = "workspace-docs-page-header";
      header.contentEditable = "false";
      if (formatState.showHeaderFooter) {
        const headerLabel = document.createElement("span");
        headerLabel.className = "workspace-docs-page-header-label";
        headerLabel.textContent = "En-tete";
        header.appendChild(headerLabel);
      }
      if (shouldShowNumber && formatState.pageNumberPosition === "header") {
        const pageNumber = document.createElement("span");
        pageNumber.className = "workspace-docs-page-number";
        pageNumber.textContent = String(pageNumberValue);
        header.appendChild(pageNumber);
      }
      page.prepend(header);
    }

    if (shouldRenderFooter) {
      const footer = document.createElement("div");
      footer.className = "workspace-docs-page-footer";
      footer.contentEditable = "false";
      if (formatState.showHeaderFooter) {
        const footerLabel = document.createElement("span");
        footerLabel.className = "workspace-docs-page-footer-label";
        footerLabel.textContent = "Pied de page";
        footer.appendChild(footerLabel);
      }
      if (shouldShowNumber && formatState.pageNumberPosition === "footer") {
        const pageNumber = document.createElement("span");
        pageNumber.className = "workspace-docs-page-number";
        pageNumber.textContent = String(pageNumberValue);
        footer.appendChild(pageNumber);
      }
      page.appendChild(footer);
    }
  };

  const toggleDocsHeaderFooter = () => {
    const currentState = getDocsPageFormatState();
    updateDocsPageFormatState(
      {
        showHeaderFooter: !currentState.showHeaderFooter
      },
      currentState.showHeaderFooter ? "Headers and footers hidden" : "Headers and footers shown"
    );
  };

  const toggleDocsPageNumbers = () => {
    const currentState = getDocsPageFormatState();
    updateDocsPageFormatState(
      {
        showPageNumbers: !currentState.showPageNumbers
      },
      currentState.showPageNumbers ? "Page numbers hidden" : "Page numbers shown"
    );
  };

  const toggleDocsPageOrientation = () => {
    const currentState = getDocsPageFormatState();
    const nextOrientation = currentState.orientation === "landscape" ? "portrait" : "landscape";
    updateDocsPageFormatState(
      {
        orientation: nextOrientation
      },
      nextOrientation === "landscape" ? "Landscape page enabled" : "Portrait page enabled"
    );
  };

  const syncDocsFullscreenButtonState = () => {
    const isFullscreen = isDocsFullscreenActive();
    docsFullscreenButtons = docsFullscreenButtons.filter((button) => button?.isConnected);
    docsFullscreenButtons.forEach((button) => {
      button.dataset.state = isFullscreen ? "exit" : "enter";
      button.title = isFullscreen ? "Exit fullscreen" : "Open fullscreen";
      button.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Open fullscreen");
    });
  };

  const toggleDocsFullscreen = async () => {
    if (!previewShell) {
      return;
    }
    if (docsFullscreenFallbackActive && !isDocsCanvasFullscreen()) {
      restoreDocsFullscreenAfterImageImport = false;
      setDocsFullscreenFallbackActive(false);
      updateDocsToolbarStatus("Exited fullscreen");
      syncDocsFullscreenButtonState();
      return;
    }
    if (!isDocsCanvasFullscreen() && typeof previewShell.requestFullscreen !== "function") {
      updateDocsToolbarStatus("Fullscreen unavailable in this browser.");
      return;
    }

    try {
      if (isDocsCanvasFullscreen()) {
        if (typeof document.exitFullscreen === "function") {
          await document.exitFullscreen();
        }
        setDocsFullscreenFallbackActive(false);
        updateDocsToolbarStatus("Exited fullscreen");
      } else {
        await previewShell.requestFullscreen();
        setDocsFullscreenFallbackActive(false);
        updateDocsToolbarStatus("Fullscreen opened");
      }
    } catch {
      updateDocsToolbarStatus("Fullscreen unavailable in this browser.");
    }
    syncDocsFullscreenButtonState();
  };

  const restoreDocsFullscreenIfNeeded = async () => {
    if (!restoreDocsFullscreenAfterImageImport) {
      return;
    }
    if (isDocsCanvasFullscreen()) {
      restoreDocsFullscreenAfterImageImport = false;
      setDocsFullscreenFallbackActive(false);
      syncDocsFullscreenButtonState();
      return;
    }
    if (typeof previewShell?.requestFullscreen === "function") {
      try {
        await previewShell.requestFullscreen();
        setDocsFullscreenFallbackActive(false);
        updateDocsToolbarStatus("Fullscreen reopened");
      } catch {
        setDocsFullscreenFallbackActive(true);
        updateDocsToolbarStatus("Fullscreen kept after import");
      }
    } else {
      setDocsFullscreenFallbackActive(true);
      updateDocsToolbarStatus("Fullscreen kept after import");
    }
    restoreDocsFullscreenAfterImageImport = false;
    syncDocsFullscreenButtonState();
  };

  const ensureDocsPageFullscreenControl = (page) => {
    if (!page) {
      return null;
    }

    let controlBar = page.querySelector(".workspace-docs-page-control-bar");
    if (!controlBar) {
      controlBar = document.createElement("div");
      controlBar.className = "workspace-docs-page-control-bar";
      controlBar.contentEditable = "false";
      page.appendChild(controlBar);
    }

    let button = controlBar.querySelector(".workspace-docs-fullscreen-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-docs-fullscreen-button";
      button.contentEditable = "false";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleDocsFullscreen();
      });
      controlBar.appendChild(button);
    }

    return button;
  };

  const syncDocsPageFullscreenControls = () => {
    if (!shell) {
      return;
    }

    docsFullscreenButtons = Array.from(shell.querySelectorAll(".workspace-document-page-sheet"))
      .map((page) => ensureDocsPageFullscreenControl(page))
      .filter(Boolean);
    syncDocsFullscreenButtonState();
  };

  const insertDocsNodes = (...nodes) => {
    if (!shell || !nodes.length) {
      return;
    }
    const anchor = getActiveInsertionAnchor();
    const anchorParent = anchor?.parentElement || null;
    if (anchor && anchorParent?.classList?.contains("workspace-document-page-sheet")) {
      anchor.after(...nodes);
      return;
    }
    if (anchor && anchorParent === shell && anchor.classList?.contains("workspace-docs-page-break")) {
      anchor.after(...nodes);
      return;
    }
    const targetPage = getActiveDocsPageSheet(anchor);
    if (targetPage && targetPage !== shell) {
      targetPage.append(...nodes);
      return;
    }
    shell.append(...nodes);
  };

  const getDocsTableFromNode = (node) => {
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element?.closest) {
      return null;
    }
    const table = element.closest("table");
    if (table && shell?.contains(table)) {
      return table;
    }
    return null;
  };

  const getActiveTableTarget = () => {
    const selection = window.getSelection();
    const tableFromSelection = getDocsTableFromNode(selection?.anchorNode || null);
    if (tableFromSelection) {
      return tableFromSelection;
    }
    const tableFromActiveEditable = getDocsTableFromNode(activeEditable);
    if (tableFromActiveEditable) {
      return tableFromActiveEditable;
    }
    return null;
  };

  const getTableBody = (table) => {
    if (!table) {
      return null;
    }
    return table.tBodies?.[0] || table.appendChild(document.createElement("tbody"));
  };

  const getTableBodyRows = (table) => Array.from(getTableBody(table)?.rows || []);

  const getTableReferenceCells = (table) =>
    Array.from((table?.tHead?.rows?.[0] || table?.rows?.[0])?.children || []);

  const getColumnLetterLabel = (index) => {
    let value = Math.max(0, Number(index) || 0);
    let label = "";
    do {
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);
    return label;
  };

  const shouldAutoLabelTableColumns = (table) => {
    const headerCells = getTableReferenceCells(table);
    if (!headerCells.length) {
      return false;
    }
    return headerCells.every((cell) => {
      const label = String(cell.textContent || "").trim();
      return !label || /^[A-Z]{1,3}$/.test(label) || /^Column\s+[A-Z]{1,3}$/i.test(label);
    });
  };

  const syncGeneratedTableColumnLabels = (table) => {
    if (!shouldAutoLabelTableColumns(table)) {
      return;
    }
    getTableReferenceCells(table).forEach((cell, index) => {
      cell.textContent = getColumnLetterLabel(index);
    });
  };

  const hideDocsTableContextMenu = () => {
    if (!docsTableContextMenu) {
      return;
    }
    docsTableContextMenu.replaceChildren();
    docsTableContextMenu.classList.add("hidden");
    docsTableContextMenu.style.removeProperty("left");
    docsTableContextMenu.style.removeProperty("top");
    docsTableContextMenu.style.removeProperty("visibility");
  };

  const hideDocsTableControls = () => {
    if (!docsTableControls) {
      return;
    }
    hideDocsTableContextMenu();
    docsTableControlSignature = "";
    docsTableControls.replaceChildren();
    docsTableControls.classList.add("hidden");
  };

  const getTableColumnCount = (table) =>
    Array.from(table?.querySelectorAll("tr") || []).reduce(
      (maxColumns, row) => Math.max(maxColumns, row.children?.length || 0),
      0
    );

  const getDocsTableControlsSignature = (tables = []) =>
    tables
      .map((table) => {
        const rect = table?.getBoundingClientRect?.();
        if (!rect) {
          return "";
        }
        return [
          getTableBodyRows(table).length,
          getTableColumnCount(table),
          Math.round(rect.left),
          Math.round(rect.top),
          Math.round(rect.width),
          Math.round(rect.height)
        ].join(":");
      })
      .join("|");

  const showDocsTableContextMenu = ({ left, top, actions = [] }) => {
    if (!docsCanvas || !docsTableContextMenu || !actions.length) {
      return;
    }
    docsTableContextMenu.replaceChildren();
    actions.forEach((action) => {
      if (action.type === "label") {
        const label = document.createElement("span");
        label.className = "workspace-docs-table-menu-label";
        label.textContent = action.label;
        docsTableContextMenu.appendChild(label);
        return;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.className = `workspace-docs-table-menu-item${action.danger ? " is-danger" : ""}`;
      item.textContent = action.label;
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        hideDocsTableContextMenu();
        if (action.restoreSelection) {
          restoreDocsSelection();
        }
        action.onClick?.();
      });
      docsTableContextMenu.appendChild(item);
    });
    docsTableContextMenu.classList.remove("hidden");
    docsTableContextMenu.style.visibility = "hidden";
    docsTableContextMenu.style.left = "0px";
    docsTableContextMenu.style.top = "0px";
    const menuWidth = docsTableContextMenu.offsetWidth || 180;
    const menuHeight = docsTableContextMenu.offsetHeight || actions.length * 36;
    const clampedLeft = Math.min(Math.max(12, left), Math.max(12, docsCanvas.clientWidth - menuWidth - 12));
    const clampedTop = Math.min(Math.max(12, top), Math.max(12, docsCanvas.clientHeight - menuHeight - 12));
    docsTableContextMenu.style.left = `${clampedLeft}px`;
    docsTableContextMenu.style.top = `${clampedTop}px`;
    docsTableContextMenu.style.visibility = "";
  };

  const bindDocsTableControl = (button, { onClick, onContextMenu }) => {
    button.addEventListener("focus", () => {
      button.blur();
    });
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      hideDocsTableContextMenu();
      button.classList.add("is-pressing");
    });
    button.addEventListener("pointerup", (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      button.classList.remove("is-pressing");
    });
    button.addEventListener("pointerleave", () => {
      button.classList.remove("is-pressing");
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideDocsTableContextMenu();
      button.classList.remove("is-pressing");
      onClick?.();
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.classList.remove("is-pressing");
      onContextMenu?.(event);
    });
  };

  const createDocsTableControlButton = ({ left, top, kind, title, onClick, onContextMenu }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-docs-table-control ${kind}`;
    button.textContent = "+";
    button.tabIndex = -1;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
    bindDocsTableControl(button, { onClick, onContextMenu });
    return button;
  };

  const updateDocsTableControls = (_tableOverride = null, force = false) => {
    if (!docsCanvas || !docsTableControls) {
      return;
    }
    const tables = Array.from(shell?.querySelectorAll("table") || []).filter((table) => docsCanvas.contains(table));
    if (!tables.length) {
      hideDocsTableControls();
      return;
    }
    const signature = getDocsTableControlsSignature(tables);
    if (!force && docsTableControlSignature === signature) {
      docsTableControls.classList.remove("hidden");
      return;
    }
    docsTableControlSignature = signature;
    docsTableControls.replaceChildren();

    const clampX = (value) =>
      Math.min(Math.max(18, value), Math.max(18, docsCanvas.clientWidth - 18));
    const clampY = (value) =>
      Math.min(Math.max(18, value), Math.max(18, docsCanvas.clientHeight - 18));
    const canvasRect = docsCanvas.getBoundingClientRect();

    tables.forEach((table) => {
      const tableRect = table.getBoundingClientRect();
      const bodyRows = getTableBodyRows(table);
      const rowControlX = clampX(tableRect.left - canvasRect.left - 12);

      bodyRows.forEach((row, rowIndex) => {
        const rect = row.getBoundingClientRect();
        docsTableControls.appendChild(
          createDocsTableControlButton({
            left: rowControlX,
            top: clampY(rect.top - canvasRect.top),
            kind: "is-row",
            title: "Click to add a row here. Right-click for delete options.",
            onClick: () => addTableRow(table, rowIndex),
            onContextMenu: (event) =>
              showDocsTableContextMenu({
                left: event.clientX - canvasRect.left + 10,
                top: event.clientY - canvasRect.top + 10,
                actions: [
                  {
                    label: "Supprimer la ligne",
                    danger: true,
                    onClick: () => removeTableRow(table, rowIndex)
                  },
                  {
                    label: "Supprimer le tableau",
                    danger: true,
                    onClick: () => removeTable(table)
                  }
                ]
              })
          })
        );
      });

      const lastBodyRow = bodyRows[bodyRows.length - 1];
      if (lastBodyRow) {
        const rect = lastBodyRow.getBoundingClientRect();
        docsTableControls.appendChild(
          createDocsTableControlButton({
            left: rowControlX,
            top: clampY(rect.bottom - canvasRect.top),
            kind: "is-row",
            title: "Click to add a row below. Right-click for delete options.",
            onClick: () => addTableRow(table, bodyRows.length),
            onContextMenu: (event) =>
              showDocsTableContextMenu({
                left: event.clientX - canvasRect.left + 10,
                top: event.clientY - canvasRect.top + 10,
                actions: [
                  {
                    label: "Supprimer la ligne",
                    danger: true,
                    onClick: () => removeTableRow(table, bodyRows.length - 1)
                  },
                  {
                    label: "Supprimer le tableau",
                    danger: true,
                    onClick: () => removeTable(table)
                  }
                ]
              })
          })
        );
      }

      const referenceCells = getTableReferenceCells(table);
      const columnControlY = clampY(tableRect.top - canvasRect.top - 12);
      referenceCells.forEach((cell, columnIndex) => {
        const rect = cell.getBoundingClientRect();
        docsTableControls.appendChild(
          createDocsTableControlButton({
            left: clampX(rect.right - canvasRect.left),
            top: columnControlY,
            kind: "is-column",
            title: "Click to add a column here. Right-click for delete options.",
            onClick: () => addTableColumn(table, columnIndex + 1),
            onContextMenu: (event) =>
              showDocsTableContextMenu({
                left: event.clientX - canvasRect.left + 10,
                top: event.clientY - canvasRect.top + 10,
                actions: [
                  {
                    label: "Supprimer la colonne",
                    danger: true,
                    onClick: () => removeTableColumn(table, columnIndex)
                  },
                  {
                    label: "Supprimer le tableau",
                    danger: true,
                    onClick: () => removeTable(table)
                  }
                ]
              })
          })
        );
      });
    });

    if (!docsTableControls.children.length) {
      hideDocsTableControls();
      return;
    }
    docsTableControls.classList.remove("hidden");
  };

  const commitDocsLayoutChange = (
    statusLabel = "Saved automatically",
    tableOverride = null,
    { rebuildPageShell = false } = {}
  ) => {
    hideDocsTableContextMenu();
    if (isDocsClone && rebuildPageShell) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    window.requestAnimationFrame(() => updateDocsTableControls(tableOverride, true));
    updateDocsToolbarStatus(statusLabel);
  };

  const addTableRow = (tableOverride = null, insertionIndex = null) => {
    const table = tableOverride || getActiveTableTarget();
    if (!table) {
      updateDocsToolbarStatus("Click inside a table first.");
      return;
    }
    const columnCount = getTableColumnCount(table) || 1;
    const tbody = getTableBody(table);
    const rows = getTableBodyRows(table);
    const nextRowIndex = typeof insertionIndex === "number" ? insertionIndex : rows.length;
    const safeIndex = Math.max(0, Math.min(nextRowIndex, rows.length));
    const row = document.createElement("tr");
    for (let index = 0; index < columnCount; index += 1) {
      const td = document.createElement("td");
      td.textContent = `Value ${index + 1}`;
      row.appendChild(td);
    }
    tbody.insertBefore(row, rows[safeIndex] || null);
    activeEditable = row.querySelector("td");
    commitDocsLayoutChange("Row added", table);
  };

  const removeTableRow = (tableOverride = null, rowIndex = null) => {
    const table = tableOverride || getActiveTableTarget();
    if (!table) {
      updateDocsToolbarStatus("Click inside a table first.");
      return;
    }
    const bodyRows = getTableBodyRows(table);
    if (bodyRows.length <= 1) {
      updateDocsToolbarStatus("Keep at least one row in the table.");
      return;
    }
    const targetIndex = Math.max(
      0,
      Math.min(typeof rowIndex === "number" ? rowIndex : bodyRows.length - 1, bodyRows.length - 1)
    );
    bodyRows[targetIndex]?.remove();
    activeEditable =
      table.querySelector("tbody td, tbody th") ||
      table.querySelector("thead td, thead th") ||
      table.querySelector("td, th");
    commitDocsLayoutChange("Row removed", table);
  };

  const addTableColumn = (tableOverride = null, insertionIndex = null) => {
    const table = tableOverride || getActiveTableTarget();
    if (!table) {
      updateDocsToolbarStatus("Click inside a table first.");
      return;
    }
    const rows = Array.from(table.querySelectorAll("tr"));
    if (!rows.length) {
      return;
    }
    const columnCount = getTableColumnCount(table);
    const safeIndex = Math.max(
      0,
      Math.min(typeof insertionIndex === "number" ? insertionIndex : columnCount, columnCount)
    );
    rows.forEach((row, rowIndex) => {
      const isHeaderRow = row.parentElement?.tagName?.toLowerCase?.() === "thead" || (!table.tHead && rowIndex === 0);
      const cell = document.createElement(isHeaderRow ? "th" : "td");
      cell.textContent = isHeaderRow ? getColumnLetterLabel(safeIndex) : `Value ${safeIndex + 1}`;
      row.insertBefore(cell, row.children[safeIndex] || null);
    });
    syncGeneratedTableColumnLabels(table);
    const focusRow = table.querySelector("tbody tr") || rows[0];
    activeEditable = focusRow?.children?.[safeIndex] || rows[0]?.children?.[safeIndex] || null;
    commitDocsLayoutChange("Column added", table);
  };

  const removeTableColumn = (tableOverride = null, columnIndex = null) => {
    const table = tableOverride || getActiveTableTarget();
    if (!table) {
      updateDocsToolbarStatus("Click inside a table first.");
      return;
    }
    const rows = Array.from(table.querySelectorAll("tr"));
    const columnCount = getTableColumnCount(table);
    if (columnCount <= 1) {
      updateDocsToolbarStatus("Keep at least one column in the table.");
      return;
    }
    const targetIndex = Math.max(
      0,
      Math.min(typeof columnIndex === "number" ? columnIndex : columnCount - 1, columnCount - 1)
    );
    rows.forEach((row) => row.children[targetIndex]?.remove());
    syncGeneratedTableColumnLabels(table);
    activeEditable =
      table.querySelector("tbody td, tbody th") ||
      table.querySelector("thead td, thead th") ||
      rows[0]?.children?.[Math.max(0, targetIndex - 1)] ||
      null;
    commitDocsLayoutChange("Column removed", table);
  };

  const removeTable = (tableOverride = null) => {
    const table = tableOverride || getActiveTableTarget();
    if (!table) {
      updateDocsToolbarStatus("Click inside a table first.");
      return;
    }
    const nextEditable =
      table.nextElementSibling?.querySelector?.("[contenteditable='true']") ||
      table.previousElementSibling?.querySelector?.("[contenteditable='true']") ||
      null;
    table.remove();
    activeEditable = nextEditable;
    commitDocsLayoutChange("Table removed");
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

  const applyBlockTextColor = (value = "") => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    target.style.color = value || "";
    commitDocsVisualChange("Text color updated");
  };

  const applyBlockHighlightColor = (value = "") => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    target.style.backgroundColor = value || "";
    commitDocsVisualChange(value ? "Highlight updated" : "Highlight cleared");
  };

  const applyBlockFontSize = (value = "") => {
    const normalizedValue = normalizeDocsFontSizeValue(value);
    if (normalizedValue && applyDocsSelectionInlineStyle("fontSize", normalizedValue, "Font size updated")) {
      return;
    }
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    target.style.fontSize = normalizedValue || "";
    commitDocumentShell();
    updateDocsToolbarStatus(normalizedValue ? "Font size updated" : "Saved automatically");
  };

  const applyBlockFontFamily = (value = "") => {
    if (value && applyDocsSelectionInlineStyle("fontFamily", value, "Font updated")) {
      return;
    }
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    target.style.fontFamily = value || "";
    commitDocumentShell();
    updateDocsToolbarStatus(value ? "Font updated" : "Saved automatically");
  };

  const resetActiveBlockFormatting = () => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    target.style.removeProperty("text-align");
    target.style.removeProperty("font-size");
    target.style.removeProperty("font-family");
    target.style.removeProperty("font-weight");
    target.style.removeProperty("font-style");
    target.style.removeProperty("text-decoration");
    target.style.removeProperty("color");
    target.style.removeProperty("background-color");
    commitDocsVisualChange("Formatting reset");
  };

  const commitDocsVisualChange = (statusLabel = "Saved automatically") => {
    commitDocumentShell();
    window.requestAnimationFrame(() => updateDocsTableControls(null, true));
    updateDocsToolbarStatus(statusLabel);
  };

  const toggleActiveBlockStyle = (property, activeValue, inactiveValue = "") => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    target.style[property] = target.style[property] === activeValue ? inactiveValue : activeValue;
    commitDocsVisualChange();
  };

  const toggleActiveBlockUnderline = () => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    const current = String(target.style.textDecoration || "");
    target.style.textDecoration = current.includes("underline") ? "" : "underline";
    commitDocsVisualChange();
  };

  const toggleActiveBlockStrikethrough = () => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    const current = String(target.style.textDecoration || "");
    target.style.textDecoration = current.includes("line-through") ? "" : "line-through";
    commitDocsVisualChange();
  };

  const runInlineCommandWithSelection = (command, value = null, fallback = null, statusLabel = "Saved automatically") => {
    const restored = docsSavedSelectionRange && !docsSavedSelectionRange.collapsed && restoreDocsSelection();
    if (restored) {
      const applied = document.execCommand(command, false, value);
      if (applied !== false) {
        saveDocsSelectionRange();
        commitDocsVisualChange(statusLabel);
        return;
      }
    }
    fallback?.();
  };

  const runInlineCommandFromContextMenu = (command, fallback = null) => {
    runInlineCommandWithSelection(command, null, fallback);
  };

  const preserveDocsSelectionOnPointerDown = (element, { preventFocus = true } = {}) => {
    if (!element) {
      return;
    }
    element.addEventListener("pointerdown", (event) => {
      saveDocsSelectionRange();
      if (preventFocus) {
        event.preventDefault();
      }
    });
  };

  const syncDocsSelectionPreviewState = (active = false) => {
    shell?.classList?.toggle("workspace-docs-soft-selection", Boolean(active));
  };

  const findNearestEditableSibling = (node) => {
    if (!node) {
      return null;
    }
    return (
      node.nextElementSibling?.querySelector?.("[contenteditable='true']") ||
      node.previousElementSibling?.querySelector?.("[contenteditable='true']") ||
      node.parentElement?.querySelector?.("[contenteditable='true']") ||
      null
    );
  };

  const removeDocsActionTarget = (targetOverride = null) => {
    const target =
      targetOverride ||
      getDocsActionTargetFromNode(window.getSelection()?.anchorNode || null) ||
      getDocsActionTargetFromNode(activeEditable);
    if (!target) {
      updateDocsToolbarStatus("Nothing to remove here.");
      return;
    }

    const table = target.closest?.("table");
    if (table) {
      removeTable(table);
      return;
    }

    let nodeToRemove = null;
    let statusLabel = "Element removed";
    if (isDocsMediaTarget(target)) {
      nodeToRemove = getDocsFigureTargetFromNode(target);
      statusLabel = "Media removed";
    } else if (target.matches?.("li")) {
      const list = target.parentElement;
      if (list && list.children.length <= 1) {
        nodeToRemove = list;
        statusLabel = "List removed";
      } else {
        nodeToRemove = target;
        statusLabel = "List item removed";
      }
    } else if (target.matches?.("hr")) {
      nodeToRemove = target;
      statusLabel = "Divider removed";
    } else if (target.matches?.(".workspace-docs-page-break")) {
      nodeToRemove = target;
      statusLabel = "Page break removed";
    } else {
      nodeToRemove = target.closest?.("blockquote, p, h1, h2, h3, h4, figcaption, ul, ol") || target;
      statusLabel = "Block removed";
    }

    if (!nodeToRemove) {
      updateDocsToolbarStatus("Nothing to remove here.");
      return;
    }

    if (nodeToRemove === docsSelectedMediaFigure || nodeToRemove.contains?.(docsSelectedMediaFigure)) {
      clearDocsMediaSelection();
    }
    const nextEditable = findNearestEditableSibling(nodeToRemove);
    nodeToRemove.remove();
    activeEditable = nextEditable;
    commitDocsLayoutChange(statusLabel, null, { rebuildPageShell: true });
  };

  const getDocsRemovalActionLabel = (target = null) => {
    if (!target) {
      return "Delete";
    }
    if (target.closest?.("table")) {
      return "Delete table";
    }
    if (isDocsMediaTarget(target)) {
      return "Delete media";
    }
    if (target.matches?.("li")) {
      return "Delete list item";
    }
    if (target.matches?.("hr")) {
      return "Delete divider";
    }
    if (target.matches?.(".workspace-docs-page-break")) {
      return "Delete page break";
    }
    return "Delete block";
  };

  const buildDocsContextMenuActions = (target = null) => {
    const resolvedTarget = target || getDocsActionTargetFromNode(activeEditable) || shell;
    const figureTarget = getDocsFigureTargetFromNode(resolvedTarget);
    const mediaTarget = isDocsMediaTarget(resolvedTarget);
    const mediaNode = getDocsMediaNodeFromTarget(resolvedTarget);
    const imageTarget = mediaNode?.matches?.("img");
    const editableTarget = mediaTarget ? null : getDocsEditableTargetFromNode(target) || activeEditable;
    const table = resolvedTarget?.closest?.("table") || null;
    const selectionActive = Boolean(docsSavedSelectionRange && !docsSavedSelectionRange.collapsed);
    const actions = [];
    const addLabel = (label) => actions.push({ type: "label", label });
    const addAction = (label, onClick, options = {}) =>
      actions.push({
        label,
        onClick,
        danger: options.danger,
        restoreSelection: options.restoreSelection
      });

    if (editableTarget || selectionActive) {
      addLabel("Text");
      addAction("Bold", () => runInlineCommandFromContextMenu("bold", () => toggleActiveBlockStyle("fontWeight", "700", "")), {
        restoreSelection: true
      });
      addAction("Italic", () => runInlineCommandFromContextMenu("italic", () => toggleActiveBlockStyle("fontStyle", "italic", "")), {
        restoreSelection: true
      });
      addAction("Underline", () => runInlineCommandFromContextMenu("underline", toggleActiveBlockUnderline), {
        restoreSelection: true
      });
      addAction("Text", () => convertActiveBlockTag("p"));
      addAction("Title", () => convertActiveBlockTag("h1"));
      addAction("Heading", () => convertActiveBlockTag("h2"));
      addAction("Subhead", () => convertActiveBlockTag("h3"));
      addAction("Bullets", () => convertActiveBlockToList(false));
      addAction("Numbered", () => convertActiveBlockToList(true));
      addAction("Left align", () => applyBlockAlignment("left"));
      addAction("Center align", () => applyBlockAlignment("center"));
      addLabel("Size");
      [
        ["Auto size", ""],
        ["12", "12px"],
        ["14", "14px"],
        ["16", "16px"],
        ["18", "18px"],
        ["24", "24px"],
        ["32", "32px"]
      ].forEach(([label, value]) => addAction(label, () => applyBlockFontSize(value)));
    }

    if (table) {
      const row = resolvedTarget.closest?.("tr") || null;
      const cell = resolvedTarget.closest?.("th, td") || null;
      const rowIndex = row?.parentElement?.tagName?.toLowerCase?.() === "tbody" ? getTableBodyRows(table).indexOf(row) : null;
      const columnIndex = row && cell ? Array.from(row.children).indexOf(cell) : null;
      addLabel("Table");
      addAction("Insert row below", () => addTableRow(table, rowIndex === null ? getTableBodyRows(table).length : rowIndex + 1));
      addAction("Insert column right", () => addTableColumn(table, columnIndex === null ? getTableColumnCount(table) : columnIndex + 1));
      if (rowIndex !== null && rowIndex >= 0) {
        addAction("Delete row", () => removeTableRow(table, rowIndex), { danger: true });
      }
      if (columnIndex !== null && columnIndex >= 0) {
        addAction("Delete column", () => removeTableColumn(table, columnIndex), { danger: true });
      }
      addAction("Delete table", () => removeTable(table), { danger: true });
    } else if (!mediaTarget) {
      addLabel("Insert");
      addAction("Checklist", insertChecklist);
      addAction("Quote", insertQuote);
      addAction("Divider", insertDivider);
      addAction("Table", insertTable);
      addAction("Import image", triggerImageImport);
      addAction("From URL", insertImageFromUrl);
      addAction("New section", insertNewSection);
      addAction("New page", insertPageBreak);
    }

    if (mediaTarget && figureTarget) {
      addLabel(imageTarget ? "Image" : "Media");
      if (imageTarget) {
        addAction("Tourner a gauche", () => applyDocsMediaRotation(mediaNode, -90));
        addAction("Tourner a droite", () => applyDocsMediaRotation(mediaNode, 90));
        addAction("Reinitialiser la rotation", () => applyDocsMediaRotation(mediaNode, 0, 0));
        addAction("Supprimer l'image", () => removeDocsActionTarget(figureTarget), { danger: true });
      } else {
        addAction("Delete media", () => removeDocsActionTarget(figureTarget), { danger: true });
      }
    }

    addLabel("View");
    addAction(isDocsCanvasFullscreen() ? "Exit fullscreen" : "Open fullscreen", toggleDocsFullscreen);

    if (resolvedTarget && resolvedTarget !== shell && !mediaTarget) {
      addLabel("Remove");
      addAction(getDocsRemovalActionLabel(resolvedTarget), () => removeDocsActionTarget(resolvedTarget), { danger: true });
    }

    return actions;
  };

  const showDocsContextMenuForTarget = (target, clientX, clientY) => {
    if (!docsCanvas) {
      return;
    }
    const resolvedTarget = getDocsActionTargetFromNode(target) || shell;
    syncActiveEditableFromNode(target);
    const figureCaption = getDocsFigureTargetFromNode(resolvedTarget)?.querySelector?.("figcaption") || null;
    if (figureCaption) {
      activeEditable = figureCaption;
    }
    saveDocsSelectionRange();
    hideDocsTableContextMenu();
    const canvasRect = docsCanvas.getBoundingClientRect();
    const actions = buildDocsContextMenuActions(resolvedTarget);
    showDocsTableContextMenu({
      left: clientX - canvasRect.left + 10,
      top: clientY - canvasRect.top + 10,
      actions
    });
  };

  const bindDocsFigureInteractions = (figure) => {
    if (!figure || figure.dataset.docsFigureBound === "true") {
      return;
    }
    figure.dataset.docsFigureBound = "true";
    figure.contentEditable = "false";
    figure.querySelectorAll("img, video").forEach((mediaNode) => {
      mediaNode.contentEditable = "false";
      mediaNode.draggable = false;
      mediaNode.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectDocsMediaFigure(figure);
        updateDocsToolbarStatus("Image selected");
      });
      mediaNode.addEventListener("pointerdown", (event) => {
        beginDocsMediaDrag(figure, mediaNode, event);
      });
      mediaNode.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectDocsMediaFigure(figure);
        showDocsContextMenuForTarget(mediaNode, event.clientX, event.clientY);
      });
    });
    figure.addEventListener("click", (event) => {
      if (event.target?.matches?.("img, video")) {
        const caption = figure.querySelector("figcaption");
        if (caption) {
          activeEditable = caption;
        }
      }
    });
    figure.addEventListener("contextmenu", (event) => {
      if (
        event.target.closest?.(".workspace-docs-table-menu, .workspace-docs-table-control, .workspace-docs-page-control-bar")
      ) {
        return;
      }
      if (event.target?.matches?.("img, video")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      showDocsContextMenuForTarget(figure, event.clientX, event.clientY);
    });
  };

  const unwrapDocsPageShell = () => {
    if (!shell) {
      return;
    }
    const rawNodes = [];
    Array.from(shell.children).forEach((child) => {
      if (child.classList?.contains("workspace-docs-page-meta")) {
        rawNodes.push(child);
        return;
      }
      if (child.classList?.contains("workspace-document-page-sheet")) {
        rawNodes.push(
          ...Array.from(child.childNodes).filter(
            (node) =>
              !(
                node.nodeType === Node.ELEMENT_NODE &&
                (
                  node.classList?.contains("workspace-docs-page-control-bar") ||
                  node.classList?.contains("workspace-docs-page-header") ||
                  node.classList?.contains("workspace-docs-page-footer")
                )
              )
          )
        );
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
    const settingsNode =
      rawNodes.find((node) => node.nodeType === Node.ELEMENT_NODE && node.classList?.contains("workspace-docs-page-meta")) || null;
    const contentNodes = rawNodes.filter((node) => node !== settingsNode);
    const formatState = getDocsPageFormatState();
    shell.innerHTML = "";
    if (settingsNode) {
      shell.appendChild(settingsNode);
    }
    let pageIndex = 0;
    let currentPage = document.createElement("section");
    currentPage.className = "workspace-document-page-sheet";
    currentPage.dataset.page = String(pageIndex + 1);
    for (const node of contentNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains("workspace-docs-page-break")) {
        applyDocsPageChrome(currentPage, pageIndex, formatState);
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
    if (currentPage.childNodes.length || !shell.querySelector(".workspace-document-page-sheet")) {
      applyDocsPageChrome(currentPage, pageIndex, formatState);
      shell.appendChild(currentPage);
    }
    syncDocsPageFullscreenControls();
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
      bindDocsFigureInteractions(figure);
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
      bindDocsFigureInteractions(figure);
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

    insertDocsNodes(node);
    activeEditable?.focus?.();
    commitDocsLayoutChange(`${assetWorkObject.title || "Asset"} inserted`);
  };

  const updateDocsToolbarStatus = (label = "Click in the page, then use the tools above.") => {
    if (docsToolbarStatus) {
      docsToolbarStatus.textContent = label;
    }
  };

  const isDocsChecklistList = (list) =>
    Boolean(list?.dataset?.listStyle === "checklist" || list?.classList?.contains("workspace-checklist"));

  const focusDocsEditableNode = (target) => {
    const focusTarget =
      (typeof target?.focus === "function" && target) ||
      (shell?.contains?.(target) ? shell : null);
    if (!focusTarget) {
      return;
    }
    window.requestAnimationFrame(() => {
      focusTarget.focus({ preventScroll: true });
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      const rangeTarget = target?.nodeType === Node.ELEMENT_NODE ? target : focusTarget;
      const nestedList = Array.from(rangeTarget?.children || []).find((child) => child.matches?.("ul, ol")) || null;
      if (nestedList) {
        range.setStartBefore(nestedList);
        range.collapse(true);
      } else {
        range.selectNodeContents(rangeTarget);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      saveDocsSelectionRange();
    });
  };

  const changeDocsListItemLevel = (editableTarget, direction = "indent") => {
    const item = editableTarget?.closest?.("li") || null;
    const currentList = item?.parentElement || null;
    if (!item || !currentList?.matches?.("ul, ol") || isDocsChecklistList(currentList)) {
      return false;
    }

    if (direction === "indent") {
      const previousItem = item.previousElementSibling;
      if (!previousItem?.matches?.("li")) {
        updateDocsToolbarStatus("Use Tab from the second item onward to create a sub-list.");
        focusDocsEditableNode(editableTarget);
        return true;
      }
      const listTag = currentList.tagName.toLowerCase();
      const nestedList =
        Array.from(previousItem.children || [])
          .reverse()
          .find((child) => child.tagName?.toLowerCase?.() === listTag && !isDocsChecklistList(child)) ||
        document.createElement(listTag);
      if (!nestedList.parentElement) {
        previousItem.appendChild(nestedList);
      }
      nestedList.appendChild(item);
      if (!currentList.children.length) {
        currentList.remove();
      }
      activeEditable = editableTarget;
      commitDocsLayoutChange("Sub-list added");
      focusDocsEditableNode(editableTarget);
      return true;
    }

    const parentItem = currentList.parentElement?.closest?.("li") || null;
    const outerList = parentItem?.parentElement || null;
    if (!parentItem || !outerList?.matches?.("ul, ol")) {
      updateDocsToolbarStatus("This item is already at the top level.");
      focusDocsEditableNode(editableTarget);
      return true;
    }
    outerList.insertBefore(item, parentItem.nextElementSibling || null);
    if (!currentList.children.length) {
      currentList.remove();
    }
    activeEditable = editableTarget;
    commitDocsLayoutChange("List level reduced");
    focusDocsEditableNode(editableTarget);
    return true;
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
      onKeyDown: (event) => {
        if (event.key !== "Tab") {
          return false;
        }
        const item = element.closest?.("li");
        if (!item || isDocsChecklistList(item.parentElement)) {
          return false;
        }
        event.preventDefault();
        event.stopPropagation();
        return changeDocsListItemLevel(element, event.shiftKey ? "outdent" : "indent");
      },
      onCommit: () => {
        commitDocumentShell();
        updateDocsToolbarStatus("Saved automatically");
      }
    });
  };

  const restoreDocumentShellFromSnapshot = (snapshot = "") => {
    if (!shell || shell.dataset.richDocument !== "true") {
      return false;
    }

    clearDocsMediaSelection();
    clearDocumentSearchHighlights();
    unwrapDocsPageShell();
    shell.innerHTML = normalizeText(snapshot);

    if (!shell.childNodes.length) {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = "<br>";
      shell.appendChild(paragraph);
    }

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
    shell.querySelectorAll(".workspace-docs-figure").forEach((figure) => {
      bindDocsFigureInteractions(figure);
    });
    shell.querySelectorAll("a[href]").forEach((link) => {
      link.target = "_blank";
      link.rel = "noreferrer noopener";
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

    activeEditable =
      shell.querySelector("p, h1, h2, h3, h4, blockquote, li, th, td, figcaption") || shell;
    rebuildDocsPageShell();
    commitDocumentShell();
    window.requestAnimationFrame(() => {
      updateDocsTableControls(null, true);
      if (docsSearchInput?.value.trim()) {
        applyDocumentSearch(docsSearchInput.value, { scrollToActive: false });
      } else {
        updateDocumentSearchStatus();
      }
    });
    return true;
  };

  const pushDocumentSearchUndoSnapshot = (snapshot = "") => {
    if (!snapshot) {
      return;
    }
    docsSearchUndoStack.push(snapshot);
    if (docsSearchUndoStack.length > 20) {
      docsSearchUndoStack.shift();
    }
    docsSearchRedoStack = [];
    updateDocumentSearchStatus();
  };

  const undoDocumentSearchDeletion = () => {
    if (!docsSearchUndoStack.length || !shell) {
      return;
    }
    const previousSnapshot = docsSearchUndoStack.pop();
    const currentSnapshot = serializeDocumentPreviewShell(shell);
    if (currentSnapshot) {
      docsSearchRedoStack.push(currentSnapshot);
    }
    const restored = restoreDocumentShellFromSnapshot(previousSnapshot);
    updateDocumentSearchStatus();
    if (restored) {
      updateDocsToolbarStatus("Deletion undone");
    }
  };

  const redoDocumentSearchDeletion = () => {
    if (!docsSearchRedoStack.length || !shell) {
      return;
    }
    const nextSnapshot = docsSearchRedoStack.pop();
    const currentSnapshot = serializeDocumentPreviewShell(shell);
    if (currentSnapshot) {
      docsSearchUndoStack.push(currentSnapshot);
    }
    const restored = restoreDocumentShellFromSnapshot(nextSnapshot);
    updateDocumentSearchStatus();
    if (restored) {
      updateDocsToolbarStatus("Deletion restored");
    }
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
    if (docsSavedSelectionRange && !docsSavedSelectionRange.collapsed) {
      runInlineCommandWithSelection(command, null, () => {
        updateDocsToolbarStatus("This action needs a selection inside the page.");
      });
      return;
    }
    target.focus();
    const applied = document.execCommand(command, false);
    if (applied === false) {
      updateDocsToolbarStatus("This action needs a selection inside the page.");
      return;
    }
    saveDocsSelectionRange();
    commitDocumentShell();
    updateDocsToolbarStatus("Saved automatically");
  };

  const insertChecklist = () => {
    if (!shell) {
      return;
    }
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
    insertDocsNodes(list);
    const firstText = list.querySelector("span");
    if (firstText) {
      activeEditable = firstText;
      firstText.focus();
    }
    commitDocsLayoutChange("Checklist added");
  };

  const insertQuote = () => {
    if (!shell) {
      return;
    }
    const quote = document.createElement("blockquote");
    quote.textContent = "Add the key quote, insight or principle here.";
    bindEditable(quote, { multiline: true });
    insertDocsNodes(quote);
    activeEditable = quote;
    quote.focus();
    commitDocsLayoutChange("Quote block added");
  };

  const insertDivider = () => {
    if (!shell) {
      return;
    }
    insertDocsNodes(document.createElement("hr"));
    commitDocsLayoutChange("Divider added");
  };

  const insertTable = () => {
    if (!shell) {
      return;
    }
    const table = document.createElement("table");
    table.className = "workspace-docs-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    [0, 1, 2].forEach((index) => {
      const th = document.createElement("th");
      th.textContent = getColumnLetterLabel(index);
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
    insertDocsNodes(table);
    const firstCell = table.querySelector("td");
    if (firstCell) {
      activeEditable = firstCell;
      firstCell.focus();
    }
    commitDocsLayoutChange("Table inserted", table);
  };

  const insertImagePlaceholder = () => {
    if (!shell) {
      return;
    }
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
    bindDocsFigureInteractions(figure);
    insertDocsNodes(figure);
    activeEditable = caption;
    caption.focus();
    commitDocsLayoutChange("Image placeholder inserted");
  };

  const insertImageFromUrl = () => {
    if (!shell) {
      return;
    }
    const url = window.prompt("Image URL");
    if (!url) {
      return;
    }
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
    bindDocsFigureInteractions(figure);
    insertDocsNodes(figure);
    activeEditable = caption;
    caption.focus();
    commitDocsLayoutChange("Image inserted");
  };

  const insertImagesFromFiles = async (fileList = []) => {
    const files = Array.from(fileList || []).filter((file) => /^image\//i.test(file.type || ""));
    if (!shell || !files.length) {
      updateDocsToolbarStatus("No image selected");
      return;
    }
    const dataUrls = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ file, src: String(reader.result || "") });
            reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
            reader.readAsDataURL(file);
          })
      )
    );
    const figures = dataUrls.map(({ file, src }) => {
      const figure = document.createElement("figure");
      figure.className = "workspace-docs-figure";
      const image = document.createElement("img");
      image.src = src;
      image.alt = file.name || "Imported image";
      image.className = "workspace-inline-image";
      const caption = document.createElement("figcaption");
      caption.textContent = (file.name || "Imported image").replace(/\.[^.]+$/, "");
      bindEditable(caption, { multiline: true });
      figure.append(image, caption);
      bindDocsFigureInteractions(figure);
      return { figure, caption };
    });
    insertDocsNodes(...figures.map((item) => item.figure));
    activeEditable = figures[figures.length - 1]?.caption || null;
    activeEditable?.focus?.();
    commitDocsLayoutChange(files.length > 1 ? `${files.length} images imported` : "Image imported");
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
    insertDocsNodes(breakNode, heading, paragraph);
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
    const heading = document.createElement("h2");
    heading.textContent = "New section";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Write the next section here.";
    bindEditable(heading);
    bindEditable(paragraph, { multiline: true });
    insertDocsNodes(heading, paragraph);
    activeEditable = paragraph;
    paragraph.focus();
    commitDocsLayoutChange("New section added");
  };

  if (isDocsClone) {
    const docsMenuBar = document.createElement("div");
    docsMenuBar.className = "workspace-docs-menubar";
    docsMenuPanel = document.createElement("div");
    docsMenuPanel.className = "workspace-docs-menu-panel hidden";
    const docsImageInput = document.createElement("input");
    docsImageInput.type = "file";
    docsImageInput.accept = "image/*";
    docsImageInput.multiple = true;
    docsImageInput.className = "workspace-docs-image-input";
    docsImageInput.addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      await restoreDocsFullscreenIfNeeded();
      await insertImagesFromFiles(files);
    });
    previewShell.appendChild(docsImageInput);

    const triggerImageImport = () => {
      restoreDocsFullscreenAfterImageImport = isDocsFullscreenActive();
      if (restoreDocsFullscreenAfterImageImport) {
        setDocsFullscreenFallbackActive(true);
        if (docsFullscreenRestoreFocusHandler) {
          window.removeEventListener("focus", docsFullscreenRestoreFocusHandler);
        }
        docsFullscreenRestoreFocusHandler = () => {
          window.removeEventListener("focus", docsFullscreenRestoreFocusHandler);
          docsFullscreenRestoreFocusHandler = null;
          window.setTimeout(() => {
            restoreDocsFullscreenIfNeeded().catch(() => {});
          }, 60);
        };
        window.addEventListener("focus", docsFullscreenRestoreFocusHandler);
      }
      docsImageInput.click();
    };

    const renderDocsMenu = (menuId = "") => {
      if (!docsMenuPanel) {
        return;
      }
      docsMenuFieldSyncCleanup?.();
      docsMenuFieldSyncCleanup = null;
      if (docsMenuPanel) {
        docsMenuPanel.dataset.openMenu = menuId;
      }
      syncDocsSelectionPreviewState(Boolean(menuId));
      docsMenuPanel.innerHTML = "";
      docsMenuButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.menu === menuId));
      if (!menuId) {
        docsMenuPanel.classList.add("hidden");
        return;
      }
      docsMenuPanel.classList.remove("hidden");
      const menuFieldSyncHandlers = [];
      const menuDropdownRegistry = [];

      const addMenuAction = (label, onClick, accent = false, { closeOnClick = true } = {}) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `workspace-docs-menu-action${accent ? " accent" : ""}`;
        button.textContent = label;
        preserveDocsSelectionOnPointerDown(button);
        button.addEventListener("click", async () => {
          try {
            await onClick?.();
          } catch (error) {
            console.error(error);
            updateDocsToolbarStatus(error?.message || "Action unavailable");
          }
          if (closeOnClick) {
            renderDocsMenu("");
          }
        });
        docsMenuPanel.appendChild(button);
      };

      const addMenuLabel = (label) => {
        const span = document.createElement("span");
        span.className = "workspace-docs-menu-label";
        span.textContent = label;
        docsMenuPanel.appendChild(span);
      };

      const addMenuDropdownField = (
        label,
        options,
        onSelect,
        {
          placeholder = label,
          initialValue = "",
          note = "",
          getCurrentValue = null,
          decorateOption = null,
          customEntry = null
        } = {}
      ) => {
        const field = document.createElement("div");
        field.className = "workspace-docs-menu-field workspace-docs-menu-dropdown-field";

        const fieldLabel = document.createElement("span");
        fieldLabel.className = "workspace-docs-menu-field-label";
        fieldLabel.textContent = label;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "workspace-docs-menu-action workspace-docs-menu-dropdown-toggle";
        toggle.setAttribute("aria-expanded", "false");
        preserveDocsSelectionOnPointerDown(toggle);

        const dropdown = document.createElement("div");
        dropdown.className = "workspace-docs-menu-dropdown hidden";

        const closeDropdown = () => {
          dropdown.classList.add("hidden");
          toggle.setAttribute("aria-expanded", "false");
        };

        const syncToggleLabel = () => {
          const nextLabel =
            (typeof getCurrentValue === "function" ? getCurrentValue(getDocsCurrentFormattingState()) : "") ||
            initialValue ||
            placeholder;
          toggle.textContent = nextLabel;
        };

        toggle.addEventListener("click", () => {
          const willOpen = dropdown.classList.contains("hidden");
          menuDropdownRegistry.forEach((entry) => {
            if (entry.dropdown !== dropdown) {
              entry.close();
            }
          });
          dropdown.classList.toggle("hidden", !willOpen);
          toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });

        options.forEach((item) => {
          const optionButton = document.createElement("button");
          optionButton.type = "button";
          optionButton.className = "workspace-docs-menu-dropdown-item";
          optionButton.textContent = item.label;
          preserveDocsSelectionOnPointerDown(optionButton);
          decorateOption?.(optionButton, item);
          optionButton.addEventListener("click", async () => {
            try {
              await onSelect?.(item, item.label);
            } catch (error) {
              console.error(error);
              updateDocsToolbarStatus(error?.message || "Action unavailable");
            }
            syncToggleLabel();
            closeDropdown();
          });
          dropdown.appendChild(optionButton);
        });

        if (customEntry) {
          const customRow = document.createElement("div");
          customRow.className = "workspace-docs-menu-dropdown-custom";

          const customInput = document.createElement("input");
          customInput.type = "text";
          customInput.className = "workspace-docs-select workspace-docs-menu-dropdown-input";
          customInput.placeholder = customEntry.placeholder || placeholder;
          customInput.addEventListener("pointerdown", () => {
            saveDocsSelectionRange();
          });
          customInput.addEventListener("focus", () => {
            customInput.select();
          });

          const applyCustomValue = async () => {
            const rawValue = String(customInput.value || "").trim();
            if (!rawValue) {
              return;
            }
            const normalizedValue = customEntry.normalizeValue?.(rawValue) || "";
            if (!normalizedValue) {
              updateDocsToolbarStatus(`Invalid ${label.toLowerCase()} value.`);
              return;
            }
            try {
              await onSelect?.(
                {
                  label: rawValue,
                  value: normalizedValue
                },
                rawValue
              );
            } catch (error) {
              console.error(error);
              updateDocsToolbarStatus(error?.message || "Action unavailable");
            }
            customInput.value = "";
            syncToggleLabel();
            closeDropdown();
          };

          customInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyCustomValue();
            }
          });

          const customButton = document.createElement("button");
          customButton.type = "button";
          customButton.className = "workspace-docs-menu-action workspace-docs-menu-dropdown-apply";
          customButton.textContent = customEntry.buttonLabel || "Apply";
          customButton.addEventListener("pointerdown", () => {
            saveDocsSelectionRange();
          });
          customButton.addEventListener("click", async () => {
            await applyCustomValue();
          });

          customRow.append(customInput, customButton);
          dropdown.appendChild(customRow);
        }

        field.append(fieldLabel, toggle, dropdown);
        if (note) {
          const fieldNote = document.createElement("span");
          fieldNote.className = "workspace-docs-menu-field-note";
          fieldNote.textContent = note;
          field.appendChild(fieldNote);
        }

        if (typeof getCurrentValue === "function") {
          const syncDropdownValue = () => {
            syncToggleLabel();
          };
          syncDropdownValue();
          menuFieldSyncHandlers.push(syncDropdownValue);
        } else {
          syncToggleLabel();
        }

        menuDropdownRegistry.push({
          dropdown,
          close: closeDropdown
        });
        docsMenuPanel.appendChild(field);
      };

      const addMenuColorPaletteField = (label, options, onSelect, buttonLabel = "Choose color") => {
        const field = document.createElement("div");
        field.className = "workspace-docs-menu-field workspace-docs-menu-palette-field";

        const fieldLabel = document.createElement("span");
        fieldLabel.className = "workspace-docs-menu-field-label";
        fieldLabel.textContent = label;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "workspace-docs-menu-action workspace-docs-color-dropdown-toggle";
        toggle.textContent = buttonLabel;
        toggle.setAttribute("aria-expanded", "false");
        preserveDocsSelectionOnPointerDown(toggle);

        const palette = document.createElement("div");
        palette.className = "workspace-docs-color-palette hidden";

        const closePalette = () => {
          palette.classList.add("hidden");
          toggle.setAttribute("aria-expanded", "false");
        };

        toggle.addEventListener("click", () => {
          const willOpen = palette.classList.contains("hidden");
          menuDropdownRegistry.forEach((entry) => {
            if (entry.dropdown !== palette) {
              entry.close();
            }
          });
          palette.classList.toggle("hidden", !willOpen);
          toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });

        options.forEach((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "workspace-docs-color-swatch";
          button.title = item.label;
          button.setAttribute("aria-label", item.label);
          preserveDocsSelectionOnPointerDown(button);
          if (item.value) {
            button.style.background = item.sample || item.value || "transparent";
          }
          if (item.outline) {
            button.style.borderColor = item.outline;
          }
          if (!item.value) {
            button.classList.add("is-clear");
          }

          button.addEventListener("click", async () => {
            try {
              await onSelect?.(item);
            } catch (error) {
              console.error(error);
              updateDocsToolbarStatus(error?.message || "Action unavailable");
            }
            closePalette();
          });

          palette.appendChild(button);
        });

        field.append(fieldLabel, toggle, palette);
        menuDropdownRegistry.push({
          dropdown: palette,
          close: closePalette
        });
        docsMenuPanel.appendChild(field);
      };

      const renderDocsPageNumberSettingsView = () => {
        docsMenuFieldSyncCleanup?.();
        docsMenuFieldSyncCleanup = null;
        docsMenuPanel.innerHTML = "";

        const currentState = getDocsPageFormatState();
        const draftState = {
          position: currentState.pageNumberPosition || "footer",
          showOnFirstPage: currentState.pageNumberShowOnFirstPage !== false,
          numberingMode: currentState.pageNumberMode || "start",
          startAt: Math.max(1, Number(currentState.pageNumberStart) || 1)
        };

        const sheet = document.createElement("div");
        sheet.className = "workspace-docs-settings-sheet";

        const heading = document.createElement("strong");
        heading.className = "workspace-docs-settings-heading";
        heading.textContent = "Numeros de page";

        const buildRadioOption = (name, value, label, isChecked, onChange, trailingNode = null) => {
          const option = document.createElement("label");
          option.className = "workspace-docs-settings-option";

          const input = document.createElement("input");
          input.type = "radio";
          input.name = name;
          input.value = value;
          input.checked = isChecked;
          input.addEventListener("pointerdown", () => {
            saveDocsSelectionRange();
          });
          input.addEventListener("change", () => {
            if (input.checked) {
              onChange?.(value);
            }
          });

          const text = document.createElement("span");
          text.textContent = label;

          option.append(input, text);
          if (trailingNode) {
            option.appendChild(trailingNode);
          }
          return option;
        };

        const positionSection = document.createElement("div");
        positionSection.className = "workspace-docs-settings-section";
        const positionTitle = document.createElement("span");
        positionTitle.className = "workspace-docs-settings-title";
        positionTitle.textContent = "Position";
        positionSection.appendChild(positionTitle);
        positionSection.appendChild(
          buildRadioOption("docs-page-number-position", "header", "En-tete", draftState.position === "header", (value) => {
            draftState.position = value;
          })
        );
        positionSection.appendChild(
          buildRadioOption("docs-page-number-position", "footer", "Pied de page", draftState.position === "footer", (value) => {
            draftState.position = value;
          })
        );

        const firstPageOption = document.createElement("label");
        firstPageOption.className = "workspace-docs-settings-option";
        const firstPageCheckbox = document.createElement("input");
        firstPageCheckbox.type = "checkbox";
        firstPageCheckbox.checked = draftState.showOnFirstPage;
        firstPageCheckbox.addEventListener("pointerdown", () => {
          saveDocsSelectionRange();
        });
        firstPageCheckbox.addEventListener("change", () => {
          draftState.showOnFirstPage = firstPageCheckbox.checked;
        });
        const firstPageText = document.createElement("span");
        firstPageText.textContent = "Afficher sur la premiere page";
        firstPageOption.append(firstPageCheckbox, firstPageText);
        positionSection.appendChild(firstPageOption);

        const numberingSection = document.createElement("div");
        numberingSection.className = "workspace-docs-settings-section";
        const numberingTitle = document.createElement("span");
        numberingTitle.className = "workspace-docs-settings-title";
        numberingTitle.textContent = "Numerotation";
        numberingSection.appendChild(numberingTitle);

        const startAtInput = document.createElement("input");
        startAtInput.type = "number";
        startAtInput.min = "1";
        startAtInput.step = "1";
        startAtInput.value = String(draftState.startAt);
        startAtInput.className = "workspace-docs-settings-number-input";
        startAtInput.addEventListener("pointerdown", () => {
          saveDocsSelectionRange();
        });
        startAtInput.addEventListener("input", () => {
          draftState.startAt = Math.max(1, Number.parseInt(startAtInput.value || "1", 10) || 1);
        });

        const syncPageNumberMode = () => {
          startAtInput.disabled = draftState.numberingMode !== "start";
        };

        numberingSection.appendChild(
          buildRadioOption(
            "docs-page-number-mode",
            "start",
            "Commencer a",
            draftState.numberingMode === "start",
            (value) => {
              draftState.numberingMode = value;
              syncPageNumberMode();
            },
            startAtInput
          )
        );
        numberingSection.appendChild(
          buildRadioOption(
            "docs-page-number-mode",
            "continue",
            "Continuer a partir de la section precedente",
            draftState.numberingMode === "continue",
            (value) => {
              draftState.numberingMode = value;
              syncPageNumberMode();
            }
          )
        );
        syncPageNumberMode();

        const actions = document.createElement("div");
        actions.className = "workspace-docs-settings-actions";

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "workspace-docs-settings-link";
        cancelButton.textContent = "Annuler";
        preserveDocsSelectionOnPointerDown(cancelButton);
        cancelButton.addEventListener("click", () => {
          renderDocsMenu("Format");
        });

        const applyButton = document.createElement("button");
        applyButton.type = "button";
        applyButton.className = "workspace-docs-settings-apply";
        applyButton.textContent = "Appliquer";
        preserveDocsSelectionOnPointerDown(applyButton);
        applyButton.addEventListener("click", () => {
          updateDocsPageFormatState(
            {
              showPageNumbers: true,
              pageNumberPosition: draftState.position,
              pageNumberShowOnFirstPage: draftState.showOnFirstPage,
              pageNumberMode: draftState.numberingMode,
              pageNumberStart: draftState.startAt
            },
            "Page numbers updated"
          );
          renderDocsMenu("Format");
        });

        actions.append(cancelButton, applyButton);
        sheet.append(heading, positionSection, numberingSection, actions);
        docsMenuPanel.appendChild(sheet);
      };

      if (menuId === "Structure") {
        addMenuAction("Text", () => convertActiveBlockTag("p"));
        addMenuAction("Title", () => convertActiveBlockTag("h1"));
        addMenuAction("Heading", () => convertActiveBlockTag("h2"));
        addMenuAction("Subhead", () => convertActiveBlockTag("h3"));
        addMenuAction("Bullets", () => convertActiveBlockToList(false));
        addMenuAction("Numbered", () => convertActiveBlockToList(true));
        addMenuAction("New section", insertNewSection);
        addMenuAction("New page", insertPageBreak);
        return;
      }

      if (menuId === "Format") {
        addMenuAction("Bold", () => runInlineCommand("bold"));
        addMenuAction("Italic", () => runInlineCommand("italic"));
        addMenuAction("Underline", () => runInlineCommand("underline"));
        addMenuAction("Strikethrough", () =>
          runInlineCommandWithSelection("strikeThrough", null, toggleActiveBlockStrikethrough, "Strikethrough updated"));
        addMenuAction("Undo", () => runInlineCommand("undo"));
        addMenuAction("Redo", () => runInlineCommand("redo"));
        addMenuAction("Clear formatting", () =>
          runInlineCommandWithSelection("removeFormat", null, resetActiveBlockFormatting, "Formatting reset"));
        addMenuAction("En-tetes et pieds de page", toggleDocsHeaderFooter);
        addMenuAction(
          "Numeros de page",
          () => {
            renderDocsPageNumberSettingsView();
          },
          false,
          { closeOnClick: false }
        );
        addMenuAction("Orientation de la page", toggleDocsPageOrientation);
        addMenuDropdownField(
          "Font",
          DOCS_FONT_FAMILY_OPTIONS,
          (item) => applyBlockFontFamily(item?.value || ""),
          {
            placeholder: "Choose font",
            initialValue: getDocsCurrentFormattingState().fontFamilyLabel,
            note: "The current selection stays targeted while you pick a preset font.",
            getCurrentValue: (state) => state.fontFamilyLabel || "Default font",
            decorateOption: (button, item) => {
              if (item?.value) {
                button.style.fontFamily = item.value;
              }
            }
          }
        );
        addMenuDropdownField(
          "Size",
          DOCS_FONT_SIZE_OPTIONS,
          (item, rawValue) => applyBlockFontSize(item?.value || rawValue || ""),
          {
            placeholder: "Choose size",
            initialValue: getDocsCurrentFormattingState().fontSizeLabel,
            note: "Pick a preset size or type your own value.",
            getCurrentValue: (state) => state.fontSizeLabel || "Auto size",
            customEntry: {
              placeholder: "Custom size",
              buttonLabel: "Apply",
              normalizeValue: (value) => normalizeDocsFontSizeValue(value)
            }
          }
        );
        addMenuDropdownField("Alignment", DOCS_ALIGNMENT_OPTIONS, (item) => applyBlockAlignment(item?.value || "left"), {
          placeholder: "Choose alignment",
          initialValue: "Alignment",
          getCurrentValue: () => "Alignment"
        });
        addMenuColorPaletteField(
          "Text color",
          DOCS_TEXT_COLOR_OPTIONS,
          (item) =>
            item?.value
              ? runInlineCommandWithSelection(
                  "foreColor",
                  item.value,
                  () => applyBlockTextColor(item.value),
                  "Text color updated"
                )
              : applyBlockTextColor(""),
          "Text color"
        );
        addMenuColorPaletteField(
          "Highlight",
          DOCS_HIGHLIGHT_COLOR_OPTIONS,
          (item) =>
            item?.value
              ? runInlineCommandWithSelection(
                  "hiliteColor",
                  item.value,
                  () => applyBlockHighlightColor(item.value),
                  "Highlight updated"
                )
              : applyBlockHighlightColor(""),
          "Highlight color"
        );
        if (menuFieldSyncHandlers.length) {
          const syncMenuFields = () => {
            menuFieldSyncHandlers.forEach((handler) => handler());
          };
          syncMenuFields();
          const selectionSyncHandler = () => {
            window.requestAnimationFrame(syncMenuFields);
          };
          document.addEventListener("selectionchange", selectionSyncHandler);
          docsMenuFieldSyncCleanup = () => {
            document.removeEventListener("selectionchange", selectionSyncHandler);
          };
        }
        return;
      }

      if (menuId === "Insert") {
        addMenuAction("Checklist", insertChecklist);
        addMenuAction("Quote", insertQuote);
        addMenuAction("Divider", insertDivider);
        addMenuAction("Table", insertTable);
        addMenuAction("Import image", triggerImageImport);
        addMenuAction("Image placeholder", insertImagePlaceholder);
        addMenuAction("From URL", insertImageFromUrl);
        addMenuAction("New section", insertNewSection);
        addMenuAction("Page", insertPageBreak);
        if (projectAssets.length) {
          addMenuLabel("Project assets");
          projectAssets.slice(0, 6).forEach((item) => addMenuAction(`Insert ${item.title || item.objectKind || "asset"}`, () => insertProjectAsset(item)));
        }
        return;
      }

      if (menuId === "Project & AI") {
        addMenuAction("Ask Hydria to improve this page", focusPromptForDocs, true);
        addMenuAction("Share-ready", prepareShareReadyPrompt, true);
        addMenuAction("New document in project", createNewProjectDoc, true);
        addMenuAction("Insert project image", () => {
          const imageAsset = projectAssets.find((item) => (item.objectKind || item.kind) === "image");
          if (imageAsset) {
            insertProjectAsset(imageAsset);
          }
        });
        if (projectAssets.length) {
          addMenuLabel("Connected project objects");
          projectAssets.slice(0, 8).forEach((item) => addMenuAction(item.title || "Project asset", () => insertProjectAsset(item)));
        }
        if (projectDocs.length) {
          addMenuLabel("Other docs in this project");
          projectDocs.slice(0, 6).forEach((item) => addMenuAction(item.title || "Document", () => onProjectObjectSelect?.(item)));
        }
        if (projectLinkedObjects.length) {
          addMenuLabel("Open any project object");
          projectLinkedObjects.slice(0, 8).forEach((item) => addMenuAction(item.title || "Project object", () => onProjectObjectSelect?.(item)));
        }
        return;
      }

      if (menuId === "View") {
        addMenuAction("Scroll to page", () => focusDocsPage());
        if (!isDocsCanvasFullscreen()) {
          addMenuAction("Scroll to outline", () => focusDocsOutline());
        }
        addMenuAction("Find in document", () => openDocumentSearch(), true);
        addMenuAction(isDocsCanvasFullscreen() ? "Exit fullscreen" : "Open fullscreen", toggleDocsFullscreen, true);
        addMenuLabel("Press Esc to leave fullscreen quickly.");
      }
    };

    ["Structure", "Format", "Insert", "Project & AI", "View"].forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-docs-menu-item";
      button.textContent = label;
      button.dataset.menu = label;
      preserveDocsSelectionOnPointerDown(button);
      button.addEventListener("click", () => {
        renderDocsMenu(docsMenuPanel?.dataset.openMenu === label ? "" : label);
      });
      docsMenuButtons.push(button);
      docsMenuBar.appendChild(button);
    });
    const docsMenuStatus = document.createElement("span");
    docsMenuStatus.className = "workspace-docs-menubar-status";
    docsMenuStatus.textContent = "Saved to Hydria";
    docsMenuBar.appendChild(docsMenuStatus);
    docsToolbarStatus = docsMenuStatus;
    previewShell.appendChild(docsMenuBar);
    previewShell.appendChild(docsMenuPanel);

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
  outline = document.createElement("aside");
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
      const nextHeadingLabel = normalizeLegacyDocumentTitle(node.textContent);
      if (nextHeadingLabel && nextHeadingLabel !== String(node.textContent || "").trim()) {
        node.textContent = nextHeadingLabel;
        normalizedLegacyHeading = true;
      }
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
    shell.querySelectorAll(".workspace-docs-figure").forEach((figure) => {
      bindDocsFigureInteractions(figure);
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
    docsCanvas = document.createElement("div");
    docsCanvas.className = "workspace-document-page-canvas";
    docsCanvas.appendChild(shell);
    docsTableControls = document.createElement("div");
    docsTableControls.className = "workspace-docs-table-controls hidden";
    docsTableContextMenu = document.createElement("div");
    docsTableContextMenu.className = "workspace-docs-table-menu hidden";
    docsCanvas.appendChild(docsTableControls);
    docsCanvas.appendChild(docsTableContextMenu);
    syncDocsFullscreenButtonState();
    previewShell.addEventListener("fullscreenchange", () => {
      if (isDocsCanvasFullscreen()) {
        setDocsFullscreenFallbackActive(false);
      } else if (restoreDocsFullscreenAfterImageImport) {
        setDocsFullscreenFallbackActive(true);
      }
      syncDocsFullscreenPresentation();
      syncDocsFullscreenButtonState();
      updateDocsToolbarStatus(isDocsFullscreenActive() ? "Fullscreen opened" : "Editing page");
    });
    previewLayout.append(outline, docsCanvas);
    shell.contentEditable = "true";
    shell.spellcheck = true;
    shell.classList.add("workspace-inline-editable");
    shell.dataset.placeholder = "Start typing here";
    shell.addEventListener("input", (event) => {
      if (shouldLinkifyOnBreak(event)) {
        linkifyPlainUrlsInNode(shell);
      }
      if (docsCommitHandle) {
        window.clearTimeout(docsCommitHandle);
      }
      docsCommitHandle = window.setTimeout(() => {
        commitDocumentShell();
        updateDocsTableControls(null, true);
        updateDocsToolbarStatus("Saved automatically");
      }, 120);
    });
    shell.addEventListener("click", () => {
      updateDocsToolbarStatus("Editing page");
    });
    shell.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") {
        return;
      }
      const selectionTarget =
        getDocsEditableTargetFromNode(window.getSelection()?.anchorNode || null) ||
        getDocsEditableTargetFromNode(event.target) ||
        null;
      const listItem = selectionTarget?.closest?.("li") || null;
      if (!listItem || isDocsChecklistList(listItem.parentElement)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      activeEditable = listItem;
      changeDocsListItemLevel(listItem, event.shiftKey ? "outdent" : "indent");
    });
    shell.addEventListener("mouseup", () => {
      saveDocsSelectionRange();
    });
    shell.addEventListener("keyup", () => {
      saveDocsSelectionRange();
    });
    shell.addEventListener("contextmenu", (event) => {
      if (
        event.target.closest?.(".workspace-docs-table-menu, .workspace-docs-table-control, .workspace-docs-page-control-bar")
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      showDocsContextMenuForTarget(event.target, event.clientX, event.clientY);
    });
    docsCanvas.addEventListener("pointerdown", (event) => {
      if (
        docsSelectedMediaFigure &&
        !event.target.closest?.(".workspace-docs-image-resize-handle") &&
        !docsSelectedMediaFigure.contains(event.target)
      ) {
        clearDocsMediaSelection();
      }
      if (!event.target.closest?.(".workspace-docs-table-menu, .workspace-docs-table-control")) {
        hideDocsTableContextMenu();
      }
    });
    window.requestAnimationFrame(() => updateDocsTableControls(null, true));
  } else {
    previewLayout.append(outline, shell);
  }
  previewShell.appendChild(previewLayout);
  container.appendChild(previewShell);
  if (normalizedLegacyHeading) {
    commitDocumentShell();
  }
}

function wireInlineEditable(element, { multiline = false, onCommit = null, onFocus = null, onKeyDown = null } = {}) {
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
  element.addEventListener("input", (event) => {
    if (multiline && shouldLinkifyOnBreak(event)) {
      linkifyPlainUrlsInNode(element);
    }
  });
  element.addEventListener("blur", commit);
  element.addEventListener("keydown", (event) => {
    if (typeof onKeyDown === "function") {
      const handled = onKeyDown(event);
      if (handled || event.defaultPrevented) {
        return;
      }
    }
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
    clone.querySelectorAll(".workspace-docs-page-control-bar").forEach((node) => node.remove());
    clone.querySelectorAll(".workspace-docs-page-header, .workspace-docs-page-footer").forEach((node) => node.remove());
    clone.querySelectorAll(".workspace-docs-image-resize-handle").forEach((node) => node.remove());
    clone.querySelectorAll(".workspace-docs-search-match").forEach((node) => unwrapNodeContents(node));
    clone.querySelectorAll(".workspace-docs-figure").forEach((node) => {
      node.classList.remove("is-media-selected", "is-dragging");
    });
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
    for (const char of String(value || "")) {
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
      if (char === "," && depth === 0) {
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

  const collectRangeValues = (range = "", stack = new Set()) => {
    const [start, end] = String(range || "").split(":");
    const startCoords = addressToCoords(start);
    const endCoords = addressToCoords(end);
    if (!startCoords || !endCoords) {
      return [];
    }
    const minRow = Math.min(startCoords.rowIndex, endCoords.rowIndex);
    const maxRow = Math.max(startCoords.rowIndex, endCoords.rowIndex);
    const minColumn = Math.min(startCoords.columnIndex, endCoords.columnIndex);
    const maxColumn = Math.max(startCoords.columnIndex, endCoords.columnIndex);
    const values = [];
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        const evaluated = evaluateCellValue(rowIndex, columnIndex, stack);
        values.push(evaluated);
      }
    }
    return values;
  };

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
        return trimmed.slice(1, -1).replace(/\\"/g, "\"");
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

    const functionPattern =
      /(SUM|SUMIF|COUNTIF|AVERAGE|AVG|MIN|MAX|COUNT|ABS|ROUND|ROUNDUP|ROUNDDOWN|IF|IFERROR|AND|OR|NOT|CONCAT|LEN|UPPER|LOWER|VLOOKUP|XLOOKUP)\(([^()]*)\)/i;
    while (functionPattern.test(expr)) {
      expr = expr.replace(functionPattern, (_, rawName, argsSource) => {
        const fn = String(rawName || "").toUpperCase();
        const args = splitFormulaArgs(argsSource);
        const values = collectAggregateValues(args);

        switch (fn) {
          case "SUM":
            return serializeFormulaValue(values.reduce((sum, value) => sum + value, 0));
          case "SUMIF": {
            const criteriaRange = Array.isArray(evaluateFormulaArgument(args[0]))
              ? evaluateFormulaArgument(args[0])
              : [evaluateFormulaArgument(args[0])];
            const criterion = args[1] || "";
            const sumValues = args.length >= 3
              ? Array.isArray(evaluateFormulaArgument(args[2]))
                ? evaluateFormulaArgument(args[2])
                : [evaluateFormulaArgument(args[2])]
              : criteriaRange;
            let total = 0;
            criteriaRange.forEach((entry, index) => {
              if (matchesCriterion(entry, criterion)) {
                total += normalizeNumeric(sumValues[index] ?? sumValues[0] ?? 0);
              }
            });
            return serializeFormulaValue(total);
          }
          case "COUNTIF": {
            const criteriaRange = Array.isArray(evaluateFormulaArgument(args[0]))
              ? evaluateFormulaArgument(args[0])
              : [evaluateFormulaArgument(args[0])];
            const criterion = args[1] || "";
            return serializeFormulaValue(criteriaRange.filter((entry) => matchesCriterion(entry, criterion)).length);
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
              return "#N/A";
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
      .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, "\"\"")
      .replace(/\btrue\b/gi, "1")
      .replace(/\bfalse\b/gi, "0");

    if (/[^0-9+\-*/().,<>=!&|\s]/.test(sanitized)) {
      return "#ERROR!";
    }

    try {
      const result = Function(`"use strict"; return (${expr});`)();
      return Number.isFinite(result) ? result : "#ERROR!";
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

  let activeSelection = { rowIndex: 0, columnIndex: 0 };
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

  let selectionRange = {
    startRowIndex: 0,
    startColumnIndex: 0,
    endRowIndex: 0,
    endColumnIndex: 0
  };
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

  const getWorkbookActiveSheet = () =>
    workbookModel.sheets.find((sheet) => sheet.id === workbookModel.activeSheetId) || workbookModel.sheets[0];

  const getActiveSheetState = () => getWorkbookActiveSheet();

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

  const persistWorkbookState = (refreshWorkspace = false) => {
    workbookModel = normalizeSpreadsheetPreviewModel(workbookModel, {
      defaultSheetName: profile?.sheetName || "Sheet 1"
    });
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

  const commitModel = (refreshWorkspace = false) => {
    const nextModel = persistGridIntoActiveSheet();
    onGridEdit?.(nextModel, { refreshWorkspace });
  };

  const scheduleCommit = () => {
    if (commitHandle) {
      window.clearTimeout(commitHandle);
    }
    commitHandle = window.setTimeout(() => {
      commitModel(false);
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
  };

  const forEachSelectedCell = (callback) => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        callback(rowIndex, columnIndex);
      }
    }
  };

  const getCellFormatKey = (rowIndex = 0, columnIndex = 0) => `${rowIndex}:${columnIndex}`;

  const getCellFormat = (rowIndex = 0, columnIndex = 0) =>
    String(getActiveSheetState().cellFormats?.[getCellFormatKey(rowIndex, columnIndex)] || "");

  const setSelectedRangeFormat = (format = "") => {
    const currentSheet = getActiveSheetState();
    if (!currentSheet.cellFormats || typeof currentSheet.cellFormats !== "object") {
      currentSheet.cellFormats = {};
    }
    forEachSelectedCell((rowIndex, columnIndex) => {
      const key = getCellFormatKey(rowIndex, columnIndex);
      if (format) {
        currentSheet.cellFormats[key] = format;
      } else {
        delete currentSheet.cellFormats[key];
      }
    });
    commitModel(false);
    refreshGridValues();
  };

  const formatCellDisplayValue = (value, rowIndex = 0, columnIndex = 0) => {
    const format = getCellFormat(rowIndex, columnIndex);
    const normalizedValue = typeof value === "string" ? value : formatFormulaResult(value);
    if (!format || normalizedValue.startsWith("#")) {
      return normalizedValue;
    }

    const numeric = Number(String(normalizedValue || "").replace(",", "."));
    if (format === "number" && Number.isFinite(numeric)) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(numeric);
    }
    if (format === "currency" && Number.isFinite(numeric)) {
      return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(numeric);
    }
    if (format === "percent" && Number.isFinite(numeric)) {
      return new Intl.NumberFormat("fr-FR", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(numeric);
    }
    if (format === "date") {
      const dateValue = new Date(normalizedValue);
      if (!Number.isNaN(dateValue.getTime())) {
        return new Intl.DateTimeFormat("fr-FR").format(dateValue);
      }
    }
    return normalizedValue;
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
  toolbarGroupEdit.append(
    makeToolbarButton("Undo", () => document.execCommand("undo")),
    makeToolbarButton("Redo", () => document.execCommand("redo")),
    makeToolbarButton("SUM", () => {
      setRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex, buildColumnFormula("SUM"));
      commitModel(true);
    }, true),
    makeToolbarButton("AVG", () => {
      setRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex, buildColumnFormula("AVERAGE"));
      commitModel(true);
    }),
    makeToolbarButton("MIN", () => {
      setRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex, buildColumnFormula("MIN"));
      commitModel(true);
    }),
    makeToolbarButton("MAX", () => {
      setRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex, buildColumnFormula("MAX"));
      commitModel(true);
    }),
    makeToolbarButton("COUNT", () => {
      setRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex, buildColumnFormula("COUNT"));
      commitModel(true);
    })
  );
  toolbarGroupFormat.append(
    makeToolbarButton("123", () => setSelectedRangeFormat("number")),
    makeToolbarButton("EUR", () => setSelectedRangeFormat("currency")),
    makeToolbarButton("%", () => setSelectedRangeFormat("percent")),
    makeToolbarButton("Date", () => setSelectedRangeFormat("date")),
    makeToolbarButton("Clear", () => setSelectedRangeFormat(""))
  );
  toolbarGroupData.append(
    makeToolbarButton("Sort A-Z", () => {
      const nextModel = persistGridIntoActiveSheet();
      const nextActiveSheet = getWorkbookActiveSheet();
      nextActiveSheet.rows.sort((leftRow, rightRow) =>
        String(leftRow[activeSelection.columnIndex] || "").localeCompare(String(rightRow[activeSelection.columnIndex] || ""), "fr", {
          numeric: true,
          sensitivity: "base"
        })
      );
      nextActiveSheet.sort = { columnIndex: activeSelection.columnIndex, direction: "asc" };
      workbookModel = nextModel;
      persistWorkbookState(false);
      rerenderPreview({ persistGrid: false });
    }),
    makeToolbarButton("Sort Z-A", () => {
      const nextModel = persistGridIntoActiveSheet();
      const nextActiveSheet = getWorkbookActiveSheet();
      nextActiveSheet.rows.sort((leftRow, rightRow) =>
        String(rightRow[activeSelection.columnIndex] || "").localeCompare(String(leftRow[activeSelection.columnIndex] || ""), "fr", {
          numeric: true,
          sensitivity: "base"
        })
      );
      nextActiveSheet.sort = { columnIndex: activeSelection.columnIndex, direction: "desc" };
      workbookModel = nextModel;
      persistWorkbookState(false);
      rerenderPreview({ persistGrid: false });
    }),
    makeToolbarButton("Filter", () => {
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
    }),
    makeToolbarButton("Clear filter", () => {
      const nextModel = persistGridIntoActiveSheet();
      const nextActiveSheet = getWorkbookActiveSheet();
      nextActiveSheet.filterQuery = "";
      nextActiveSheet.filterColumnIndex = -1;
      workbookModel = nextModel;
      persistWorkbookState(false);
      rerenderPreview({ persistGrid: false });
    }),
    makeToolbarButton("Freeze row", () => {
      const nextModel = persistGridIntoActiveSheet();
      const nextActiveSheet = getWorkbookActiveSheet();
      nextActiveSheet.frozenRows = activeSelection.rowIndex + 1;
      workbookModel = nextModel;
      persistWorkbookState(false);
      rerenderPreview({ persistGrid: false });
    }),
    makeToolbarButton("Freeze col", () => {
      const nextModel = persistGridIntoActiveSheet();
      const nextActiveSheet = getWorkbookActiveSheet();
      nextActiveSheet.frozenColumns = activeSelection.columnIndex + 1;
      workbookModel = nextModel;
      persistWorkbookState(false);
      rerenderPreview({ persistGrid: false });
    }),
    makeToolbarButton("Unfreeze", () => {
      const nextModel = persistGridIntoActiveSheet();
      const nextActiveSheet = getWorkbookActiveSheet();
      nextActiveSheet.frozenRows = 0;
      nextActiveSheet.frozenColumns = 0;
      workbookModel = nextModel;
      persistWorkbookState(false);
      rerenderPreview({ persistGrid: false });
    })
  );
  toolbarGroupStructure.append(
    makeToolbarButton("Insert row", () => {
      sheetGrid.splice(activeSelection.rowIndex + 1, 0, Array.from({ length: sheetGrid[0].length }, () => ""));
      commitModel(true);
    }),
    makeToolbarButton("Insert column", () => {
      sheetGrid = sheetGrid.map((row) => {
        const nextRow = [...row];
        nextRow.splice(activeSelection.columnIndex + 1, 0, "");
        return nextRow;
      });
      commitModel(true);
    }),
    makeToolbarButton("Delete row", () => {
      if (sheetGrid.length <= 1) {
        return;
      }
      sheetGrid.splice(activeSelection.rowIndex, 1);
      activeSelection = {
        rowIndex: Math.max(0, Math.min(activeSelection.rowIndex, sheetGrid.length - 1)),
        columnIndex: activeSelection.columnIndex
      };
      commitModel(true);
    }),
    makeToolbarButton("Delete column", () => {
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
      commitModel(true);
    }),
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
  const contextMenu = document.createElement("div");
  contextMenu.className = "workspace-sheet-context-menu";
  contextMenu.hidden = true;
  gridShell.append(table, fillHandle, contextMenu);

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

  const focusSelection = (rowIndex = 0, columnIndex = 0, { suppressFormulaEdit = false } = {}) => {
    activeSelection = {
      rowIndex: Math.max(0, Math.min(rowIndex, sheetGrid.length - 1)),
      columnIndex: Math.max(0, Math.min(columnIndex, sheetGrid[0].length - 1))
    };
    suppressFormulaActivation = suppressFormulaEdit;
    syncSelectionUi();
    const target = table.querySelector(`[data-sheet-grid-cell="${activeSelection.rowIndex}:${activeSelection.columnIndex}"]`);
    target?.focus();
  };

  const moveSelection = (rowDelta = 0, columnDelta = 0) => {
    focusSelection(activeSelection.rowIndex + rowDelta, activeSelection.columnIndex + columnDelta);
  };

  const syncSelectionUi = () => {
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

  const refreshGridValues = () => {
    table.querySelectorAll("[data-sheet-grid-cell]").forEach((input) => {
      const rowIndex = Number(input.dataset.rowIndex || 0);
      const columnIndex = Number(input.dataset.columnIndex || 0);
      if (
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
        focusSelection(rowIndex, columnIndex, { suppressFormulaEdit: true });
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
            label: "Merge selected cells",
            onSelect: mergeSelectionRange
          },
          {
            label: "Unmerge selected cells",
            onSelect: unmergeSelectionRange
          },
          {
            label: "Clear contents",
            onSelect: () => {
              forEachSelectedCell((selectedRowIndex, selectedColumnIndex) => {
                setRawCellValue(selectedRowIndex, selectedColumnIndex, "");
              });
              commitModel(false);
              refreshGridValues();
            }
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
          }
        ]);
      });
      input.addEventListener("focus", () => {
        activeSelection = { rowIndex, columnIndex };
        const rawCellValue = getRawCellValue(rowIndex, columnIndex);
        if (suppressFormulaActivation) {
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
          input.value = rawCellValue;
          syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
        }
        if (!selectionDragState.active) {
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
        }
        syncSelectionUi();
      });
      input.addEventListener("input", (event) => {
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
          syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
        });
      });
      input.addEventListener("blur", () => {
        setRawCellValue(rowIndex, columnIndex, input.value);
        syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
        commitModel(false);
        refreshGridValues();
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
      commitModel(false);
      focusSelection(activeSelection.rowIndex, activeSelection.columnIndex, { suppressFormulaEdit: true });
    }
  });
  formulaInput.addEventListener("blur", () => {
    syncFormulaEditorState({
      mode: "formula",
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex,
      input: formulaInput
    });
    commitModel(false);
    refreshGridValues();
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
      persistWorkbookState(false);
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
      /\.html?$/i.test(normalizedPath)
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
