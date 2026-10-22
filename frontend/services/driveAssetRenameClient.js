// Rename only native Drive assets, without changing binary versions.
const ROOTS = Object.freeze({
  pdf: "/api/drive/pdf-assets",
  image: "/api/drive/image-assets",
  design: "/api/drive/design-assets",
  "photo-project": "/api/drive/photo-projects"
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function renameNativeDriveAsset(family, item, filename) {
  if (!Object.hasOwn(ROOTS, family) || !UUID.test(String(item?.id || ""))) {
    throw Error("Fichier Hydria Drive inconnu.");
  }
  const original = String(item.filename || "");
  if (!Number.isSafeInteger(Number(item.revision)) || Number(item.revision) < 1 ||
      !original || typeof filename !== "string" || !filename.trim()) {
    throw Error("Métadonnées de fichier invalides.");
  }
  const response = await fetch(ROOTS[family] + "/" + encodeURIComponent(item.id) + "/metadata", {
    method: "PATCH", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: filename.trim(), expectedFilename: original,
      expectedRevision: Number(item.revision)
    })
  });
  if (!response.ok) {
    let message = "";
    try { message = (await response.json()).error || ""; } catch {}
    throw Error(message || "Impossible de renommer ce fichier (HTTP " + response.status + ").");
  }
  const value = await response.json();
  if (value.id !== item.id || !value.filename) {
    throw Error("Réponse de renommage Drive invalide.");
  }
  return value;
}
