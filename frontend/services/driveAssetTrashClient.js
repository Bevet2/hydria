// Private single-owner Drive trash and restore API client.
// Operations are optimistic: a stale filename or revision returns HTTP 409.
const ROOTS = Object.freeze({
  pdf:"/api/drive/pdf-assets",
  image:"/api/drive/image-assets",
  design:"/api/drive/design-assets",
  "photo-project":"/api/drive/photo-projects"
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function changeNativeDriveTrash(family, asset, operation) {
  if (!Object.hasOwn(ROOTS, family) || !["trash", "restore"].includes(operation) ||
      !UUID.test(String(asset?.id || ""))) {
    throw Error("Fichier Drive inconnu.");
  }
  const expectedRevision = Number(asset?.revision);
  const expectedFilename = String(asset?.filename || "");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
      expectedRevision > 50 || !expectedFilename) {
    throw Error("Métadonnées Drive invalides.");
  }
  const url = ROOTS[family] + "/" + encodeURIComponent(asset.id) + "/" + operation;
  const res = await fetch(url,{
    method:"POST", credentials:"same-origin", cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({expectedRevision,expectedFilename})
  });
  if (!res.ok) {
    let message="";
    try { message=(await res.json()).error||""; } catch {}
    throw Error(message||"Impossible de modifier la corbeille (HTTP "+res.status+").");
  }
  const data=await res.json();
  if (data.id!==asset.id || Boolean(data.deleted_at)!==(operation==="trash")) {
    throw Error("Réponse Drive invalide.");
  }
  return data;
}
