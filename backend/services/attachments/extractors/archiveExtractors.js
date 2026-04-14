import AdmZip from "adm-zip";
import { isTextLikeArchiveEntry } from "./kinds.js";
import { extname, normalizeWhitespace, truncateText } from "./shared.js";

function safeUtf8Preview(buffer) {
  const preview = buffer.toString("utf8");
  const suspiciousBinaryChars = (preview.match(/\uFFFD/g) || []).length;

  if (suspiciousBinaryChars > 3) {
    return "";
  }

  return normalizeWhitespace(preview);
}

function inspectZipEntries(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  const sections = [];

  const entrySummary = entries.slice(0, 25).map((entry) => {
    const size = entry.header.size;
    return `${entry.entryName} (${size} B)`;
  });

  if (entrySummary.length) {
    sections.push({
      title: "Archive entries",
      content: entrySummary.join("\n")
    });
  }

  const previewableEntries = entries
    .filter((entry) => isTextLikeArchiveEntry(entry.entryName) && entry.header.size <= 32768)
    .slice(0, 3);

  for (const entry of previewableEntries) {
    const preview = safeUtf8Preview(entry.getData());
    if (!preview) {
      continue;
    }

    sections.push({
      title: `Preview ${entry.entryName}`,
      content: truncateText(preview, 1800)
    });
  }

  return {
    text: sections.map((section) => `${section.title}\n${section.content}`).join("\n\n"),
    sections,
    parser: "zip-inspector"
  };
}

export async function extractArchiveContent(file) {
  const extension = extname(file.originalname);

  if (extension === ".zip") {
    return inspectZipEntries(file.buffer);
  }

  return {
    text: "",
    parser: "metadata-only"
  };
}
