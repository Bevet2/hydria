// Private same-origin storage inventory. No filesystem paths or binary access.
export async function fetchNativeDriveUsage() {
  const res=await fetch("/api/drive/usage",{
    credentials:"same-origin",cache:"no-store"
  });
  if (!res.ok) throw Error("Bilan de stockage indisponible (HTTP "+res.status+").");
  const data=await res.json();
  if (data.scope!=="sqlite-indexed-file-bytes" ||
      !Array.isArray(data.families) || typeof data.total?.storedBytes!=="number") {
    throw Error("Données de stockage Drive invalides.");
  }
  return data;
}
