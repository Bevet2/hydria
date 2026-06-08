function uid() {
  return `canvas-${Math.random().toString(36).slice(2, 9)}`;
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
    .trim();
}

function createExcerpt(value = "", maxLength = 220) {
  const plainText = toPlainText(value);
  if (!plainText) {
    return "Double-click to edit this block.";
  }
  return plainText.length <= maxLength
    ? plainText
    : `${plainText.slice(0, maxLength).trimEnd()}...`;
}

function toFileLabel(filePath = "") {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] || "Untitled document";
}

function estimateReadingTime(value = "") {
  const wordCount = toPlainText(value).split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(wordCount / 180) || 1)} min read`;
}

function downloadJSON(data, filename = "canvas.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function appendMetric(container, value, label) {
  const pill = document.createElement("div");
  pill.className = "workspace-canvas-metric";

  const strong = document.createElement("strong");
  strong.textContent = String(value || "0");

  const span = document.createElement("span");
  span.textContent = label;

  pill.append(strong, span);
  container.appendChild(pill);
}

function createToolbarButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "workspace-canvas-tool";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createCanvasElement(data, context) {
  const { onSelect, onUpdate, onDuplicate, onDelete, selectedId } = context;

  const node = document.createElement("div");
  node.className = `workspace-canvas-item workspace-canvas-${data.type}`;
  node.dataset.id = data.id;
  node.style.left = `${data.x}px`;
  node.style.top = `${data.y}px`;
  node.style.width = `${data.width}px`;
  node.style.height = `${data.height}px`;
  node.style.transform = `rotate(${data.rotation || 0}deg)`;
  node.style.zIndex = String(data.zIndex || 1);

  if (selectedId === data.id) {
    node.classList.add("selected");
  }

  const content = document.createElement("div");
  content.className = "workspace-canvas-item-content";

  if (data.type === "image") {
    const img = document.createElement("img");
    img.src = data.src;
    img.alt = data.title || "Canvas image";
    content.appendChild(img);
  } else if (data.type === "shape") {
    content.classList.add(`shape-${data.shape || "rect"}`);
    content.style.background = data.color || "#f4d35e";
  } else {
    const title = document.createElement("strong");
    title.contentEditable = "true";
    title.textContent = data.title || "Title";

    const body = document.createElement("p");
    body.contentEditable = "true";
    body.textContent = data.body || "Text";

    title.addEventListener("input", () => {
      onUpdate(data.id, { title: title.textContent });
    });

    body.addEventListener("input", () => {
      onUpdate(data.id, { body: body.textContent });
    });

    content.append(title, body);
  }

  const actions = document.createElement("div");
  actions.className = "workspace-canvas-item-actions";

  const duplicate = createToolbarButton("Copy", () => onDuplicate(data.id));
  const remove = createToolbarButton("X", () => onDelete(data.id));
  actions.append(duplicate, remove);

  const resize = document.createElement("span");
  resize.className = "workspace-canvas-resize";

  node.append(content, actions, resize);

  node.addEventListener("pointerdown", (event) => {
    if (
      event.target.isContentEditable ||
      event.target.closest(".workspace-canvas-item-actions") ||
      event.target.classList.contains("workspace-canvas-resize")
    ) {
      return;
    }

    onSelect(data.id);

    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = data.x;
    const initialY = data.y;

    node.setPointerCapture(event.pointerId);

    function move(e) {
      const nextX = initialX + (e.clientX - startX) / context.zoom;
      const nextY = initialY + (e.clientY - startY) / context.zoom;

      node.style.left = `${nextX}px`;
      node.style.top = `${nextY}px`;

      onUpdate(data.id, {
        x: Math.round(nextX),
        y: Math.round(nextY)
      });
    }

    function up() {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
    }

    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
  });

  resize.addEventListener("pointerdown", (event) => {
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const initialWidth = data.width;
    const initialHeight = data.height;

    resize.setPointerCapture(event.pointerId);

    function move(e) {
      const nextWidth = Math.max(80, initialWidth + (e.clientX - startX) / context.zoom);
      const nextHeight = Math.max(60, initialHeight + (e.clientY - startY) / context.zoom);

      node.style.width = `${nextWidth}px`;
      node.style.height = `${nextHeight}px`;

      onUpdate(data.id, {
        width: Math.round(nextWidth),
        height: Math.round(nextHeight)
      });
    }

    function up() {
      resize.removeEventListener("pointermove", move);
      resize.removeEventListener("pointerup", up);
    }

    resize.addEventListener("pointermove", move);
    resize.addEventListener("pointerup", up);
  });

  return node;
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
    onSectionFocus = null
  } = {}
) {
  container.innerHTML = "";

  let zoom = 1;
  let selectedId = selectedSectionId || "";
  let elements = [];

  const visibleSections = sections.filter(
    (section) => section?.id && section.id !== "whole-file"
  );

  elements.push({
    id: "document-map",
    type: "note",
    title: workObject?.title || toFileLabel(filePath),
    body: createExcerpt(content, 280),
    x: 80,
    y: 80,
    width: 340,
    height: 190,
    zIndex: 1
  });

  visibleSections.slice(0, 12).forEach((section, index) => {
    elements.push({
      id: section.id,
      type: "note",
      title: section.title || `Section ${index + 1}`,
      body: createExcerpt(section.block || section.content || "", 160),
      x: 120 + (index % 3) * 380,
      y: 330 + Math.floor(index / 3) * 240,
      width: 320,
      height: 180,
      zIndex: index + 2
    });
  });

  const surface = document.createElement("section");
  surface.className = "workspace-canvas-surface";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-document-preview-toolbar workspace-canvas-toolbar";

  const toolbarCopy = document.createElement("div");
  toolbarCopy.className = "workspace-canvas-toolbar-copy";

  const label = document.createElement("span");
  label.className = "workspace-canvas-toolbar-label";
  label.textContent = "Canvas";

  const title = document.createElement("strong");
  title.textContent = workObject?.title || toFileLabel(filePath);

  const subtitle = document.createElement("p");
  subtitle.className = "workspace-canvas-toolbar-subtitle";
  subtitle.textContent = "Create, move, resize, edit and organize ideas like on a Canva-style board.";

  toolbarCopy.append(label, title, subtitle);

  const metrics = document.createElement("div");
  metrics.className = "workspace-canvas-metrics";
  appendMetric(metrics, visibleSections.length || 1, "sections");
  appendMetric(metrics, blocks.filter(Boolean).length || 1, "blocks");
  appendMetric(metrics, estimateReadingTime(content), "pace");

  const tools = document.createElement("div");
  tools.className = "workspace-canvas-tools";

  const boardViewport = document.createElement("div");
  boardViewport.className = "workspace-canvas-viewport";

  const board = document.createElement("div");
  board.className = "workspace-canvas-board canva-like-grid";

  boardViewport.appendChild(board);

  function updateElement(id, patch) {
    elements = elements.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    );
  }

  function renderBoard() {
    board.innerHTML = "";
    board.style.transform = `scale(${zoom})`;
    board.style.transformOrigin = "0 0";

    elements.forEach((item) => {
      board.appendChild(
        createCanvasElement(item, {
          zoom,
          selectedId,
          onSelect(id) {
            selectedId = id;

            if (typeof onSectionFocus === "function" && id !== "document-map") {
              onSectionFocus(id);
            }

            renderBoard();
          },
          onUpdate: updateElement,
          onDuplicate(id) {
            const original = elements.find((item) => item.id === id);
            if (!original) {
              return;
            }

            elements.push({
              ...original,
              id: uid(),
              x: original.x + 40,
              y: original.y + 40,
              zIndex: elements.length + 1
            });

            renderBoard();
          },
          onDelete(id) {
            elements = elements.filter((item) => item.id !== id);
            if (selectedId === id) {
              selectedId = "";
            }
            renderBoard();
          }
        })
      );
    });
  }

  tools.append(
    createToolbarButton("+ Text", () => {
      elements.push({
        id: uid(),
        type: "text",
        title: "New text",
        body: "Write your content here.",
        x: 160,
        y: 160,
        width: 280,
        height: 130,
        zIndex: elements.length + 1
      });
      renderBoard();
    }),
    createToolbarButton("+ Note", () => {
      elements.push({
        id: uid(),
        type: "note",
        title: "New note",
        body: "Add an idea, a comment or an instruction.",
        x: 220,
        y: 220,
        width: 300,
        height: 160,
        zIndex: elements.length + 1
      });
      renderBoard();
    }),
    createToolbarButton("+ Shape", () => {
      elements.push({
        id: uid(),
        type: "shape",
        shape: "rect",
        color: "#f4d35e",
        x: 260,
        y: 260,
        width: 180,
        height: 120,
        zIndex: elements.length + 1
      });
      renderBoard();
    }),
    createToolbarButton("+ Image", () => {
      const src = window.prompt("Paste the image URL:");
      if (!src) {
        return;
      }

      elements.push({
        id: uid(),
        type: "image",
        src,
        x: 300,
        y: 300,
        width: 280,
        height: 180,
        zIndex: elements.length + 1
      });

      renderBoard();
    }),
    createToolbarButton("Zoom +", () => {
      zoom = Math.min(2, zoom + 0.1);
      renderBoard();
    }),
    createToolbarButton("Zoom -", () => {
      zoom = Math.max(0.4, zoom - 0.1);
      renderBoard();
    }),
    createToolbarButton("Export", () => {
      downloadJSON(elements, `${toFileLabel(filePath)}-canvas.json`);
    })
  );

  toolbar.append(toolbarCopy, metrics, tools);
  surface.append(toolbar, boardViewport);
  container.appendChild(surface);

  renderBoard();
}
