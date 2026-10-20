// First-party Hydria Drive PDF API client. All requests stay on the OS origin.
// PdfCraft exports are stored only after an explicit workbench save action.
const PDF_API = "/api/drive/pdf-assets";
export const DRIVE_PDF_MAX_BYTES = 20 * 1024 * 1024;

async function expectOk(response) {
  if (response.ok) return response;
  let details = "";
  try { details = (await response.json()).error || ""; } catch { /* non-JSON error */ }
  throw Error(details || "Erreur Drive PDF (HTTP " + response.status + ")");
}

export function storedPdfUrl(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""))) {
    throw Error("Invalid stored PDF identifier");
  }
  return PDF_API + "/" + encodeURIComponent(id) + "/download";
}

export async function listDrivePdfs() {
  const response = await expectOk(await fetch(PDF_API, {
    credentials: "same-origin", cache: "no-store"
  }));
  const payload = await response.json();
  if (!Array.isArray(payload.items)) throw Error("Invalid Drive PDF response");
  return payload.items;
}

export async function savePdfToDrive(blob, name = "document.pdf") {
  if (!(blob instanceof Blob) || blob.size < 14 || blob.size > DRIVE_PDF_MAX_BYTES) {
    throw Error("Le PDF doit être compris entre 14 octets et 20 Mio.");
  }
  const bytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...bytes) !== "%PDF-") throw Error("Le fichier sélectionné n'est pas un PDF.");
  const form = new FormData();
  form.append("file", blob, String(name || "document.pdf"));
  const response = await expectOk(await fetch(PDF_API, {
    method: "POST", body: form, credentials: "same-origin"
  }));
  return response.json();
}

export async function readDrivePdfMetadata(id) {
  const response = await expectOk(await fetch(storedPdfUrl(id).replace(/\/download$/, ""), {
    credentials: "same-origin", cache: "no-store"
  }));
  return response.json();
}
export async function readDrivePdf(id, revision = null) {
  const response = await expectOk(await fetch(revision === null ? storedPdfUrl(id) : pdfRevisionUrl(id, revision), {
    credentials: "same-origin", cache: "no-store"
  }));
  const blob = await response.blob();
  if (blob.type !== "application/pdf" || !blob.size) throw Error("Invalid PDF response");
  return blob;
}

export function pdfRevisionUrl(id, revision) {
  const url = storedPdfUrl(id).replace(/\/download$/, "");
  if (!Number.isInteger(revision) || revision < 1 || revision > 50) throw Error("Invalid PDF revision");
  return url + "/versions/" + revision + "/download";
}
export async function listPdfVersions(id) {
  const response = await expectOk(await fetch(storedPdfUrl(id).replace(/\/download$/, "/versions"), {
    credentials: "same-origin", cache: "no-store"
  }));
  const value = await response.json();
  if (!Array.isArray(value.items)) throw Error("Invalid PDF version response");
  return value;
}
export async function savePdfVersion(blob, name, id, expectedRevision) {
  const url = pdfRevisionUrl(id, expectedRevision).replace(/\/\d+\/download$/, "");
  if (!(blob instanceof Blob) || blob.size < 14 || blob.size > DRIVE_PDF_MAX_BYTES) {
    throw Error("Le PDF doit être compris entre 14 octets et 20 Mio.");
  }
  const form = new FormData();
  form.append("file", blob, String(name || "document.pdf"));
  form.append("expectedRevision", String(expectedRevision));
  const response = await expectOk(await fetch(url, {
    method: "POST", body: form, credentials: "same-origin"
  }));
  return response.json();
}
