// Native PhotoCraft file library. No invented iframe bridge: the web build
// downloads/saves .pcraft and the user explicitly imports it into Hydria.
const API = "/api/drive/photo-projects";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PHOTO_PROJECT_LIMIT_BYTES = 30 * 1024 * 1024;
function requireId(id) {
  if (!ID.test(String(id || ""))) throw Error("Identifiant PhotoCraft invalide");
  return String(id);
}
async function requireOk(res) {
  if (res.ok) return res;
  let detail = "";
  try { detail = (await res.json()).error || ""; } catch { /* response is not JSON */ }
  throw Error(detail || "Erreur de sauvegarde PhotoCraft (HTTP " + res.status + ")");
}
export function photoProjectFileUrl(id, revision = null) {
  const target = API + "/" + encodeURIComponent(requireId(id));
  if (revision === null) return target + "/download";
  if (!Number.isSafeInteger(Number(revision)) || Number(revision) < 1 || Number(revision) > 50) {
    throw Error("Version PhotoCraft invalide");
  }
  return target + "/versions/" + Number(revision) + "/download";
}
export async function listPhotoProjects({ trashed = false } = {}) {
  const response = await requireOk(await fetch(API + (trashed ? "?trashed=1" : ""), { credentials: "same-origin", cache: "no-store" }));
  const value = await response.json();
  if (!Array.isArray(value.items)) throw Error("Réponse Drive PhotoCraft invalide");
  return value.items;
}
export async function listPhotoProjectVersions(id) {
  const response = await requireOk(await fetch(API + "/" + encodeURIComponent(requireId(id)) +
    "/versions", { credentials: "same-origin", cache: "no-store" }));
  const value = await response.json();
  if (!Array.isArray(value.items)) throw Error("Historique PhotoCraft invalide");
  return value;
}
export async function storePhotoProject(file, { id = null, expectedRevision = null } = {}) {
  if (!(file instanceof Blob) || file.size < 32 || file.size > PHOTO_PROJECT_LIMIT_BYTES) {
    throw Error("Le fichier PhotoCraft doit faire entre 32 octets et 30 Mio.");
  }
  const name = String(file.name || "photoProject.pcraft");
  if (!/\.(pcraft|psd|psb)$/i.test(name)) {
    throw Error("Sélectionnez un projet .pcraft ou un document Photoshop .psd/.psb.");
  }
  // Shallow upfront signature check. The server separately validates the
  // native ZIP manifest or Photoshop PSD/PSB header and byte-size limits.
  const prefix = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const signature = String.fromCharCode(...prefix);
  const zip = name.toLowerCase().endsWith(".pcraft");
  if (zip ? signature !== "PK\x03\x04" : signature !== "8BPS") {
    throw Error("Le fichier sélectionné ne correspond pas au format annoncé.");
  }
  const form = new FormData();
  form.append("file", file, name);
  let url = API;
  if (id !== null) {
    url += "/" + encodeURIComponent(requireId(id)) + "/versions";
    if (!Number.isSafeInteger(Number(expectedRevision)) ||
        Number(expectedRevision) < 1 || Number(expectedRevision) >= 50) {
      throw Error("Numéro de version PhotoCraft invalide");
    }
    form.append("expectedRevision", String(expectedRevision));
  }
  const res = await requireOk(await fetch(url, {
    method: "POST", body: form, credentials: "same-origin"
  }));
  return res.json();
}
