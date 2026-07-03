import {
  createWorkspaceColorSwatchButton,
  createWorkspaceContextMenu,
  createWorkspaceIconNode,
  createWorkspacePaletteActionButton,
  installWorkspaceMenuEventBlockers
} from "./workspaceMenuUi.js"

const CANVAS_BOARD_WIDTH = 1800
const CANVAS_BOARD_HEIGHT = 1200
const CANVAS_ZOOM_MIN = 0.4
const CANVAS_ZOOM_MAX = 2.4
const CANVAS_LINK_COLOR = "#6b7280"
const CANVAS_COLOR_PRESETS = [
  { label: "Warm note", value: "#f6d365" },
  { label: "Mint note", value: "#c7f0d8" },
  { label: "Soft blue", value: "#dfe8ff" },
  { label: "Rose", value: "#ffd6e0" },
  { label: "Lavender", value: "#e7dcff" },
  { label: "Sand", value: "#f5e6c8" },
  { label: "Slate", value: "#d9e3ef" }
]
const CANVAS_FILL_SWATCHES = [
  "#ffffff",
  "#f4efe8",
  "#d8d2ca",
  "#f6d365",
  "#c7f0d8",
  "#dfe8ff",
  "#ffd6e0",
  "#e7dcff",
  "#f5e6c8",
  "#d9e3ef",
  "#fecaca",
  "#fdba74",
  "#fde68a",
  "#bbf7d0",
  "#a7f3d0",
  "#bae6fd",
  "#c7d2fe",
  "#fbcfe8"
]
const CANVAS_TEXT_SWATCHES = [
  "#111827",
  "#1f2937",
  "#374151",
  "#4b5563",
  "#6b7280",
  "#0f172a",
  "#7c2d12",
  "#7c3aed",
  "#1d4ed8",
  "#0f766e",
  "#15803d",
  "#b45309",
  "#b91c1c",
  "#be185d",
  "#ffffff",
  "#f9fafb"
]
const CANVAS_LINK_SWATCHES = [
  "#111827",
  "#374151",
  "#6b7280",
  "#9ca3af",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e"
]
const CANVAS_SHAPE_OPTIONS = [
  { label: "Rectangle", value: "rect" },
  { label: "Rounded", value: "rounded" },
  { label: "Pill", value: "pill" },
  { label: "Circle", value: "circle" },
  { label: "Triangle", value: "triangle" },
  { label: "Diamond", value: "diamond" },
  { label: "Hexagon", value: "hexagon" },
  { label: "Parallelogram", value: "parallelogram" }
]
const CANVAS_SHAPE_VALUES = new Set(CANVAS_SHAPE_OPTIONS.map((option) => option.value))
const CANVAS_SHAPE_ICON_NAMES = {
  rect: "shapeRect",
  rounded: "shapeRounded",
  pill: "shapePill",
  circle: "shapeCircle",
  triangle: "shapeTriangle",
  diamond: "shapeDiamond",
  hexagon: "shapeHexagon",
  parallelogram: "shapeParallelogram"
}
const CANVAS_SHAPE_DIMENSIONS = {
  rect: { width: 180, height: 120 },
  rounded: { width: 180, height: 120 },
  pill: { width: 220, height: 120 },
  circle: { width: 180, height: 180 },
  triangle: { width: 220, height: 180 },
  diamond: { width: 200, height: 180 },
  hexagon: { width: 220, height: 160 },
  parallelogram: { width: 220, height: 140 }
}
const CANVAS_PRINT_MM_TO_PX = 96 / 25.4
const CANVAS_PRINT_AVAILABLE_WIDTH_MM = 277
const CANVAS_PRINT_AVAILABLE_HEIGHT_MM = 188
const WORKSPACE_CANVAS_PANEL_CLEANUP = Symbol("workspaceCanvasPanelCleanup")
const CANVAS_VIDEO_DEFAULT_WIDTH = 320
const CANVAS_VIDEO_DEFAULT_HEIGHT = 220

function uid(prefix = "canvas") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function safeJsonParse(value = "") {
  try {
    return JSON.parse(String(value || ""))
  } catch {
    return null
  }
}

function toPlainText(value = "") {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[`*_>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function createExcerpt(value = "", maxLength = 220) {
  const plainText = toPlainText(value)
  if (!plainText) {
    return "Double-click to edit this block."
  }
  return plainText.length <= maxLength
    ? plainText
    : `${plainText.slice(0, maxLength).trimEnd()}...`
}

function toFileLabel(filePath = "") {
  const normalized = String(filePath || "").replace(/\\/g, "/")
  const segments = normalized.split("/").filter(Boolean)
  return segments[segments.length - 1] || "Untitled document"
}

function estimateReadingTime(value = "") {
  const wordCount = toPlainText(value).split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.round(wordCount / 180) || 1)} min read`
}

function downloadBlobFile(blob, filename = "canvas.pdf") {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function readCanvasApiError(response) {
  try {
    const payload = await response.json()
    return payload?.error || payload?.message || `Request failed (${response.status})`
  } catch {
    try {
      const text = await response.text()
      return text || `Request failed (${response.status})`
    } catch {
      return `Request failed (${response.status})`
    }
  }
}

function appendMetric(container, value, label) {
  const pill = document.createElement("div")
  pill.className = "workspace-canvas-metric"

  const strong = document.createElement("strong")
  strong.textContent = String(value || "0")

  const span = document.createElement("span")
  span.textContent = label

  pill.append(strong, span)
  container.appendChild(pill)
}

function createToolbarButton(label, onClick) {
  const button = document.createElement("button")
  button.type = "button"
  button.className = "workspace-canvas-tool"
  button.textContent = label
  button.addEventListener("click", onClick)
  return button
}

function createCanvasIconButton({
  label = "",
  icon = "",
  className = "",
  title = "",
  onClick = () => {}
} = {}) {
  const button = document.createElement("button")
  button.type = "button"
  button.className = `workspace-canvas-icon-button${className ? ` ${className}` : ""}`
  button.title = title || label
  button.setAttribute("aria-label", label || title || "Canvas action")
  if (icon) {
    button.appendChild(createWorkspaceIconNode(icon, { className: "workspace-canvas-icon-button-icon", label }))
  }
  if (label) {
    const text = document.createElement("span")
    text.className = "workspace-canvas-icon-button-label"
    text.textContent = label
    button.appendChild(text)
  }
  button.addEventListener("click", onClick)
  return button
}

function clampNumber(value, fallback, min = 0) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(min, Math.round(numeric))
}

function clampZoom(value = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 1
  }
  return Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, Math.round(numeric * 100) / 100))
}

function getCanvasShapeSize(shape = "rect") {
  return CANVAS_SHAPE_DIMENSIONS[shape] || CANVAS_SHAPE_DIMENSIONS.rect
}

function getCanvasShapeOption(shape = "rect") {
  return CANVAS_SHAPE_OPTIONS.find((option) => option.value === shape) || CANVAS_SHAPE_OPTIONS[0]
}

function getCanvasShapeIconName(shape = "rect") {
  return CANVAS_SHAPE_ICON_NAMES[shape] || CANVAS_SHAPE_ICON_NAMES.rect
}

function createCanvasShapeSeed(shape = "rounded", seed = {}) {
  const option = getCanvasShapeOption(shape)
  const size = getCanvasShapeSize(option.value)
  return {
    title: seed.title || option.label,
    shape: option.value,
    color: seed.color || "#f4d35e",
    width: seed.width ?? size.width,
    height: seed.height ?? size.height,
    ...seed
  }
}

function stripFileExtension(filename = "") {
  return String(filename || "").replace(/\.[^.]+$/, "").trim()
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      reject(new Error("Invalid media file."))
      return
    }
    const reader = new FileReader()
    reader.addEventListener("load", () => {
      resolve(String(reader.result || ""))
    })
    reader.addEventListener("error", () => {
      reject(reader.error || new Error("Unable to read the media file."))
    })
    reader.readAsDataURL(file)
  })
}

function inferDataUrlMimeType(value = "") {
  const match = String(value || "").match(/^data:([^;,]+)[;,]/i)
  return match?.[1]?.toLowerCase() || ""
}

function inferMimeExtension(value = "", fallback = "bin") {
  const mimeType = String(value || "").trim().toLowerCase()
  if (!mimeType) {
    return fallback
  }
  if (mimeType.includes("png")) {
    return "png"
  }
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return "jpg"
  }
  if (mimeType.includes("webp")) {
    return "webp"
  }
  if (mimeType.includes("gif")) {
    return "gif"
  }
  if (mimeType.includes("svg")) {
    return "svg"
  }
  if (mimeType.includes("mp4")) {
    return "mp4"
  }
  if (mimeType.includes("webm")) {
    return "webm"
  }
  if (mimeType.includes("ogg")) {
    return "ogg"
  }
  return fallback
}

function sanitizeCanvasDownloadFilename(filename = "", fallback = "canvas-asset") {
  const safeName = String(filename || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
  return safeName || fallback
}

function downloadDataUrlFile(dataUrl = "", filename = "canvas-asset.bin") {
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = filename
  link.click()
}

function captureVideoPoster(videoSrc = "") {
  return new Promise((resolve) => {
    if (!videoSrc) {
      resolve("")
      return
    }

    const video = document.createElement("video")
    let settled = false

    const finish = (value = "") => {
      if (settled) {
        return
      }
      settled = true
      video.pause()
      video.removeAttribute("src")
      try {
        video.load()
      } catch {
        // Ignore load resets on detached video elements.
      }
      resolve(value)
    }

    const captureFrame = () => {
      try {
        const width = Math.max(1, video.videoWidth || CANVAS_VIDEO_DEFAULT_WIDTH)
        const height = Math.max(1, video.videoHeight || CANVAS_VIDEO_DEFAULT_HEIGHT)
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext("2d")
        if (!context) {
          finish("")
          return
        }
        context.drawImage(video, 0, 0, width, height)
        finish(canvas.toDataURL("image/jpeg", 0.82))
      } catch {
        finish("")
      }
    }

    const scheduleCapture = () => {
      if (Number.isFinite(video.duration) && video.duration > 0.08) {
        try {
          video.currentTime = Math.min(0.08, Math.max(0, video.duration / 3))
          return
        } catch {
          // Fallback to immediate capture below.
        }
      }
      captureFrame()
    }

    video.preload = "metadata"
    video.muted = true
    video.playsInline = true
    video.crossOrigin = "anonymous"
    video.addEventListener("loadeddata", scheduleCapture, { once: true })
    video.addEventListener("seeked", captureFrame, { once: true })
    video.addEventListener("error", () => finish(""), { once: true })
    window.setTimeout(() => finish(""), 2200)
    video.src = videoSrc
  })
}

function normalizeColorValue(value = "", fallback = "") {
  const normalized = String(value || "").trim()
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    return normalized
  }
  return fallback
}

function buildCanvasSwatchColors(baseColors = [], extraColors = []) {
  const seen = new Set()
  const colors = []

  const register = (value = "") => {
    const normalized = normalizeColorValue(value)
    const key = normalized.toLowerCase()
    if (!normalized || seen.has(key)) {
      return
    }
    seen.add(key)
    colors.push(normalized)
  }

  ;[...baseColors, ...extraColors].forEach((value) => register(value))
  return colors
}

function normalizeCanvasElement(raw = {}, index = 0) {
  const type = ["note", "text", "shape", "image", "video"].includes(String(raw.type || raw.kind || "").toLowerCase())
    ? String(raw.type || raw.kind || "").toLowerCase()
    : "note"
  const isShape = type === "shape"
  const isImage = type === "image"
  const isVideo = type === "video"
  const normalizedShape = String(raw.shape || "rect").trim().toLowerCase()
  const shapeSize = getCanvasShapeSize(normalizedShape)
  const src = String(raw.src || raw.imageUrl || raw.videoUrl || "").trim()
  const mimeType = String(raw.mimeType || inferDataUrlMimeType(src)).trim().toLowerCase()

  return {
    id: String(raw.id || uid()),
    type,
    title: String(raw.title || raw.label || (isShape ? "Shape" : isImage ? "Image" : isVideo ? "Video" : "Untitled")).trim(),
    body: String(raw.body || raw.note || raw.text || "").trim(),
    src,
    poster: String(raw.poster || raw.preview || "").trim(),
    mimeType,
    x: clampNumber(raw.x, 120 + (index % 3) * 260, 0),
    y: clampNumber(raw.y, 120 + Math.floor(index / 3) * 180, 0),
    width: clampNumber(
      raw.width ?? raw.w,
      isShape ? shapeSize.width : isVideo ? CANVAS_VIDEO_DEFAULT_WIDTH : 280,
      80
    ),
    height: clampNumber(
      raw.height ?? raw.h,
      isShape ? shapeSize.height : isVideo ? CANVAS_VIDEO_DEFAULT_HEIGHT : 160,
      60
    ),
    zIndex: clampNumber(raw.zIndex, index + 1, 1),
    rotation: Number.isFinite(Number(raw.rotation)) ? Number(raw.rotation) : 0,
    color: String(
      raw.color ||
        (type === "note" ? "#f6d365" : type === "text" ? "#dfe8ff" : type === "video" ? "#ffffff" : "#f4d35e")
    ).trim(),
    textColor: normalizeColorValue(raw.textColor, "#1f2937") || "#1f2937",
    shape: CANVAS_SHAPE_VALUES.has(normalizedShape) ? normalizedShape : "rect"
  }
}

function normalizeCanvasElementStack(items = []) {
  return [...items]
    .map((item, index) => normalizeCanvasElement(item, index))
    .sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0))
    .map((item, index) => normalizeCanvasElement({ ...item, zIndex: index + 1 }, index))
}

function normalizeCanvasLink(raw = {}, index = 0) {
  const from = String(raw.from || raw.fromId || raw.sourceId || "").trim()
  const to = String(raw.to || raw.toId || raw.targetId || "").trim()
  if (!from || !to || from === to) {
    return null
  }
  return {
    id: String(raw.id || uid("canvas-link")),
    from,
    to,
    label: String(raw.label || raw.title || "").trim(),
    color: String(raw.color || CANVAS_LINK_COLOR).trim() || CANVAS_LINK_COLOR,
    zIndex: clampNumber(raw.zIndex, index + 1, 1)
  }
}

function sanitizeCanvasLinks(items = [], elements = []) {
  const ids = new Set(elements.map((element) => element.id))
  const seen = new Set()
  return items
    .map((item, index) => normalizeCanvasLink(item, index))
    .filter((link) => {
      if (!link || !ids.has(link.from) || !ids.has(link.to)) {
        return false
      }
      const key = `${link.from}->${link.to}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .map((link, index) => ({
      ...link,
      zIndex: index + 1
    }))
}

function createDefaultCanvasModel(title = "Canvas") {
  return {
    title,
    brief: "Canvas workspace ready for notes, ideas and quick visual organization.",
    palette: [
      { name: "Warm note", value: "#f6d365" },
      { name: "Mint note", value: "#c7f0d8" },
      { name: "Ink", value: "#1f2937" }
    ],
    components: ["Sticky note", "Text block", "Shape"],
    frames: [
      {
        id: "frame-1",
        name: "Main canvas",
        goal: "Drop ideas, cluster them and shape the next steps.",
        blocks: [],
        links: []
      }
    ]
  }
}

function isCanvasBoardWorkObject(workObject = null) {
  const familyId = String(
    workObject?.workspaceFamilyId ||
      workObject?.metadata?.workspaceFamilyId ||
      workObject?.environmentPlan?.workspaceFamilyId ||
      ""
  ).toLowerCase()
  return familyId === "canvas_board"
}

function collectCanvasColorOptions(snapshot = null, elements = []) {
  const options = []
  const seen = new Set()

  const register = (label = "", value = "") => {
    const normalizedValue = String(value || "").trim()
    const key = normalizedValue.toLowerCase()
    if (!normalizedValue || seen.has(key)) {
      return
    }
    seen.add(key)
    options.push({
      label: String(label || normalizedValue).trim() || normalizedValue,
      value: normalizedValue
    })
  }

  ;(snapshot?.model?.palette || []).forEach((token) => {
    register(token?.name || token?.value || "Color", token?.value || "")
  })
  CANVAS_COLOR_PRESETS.forEach((entry) => register(entry.label, entry.value))
  elements.forEach((element) => register(element.title || "Card color", element.color || ""))

  return options
}

function extractPersistedCanvasSnapshot(content = "", fallbackTitle = "Canvas") {
  const parsed = safeJsonParse(content)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null
  }

  if (Array.isArray(parsed.frames)) {
    const model = JSON.parse(JSON.stringify(parsed))
    const frameIndex = 0
    const frame = model.frames[frameIndex] || {
      id: "frame-1",
      name: "Main canvas",
      goal: "Shape the main board.",
      blocks: [],
      links: []
    }
    const elements = Array.isArray(frame.blocks)
      ? frame.blocks.map((block, index) =>
          normalizeCanvasElement(
            {
              id: block.id,
              type: block.kind || block.type || "note",
              title: block.label || block.title || `Card ${index + 1}`,
              body: block.body || block.note || "",
              src: block.src || "",
              x: block.x,
              y: block.y,
              width: block.w,
              height: block.h,
              zIndex: block.zIndex,
              rotation: block.rotation,
              color: block.color,
              textColor: block.textColor,
              shape: block.shape
            },
            index
          )
        )
      : []
    const links = sanitizeCanvasLinks(Array.isArray(frame.links) ? frame.links : [], elements)
    return {
      kind: "design",
      title: String(model.title || fallbackTitle || "Canvas"),
      brief: String(model.brief || ""),
      frameIndex,
      model,
      elements: normalizeCanvasElementStack(elements),
      links
    }
  }

  if (Array.isArray(parsed.elements)) {
    const elements = parsed.elements.map((element, index) => normalizeCanvasElement(element, index))
    return {
      kind: "generic",
      title: String(parsed.title || fallbackTitle || "Canvas"),
      brief: String(parsed.brief || ""),
      frameIndex: 0,
      model: JSON.parse(JSON.stringify(parsed)),
      elements: normalizeCanvasElementStack(elements),
      links: sanitizeCanvasLinks(Array.isArray(parsed.links) ? parsed.links : [], elements)
    }
  }

  return null
}

function serializePersistedCanvasSnapshot(
  elements = [],
  links = [],
  snapshot = null,
  { title = "Canvas", brief = "" } = {}
) {
  const normalizedElements = normalizeCanvasElementStack(elements)
  const normalizedLinks = sanitizeCanvasLinks(links, normalizedElements)

  if (snapshot?.kind === "design") {
    const model =
      snapshot.model && typeof snapshot.model === "object"
        ? JSON.parse(JSON.stringify(snapshot.model))
        : createDefaultCanvasModel(title)
    const frameIndex = Math.max(0, Number(snapshot.frameIndex) || 0)
    if (!Array.isArray(model.frames) || !model.frames.length) {
      model.frames = createDefaultCanvasModel(title).frames
    }
    while (model.frames.length <= frameIndex) {
      model.frames.push({
        id: `frame-${model.frames.length + 1}`,
        name: `Canvas ${model.frames.length + 1}`,
        goal: "Shape the board visually.",
        blocks: [],
        links: []
      })
    }

    const frame = model.frames[frameIndex] || {}
    model.title = String(model.title || title || "Canvas")
    model.brief = String(
      model.brief ||
        brief ||
        "Canvas workspace ready for notes, ideas and quick visual organization."
    )
    if (!Array.isArray(model.palette) || !model.palette.length) {
      model.palette = createDefaultCanvasModel(title).palette
    }
    if (!Array.isArray(model.components) || !model.components.length) {
      model.components = createDefaultCanvasModel(title).components
    }
    model.frames[frameIndex] = {
      ...frame,
      id: String(frame.id || "frame-1"),
      name: String(frame.name || "Main canvas"),
      goal: String(frame.goal || "Drop ideas, cluster them and shape the next steps."),
      blocks: normalizedElements.map((element) => ({
        id: element.id,
        label: element.title || "Untitled",
        body: element.body || "",
        kind: element.type,
        color: element.color || "",
        textColor: element.textColor || "#1f2937",
        shape: element.shape || "rect",
        src: element.src || "",
        x: element.x,
        y: element.y,
        w: element.width,
        h: element.height,
        zIndex: element.zIndex,
        rotation: element.rotation || 0
      })),
      links: normalizedLinks.map((link) => ({
        id: link.id,
        from: link.from,
        to: link.to,
        label: link.label || "",
        color: link.color || CANVAS_LINK_COLOR,
        zIndex: link.zIndex || 1
      }))
    }
    return JSON.stringify(model, null, 2)
  }

  const genericModel =
    snapshot?.model && typeof snapshot.model === "object"
      ? JSON.parse(JSON.stringify(snapshot.model))
      : {
          title,
          brief
        }
  genericModel.title = String(genericModel.title || title || "Canvas")
  genericModel.brief = String(genericModel.brief || brief || "Canvas board")
  genericModel.elements = normalizedElements.map((element) => ({
    id: element.id,
    type: element.type,
    title: element.title,
    body: element.body,
    src: element.src,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    rotation: element.rotation,
    color: element.color,
    textColor: element.textColor,
    shape: element.shape
  }))
  genericModel.links = normalizedLinks.map((link) => ({
    id: link.id,
    from: link.from,
    to: link.to,
    label: link.label || "",
    color: link.color || CANVAS_LINK_COLOR,
    zIndex: link.zIndex || 1
  }))
  return JSON.stringify(genericModel, null, 2)
}

function buildDocumentCanvasElements({
  workObject = null,
  filePath = "",
  content = "",
  sections = []
} = {}) {
  const elements = [
    {
      id: "document-map",
      type: "note",
      title: workObject?.title || toFileLabel(filePath),
      body: createExcerpt(content, 280),
      x: 80,
      y: 80,
      width: 340,
      height: 190,
      zIndex: 1,
      color: "#f6d365"
    }
  ]

  const visibleSections = sections.filter((section) => section?.id && section.id !== "whole-file")
  visibleSections.slice(0, 12).forEach((section, index) => {
    elements.push(
      normalizeCanvasElement(
        {
          id: section.id,
          type: "note",
          title: section.title || `Section ${index + 1}`,
          body: createExcerpt(section.block || section.content || "", 160),
          x: 120 + (index % 3) * 380,
          y: 330 + Math.floor(index / 3) * 240,
          width: 320,
          height: 180,
          zIndex: index + 2,
          color: index % 2 === 0 ? "#fff1c6" : "#e6f4ea"
        },
        index + 1
      )
    )
  })

  return elements
}

function getCanvasItemCenter(item = {}) {
  return {
    x: (Number(item.x) || 0) + ((Number(item.width) || 0) / 2),
    y: (Number(item.y) || 0) + ((Number(item.height) || 0) / 2)
  }
}

function getCanvasLinkAnchor(source = {}, target = {}) {
  const sourceCenter = getCanvasItemCenter(source)
  const targetCenter = getCanvasItemCenter(target)
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? (Number(source.x) || 0) + (Number(source.width) || 0) : Number(source.x) || 0,
      y: sourceCenter.y
    }
  }

  return {
    x: sourceCenter.x,
    y: dy >= 0 ? (Number(source.y) || 0) + (Number(source.height) || 0) : Number(source.y) || 0
  }
}

function getCanvasCubicPoint(t = 0.5, p0 = {}, p1 = {}, p2 = {}, p3 = {}) {
  const mt = 1 - t
  const x =
    (mt ** 3 * p0.x) +
    (3 * mt ** 2 * t * p1.x) +
    (3 * mt * t ** 2 * p2.x) +
    (t ** 3 * p3.x)
  const y =
    (mt ** 3 * p0.y) +
    (3 * mt ** 2 * t * p1.y) +
    (3 * mt * t ** 2 * p2.y) +
    (t ** 3 * p3.y)
  return { x, y }
}

function describeCanvasLinkPath(fromItem = {}, toItem = {}) {
  const start = getCanvasLinkAnchor(fromItem, toItem)
  const end = getCanvasLinkAnchor(toItem, fromItem)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const directionX = Math.sign(dx) || 1
  const directionY = Math.sign(dy) || 1
  const controlDistance = Math.max(
    48,
    Math.min(220, horizontal ? Math.abs(dx) * 0.45 : Math.abs(dy) * 0.45)
  )
  const controlStart = horizontal
    ? { x: start.x + (directionX * controlDistance), y: start.y }
    : { x: start.x, y: start.y + (directionY * controlDistance) }
  const controlEnd = horizontal
    ? { x: end.x - (directionX * controlDistance), y: end.y }
    : { x: end.x, y: end.y - (directionY * controlDistance) }

  return {
    d: `M ${start.x} ${start.y} C ${controlStart.x} ${controlStart.y}, ${controlEnd.x} ${controlEnd.y}, ${end.x} ${end.y}`,
    midpoint: getCanvasCubicPoint(0.5, start, controlStart, controlEnd, end)
  }
}

function isCanvasEditingTarget(target = null) {
  const element = target?.nodeType === 3 ? target.parentElement : target
  return Boolean(
    element?.isContentEditable ||
      element?.closest?.("[contenteditable='true']") ||
      element?.matches?.("input, textarea, select")
  )
}

function createCanvasElement(data, context) {
  const {
    allowConnections = false,
    pendingLinkSourceId = "",
    selectedId = "",
    zoom = 1,
    onActivate = () => {},
    onCommit = () => {},
    onDelete = () => {},
    onDuplicate = () => {},
    onLinkStart = () => {},
    onLiveUpdate = () => {},
    onContextMenu = () => {}
  } = context

  const node = document.createElement("div")
  node.className = `workspace-canvas-item workspace-canvas-${data.type}`
  node.dataset.id = data.id
  node.dataset.type = data.type
  node.dataset.shape = data.shape || "rect"
  node.style.left = `${data.x}px`
  node.style.top = `${data.y}px`
  node.style.width = `${data.width}px`
  node.style.height = `${data.height}px`
  node.style.transform = `rotate(${data.rotation || 0}deg)`
  node.style.zIndex = String(data.zIndex || 1)

  if (selectedId === data.id) {
    node.classList.add("selected")
  }
  if (pendingLinkSourceId === data.id) {
    node.classList.add("is-linking-source")
  }
  if (data.type === "shape") {
    node.classList.add("workspace-canvas-item-shape")
  }

  const content = document.createElement("div")
  content.className = "workspace-canvas-item-content"

  const commitTextChange = (patch = {}) => {
    onCommit(data.id, patch)
  }

  const createEditableText = (tagName, value = "", patchKey = "title") => {
    const element = document.createElement(tagName)
    element.contentEditable = "true"
    element.spellcheck = true
    element.textContent = value || ""
    element.addEventListener("pointerdown", (event) => {
      event.stopPropagation()
    })
    element.addEventListener("click", (event) => {
      event.stopPropagation()
    })
    element.addEventListener("input", () => {
      onLiveUpdate(data.id, {
        [patchKey]: element.textContent || ""
      })
    })
    element.addEventListener("blur", () => {
      commitTextChange({
        [patchKey]: element.textContent || ""
      })
    })
    return element
  }

  if (data.type === "image" || data.type === "video") {
    content.classList.add("has-media")
    if (data.type === "video") {
      content.classList.add("is-video")
    }
    content.style.background = data.color || "#ffffff"
    content.style.color = data.textColor || "#1f2937"
    const mediaFrame = document.createElement("div")
    mediaFrame.className = `workspace-canvas-media-frame is-${data.type}`

    if (data.type === "video") {
      const video = document.createElement("video")
      video.src = data.src
      video.poster = data.poster || ""
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.preload = "metadata"
      video.setAttribute("aria-label", data.title || "Canvas video")
      mediaFrame.addEventListener("mouseenter", () => {
        void video.play().catch(() => {})
      })
      mediaFrame.addEventListener("mouseleave", () => {
        video.pause()
        try {
          video.currentTime = 0
        } catch {
          // Ignore media reset issues on unsupported sources.
        }
      })
      mediaFrame.appendChild(video)

      const badge = document.createElement("span")
      badge.className = "workspace-canvas-media-badge"
      badge.textContent = "VIDEO"
      mediaFrame.appendChild(badge)
    } else {
      const img = document.createElement("img")
      img.src = data.src
      img.alt = data.title || "Canvas image"
      mediaFrame.appendChild(img)
    }

    const caption = createEditableText("strong", data.title || (data.type === "video" ? "Video" : "Image"), "title")
    const note = createEditableText(
      "p",
      data.body || (data.type === "video" ? "Hover to preview this video." : "Add a short caption"),
      "body"
    )
    content.append(mediaFrame, caption, note)
  } else if (data.type === "shape") {
    content.classList.add("workspace-canvas-shape", `shape-${data.shape || "rect"}`)
    content.style.background = data.color || "#f4d35e"
    content.style.color = data.textColor || "#1f2937"
    const label = createEditableText("strong", data.title || "Shape", "title")
    content.appendChild(label)
  } else {
    content.style.background = data.color || (data.type === "note" ? "#fff6d9" : "#eff4ff")
    content.style.color = data.textColor || "#1f2937"
    const title = createEditableText("strong", data.title || "Title", "title")
    const body = createEditableText("p", data.body || "Text", "body")
    content.append(title, body)
  }

  const actions = document.createElement("div")
  actions.className = "workspace-canvas-item-actions"

  if (allowConnections) {
    const linkButton = createToolbarButton(
      pendingLinkSourceId === data.id ? "Cancel" : "Link",
      () => onLinkStart(data.id)
    )
    actions.appendChild(linkButton)
  }

  const duplicate = createToolbarButton("Copy", () => onDuplicate(data.id))
  const remove = createToolbarButton("X", () => onDelete(data.id))
  actions.append(duplicate, remove)
  actions.addEventListener("click", (event) => {
    event.stopPropagation()
  })
  actions.addEventListener("pointerdown", (event) => {
    event.stopPropagation()
  })

  const resize = document.createElement("span")
  resize.className = "workspace-canvas-resize"

  node.append(content, actions, resize)

  node.addEventListener("click", (event) => {
    if (
      isCanvasEditingTarget(event.target) ||
      event.target.closest(".workspace-canvas-item-actions") ||
      event.target.classList.contains("workspace-canvas-resize")
    ) {
      return
    }
    onActivate(data.id)
  })

  node.addEventListener("contextmenu", (event) => {
    event.preventDefault()
    event.stopPropagation()
    onContextMenu(data.id, event.clientX, event.clientY)
  })

  node.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      isCanvasEditingTarget(event.target) ||
      event.target.closest(".workspace-canvas-item-actions") ||
      event.target.classList.contains("workspace-canvas-resize")
    ) {
      return
    }

    const startX = event.clientX
    const startY = event.clientY
    const initialX = data.x
    const initialY = data.y
    let nextX = initialX
    let nextY = initialY
    let didMove = false

    node.setPointerCapture(event.pointerId)
    node.classList.add("is-dragging")

    const move = (pointerEvent) => {
      nextX = Math.max(0, initialX + ((pointerEvent.clientX - startX) / zoom))
      nextY = Math.max(0, initialY + ((pointerEvent.clientY - startY) / zoom))
      didMove =
        didMove ||
        Math.abs(pointerEvent.clientX - startX) > 4 ||
        Math.abs(pointerEvent.clientY - startY) > 4
      node.style.left = `${nextX}px`
      node.style.top = `${nextY}px`
      onLiveUpdate(data.id, {
        x: Math.round(nextX),
        y: Math.round(nextY)
      })
    }

    const up = () => {
      node.removeEventListener("pointermove", move)
      node.removeEventListener("pointerup", up)
      try {
        node.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore release errors from detached or inactive pointers.
      }
      node.classList.remove("is-dragging")
      if (didMove) {
        onCommit(data.id, {
          x: Math.round(nextX),
          y: Math.round(nextY)
        })
        return
      }
      onActivate(data.id)
    }

    node.addEventListener("pointermove", move)
    node.addEventListener("pointerup", up)
  })

  resize.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return
    }
    event.stopPropagation()

    const startX = event.clientX
    const startY = event.clientY
    const initialWidth = data.width
    const initialHeight = data.height
    let nextWidth = initialWidth
    let nextHeight = initialHeight
    let didResize = false

    resize.setPointerCapture(event.pointerId)

    const move = (pointerEvent) => {
      nextWidth = Math.max(80, initialWidth + ((pointerEvent.clientX - startX) / zoom))
      nextHeight = Math.max(60, initialHeight + ((pointerEvent.clientY - startY) / zoom))
      didResize =
        didResize ||
        Math.abs(pointerEvent.clientX - startX) > 4 ||
        Math.abs(pointerEvent.clientY - startY) > 4
      node.style.width = `${nextWidth}px`
      node.style.height = `${nextHeight}px`
      onLiveUpdate(data.id, {
        width: Math.round(nextWidth),
        height: Math.round(nextHeight)
      })
    }

    const up = () => {
      resize.removeEventListener("pointermove", move)
      resize.removeEventListener("pointerup", up)
      try {
        resize.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore release errors from detached or inactive pointers.
      }
      if (didResize) {
        onCommit(data.id, {
          width: Math.round(nextWidth),
          height: Math.round(nextHeight)
        })
      }
    }

    resize.addEventListener("pointermove", move)
    resize.addEventListener("pointerup", up)
  })

  return node
}

export function renderWorkspaceCanvasPanel(
  container,
  {
    workObject = null,
    filePath = "",
    content = "",
    sections = [],
    blocks = [],
    selectedSectionId = "",
    onSectionFocus = null,
    onContentChange = null
  } = {}
) {
  const previousCleanup = container?.[WORKSPACE_CANVAS_PANEL_CLEANUP]
  if (typeof previousCleanup === "function") {
    try {
      previousCleanup()
    } catch (error) {
      console.error(error)
    }
  }
  container.innerHTML = ""
  container[WORKSPACE_CANVAS_PANEL_CLEANUP] = null

  const boardTitle = workObject?.title || toFileLabel(filePath)
  const persistedSnapshot = extractPersistedCanvasSnapshot(content, boardTitle)
  const boardIsPersisted = isCanvasBoardWorkObject(workObject) || Boolean(persistedSnapshot)
  const boardContentIsEditable = boardIsPersisted || typeof onContentChange === "function"
  const boardMarkerId = uid("canvas-arrow")

  let zoom = 1
  let canvasFullscreenFallbackActive = false
  let selectedId = boardIsPersisted ? "" : selectedSectionId || ""
  let activeLinkId = ""
  let pendingLinkSourceId = ""
  let snapshot = persistedSnapshot
  let elements = boardIsPersisted
    ? normalizeCanvasElementStack(persistedSnapshot?.elements || [])
    : buildDocumentCanvasElements({
        workObject,
        filePath,
        content,
        sections
      })
  let links = sanitizeCanvasLinks(persistedSnapshot?.links || [], elements)

  const surface = document.createElement("section")
  surface.className = "workspace-canvas-surface"

  const toolbar = document.createElement("div")
  toolbar.className = "workspace-document-preview-toolbar workspace-canvas-toolbar"

  const toolbarCopy = document.createElement("div")
  toolbarCopy.className = "workspace-canvas-toolbar-copy"

  const label = document.createElement("span")
  label.className = "workspace-canvas-toolbar-label"
  label.textContent = "Canvas"

  const title = document.createElement("strong")
  title.textContent = boardTitle

  const subtitle = document.createElement("p")
  subtitle.className = "workspace-canvas-toolbar-subtitle"
  subtitle.textContent = boardIsPersisted
    ? "Create, move, resize, connect and organize blocks like a real visual board."
    : "Create, move, resize, edit and organize ideas like on a canvas board."

  toolbarCopy.append(label, title, subtitle)

  const metrics = document.createElement("div")
  metrics.className = "workspace-canvas-metrics"

  const tools = document.createElement("div")
  tools.className = "workspace-canvas-tools"

  const helper = document.createElement("div")
  helper.className = "workspace-flow-chip-list workspace-canvas-helper"

  const helperText = document.createElement("span")
  helperText.className = "workspace-flow-chip"

  const helperCancelButton = document.createElement("button")
  helperCancelButton.type = "button"
  helperCancelButton.className = "workspace-flow-chip workspace-flow-chip-button"
  helperCancelButton.textContent = "Cancel arrow"
  helperCancelButton.addEventListener("click", () => {
    pendingLinkSourceId = ""
    refreshBoardStatus()
    renderBoard()
  })

  helper.append(helperText, helperCancelButton)

  const boardViewport = document.createElement("div")
  boardViewport.className = "workspace-canvas-viewport"
  boardViewport.tabIndex = 0

  const board = document.createElement("div")
  board.className = "workspace-canvas-board canva-like-grid"
  board.style.width = `${CANVAS_BOARD_WIDTH}px`
  board.style.height = `${CANVAS_BOARD_HEIGHT}px`

  const linkLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  linkLayer.setAttribute("class", "workspace-canvas-links")
  linkLayer.setAttribute("viewBox", `0 0 ${CANVAS_BOARD_WIDTH} ${CANVAS_BOARD_HEIGHT}`)
  linkLayer.setAttribute("preserveAspectRatio", "none")
  linkLayer.setAttribute("aria-hidden", "true")

  const linkChipLayer = document.createElement("div")
  linkChipLayer.className = "workspace-canvas-link-chip-layer"

  const itemLayer = document.createElement("div")
  itemLayer.className = "workspace-canvas-item-layer"

  board.append(linkLayer, linkChipLayer, itemLayer)
  boardViewport.appendChild(board)

  const imagePickerInput = document.createElement("input")
  imagePickerInput.type = "file"
  imagePickerInput.accept = "image/*"
  imagePickerInput.className = "workspace-canvas-file-input"
  imagePickerInput.hidden = true

  const videoPickerInput = document.createElement("input")
  videoPickerInput.type = "file"
  videoPickerInput.accept = "video/*"
  videoPickerInput.className = "workspace-canvas-file-input"
  videoPickerInput.hidden = true

  const contextMenuRoot = document.createElement("div")
  contextMenuRoot.className = "workspace-sheet-context-menu workspace-canvas-context-menu"
  contextMenuRoot.hidden = true
  installWorkspaceMenuEventBlockers(contextMenuRoot)

  const contextMenuApi = createWorkspaceContextMenu({
    root: contextMenuRoot,
    controllerOptions: {
      rootOpenLeftClassName: "opens-left",
      submenuClassName: "workspace-sheet-context-submenu",
      itemOpenClassName: "is-open",
      removeRootOnClose: true,
      submenuZIndexBase: 1850,
      leftLookaheadWidth: 480
    },
    renderOptions: {
      itemClassName: "workspace-sheet-context-item",
      itemDisabledClassName: "is-disabled",
      itemOpenClassName: "is-open",
      separatorClassName: "workspace-sheet-context-separator",
      headingClassName: "workspace-sheet-context-heading",
      submenuClassName: "workspace-sheet-context-submenu",
      actionOptions: (item) => ({
        actionClassName: `workspace-sheet-context-action${item.danger ? " is-danger" : ""}`,
        iconClassName: "workspace-sheet-context-icon",
        labelClassName: "workspace-sheet-context-label",
        metaClassName: "workspace-sheet-context-meta",
        chevronClassName: "workspace-sheet-context-chevron",
        role: "menuitem",
        createIconNode: createWorkspaceIconNode
      }),
      renderCustomItem: (item, targetHost) => {
        if (!item.palette) {
          return false
        }
        appendCanvasColorPalette(targetHost, item.palette)
        return true
      },
      onActionSelect: (item) => {
        item.onSelect?.()
      }
    }
  })

  function buildShapeMenuItems(onSelect = () => {}) {
    return CANVAS_SHAPE_OPTIONS.map((option) => ({
      label: option.label,
      icon: getCanvasShapeIconName(option.value),
      onSelect: () => onSelect(option)
    }))
  }

  function buildCanvasFillPaletteColors(currentValue = "") {
    return buildCanvasSwatchColors(
      CANVAS_FILL_SWATCHES,
      [
        currentValue,
        ...collectCanvasColorOptions(snapshot, elements).map((option) => option.value)
      ]
    )
  }

  function buildCanvasTextPaletteColors(currentValue = "") {
    return buildCanvasSwatchColors(CANVAS_TEXT_SWATCHES, [currentValue])
  }

  function buildCanvasLinkPaletteColors(currentValue = "") {
    return buildCanvasSwatchColors(
      CANVAS_LINK_SWATCHES,
      [currentValue, ...links.map((link) => link.color)]
    )
  }

  function createCanvasPaletteItem({
    title = "Colors",
    currentValue = "",
    swatches = [],
    actions = [],
    onSelect = () => {}
  } = {}) {
    return {
      palette: {
        title,
        currentValue,
        swatches,
        actions,
        onSelect
      }
    }
  }

  function appendCanvasPaletteAction(host, label = "", icon = "", onSelect = () => {}) {
    const button = createWorkspacePaletteActionButton({
      label,
      icon,
      className: "workspace-sheet-context-palette-action",
      iconClassName: "workspace-sheet-context-palette-action-icon",
      onSelect: (event) => {
        event.preventDefault()
        event.stopPropagation()
        onSelect()
        contextMenuApi?.close?.()
      }
    })
    host.appendChild(button)
  }

  function appendCanvasColorPalette(host, config = {}) {
    const palette = document.createElement("div")
    palette.className = "workspace-sheet-context-color-palette workspace-canvas-context-color-palette"

    if (config.title) {
      const title = document.createElement("strong")
      title.className = "workspace-sheet-context-color-title"
      title.textContent = config.title
      palette.appendChild(title)
    }

    const grid = document.createElement("div")
    grid.className = "workspace-sheet-context-color-grid workspace-canvas-context-color-grid"
    const currentValue = normalizeColorValue(config.currentValue)
    buildCanvasSwatchColors(config.swatches || [], [currentValue]).forEach((color) => {
      const swatch = createWorkspaceColorSwatchButton(
        {
          label: color,
          value: color,
          sample: color
        },
        {
          className: "workspace-sheet-context-color-swatch workspace-canvas-context-color-swatch",
          onSelect: (item, _button, event) => {
            event.preventDefault()
            event.stopPropagation()
            config.onSelect?.(item.value || "")
            contextMenuApi?.close?.()
          }
        }
      )
      if (currentValue && color.toLowerCase() === currentValue.toLowerCase()) {
        swatch.classList.add("is-selected")
      }
      grid.appendChild(swatch)
    })
    palette.appendChild(grid)

    ;(config.actions || []).forEach((action) => {
      appendCanvasPaletteAction(palette, action.label, action.icon, action.onSelect)
    })

    host.appendChild(palette)
  }

  function requestLocalImageSelection() {
    return new Promise((resolve) => {
      let settled = false

      const finish = (value = null) => {
        if (settled) {
          return
        }
        settled = true
        imagePickerInput.removeEventListener("change", handleChange)
        window.removeEventListener("focus", handleFocus)
        resolve(value)
      }

      const handleFocus = () => {
        window.setTimeout(() => {
          if (!settled && !imagePickerInput.files?.length) {
            finish(null)
          }
        }, 320)
      }

      const handleChange = async () => {
        const file = imagePickerInput.files?.[0]
        if (!file) {
          finish(null)
          return
        }
        try {
          const src = await readFileAsDataUrl(file)
          finish({
            title: stripFileExtension(file.name) || "Image",
            src
          })
        } catch (error) {
          console.error(error)
          window.alert(`Image import failed: ${error.message || error}`)
          finish(null)
        }
      }

      imagePickerInput.value = ""
      imagePickerInput.addEventListener("change", handleChange)
      window.addEventListener("focus", handleFocus, { once: true })
      imagePickerInput.click()
    })
  }

  function requestLocalVideoSelection() {
    return new Promise((resolve) => {
      let settled = false

      const finish = (value = null) => {
        if (settled) {
          return
        }
        settled = true
        videoPickerInput.removeEventListener("change", handleChange)
        window.removeEventListener("focus", handleFocus)
        resolve(value)
      }

      const handleFocus = () => {
        window.setTimeout(() => {
          if (!settled && !videoPickerInput.files?.length) {
            finish(null)
          }
        }, 320)
      }

      const handleChange = async () => {
        const file = videoPickerInput.files?.[0]
        if (!file) {
          finish(null)
          return
        }
        try {
          const src = await readFileAsDataUrl(file)
          const poster = await captureVideoPoster(src)
          finish({
            title: stripFileExtension(file.name) || "Video",
            src,
            poster,
            mimeType: String(file.type || inferDataUrlMimeType(src) || "video/mp4").trim().toLowerCase()
          })
        } catch (error) {
          console.error(error)
          window.alert(`Video import failed: ${error.message || error}`)
          finish(null)
        }
      }

      videoPickerInput.value = ""
      videoPickerInput.addEventListener("change", handleChange)
      window.addEventListener("focus", handleFocus, { once: true })
      videoPickerInput.click()
    })
  }

  async function addImageFromComputer(seed = {}) {
    const pickedImage = await requestLocalImageSelection()
    if (!pickedImage?.src) {
      return
    }
    createBoardElement("image", {
      title: pickedImage.title || seed.title || "Image",
      src: pickedImage.src,
      width: seed.width ?? 300,
      height: seed.height ?? 220,
      ...seed
    })
  }

  async function replaceImageFromComputer(elementId = "") {
    const element = getElementById(elementId)
    if (!element) {
      return
    }
    const pickedImage = await requestLocalImageSelection()
    if (!pickedImage?.src) {
      return
    }
    updateElement(elementId, {
      src: pickedImage.src,
      title: !element.title || element.title === "Image" ? pickedImage.title || "Image" : element.title
    })
  }

  async function addVideoFromComputer(seed = {}) {
    const pickedVideo = await requestLocalVideoSelection()
    if (!pickedVideo?.src) {
      return
    }
    createBoardElement("video", {
      title: pickedVideo.title || seed.title || "Video",
      body: seed.body || "Hover to preview this video.",
      src: pickedVideo.src,
      poster: pickedVideo.poster || "",
      mimeType: pickedVideo.mimeType || "video/mp4",
      width: seed.width ?? CANVAS_VIDEO_DEFAULT_WIDTH,
      height: seed.height ?? CANVAS_VIDEO_DEFAULT_HEIGHT,
      color: seed.color || "#ffffff",
      ...seed
    })
  }

  async function replaceVideoFromComputer(elementId = "") {
    const element = getElementById(elementId)
    if (!element) {
      return
    }
    const pickedVideo = await requestLocalVideoSelection()
    if (!pickedVideo?.src) {
      return
    }
    updateElement(elementId, {
      src: pickedVideo.src,
      poster: pickedVideo.poster || "",
      mimeType: pickedVideo.mimeType || inferDataUrlMimeType(pickedVideo.src) || "video/mp4",
      title: !element.title || element.title === "Video" ? pickedVideo.title || "Video" : element.title
    })
  }

  function removeCanvasPrintRoot() {
    document.body.classList.remove("is-canvas-printing")
    document.querySelectorAll(".workspace-canvas-print-root").forEach((node) => node.remove())
  }

  function scheduleCanvasPrintCleanup() {
    const cleanup = () => {
      window.setTimeout(removeCanvasPrintRoot, 700)
    }
    window.addEventListener("focus", cleanup, { once: true })
    window.addEventListener("afterprint", cleanup, { once: true })
  }

  function buildCanvasPrintableClone() {
    const clone = board.cloneNode(true)
    clone.style.transform = "none"
    clone.querySelectorAll(".workspace-canvas-item").forEach((node) => {
      node.classList.remove("selected", "is-linking-source", "is-dragging")
    })
    clone.querySelectorAll(".workspace-canvas-item-actions, .workspace-canvas-resize, .workspace-canvas-link-hit, .workspace-canvas-link-remove").forEach((node) => node.remove())
    clone.querySelectorAll("[contenteditable='true']").forEach((node) => {
      node.removeAttribute("contenteditable")
      node.removeAttribute("spellcheck")
    })
    clone.querySelectorAll(".workspace-canvas-item[data-type='video']").forEach((node) => {
      const videoNode = node.querySelector("video")
      if (!videoNode) {
        return
      }
      const element = getElementById(node.dataset.id || "")
      if (element?.poster) {
        const poster = document.createElement("img")
        poster.src = element.poster
        poster.alt = element.title || "Video poster"
        poster.className = "workspace-canvas-print-video-poster"
        videoNode.replaceWith(poster)
        return
      }
      const placeholder = document.createElement("div")
      placeholder.className = "workspace-canvas-video-placeholder"
      placeholder.textContent = element?.title || "Video"
      videoNode.replaceWith(placeholder)
    })
    return clone
  }

  function buildCanvasPrintRoot() {
    const scale = Math.min(
      1,
      (CANVAS_PRINT_AVAILABLE_WIDTH_MM * CANVAS_PRINT_MM_TO_PX) / CANVAS_BOARD_WIDTH,
      (CANVAS_PRINT_AVAILABLE_HEIGHT_MM * CANVAS_PRINT_MM_TO_PX) / CANVAS_BOARD_HEIGHT
    )
    const printBoardWidth = Math.round(CANVAS_BOARD_WIDTH * scale)
    const printBoardHeight = Math.round(CANVAS_BOARD_HEIGHT * scale)

    const root = document.createElement("div")
    root.className = "workspace-canvas-print-root"

    const page = document.createElement("section")
    page.className = "workspace-canvas-print-page"

    const header = document.createElement("header")
    header.className = "workspace-canvas-print-header"

    const heading = document.createElement("strong")
    heading.textContent = boardTitle

    const meta = document.createElement("span")
    meta.textContent = "Canvas print"

    header.append(heading, meta)

    const stage = document.createElement("div")
    stage.className = "workspace-canvas-print-stage"

    const shell = document.createElement("div")
    shell.className = "workspace-canvas-print-board-shell"
    shell.style.width = `${printBoardWidth}px`
    shell.style.height = `${printBoardHeight}px`

    const clone = buildCanvasPrintableClone()
    clone.classList.add("workspace-canvas-print-board")
    clone.style.transform = `scale(${scale})`
    clone.style.transformOrigin = "top left"

    shell.appendChild(clone)
    stage.appendChild(shell)
    page.append(header, stage)
    root.appendChild(page)
    return root
  }

  function printCurrentCanvas() {
    try {
      removeCanvasPrintRoot()
      const root = buildCanvasPrintRoot()
      document.body.appendChild(root)
      document.body.classList.add("is-canvas-printing")
      scheduleCanvasPrintCleanup()
      window.print()
      return true
    } catch (error) {
      console.error(error)
      window.alert(`Print failed: ${error.message || error}`)
      return false
    }
  }

  const addTextButton = createToolbarButton("+ Text", () => {
    createBoardElement("text", {
      title: "New text",
      body: "Write your content here.",
      width: 280,
      height: 130,
      color: "#dfe8ff"
    })
  })
  const addNoteButton = createToolbarButton("+ Note", () => {
    createBoardElement("note", {
      title: "New note",
      body: "Add an idea, a comment or an instruction.",
      width: 300,
      height: 160,
      color: "#f6d365"
    })
  })
  const addShapeButton = createToolbarButton("+ Shape", () => {
    createBoardElement("shape", createCanvasShapeSeed("rounded"))
  })
  const addImageButton = createToolbarButton("+ Image", () => {
    addImageFromComputer()
  })
  const addVideoButton = createToolbarButton("+ Video", () => {
    addVideoFromComputer()
  })
  const connectSelectionButton = createToolbarButton("Start arrow", () => {
    if (!selectedId) {
      return
    }
    toggleLinkSource(selectedId)
  })
  const deleteSelectionButton = createToolbarButton("Delete", () => {
    deleteCurrentSelection()
  })
  const zoomInButton = createToolbarButton("Zoom +", () => {
    setZoom(zoom + 0.1)
  })
  const zoomOutButton = createToolbarButton("Zoom -", () => {
    setZoom(zoom - 0.1)
  })
  const fullscreenButton = createToolbarButton("Full screen", () => {
    void toggleCanvasFullscreen()
  })
  const printButton = createToolbarButton("Print", () => {
    printCurrentCanvas()
  })
  async function exportCanvasAsPdf() {
    try {
      const filename = `${toFileLabel(filePath)}-canvas.pdf`
      const response = await fetch("/api/canvas/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          title: boardTitle,
          boardWidth: CANVAS_BOARD_WIDTH,
          boardHeight: CANVAS_BOARD_HEIGHT,
          elements,
          links
        })
      })
      if (!response.ok) {
        throw new Error(await readCanvasApiError(response))
      }
      const blob = await response.blob()
      if (!blob.size) {
        throw new Error("The PDF export is empty.")
      }
      downloadBlobFile(blob, filename)
    } catch (error) {
      window.alert(`PDF export failed: ${error.message || error}`)
    }
  }

  const exportButton = createToolbarButton("Export PDF", () => {
    exportCanvasAsPdf()
  })
  const exportAssetButton = createToolbarButton("Export asset", () => {
    downloadCanvasAssetSelection()
  })

  const viewTools = document.createElement("div")
  viewTools.className = "workspace-canvas-view-tools"

  const viewZoomOutButton = createCanvasIconButton({
    label: "",
    icon: "divider",
    className: "workspace-canvas-view-button",
    title: "Zoom out",
    onClick: () => setZoom(zoom - 0.1)
  })
  const viewZoomStatusButton = createCanvasIconButton({
    label: "100%",
    className: "workspace-canvas-view-status",
    title: "Choose zoom level",
    onClick: () => openZoomPresetMenu(viewZoomStatusButton)
  })
  const viewZoomInButton = createCanvasIconButton({
    label: "",
    icon: "insert",
    className: "workspace-canvas-view-button",
    title: "Zoom in",
    onClick: () => setZoom(zoom + 0.1)
  })
  const fitBoardButton = createCanvasIconButton({
    label: "Fit",
    icon: "grid",
    className: "workspace-canvas-view-button workspace-canvas-view-fit",
    title: "Fit board to view",
    onClick: () => fitBoardToViewport()
  })
  viewTools.append(viewZoomOutButton, viewZoomStatusButton, viewZoomInButton, fitBoardButton)

  const quickDock = document.createElement("div")
  quickDock.className = "workspace-canvas-quick-dock"

  const quickTextButton = createCanvasIconButton({
    label: "Text",
    icon: "text",
    className: "workspace-canvas-quick-button",
    title: "Add text (T)",
    onClick: () => addTextButton.click()
  })
  const quickNoteButton = createCanvasIconButton({
    label: "Note",
    icon: "note",
    className: "workspace-canvas-quick-button",
    title: "Add note (N)",
    onClick: () => addNoteButton.click()
  })
  const quickShapeButton = createCanvasIconButton({
    label: "Shape",
    icon: "shape",
    className: "workspace-canvas-quick-button",
    title: "Add shape (S)",
    onClick: () => addShapeButton.click()
  })
  const quickImageButton = createCanvasIconButton({
    label: "Image",
    icon: "image",
    className: "workspace-canvas-quick-button",
    title: "Import image (I)",
    onClick: () => addImageButton.click()
  })
  const quickVideoButton = createCanvasIconButton({
    label: "Video",
    icon: "video",
    className: "workspace-canvas-quick-button",
    title: "Import video (V)",
    onClick: () => addVideoButton.click()
  })
  const quickArrowButton = createCanvasIconButton({
    label: "Arrow",
    icon: "link",
    className: "workspace-canvas-quick-button",
    title: "Start arrow from selection (L)",
    onClick: () => connectSelectionButton.click()
  })
  const quickExportButton = createCanvasIconButton({
    label: "Asset",
    icon: "download",
    className: "workspace-canvas-quick-button",
    title: "Export selected media",
    onClick: () => exportAssetButton.click()
  })
  quickDock.append(
    quickTextButton,
    quickNoteButton,
    quickShapeButton,
    quickImageButton,
    quickVideoButton,
    quickArrowButton,
    quickExportButton
  )
  boardViewport.append(viewTools, quickDock)

  tools.append(
    addTextButton,
    addNoteButton,
    addShapeButton,
    addImageButton,
    addVideoButton,
    connectSelectionButton,
    deleteSelectionButton,
    zoomInButton,
    zoomOutButton,
    exportAssetButton,
    fullscreenButton,
    printButton,
    exportButton
  )

  function isCanvasNativeFullscreen() {
    return document.fullscreenElement === surface
  }

  function isCanvasFullscreenActive() {
    return isCanvasNativeFullscreen() || canvasFullscreenFallbackActive
  }

  function setCanvasFullscreenFallbackActive(active = false) {
    canvasFullscreenFallbackActive = Boolean(active)
    surface.classList.toggle("is-fullscreen-fallback", canvasFullscreenFallbackActive)
    document.body.classList.toggle("workspace-canvas-expanded", canvasFullscreenFallbackActive)
  }

  function syncCanvasFullscreenButtonState() {
    const isFullscreen = isCanvasFullscreenActive()
    fullscreenButton.textContent = isFullscreen ? "Exit full screen" : "Full screen"
    fullscreenButton.title = isFullscreen ? "Exit full screen" : "Open full screen"
    fullscreenButton.setAttribute("aria-pressed", isFullscreen ? "true" : "false")
  }

  async function openCanvasFullscreen() {
    contextMenuApi?.close?.()
    if (typeof surface.requestFullscreen === "function") {
      try {
        await surface.requestFullscreen()
        setCanvasFullscreenFallbackActive(false)
        syncCanvasFullscreenButtonState()
        window.requestAnimationFrame(() => focusCanvasViewport())
        return true
      } catch {
        // Fall back to a fixed viewport layout when fullscreen APIs are unavailable.
      }
    }

    setCanvasFullscreenFallbackActive(true)
    syncCanvasFullscreenButtonState()
    window.requestAnimationFrame(() => focusCanvasViewport())
    return true
  }

  async function exitCanvasFullscreen() {
    contextMenuApi?.close?.()
    if (isCanvasNativeFullscreen() && typeof document.exitFullscreen === "function") {
      try {
        await document.exitFullscreen()
      } catch {
        // Ignore exit failures and still restore the fallback layout state below.
      }
    }
    setCanvasFullscreenFallbackActive(false)
    syncCanvasFullscreenButtonState()
    window.requestAnimationFrame(() => focusCanvasViewport())
    return false
  }

  async function toggleCanvasFullscreen() {
    if (isCanvasFullscreenActive()) {
      return exitCanvasFullscreen()
    }
    return openCanvasFullscreen()
  }

  function handleCanvasFullscreenChange() {
    if (!isCanvasNativeFullscreen()) {
      setCanvasFullscreenFallbackActive(false)
    }
    syncCanvasFullscreenButtonState()
    if (isCanvasFullscreenActive()) {
      window.requestAnimationFrame(() => focusCanvasViewport())
    }
  }

  function handleCanvasFullscreenEscape(event) {
    if (event.key !== "Escape" || !canvasFullscreenFallbackActive || surface.contains(event.target)) {
      return
    }
    event.preventDefault()
    void exitCanvasFullscreen()
  }

  function cleanupCanvasPanel() {
    contextMenuApi?.close?.()
    removeCanvasPrintRoot()
    setCanvasFullscreenFallbackActive(false)
    document.removeEventListener("fullscreenchange", handleCanvasFullscreenChange)
    window.removeEventListener("keydown", handleCanvasFullscreenEscape, true)
    if (isCanvasNativeFullscreen() && typeof document.exitFullscreen === "function") {
      void document.exitFullscreen().catch(() => {})
    }
    if (container?.[WORKSPACE_CANVAS_PANEL_CLEANUP] === cleanupCanvasPanel) {
      container[WORKSPACE_CANVAS_PANEL_CLEANUP] = null
    }
  }

  document.addEventListener("fullscreenchange", handleCanvasFullscreenChange)
  window.addEventListener("keydown", handleCanvasFullscreenEscape, true)
  container[WORKSPACE_CANVAS_PANEL_CLEANUP] = cleanupCanvasPanel
  syncCanvasFullscreenButtonState()

  function focusCanvasViewport() {
    if (!isCanvasEditingTarget(document.activeElement)) {
      boardViewport.focus({ preventScroll: true })
    }
  }

  function getSelectedCanvasElement() {
    return getElementById(selectedId)
  }

  function isCanvasMediaElement(element = null) {
    return element?.type === "image" || element?.type === "video"
  }

  function syncCanvasSupplementalUi() {
    const zoomLabel = viewZoomStatusButton.querySelector(".workspace-canvas-icon-button-label")
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`
    }

    const selectedElement = getSelectedCanvasElement()
    const hasSelectedMedia = isCanvasMediaElement(selectedElement)
    exportAssetButton.disabled = !hasSelectedMedia
    exportAssetButton.textContent = selectedElement?.type === "video" ? "Export video" : selectedElement?.type === "image" ? "Export image" : "Export asset"
    quickExportButton.disabled = !hasSelectedMedia
    quickArrowButton.disabled = !selectedId
    quickArrowButton.classList.toggle("is-active", Boolean(selectedId && pendingLinkSourceId === selectedId))
  }

  function fitBoardToViewport() {
    const availableWidth = Math.max(240, boardViewport.clientWidth - 56)
    const availableHeight = Math.max(220, boardViewport.clientHeight - 56)
    const nextZoom = clampZoom(
      Math.min(availableWidth / CANVAS_BOARD_WIDTH, availableHeight / CANVAS_BOARD_HEIGHT)
    )
    zoom = nextZoom
    applyBoardTransform()
    const scaledWidth = CANVAS_BOARD_WIDTH * nextZoom
    const scaledHeight = CANVAS_BOARD_HEIGHT * nextZoom
    boardViewport.scrollLeft = Math.max(0, (scaledWidth - boardViewport.clientWidth) / 2)
    boardViewport.scrollTop = Math.max(0, (scaledHeight - boardViewport.clientHeight) / 2)
  }

  function openZoomPresetMenu(anchorButton = null) {
    const rect = anchorButton?.getBoundingClientRect?.()
    openMenu(
      [
        { heading: true, label: "Zoom" },
        ...[10, 50, 100, 150, 200].map((value) => ({
          label: `${value}%`,
          icon: value === Math.round(zoom * 100) ? "check" : "zoom",
          onSelect: () => setZoom(value / 100)
        })),
        { separator: true },
        {
          label: "Fit board",
          icon: "grid",
          onSelect: () => fitBoardToViewport()
        },
        {
          label: "Reset zoom",
          icon: "zoom",
          onSelect: () => setZoom(1)
        }
      ],
      rect?.left || 24,
      (rect?.bottom || 24) + 8
    )
  }

  async function downloadCanvasAssetForElement(element = null) {
    if (!isCanvasMediaElement(element)) {
      return false
    }
    const src = String(element.src || "").trim()
    if (!src) {
      window.alert("No media source is available for export.")
      return false
    }

    const fallbackExtension = element.type === "video" ? "mp4" : "png"
    const mimeType = String(element.mimeType || inferDataUrlMimeType(src) || "").trim().toLowerCase()
    const extension = inferMimeExtension(mimeType, fallbackExtension)
    const filename = `${sanitizeCanvasDownloadFilename(element.title || element.type || "canvas-asset", "canvas-asset")}.${extension}`

    try {
      if (/^data:/i.test(src)) {
        downloadDataUrlFile(src, filename)
        return true
      }
      const response = await fetch(src)
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`)
      }
      const blob = await response.blob()
      downloadBlobFile(blob, filename)
      return true
    } catch (error) {
      window.alert(`Asset export failed: ${error.message || error}`)
      return false
    }
  }

  function downloadCanvasAssetSelection() {
    return downloadCanvasAssetForElement(getSelectedCanvasElement())
  }

  function getCanvasViewportCenter() {
    return {
      x: Math.max(
        40,
        Math.min(
          CANVAS_BOARD_WIDTH - 220,
          Math.round((boardViewport.scrollLeft + (boardViewport.clientWidth / 2)) / zoom) - 140
        )
      ),
      y: Math.max(
        40,
        Math.min(
          CANVAS_BOARD_HEIGHT - 160,
          Math.round((boardViewport.scrollTop + (boardViewport.clientHeight / 2)) / zoom) - 80
        )
      )
    }
  }

  function getBoardPointFromClient(clientX = 0, clientY = 0) {
    const rect = board.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(CANVAS_BOARD_WIDTH - 80, Math.round((clientX - rect.left) / zoom))),
      y: Math.max(0, Math.min(CANVAS_BOARD_HEIGHT - 80, Math.round((clientY - rect.top) / zoom)))
    }
  }

  function getElementById(id = "") {
    return elements.find((item) => item.id === id) || null
  }

  function getLinkById(id = "") {
    return links.find((item) => item.id === id) || null
  }

  function refreshMetrics() {
    metrics.innerHTML = ""
    if (boardIsPersisted) {
      appendMetric(metrics, elements.length || 0, "items")
      appendMetric(metrics, links.length || 0, "arrows")
      appendMetric(metrics, `${Math.round(zoom * 100)}%`, "zoom")
      return
    }

    appendMetric(
      metrics,
      sections.filter((section) => section?.id && section.id !== "whole-file").length || 1,
      "sections"
    )
    appendMetric(metrics, blocks.filter(Boolean).length || 1, "blocks")
    appendMetric(metrics, estimateReadingTime(content), "pace")
  }

  function persistBoardState() {
    if (!boardIsPersisted || typeof onContentChange !== "function") {
      return
    }

    const nextContent = serializePersistedCanvasSnapshot(elements, links, snapshot, {
      title: boardTitle,
      brief: snapshot?.brief || "Canvas workspace ready for notes, ideas and quick visual organization."
    })
    onContentChange(nextContent)
    const nextSnapshot = extractPersistedCanvasSnapshot(nextContent, boardTitle)
    if (!nextSnapshot) {
      return
    }
    snapshot = nextSnapshot
    elements = normalizeCanvasElementStack(nextSnapshot.elements || [])
    links = sanitizeCanvasLinks(nextSnapshot.links || [], elements)
  }

  function syncBoardState({ persist = true, render = true } = {}) {
    elements = normalizeCanvasElementStack(elements)
    links = sanitizeCanvasLinks(links, elements)
    if (selectedId && !getElementById(selectedId)) {
      selectedId = ""
    }
    if (activeLinkId && !getLinkById(activeLinkId)) {
      activeLinkId = ""
    }
    if (pendingLinkSourceId && !getElementById(pendingLinkSourceId)) {
      pendingLinkSourceId = ""
    }
    if (persist) {
      persistBoardState()
    }
    refreshMetrics()
    refreshBoardStatus()
    if (render) {
      renderBoard()
      return
    }
    renderConnections()
  }

  function applyBoardTransform() {
    board.style.transform = `scale(${zoom})`
    board.style.transformOrigin = "0 0"
    refreshMetrics()
    refreshBoardStatus()
    syncCanvasSupplementalUi()
  }

  function setZoom(nextZoom = 1) {
    zoom = clampZoom(nextZoom)
    applyBoardTransform()
  }

  function replaceElement(id = "", patch = {}) {
    elements = elements.map((item, index) =>
      item.id === id
        ? normalizeCanvasElement({ ...item, ...patch }, index)
        : normalizeCanvasElement(item, index)
    )
  }

  function bringElementToEdge(id = "", edge = "front") {
    const ordered = normalizeCanvasElementStack(elements)
    const currentIndex = ordered.findIndex((item) => item.id === id)
    if (currentIndex < 0) {
      return
    }
    const [target] = ordered.splice(currentIndex, 1)
    if (edge === "back") {
      ordered.unshift(target)
    } else {
      ordered.push(target)
    }
    elements = normalizeCanvasElementStack(ordered)
    syncBoardState()
  }

  function updateElement(id = "", patch = {}, options = {}) {
    replaceElement(id, patch)
    syncBoardState(options)
  }

  function updateLink(id = "", patch = {}, options = {}) {
    links = links
      .map((item, index) => (item.id === id ? normalizeCanvasLink({ ...item, ...patch }, index) : normalizeCanvasLink(item, index)))
      .filter(Boolean)
    syncBoardState(options)
  }

  function removeLink(id = "", options = {}) {
    links = links.filter((item) => item.id !== id)
    syncBoardState(options)
  }

  function removeLinksForElement(elementId = "", direction = "all") {
    links = links.filter((link) => {
      if (direction === "incoming") {
        return link.to !== elementId
      }
      if (direction === "outgoing") {
        return link.from !== elementId
      }
      return link.from !== elementId && link.to !== elementId
    })
    syncBoardState()
  }

  function deleteCurrentSelection() {
    if (activeLinkId) {
      removeLink(activeLinkId)
      return
    }
    if (selectedId) {
      elements = elements.filter((item) => item.id !== selectedId)
      links = links.filter((link) => link.from !== selectedId && link.to !== selectedId)
      selectedId = ""
      syncBoardState()
    }
  }

  function duplicateElement(id = "") {
    const original = getElementById(id)
    if (!original) {
      return
    }
    const duplicate = normalizeCanvasElement(
      {
        ...original,
        id: uid(),
        x: Math.min(CANVAS_BOARD_WIDTH - original.width - 24, original.x + 36),
        y: Math.min(CANVAS_BOARD_HEIGHT - original.height - 24, original.y + 36),
        zIndex: elements.length + 1
      },
      elements.length
    )
    elements = [...elements, duplicate]
    selectedId = duplicate.id
    activeLinkId = ""
    syncBoardState()
    focusCanvasViewport()
  }

  function toggleLinkSource(id = "") {
    if (!id) {
      return
    }
    pendingLinkSourceId = pendingLinkSourceId === id ? "" : id
    selectedId = id
    activeLinkId = ""
    refreshBoardStatus()
    renderBoard()
    focusCanvasViewport()
  }

  function createLink(fromId = "", toId = "") {
    if (!fromId || !toId || fromId === toId) {
      return
    }
    const existing = links.find((link) => link.from === fromId && link.to === toId)
    pendingLinkSourceId = ""
    if (existing) {
      activeLinkId = existing.id
      selectedId = ""
      refreshBoardStatus()
      renderBoard()
      focusCanvasViewport()
      return
    }
    const nextLink = normalizeCanvasLink(
      {
        id: uid("canvas-link"),
        from: fromId,
        to: toId,
        color: CANVAS_LINK_COLOR,
        zIndex: links.length + 1
      },
      links.length
    )
    if (!nextLink) {
      return
    }
    links = [...links, nextLink]
    activeLinkId = nextLink.id
    selectedId = ""
    syncBoardState()
    focusCanvasViewport()
  }

  function reverseLink(id = "") {
    const link = getLinkById(id)
    if (!link) {
      return
    }
    updateLink(id, {
      from: link.to,
      to: link.from
    })
  }

  function selectLink(id = "", { focus = true } = {}) {
    activeLinkId = id
    selectedId = ""
    if (focus) {
      focusCanvasViewport()
    }
    refreshBoardStatus()
    renderBoard()
  }

  function selectElement(id = "", { focus = true } = {}) {
    if (!id) {
      return
    }
    if (pendingLinkSourceId && pendingLinkSourceId !== id) {
      createLink(pendingLinkSourceId, id)
      return
    }
    selectedId = id
    activeLinkId = ""
    if (!boardIsPersisted && typeof onSectionFocus === "function" && id !== "document-map") {
      onSectionFocus(id)
    }
    refreshBoardStatus()
    renderBoard()
    if (focus) {
      focusCanvasViewport()
    }
  }

  function refreshBoardStatus() {
    const selectedElement = getElementById(selectedId)
    const activeLink = getLinkById(activeLinkId)
    helperCancelButton.hidden = !pendingLinkSourceId

    if (pendingLinkSourceId) {
      const source = getElementById(pendingLinkSourceId)
      helperText.textContent = `Arrow mode on. Click another block to connect from ${source?.title || "the selected block"}.`
    } else if (activeLink) {
      const from = getElementById(activeLink.from)
      const to = getElementById(activeLink.to)
      helperText.textContent = `Arrow selected: ${from?.title || "Source"} to ${to?.title || "Target"}. Right-click it for options.`
    } else if (selectedElement) {
      helperText.textContent = `Selected: ${selectedElement.title || "Untitled block"}. Use Link or right-click for more options.`
    } else {
      helperText.textContent = "Tip: right-click a block for options, or start an arrow then click another block."
    }

    connectSelectionButton.disabled = !selectedId
    connectSelectionButton.textContent =
      pendingLinkSourceId && pendingLinkSourceId === selectedId ? "Cancel arrow" : "Start arrow"
    deleteSelectionButton.disabled = !selectedId && !activeLinkId
    deleteSelectionButton.textContent = activeLinkId ? "Delete arrow" : "Delete"
    syncCanvasSupplementalUi()
  }

  function openMenu(items = [], clientX = 0, clientY = 0) {
    contextMenuApi.open(items, {
      clientX,
      clientY,
      appendTo: isCanvasFullscreenActive() ? surface : document.body
    })
  }

  function editElementTitle(elementId = "") {
    const element = getElementById(elementId)
    if (!element) {
      return
    }
    const nextTitle = window.prompt("Block title", element.title || "")
    if (nextTitle === null) {
      return
    }
    updateElement(elementId, {
      title: nextTitle.trim() || element.title || "Untitled"
    })
  }

  function editImageUrl(elementId = "") {
    const element = getElementById(elementId)
    if (!element) {
      return
    }
    const nextUrl = window.prompt("Image URL", element.src || "")
    if (!nextUrl) {
      return
    }
    updateElement(elementId, {
      src: nextUrl.trim()
    })
  }

  function editVideoUrl(elementId = "") {
    const element = getElementById(elementId)
    if (!element) {
      return
    }
    const nextUrl = window.prompt("Video URL", element.src || "")
    if (!nextUrl) {
      return
    }
    updateElement(elementId, {
      src: nextUrl.trim(),
      poster: "",
      mimeType: inferDataUrlMimeType(nextUrl.trim()) || element.mimeType || "video/mp4"
    })
  }

  function editLinkLabel(linkId = "") {
    const link = getLinkById(linkId)
    if (!link) {
      return
    }
    const nextLabel = window.prompt("Arrow label", link.label || "")
    if (nextLabel === null) {
      return
    }
    updateLink(linkId, {
      label: nextLabel.trim()
    })
  }

  function openBoardContextMenu(clientX = 0, clientY = 0) {
    const point = getBoardPointFromClient(clientX, clientY)
    openMenu(
      [
        { heading: true, label: "Canvas" },
        {
          label: "Add text",
          icon: "text",
          onSelect: () =>
            createBoardElement("text", {
              x: point.x,
              y: point.y,
              title: "New text",
              body: "Write your content here.",
              width: 280,
              height: 130,
              color: "#dfe8ff"
            })
        },
        {
          label: "Add note",
          icon: "note",
          onSelect: () =>
            createBoardElement("note", {
              x: point.x,
              y: point.y,
              title: "New note",
              body: "Add an idea, a comment or an instruction.",
              width: 300,
              height: 160,
              color: "#f6d365"
            })
        },
        {
          label: "Add shape",
          icon: "shape",
          items: buildShapeMenuItems((option) => {
            createBoardElement(
              "shape",
              createCanvasShapeSeed(option.value, {
                x: point.x,
                y: point.y
              })
            )
          })
        },
        {
          label: "Add image",
          icon: "image",
          onSelect: () => addImageFromComputer({ x: point.x, y: point.y })
        },
        {
          label: "Add video",
          icon: "video",
          onSelect: () => addVideoFromComputer({ x: point.x, y: point.y })
        },
        { separator: true },
        {
          label: "Fit board",
          icon: "grid",
          onSelect: () => fitBoardToViewport()
        },
        {
          label: "Reset zoom",
          icon: "zoom",
          onSelect: () => setZoom(1)
        },
        {
          label: "Open zoom menu",
          icon: "zoom",
          onSelect: () => openZoomPresetMenu(viewZoomStatusButton)
        },
        { separator: true },
        {
          label: "Export selected media",
          icon: "download",
          disabled: !isCanvasMediaElement(getSelectedCanvasElement()),
          onSelect: () => downloadCanvasAssetSelection()
        },
        {
          label: "Print canvas",
          icon: "print",
          onSelect: () => printCurrentCanvas()
        },
        {
          label: "Export PDF",
          icon: "pdf",
          onSelect: () => exportCanvasAsPdf()
        },
        {
          label: "Cancel arrow mode",
          icon: "close",
          disabled: !pendingLinkSourceId,
          onSelect: () => {
            pendingLinkSourceId = ""
            refreshBoardStatus()
            renderBoard()
          }
        }
      ],
      clientX,
      clientY
    )
  }

  function openElementContextMenu(elementId = "", clientX = 0, clientY = 0) {
    const element = getElementById(elementId)
    if (!element) {
      return
    }
    selectedId = elementId
    activeLinkId = ""
    refreshBoardStatus()

    const outgoingCount = links.filter((link) => link.from === elementId).length
    const incomingCount = links.filter((link) => link.to === elementId).length

    openMenu(
      [
        { heading: true, label: element.title || "Block" },
        {
          label: "Edit title",
          icon: "rename",
          onSelect: () => editElementTitle(elementId)
        },
        ...(element.type === "image"
          ? [
              {
                label: "Replace image",
                icon: "image",
                onSelect: () => replaceImageFromComputer(elementId)
              },
              {
                label: "Replace image from URL",
                icon: "link",
                onSelect: () => editImageUrl(elementId)
              },
              {
                label: "Export image",
                icon: "download",
                onSelect: () => downloadCanvasAssetForElement(element)
              }
            ]
          : []),
        ...(element.type === "video"
          ? [
              {
                label: "Replace video",
                icon: "video",
                onSelect: () => replaceVideoFromComputer(elementId)
              },
              {
                label: "Replace video from URL",
                icon: "link",
                onSelect: () => editVideoUrl(elementId)
              },
              {
                label: "Export video",
                icon: "download",
                onSelect: () => downloadCanvasAssetForElement(element)
              }
            ]
          : []),
        {
          label: element.type === "image" || element.type === "video" ? "Card color" : "Fill color",
          icon: "palette",
          items: [
            createCanvasPaletteItem({
              title: element.type === "image" || element.type === "video" ? "Card color" : "Fill color",
              currentValue: element.color,
              swatches: buildCanvasFillPaletteColors(element.color),
              onSelect: (value) => updateElement(elementId, { color: value })
            })
          ]
        },
        {
          label: "Text color",
          icon: "palette",
          items: [
            createCanvasPaletteItem({
              title: "Text color",
              currentValue: element.textColor,
              swatches: buildCanvasTextPaletteColors(element.textColor),
              actions: [
                {
                  label: "Default text",
                  icon: "A",
                  onSelect: () => updateElement(elementId, { textColor: "#1f2937" })
                }
              ],
              onSelect: (value) => updateElement(elementId, { textColor: value })
            })
          ]
        },
        ...(element.type === "shape"
          ? [
              {
                label: "Shape",
                icon: "shape",
                items: buildShapeMenuItems((option) => updateElement(elementId, { shape: option.value }))
              }
            ]
          : []),
        {
          label: "Order",
          icon: "move",
          items: [
            {
              label: "Bring to front",
              icon: "alignTop",
              onSelect: () => bringElementToEdge(elementId, "front")
            },
            {
              label: "Send to back",
              icon: "alignBottom",
              onSelect: () => bringElementToEdge(elementId, "back")
            }
          ]
        },
        {
          label: "Connections",
          icon: "link",
          items: [
            {
              label: pendingLinkSourceId === elementId ? "Cancel arrow from here" : "Start arrow from here",
              icon: "link",
              onSelect: () => toggleLinkSource(elementId)
            },
            {
              label: "Connect arrow here",
              icon: "insert",
              disabled: !pendingLinkSourceId || pendingLinkSourceId === elementId,
              onSelect: () => createLink(pendingLinkSourceId, elementId)
            },
            {
              label: "Remove outgoing arrows",
              icon: "delete",
              disabled: outgoingCount <= 0,
              onSelect: () => removeLinksForElement(elementId, "outgoing")
            },
            {
              label: "Remove incoming arrows",
              icon: "delete",
              disabled: incomingCount <= 0,
              onSelect: () => removeLinksForElement(elementId, "incoming")
            }
          ]
        },
        { separator: true },
        {
          label: "Duplicate",
          icon: "duplicate",
          onSelect: () => duplicateElement(elementId)
        },
        {
          label: "Delete",
          icon: "delete",
          danger: true,
          onSelect: () => {
            selectedId = elementId
            deleteCurrentSelection()
          }
        }
      ],
      clientX,
      clientY
    )
  }

  function openLinkContextMenu(linkId = "", clientX = 0, clientY = 0) {
    const link = getLinkById(linkId)
    if (!link) {
      return
    }
    activeLinkId = linkId
    selectedId = ""
    refreshBoardStatus()
    openMenu(
      [
        { heading: true, label: link.label || "Arrow" },
        {
          label: "Edit label",
          icon: "rename",
          onSelect: () => editLinkLabel(linkId)
        },
        {
          label: "Color",
          icon: "palette",
          items: [
            createCanvasPaletteItem({
              title: "Arrow color",
              currentValue: link.color,
              swatches: buildCanvasLinkPaletteColors(link.color),
              actions: [
                {
                  label: "Default arrow",
                  icon: "A",
                  onSelect: () => updateLink(linkId, { color: CANVAS_LINK_COLOR })
                }
              ],
              onSelect: (value) => updateLink(linkId, { color: value })
            })
          ]
        },
        {
          label: "Reverse direction",
          icon: "refresh",
          onSelect: () => reverseLink(linkId)
        },
        {
          label: "Delete arrow",
          icon: "delete",
          danger: true,
          onSelect: () => removeLink(linkId)
        }
      ],
      clientX,
      clientY
    )
  }

  function renderConnections() {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker")
    marker.setAttribute("id", boardMarkerId)
    marker.setAttribute("viewBox", "0 0 12 12")
    marker.setAttribute("refX", "10")
    marker.setAttribute("refY", "6")
    marker.setAttribute("markerWidth", "12")
    marker.setAttribute("markerHeight", "12")
    marker.setAttribute("markerUnits", "userSpaceOnUse")
    marker.setAttribute("orient", "auto-start-reverse")
    const arrowHead = document.createElementNS("http://www.w3.org/2000/svg", "path")
    arrowHead.setAttribute("d", "M 0 1 L 10 6 L 0 11 z")
    arrowHead.setAttribute("class", "workspace-canvas-link-arrowhead")
    marker.appendChild(arrowHead)
    defs.appendChild(marker)

    linkLayer.replaceChildren(defs)
    linkChipLayer.replaceChildren()

    links.forEach((link) => {
      const fromItem = getElementById(link.from)
      const toItem = getElementById(link.to)
      if (!fromItem || !toItem) {
        return
      }
      const geometry = describeCanvasLinkPath(fromItem, toItem)

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
      path.setAttribute("d", geometry.d)
      path.setAttribute(
        "class",
        `workspace-canvas-link${activeLinkId === link.id ? " is-active" : ""}`
      )
      path.setAttribute("stroke", link.color || CANVAS_LINK_COLOR)
      path.style.color = link.color || CANVAS_LINK_COLOR
      path.setAttribute("marker-end", `url(#${boardMarkerId})`)
      linkLayer.appendChild(path)

      const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
      hitPath.setAttribute("d", geometry.d)
      hitPath.setAttribute("class", "workspace-canvas-link-hit")
      hitPath.dataset.linkId = link.id
      hitPath.addEventListener("click", (event) => {
        event.preventDefault()
        event.stopPropagation()
        selectLink(link.id)
      })
      hitPath.addEventListener("contextmenu", (event) => {
        event.preventDefault()
        event.stopPropagation()
        openLinkContextMenu(link.id, event.clientX, event.clientY)
      })
      linkLayer.appendChild(hitPath)

      if (link.label || activeLinkId === link.id) {
        const chip = document.createElement("div")
        chip.className = `workspace-canvas-link-chip${activeLinkId === link.id ? " is-active" : ""}`
        chip.style.left = `${geometry.midpoint.x}px`
        chip.style.top = `${geometry.midpoint.y}px`
        chip.addEventListener("click", (event) => {
          event.preventDefault()
          event.stopPropagation()
          selectLink(link.id)
        })
        chip.addEventListener("contextmenu", (event) => {
          event.preventDefault()
          event.stopPropagation()
          openLinkContextMenu(link.id, event.clientX, event.clientY)
        })

        const chipLabel = document.createElement("span")
        chipLabel.textContent = link.label || "Arrow"
        chip.appendChild(chipLabel)

        if (activeLinkId === link.id) {
          const removeButton = document.createElement("button")
          removeButton.type = "button"
          removeButton.className = "workspace-canvas-link-remove"
          removeButton.textContent = "X"
          removeButton.addEventListener("click", (event) => {
            event.preventDefault()
            event.stopPropagation()
            removeLink(link.id)
          })
          chip.appendChild(removeButton)
        }

        linkChipLayer.appendChild(chip)
      }
    })
  }

  function renderBoard() {
    itemLayer.innerHTML = ""
    renderConnections()
    elements
      .slice()
      .sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0))
      .forEach((item) => {
        itemLayer.appendChild(
          createCanvasElement(item, {
            allowConnections: boardContentIsEditable,
            pendingLinkSourceId,
            selectedId,
            zoom,
            onActivate: (id) => selectElement(id),
            onCommit: (id, patch) => updateElement(id, patch),
            onDelete: (id) => {
              selectedId = id
              deleteCurrentSelection()
            },
            onDuplicate: (id) => duplicateElement(id),
            onLinkStart: (id) => toggleLinkSource(id),
            onLiveUpdate: (id, patch) => {
              replaceElement(id, patch)
              renderConnections()
            },
            onContextMenu: (id, clientX, clientY) => openElementContextMenu(id, clientX, clientY)
          })
        )
      })
    applyBoardTransform()
  }

  function createBoardElement(type, seed = {}) {
    const viewportCenter = getCanvasViewportCenter()
    const next = normalizeCanvasElement(
      {
        id: uid(),
        type,
        zIndex: elements.length + 1,
        x: seed.x ?? viewportCenter.x,
        y: seed.y ?? viewportCenter.y,
        ...seed
      },
      elements.length
    )
    elements = [...elements, next]
    selectedId = next.id
    activeLinkId = ""
    syncBoardState()
    focusCanvasViewport()
  }

  let panState = null

  board.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || ![board, linkLayer].includes(event.target)) {
      return
    }

    const startScrollLeft = boardViewport.scrollLeft
    const startScrollTop = boardViewport.scrollTop
    const startX = event.clientX
    const startY = event.clientY
    panState = {
      startScrollLeft,
      startScrollTop,
      startX,
      startY,
      moved: false
    }

    board.setPointerCapture(event.pointerId)
    boardViewport.classList.add("is-panning")

    const move = (pointerEvent) => {
      if (!panState) {
        return
      }
      const dx = pointerEvent.clientX - panState.startX
      const dy = pointerEvent.clientY - panState.startY
      panState.moved = panState.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3
      boardViewport.scrollLeft = panState.startScrollLeft - dx
      boardViewport.scrollTop = panState.startScrollTop - dy
    }

    const up = () => {
      board.removeEventListener("pointermove", move)
      board.removeEventListener("pointerup", up)
      try {
        board.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore release errors from detached or inactive pointers.
      }
      boardViewport.classList.remove("is-panning")
      const shouldClear = panState && !panState.moved
      panState = null
      if (shouldClear) {
        selectedId = ""
        activeLinkId = ""
        refreshBoardStatus()
        renderBoard()
        focusCanvasViewport()
      }
    }

    board.addEventListener("pointermove", move)
    board.addEventListener("pointerup", up)
  })

  board.addEventListener("dblclick", (event) => {
    if (![board, linkLayer].includes(event.target)) {
      return
    }
    const point = getBoardPointFromClient(event.clientX, event.clientY)
    createBoardElement("note", {
      x: point.x,
      y: point.y,
      title: "Quick note",
      body: "Add your idea here.",
      width: 280,
      height: 150,
      color: "#f6d365"
    })
  })

  board.addEventListener("contextmenu", (event) => {
    if (![board, linkLayer].includes(event.target)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    openBoardContextMenu(event.clientX, event.clientY)
  })

  boardViewport.addEventListener(
    "wheel",
    (event) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return
      }
      event.preventDefault()
      setZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1))
    },
    { passive: false }
  )

  surface.addEventListener("keydown", (event) => {
    if (isCanvasEditingTarget(event.target)) {
      if (event.key === "Escape" && pendingLinkSourceId) {
        pendingLinkSourceId = ""
        refreshBoardStatus()
        renderBoard()
      }
      return
    }

    if (event.key === "Escape") {
      if (pendingLinkSourceId || activeLinkId || selectedId) {
        pendingLinkSourceId = ""
        activeLinkId = ""
        selectedId = ""
        refreshBoardStatus()
        renderBoard()
        return
      }
      if (isCanvasFullscreenActive()) {
        event.preventDefault()
        void exitCanvasFullscreen()
      }
      return
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault()
      deleteCurrentSelection()
      return
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      const key = event.key.toLowerCase()
      if (key === "t") {
        event.preventDefault()
        addTextButton.click()
        return
      }
      if (key === "n") {
        event.preventDefault()
        addNoteButton.click()
        return
      }
      if (key === "s") {
        event.preventDefault()
        addShapeButton.click()
        return
      }
      if (key === "i") {
        event.preventDefault()
        addImageButton.click()
        return
      }
      if (key === "v") {
        event.preventDefault()
        addVideoButton.click()
        return
      }
      if (key === "f") {
        event.preventDefault()
        fitBoardToViewport()
        return
      }
      if (key === "+" || key === "=") {
        event.preventDefault()
        setZoom(zoom + 0.1)
        return
      }
      if (key === "-") {
        event.preventDefault()
        setZoom(zoom - 0.1)
        return
      }
      if (key === "0") {
        event.preventDefault()
        setZoom(1)
        return
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedId) {
      event.preventDefault()
      duplicateElement(selectedId)
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l" && selectedId) {
      event.preventDefault()
      toggleLinkSource(selectedId)
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "0") {
      event.preventDefault()
      fitBoardToViewport()
    }
  })

  refreshMetrics()
  refreshBoardStatus()
  toolbar.append(toolbarCopy, metrics, tools)
  surface.append(toolbar, helper, boardViewport, imagePickerInput, videoPickerInput)
  container.appendChild(surface)

  renderBoard()
}
