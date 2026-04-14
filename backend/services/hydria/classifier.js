import { detectApiNeed } from "../apis/apiRouter.js";
import { isArtifactGenerationPrompt } from "../artifacts/generationIntentService.js";
import { detectWebNeed } from "../web/webIntentService.js";
import { detectTooling } from "../tools/toolRouter.js";

function normalizeInput(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasCodeAttachments(attachments = []) {
  return attachments.some((attachment) =>
    ["code", "config"].includes(attachment.kind)
  );
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
  return (
    /```|function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+|class\s+\w+|stack trace|stacktrace|exception|traceback|bug|debug|error|TypeError|ReferenceError|npm|node_modules|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bschema\b|\bmigration\b|\bquery\b/i.test(
      prompt
    )
  );
}

function hasDocumentActionSignals(prompt) {
  return /(document|doc|pdf|word|xlsx|xls|excel|sheet|spreadsheet|csv|json|yaml|xml|config|screenshot|image|photo|scan|zip|archive|ppt|pptx|slides|presentation|fichier|file|piece jointe|attachment|cv|resume|cover letter|lettre de motivation|ameliore|improve|review|audit|analyze|analyse|optimize|optimise|extract|rewrite|reecris|recris|corrige|correct|ats|tailor|adapt|polish|edit|improve this)/i.test(
    prompt
  );
}

function hasComparisonSignals(prompt) {
  return /(compare|comparaison|versus|vs\.?|difference|diff|which is better|entre les deux|between these)/i.test(
    prompt
  );
}

function hasCompareSignals(prompt) {
  return hasComparisonSignals(prompt);
}

function hasSummarySignals(prompt) {
  return /(resume|summary|summarize|tl;dr|condense|synthetise|synthesize|synthese)/i.test(
    prompt
  );
}

function hasBrainstormSignals(prompt) {
  return /(brainstorm|idees|genere des idees|ideation|concepts|options creatives)/i.test(
    prompt
  );
}

function hasReasoningSignals(prompt) {
  return /(architecture|strategie|strategy|plan|design|reason|analyse|analyze|tradeoff|roadmap|orchestration|workflow)/i.test(
    prompt
  );
}

export function classifyRequest(prompt, attachments = []) {
  const trimmedPrompt = String(prompt || "").trim();
  const normalizedPrompt = normalizeInput(trimmedPrompt);
  const apiNeed = detectApiNeed(trimmedPrompt);
  const webNeed = detectWebNeed(trimmedPrompt, apiNeed);
  const toolNeed = detectTooling(trimmedPrompt, "", attachments);
  const wantsAnalysis = /(analyse|analyze|analysis|explain|explique|pourquoi|why|impact)/i.test(
    normalizedPrompt
  );

  if (isArtifactGenerationPrompt(trimmedPrompt)) {
    return "artifact_generation";
  }

  if (hasCompareSignals(normalizedPrompt) && !toolNeed?.diagnostics && !toolNeed?.preview) {
    return "compare";
  }

  if (hasCodeSignals(normalizedPrompt) || hasCodeAttachments(attachments)) {
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

  if (webNeed && hasCompareSignals(normalizedPrompt)) {
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
