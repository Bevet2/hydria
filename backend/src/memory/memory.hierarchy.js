export function classifyMemoryBucket(record = {}) {
  const type = String(record.type || "").toLowerCase();
  if (type.includes("strategy") || type.includes("mistake") || type.includes("error")) {
    return "strategicMemory";
  }
  if (type.includes("pattern") || type.includes("template")) {
    return "patternMemory";
  }
  if (record.projectId || record.project) {
    return "projectMemory";
  }
  return "longTerm";
}

export default {
  classifyMemoryBucket
};
