import { cleanPromptText, normalizePromptText } from "../../src/core/promptNormalization.js";

function cleanTitle(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePrompt(value = "") {
  return normalizePromptText(value);
}

const FORMAT_PATTERNS = [
  {
    format: "docx",
    pattern: /\bdocx\b|\bword\b|\bword document\b|\bdocument word\b/i
  },
  {
    format: "pptx",
    pattern:
      /\bpptx\b|\bppt\b|\bpowerpoint\b|\bslides\b|\bslide deck\b|\bpresentation\b|\bdeck\b/i
  },
  {
    format: "xlsx",
    pattern: /\bxlsx\b|\bexcel\b|\bspreadsheet\b|\btableur\b|\bworkbook\b/i
  },
  {
    format: "csv",
    pattern: /\bcsv\b/i
  },
  {
    format: "json",
    pattern: /\bjson\b/i
  },
  {
    format: "html",
    pattern: /\bhtml\b|\bpage web\b|\bweb page\b/i
  },
  {
    format: "pdf",
    pattern: /\bpdf\b/i
  },
  {
    format: "md",
    pattern: /\bmarkdown\b|\b\.md\b|\bmd\b/i
  },
  {
    format: "txt",
    pattern: /\btxt\b|\btexte\b|\bplain text\b|\btext file\b/i
  },
  {
    format: "image",
    pattern:
      /\bimage\b|\bvisuel\b|\bvisual\b|\billustration\b|\bposter\b|\bbanner\b|\bsvg\b|\bpng\b|\bjpe?g\b/i
  }
];

const SUPPORTED_FORMATS = FORMAT_PATTERNS.map((entry) => entry.format);

export function normalizeGenerationFormat(value, fallback = "pdf") {
  const normalized = normalizePrompt(value).trim();

  if (!normalized) {
    return fallback;
  }

  const match = FORMAT_PATTERNS.find(
    (entry) => entry.format === normalized || entry.pattern.test(normalized)
  );

  return match?.format || fallback;
}

function inferRequestedFormat(prompt) {
  const normalized = normalizePrompt(prompt);

  for (const entry of FORMAT_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.format;
    }
  }

  return "pdf";
}

function inferDocumentType(prompt) {
  const normalized = normalizePrompt(prompt);

  if (/\b(dashboard|analytics|visualisation|visualization|data viz|chart|charts|kpi|reporting)\b/.test(normalized)) {
    return "dashboard";
  }
  if (/\b(benchmark|competitive analysis|analyse concurrentielle|benchmark concurrentiel|competitor map|market scan)\b/.test(normalized)) {
    return "benchmark";
  }
  if (/\b(campaign|campagne|launch plan|go to market|go-to-market|marketing campaign|content campaign)\b/.test(normalized)) {
    return "campaign";
  }
  if (/\b(workflow|automation|n8n|pipeline builder|scheduled jobs?|event driven|orchestration|agent builder|multi-agent orchestration)\b/.test(normalized)) {
    return "workflow";
  }
  if (/\b(figma|wireframe|design system|ui builder|layout editor|wireframes?|mockup|mock-up|design)\b/.test(normalized)) {
    return "design";
  }
  if (/\b(business plan|plan d'affaires|plan d affaires)\b/.test(normalized)) {
    return "business plan";
  }
  if (/\b(report|rapport)\b/.test(normalized)) {
    return "report";
  }
  if (/\b(spec|specification|cahier des charges|requirements)\b/.test(normalized)) {
    return "specification";
  }
  if (/\b(plan|roadmap)\b/.test(normalized)) {
    return "plan";
  }
  if (/\b(video|trailer|storyboard|clip|demo video|pitch video)\b/.test(normalized)) {
    return "video";
  }
  if (/\b(audio|music|soundtrack|voice ?over|voiceover|podcast)\b/.test(normalized)) {
    return "audio";
  }
  if (/\b(presentation|slides|powerpoint|deck|pptx|ppt)\b/.test(normalized)) {
    return "presentation";
  }
  if (/\b(spreadsheet|tableur|excel|xlsx|csv)\b/.test(normalized)) {
    return "spreadsheet";
  }
  if (/\b(json|dataset|data file|fichier de donnees)\b/.test(normalized)) {
    return "dataset";
  }
  if (/\b(image|poster|banner|illustration|visuel|visual)\b/.test(normalized)) {
    return "image";
  }
  if (/\b(proposal|proposition|offre)\b/.test(normalized)) {
    return "proposal";
  }
  if (/\b(brief|memo|note)\b/.test(normalized)) {
    return "brief";
  }
  if (/\b(summary|resume)\b/.test(normalized)) {
    return "summary";
  }
  if (/\b(checklist|check-list|liste)\b/.test(normalized)) {
    return "checklist";
  }

  return "document";
}

function inferTopic(prompt) {
  const normalized = normalizePrompt(prompt);

  if (/\b(excel|spreadsheet|tableur|xlsx|csv)\b/.test(normalized)) {
    const rangeMatch =
      normalized.match(/\b(?:de|from)\s*(\d+)\s*(?:a|to|-)\s*(\d+)\b/) ||
      normalized.match(/\b(\d+)\s*(?:a|to|-)\s*(\d+)\b/) ||
      normalized.match(/\b(\d+)\s*[^\d]{1,4}\s*(\d+)\b/);

    if (rangeMatch) {
      const start = rangeMatch[1] || rangeMatch[3];
      const end = rangeMatch[2] || rangeMatch[4];
      if (start && end) {
        return cleanTitle(`Numbers ${start} to ${end}`);
      }
    }

    const spreadsheetTopic = cleanPromptText(prompt)
      .replace(/^(create|build|generate|make|cree|creer|fais|genere|ajoute)\s+/i, "")
      .replace(/\b(excel|spreadsheet|tableur|xlsx|csv)\b/gi, "")
      .replace(/^((un|une|des|du|de la|de l'|de)\s+)+/i, "")
      .replace(/\b(pour ce projet|dans ce projet|for this project|in this project)\b/gi, "")
      .replace(/[.?!]+$/g, "")
      .trim();

    if (spreadsheetTopic) {
      return cleanTitle(spreadsheetTopic);
    }
  }

  const patterns = [/\b(?:sur|about|on|for|pour)\b\s+(.+)$/i, /\b(?:de|d')\b\s+(.+)$/i];

  for (const pattern of patterns) {
    const match = cleanPromptText(prompt).match(pattern);
    if (match?.[1]) {
      return cleanTitle(
        match[1]
          .replace(/\b(dans ce projet|pour ce projet|for this project|in this project)\b.*$/i, "")
          .replace(/[.?!]+$/g, "")
      );
    }
  }

  return "";
}

function inferTitle(prompt, documentType) {
  const topic = inferTopic(prompt);

  if (topic) {
    return cleanTitle(`${documentType} - ${topic}`.replace(/^document - /i, ""));
  }

  if (documentType === "report") {
    return "Hydria Report";
  }
  if (documentType === "specification") {
    return "Hydria Specification";
  }
  if (documentType === "plan") {
    return "Hydria Plan";
  }
  if (documentType === "proposal") {
    return "Hydria Proposal";
  }
  if (documentType === "presentation") {
    return "Hydria Presentation";
  }
  if (documentType === "spreadsheet") {
    return "Hydria Spreadsheet";
  }
  if (documentType === "dataset") {
    return "Hydria Dataset";
  }
  if (documentType === "dashboard") {
    return "Hydria Dashboard";
  }
  if (documentType === "benchmark") {
    return "Hydria Benchmark";
  }
  if (documentType === "campaign") {
    return "Hydria Campaign";
  }
  if (documentType === "workflow") {
    return "Hydria Workflow";
  }
  if (documentType === "design") {
    return "Hydria Design";
  }
  if (documentType === "image") {
    return "Hydria Visual";
  }
  if (documentType === "audio") {
    return "Hydria Audio";
  }
  if (documentType === "video") {
    return "Hydria Video";
  }

  return "Hydria Document";
}

export function isArtifactGenerationPrompt(prompt = "") {
  const normalized = normalizePrompt(prompt);
  const createSignal =
    /\b(?:create|generate|make|build|write|draft|produce|export|save|render|convert|prepare|transform|transforme|cree|fais|fabrique|produis|redige|ecris|cris|compose|convertis)\b/i.test(
      normalized
    );
  const editSignal =
    /\b(?:show|display|montre|affiche|lis|read|update|edit|rewrite|improve|ameliore|improve this|ajoute|add|complete|completez|poursuis|continue|revise)\b/i.test(
      normalized
    );
  const outputSignal =
    /(\bpdf\b|\bdocx\b|\bword\b|\bhtml\b|\bcsv\b|\bjson\b|\bpptx\b|\bppt\b|\bpowerpoint\b|\bxlsx\b|\bexcel\b|\bspreadsheet\b|\btableur\b|\bimage\b|\bsvg\b|\bpng\b|\bjpeg\b|\bjpg\b|\baudio\b|\bmp3\b|\bwav\b|\bvideo\b|\bmp4\b|\bwebm\b|\bmarkdown\b|\.md\b|\btxt\b|\bdocument\b|\bfichier\b|\bfile\b|\brapport\b|\breport\b|\bmemo\b|\bbrief\b|\bspec\b|\bspecification\b|\bproposition\b|\bproposal\b|\bguide\b|\bchecklist\b|\bpresentation\b|\bslides\b|\bbusiness plan\b|\bplan d'affaires\b|\bplan d affaires\b|\bplan\b|\broadmap\b|\bstrategie marketing\b|\bdashboard\b|\banalytics\b|\bworkflow\b|\bautomation\b|\bwireframe\b|\bdesign system\b|\bfigma\b|\bmockup\b|\bbenchmark\b|\banalyse concurrentielle\b|\bcampaign\b|\bcampagne\b|\bstoryboard\b)/i.test(
      normalized
    );

  return outputSignal && (createSignal || editSignal);
}

export function inferArtifactIntent(prompt = "", attachments = []) {
  const documentType = inferDocumentType(prompt);
  const normalized = normalizePrompt(prompt);
  const inferredRequestedFormat = inferRequestedFormat(prompt);
  const requestedFormat =
    inferredRequestedFormat === "pdf" && !/\bpdf\b/.test(normalized)
      ? ""
      : inferredRequestedFormat;
  const preferredFallbackFormat = ["dashboard", "workflow", "design"].includes(documentType)
    ? "json"
    : ["benchmark", "campaign", "audio", "video"].includes(documentType)
      ? "json"
    : documentType === "presentation"
      ? "pptx"
      : documentType === "spreadsheet"
        ? "xlsx"
        : documentType === "image"
          ? "image"
        : "pdf";
  const format = normalizeGenerationFormat(requestedFormat, preferredFallbackFormat);
  const title = inferTitle(prompt, documentType);

  return {
    format,
    documentType,
    title,
    topic: inferTopic(prompt),
    hasAttachments: attachments.length > 0
  };
}

export function listSupportedGenerationFormats() {
  return [...SUPPORTED_FORMATS];
}
