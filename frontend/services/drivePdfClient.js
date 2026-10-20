// First-party Hydria Drive PDF API client. All requests stay on the OS origin.
// PdfCraft itself has no direct authenticated write-back; users explicitly upload
// their exported/edited PDF file using the workbench controls.
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

export async function readDrivePdf(id) {
  const response = await expectOk(await fetch(storedPdfUrl(id), {
    credentials: "same-origin", cache: "no-store"
  }));
  const blob = await response.blob();
  if (blob.type !== "application/pdf" || !blob.size) throw Error("Invalid PDF response");
  return blob;
}
