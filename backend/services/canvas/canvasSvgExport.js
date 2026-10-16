// SVG export for Hydria OS Canvas. All attributes are authored by this module;
// labels are XML-escaped and external/active SVG media are never embedded.
const esc = (value) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");
const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(6000, n)) : fallback;
};
const color = (value, fallback = "#f4d35e") =>
  /^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(String(value)) ? String(value) : fallback;
const shorten = (value, length = 100) =>
  String(value ?? "").replace(/\s+/g, " ").trim().slice(0, length);
function shapeSvg(item, x, y, w, h) {
  const type = String(item.shape || "rect");
  const fill = color(item.color);
  const base = `fill="${fill}" stroke="#9ca3af" stroke-width="2"`;
  const cx = x + w / 2, cy = y + h / 2;
  if (type === "circle") return `<ellipse cx="${cx}" cy="${cy}" rx="${w/2}" ry="${h/2}" ${base}/>`;
  const polygons = {
    triangle: [[cx,y],[x+w,y+h],[x,y+h]],
    diamond: [[cx,y],[x+w,cy],[cx,y+h],[x,cy]],
    hexagon: [[x+w*.25,y],[x+w*.75,y],[x+w,cy],[x+w*.75,y+h],[x+w*.25,y+h],[x,cy]],
    parallelogram: [[x+w*.16,y],[x+w,y],[x+w*.84,y+h],[x,y+h]]
  };
  if (polygons[type]) {
    return `<polygon points="${polygons[type].map(([a,b])=>a+","+b).join(" ")}" ${base}/>`;
  }
  const radius = type === "pill" ? h/2 : type === "rounded" ? 20 : 0;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ${base}/>`;
}
function safeImageHref(value) {
  const src = String(value || "");
  return src.length <= 2_000_000 &&
    /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(src) ? src : "";
}
export function renderCanvasSvg({ title = "Hydria Canvas", boardWidth = 1800, boardHeight = 1200, elements = [], links = [] } = {}) {
  const width = Math.max(320, num(boardWidth, 1800)), height = Math.max(240, num(boardHeight, 1200));
  const valid = (Array.isArray(elements) ? elements : []).slice(0, 500);
  const byId = new Map(valid.map((item) => [String(item.id), item]));
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">`,
    `<title>${esc(shorten(title, 200))}</title>`,
    '<defs><pattern id="hydria-grid" width="52" height="52" patternUnits="userSpaceOnUse"><path d="M52 0H0V52" fill="none" stroke="#e9edf2" stroke-width="1"/></pattern><marker id="hydria-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0 0L9 3L0 6Z" fill="#6b7280"/></marker></defs>',
    `<rect width="${width}" height="${height}" fill="#ffffff"/><rect width="${width}" height="${height}" fill="url(#hydria-grid)"/>`
  ];
  (Array.isArray(links) ? links : []).slice(0, 1000).forEach((link) => {
    const a = byId.get(String(link.from)), b = byId.get(String(link.to));
    if (!a || !b) return;
    const x1 = num(a.x)+num(a.width)/2, y1 = num(a.y)+num(a.height)/2;
    const x2 = num(b.x)+num(b.width)/2, y2 = num(b.y)+num(b.height)/2;
    const span = Math.max(40, Math.min(180, Math.abs(x2-x1)/2));
    parts.push(`<path d="M${x1} ${y1} C${x1+span} ${y1},${x2-span} ${y2},${x2} ${y2}" fill="none" stroke="${color(link.color, "#6b7280")}" stroke-width="3" marker-end="url(#hydria-arrow)"/>`);
    if (link.label) parts.push(`<text x="${(x1+x2)/2}" y="${(y1+y2)/2-8}" text-anchor="middle" font-family="Arial,sans-serif" font-size="19" fill="#374151">${esc(shorten(link.label, 120))}</text>`);
  });
  valid.forEach((item) => {
    const x = num(item.x), y = num(item.y), w = Math.max(80, num(item.width, 280)), h = Math.max(60, num(item.height, 160));
    const kind = String(item.type || "note");
    const fill = color(item.color, "#f6d365"), ink = color(item.textColor, "#1f2937");
    parts.push('<g>');
    if (kind === "shape") {
      parts.push(shapeSvg(item,x,y,w,h));
    } else {
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="#d1d5db" stroke-width="2"/>`);
      if (kind === "image" || kind === "video") {
        const src = safeImageHref(kind === "video" ? item.poster : item.src);
        if (src) parts.push(`<image x="${x+10}" y="${y+10}" width="${Math.max(16,w-20)}" height="${Math.max(16,h*.62)}" preserveAspectRatio="xMidYMid meet" href="${esc(src)}"/>`);
      }
    }
    const titleY = kind === "image" || kind === "video" ? y+h*.76 : y+35;
    parts.push(`<text x="${x+15}" y="${titleY}" font-family="Arial,sans-serif" font-size="23" font-weight="bold" fill="${ink}">${esc(shorten(item.title, 90))}</text>`);
    if (item.body && kind !== "shape") parts.push(`<text x="${x+15}" y="${Math.min(y+h-12,titleY+29)}" font-family="Arial,sans-serif" font-size="16" fill="${ink}">${esc(shorten(item.body, 120))}</text>`);
    parts.push('</g>');
  });
  parts.push('</svg>');
  return parts.join("\n");
}
