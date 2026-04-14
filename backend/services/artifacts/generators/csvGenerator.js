import { buildContentRows } from "./shared.js";
import { parseMarkdownDocument } from "./shared.js";

function escapeCsvCell(value = "") {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

export async function renderCsvArtifact({ title, markdown }) {
  const raw = String(markdown || "").trim();
  if (
    /\n/.test(raw) &&
    raw
      .split("\n")
      .slice(0, 5)
      .every((line) => line.includes(","))
  ) {
    return {
      buffer: Buffer.from(raw, "utf8"),
      extension: "csv",
      mimeType: "text/csv; charset=utf-8"
    };
  }

  const documentModel = parseMarkdownDocument(markdown, title);
  const rows = buildContentRows(documentModel);
  const header = ["order", "section", "kind", "content"];
  const csvRows = [
    header.join(","),
    ...rows.map((row) =>
      [row.order, row.section, row.kind, row.content].map(escapeCsvCell).join(",")
    )
  ];

  return {
    buffer: Buffer.from(csvRows.join("\n"), "utf8"),
    extension: "csv",
    mimeType: "text/csv; charset=utf-8"
  };
}
