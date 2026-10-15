import assert from "node:assert/strict";
import AdmZip from "adm-zip";
const baseUrl = process.env.HYDRIA_VISUAL_BASE_URL || "http://127.0.0.1:3001";

async function exportFile(path, body, contentType) {
  const response = await fetch(baseUrl + path, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(path + " responded " + response.status + ": " + (await response.text()).slice(0, 500));
  assert.match(response.headers.get("content-type") || "", contentType, path + " content type");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length > 200, path + " should not be an empty file");
  return bytes;
}
function officeZip(bytes, entry) {
  assert.equal(bytes.subarray(0, 2).toString("utf8"), "PK", "Office exports must be ZIP packages");
  const zip = new AdmZip(bytes);
  const file = zip.getEntry(entry);
  assert.ok(file, "Missing Office package part: " + entry);
  return { contents: zip.readAsText(file), entries: zip.getEntries().length };
}
const documentHtml = "<h1>Hydria Docs</h1><p>Export regression test</p><table><tr><th>Item</th><th>Amount</th></tr><tr><td>Revenue</td><td>42</td></tr></table>";
const docx = await exportFile("/api/docs/export-docx", { title: "Hydria export test", html: documentHtml }, /wordprocessingml\.document/);
const docXml = officeZip(docx, "word/document.xml");
assert.match(docXml.contents, /Export regression test/);
assert.match(docXml.contents, /Revenue/);
const docsPdf = await exportFile("/api/docs/export-pdf", { title: "Hydria export test", html: documentHtml }, /application\/pdf/);
assert.equal(docsPdf.subarray(0, 4).toString("utf8"), "%PDF");
const model = {
  kind: "hydria-sheet", activeSheetId: "sheet-1",
  sheets: [{ id: "sheet-1", name: "Sales Report", columns: ["City", "Amount"], rows: [["Paris", 42], ["Lyon", 25]], charts: [] }]
};
const xlsx = await exportFile("/api/sheets/export-xlsx", { filename: "hydria-test.xlsx", model }, /spreadsheetml\.sheet/);
const book = officeZip(xlsx, "xl/workbook.xml");
assert.match(book.contents, /Sales Report/);
assert.ok(book.entries >= 5, "XLSX should contain multiple workbook parts");

const roundtripData = new FormData();
roundtripData.append("workbook", new Blob([xlsx], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "hydria-roundtrip.xlsx");
const importedResponse = await fetch(baseUrl + "/api/sheets/import-xlsx", { method: "POST", body: roundtripData });
if (!importedResponse.ok) throw new Error("XLSX roundtrip import failed: " + importedResponse.status + " " + (await importedResponse.text()).slice(0, 400));
const imported = await importedResponse.json();
assert.equal(imported.success, true);
assert.ok(imported.model?.sheets?.some(sheet => sheet.name === "Sales Report"), "XLSX roundtrip should preserve sheet names");
assert.ok(JSON.stringify(imported.model).includes("Paris"), "XLSX roundtrip should preserve data values");

const sheetPdf = await exportFile("/api/sheets/export-pdf", { filename: "hydria-test.pdf", model }, /application\/pdf/);
assert.equal(sheetPdf.subarray(0, 4).toString("utf8"), "%PDF");
const pptx = await exportFile("/api/work-objects/export-smoke/presentation-export", {
  title: "Hydria Slides",
  markdown: "# Hydria Slides\n\n## Introduction\n\nPresentation export regression\n\n## Analysis\n\nSecond slide"
}, /presentationml\.presentation/);
const slidesZip = new AdmZip(pptx);
const slideEntries = slidesZip.getEntries().filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName));
assert.ok(slideEntries.length >= 1, "PowerPoint should contain at least one slide");
assert.ok(slideEntries.some(e => slidesZip.readAsText(e).includes("Presentation export regression")), "PowerPoint should preserve slide text");
console.log(JSON.stringify({
  success: true,
  exports: ["DOCX", "Docs PDF", "XLSX", "XLSX import roundtrip", "Sheets PDF", "PPTX"],
  docxBytes: docx.length,
  docsPdfBytes: docsPdf.length,
  xlsxBytes: xlsx.length,
  sheetsPdfBytes: sheetPdf.length,
  pptxBytes: pptx.length,
  slides: slideEntries.length
}, null, 2));
