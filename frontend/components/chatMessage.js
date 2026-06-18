function isBulletBlock(lines = []) {
  return lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));
}

function isNumberedBlock(lines = []) {
  return lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line));
}

function createTextFragment(text = "") {
  const fragment = document.createDocumentFragment();
  const pattern =
    /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|\*([^*\n]+)\*)/g;
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
    } else if (match[6]) {
      const deleted = document.createElement("del");
      deleted.textContent = match[6];
      fragment.appendChild(deleted);
    } else if (match[7]) {
      const emphasis = document.createElement("em");
      emphasis.textContent = match[7];
      fragment.appendChild(emphasis);
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

async function copyText(text = "") {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(String(text || ""));
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = String(text || "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
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

function isTableDivider(line = "") {
  const cells = String(line)
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function splitTableRow(line = "") {
  return String(line)
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(bubble, lines = []) {
  const wrapper = document.createElement("div");
  wrapper.className = "message-table-wrap";
  const table = document.createElement("table");
  const [headerLine, , ...bodyLines] = lines;
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  splitTableRow(headerLine).forEach((cell) => {
    const th = document.createElement("th");
    appendInlineContent(th, cell);
    headRow.appendChild(th);
  });
  head.appendChild(headRow);
  table.appendChild(head);

  if (bodyLines.length) {
    const body = document.createElement("tbody");
    bodyLines.forEach((line) => {
      const row = document.createElement("tr");
      splitTableRow(line).forEach((cell) => {
        const td = document.createElement("td");
        appendInlineContent(td, cell);
        row.appendChild(td);
      });
      body.appendChild(row);
    });
    table.appendChild(body);
  }

  wrapper.appendChild(table);
  bubble.appendChild(wrapper);
}

function renderCodeBlock(bubble, code = "", language = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "message-code-block";
  const header = document.createElement("div");
  const label = document.createElement("span");
  label.textContent = language || "code";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Copier";
  copyButton.addEventListener("click", () => {
    copyText(code)
      .then(() => {
        copyButton.textContent = "Copie";
        window.setTimeout(() => {
          copyButton.textContent = "Copier";
        }, 1200);
      })
      .catch(() => {});
  });
  header.append(label, copyButton);
  const pre = document.createElement("pre");
  const codeNode = document.createElement("code");
  codeNode.textContent = code;
  if (language) {
    codeNode.dataset.language = language;
  }
  pre.appendChild(codeNode);
  wrapper.append(header, pre);
  bubble.appendChild(wrapper);
}

function renderMarkdownMessage(bubble, content = "") {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```([\w+-]*)\s*$/);
    if (fence) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      renderCodeBlock(bubble, codeLines.join("\n"), fence[1] || "");
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const node = document.createElement(`h${heading[1].length}`);
      appendInlineContent(node, heading[2]);
      bubble.appendChild(node);
      index += 1;
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
      bubble.appendChild(document.createElement("hr"));
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = document.createElement("blockquote");
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      renderParagraphWithLineBreaks(quote, quoteLines.join("\n"));
      bubble.appendChild(quote);
      continue;
    }

    if (
      index + 1 < lines.length &&
      line.includes("|") &&
      isTableDivider(lines[index + 1])
    ) {
      const tableLines = [line, lines[index + 1]];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        tableLines.push(lines[index]);
        index += 1;
      }
      renderTable(bubble, tableLines);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const listLines = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        listLines.push(lines[index]);
        index += 1;
      }
      renderList(bubble, listLines, false);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const listLines = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        listLines.push(lines[index]);
        index += 1;
      }
      renderList(bubble, listLines, true);
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index]) &&
      !/^\s*(?:---+|\*\*\*+)\s*$/.test(lines[index]) &&
      !(
        index + 1 < lines.length &&
        lines[index].includes("|") &&
        isTableDivider(lines[index + 1])
      )
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    renderParagraphWithLineBreaks(bubble, paragraphLines.join("\n"));
  }
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
  if (!String(content || "").trim()) {
    const paragraph = document.createElement("p");
    paragraph.textContent = "";
    bubble.appendChild(paragraph);
    return;
  }
  renderMarkdownMessage(bubble, content);
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
  wrapper.className = `message ${message.role}${message.pending ? " is-pending" : ""}${
    message.status && message.status !== "complete" ? ` is-${message.status}` : ""
  }`;

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

  if (Array.isArray(message.citations) && message.citations.length) {
    const citations = document.createElement("div");
    citations.className = "message-citations";
    message.citations.forEach((citation, index) => {
      const source = document.createElement("button");
      source.type = "button";
      source.textContent = `[${index + 1}] ${citation.label || citation.name || "Source"}${
        citation.locator || citation.section ? ` · ${citation.locator || citation.section}` : ""
      }`;
      source.title = citation.excerpt || citation.section || "";
      source.addEventListener("click", () => {
        if (citation.excerpt) {
          window.alert(
            [citation.label || citation.name, citation.section || citation.locator, citation.excerpt]
              .filter(Boolean)
              .join("\n\n")
          );
        }
      });
      citations.appendChild(source);
    });
    bubble.appendChild(citations);
  }

  if (message.status === "failed" || message.error) {
    const error = document.createElement("p");
    error.className = "message-generation-error";
    error.textContent = message.error || "La génération a échoué. Vous pouvez la relancer.";
    bubble.appendChild(error);
  }

  if (message.streaming) {
    const cursor = document.createElement("span");
    cursor.className = "message-streaming-cursor";
    bubble.appendChild(cursor);
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

  if (options.showActions && !message.pending) {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copier";
    copyButton.addEventListener("click", () => {
      copyText(String(message.content || ""))
        .then(() => {
          copyButton.textContent = "Copie";
          window.setTimeout(() => {
            copyButton.textContent = "Copier";
          }, 1200);
        })
        .catch(() => {});
    });
    actions.appendChild(copyButton);

    if (message.role === "user" && options.onEditMessage) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Modifier";
      editButton.addEventListener("click", () => {
        Promise.resolve(options.onEditMessage(message)).catch(() => {});
      });
      actions.appendChild(editButton);
    }

    if (
      ["assistant", "tool"].includes(message.role) &&
      options.onRegenerateMessage
    ) {
      const regenerateButton = document.createElement("button");
      regenerateButton.type = "button";
      regenerateButton.textContent = "Regenerer";
      regenerateButton.addEventListener("click", () => options.onRegenerateMessage(message));
      actions.appendChild(regenerateButton);
    }

    wrapper.appendChild(actions);
  }
  return wrapper;
}
