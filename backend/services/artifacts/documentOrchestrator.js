import { randomUUID } from "node:crypto";
import { durationMs } from "../../utils/time.js";
import config from "../../config/hydria.config.js";
import { buildModelContext } from "../memory/contextBuilder.js";
import {
  cleanPromptText,
  normalizePromptText
} from "../../src/core/promptNormalization.js";
import {
  callChatModel,
  callReasoningModel
} from "../providers/llm/llmRouterService.js";
import {
  inferArtifactIntent,
  listSupportedGenerationFormats
} from "./generationIntentService.js";
import { renderGeneratedArtifact } from "./generators/generatorRegistry.js";
import { persistGeneratedArtifact } from "./generationStorageService.js";

function attachInstruction(messages, instruction, attachments = []) {
  const instructionParts = [instruction].filter(Boolean);

  if (attachments.length) {
    instructionParts.push(
      "Use the provided attachment contents directly. Do not say that you cannot access the attached files."
    );
  }

  if (!instructionParts.length) {
    return messages;
  }

  return [
    messages[0],
    { role: "system", content: instructionParts.join("\n\n") },
    ...messages.slice(1)
  ];
}

function collectContextUsage(modelContext) {
  const memoryUsed = new Map();

  for (const memory of modelContext.memoryUsed || []) {
    memoryUsed.set(`${memory.type}-${memory.id}`, memory);
  }

  if (modelContext.summaryUsed) {
    memoryUsed.set(`summary-${modelContext.summaryUsed.id}`, {
      id: modelContext.summaryUsed.id,
      type: "summary",
      content: modelContext.summaryUsed.content
    });
  }

  return {
    memoryUsed: [...memoryUsed.values()],
    attachmentEvidenceUsed: [...(modelContext.attachmentEvidenceUsed || [])]
  };
}

function safeJsonParse(rawText) {
  const text = String(rawText || "").trim();
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);

  try {
    return JSON.parse(objectMatch?.[0] || candidate);
  } catch {
    return null;
  }
}

function normalizeSpec(spec, intent) {
  const sections = Array.isArray(spec?.sections)
    ? spec.sections
        .map((section) => {
          if (typeof section === "string") {
            return {
              heading: section,
              goal: ""
            };
          }

          return {
            heading: String(section?.heading || section?.title || "").trim(),
            goal: String(section?.goal || section?.summary || "").trim()
          };
        })
        .filter((section) => section.heading)
    : [];

  return {
    title: String(spec?.title || intent.title).trim() || intent.title,
    format: listSupportedGenerationFormats().includes(spec?.format)
      ? spec.format
      : intent.format,
    documentType: String(spec?.documentType || intent.documentType || "document").trim(),
    audience: String(spec?.audience || "general audience").trim(),
    tone: String(spec?.tone || "clear and professional").trim(),
    sections:
      sections.length > 0
        ? sections
        : [
            { heading: "Introduction", goal: "Introduce the topic and context." },
            { heading: "Main Points", goal: "Develop the core ideas with concrete details." },
            { heading: "Conclusion", goal: "Close with clear takeaways or next steps." }
          ]
  };
}

function buildFallbackSpec(intent, prompt, attachments) {
  if (intent.documentType === "dashboard") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "a user who needs to monitor key metrics quickly",
        tone: "clear, operational and insight-driven",
        sections: [
          { heading: "North star", goal: "State the main metric and why it matters." },
          { heading: "KPIs", goal: "List the most useful metrics for daily monitoring." },
          { heading: "Trends", goal: "Show the main trend and what changed recently." },
          { heading: "Breakdown", goal: "Explain how performance varies by segment." }
        ]
      },
      intent
    );
  }

  if (intent.documentType === "benchmark") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "a product lead who needs a fast competitive picture",
        tone: "clear, analytical and decision-oriented",
        sections: [
          { heading: "Benchmark goal", goal: "State what is being compared and why it matters now." },
          { heading: "Competitor set", goal: "List the relevant competitors or alternatives." },
          { heading: "Comparison criteria", goal: "Define the criteria that really influence the decision." },
          { heading: "Strategic takeaways", goal: "Extract the biggest openings, risks and next moves." }
        ]
      },
      intent
    );
  }

  if (intent.documentType === "campaign") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "a team preparing a launch or growth push",
        tone: "clear, tactical and activation-ready",
        sections: [
          { heading: "Campaign objective", goal: "State the outcome the campaign must drive." },
          { heading: "Audience and message", goal: "Clarify the target audience, promise and angle." },
          { heading: "Channels and assets", goal: "List the channels, assets and hooks that should be produced." },
          { heading: "Timeline and KPIs", goal: "Lay out the sequence, checks and success signals." }
        ]
      },
      intent
    );
  }

  if (intent.documentType === "workflow") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "a team that needs a clear operational flow",
        tone: "practical and execution-oriented",
        sections: [
          { heading: "Trigger", goal: "Define what starts the workflow." },
          { heading: "Core steps", goal: "Lay out the sequence of actions clearly." },
          { heading: "Automation rules", goal: "Describe the key automation logic and branching." },
          { heading: "Outputs", goal: "State the final outputs and signals." }
        ]
      },
      intent
    );
  }

  if (intent.documentType === "design") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "a creator shaping a UI or wireframe quickly",
        tone: "visual, concise and product-oriented",
        sections: [
          { heading: "Design brief", goal: "State the intent and product feeling." },
          { heading: "Screens", goal: "Define the main views or frames." },
          { heading: "Components", goal: "List the reusable UI building blocks." },
          { heading: "Style system", goal: "Capture palette, typography and spacing cues." }
        ]
      },
      intent
    );
  }

  if (intent.documentType === "presentation") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "an audience that needs a clear and convincing narrative",
        tone: "clear, visual and concise",
        sections: [
          { heading: "Title Slide", goal: "State the topic and the main promise." },
          { heading: "Why It Matters", goal: "Explain the context and why this topic deserves attention." },
          { heading: "Key Advantages", goal: "Present the strongest advantages in a simple, memorable way." },
          { heading: "Proof Points", goal: "Add examples, facts or concrete signals that make the case credible." },
          { heading: "Takeaways", goal: "Close with a short summary and next step." }
        ]
      },
      intent
    );
  }

  if (intent.documentType === "audio") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "a creator producing an audio asset",
        tone: "clear, evocative and production-ready",
        sections: [
          { heading: "Audio concept", goal: "Define the purpose, format and overall feeling of the audio." },
          { heading: "Voice and structure", goal: "Describe the voices, sequence and pacing." },
          { heading: "Cue sheet", goal: "List the key moments, transitions and sonic cues." },
          { heading: "Deliverables", goal: "Specify the output variants and where they will be used." }
        ]
      },
      intent
    );
  }

  if (intent.documentType === "video") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "a creator producing a product or story video",
        tone: "visual, paced and production-ready",
        sections: [
          { heading: "Video concept", goal: "State the goal, audience and main promise of the video." },
          { heading: "Scene flow", goal: "Describe the sequence of scenes and what each must communicate." },
          { heading: "Narration and on-screen cues", goal: "Capture voiceover, titles and visual cues." },
          { heading: "Delivery plan", goal: "List the target formats, hooks and publishing contexts." }
        ]
      },
      intent
    );
  }

  if (intent.documentType === "spreadsheet" || intent.documentType === "dataset") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "a user who needs structured rows and columns",
        tone: "structured and operational",
        sections: [
          { heading: "Table Structure", goal: "Define the columns and the row model clearly." }
        ]
      },
      intent
    );
  }

  if (intent.documentType === "business plan") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "founders and early-stage investors",
        tone: "clear, credible and business-oriented",
        sections: [
          { heading: "Executive Summary", goal: "Explain the product, the target users and the positioning in a concise way." },
          { heading: "Problem and Solution", goal: "Describe the user pain points and how the product solves them." },
          { heading: "Business Model", goal: "Explain how the business makes money and the core unit economics assumptions." },
          { heading: "Go-to-Market", goal: "Describe acquisition channels, launch strategy and early growth motions." },
          { heading: "Operations", goal: "Summarize product, logistics, team and execution requirements." },
          { heading: "Financial Outlook", goal: "Outline key assumptions, costs, revenue drivers and milestones." }
        ]
      },
      intent
    );
  }

  if (intent.documentType === "plan") {
    return normalizeSpec(
      {
        title: intent.title,
        format: intent.format,
        documentType: intent.documentType,
        audience: "project stakeholders",
        tone: "clear and execution-oriented",
        sections: [
          { heading: "Objective", goal: "State the objective and scope clearly." },
          { heading: "Workstreams", goal: "Describe the main workstreams or pillars." },
          { heading: "Timeline", goal: "Lay out the sequence of milestones or phases." },
          { heading: "Risks and Mitigations", goal: "Highlight the main risks and how to reduce them." }
        ]
      },
      intent
    );
  }

  const sections = [];

  if (attachments.length) {
    sections.push({
      heading: "Source Material",
      goal: "Use the attached files and extracted evidence as source material."
    });
  }

  sections.push(
    { heading: "Overview", goal: "Introduce the requested topic clearly." },
    { heading: "Key Points", goal: "Develop the most important ideas or findings." },
    { heading: "Conclusion", goal: "Summarize the result and next steps." }
  );

  return normalizeSpec(
    {
      title: intent.title,
      format: intent.format,
      documentType: intent.documentType,
      audience: "general audience",
      tone: "clear and professional",
      sections
    },
    intent
  );
}

function normalizeArtifactText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function humanizeProjectName(value = "") {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeContextLabel(value = "") {
  let cleaned = humanizeProjectName(value);
  const patterns = [
    /^(dashboard|workflow|wireframe|design|presentation|document|spreadsheet|dataset|benchmark|campaign|image|audio|video)\s*-\s*/i,
    /^(dashboard|workflow|wireframe|design|presentation|document|spreadsheet|dataset|benchmark|campaign|image|audio|video)\s+/i
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      const next = cleaned.replace(pattern, "").trim();
      if (next !== cleaned) {
        cleaned = next;
        changed = true;
      }
    }
  }

  return cleaned;
}

function isWeakArtifactTitle(title = "", documentType = "") {
  const normalized = normalizeArtifactText(title);
  return (
    !normalized ||
    normalized.startsWith("hydria ") ||
    normalized === documentType ||
    new RegExp(`^${String(documentType || "").toLowerCase()}\\s*-\\s*(ce projet|this project|project)$`).test(
      normalized
    )
  );
}

function labelForDocumentType(documentType = "document") {
  const labels = {
    dashboard: "Dashboard",
    benchmark: "Benchmark",
    campaign: "Campaign",
    workflow: "Workflow",
    design: "Wireframe",
    presentation: "Presentation",
    spreadsheet: "Spreadsheet",
    dataset: "Dataset",
    image: "Visual",
    audio: "Audio",
    video: "Video",
    "business plan": "Business Plan",
    document: "Document"
  };
  return labels[String(documentType || "").toLowerCase()] || "Document";
}

function normalizeInsightText(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function compactBulletList(values = [], limit = 4) {
  return [...new Set((values || []).map((value) => normalizeInsightText(value)).filter(Boolean))].slice(0, limit);
}

function isMeaningfulAppSignal(value = "") {
  const normalized = normalizeInsightText(value).toLowerCase();
  if (!normalized || normalized.length < 5) {
    return false;
  }

  if (
    [
      "date",
      "label",
      "category",
      "amount",
      "week",
      "phase",
      "review",
      "focus",
      "status",
      "notes",
      "value"
    ].includes(normalized)
  ) {
    return false;
  }

  return /[a-z]{3,}/i.test(normalized);
}

function extractTableSignals(table = {}, limit = 3) {
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  return compactBulletList(
    rows
      .slice(0, limit)
      .map((row) =>
        Array.isArray(row)
          ? row
              .map((cell) => normalizeInsightText(cell))
              .filter((cell) => isMeaningfulAppSignal(cell))
              .slice(0, 3)
              .join(" - ")
          : ""
      )
      .filter((row) => row && row.length >= 8),
    limit
  );
}

function summarizeAppPage(page = {}, index = 0) {
  const label = normalizeInsightText(page.label || page.title || `View ${index + 1}`);
  const title = normalizeInsightText(page.title || page.label || `View ${index + 1}`);
  const intro = normalizeInsightText(page.intro || page.summary || "");
  const cardTitles = compactBulletList((page.cards || []).map((card) => card?.title || card?.text), 3).filter(
    isMeaningfulAppSignal
  );
  const statTitles = compactBulletList(
    (page.stats || []).map((stat) => `${stat?.label || "Signal"} ${stat?.value || ""}`),
    3
  ).filter(isMeaningfulAppSignal);
  const checklist = compactBulletList(page.checklist || [], 3).filter(isMeaningfulAppSignal);
  const quickEntrySignals = compactBulletList(
    [
      page.quickEntry?.title,
      ...((page.quickEntry?.fields || []).map((field) => field?.label || field?.placeholder || ""))
    ],
    3
  ).filter(isMeaningfulAppSignal);
  const transactionSignals = compactBulletList(
    (page.transactions || []).map((item) => `${item?.label || ""} ${item?.amount || ""}`),
    3
  ).filter(isMeaningfulAppSignal);
  const tableSignals = extractTableSignals(page.table, 3).filter(isMeaningfulAppSignal);
  const signals = compactBulletList(
    [...cardTitles, ...statTitles, ...checklist, ...quickEntrySignals, ...transactionSignals, ...tableSignals],
    5
  );

  return {
    id: page.id || `view-${index + 1}`,
    label,
    title,
    intro,
    signals,
    summary: compactBulletList([intro, ...signals], 2).join(" ")
  };
}

function extractAppBlueprint(content = "") {
  const parsed = safeJsonParse(content);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.pages)) {
    return null;
  }

  const pages = parsed.pages
    .slice(0, 6)
    .map((page, index) => summarizeAppPage(page, index))
    .filter((page) => page.title || page.label);

  if (!pages.length && !normalizeInsightText(parsed.title || parsed.name || "")) {
    return null;
  }

  return {
    title: normalizeInsightText(parsed.title || parsed.name || ""),
    eyebrow: normalizeInsightText(parsed.eyebrow || ""),
    subtitle: normalizeInsightText(parsed.subtitle || ""),
    accentTitle: normalizeInsightText(parsed.accentTitle || ""),
    pages,
    workflowSummary: compactBulletList(
      pages.map((page) => `${page.label}: ${page.intro || page.signals.join(", ")}`),
      4
    ),
    proofPoints: compactBulletList(pages.flatMap((page) => page.signals), 6)
  };
}

function buildArtifactContext({
  spec = null,
  prompt = "",
  project = null,
  activeWorkObject = null,
  activeWorkObjectContent = ""
} = {}) {
  const activeContent = activeWorkObjectContent;
  const seed = project?.globalProject?.seed || null;
  const appBlueprint = extractAppBlueprint(activeContent);
  const normalizedTopic = [
    spec?.title,
    prompt,
    project?.name,
    project?.globalProject?.summary,
    seed?.headline,
    activeWorkObject?.title,
    activeContent,
    appBlueprint?.title,
    appBlueprint?.subtitle,
    ...(appBlueprint?.workflowSummary || [])
  ]
    .filter(Boolean)
    .join(" ");
  const normalized = normalizeArtifactText(normalizedTopic);
  const baseLabel = sanitizeContextLabel(
    appBlueprint?.title || project?.name || seed?.headline || activeWorkObject?.title || ""
  );

  return {
    normalized,
    seed,
    sourceObjectKind: String(activeWorkObject?.objectKind || "").toLowerCase(),
    sourceObjectTitle: activeWorkObject?.title || "",
    projectName: baseLabel,
    headline: appBlueprint?.title || seed?.headline || baseLabel,
    audience: seed?.audience || "",
    problem: seed?.problem || "",
    promise: seed?.promise || "",
    appBlueprint,
    theme:
      seed?.theme === "local_music_product"
        ? "community"
        : seed?.theme === "food_product"
          ? "knowledge"
          : seed?.theme === "investor_asset"
            ? "narrative"
            : seed?.theme === "operations_system"
              ? "operations"
              : /\b(budget|finance|cash|revenue|cost|forecast|expense|expenses|income|savings)\b/.test(normalized)
                ? "finance"
                : /\b(workflow|automation|pipeline|ops|operation|task|todo|request|ticket|roadmap|kanban)\b/.test(
                    normalized
                  )
                  ? "operations"
                  : /\b(note|notes|wiki|knowledge|document|brief|memo|outline|mindmap)\b/.test(normalized)
                    ? "knowledge"
                    : /\b(presentation|slides?|deck|pitch|story|campaign|content|brand)\b/.test(normalized)
                      ? "narrative"
                      : /\b(design|wireframe|layout|ui|figma|visual|screen|frame)\b/.test(normalized)
                        ? "visual"
                        : /\b(users?|customers?|clients?|leads?|members?|artists?|partners?|community|events?|bookings?|reservations?|appointments?|tickets?)\b/.test(
                            normalized
                          )
                          ? "community"
                          : "generic"
  };
}

function applyProjectContextToSpec(
  spec,
  { project = null, activeWorkObject = null, activeWorkObjectContent = "", prompt = "" } = {}
) {
  if (!spec) {
    return spec;
  }

  const context = buildArtifactContext({
    spec,
    prompt,
    project,
    activeWorkObject,
    activeWorkObjectContent
  });
  const nextSpec = { ...spec };

  if (isWeakArtifactTitle(spec.title, spec.documentType) && context.headline) {
    nextSpec.title = `${labelForDocumentType(spec.documentType)} - ${context.headline}`;
  }

  if (
    (!spec.audience || /^general audience$/i.test(spec.audience)) &&
    context.audience
  ) {
    nextSpec.audience = context.audience;
  }

  return nextSpec;
}

function buildArtifactContextInstruction(context = {}, spec = null) {
  const lines = [];

  if (context.projectName) {
    lines.push(`Current project: ${context.projectName}`);
  }

  if (context.problem) {
    lines.push(`Core problem: ${context.problem}`);
  }

  if (context.promise) {
    lines.push(`Project promise: ${context.promise}`);
  }

  if (context.appBlueprint) {
    lines.push(
      `Source app: ${context.appBlueprint.title || context.projectName || "Current app"}`
    );

    if (context.appBlueprint.subtitle) {
      lines.push(`App positioning: ${context.appBlueprint.subtitle}`);
    }

    if (context.appBlueprint.eyebrow) {
      lines.push(`App workspace type: ${context.appBlueprint.eyebrow}`);
    }

    if (context.appBlueprint.accentTitle) {
      lines.push(`App product angle: ${context.appBlueprint.accentTitle}`);
    }

    const pageLines = (context.appBlueprint.pages || []).map((page, index) => {
      const detail = compactBulletList([page.intro, ...(page.signals || [])], 3).join(" | ");
      return `- View ${index + 1}: ${page.title}${detail ? ` -> ${detail}` : ""}`;
    });

    if (pageLines.length) {
      lines.push("Current app views:");
      lines.push(...pageLines);
    }

    lines.push(
      `The ${spec?.documentType || "artifact"} must be derived from this current app, not from a generic blank product.`
    );
  }

  return lines.filter(Boolean).join("\n");
}

function toTitleCase(value = "") {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveArtifactSubject(spec, prompt = "", context = {}) {
  const candidates = [
    sanitizeContextLabel(spec?.title || ""),
    sanitizeContextLabel(context?.headline || ""),
    sanitizeContextLabel(context?.projectName || ""),
    cleanPromptText(prompt)
      .replace(
        /\b(peux tu|peux-tu|could you|can you|please|merci|cree|creer|create|generate|make|build|write|draft|produce|prepare|transform|transforme|fais|fabrique|genere|produis|redige|ecris|compose|ajoute|add)\b/gi,
        " "
      )
      .replace(
        /\b(app|application|dashboard|workflow|wireframe|design|presentation|slides?|deck|spreadsheet|excel|tableur|dataset|document|pdf|docx|word|fichier|file|rapport|report|brief|plan|business plan)\b/gi,
        " "
      )
      .replace(/\b(for this project|in this project|pour ce projet|dans ce projet)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  ];

  for (const candidate of candidates) {
    const cleaned = humanizeProjectName(candidate || "")
      .replace(/^hydria\s+/i, "")
      .replace(/^[\s\-:]+|[\s\-:]+$/g, "")
      .trim();
    if (cleaned) {
      return toTitleCase(cleaned);
    }
  }

  return "Workspace";
}

function inferArtifactCapabilities(spec, prompt = "", context = {}) {
  const normalized = normalizePromptText(
    [spec?.title, prompt, context?.headline, context?.problem, context?.promise]
      .filter(Boolean)
      .join(" ")
  );
  const theme = (() => {
    if (context?.theme && context.theme !== "generic") {
      return context.theme;
    }
    if (/\b(budget|finance|cash|revenue|cost|forecast|expense|expenses|income|savings)\b/.test(normalized)) {
      return "finance";
    }
    if (/\b(workflow|automation|pipeline|ops|operation|task|todo|request|ticket|roadmap|kanban)\b/.test(normalized)) {
      return "operations";
    }
    if (/\b(note|notes|wiki|knowledge|document|brief|memo|outline|mindmap)\b/.test(normalized)) {
      return "knowledge";
    }
    if (/\b(presentation|slides?|deck|pitch|story|campaign|content|brand)\b/.test(normalized)) {
      return "narrative";
    }
    if (/\b(design|wireframe|layout|ui|figma|visual|screen|frame)\b/.test(normalized)) {
      return "visual";
    }
    if (/\b(users?|customers?|clients?|leads?|members?|artists?|partners?|community|events?|bookings?|reservations?|appointments?|tickets?)\b/.test(normalized)) {
      return "community";
    }
    return "generic";
  })();

  const entity = (() => {
    if (/\b(note|notes|wiki|memo|brief)\b/.test(normalized)) {
      return { singular: "note", plural: "notes" };
    }
    if (/\b(transaction|transactions|budget|finance|expense|expenses|income|cash)\b/.test(normalized)) {
      return { singular: "transaction", plural: "transactions" };
    }
    if (/\b(task|tasks|todo|ticket|issue|request|backlog)\b/.test(normalized)) {
      return { singular: "task", plural: "tasks" };
    }
    if (/\b(bookings?|reservations?|appointments?|events?)\b/.test(normalized)) {
      return { singular: "booking", plural: "bookings" };
    }
    if (/\b(customer|client|lead|member|artist|partner|user)\b/.test(normalized)) {
      return { singular: "record", plural: "records" };
    }
    if (/\b(content|campaign|asset|story|slide|deck)\b/.test(normalized)) {
      return { singular: "asset", plural: "assets" };
    }
    return theme === "knowledge"
      ? { singular: "entry", plural: "entries" }
      : { singular: "item", plural: "items" };
  })();

  return {
    normalized,
    theme,
    subject: deriveArtifactSubject(spec, prompt, context),
    entitySingular: entity.singular,
    entityPlural: entity.plural,
    hasMetrics:
      spec?.documentType === "dashboard" ||
      /\b(metric|metrics|kpi|dashboard|analytics|performance|budget|forecast|tracking|track)\b/.test(
        normalized
      ),
    hasCategories:
      /\b(category|categories|tag|tags|segment|segments|label|labels|bucket|buckets|type|types)\b/.test(
        normalized
      ) || theme === "finance",
    hasPlanning:
      /\b(plan|planning|roadmap|month|monthly|week|weekly|timeline|schedule|calendar|forecast)\b/.test(
        normalized
      ) || theme === "finance",
    hasReview:
      /\b(review|approve|approval|validate|qa|stakeholder|comment|feedback)\b/.test(normalized) ||
      theme === "narrative",
    hasCapture:
      /\b(capture|add|create|write|entry|entries|log|record|note|transaction|task|item|row)\b/.test(
        normalized
      ) || ["knowledge", "finance", "operations", "community"].includes(theme),
    hasAutomation:
      spec?.documentType === "workflow" ||
      /\b(workflow|automation|pipeline|trigger|handoff|sync|scheduled|event driven)\b/.test(
        normalized
      ),
    hasVisual:
      spec?.documentType === "design" ||
      /\b(design|wireframe|layout|ui|screen|frame|visual)\b/.test(normalized)
  };
}

function buildArtifactBlueprint(spec, prompt = "", context = {}) {
  const capabilities = inferArtifactCapabilities(spec, prompt, context);
  const subject = capabilities.subject;
  const subjectLower = subject.toLowerCase();

  const presets = {
    finance: {
      eyebrow: "Finance workspace",
      summary: `Track ${subjectLower} with clear money flows, categories and plan signals.`,
      metrics: [
        { label: "Income", value: "12.8k EUR", delta: "+6%", tone: "up" },
        { label: "Spend", value: "8.1k EUR", delta: "-3%", tone: "down" },
        { label: "Net", value: "4.7k EUR", delta: "+14%", tone: "up" },
        { label: "Savings rate", value: "36%", delta: "+5 pts", tone: "up" }
      ],
      chartA: {
        title: "Monthly flow",
        kind: "line",
        points: [
          { label: "W1", value: 18 },
          { label: "W2", value: 22 },
          { label: "W3", value: 28 },
          { label: "W4", value: 31 }
        ]
      },
      chartB: {
        title: "Category mix",
        kind: "bar",
        points: [
          { label: "Housing", value: 34 },
          { label: "Food", value: 21 },
          { label: "Transport", value: 12 },
          { label: "Leisure", value: 10 }
        ]
      },
      headers: ["Date", "Category", "Amount", "Status", "Note"],
      rows: [
        ["2026-04-02", "Groceries", "84 EUR", "Logged", "Weekly essentials"],
        ["2026-04-05", "Transport", "36 EUR", "Logged", "Monthly pass top-up"],
        ["2026-04-07", "Leisure", "42 EUR", "Watch", "Weekend budget limit"]
      ],
      frames: [
        { id: "dashboard", name: "Dashboard", goal: `See the current health of ${subjectLower}.`, blocks: ["KPI header", "Trend chart", "Category bars", "Alerts"] },
        { id: "records", name: "Transactions", goal: "Capture and review the latest movements clearly.", blocks: ["Quick entry", "Records table", "Filters", "Status rail"] },
        { id: "plan", name: "Monthly plan", goal: "Keep goals, allocations and next decisions visible.", blocks: ["Targets", "Category plan", "Cash view", "Next action"] }
      ],
      palette: [
        { name: "Graphite", value: "#18212B" },
        { name: "Mint", value: "#5EB6A8" },
        { name: "Gold", value: "#D7A35B" },
        { name: "Canvas", value: "#F8F4EC" }
      ]
    },
    operations: {
      eyebrow: "Operations system",
      summary: `Run ${subjectLower} with clear intake, ownership and next actions.`,
      metrics: [
        { label: "Incoming", value: "42", delta: "+5", tone: "up" },
        { label: "In progress", value: "18", delta: "+2", tone: "up" },
        { label: "Blocked", value: "4", delta: "-1", tone: "down" },
        { label: "Closed", value: "27", delta: "+6", tone: "up" }
      ],
      chartA: {
        title: "Throughput by week",
        kind: "line",
        points: [
          { label: "W1", value: 12 },
          { label: "W2", value: 18 },
          { label: "W3", value: 21 },
          { label: "W4", value: 27 }
        ]
      },
      chartB: {
        title: "Status mix",
        kind: "bar",
        points: [
          { label: "Queued", value: 14 },
          { label: "Doing", value: 18 },
          { label: "Review", value: 6 },
          { label: "Closed", value: 27 }
        ]
      },
      headers: ["Task", "Owner", "Status", "Priority", "Next move"],
      rows: [
        ["Qualify incoming request", "Ops", "Doing", "High", "Clarify missing constraint"],
        ["Build first version", "Execution", "Review", "High", "Validate with one user"],
        ["Close remaining blockers", "Lead", "Queued", "Medium", "Assign clear owner"]
      ],
      frames: [
        { id: "queue", name: "Queue", goal: "Make intake visible and sortable.", blocks: ["Filters", "Queue list", "Priority tags", "Bulk actions"] },
        { id: "board", name: "Board", goal: "Move work across stages without losing flow.", blocks: ["Columns", "Cards", "Owners", "Due dates"] },
        { id: "detail", name: "Task detail", goal: "Open context, dependencies and next step in one place.", blocks: ["Header", "Checklist", "Comments", "Decision log"] }
      ],
      palette: [
        { name: "Ink", value: "#1D2630" },
        { name: "Sky", value: "#4C84FF" },
        { name: "Amber", value: "#D89A3A" },
        { name: "Stone", value: "#F5F1EA" }
      ]
    },
    knowledge: {
      eyebrow: "Knowledge workspace",
      summary: `Capture, structure and revisit ${subjectLower} without losing context.`,
      metrics: [
        { label: "Entries", value: "148", delta: "+12", tone: "up" },
        { label: "Reviewed", value: "34", delta: "+6", tone: "up" },
        { label: "Linked", value: "22", delta: "+4", tone: "up" },
        { label: "Needs update", value: "7", delta: "-2", tone: "down" }
      ],
      chartA: {
        title: "Capture rhythm",
        kind: "line",
        points: [
          { label: "Mon", value: 5 },
          { label: "Tue", value: 8 },
          { label: "Wed", value: 6 },
          { label: "Thu", value: 10 }
        ]
      },
      chartB: {
        title: "Entry types",
        kind: "bar",
        points: [
          { label: "Notes", value: 34 },
          { label: "Guides", value: 18 },
          { label: "References", value: 12 },
          { label: "Decisions", value: 7 }
        ]
      },
      headers: ["Title", "Type", "Status", "Last touched", "Note"],
      rows: [
        ["Core note", "Note", "Fresh", "Today", "Keep as source of truth"],
        ["Reference page", "Guide", "Review", "2 days ago", "Update examples"],
        ["Decision log", "Decision", "Stable", "Last week", "No blocker"]
      ],
      frames: [
        { id: "home", name: "Home", goal: "Open with the most useful knowledge surface.", blocks: ["Search", "Recent entries", "Pinned notes", "Quick capture"] },
        { id: "library", name: "Library", goal: "Browse notes, docs and references by structure.", blocks: ["Collections", "Entry list", "Filters", "Tags"] },
        { id: "entry", name: "Entry detail", goal: "Read, edit and link one entry with clear context.", blocks: ["Header", "Body", "Linked entries", "Status"] }
      ],
      palette: [
        { name: "Navy", value: "#1E2D3C" },
        { name: "Teal", value: "#4FA6A6" },
        { name: "Sand", value: "#E2C79A" },
        { name: "Paper", value: "#FBF7F0" }
      ]
    },
    narrative: {
      eyebrow: "Narrative workspace",
      summary: `Shape the story, proof and delivery assets around ${subjectLower}.`,
      metrics: [
        { label: "Drafts", value: "6", delta: "+2", tone: "up" },
        { label: "Approved", value: "3", delta: "+1", tone: "up" },
        { label: "Review cycles", value: "2", delta: "-1", tone: "down" },
        { label: "Ready to share", value: "1", delta: "+1", tone: "up" }
      ],
      chartA: {
        title: "Narrative progress",
        kind: "line",
        points: [
          { label: "Draft", value: 20 },
          { label: "Review", value: 44 },
          { label: "Approved", value: 71 },
          { label: "Shared", value: 100 }
        ]
      },
      chartB: {
        title: "Asset mix",
        kind: "bar",
        points: [
          { label: "Slides", value: 5 },
          { label: "One-pagers", value: 2 },
          { label: "Proof points", value: 8 },
          { label: "Stories", value: 4 }
        ]
      },
      headers: ["Asset", "Owner", "Status", "Audience", "Next move"],
      rows: [
        ["Core narrative", "Strategy", "Draft", "Stakeholders", "Clarify the promise"],
        ["Proof set", "Research", "Review", "Decision makers", "Tighten evidence"],
        ["Shareable deck", "Lead", "Queued", "Partners", "Prepare final pass"]
      ],
      frames: [
        { id: "story", name: "Story", goal: "Clarify the main narrative and promise fast.", blocks: ["Headline", "Core message", "Proof", "CTA"] },
        { id: "assets", name: "Assets", goal: "Organize narrative assets in one working view.", blocks: ["Deck list", "Status", "Review flags", "Owners"] },
        { id: "delivery", name: "Delivery", goal: "Prepare the final presentation or shareable artifact.", blocks: ["Audience switch", "Key slides", "Proof pack", "Next step"] }
      ],
      palette: [
        { name: "Midnight", value: "#171C31" },
        { name: "Coral", value: "#FF765C" },
        { name: "Lavender", value: "#8E8CFF" },
        { name: "Ivory", value: "#FCF7F0" }
      ]
    },
    visual: {
      eyebrow: "Design workspace",
      summary: `Turn ${subjectLower} into a clear, reusable interface system.`,
      metrics: [
        { label: "Frames", value: "4", delta: "+1", tone: "up" },
        { label: "Components", value: "12", delta: "+3", tone: "up" },
        { label: "Variants", value: "6", delta: "+2", tone: "up" },
        { label: "Needs review", value: "2", delta: "-1", tone: "down" }
      ],
      chartA: {
        title: "Coverage by frame",
        kind: "bar",
        points: [
          { label: "Landing", value: 72 },
          { label: "Workspace", value: 66 },
          { label: "Detail", value: 58 },
          { label: "Mobile", value: 42 }
        ]
      },
      chartB: {
        title: "Component reuse",
        kind: "line",
        points: [
          { label: "Base", value: 3 },
          { label: "Shared", value: 7 },
          { label: "Expanded", value: 12 },
          { label: "Refined", value: 16 }
        ]
      },
      headers: ["Frame", "Goal", "Status", "Primary block", "Next move"],
      rows: [
        ["Landing", "Explain value fast", "Draft", "Hero", "Tighten hierarchy"],
        ["Workspace", "Make action obvious", "Review", "Main stage", "Improve spacing"],
        ["Details", "Reveal context cleanly", "Queued", "Inspector", "Define secondary actions"]
      ],
      frames: [
        { id: "landing", name: "Landing", goal: "Explain value fast and guide the first action.", blocks: ["Top navigation", "Hero", "Proof row", "Primary CTA"] },
        { id: "workspace", name: "Workspace", goal: "Expose the main canvas and the key working loop.", blocks: ["Sidebar", "Canvas", "Inspector", "Toolbar"] },
        { id: "detail", name: "Detail", goal: "Show structure, properties and secondary actions cleanly.", blocks: ["Context", "Inspector", "History", "Comments"] }
      ],
      palette: [
        { name: "Carbon", value: "#1A2230" },
        { name: "Blue", value: "#5B7CFF" },
        { name: "Peach", value: "#E29A62" },
        { name: "Cloud", value: "#F7F3EC" }
      ]
    },
    community: {
      eyebrow: "Community workspace",
      summary: `Track people, events and follow-up around ${subjectLower}.`,
      metrics: [
        { label: "Active members", value: "124", delta: "+14", tone: "up" },
        { label: "New this week", value: "21", delta: "+6", tone: "up" },
        { label: "Engaged", value: "48%", delta: "+4 pts", tone: "up" },
        { label: "Needs follow-up", value: "9", delta: "-2", tone: "down" }
      ],
      chartA: {
        title: "Engagement trend",
        kind: "line",
        points: [
          { label: "W1", value: 22 },
          { label: "W2", value: 28 },
          { label: "W3", value: 35 },
          { label: "W4", value: 48 }
        ]
      },
      chartB: {
        title: "Segment mix",
        kind: "bar",
        points: [
          { label: "New", value: 21 },
          { label: "Active", value: 52 },
          { label: "Returning", value: 34 },
          { label: "At risk", value: 9 }
        ]
      },
      headers: ["Record", "Stage", "Last activity", "Status", "Next move"],
      rows: [
        ["Core record", "Active", "Today", "Healthy", "Send next update"],
        ["New contact", "Qualify", "Yesterday", "Watch", "Collect one more detail"],
        ["Returning member", "Retain", "This week", "Healthy", "Offer next action"]
      ],
      frames: [
        { id: "discover", name: "Discover", goal: "Help people find the right records or moments quickly.", blocks: ["Filters", "Cards", "Highlights", "Primary action"] },
        { id: "profile", name: "Profile", goal: "Combine context, history and next move in one screen.", blocks: ["Header", "Activity", "Details", "CTA"] },
        { id: "followup", name: "Follow-up", goal: "Keep the next action obvious after each interaction.", blocks: ["Checklist", "Timeline", "Owner", "Reminder"] }
      ],
      palette: [
        { name: "Deep Blue", value: "#1D2740" },
        { name: "Coral", value: "#EA7A63" },
        { name: "Mint", value: "#5CB8A8" },
        { name: "Paper", value: "#FBF7F1" }
      ]
    },
    generic: {
      eyebrow: "Workspace",
      summary: `Organize ${subjectLower} into something visible, editable and operational.`,
      metrics: [
        { label: "Active items", value: "24", delta: "+4", tone: "up" },
        { label: "Completed", value: "12", delta: "+3", tone: "up" },
        { label: "In review", value: "5", delta: "-1", tone: "down" },
        { label: "Attention", value: "3", delta: "-1", tone: "down" }
      ],
      chartA: {
        title: "Progress trend",
        kind: "line",
        points: [
          { label: "Step 1", value: 18 },
          { label: "Step 2", value: 32 },
          { label: "Step 3", value: 48 },
          { label: "Step 4", value: 64 }
        ]
      },
      chartB: {
        title: "Work mix",
        kind: "bar",
        points: [
          { label: "Core", value: 41 },
          { label: "Review", value: 22 },
          { label: "Support", value: 18 },
          { label: "Explore", value: 11 }
        ]
      },
      headers: ["Item", "Owner", "Status", "Next move"],
      rows: [
        ["Core item", "Lead", "Doing", "Push the main version"],
        ["Secondary item", "Ops", "Review", "Validate the structure"],
        ["Next step", "Hydria", "Queued", "Open the best follow-up"]
      ],
      frames: [
        { id: "overview", name: "Overview", goal: "Open the main state of the system immediately.", blocks: ["Header", "Summary", "Metrics", "Next action"] },
        { id: "workspace", name: "Workspace", goal: "Work on the current object directly.", blocks: ["Canvas", "Sidebar", "Properties", "Actions"] },
        { id: "detail", name: "Detail", goal: "Reveal context and secondary controls when needed.", blocks: ["Context", "Inspector", "History", "Comments"] }
      ],
      palette: [
        { name: "Ink", value: "#202735" },
        { name: "Aqua", value: "#5B9BA0" },
        { name: "Amber", value: "#D59A57" },
        { name: "Shell", value: "#F8F3EC" }
      ]
    }
  };

  const preset = presets[capabilities.theme] || presets.generic;
  const specializedTable =
    capabilities.entitySingular === "booking"
      ? {
          headers: ["Date", "Room", "Requester", "Status", "Next move"],
          rows: [
            ["2026-04-14", "Salle A", "Maison des associations", "Confirmed", "Send reminder"],
            ["2026-04-16", "Salle B", "Club local", "Review", "Validate equipment needs"],
            ["2026-04-18", "Salle C", "Mairie annexe", "Pending", "Approve final slot"]
          ]
        }
      : capabilities.entitySingular === "note"
        ? {
            headers: ["Title", "Category", "Status", "Last touched", "Note"],
            rows: [
              ["Core note", "Primary", "Fresh", "Today", "Keep as source of truth"],
              ["Reference note", "Support", "Review", "Yesterday", "Clarify examples"],
              ["Next note", "Queued", "Draft", "This week", "Expand when needed"]
            ]
          }
        : null;
  const tableHeaders = [...(specializedTable?.headers || preset.headers)];
  if (capabilities.hasCategories && !tableHeaders.includes("Category")) {
    tableHeaders.splice(Math.min(1, tableHeaders.length), 0, "Category");
  }
  if (capabilities.hasPlanning && !tableHeaders.includes("Plan")) {
    tableHeaders.push("Plan");
  }

  const tableRows = (specializedTable?.rows || preset.rows).map((row) => {
    const cells = [...row];
    if (capabilities.hasCategories && tableHeaders.includes("Category") && cells.length < tableHeaders.length) {
      cells.splice(1, 0, `${subject} ${capabilities.entitySingular}`);
    }
    while (cells.length < tableHeaders.length) {
      cells.push("Adjust in Hydria");
    }
    return cells.slice(0, tableHeaders.length);
  });

  const stagesByTheme = {
    finance: [
      ["capture", "Capture", "Ops", `Log each ${capabilities.entitySingular} with the right amount and date.`],
      ["categorize", "Categorize", "Finance", "Keep categories stable enough to compare periods."],
      ["review", "Review", "Lead", "Check variances, outliers and priorities."],
      ["plan", "Plan", "Owner", "Decide the next budget move or guardrail."],
      ["close", "Close", "Hydria", "Persist the update and keep the next step visible."]
    ],
    operations: [
      ["intake", "Intake", "Ops", `Capture each ${capabilities.entitySingular} with clear context.`],
      ["triage", "Triage", "Lead", "Set priority, owner and scope."],
      ["execute", "Execute", "Execution", "Build the first usable result quickly."],
      ["review", "Review", "QA", "Validate quality and unblock the next action."],
      ["close", "Close", "Workspace", "Persist, expose and continue from the same project."]
    ],
    knowledge: [
      ["capture", "Capture", "Author", `Write the first version of the ${capabilities.entitySingular}.`],
      ["structure", "Structure", "Editor", "Place it in the right collection and add links."],
      ["enrich", "Enrich", "Hydria", "Expand examples, context and references."],
      ["review", "Review", "Lead", "Check clarity and gaps."],
      ["publish", "Publish", "Workspace", "Open the result where it can be reused."]
    ],
    narrative: [
      ["brief", "Brief", "Strategy", "Clarify audience, message and evidence."],
      ["draft", "Draft", "Creative", "Produce the first narrative version."],
      ["review", "Review", "Lead", "Tighten the story and proof."],
      ["deliver", "Deliver", "Workspace", "Open the final asset in the right surface."],
      ["iterate", "Iterate", "Hydria", "Capture feedback and improve the same object."]
    ],
    visual: [
      ["brief", "Brief", "Product", "Define the desired feeling and use case."],
      ["wireframe", "Wireframe", "Design", "Lay out frames and content blocks."],
      ["systemize", "Systemize", "Design", "Stabilize components and tokens."],
      ["review", "Review", "Lead", "Check hierarchy and usability."],
      ["handoff", "Handoff", "Workspace", "Expose the editable wireframe in Hydria."]
    ],
    community: [
      ["source", "Source", "Ops", `Capture the right ${capabilities.entityPlural}.`],
      ["qualify", "Qualify", "Lead", "Decide who deserves follow-up first."],
      ["activate", "Activate", "Growth", "Create the first meaningful action."],
      ["support", "Support", "Ops", "Keep friction low after the first interaction."],
      ["retain", "Retain", "Hydria", "Measure what keeps engagement alive."]
    ],
    generic: [
      ["capture", "Capture", "Hydria", "Understand the request and the real goal."],
      ["build", "Build", "Execution", "Create the first usable version."],
      ["review", "Review", "Critic", "Check clarity, quality and usefulness."],
      ["deliver", "Deliver", "Workspace", "Open it in the right environment."],
      ["improve", "Improve", "Hydria", "Continue on the same object or project."]
    ]
  };
  const workflowStages = (stagesByTheme[capabilities.theme] || stagesByTheme.generic).map(
    ([id, label, owner, note]) => ({ id, label, owner, note })
  );

  return {
    ...capabilities,
    title: spec.title,
    subject,
    summary: preset.summary,
    eyebrow: preset.eyebrow,
    filters: capabilities.hasPlanning
      ? ["This month", "This quarter", "This project"]
      : ["All", "Active", "Needs review"],
    widgets: [
      {
        id: "widget-1",
        title: `${subject} overview`,
        type: "summary",
        summary: preset.summary
      },
      {
        id: "widget-2",
        title: capabilities.hasReview ? "Review focus" : "Attention point",
        type: "alert",
        summary: capabilities.hasReview
          ? "Keep the next review step obvious and lightweight."
          : "Surface the next action that keeps the project moving."
      }
    ],
    metrics: preset.metrics,
    charts: [preset.chartA, preset.chartB],
    table: {
      columns: tableHeaders,
      rows: tableRows
    },
    workflowStages,
    frames: preset.frames.map((frame) => ({
      ...frame,
      blocks: frame.blocks.map((block, index) => ({
        id: `${frame.id}-block-${index + 1}`,
        label: block,
        x: 24 + index * 18,
        y: 24 + index * 14,
        w: 180,
        h: 84
      }))
    })),
    components: preset.frames
      .flatMap((frame) => frame.blocks)
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 8),
    palette: preset.palette,
    slideOutline: [
      `Why ${subjectLower} matters now`,
      "Current friction and opportunity",
      "The operating environment",
      capabilities.hasMetrics ? "Signals and proof" : "What makes the approach credible",
      capabilities.hasPlanning ? "Roadmap and next move" : "Next step"
    ]
  };
}

function buildDashboardSource(spec, prompt = "", context = {}) {
  const blueprint = buildArtifactBlueprint(spec, prompt, context);
  return JSON.stringify(
    {
      title: spec.title,
      eyebrow: blueprint.eyebrow,
      summary: blueprint.summary,
      filters: blueprint.filters,
      widgets: blueprint.widgets,
      metrics: blueprint.metrics,
      charts: blueprint.charts,
      table: blueprint.table
    },
    null,
    2
  );
}

function buildWorkflowSource(spec, prompt = "", context = {}) {
  const blueprint = buildArtifactBlueprint(spec, prompt, context);
  const stages = blueprint.workflowStages;
  return JSON.stringify(
    {
      title: spec.title,
      objective: `Move ${blueprint.subject.toLowerCase()} from intake to usable result with a repeatable flow.`,
      trigger: `A new ${blueprint.entitySingular} or request enters the ${blueprint.subject.toLowerCase()} system`,
      stages,
      links: stages.slice(0, -1).map((stage, index) => ({
        id: `link-${index + 1}`,
        from: stage.id,
        to: stages[index + 1].id,
        label: `${stage.label} complete`
      })),
      automations: [
        `When a ${blueprint.entitySingular} is captured, create the right work object automatically.`,
        blueprint.hasReview
          ? "If review fails, return the item to the previous stage with one clear correction."
          : "If the result is weak, request one focused improvement pass automatically.",
        "When the result is delivered, keep it linked to the current project and conversation."
      ],
      outputs: [
        `Structured ${blueprint.entitySingular}`,
        "Visible next action",
        "Persistent project continuity"
      ]
    },
    null,
    2
  );
}

function buildDesignSource(spec, prompt = "", context = {}) {
  const blueprint = buildArtifactBlueprint(spec, prompt, context);
  return JSON.stringify(
    {
      title: spec.title,
      brief: blueprint.summary,
      palette: blueprint.palette,
      typography: {
        heading: "Space Grotesk",
        body: "Inter",
        mood:
          blueprint.theme === "finance"
            ? "Confident, analytical, calm"
            : blueprint.theme === "narrative"
              ? "Editorial, expressive, clear"
              : blueprint.theme === "visual"
                ? "Precise, premium, direct"
                : "Clear, structured, modern"
      },
      frames: blueprint.frames.map((frame) => ({
        id: frame.id,
        name: frame.name,
        goal: frame.goal,
        blocks: frame.blocks.map((block) => block.label)
      })),
      components: blueprint.components
    },
    null,
    2
  );
}

function buildBenchmarkSource(spec, prompt = "", context = {}) {
  const blueprint = buildArtifactBlueprint(spec, prompt, context);
  const criteria = [
    { id: "positioning", label: "Positioning clarity", why: "Can a user understand the offer in one glance?" },
    { id: "workflow", label: "Workflow quality", why: "How usable and coherent is the end-to-end experience?" },
    { id: "proof", label: "Proof and trust", why: "What makes the offer credible quickly?" },
    { id: "retention", label: "Retention loop", why: "What brings the user back or keeps the system alive?" }
  ];
  const competitors = [
    {
      id: "competitor-1",
      name: `${blueprint.subject} baseline`,
      positioning: `A simple reference point for ${blueprint.subject.toLowerCase()}.`,
      strengths: blueprint.metrics.slice(0, 2).map((metric) => metric.label),
      gaps: ["Weak differentiation", "Low narrative clarity"],
      scorecard: {
        positioning: 3,
        workflow: 3,
        proof: 2,
        retention: 2
      }
    },
    {
      id: "competitor-2",
      name: `Operator-first alternative`,
      positioning: `A more execution-heavy approach to ${blueprint.subject.toLowerCase()}.`,
      strengths: ["Operational depth", "Visible next action"],
      gaps: ["Harder to onboard", "Lower emotional pull"],
      scorecard: {
        positioning: 3,
        workflow: 4,
        proof: 3,
        retention: 3
      }
    },
    {
      id: "competitor-3",
      name: `Story-led alternative`,
      positioning: `A more narrative and presentation-friendly take on ${blueprint.subject.toLowerCase()}.`,
      strengths: ["Clear story", "High surface appeal"],
      gaps: ["Shallower system depth", "Less operational rigor"],
      scorecard: {
        positioning: 4,
        workflow: 2,
        proof: 3,
        retention: 2
      }
    }
  ];

  return JSON.stringify(
    {
      title: spec.title,
      subject: blueprint.subject,
      objective: `Compare the most relevant approaches around ${blueprint.subject.toLowerCase()} and identify the strongest opening.`,
      criteria,
      competitors,
      opportunities: [
        "Combine narrative clarity with an operational core instead of choosing one side.",
        "Make the next action visible immediately in the first screen.",
        "Turn proof into a native object of the project instead of a separate report."
      ],
      recommendations: [
        `Use ${blueprint.subject.toLowerCase()} as the anchor promise across every surface.`,
        "Prioritize one strong use case before expanding the system breadth.",
        "Keep the benchmark linked to the project so it can evolve with the product."
      ]
    },
    null,
    2
  );
}

function buildCampaignSource(spec, prompt = "", context = {}) {
  const blueprint = buildArtifactBlueprint(spec, prompt, context);
  return JSON.stringify(
    {
      title: spec.title,
      objective: `Launch and explain ${blueprint.subject.toLowerCase()} with one clear promise and a believable activation sequence.`,
      audience: spec.audience,
      corePromise: blueprint.summary,
      audiences: [
        {
          segment: "Primary audience",
          message: `Show how ${blueprint.subject.toLowerCase()} removes friction and makes the next step obvious.`,
          hook: blueprint.metrics[0]?.label || "Immediate clarity"
        },
        {
          segment: "Stakeholders",
          message: "Translate the system into outcomes, proof points and confidence signals.",
          hook: "Visible impact"
        }
      ],
      channels: [
        { id: "channel-1", name: "Landing page", goal: "Make the promise and flow instantly understandable." },
        { id: "channel-2", name: "Short social sequence", goal: "Turn one strong moment into repeatable attention." },
        { id: "channel-3", name: "Email or outreach follow-up", goal: "Convert interest into the next concrete action." }
      ],
      assets: [
        "Hero message",
        "One-page product story",
        "Short visual teaser",
        "Proof snapshot"
      ],
      timeline: [
        { phase: "Week 1", focus: "Clarify promise and produce launch assets" },
        { phase: "Week 2", focus: "Launch the first channel and collect reactions" },
        { phase: "Week 3", focus: "Double down on the angle with the best signal" }
      ],
      kpis: [
        "Response quality",
        "Activation rate",
        "Follow-up conversion",
        "Repeat engagement"
      ]
    },
    null,
    2
  );
}

function buildAudioSource(spec, prompt = "", context = {}) {
  const blueprint = buildArtifactBlueprint(spec, prompt, context);
  return JSON.stringify(
    {
      title: spec.title,
      objective: `Produce an audio asset that explains or supports ${blueprint.subject.toLowerCase()} clearly.`,
      format: "audio-production-brief",
      duration: "45-90 seconds",
      voice: {
        tone: spec.tone,
        style: "direct, warm and confident"
      },
      segments: [
        {
          id: "segment-1",
          title: "Hook",
          purpose: "State why the subject matters right now.",
          script: `What if ${blueprint.subject.toLowerCase()} felt immediately clear instead of fragmented?`,
          cue: "Short branded sonic hit"
        },
        {
          id: "segment-2",
          title: "Core value",
          purpose: "Explain the operating promise.",
          script: blueprint.summary,
          cue: "Steady pulse under the narration"
        },
        {
          id: "segment-3",
          title: "Next action",
          purpose: "End on a strong call to action.",
          script: "Open the project, interact with the system, and keep shaping it with Hydria.",
          cue: "Resolve with a clean outro"
        }
      ],
      deliverables: [
        "Primary voiceover script",
        "Music and cue sheet",
        "Short cutdown variant"
      ]
    },
    null,
    2
  );
}

function buildVideoSource(spec, prompt = "", context = {}) {
  const blueprint = buildArtifactBlueprint(spec, prompt, context);
  const appBlueprint = context?.appBlueprint || null;
  const derivedScenes = appBlueprint
    ? (appBlueprint.pages || []).slice(0, 3).map((page, index) => ({
        id: `scene-${index + 2}`,
        title: page.title || `Product view ${index + 1}`,
        duration: index === 0 ? "18s" : "15s",
        visual: `Show the ${page.label || page.title} view in the live app and focus on what the user can do there immediately.`,
        voiceover: page.intro || page.summary || `Walk through ${page.title || "the current view"} and why it matters.`,
        onScreen: compactBulletList(page.signals || [], 2).join(" · ") || "Current product flow"
      }))
    : [];

  return JSON.stringify(
    {
      title: spec.title,
      objective: `Create a presentation or launch video around ${blueprint.subject.toLowerCase()} without losing the real product logic.`,
      runtime: "60-90 seconds",
      visualDirection: blueprint.theme === "visual" ? "bold and product-led" : "clean, structured and premium",
      scenes: [
        {
          id: "scene-1",
          title: "Problem frame",
          duration: "10s",
          visual: "Fast contrast between fragmented work and a unified workspace.",
          voiceover: `Most teams still manage ${blueprint.subject.toLowerCase()} with too much friction.`,
          onScreen: "The old way breaks momentum"
        },
        ...(derivedScenes.length
          ? derivedScenes
          : [
              {
                id: "scene-2",
                title: "Product reveal",
                duration: "20s",
                visual: "Show the project shell and the main interactive surface.",
                voiceover: blueprint.summary,
                onScreen: "One project. Multiple native objects."
              },
              {
                id: "scene-3",
                title: "Workflow proof",
                duration: "20s",
                visual: "Chain app -> benchmark -> presentation -> campaign in the same project.",
                voiceover: "Hydria keeps every output inside the same living system instead of resetting the work.",
                onScreen: "Continuity becomes visible"
              }
            ]),
        {
          id: `scene-${derivedScenes.length ? derivedScenes.length + 2 : 4}`,
          title: "Close",
          duration: "10s",
          visual: "Return to the workspace with the next object already open.",
          voiceover: "Ask for the next output. Keep working in the same place.",
          onScreen: "Build, transform, keep going"
        }
      ],
      deliverables: [
        "Storyboard",
        "Voiceover script",
        "On-screen text plan",
        "Publishing cutdown"
      ]
    },
    null,
    2
  );
}

function buildFallbackDraft(spec, prompt, attachmentEvidenceUsed = [], context = {}) {
  if (["benchmark", "campaign", "audio", "video"].includes(spec.documentType)) {
    const builder =
      spec.documentType === "benchmark"
        ? buildBenchmarkSource
        : spec.documentType === "campaign"
          ? buildCampaignSource
          : spec.documentType === "audio"
            ? buildAudioSource
            : buildVideoSource;
    return builder(spec, prompt, context);
  }

  if (spec.documentType === "image") {
    const blueprint = buildArtifactBlueprint(spec, prompt, context);
    return [
      `# ${spec.title}`,
      "",
      "## Visual direction",
      blueprint.summary,
      "",
      "## Core elements",
      ...blueprint.frames.slice(0, 3).map((frame) => `- ${frame.name}: ${frame.goal}`),
      "",
      "## Highlights",
      ...blueprint.metrics.slice(0, 4).map((metric) => `- ${metric.label}: ${metric.value}`)
    ].join("\n");
  }

  if (spec.documentType === "presentation") {
    const blueprint = buildArtifactBlueprint(spec, prompt, context);
    const slideSections = (spec.sections || [])
      .filter((section) => String(section?.heading || "").trim())
      .slice(0, 6);
    const placeholderSections =
      slideSections.length > 0 &&
      slideSections.every((section) =>
        /^(title slide|why it matters|key advantages|proof points|takeaways|introduction|main points|conclusion)$/i.test(
          String(section.heading || "").trim()
        )
      );

    return [
      `# ${spec.title}`,
      "",
      ...(slideSections.length
        && !placeholderSections
        ? slideSections.flatMap((section, index) => [
            `## Slide ${index + 1} - ${section.heading}`,
            section.goal || "State the key idea simply and clearly.",
            ""
          ])
        : blueprint.slideOutline.flatMap((title, index) => [
            `## Slide ${index + 1} - ${title}`,
            index === 0
              ? `Explain why ${blueprint.subject.toLowerCase()} deserves attention now.`
              : index === 1
                ? "State the main friction, opportunity and what changes if this improves."
                : index === 2
                  ? "Describe the environment, workflow or product logic in a concrete way."
                  : index === 3
                    ? "Add signals, proof points or practical evidence that make the case credible."
                    : "Close with the next decision, milestone or action.",
            ""
          ]))
    ].join("\n");
  }

  if (spec.documentType === "business plan") {
    const blueprint = buildArtifactBlueprint(spec, prompt, context);
    return [
      `# ${spec.title}`,
      "",
      "## Executive Summary",
      `${blueprint.subject} is positioned as a ${blueprint.theme} environment designed to turn a fuzzy workflow into something structured, visible and repeatable.`,
      "",
      "## Problem and Solution",
      `The core problem is that ${blueprint.subject.toLowerCase()} is still managed with too much friction, weak visibility and fragmented decisions. The solution is a focused environment that combines structure, execution and follow-up in one system.`,
      "",
      "## Business Model",
      "- Start with one strong use case and one clear user outcome",
      "- Add monetization only after the core loop is working reliably",
      "- Keep the operating model simple enough to repeat and improve",
      "",
      "## Go-to-Market",
      "- Launch around one narrow audience and one urgent pain point",
      "- Use direct feedback to tighten the product loop quickly",
      "- Turn early usage into repeatable proof, not just vanity activity",
      "",
      "## Operations",
      "- Keep the workflow visible from intake to delivery",
      "- Instrument ownership, quality and next action from the start",
      "- Use Hydria to persist, improve and extend the same project over time",
      "",
      "## Financial Outlook",
      "- Phase 1: validate value and user pull",
      "- Phase 2: improve retention, frequency and unit efficiency",
      "- Phase 3: expand scope only once the base workflow is reliable"
    ].join("\n");
  }

  const sections = [
    `# ${spec.title}`,
    "",
    `Type: ${spec.documentType}`,
    `Requested output: ${spec.format.toUpperCase()}`,
    ""
  ];

  if (prompt) {
    sections.push("## Request");
    sections.push(prompt);
    sections.push("");
  }

  for (const section of spec.sections) {
    sections.push(`## ${section.heading}`);
    sections.push(section.goal || "Develop this section clearly and directly.");
    sections.push("");
  }

  if (attachmentEvidenceUsed.length) {
    sections.push("## Source Evidence");
    for (const evidence of attachmentEvidenceUsed.slice(0, 4)) {
      sections.push(
        `- ${evidence.filename} / ${evidence.sectionTitle}: ${evidence.excerpt || ""}`
      );
    }
    sections.push("");
  }

  sections.push("## Conclusion");
  sections.push("This document was generated from the available request context and evidence.");

  return sections.join("\n");
}

function inferNumericRange(prompt = "") {
  const normalized = String(prompt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const match = normalized.match(
    /\b(?:de|from)\s*(\d+)\s*(?:a|to|-)\s*(\d+)\b|\b(\d+)\s*(?:a|to|-)\s*(\d+)\b/
  );

  if (!match) {
    const looseMatch = normalized.match(/\b(\d+)\s*[^\d]{1,4}\s*(\d+)\b/);
    if (!looseMatch) {
      return null;
    }

    const start = Number(looseMatch[1] || 0);
    const end = Number(looseMatch[2] || 0);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 5000) {
      return null;
    }

    return { start, end };
  }

  const start = Number(match[1] || match[3] || 0);
  const end = Number(match[2] || match[4] || 0);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 5000) {
    return null;
  }

  return { start, end };
}

function buildSpreadsheetSource(spec, prompt, context = {}) {
  const normalizedPrompt = [
    prompt,
    spec?.title,
    spec?.topic,
    context?.headline,
    spec?.sections?.map((section) => section.heading).join(" ")
  ]
    .filter(Boolean)
    .join(" ");
  const numericRange = inferNumericRange(
    normalizedPrompt
  );
  const normalizedTopic = normalizedPrompt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (numericRange) {
    const lines = ["Number"];
    for (let value = numericRange.start; value <= numericRange.end; value += 1) {
      lines.push(String(value));
    }
    return lines.join("\n");
  }

  const blueprint = buildArtifactBlueprint(spec, prompt, context);
  const rows = [
    blueprint.table.columns.join(","),
    ...blueprint.table.rows.map((row) =>
      row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")
    )
  ];
  return rows.join("\n");
}

function buildAppDerivedPresentationSource(spec, appBlueprint = null, context = {}) {
  if (!appBlueprint) {
    return "";
  }

  const pages = appBlueprint.pages || [];
  const topViews = pages.slice(0, 4);
  const primaryView = topViews[0] || null;
  const problemLine =
    primaryView?.intro ||
    context.problem ||
    `Teams still struggle to manage ${String(appBlueprint.title || context.projectName || "the product").toLowerCase()} in a way that feels clear, actionable and repeatable.`;
  const promiseLine =
    appBlueprint.accentTitle ||
    appBlueprint.subtitle ||
    context.promise ||
    "The product creates one place to capture signal, make decisions and keep momentum.";
  const workflowBullets = topViews.flatMap((page) => [
    `- ${page.title}: ${page.intro || page.summary || "A clear working surface inside the product."}`,
    ...(page.signals || [])
      .filter(isMeaningfulAppSignal)
      .slice(0, 2)
      .map((signal) => `- ${signal}`)
  ]);
  const proofBullets = compactBulletList(
    [...(appBlueprint.proofPoints || []), ...(appBlueprint.workflowSummary || [])],
    6
  );
  const productFlowBullets = topViews.map((page, index) => {
    const shortSignals = (page.signals || []).filter(isMeaningfulAppSignal).slice(0, 2).join(" | ");
    return `- ${index + 1}. ${page.label || page.title}: ${shortSignals || page.intro || "A concrete product view with a direct next action."}`;
  });

  return [
    `# ${spec.title}`,
    "",
    `## Slide 1 - ${appBlueprint.title || context.projectName || "Product overview"}`,
    promiseLine,
    ...(appBlueprint.eyebrow ? [`- ${appBlueprint.eyebrow}`] : []),
    ...(appBlueprint.subtitle ? [`- ${appBlueprint.subtitle}`] : []),
    "",
    "## Slide 2 - Why this product matters now",
    problemLine,
    ...(context.audience ? [`- Audience: ${context.audience}`] : []),
    ...(primaryView?.summary ? [`- Core product loop: ${primaryView.summary}`] : []),
    "",
    "## Slide 3 - Product walkthrough",
    ...(workflowBullets.length ? workflowBullets : ["- Show the core product flow and the most useful views."]),
    "",
    "## Slide 4 - What users can do inside the app",
    ...(productFlowBullets.length
      ? productFlowBullets
      : topViews.map((page) => `- ${page.label || page.title}: ${page.summary || "A working view that keeps the user moving."}`)),
    "",
    "## Slide 5 - Product signals and proof points",
    ...(proofBullets.length
      ? proofBullets.filter(isMeaningfulAppSignal).map((item) => `- ${item}`)
      : ["- Use the strongest proof points, workflows and product signals from the current app."]),
    "",
    "## Slide 6 - Why this project can move now",
    `- The app already exposes concrete product surfaces, not just a concept: ${topViews
      .map((page) => page.label || page.title)
      .filter(Boolean)
      .slice(0, 4)
      .join(", ")}.`,
    `- Keep iterating on ${String(appBlueprint.title || context.projectName || "the product").toLowerCase()} inside the same project.`,
    "- Turn the current app into the next investor, launch or customer-facing asset without resetting the work."
  ].join("\n");
}

function buildPresentationSource(spec, markdown = "", context = {}) {
  const trimmed = String(markdown || "").trim();
  const normalizedExisting = normalizeArtifactText(trimmed);
  const looksPlaceholderDeck =
    /state the topic and the main promise|explain the context and why this topic deserves attention|present the strongest advantages/i.test(
      trimmed
    );
  const blueprint = buildArtifactBlueprint(spec, trimmed || spec?.title, context);
  const appDerivedDeck = buildAppDerivedPresentationSource(spec, context?.appBlueprint, context);
  const appTokens = compactBulletList([
    context?.appBlueprint?.title,
    ...(context?.appBlueprint?.pages || []).map((page) => page.title)
  ], 8).map((value) => normalizeArtifactText(value));
  const existingMentionsSourceApp = appTokens.filter(
    (token) => token && normalizedExisting.includes(token)
  ).length >= Math.min(2, appTokens.length);
  const existingMatchesTheme =
    !context?.theme ||
    (blueprint.theme === "finance" &&
      /\b(revenue|cost|margin|budget|cash|forecast)\b/.test(normalizedExisting)) ||
    (blueprint.theme === "narrative" &&
      /\b(audience|message|proof|story|deck|slide|narrative)\b/.test(normalizedExisting)) ||
    (blueprint.theme === "community" &&
      /\b(community|member|event|engagement|follow-up|partner)\b/.test(normalizedExisting)) ||
    (blueprint.theme === "operations" &&
      /\b(workflow|process|step|owner|handoff|queue)\b/.test(normalizedExisting)) ||
    blueprint.theme === "generic";

  if (
    /^#\s+/m.test(trimmed) &&
    /^##\s+/m.test(trimmed) &&
    existingMatchesTheme &&
    !looksPlaceholderDeck &&
    (!context?.appBlueprint || existingMentionsSourceApp)
  ) {
    return trimmed;
  }

  if (appDerivedDeck) {
    return appDerivedDeck;
  }

  const slidesFromSpec = (spec?.sections || [])
    .filter((section) => String(section?.heading || "").trim())
    .slice(0, 6)
    .map((section, index) => [
      `## Slide ${index + 1} - ${String(section.heading || "").trim()}`,
      String(section.goal || "State the key idea clearly and simply.").trim()
    ].join("\n"));
  const genericSectionDeck =
    slidesFromSpec.length > 0 &&
    slidesFromSpec.every((slide) =>
      /slide \d+ - (title slide|why it matters|key advantages|proof points|takeaways|introduction|main points|conclusion)/i.test(
        slide
      )
    );

  return [
    `# ${spec.title}`,
    "",
    ...(slidesFromSpec.length
      && !genericSectionDeck
      ? slidesFromSpec.flatMap((slide) => [slide, ""])
      : blueprint.slideOutline.flatMap((slide, index) => [
          `## Slide ${index + 1} - ${slide}`,
          index === 0
            ? `Introduce ${blueprint.subject.toLowerCase()} with the clearest promise possible.`
            : index === 1
              ? "Explain the main friction, gap or unmet need in direct language."
              : index === 2
                ? "Describe the environment, system or workflow that resolves the problem."
                : index === 3
                  ? "Use proof, metrics or concrete signals that make the story credible."
                  : "Close with the most useful next step, milestone or decision.",
          ""
        ]))
  ].join("\n");
}

function buildSourceDocument({ spec, prompt, markdown, context = {} }) {
  const format = String(spec?.format || "md").toLowerCase();
  const documentType = String(spec?.documentType || "document").toLowerCase();

  if (documentType === "dashboard") {
    const dashboardContent = buildDashboardSource(spec, prompt, context);
    return {
      title: spec.title,
      format: "json",
      kind: "dashboard",
      filename: "dashboard.json",
      content: dashboardContent,
      renderInput: dashboardContent
    };
  }

  if (documentType === "benchmark") {
    const benchmarkContent = buildBenchmarkSource(spec, prompt, context);
    return {
      title: spec.title,
      format: "json",
      kind: "benchmark",
      filename: "benchmark.json",
      content: benchmarkContent,
      renderInput: benchmarkContent
    };
  }

  if (documentType === "campaign") {
    const campaignContent = buildCampaignSource(spec, prompt, context);
    return {
      title: spec.title,
      format: "json",
      kind: "campaign",
      filename: "campaign.json",
      content: campaignContent,
      renderInput: campaignContent
    };
  }

  if (documentType === "workflow") {
    const workflowContent = buildWorkflowSource(spec, prompt, context);
    return {
      title: spec.title,
      format: "json",
      kind: "workflow",
      filename: "workflow.json",
      content: workflowContent,
      renderInput: workflowContent
    };
  }

  if (documentType === "design") {
    const designContent = buildDesignSource(spec, prompt, context);
    return {
      title: spec.title,
      format: "json",
      kind: "design",
      filename: "wireframe.json",
      content: designContent,
      renderInput: designContent
    };
  }

  if (documentType === "audio") {
    const audioContent = buildAudioSource(spec, prompt, context);
    return {
      title: spec.title,
      format: "json",
      kind: "audio",
      filename: "audio.json",
      content: audioContent,
      renderInput: audioContent
    };
  }

  if (documentType === "video") {
    const videoContent = buildVideoSource(spec, prompt, context);
    return {
      title: spec.title,
      format: "json",
      kind: "video",
      filename: "video.json",
      content: videoContent,
      renderInput: videoContent
    };
  }

  if (documentType === "spreadsheet" || documentType === "dataset" || ["xlsx", "csv"].includes(format)) {
    const csvContent = buildSpreadsheetSource(spec, prompt, context);
    return {
      title: spec.title,
      format: "csv",
      kind: "dataset",
      filename: "table.csv",
      content: csvContent,
      renderInput: csvContent
    };
  }

  if (documentType === "presentation" || format === "pptx") {
    const slidesMarkdown = buildPresentationSource(spec, markdown, context);
    return {
      title: spec.title,
      format: "md",
      kind: "presentation",
      filename: "slides.md",
      content: slidesMarkdown,
      renderInput: slidesMarkdown
    };
  }

  if (documentType === "image" || format === "image") {
    const imageBrief = String(markdown || "").trim() || buildFallbackDraft(spec, prompt, [], context);
    return {
      title: spec.title,
      format: "md",
      kind: "image",
      filename: "image-brief.md",
      content: imageBrief,
      renderInput: imageBrief
    };
  }

  return {
    title: spec.title,
    format: "md",
    kind: "document",
    filename: "content.md",
    content: markdown,
    renderInput: markdown
  };
}

function shouldUseDirectLocalArtifact(intent, prompt, attachments = [], seedDocument = null) {
  const documentType = String(intent?.documentType || "").toLowerCase();
  const normalizedPrompt = String(prompt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (attachments.length || seedDocument?.content) {
    return false;
  }

  if (["spreadsheet", "dataset"].includes(documentType)) {
    return true;
  }

  if (["dashboard", "workflow", "design"].includes(documentType)) {
    return true;
  }

  return (
    /\b(excel|spreadsheet|tableur|xlsx|csv|dataset|table|grille|colonnes?|lignes?)\b/.test(
      normalizedPrompt
    ) &&
    /\b(create|generate|make|build|cree|fais|genere|produis|fabrique)\b/.test(
      normalizedPrompt
    )
  );
}

function getArtifactPurposeAliases(documentType = "") {
  const normalized = String(documentType || "").toLowerCase();
  if (!normalized) {
    return [];
  }

  if (["spreadsheet", "dataset"].includes(normalized)) {
    return ["spreadsheet", "dataset"];
  }

  return [normalized];
}

function findArtifactGenerationStep(plan, stage = "", documentType = "") {
  const aliases = getArtifactPurposeAliases(documentType);
  const purposes = [
    ...aliases.map((alias) => `${alias}_${stage}`),
    `generation_${stage}`
  ];

  return (
    plan.steps.find((step) => step.type === "llm" && purposes.includes(step.purpose)) ||
    plan.steps.find((step) => step.type === "llm" && String(step.purpose || "").endsWith(`_${stage}`)) ||
    null
  );
}

function buildDraftInstruction(spec, context = {}) {
  const base = [
    "You are the writing agent for document generation.",
    "Write the requested content in Markdown only.",
    `Title: ${spec.title}`,
    `Format target: ${spec.format}`,
    `Document type: ${spec.documentType}`,
    `Audience: ${spec.audience}`,
    `Tone: ${spec.tone}`,
    `Sections: ${spec.sections.map((section) => `${section.heading} (${section.goal})`).join(" | ")}`
  ];

  if (["pptx", "image"].includes(spec.format)) {
    base.push(
      "Keep each section concise and presentation-friendly.",
      "Prefer short paragraphs and sharp bullet points."
    );
  } else if (["csv", "json", "xlsx"].includes(spec.format)) {
    base.push(
      "Favor structured facts, labeled sections, and compact bullet points.",
      "Avoid filler text and keep the wording operational."
    );
  } else {
    base.push("Use a clean professional structure and directly usable content.");
  }

  const contextInstruction = buildArtifactContextInstruction(context, spec);
  if (contextInstruction) {
    base.push(
      "Ground the artifact in the current project and source object instead of inventing a disconnected generic asset.",
      contextInstruction
    );
  }

  base.push("Do not wrap the output in code fences.");
  return base.join("\n");
}

function buildFinalAnswer(artifact, spec, usedFallback) {
  return [
    `Le fichier est pret: ${artifact.filename}.`,
    `Format: ${artifact.format.toUpperCase()}.`,
    artifact.extension && artifact.extension !== artifact.format
      ? `Sortie reelle: ${artifact.extension.toUpperCase()}.`
      : "",
    `Titre: ${spec.title}.`,
    usedFallback
      ? "Hydria a utilise un mode de secours partiel pour finaliser le fichier car un ou plusieurs agents n'ont pas repondu correctement."
      : "Hydria a utilise une orchestration multi-etapes pour specifier, rediger et rendre le document."
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeCandidate(type, provider, model, purpose, content) {
  return {
    type,
    provider,
    model,
    purpose,
    preview: String(content || "").slice(0, 220)
  };
}

export async function generateDocumentArtifact({
  userId,
  conversationId,
  prompt,
  attachments = [],
  plan,
  project = null,
  activeWorkObject = null,
  activeWorkObjectContent = "",
  seedDocument = null
}) {
  const startedAt = Date.now();
  const artifacts = [];
  const candidates = [];
  const modelsUsed = new Set();
  let usedFallback = false;

  const intent = inferArtifactIntent(prompt, attachments);
  const artifactStep = plan.steps.find((step) => step.type === "artifact");
  if (artifactStep) {
    artifactStep.format = intent.format;
  }

  const modelContext = buildModelContext(userId, conversationId, prompt, {
    attachments,
    taskPack: plan.taskPack || null
  });
  const { memoryUsed, attachmentEvidenceUsed } = collectContextUsage(modelContext);

  let spec = normalizeSpec(
    seedDocument?.spec
      ? {
          ...seedDocument.spec,
          documentType: intent.documentType || seedDocument.spec.documentType,
          format: intent.format || seedDocument.spec.format,
          title: intent.title || seedDocument.title || seedDocument.spec.title
        }
      : buildFallbackSpec(intent, prompt, attachments),
    intent
  );
  spec = applyProjectContextToSpec(spec, { project, activeWorkObject, activeWorkObjectContent, prompt });
  let markdown = "";
  let artifactContext = buildArtifactContext({
    spec,
    prompt,
    project,
    activeWorkObject,
    activeWorkObjectContent
  });

  if (shouldUseDirectLocalArtifact(intent, prompt, attachments, seedDocument)) {
    usedFallback = false;
    const sourceDocument = buildSourceDocument({
      spec,
      prompt,
      markdown: buildFallbackDraft(spec, prompt, attachmentEvidenceUsed, artifactContext),
      context: artifactContext
    });

    const rendered = await renderGeneratedArtifact({
      format: spec.format,
      title: spec.title,
      markdown: sourceDocument.renderInput,
      spec,
      prompt
    });

    if (artifactStep) {
      artifactStep.provider = "local";
      artifactStep.generator = rendered.format;
    }

    const generatedArtifact = await persistGeneratedArtifact({
      artifactId: randomUUID(),
      title: spec.title,
      format: rendered.format,
      extension: rendered.extension,
      mimeType: rendered.mimeType,
      buffer: rendered.buffer,
      conversationId,
      userId
    });

    artifacts.unshift(generatedArtifact);

    return {
      finalAnswer: buildFinalAnswer(generatedArtifact, spec, usedFallback),
      artifacts,
      candidates,
      modelsUsed: [...modelsUsed],
      memoryUsed,
      attachmentEvidenceUsed,
      sourceDocument: {
        title: sourceDocument.title,
        format: sourceDocument.format,
        kind: sourceDocument.kind,
        filename: sourceDocument.filename,
        content: sourceDocument.content,
        spec
      },
      meta: {
        durationMs: durationMs(startedAt),
        usedFallback,
        localFastPath: true
      }
    };
  }

  const specStep = findArtifactGenerationStep(plan, "spec", spec.documentType);
  if (specStep && config.llm.enabled) {
    const projectContextInstruction = buildArtifactContextInstruction(artifactContext, spec);
    const specMessages = attachInstruction(
      modelContext.messages,
      [
        "You are the specification agent for document generation.",
        `Return valid JSON only with keys: title, format, documentType, audience, tone, sections.`,
        `Use one of these formats only: ${listSupportedGenerationFormats().join(", ")}.`,
        "Each section must be an object with heading and goal.",
        "Keep the structure compact and execution-ready.",
        projectContextInstruction
          ? `Ground the spec in the current project and visible source object.\n${projectContextInstruction}`
          : "",
        seedDocument
          ? `You are revising an existing work object. Preserve its intent and improve it according to the request.\nCurrent title: ${seedDocument.title || spec.title}\nCurrent format: ${seedDocument.format || spec.format}`
          : ""
      ].join("\n"),
      attachments
    );

    const specResponse = await callReasoningModel(specMessages, {
      model: specStep.model,
      modelChain: specStep.modelChain,
      maxTokens: 800
    });

    if (specResponse.success) {
      specStep.model = specResponse.model;
      modelsUsed.add(specResponse.model);
      candidates.push(
        normalizeCandidate(
          "llm",
          specResponse.provider,
          specResponse.model,
          specStep.purpose,
          specResponse.content
        )
      );
      const parsedSpec = safeJsonParse(specResponse.content);
      if (parsedSpec) {
        spec = normalizeSpec(parsedSpec, intent);
        spec = applyProjectContextToSpec(spec, {
          project,
          activeWorkObject,
          activeWorkObjectContent,
          prompt
        });
        artifactContext = buildArtifactContext({
          spec,
          prompt,
          project,
          activeWorkObject,
          activeWorkObjectContent
        });
      } else {
        usedFallback = true;
        specStep.error = "Invalid JSON spec returned by model.";
        artifacts.push({
          type: "llm_error",
          purpose: specStep.purpose,
          error: specStep.error
        });
      }
    } else {
      usedFallback = true;
      specStep.error = specResponse.error;
      artifacts.push({
        type: "llm_error",
        purpose: specStep.purpose,
        error: specResponse.error,
        attempts: specResponse.attempts || []
      });
    }
  } else {
    usedFallback = true;
  }

  const draftStep = findArtifactGenerationStep(plan, "draft", spec.documentType);
  if (draftStep && config.llm.enabled) {
    const draftMessages = attachInstruction(
      modelContext.messages,
      [
        buildDraftInstruction(spec, artifactContext),
        seedDocument?.content
          ? `You are updating an existing work object.\nStart from the current content below, keep what is useful, and apply the new request instead of rewriting blindly.\n\nCurrent content:\n${seedDocument.content}`
          : ""
      ]
        .filter(Boolean)
        .join("\n\n"),
      attachments
    );

    const draftResponse = await callChatModel(draftMessages, {
      model: draftStep.model,
      modelChain: draftStep.modelChain,
      maxTokens: 1600
    });

    if (draftResponse.success) {
      draftStep.model = draftResponse.model;
      modelsUsed.add(draftResponse.model);
      markdown = String(draftResponse.content || "").trim();
      candidates.push(
        normalizeCandidate(
          "llm",
          draftResponse.provider,
          draftResponse.model,
          draftStep.purpose,
          draftResponse.content
        )
      );
    } else {
      usedFallback = true;
      draftStep.error = draftResponse.error;
      artifacts.push({
        type: "llm_error",
        purpose: draftStep.purpose,
        error: draftResponse.error,
        attempts: draftResponse.attempts || []
      });
    }
  }

  if (!markdown) {
    markdown = buildFallbackDraft(spec, prompt, attachmentEvidenceUsed, artifactContext);
  }

  const reviewStep = findArtifactGenerationStep(plan, "review", spec.documentType);
  if (reviewStep && config.llm.enabled) {
    const reviewMessages = attachInstruction(
      modelContext.messages,
      [
        "You are the review agent for document generation.",
        "Improve the following Markdown document for clarity, structure, and factual grounding.",
        "Return Markdown only without code fences.",
        buildArtifactContextInstruction(artifactContext, spec),
        seedDocument?.content
          ? "Keep continuity with the existing work object and only make justified improvements."
          : "",
        "",
        markdown
      ].join("\n"),
      attachments
    );

    const reviewResponse = await callReasoningModel(reviewMessages, {
      model: reviewStep.model,
      modelChain: reviewStep.modelChain,
      maxTokens: 1600
    });

    if (reviewResponse.success) {
      reviewStep.model = reviewResponse.model;
      modelsUsed.add(reviewResponse.model);
      markdown = String(reviewResponse.content || "").trim() || markdown;
      candidates.push(
        normalizeCandidate(
          "llm",
          reviewResponse.provider,
          reviewResponse.model,
          reviewStep.purpose,
          reviewResponse.content
        )
      );
    } else {
      usedFallback = true;
      reviewStep.error = reviewResponse.error;
      artifacts.push({
        type: "llm_error",
        purpose: reviewStep.purpose,
        error: reviewResponse.error,
        attempts: reviewResponse.attempts || []
      });
    }
  }

  const sourceDocument = buildSourceDocument({
    spec,
    prompt,
    markdown,
    context: artifactContext
  });

  const rendered = await renderGeneratedArtifact({
    format: spec.format,
    title: spec.title,
    markdown: sourceDocument.renderInput,
    spec,
    prompt
  });

  if (artifactStep) {
    artifactStep.provider = "local";
    artifactStep.generator = rendered.format;
  }

  const generatedArtifact = await persistGeneratedArtifact({
    artifactId: randomUUID(),
    title: spec.title,
    format: rendered.format,
    extension: rendered.extension,
    mimeType: rendered.mimeType,
    buffer: rendered.buffer,
    conversationId,
    userId
  });

  artifacts.unshift(generatedArtifact);

  return {
    finalAnswer: buildFinalAnswer(generatedArtifact, spec, usedFallback),
    artifacts,
    candidates,
    modelsUsed: [...modelsUsed],
    memoryUsed,
    attachmentEvidenceUsed,
    sourceDocument: {
      title: sourceDocument.title,
      format: sourceDocument.format,
      kind: sourceDocument.kind,
      filename: sourceDocument.filename,
      content: sourceDocument.content,
      spec
    },
    meta: {
      durationMs: durationMs(startedAt),
      usedFallback
    }
  };
}
