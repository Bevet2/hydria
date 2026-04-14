function tokenize(value = "") {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter((token) => token.length >= 3);
}

export function buildMemoryLinks(records = []) {
  const links = [];
  for (let index = 0; index < records.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < records.length; compareIndex += 1) {
      const left = records[index];
      const right = records[compareIndex];
      const leftTokens = tokenize(`${left.type || ""} ${left.content || left.description || ""}`);
      const rightTokens = tokenize(`${right.type || ""} ${right.content || right.description || ""}`);
      const overlap = leftTokens.filter((token) => rightTokens.includes(token));
      if (overlap.length >= 2) {
        links.push({
          from: left.id,
          to: right.id,
          reason: overlap.slice(0, 4)
        });
      }
    }
  }
  return links.slice(0, 120);
}

export default {
  buildMemoryLinks
};
