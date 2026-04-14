function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function wantsConcise(prompt = "") {
  return /\b(court|bref|concis|short|brief|quick)\b/.test(normalizeText(prompt));
}

export function buildDomainPromptTemplate({
  domainProfile = null,
  classification = "simple_chat",
  prompt = "",
  purpose = "",
  preferencesUsed = {}
} = {}) {
  const domain = domainProfile?.id || "simple_chat";
  const preferredLanguage = normalizeText(
    preferencesUsed.preferred_language || preferencesUsed.language || ""
  );
  const forceFrench =
    /fr|francais|fran[cç]ais/.test(preferredLanguage) ||
    /\b(le|la|les|des|une|un|bonjour|salut|merci|comment|pourquoi|quelle|quel)\b/.test(
      normalizeText(prompt)
    );
  const languageInstruction = forceFrench ? "Answer in French." : "Answer in English.";
  const conciseInstruction = wantsConcise(prompt)
    ? "Keep the answer compact."
    : "Give enough detail to be directly useful.";

  switch (domain) {
    case "coding":
      return [
        languageInstruction,
        conciseInstruction,
        "Be precise and concrete.",
        "Lead with the diagnosis, then the concrete fix, then verification.",
        "Do not ask for clarification if the available evidence already supports an actionable answer.",
        "Prefer grounded engineering statements over generic advice."
      ].join(" ");
    case "github_research":
      return [
        languageInstruction,
        conciseInstruction,
        "Name the relevant repositories or codebases when possible.",
        "Extract implementation patterns, not just descriptions.",
        "End with recommendations for Hydria."
      ].join(" ");
    case "reasoning":
      return [
        languageInstruction,
        conciseInstruction,
        "Answer with explicit reasoning steps.",
        "Lead with the recommendation, then why it follows from the evidence, then risks or caveats, then next steps.",
        "Avoid vague phrases like 'it depends' unless you immediately resolve the tradeoff."
      ].join(" ");
    case "brainstorm":
      return [
        languageInstruction,
        conciseInstruction,
        "Produce diverse and non-generic ideas.",
        "Vary the ideas across user value, feasibility, and differentiation.",
        "End with a recommended starting point."
      ].join(" ");
    case "simple_chat":
    default:
      return [
        languageInstruction,
        conciseInstruction,
        "Answer naturally and directly.",
        "Avoid robotic framing, boilerplate, and unnecessary headings.",
        "Stay grounded in Hydria's real capabilities and the available context."
      ].join(" ");
  }
}

export default {
  buildDomainPromptTemplate
};
