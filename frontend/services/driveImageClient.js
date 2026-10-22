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
export async function listDriveImages({ trashed = false } = {}) {
  const r = await responseOrThrow(await fetch(IMAGE_API + (trashed ? "?trashed=1" : ""), { credentials:"same-origin", cache:"no-store" }));
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


// Immutable history and optimistic revision updates.
export function imageRevisionDownloadUrl(id, revision) {
  if (!ID.test(String(id || ""))) throw Error("Invalid image asset id");
  if (!Number.isSafeInteger(Number(revision)) || Number(revision) < 1 || Number(revision) > 50) {
    throw Error("Invalid image revision");
  }
  return IMAGE_API + "/" + encodeURIComponent(id) + "/versions/" + encodeURIComponent(revision) + "/download";
}
export async function listImageVersions(id) {
  if (!ID.test(String(id || ""))) throw Error("Invalid image asset id");
  const response = await responseOrThrow(await fetch(
    IMAGE_API + "/" + encodeURIComponent(id) + "/versions",
    { credentials: "same-origin", cache: "no-store" }
  ));
  const value = await response.json();
  if (!Array.isArray(value.items)) throw Error("Invalid image version response");
  return value;
}
export async function saveImageVersion(file, id, expectedRevision) {
  if (!ID.test(String(id || ""))) throw Error("Invalid image asset id");
  if (!Number.isSafeInteger(Number(expectedRevision)) ||
      Number(expectedRevision) < 1 || Number(expectedRevision) >= 50) {
    throw Error("Invalid image revision");
  }
  if (!(file instanceof Blob) || !file.size || file.size > IMAGE_LIMIT_BYTES) {
    throw Error("L'image doit être inférieure à 15 Mio.");
  }
  const form = new FormData();
  form.append("file", file, file.name || "image.png");
  form.append("expectedRevision", String(expectedRevision));
  const response = await responseOrThrow(await fetch(
    IMAGE_API + "/" + encodeURIComponent(id) + "/versions",
    { method: "POST", body: form, credentials: "same-origin" }
  ));
  return response.json();
}
