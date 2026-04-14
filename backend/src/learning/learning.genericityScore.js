function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const BROAD_CATEGORIES = new Map([
  ["general", 0.92],
  ["backend", 0.72],
  ["frontend", 0.72],
  ["api", 0.68],
  ["database", 0.58],
  ["quality", 0.62],
  ["documentation", 0.66],
  ["github", 0.56],
  ["backend_architecture", 0.48],
  ["frontend_architecture", 0.45],
  ["authentication", 0.32],
  ["github_automation", 0.4],
  ["agent_architecture", 0.42]
]);

const SPECIFIC_TERMS =
  /\b(node|express|fastify|koa|react|vue|next|jwt|oauth|middleware|controller|service|repository|repo|github|dashboard|auth|sqlite|postgres|mysql|api|rest|playwright|browser|agent|runtime|tool)\b/i;

const VAGUE_PHRASES =
  /\b(good practice|best practice|useful result|pattern|architecture pattern|generic|general|modular structure|reusable approach)\b/i;

export function computeGenericityScore(item = {}) {
  const normalizedDescription = normalizeText(item.description || "");
  const normalizedReusableFor = (item.reusableFor || []).map((value) => normalizeText(value));
  const normalizedCategory = normalizeText(item.category || "general");
  let score = BROAD_CATEGORIES.get(normalizedCategory) ?? 0.5;
  const reasons = [];

  if (normalizedDescription.length < 80) {
    score += 0.12;
    reasons.push("short_description");
  }

  if ((item.reusableFor || []).length <= 1) {
    score += 0.08;
    reasons.push("few_specific_tags");
  }

  if (!SPECIFIC_TERMS.test(item.description || "")) {
    score += 0.16;
    reasons.push("missing_specific_technology");
  }

  if (VAGUE_PHRASES.test(item.description || "")) {
    score += 0.12;
    reasons.push("vague_description");
  }

  const broadTags = normalizedReusableFor.filter((tag) =>
    ["general", "backend", "frontend", "api", "database", "coding", "reasoning"].includes(tag)
  );
  if (broadTags.length >= 2) {
    score += 0.08;
    reasons.push("broad_reusable_tags");
  }

  const clamped = Math.max(0, Math.min(1, Number(score.toFixed(3))));
  return {
    score: clamped,
    reasons
  };
}

export default {
  computeGenericityScore
};
