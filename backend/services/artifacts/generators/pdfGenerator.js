import PDFDocument from "pdfkit";

function writeMarkdownToPdf(doc, markdown) {
  const lines = String(markdown || "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      doc.moveDown(0.5);
      continue;
    }

    if (line.startsWith("# ")) {
      doc.font("Helvetica-Bold").fontSize(20).text(line.slice(2));
      doc.moveDown(0.4);
      continue;
    }

    if (line.startsWith("## ")) {
      doc.font("Helvetica-Bold").fontSize(16).text(line.slice(3));
      doc.moveDown(0.3);
      continue;
    }

    if (line.startsWith("### ")) {
      doc.font("Helvetica-Bold").fontSize(13).text(line.slice(4));
      doc.moveDown(0.2);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      doc.font("Helvetica").fontSize(11).text(`• ${line.replace(/^\s*[-*]\s+/, "")}`, {
        indent: 14
      });
      continue;
    }

    doc.font("Helvetica").fontSize(11).text(line, {
      lineGap: 2
    });
  }
}

export async function renderPdfArtifact({ title, markdown }) {
  const doc = new PDFDocument({
    margin: 56,
    size: "A4"
  });
  const chunks = [];

  const buffer = await new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.info.Title = title || "Hydria Document";
    doc.font("Helvetica-Bold").fontSize(24).text(title || "Hydria Document");
    doc.moveDown(0.8);
    writeMarkdownToPdf(doc, markdown);
    doc.end();
  });

  return {
    buffer,
    extension: "pdf",
    mimeType: "application/pdf"
  };
}
