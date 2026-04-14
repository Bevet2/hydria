function splitParagraphs(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function isBulletBlock(lines = []) {
  return lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));
}

function isNumberedBlock(lines = []) {
  return lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line));
}

function createTextFragment(text = "") {
  const fragment = document.createDocumentFragment();
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(
        document.createTextNode(text.slice(lastIndex, match.index))
      );
    }

    if (match[2] && match[3]) {
      const link = document.createElement("a");
      link.href = match[3];
      link.textContent = match[2];
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      fragment.appendChild(link);
    } else if (match[4]) {
      const code = document.createElement("code");
      code.textContent = match[4];
      fragment.appendChild(code);
    } else if (match[5]) {
      const strong = document.createElement("strong");
      strong.textContent = match[5];
      fragment.appendChild(strong);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

function appendInlineContent(element, text = "") {
  element.appendChild(createTextFragment(text));
}

function renderList(bubble, lines, ordered = false) {
  const list = document.createElement(ordered ? "ol" : "ul");

  for (const line of lines) {
    const item = document.createElement("li");
    appendInlineContent(
      item,
      line.replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, "")
    );
    list.appendChild(item);
  }

  bubble.appendChild(list);
}

function renderParagraphWithLineBreaks(bubble, block = "") {
  const paragraph = document.createElement("p");
  const lines = block.split("\n");

  lines.forEach((line, index) => {
    if (index > 0) {
      paragraph.appendChild(document.createElement("br"));
    }
    appendInlineContent(paragraph, line);
  });

  bubble.appendChild(paragraph);
}

function parseGeneratedFileMessage(content = "") {
  const match = String(content || "").match(
    /^Generated file:\s+(.+?)\s+(?:\((.+?)\)|\[(.+?)\])\s+->\s+(\S+)\s*$/i
  );

  if (!match) {
    return null;
  }

  return {
    filename: match[1],
    format: match[2] || match[3],
    downloadUrl: match[4]
  };
}

function renderTextMessageBubble(bubble, content) {
  const blocks = splitParagraphs(content);

  if (!blocks.length) {
    const paragraph = document.createElement("p");
    paragraph.textContent = "";
    bubble.appendChild(paragraph);
    return;
  }

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (isBulletBlock(lines)) {
      renderList(bubble, lines, false);
      continue;
    }

    if (isNumberedBlock(lines)) {
      renderList(bubble, lines, true);
      continue;
    }

    renderParagraphWithLineBreaks(bubble, block);
  }
}

function renderGeneratedFileBubble(bubble, artifact) {
  bubble.classList.add("artifact-bubble");

  const eyebrow = document.createElement("span");
  eyebrow.className = "artifact-eyebrow";
  eyebrow.textContent = "Generated file";

  const title = document.createElement("strong");
  title.className = "artifact-title";
  title.textContent = artifact.filename;

  const meta = document.createElement("p");
  meta.className = "artifact-meta";
  meta.textContent = `Format: ${String(artifact.format || "").toUpperCase()}`;

  const actions = document.createElement("div");
  actions.className = "artifact-actions";

  const downloadLink = document.createElement("a");
  downloadLink.className = "artifact-download";
  downloadLink.href = artifact.downloadUrl;
  downloadLink.textContent = "Download";
  downloadLink.setAttribute("download", artifact.filename);

  const rawLink = document.createElement("code");
  rawLink.className = "artifact-path";
  rawLink.textContent = artifact.downloadUrl;

  actions.append(downloadLink, rawLink);
  bubble.append(eyebrow, title, meta, actions);
}

function renderActionButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "artifact-download work-object-action";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderWorkObjectCard(container, workObject, options = {}) {
  if (!workObject?.id) {
    return;
  }

  const card = document.createElement("section");
  card.className = "work-object-card";

  const eyebrow = document.createElement("span");
  eyebrow.className = "artifact-eyebrow";
  eyebrow.textContent = `${workObject.objectKind || workObject.kind || "object"} | ${workObject.status || "ready"}`;

  const title = document.createElement("strong");
  title.className = "artifact-title";
  title.textContent = workObject.title || "Hydria Object";

  const meta = document.createElement("p");
  meta.className = "artifact-meta";
  meta.textContent = [
    workObject.primaryFile ? `fichier principal: ${workObject.primaryFile}` : "",
    workObject.workspacePath ? `workspace: ${workObject.workspacePath}` : "",
    workObject.projectDimensions?.length
      ? `dimensions: ${workObject.projectDimensions.join(", ")}`
      : "",
    workObject.internalCapabilities?.length
      ? `capacites: ${workObject.internalCapabilities.join(", ")}`
      : "",
    workObject.nextActionHint ? `suite: ${workObject.nextActionHint}` : ""
  ]
    .filter(Boolean)
    .join(" | ");

  const actions = document.createElement("div");
  actions.className = "artifact-actions";

  if (options.onOpenWorkObject) {
    actions.appendChild(
      renderActionButton("Open", () => options.onOpenWorkObject(workObject))
    );
  }

  if (options.onContinueWithObject) {
    actions.appendChild(
      renderActionButton("Continue with Hydria", () =>
        options.onContinueWithObject(workObject)
      )
    );
  }

  if (workObject.export?.downloadUrl) {
    const downloadLink = document.createElement("a");
    downloadLink.className = "artifact-download";
    downloadLink.href = workObject.export.downloadUrl;
    downloadLink.textContent = "Download";
    downloadLink.setAttribute(
      "download",
      workObject.export.filename || `${workObject.title || "hydria-object"}.zip`
    );
    actions.appendChild(downloadLink);
  }

  if (workObject.primaryFile) {
    const rawLink = document.createElement("code");
    rawLink.className = "artifact-path";
    rawLink.textContent = workObject.primaryFile;
    actions.appendChild(rawLink);
  }

  card.append(eyebrow, title);
  if (meta.textContent) {
    card.append(meta);
  }
  card.append(actions);
  container.appendChild(card);
}

export function renderChatMessage(message, options = {}) {
  const wrapper = document.createElement("article");
  wrapper.className = `message ${message.role}`;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  const createdAt = message.created_at
    ? new Date(message.created_at).toLocaleString()
    : "Pending";
  meta.textContent = `${message.role} | ${createdAt}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const generatedFile =
    message.role === "tool" ? parseGeneratedFileMessage(message.content) : null;
  if (generatedFile) {
    renderGeneratedFileBubble(bubble, generatedFile);
  } else {
    renderTextMessageBubble(bubble, message.content);
  }

  if (Array.isArray(message.attachments) && message.attachments.length) {
    const attachmentList = document.createElement("div");
    attachmentList.className = "message-attachments";

    for (const attachment of message.attachments) {
      const chip = document.createElement("span");
      chip.className = "message-attachment";
      chip.textContent = attachment.originalName || attachment.name || "attachment";
      attachmentList.appendChild(chip);
    }

    bubble.appendChild(attachmentList);
  }

  if (message.workObject) {
    renderWorkObjectCard(bubble, message.workObject, options);
  }

  if (Array.isArray(message.workObjects) && message.workObjects.length) {
    for (const workObject of message.workObjects) {
      if (message.workObject?.id === workObject.id) {
        continue;
      }
      renderWorkObjectCard(bubble, workObject, options);
    }
  }

  wrapper.append(meta, bubble);
  return wrapper;
}
