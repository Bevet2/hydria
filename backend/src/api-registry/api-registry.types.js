export function normalizeApiRegistryRecord(record = {}) {
  return {
    id: record.id || "",
    name: record.name || record.id || "Unnamed API",
    category: record.category || "general",
    description: record.description || "",
    baseUrl: record.baseUrl || "",
    authType: record.authType || "none",
    envKey: record.envKey || "",
    pricing: record.pricing || "free",
    capabilities: Array.isArray(record.capabilities) ? record.capabilities : [],
    inputSchema: record.inputSchema || {},
    outputMapping: record.outputMapping || {},
    priority: Number.isFinite(Number(record.priority)) ? Number(record.priority) : 99,
    enabled: record.enabled !== false,
    source: record.source || "catalog"
  };
}

export default {
  normalizeApiRegistryRecord
};
