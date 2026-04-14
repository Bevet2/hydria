function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value = "") {
  return normalizeText(value)
    .split(/[^a-z0-9_.-]+/)
    .filter((token) => token.length >= 2);
}

function scoreItem(item, tokens) {
  const haystack = tokenize(`${item.category} ${item.description} ${(item.tags || []).join(" ")}`);
  let overlap = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      overlap += 1;
    }
  }
  return overlap * 3 + Number(item.score || 0) * 10 + Number(item.confidence || 0) * 5;
}

export function searchPatternItems(items = [], query = "", { limit = 5 } = {}) {
  const tokens = tokenize(query);
  return items
    .map((item) => ({
      ...item,
      searchScore: scoreItem(item, tokens)
    }))
    .filter((item) => item.searchScore > 4)
    .sort((left, right) => right.searchScore - left.searchScore)
    .slice(0, limit);
}

export default {
  searchPatternItems
};
