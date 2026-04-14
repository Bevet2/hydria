import { escapeHtml, parseMarkdownDocument, pickDocumentHighlights } from "./shared.js";

export async function renderImageArtifact({ title, markdown }) {
  const documentModel = parseMarkdownDocument(markdown, title);
  const highlights = pickDocumentHighlights(documentModel, 5);
  const cards = highlights
    .map((highlight, index) => {
      const y = 250 + index * 92;

      return `<rect x="80" y="${y}" width="1040" height="70" rx="18" fill="rgba(11,18,32,0.62)" stroke="rgba(216,173,94,0.20)" />
<text x="112" y="${y + 43}" fill="#E6EDF7" font-size="28" font-family="Segoe UI, Arial, sans-serif">${escapeHtml(highlight).slice(0, 88)}</text>`;
    })
    .join("\n");

  const sectionLabel = documentModel.sections[0]?.heading || "Hydria";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="${escapeHtml(documentModel.title)}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1220" />
      <stop offset="55%" stop-color="#121D31" />
      <stop offset="100%" stop-color="#0F1728" />
    </linearGradient>
    <radialGradient id="glow" cx="20%" cy="18%" r="50%">
      <stop offset="0%" stop-color="rgba(216,173,94,0.44)" />
      <stop offset="100%" stop-color="rgba(216,173,94,0)" />
    </radialGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)" />
  <circle cx="190" cy="190" r="330" fill="url(#glow)" />
  <rect x="60" y="60" width="1080" height="1080" rx="34" fill="rgba(17,27,46,0.82)" stroke="rgba(35,52,79,0.88)" />
  <text x="90" y="130" fill="#D8AD5E" font-size="26" font-family="Segoe UI, Arial, sans-serif">HYDRIA GENERATED IMAGE</text>
  <text x="90" y="210" fill="#F8FAFC" font-size="56" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${escapeHtml(documentModel.title).slice(0, 58)}</text>
  <text x="92" y="255" fill="#9FB2C8" font-size="24" font-family="Segoe UI, Arial, sans-serif">${escapeHtml(sectionLabel)}</text>
  ${cards}
</svg>`;

  return {
    buffer: Buffer.from(svg, "utf8"),
    extension: "svg",
    mimeType: "image/svg+xml"
  };
}
