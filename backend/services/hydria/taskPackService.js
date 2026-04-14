function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasPattern(text, pattern) {
  return pattern.test(normalizeText(text));
}

function attachmentKinds(attachments = []) {
  return new Set((attachments || []).map((attachment) => attachment.kind));
}

function attachmentFamilies(attachments = []) {
  return new Set(
    (attachments || [])
      .map((attachment) => attachment.contentFamily)
      .filter(Boolean)
  );
}

function createSignalCollector() {
  return {
    score: 0,
    reasons: []
  };
}

function addSignal(collector, condition, score, reason) {
  if (!condition) {
    return;
  }

  collector.score += score;
  collector.reasons.push(reason);
}

function buildPackMeta(definition, evaluation) {
  const confidence =
    evaluation.score >= 14 ? "high" : evaluation.score >= 8 ? "medium" : "low";

  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    responseShape: definition.responseShape,
    focusAreas: definition.focusAreas,
    plannerHints: definition.plannerHints,
    score: evaluation.score,
    confidence,
    reason:
      evaluation.reasons.slice(0, 3).join(" | ") || definition.description
  };
}

const TASK_PACK_DEFINITIONS = [
  {
    id: "artifact_studio",
    label: "Artifact Studio",
    description:
      "Creates a render-ready artifact through a multi-step generation flow.",
    responseShape: "spec -> draft -> review -> render",
    focusAreas: ["artifact generation", "structured output", "render quality"],
    plannerHints: {
      preferReasoning: true,
      preferArtifacts: true,
      preferStructuredOutput: true
    },
    detect(input) {
      const collector = createSignalCollector();
      addSignal(
        collector,
        input.classification === "artifact_generation",
        20,
        "artifact request detected"
      );
      addSignal(
        collector,
        hasPattern(input.prompt, /\b(pdf|docx?|pptx?|xlsx?|html|csv|json|image|slides?)\b/),
        4,
        "explicit output format requested"
      );
      return collector;
    }
  },
  {
    id: "coding_copilot",
    label: "Coding Copilot",
    description:
      "Optimized for code inspection, debugging, implementation guidance and project diagnostics.",
    responseShape: "diagnosis -> fix -> verification",
    focusAreas: ["workspace evidence", "debugging", "concrete fixes"],
    plannerHints: {
      preferTools: true,
      preferReasoning: true,
      allowSecondaryReview: true
    },
    detect(input) {
      const collector = createSignalCollector();
      const kinds = attachmentKinds(input.attachments);
      addSignal(
        collector,
        input.classification === "coding",
        12,
        "coding classification"
      );
      addSignal(collector, kinds.has("code"), 4, "code attachment detected");
      addSignal(collector, kinds.has("config"), 3, "config attachment detected");
      addSignal(
        collector,
        input.toolNeed?.workspaceInspect,
        3,
        "workspace inspection needed"
      );
      addSignal(
        collector,
        input.toolNeed?.diagnostics,
        4,
        "diagnostics needed"
      );
      addSignal(collector, input.toolNeed?.preview, 2, "preview inspection needed");
      return collector;
    }
  },
  {
    id: "document_intelligence",
    label: "Document Intelligence",
    description:
      "Optimized for attached files, long-form documents and evidence anchored in extracted content.",
    responseShape: "direct answer -> document evidence -> caveats",
    focusAreas: ["attachments", "document grounding", "section-level evidence"],
    plannerHints: {
      preferAttachments: true,
      preferReasoning: true,
      allowSecondaryReview: true
    },
    detect(input) {
      const collector = createSignalCollector();
      const families = attachmentFamilies(input.attachments);
      const kinds = attachmentKinds(input.attachments);
      const hasRichAttachments = input.attachments?.length > 0;
      addSignal(
        collector,
        hasRichAttachments &&
          ["summarize", "compare", "complex_reasoning", "hybrid_task"].includes(
            input.classification
          ),
        10,
        "document-oriented request with attachments"
      );
      addSignal(
        collector,
        families.has("document") || families.has("technical") || families.has("data"),
        4,
        "extractable document content detected"
      );
      addSignal(
        collector,
        kinds.has("pdf") ||
          kinds.has("doc") ||
          kinds.has("docx") ||
          kinds.has("presentation") ||
          kinds.has("spreadsheet"),
        3,
        "structured file formats detected"
      );
      addSignal(
        collector,
        hasPattern(
          input.prompt,
          /\b(review|audit|summari[sz]e|resume|extract|analyse|analyze|rewrite|compare|compare ces|compare these)\b/
        ),
        3,
        "document operation requested"
      );
      return collector;
    }
  },
  {
    id: "research_analyst",
    label: "Research Analyst",
    description:
      "Optimized for web search, URL reading, freshness-sensitive queries and source-grounded synthesis.",
    responseShape: "direct answer -> source-backed facts -> interpretation",
    focusAreas: ["freshness", "source quality", "web synthesis"],
    plannerHints: {
      preferWeb: true,
      preferReasoning: true,
      requireSources: true
    },
    detect(input) {
      const collector = createSignalCollector();
      addSignal(collector, Boolean(input.webNeed), 10, "web research required");
      addSignal(
        collector,
        hasPattern(
          input.prompt,
          /\b(url|link|website|site|web|internet|source|news|latest|actualite|recent|today|aujourd'hui|search|cherche)\b/
        ),
        5,
        "explicit web or freshness signal"
      );
      addSignal(
        collector,
        input.classification === "data_lookup" || input.classification === "hybrid_task",
        2,
        "lookup-style request"
      );
      return collector;
    }
  },
  {
    id: "comparison_analyst",
    label: "Comparison Analyst",
    description:
      "Optimized for comparing options, tradeoffs and making a recommendation backed by criteria.",
    responseShape: "recommendation -> side-by-side comparison -> decision criteria",
    focusAreas: ["tradeoffs", "recommendation", "decision criteria"],
    plannerHints: {
      preferReasoning: true,
      preferStructuredOutput: true,
      allowSecondaryReview: true
    },
    detect(input) {
      const collector = createSignalCollector();
      addSignal(
        collector,
        input.classification === "compare",
        12,
        "comparison classification"
      );
      addSignal(
        collector,
        hasPattern(
          input.prompt,
          /\b(compare|comparaison|versus|vs\.?|difference|diff|better|meilleur|which one)\b/
        ),
        5,
        "explicit comparison language"
      );
      addSignal(
        collector,
        Boolean(input.attachments?.length),
        2,
        "comparison can use attached evidence"
      );
      return collector;
    }
  },
  {
    id: "strategy_advisor",
    label: "Strategy Advisor",
    description:
      "Optimized for architecture, planning, decision-making and phased recommendations.",
    responseShape: "recommendation -> rationale -> risks -> next steps",
    focusAreas: ["strategy", "tradeoffs", "execution plan"],
    plannerHints: {
      preferReasoning: true,
      allowSecondaryReview: true
    },
    detect(input) {
      const collector = createSignalCollector();
      addSignal(
        collector,
        input.classification === "complex_reasoning",
        8,
        "complex reasoning classification"
      );
      addSignal(
        collector,
        hasPattern(
          input.prompt,
          /\b(strategy|strategie|architecture|roadmap|plan|tradeoff|decision|workflow|orchestration|go-to-market|priorit[yi]se)\b/
        ),
        6,
        "strategy or architecture language"
      );
      addSignal(
        collector,
        input.toolNeed?.workspaceInspect,
        2,
        "project context may inform the strategy"
      );
      return collector;
    }
  },
  {
    id: "data_grounded_answer",
    label: "Data Grounded Answer",
    description:
      "Optimized for API-backed or factual answers where units, freshness and explicit evidence matter.",
    responseShape: "direct answer -> facts -> caveats",
    focusAreas: ["facts", "units", "timestamps", "grounded interpretation"],
    plannerHints: {
      preferApi: true,
      preferWeb: true,
      requireSources: true
    },
    detect(input) {
      const collector = createSignalCollector();
      const kinds = attachmentKinds(input.attachments);
      addSignal(
        collector,
        input.classification === "data_lookup" || input.classification === "hybrid_task",
        10,
        "data-oriented classification"
      );
      addSignal(collector, Boolean(input.apiNeed), 5, "external API evidence required");
      addSignal(
        collector,
        kinds.has("spreadsheet") || kinds.has("data"),
        3,
        "data file detected"
      );
      addSignal(
        collector,
        hasPattern(
          input.prompt,
          /\b(price|weather|forecast|quote|btc|crypto|finance|stocks?|stats|statistics|donnees|data|metric|kpi|scores?)\b/
        ),
        4,
        "explicit data or metric language"
      );
      return collector;
    }
  },
  {
    id: "general_assistant",
    label: "General Assistant",
    description:
      "Balanced default pack for general chat when no stronger specialist pack is triggered.",
    responseShape: "direct answer -> short clarification if needed",
    focusAreas: ["clarity", "conciseness", "general usefulness"],
    plannerHints: {
      preferFast: true
    },
    detect() {
      return {
        score: 1,
        reasons: ["default pack"]
      };
    }
  }
];

export function resolveTaskPack({
  classification,
  prompt = "",
  attachments = [],
  apiNeed = null,
  webNeed = null,
  toolNeed = null
}) {
  const input = {
    classification,
    prompt,
    attachments,
    apiNeed,
    webNeed,
    toolNeed
  };

  const evaluations = TASK_PACK_DEFINITIONS.map((definition) => ({
    definition,
    evaluation: definition.detect(input)
  })).sort((left, right) => right.evaluation.score - left.evaluation.score);

  const best = evaluations[0];
  return buildPackMeta(best.definition, best.evaluation);
}

export function listTaskPacks() {
  return TASK_PACK_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    description: definition.description,
    responseShape: definition.responseShape,
    focusAreas: definition.focusAreas,
    plannerHints: definition.plannerHints
  }));
}

export function buildTaskPackInstruction(taskPack, { classification, purpose = "" } = {}) {
  if (!taskPack?.id) {
    return "";
  }

  switch (taskPack.id) {
    case "artifact_studio":
      return "Keep the output execution-ready for rendering. Prefer clean structure, factual grounding, and directly reusable sections.";
    case "coding_copilot":
      return "Prioritize observable issues, concrete fixes, and verification steps. Use workspace or diagnostics evidence before speculation.";
    case "document_intelligence":
      return "Treat attached files as primary sources. Cite filenames or document sections when useful, and surface extraction limits only if they materially affect the answer.";
    case "research_analyst":
      return "Prioritize recent and credible sources. Distinguish sourced facts from interpretation, and mention the most relevant source names or URLs when useful.";
    case "comparison_analyst":
      return "Make the recommendation explicit. Compare options on shared criteria, then explain which option fits which use case.";
    case "strategy_advisor":
      return "Be opinionated and pragmatic. Prefer a clear recommendation with tradeoffs and phased next steps over abstract analysis.";
    case "data_grounded_answer":
      return "Lead with the factual result, keep units and time references explicit, and avoid interpretation that is not supported by the evidence.";
    case "general_assistant":
    default:
      return classification === "simple_chat"
        ? "Answer directly, then add only the shortest useful clarification."
        : "Keep the answer clear, useful, and grounded.";
  }
}

export function buildTaskPackContextBlock(taskPack) {
  if (!taskPack?.id) {
    return "";
  }

  return [
    `Active task pack: ${taskPack.label} (${taskPack.id})`,
    `Task pack reason: ${taskPack.reason}`,
    `Expected response shape: ${taskPack.responseShape}`,
    `Focus areas: ${taskPack.focusAreas.join(", ")}`
  ].join("\n");
}
