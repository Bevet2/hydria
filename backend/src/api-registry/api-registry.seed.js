import fs from "node:fs";
import config from "../../config/hydria.config.js";
import { normalizeApiRegistryRecord } from "./api-registry.types.js";

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

export function loadApiRegistrySeed() {
  const curated = readJsonFile(config.paths.curatedApiCatalog).map((record) =>
    normalizeApiRegistryRecord({
      ...record,
      source: "curated"
    })
  );
  const custom = readJsonFile(config.paths.customApiCatalog).map((record) =>
    normalizeApiRegistryRecord({
      ...record,
      source: "custom"
    })
  );

  return [...curated, ...custom];
}

export default {
  loadApiRegistrySeed
};
