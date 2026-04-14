export function normalizePatternItem(item = {}) {
  return {
    id: String(item.id || "").trim(),
    type: String(item.type || "pattern").trim().toLowerCase(),
    category: String(item.category || "general").trim().toLowerCase(),
    description: String(item.description || "").trim(),
    version: String(item.version || "1.0.0").trim(),
    score: Number(item.score || 0),
    confidence: Math.max(0, Math.min(1, Number(item.confidence || 0.5))),
    source: item.source || {},
    projectType: String(item.projectType || "internal").trim().toLowerCase(),
    tags: [...new Set((item.tags || item.reusableFor || []).map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))],
    compatibility: item.compatibility || {},
    createdAt: String(item.createdAt || new Date().toISOString()),
    updatedAt: String(item.updatedAt || new Date().toISOString())
  };
}

export default {
  normalizePatternItem
};
