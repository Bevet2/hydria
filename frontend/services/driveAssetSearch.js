// Hydria Drive native files participate in the OS command palette (Ctrl/Cmd+K).
// All list calls use first-party same-origin clients and inherit the private
// access gate. This is filename search, NOT content indexing or tenant ACLs.
import { listDrivePdfs } from "./drivePdfClient.js";
import { listDriveImages } from "./driveImageClient.js";
import { listDesigns } from "./driveDesignClient.js";
import { listPhotoProjects } from "./drivePhotoProjectClient.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAMILIES = Object.freeze({
  pdf: { slug: "pdf", query: "assetId", label: "PDF · Drive" },
  image: { slug: "photo", query: "imageId", label: "Image · Drive" },
  design: { slug: "fig", query: "designId", label: "FigCraft · Drive" },
  "photo-project": { slug: "photo", query: "photoProjectId", label: "PhotoCraft · Drive" }
});
const DEFAULT_LOADERS = Object.freeze({
  pdf: listDrivePdfs,
  image: listDriveImages,
  design: listDesigns,
  "photo-project": listPhotoProjects
});

export function driveAssetWorkspaceUrl(asset) {
  const def = Object.hasOwn(FAMILIES, asset?.assetFamily) ? FAMILIES[asset.assetFamily] : null;
  if (!def || !UUID.test(String(asset?.id || ""))) return null;
  return "/workspace/" + def.slug + "?" + def.query + "=" + encodeURIComponent(asset.id);
}

export function filterDriveAssetSearch(items, query, limit = 24) {
  const needle = String(query || "").trim().toLocaleLowerCase("fr").slice(0, 128);
  if (needle.length < 3) return [];
  return (Array.isArray(items) ? items : [])
    .filter(item => item && typeof item === "object" && driveAssetWorkspaceUrl(item))
    .filter(item => String(item.title || "").toLocaleLowerCase("fr").includes(needle))
    .sort((a, b) =>
      Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0) ||
      String(a.title).localeCompare(String(b.title), "fr", { numeric: true }))
    .slice(0, Math.max(0, Math.min(40, Number(limit) || 24)));
}

export function createDriveAssetSearch({
  loaders = DEFAULT_LOADERS, ttlMs = 15_000, now = () => Date.now()
} = {}) {
  let cached = null;
  let expires = 0;
  let inFlight = null;
  async function load() {
    if (cached && now() < expires) return cached;
    if (!inFlight) {
      inFlight = Promise.allSettled(Object.entries(FAMILIES).map(async ([family, config]) => {
        const loader = loaders[family];
        if (typeof loader !== "function") return [];
        const items = await loader();
        if (!Array.isArray(items)) throw Error("Invalid Drive listing for " + family);
        return items
          .filter(item => UUID.test(String(item?.id || "")))
          .map(item => ({
            id: String(item.id),
            assetFamily: family,
            title: String(item.filename || item.title || "").slice(0, 256),
            primaryFile: config.label,
            objectKind: config.label,
            updatedAt: item.updated_at || item.created_at || ""
          }));
      })).then(results => {
        const available = results.filter(result => result.status === "fulfilled");
        // Do not cache transient complete outages; the next search should retry.
        if (!available.length) return [];
        cached = available.flatMap(result => result.value);
        expires = now() + Math.max(0, Number(ttlMs) || 0);
        return cached;
      }).finally(() => { inFlight = null; });
    }
    return inFlight;
  }
  return async (query) => {
    if (String(query || "").trim().length < 3) return [];
    return filterDriveAssetSearch(await load(), query);
  };
}
export const searchNativeDriveAssets = createDriveAssetSearch();
