// Hydria first-party raster asset API; private owner pilot only.
const IMAGE_API = "/api/drive/image-assets";
export const IMAGE_LIMIT_BYTES = 15 * 1024 * 1024;
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function imageAssetUrl(id, kind = "download") {
  if (!ID.test(String(id || ""))) throw Error("Invalid image asset id");
  if (!["preview", "download"].includes(kind)) throw Error("Invalid image asset action");
  return IMAGE_API + "/" + encodeURIComponent(id) + "/" + kind;
}
async function responseOrThrow(response) {
  if (response.ok) return response;
  let details;
  try { details = (await response.json()).error; } catch { /* response not JSON */ }
  throw Error(details || "Image Drive indisponible (HTTP " + response.status + ")");
}
export async function listDriveImages() {
  const r = await responseOrThrow(await fetch(IMAGE_API, { credentials:"same-origin", cache:"no-store" }));
  const v = await r.json();
  if (!Array.isArray(v.items)) throw Error("Invalid image Drive payload");
  return v.items;
}
export async function saveImageToDrive(file) {
  if (!(file instanceof Blob) || !file.size || file.size > IMAGE_LIMIT_BYTES) {
    throw Error("L'image doit être inférieure à 15 Mio.");
  }
  const form = new FormData();
  form.append("file", file, file.name || "image.png");
  const response = await responseOrThrow(await fetch(IMAGE_API, {
    method:"POST", body:form, credentials:"same-origin"
  }));
  return response.json();
}
