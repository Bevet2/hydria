import fs from "node:fs";
import config from "../../config/hydria.config.js";

let catalogCache = null;

function readCatalog(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

export function getApiCatalog({ refresh = false } = {}) {
  if (!refresh && catalogCache) {
    return catalogCache;
  }

  const curated = readCatalog(config.paths.curatedApiCatalog);
  const custom = readCatalog(config.paths.customApiCatalog);
  const merged = new Map();

  for (const api of curated) {
    merged.set(api.id, api);
  }

  for (const api of custom) {
    merged.set(api.id, { ...(merged.get(api.id) || {}), ...api });
  }

  catalogCache = Array.from(merged.values());
  return catalogCache;
}

export function getApiById(apiId) {
  return getApiCatalog().find((api) => api.id === apiId) || null;
}

export function listEnabledApis() {
  return getApiCatalog().filter((api) => api.enabled !== false);
}

