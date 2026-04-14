import { buildTaskPackInstruction } from "./taskPackService.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value = "", maxChars = 220) {
  const text = cleanText(value);
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

function detectLanguage(prompt = "", preferencesUsed = {}) {
  const preferredLanguage = normalizeText(
    preferencesUsed.preferred_language || preferencesUsed.language || ""
  );

  if (/fr|francais|français/.test(preferredLanguage)) {
    return "fr";
  }

  if (/en|english|anglais/.test(preferredLanguage)) {
    return "en";
  }

  const normalized = normalizeText(prompt);

  if (
    /\b(le|la|les|des|une|un|pour|avec|sans|resume|compar|pourquoi|comment|strategie|etapes|liste|tableau|salut|bonjour|bonsoir|merci)\b/.test(
      normalized
    )
  ) {
    return "fr";
  }

  return "en";
}

function inferFormatHints(prompt = "") {
  const normalized = normalizeText(prompt);

  return {
    wantsTable: /\b(table|tableau|matrix|matrice)\b/.test(normalized),
    wantsSteps: /\b(step|steps|etapes|checklist)\b/.test(normalized),
    wantsBullets: /\b(bullets|bullet|liste|list)\b/.test(normalized),
    wantsConcise: /\b(short|concise|brief|court|bref|quick|rapid)\b/.test(normalized)
  };
}

function buildSectionLabels(language = "en") {
  if (language === "fr") {
    return {
      diagnosis: "Diagnostic",
      concreteFix: "Correction concrete",
      verification: "Verification",
      recommendation: "Recommandation",
      why: "Pourquoi",
      risks: "Risques ou compromis",
      nextSteps: "Prochaines etapes",
      executiveSummary: "Resume executif",
      keyPoints: "Points cles",
      caveat: "Reserve",
      comparison: "Comparaison",
      decisionCriteria: "Criteres de decision",
      directAnswer: "Reponse directe",
      supportingFacts: "Faits d'appui",
      evidence: "Preuves",
      analysis: "Analyse",
      caveats: "Limites",
      priority: "Priorite",
      promisingDirections: "Pistes prometteuses",
      bestGroundedAnswer: "Meilleure reponse ancree"
    };
  }

  return {
    diagnosis: "Diagnosis",
    concreteFix: "Concrete fix",
    verification: "Verification",
    recommendation: "Recommendation",
    why: "Why",
    risks: "Risks or tradeoffs",
    nextSteps: "Next steps",
    executiveSummary: "Executive summary",
    keyPoints: "Key points",
    caveat: "Caveat",
    comparison: "Comparison",
    decisionCriteria: "Decision criteria",
    directAnswer: "Direct answer",
    supportingFacts: "Supporting facts",
    evidence: "Evidence",
    analysis: "Analysis",
    caveats: "Caveats",
    priority: "Priority",
    promisingDirections: "Promising directions",
    bestGroundedAnswer: "Best grounded answer"
  };
}

export function buildQualityInstruction({
  classification,
  prompt = "",
  purpose = "",
  taskPack = null,
  preferencesUsed = {}
}) {
  const language = detectLanguage(prompt, preferencesUsed);
  const hints = inferFormatHints(prompt);
  const labels = buildSectionLabels(language);
  const instructions = [
    language === "fr" ? "Answer in French." : "Answer in English.",
    "Stay grounded in the available evidence. Do not invent missing facts.",
    "Keep the structure explicit and easy to scan."
  ];

  switch (classification) {
    case "coding":
      instructions.push(
        `Use this structure: ${labels.diagnosis}, ${labels.concreteFix}, ${labels.verification}.`,
        "If you rely on local project evidence, mention the relevant files or tool findings."
      );
      break;
    case "complex_reasoning":
      instructions.push(
        `Use this structure: ${labels.recommendation}, ${labels.why}, ${labels.risks}, ${labels.nextSteps}.`
      );
      break;
    case "summarize":
      instructions.push(
        `Use this structure: ${labels.executiveSummary}, ${labels.keyPoints}, optional ${labels.caveat} if something is uncertain.`
      );
      break;
    case "compare":
      instructions.push(
        `Use this structure: ${labels.recommendation}, ${labels.comparison}, ${labels.decisionCriteria}.`
      );
      break;
    case "brainstorm":
      instructions.push(
        "Return concrete non-generic ideas.",
        "Group the ideas and finish with a short priority recommendation."
      );
      break;
    case "data_lookup":
      instructions.push(
        `Put the ${labels.directAnswer.toLowerCase()} first, then ${labels.supportingFacts.toLowerCase()}, then sources.`
      );
      break;
    case "hybrid_task":
      instructions.push(
        `Use this structure: ${labels.directAnswer}, ${labels.evidence}, ${labels.analysis}, ${labels.caveats}.`
      );
      break;
    case "artifact_generation":
      instructions.push(
        "Keep the output execution-ready and structured for rendering."
      );
      break;
    case "simple_chat":
    default:
      instructions.push("Answer directly before adding any extra detail.");
      break;
  }

  const taskPackInstruction = buildTaskPackInstruction(taskPack, {
    classification,
    purpose
  });
  if (taskPackInstruction) {
    instructions.push(taskPackInstruction);
  }

  if (purpose.includes("secondary")) {
    instructions.push("Bring a distinct angle rather than repeating the first answer.");
  }

  if (hints.wantsTable) {
    instructions.push("Use a markdown table when it improves clarity.");
  } else if (hints.wantsSteps) {
    instructions.push("Use numbered steps.");
  } else if (hints.wantsBullets || hints.wantsConcise) {
    instructions.push("Prefer short bullet points over long prose.");
  }

  return instructions.join(" ");
}

function splitEvidence(summaryText = "") {
  const raw = String(summaryText || "");
  if (!raw.trim()) {
    return [];
  }

  if (/\n/.test(raw)) {
    return raw
      .split(/\n+/)
      .map((line) => cleanText(line.replace(/^[-*]\s*/, "")))
      .filter(Boolean);
  }

  if (/\s\|\s/.test(raw)) {
    return raw
      .split(/\s\|\s/)
      .map((line) => cleanText(line))
      .filter(Boolean);
  }

  return [cleanText(raw)];
}

function buildEvidencePool(candidates = []) {
  const lines = [];

  for (const candidate of candidates) {
    const provider = candidate.sourceName || candidate.provider || candidate.model || "source";
    const entries = splitEvidence(candidate.summaryText || candidate.content || "")
      .slice(0, 4)
      .map((line) => `${provider}: ${truncate(line, 240)}`);

    lines.push(...entries);
  }

  return [...new Set(lines)].slice(0, 8);
}

function formatSection(title, lines = []) {
  if (!lines.length) {
    return "";
  }

  return [`${title}:`, ...lines.map((line) => `- ${line}`)].join("\n");
}

function buildRecommendationLine(prompt = "", evidencePool = []) {
  const normalized = normalizeText(prompt);

  if (/(compare|compar|versus|vs)/.test(normalized)) {
    return evidencePool[0] || "Use the strongest grounded option from the available evidence.";
  }

  if (/(summary|resume|summarize)/.test(normalized)) {
    return evidencePool[0] || "The available evidence points to a compact factual summary.";
  }

  if (/(brainstorm|idee|idea)/.test(normalized)) {
    return "Start from the strongest grounded themes below and expand only where the evidence supports it.";
  }

  return evidencePool[0] || "Here is the best grounded answer available from the collected evidence.";
}

export function buildStructuredFallbackFromCandidates(candidates = [], context = {}) {
  const evidenceCandidates = (candidates || []).filter((candidate) =>
    ["api", "web", "tool"].includes(candidate.type)
  );
  const evidencePool = buildEvidencePool(evidenceCandidates);
  const language = detectLanguage(context.prompt);
  const labels = buildSectionLabels(language);

  if (!evidencePool.length) {
    return null;
  }

  switch (context.classification) {
    case "compare":
      return [
        formatSection(labels.recommendation, [buildRecommendationLine(context.prompt, evidencePool)]),
        formatSection(labels.comparison, evidencePool.slice(0, 6)),
        formatSection(labels.decisionCriteria, [
          language === "fr"
            ? "Prefere l'option avec le plus de preuves sourcees."
            : "Prefer the option with the strongest source-backed evidence.",
          language === "fr"
            ? "Traite les affirmations non sourcees comme moins fiables."
            : "Treat unsupported claims as lower confidence."
        ])
      ]
        .filter(Boolean)
        .join("\n\n");
    case "summarize":
      return [
        formatSection(labels.executiveSummary, [buildRecommendationLine(context.prompt, evidencePool)]),
        formatSection(labels.keyPoints, evidencePool.slice(0, 6))
      ]
        .filter(Boolean)
        .join("\n\n");
    case "brainstorm":
      return [
        formatSection(labels.promisingDirections, evidencePool.slice(0, 6)),
        formatSection(labels.priority, [
          language === "fr"
            ? "Commence par les pistes deja alignees avec les preuves ou contraintes disponibles."
            : "Start with the directions that already align with the available evidence or constraints."
        ])
      ]
        .filter(Boolean)
        .join("\n\n");
    case "data_lookup":
      return [
        formatSection(labels.directAnswer, [buildRecommendationLine(context.prompt, evidencePool)]),
        formatSection(labels.supportingFacts, evidencePool.slice(0, 6))
      ]
        .filter(Boolean)
        .join("\n\n");
    case "hybrid_task":
      return [
        formatSection(labels.directAnswer, [buildRecommendationLine(context.prompt, evidencePool)]),
        formatSection(labels.evidence, evidencePool.slice(0, 6)),
        formatSection(labels.caveats, [
          language === "fr"
            ? "L'interpretation reste limitee quand la synthese modele n'est pas disponible."
            : "Further interpretation is limited when model synthesis is unavailable."
        ])
      ]
        .filter(Boolean)
        .join("\n\n");
    case "complex_reasoning":
      return [
        formatSection(labels.recommendation, [buildRecommendationLine(context.prompt, evidencePool)]),
        formatSection(labels.why, evidencePool.slice(0, 5)),
        formatSection(labels.nextSteps, [
          language === "fr"
            ? "Valide d'abord les points a plus fort impact, puis approfondis la ou les preuves sont les plus solides."
            : "Validate the highest-impact points first, then expand where evidence is strongest."
        ])
      ]
        .filter(Boolean)
        .join("\n\n");
    case "coding":
      return [
        formatSection(labels.diagnosis, evidencePool.slice(0, 5)),
        formatSection(labels.verification, [
          language === "fr"
            ? "Utilise les resultats workspace et diagnostics ci-dessus comme base factuelle."
            : "Use the workspace and diagnostics findings above as the grounded baseline."
        ])
      ]
        .filter(Boolean)
        .join("\n\n");
    case "simple_chat":
    default:
      return [
        formatSection(labels.bestGroundedAnswer, [buildRecommendationLine(context.prompt, evidencePool)]),
        formatSection(labels.evidence, evidencePool.slice(0, 5))
      ]
        .filter(Boolean)
        .join("\n\n");
  }
}
