import { detectApiNeed } from "../../services/apis/apiRouter.js";
import { isArtifactGenerationPrompt } from "../../services/artifacts/generationIntentService.js";
import { detectWebNeed } from "../../services/web/webIntentService.js";
import { detectTooling } from "../../services/tools/toolRouter.js";
import { detectBrowserNeed } from "../runtime/browser.intent.js";
import { detectGitHubNeed } from "../integrations/github/github.intent.js";
import { normalizePromptText } from "./promptNormalization.js";
import { resolveRequestedShape } from "./creationShape.js";

function normalizeInput(text) {
  return normalizePromptText(text);
}

function hasCodeAttachments(attachments = []) {
  return attachments.some((attachment) => ["code", "config"].includes(attachment.kind));
}

function hasDocumentAttachments(attachments = []) {
  return attachments.some((attachment) =>
    [
      "pdf",
      "doc",
      "docx",
      "text",
      "image",
      "spreadsheet",
      "data",
      "config",
      "presentation",
      "archive",
      "media",
      "binary"
    ].includes(attachment.kind)
  );
}

function hasCodeSignals(prompt) {
  return /```|function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+|class\s+\w+|stack trace|stacktrace|exception|traceback|bug|debug|error|TypeError|ReferenceError|npm|node_modules|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bschema\b|\bmigration\b|\bquery\b/i.test(
    prompt
  );
}

function hasDocumentActionSignals(prompt) {
  return /(document|doc|pdf|word|xlsx|xls|excel|sheet|spreadsheet|csv|json|yaml|xml|config|screenshot|image|photo|scan|zip|archive|ppt|pptx|slides|presentation|fichier|file|piece jointe|attachment|cv|resume|cover letter|lettre de motivation|ameliore|improve|review|audit|analyze|analyse|optimize|optimise|extract|rewrite|reecris|recris|corrige|correct|ats|tailor|adapt|polish|edit|improve this)/i.test(
    prompt
  );
}

function hasDocumentArtifactSignals(prompt) {
  return /(business plan|plan d'affaires|plan d affaires|presentation|slides|deck|ppt|pptx|rapport|report|brief|memo|spec|specification|proposal|proposition|checklist|roadmap|plan marketing|strategie marketing|document|guide)/i.test(
    prompt
  );
}

function hasComparisonSignals(prompt) {
  return /(compare|comparaison|versus|vs\.?|difference|diff|which is better|entre les deux|between these)/i.test(
    prompt
  );
}

function hasSummarySignals(prompt) {
  return /(resume|summary|summarize|tl;dr|condense|synthetise|synthesize|synthese)/i.test(prompt);
}

function hasBrainstormSignals(prompt) {
  return /(brainstorm|idees|genere des idees|ideation|concepts|options creatives)/i.test(prompt);
}

function hasReasoningSignals(prompt) {
  return /(architecture|strategie|strategy|plan|design|reason|analyse|analyze|tradeoff|roadmap|orchestration|workflow)/i.test(prompt);
}

function hasTechnicalBuildSignals(prompt) {
  return /(?:\b(create|build|implement|generate|make|cree|fais|construis|developpe|scaffold|fabrique|produis)\b.*\b(api|backend|frontend|dashboard|ui|app|application|project|projet|site|tool|widget|auth|jwt|middleware|route|router|controller|service|database|schema)\b)|(?:\b(api|backend|frontend|dashboard|ui|app|application|project|projet|site|tool|widget|auth|jwt|middleware|route|router|controller|service|database|schema)\b.*\b(create|build|implement|generate|make|cree|fais|construis|developpe|scaffold|fabrique|produis)\b)/i.test(
    prompt
  );
}

function hasProjectCreationSignals(prompt) {
  return /(?:\b(create|build|generate|make|cree|fais|construis|scaffold|fabrique|produis)\b.*\b(app|application|project|projet|site|tool|widget|workspace|dashboard|interface|landing)\b)|(?:\b(app|application|project|projet|site|tool|widget|workspace|dashboard|interface|landing)\b.*\b(create|build|generate|make|cree|fais|construis|scaffold|fabrique|produis)\b)/i.test(
    prompt
  );
}

function isBrowserDominantPrompt(prompt = "", browserNeed = null) {
  if (!browserNeed) {
    return false;
  }

  const normalized = normalizeInput(prompt).toLowerCase();
  const browserActionSignals =
    /\b(ouvre|open|navigue|navigate|goto|go to|visit|page|url|lien|liens|links|click|clique|fill|remplis|form|formulaire|screenshot|capture|dom|html|texte visible|visible content|liste les liens|read the page|lis la page)\b/.test(
      normalized
    );
  const engineeringSignals =
    /\b(bug|bugs|error|errors|debug|fix|corrige|issue|issues|stack|trace|lint|build|test|tests|repo|repository|workspace|code|component|composant|css|react|frontend|backend|architecture|risque|risk)\b/.test(
      normalized
    );

  return browserActionSignals && !engineeringSignals;
}

export function classifyAgenticRequest(prompt, attachments = []) {
  const trimmedPrompt = String(prompt || "").trim();
  const normalizedPrompt = normalizeInput(trimmedPrompt);
  const requestedShape = resolveRequestedShape(trimmedPrompt);
  const apiNeed = detectApiNeed(trimmedPrompt);
  const webNeed = detectWebNeed(trimmedPrompt, apiNeed);
  const toolNeed = detectTooling(trimmedPrompt, "", attachments);
  const browserNeed = detectBrowserNeed(trimmedPrompt);
  const gitHubNeed = detectGitHubNeed(trimmedPrompt);
  const wantsAnalysis = /(analyse|analyze|analysis|explain|explique|pourquoi|why|impact)/i.test(
    normalizedPrompt
  );

  if (
    ["spreadsheet", "presentation", "document", "dataset", "dashboard", "workflow", "design"].includes(
      requestedShape.shape
    ) &&
    /(create|generate|make|build|write|draft|produce|show|display|montre|affiche|cree|fais|genere|ecris|ajoute|ameliore|transforme)/i.test(
      normalizedPrompt
    )
  ) {
    return "artifact_generation";
  }

  if (isArtifactGenerationPrompt(trimmedPrompt)) {
    return "artifact_generation";
  }

  if (hasDocumentArtifactSignals(normalizedPrompt) && /(ecris|write|cree|create|genere|generate|montre|show|affiche|display|ajoute|add|ameliore|improve|reecris|rewrite|transforme|transform)/i.test(normalizedPrompt)) {
    return "artifact_generation";
  }

  if (hasComparisonSignals(normalizedPrompt) && !toolNeed?.diagnostics && !toolNeed?.preview) {
    return "compare";
  }

  if (gitHubNeed && !attachments.length) {
    return hasComparisonSignals(normalizedPrompt) ? "compare" : "data_lookup";
  }

  if (browserNeed && isBrowserDominantPrompt(trimmedPrompt, browserNeed) && !attachments.length) {
    return "data_lookup";
  }

  if (hasCodeSignals(normalizedPrompt) || hasCodeAttachments(attachments)) {
    return "coding";
  }

  if (
    requestedShape.executable ||
    hasTechnicalBuildSignals(normalizedPrompt) ||
    hasProjectCreationSignals(normalizedPrompt)
  ) {
    return "coding";
  }

  if (toolNeed?.workspaceInspect || toolNeed?.diagnostics || toolNeed?.preview) {
    return "coding";
  }

  if (!trimmedPrompt && hasDocumentAttachments(attachments)) {
    return "summarize";
  }

  if (attachments.length && hasComparisonSignals(normalizedPrompt)) {
    return "compare";
  }

  if (hasSummarySignals(normalizedPrompt)) {
    return "summarize";
  }

  if (hasBrainstormSignals(normalizedPrompt)) {
    return "brainstorm";
  }

  if (webNeed && hasComparisonSignals(normalizedPrompt)) {
    return "compare";
  }

  if (webNeed && hasSummarySignals(normalizedPrompt)) {
    return "summarize";
  }

  if (webNeed && wantsAnalysis) {
    return "hybrid_task";
  }

  if (webNeed) {
    return "data_lookup";
  }

  if (apiNeed && wantsAnalysis) {
    return "hybrid_task";
  }

  if (apiNeed) {
    return "data_lookup";
  }

  if (attachments.length && hasDocumentActionSignals(normalizedPrompt)) {
    return "complex_reasoning";
  }

  if (trimmedPrompt.length > 240 || hasReasoningSignals(normalizedPrompt)) {
    return "complex_reasoning";
  }

  return "simple_chat";
}

export default {
  classifyAgenticRequest
};
