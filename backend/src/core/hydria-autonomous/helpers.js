import agenticConfig from "../../config/agenticConfig.js";
import { inferEnvironmentObjectKind } from "../environmentPlanner.js";

export function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

export function dedupeAttachmentEvidence(attachmentEvidenceUsed) {
  return [...new Map(
    (attachmentEvidenceUsed || []).map((evidence) => [
      `${evidence.attachmentId}:${evidence.sectionTitle}:${evidence.excerpt}`,
      evidence
    ])
  ).values()];
}

export function hasExecutionIssues(artifacts = []) {
  return artifacts.some((artifact) => /_error$/i.test(artifact.type || ""));
}

export function findProjectBuilderToolResult(toolResults = []) {
  return (
    (toolResults || []).find((result) => result?.providerId === "project_builder") || null
  );
}

export function buildBasePromptForExecution(
  latestExecution,
  routingResolution,
  effectivePrompt,
  routingPrompt
) {
  const previousBasePrompt =
    latestExecution?.execution_plan?.basePrompt ||
    latestExecution?.execution_plan?.resolvedPrompt ||
    latestExecution?.execution_plan?.originalPrompt ||
    "";

  if (routingResolution?.usedHistory && /^contextual_follow_up/.test(routingResolution.reason || "")) {
    return previousBasePrompt || routingPrompt || effectivePrompt;
  }

  return routingPrompt || effectivePrompt;
}

export function normalizeStatus({ critique, artifacts, delivery = null }) {
  if (
    delivery &&
    !["validated", "exported", "delivered"].includes(delivery.status || "") &&
    (delivery.install?.status === "failed" ||
      delivery.run?.status === "failed" ||
      delivery.validation?.status === "failed")
  ) {
    return "partial_success";
  }

  if ((critique?.score || 0) >= agenticConfig.minCriticScoreForSuccess && !hasExecutionIssues(artifacts)) {
    return "success";
  }

  if (critique?.status === "failed" || (critique?.score || 0) < 35) {
    return "partial_success";
  }

  return hasExecutionIssues(artifacts) ? "partial_success" : "success";
}

export function normalizeWorkspacePrompt(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isWorkspaceQuestionPrompt(prompt = "") {
  const normalized = normalizeWorkspacePrompt(prompt);
  return /^(show|display|montre|affiche|read|lis|explain|explique|why|pourquoi|what|que|resume|summarize|compare|analyse|analyze)\b/.test(
    normalized
  );
}

export function isSeparateCreationPrompt(prompt = "") {
  const normalized = normalizeWorkspacePrompt(prompt);
  return /\b(new|another|nouveau|nouvelle|autre)\b/.test(normalized) &&
    /\b(project|projet|app|application|document|presentation|spreadsheet|table|sheet|dataset)\b/.test(
      normalized
    );
}

export function shouldApplyPromptToActiveWorkObject({
  prompt = "",
  activeWorkObject = null,
  attachments = [],
  intentProfile = null
} = {}) {
  if (!activeWorkObject || attachments.length) {
    return false;
  }

  if (
    ![
      "document",
      "presentation",
      "dataset",
      "dashboard",
      "workflow",
      "design",
      "benchmark",
      "campaign",
      "image",
      "audio",
      "video",
      "project",
      "code"
    ].includes(activeWorkObject.objectKind)
  ) {
    return false;
  }

  if (isWorkspaceQuestionPrompt(prompt) || isSeparateCreationPrompt(prompt)) {
    return false;
  }

  const requestedKind = inferEnvironmentObjectKind(intentProfile?.requestedShape?.shape || "");
  if (
    activeWorkObject.objectKind === "project" &&
    requestedKind &&
    requestedKind !== "project"
  ) {
    return false;
  }

  if (
    intentProfile?.explicitNewEnvironment &&
    activeWorkObject.objectKind !== "project"
  ) {
    return false;
  }

  if (
    requestedKind &&
    activeWorkObject.objectKind !== "project" &&
    requestedKind !== activeWorkObject.objectKind
  ) {
    return false;
  }

  return Boolean(normalizeWorkspacePrompt(prompt));
}

export function resolveActiveWorkObjectEntry(activeWorkObject = null, preferredPath = "") {
  if (!activeWorkObject) {
    return "";
  }

  const editableFiles = Array.isArray(activeWorkObject.editableFiles)
    ? activeWorkObject.editableFiles
    : [];
  const normalizedPreferred = String(preferredPath || "").trim();

  if (normalizedPreferred && editableFiles.includes(normalizedPreferred)) {
    return normalizedPreferred;
  }

  if (activeWorkObject.objectKind === "project") {
    const builderPath = editableFiles.find((entryPath) => /(^|\/)app\.config\.json$/i.test(entryPath));
    if (builderPath) {
      return builderPath;
    }
  }

  return normalizedPreferred || activeWorkObject.primaryFile || editableFiles[0] || "";
}

export function findGitAgentResult(toolResults = []) {
  return (
    (toolResults || []).find(
      (result) =>
        result?.providerId === "git_agent" || result?.sourceName === "Git Agent"
    ) || null
  );
}

export function findArtifactGeneratorToolResult(toolResults = []) {
  return (
    (toolResults || []).find(
      (result) => result?.providerId === "artifact_generator" || result?.capability === "artifact_generation"
    ) || null
  );
}

export function dedupeLearningItems(items = []) {
  return [...new Map(
    (items || [])
      .filter((item) => item?.description)
      .map((item) => [`${item.type}:${item.category}:${item.description}`, item])
  ).values()];
}

export function decorateFinalAnswerWithLearning(
  finalAnswer = "",
  learnings = [],
  classification = "simple_chat"
) {
  if (
    !learnings.length ||
    !["coding", "compare", "complex_reasoning", "hybrid_task", "artifact_generation", "brainstorm"].includes(
      classification
    )
  ) {
    return finalAnswer;
  }

  if (
    /Apprentissages deja valides|Patterns reutilises|Pattern reutilise|Strategie connue appliquee/i.test(
      finalAnswer
    )
  ) {
    return finalAnswer;
  }

  const notes = learnings
    .slice(0, 2)
    .map((item) => {
      const reuseReason = item.reuseReason || item.reuseMeta?.reuseReason || "";
      if (item.type === "mistake") {
        return `- erreur connue evitee: ${item.description}${reuseReason ? ` (${reuseReason})` : ""}`;
      }
      if (item.type === "strategy") {
        return `- strategie connue appliquee: ${item.description}${reuseReason ? ` (${reuseReason})` : ""}`;
      }
      return `- pattern reutilise: ${item.description}${reuseReason ? ` (${reuseReason})` : ""}`;
    });

  return notes.length
    ? `${finalAnswer}\n\nApprentissage reutilise\n${notes.join("\n")}`
    : finalAnswer;
}

export function finalizeUserAnswer(
  finalSynthesis = {},
  reusedLearnings = [],
  classification = "simple_chat"
) {
  if (
    ["solution_synthesis", "execution_result", "delivery_result"].includes(
      finalSynthesis?.qualityPass?.mode
    )
  ) {
    return finalSynthesis.finalAnswer || "";
  }

  return decorateFinalAnswerWithLearning(
    finalSynthesis.finalAnswer,
    reusedLearnings,
    classification
  );
}
