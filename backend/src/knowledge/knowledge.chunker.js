function normalizeText(value = "") {
  return String(value || "").replace(/\r/g, "").trim();
}

function splitMarkdown(text = "") {
  const sections = [];
  let currentTitle = "Document";
  let buffer = [];

  for (const line of normalizeText(text).split("\n")) {
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    if (heading) {
      if (buffer.length) {
        sections.push({
          title: currentTitle,
          text: buffer.join("\n").trim()
        });
      }
      currentTitle = heading[2].trim();
      buffer = [];
      continue;
    }

    buffer.push(line);
  }

  if (buffer.length) {
    sections.push({
      title: currentTitle,
      text: buffer.join("\n").trim()
    });
  }

  return sections.filter((section) => section.text);
}

function splitCode(text = "") {
  const lines = normalizeText(text).split("\n");
  const sections = [];
  let currentTitle = "Code";
  let buffer = [];

  for (const line of lines) {
    const marker = line.match(
      /^\s*(export\s+)?(async\s+)?(function|class|const|let|var)\s+([A-Za-z0-9_$]+)/i
    );

    if (marker) {
      if (buffer.length) {
        sections.push({
          title: currentTitle,
          text: buffer.join("\n").trim()
        });
      }
      currentTitle = `${marker[3]} ${marker[4]}`;
      buffer = [line];
      continue;
    }

    buffer.push(line);
  }

  if (buffer.length) {
    sections.push({
      title: currentTitle,
      text: buffer.join("\n").trim()
    });
  }

  return sections.filter((section) => section.text);
}

function splitJson(text = "") {
  try {
    const parsed = JSON.parse(text);
    return Object.entries(parsed).map(([key, value]) => ({
      title: key,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
    }));
  } catch {
    return [
      {
        title: "JSON",
        text
      }
    ];
  }
}

function splitPlainText(text = "") {
  return normalizeText(text)
    .split(/\n{2,}/)
    .map((part, index) => ({
      title: `Section ${index + 1}`,
      text: part.trim()
    }))
    .filter((part) => part.text);
}

function sliceWithOverlap(text = "", chunkSize = 900, overlap = 140) {
  const clean = normalizeText(text);
  if (clean.length <= chunkSize) {
    return [clean];
  }

  const chunks = [];
  let index = 0;

  while (index < clean.length) {
    const slice = clean.slice(index, index + chunkSize).trim();
    if (slice) {
      chunks.push(slice);
    }

    if (index + chunkSize >= clean.length) {
      break;
    }

    index += Math.max(1, chunkSize - overlap);
  }

  return chunks;
}

export function chunkKnowledgeEntry(entry, options = {}) {
  const chunkSize = options.chunkSize || 900;
  const overlap = options.chunkOverlap || 140;
  const maxChunksPerDocument = options.maxChunksPerDocument || 24;
  const kind = entry.kind || "text";
  const content = entry.text || "";

  let sections;
  if (kind === "code" || kind === "config") {
    sections = splitCode(content);
  } else if (kind === "data" || /\.json$/i.test(entry.filename || "")) {
    sections = splitJson(content);
  } else if (/\.md$/i.test(entry.filename || "")) {
    sections = splitMarkdown(content);
  } else {
    sections = splitPlainText(content);
  }

  const chunks = [];

  for (const section of sections) {
    for (const [index, text] of sliceWithOverlap(section.text, chunkSize, overlap).entries()) {
      chunks.push({
        ...entry,
        sectionTitle: section.title || entry.sectionTitle || "Section",
        text,
        excerpt: text.slice(0, 320),
        chunkLabel: `${section.title || entry.sectionTitle || "Section"}#${index + 1}`
      });

      if (chunks.length >= maxChunksPerDocument) {
        return chunks;
      }
    }
  }

  return chunks.slice(0, maxChunksPerDocument);
}

export default {
  chunkKnowledgeEntry
};
