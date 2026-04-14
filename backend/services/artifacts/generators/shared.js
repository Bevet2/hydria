export function slugifyFilename(value, fallback = "hydria-document") {
  const slug = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || fallback;
}

export function stripMarkdown(markdown = "") {
  return String(markdown || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripInlineMarkdown(value = "") {
  return String(value || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function parseMarkdownDocument(markdown = "", titleFallback = "Hydria Document") {
  const lines = String(markdown || "").split(/\r?\n/);
  const documentModel = {
    title: titleFallback,
    sections: []
  };

  let currentSection = null;
  let paragraphBuffer = [];

  function ensureSection(defaultHeading = "Overview") {
    if (!currentSection) {
      currentSection = {
        heading: defaultHeading,
        paragraphs: [],
        bullets: []
      };
      documentModel.sections.push(currentSection);
    }

    return currentSection;
  }

  function flushParagraph() {
    const paragraph = stripInlineMarkdown(paragraphBuffer.join(" ").trim());
    paragraphBuffer = [];

    if (!paragraph) {
      return;
    }

    ensureSection().paragraphs.push(paragraph);
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (/^#\s+/.test(line)) {
      flushParagraph();
      const title = stripInlineMarkdown(line.replace(/^#\s+/, ""));
      if (title) {
        documentModel.title = title;
      }
      continue;
    }

    if (/^##+\s+/.test(line)) {
      flushParagraph();
      currentSection = {
        heading: stripInlineMarkdown(line.replace(/^##+\s+/, "")) || "Section",
        paragraphs: [],
        bullets: []
      };
      documentModel.sections.push(currentSection);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      ensureSection().bullets.push(stripInlineMarkdown(line.replace(/^\s*[-*+]\s+/, "")));
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();

  if (!documentModel.sections.length) {
    documentModel.sections.push({
      heading: "Overview",
      paragraphs: stripMarkdown(markdown)
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
      bullets: []
    });
  }

  return documentModel;
}

export function buildContentRows(documentModel) {
  const rows = [];

  for (const [sectionIndex, section] of documentModel.sections.entries()) {
    for (const [paragraphIndex, paragraph] of section.paragraphs.entries()) {
      rows.push({
        order: rows.length + 1,
        sectionIndex: sectionIndex + 1,
        itemIndex: paragraphIndex + 1,
        section: section.heading,
        kind: "paragraph",
        content: paragraph
      });
    }

    for (const [bulletIndex, bullet] of section.bullets.entries()) {
      rows.push({
        order: rows.length + 1,
        sectionIndex: sectionIndex + 1,
        itemIndex: bulletIndex + 1,
        section: section.heading,
        kind: "bullet",
        content: bullet
      });
    }
  }

  return rows;
}

export function pickDocumentHighlights(documentModel, maxItems = 5) {
  const highlights = [];

  for (const section of documentModel.sections) {
    for (const bullet of section.bullets) {
      highlights.push(bullet);
      if (highlights.length >= maxItems) {
        return highlights;
      }
    }

    for (const paragraph of section.paragraphs) {
      highlights.push(paragraph);
      if (highlights.length >= maxItems) {
        return highlights;
      }
    }
  }

  return highlights;
}

export function buildHtmlDocument(markdown = "", titleFallback = "Hydria Document") {
  const documentModel = parseMarkdownDocument(markdown, titleFallback);
  const sectionHtml = documentModel.sections
    .map((section) => {
      const paragraphs = section.paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("\n");
      const bullets = section.bullets.length
        ? `<ul>${section.bullets
            .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
            .join("")}</ul>`
        : "";

      return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${bullets}</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(documentModel.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b1220;
        --panel: #111b2e;
        --text: #e6edf7;
        --muted: #9fb2c8;
        --accent: #d8ad5e;
        --border: #23344f;
      }

      body {
        margin: 0;
        padding: 48px 20px;
        background:
          radial-gradient(circle at top left, rgba(216, 173, 94, 0.16), transparent 34%),
          linear-gradient(180deg, #0b1220 0%, #10192b 100%);
        color: var(--text);
        font-family: "Segoe UI", Arial, sans-serif;
      }

      main {
        max-width: 900px;
        margin: 0 auto;
        background: rgba(17, 27, 46, 0.9);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 40px;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
      }

      h1 {
        margin: 0 0 8px;
        font-size: 2.4rem;
      }

      h2 {
        margin: 28px 0 10px;
        color: var(--accent);
        font-size: 1.18rem;
      }

      p, li {
        color: var(--text);
        line-height: 1.7;
      }

      .meta {
        color: var(--muted);
        font-size: 0.92rem;
      }
    </style>
  </head>
  <body>
    <main>
      <p class="meta">Generated by Hydria</p>
      <h1>${escapeHtml(documentModel.title)}</h1>
      ${sectionHtml}
    </main>
  </body>
</html>`;
}
