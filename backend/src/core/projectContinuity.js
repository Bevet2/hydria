import { normalizePromptText } from "./promptNormalization.js";
import { resolveRequestedShape } from "./creationShape.js";
import { inferEnvironmentObjectKind } from "./environmentPlanner.js";

function normalizeText(value = "") {
  return normalizePromptText(value);
}

function getLatestExecutionProjectId(latestExecution = null) {
  return (
    latestExecution?.execution_plan?.agentic?.project?.id ||
    latestExecution?.execution_plan?.project?.id ||
    ""
  );
}

function getLatestExecutionWorkObjectId(latestExecution = null) {
  return (
    latestExecution?.execution_plan?.agentic?.workObject?.id ||
    latestExecution?.execution_plan?.workObject?.id ||
    ""
  );
}

function isExplicitNewEnvironmentPrompt(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(new|another|nouveau|nouvelle|autre|from scratch|different)\b/.test(normalized);
}

function hasContinuationSignals(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(this|current|same|continue|poursuis|ce|cet|cette|celui|celle|ajoute|ameliore|modifie|mets a jour|refine|improve|update|fix|corrige|garde|keep)\b/.test(
    normalized
  );
}

export function resolveProjectContinuity({
  prompt = "",
  userId = null,
  conversationId = null,
  activeWorkObject = null,
  latestExecution = null,
  workObjectService = null,
  projectStore = null
} = {}) {
  if (activeWorkObject) {
    const activeProject = activeWorkObject.projectId
      ? projectStore?.getProject(activeWorkObject.projectId) || null
      : null;
    return {
      mode: "selected_environment",
      reason: "explicit_work_object_selection",
      activeWorkObject,
      activeProject,
      usedConversationHistory: false
    };
  }

  if (!workObjectService || !conversationId || !userId) {
    return {
      mode: "fresh_start",
      reason: "no_conversation_context",
      activeWorkObject: null,
      activeProject: null,
      usedConversationHistory: false
    };
  }

  const normalizedPrompt = normalizeText(prompt);
  const requestedShape = resolveRequestedShape(prompt);
  const requestedKind = inferEnvironmentObjectKind(requestedShape.shape);
  const recentObjects = workObjectService.listForConversation({
    userId,
    conversationId,
    limit: 12
  });

  const explicitNew = isExplicitNewEnvironmentPrompt(prompt);
  const continuation = hasContinuationSignals(prompt);
  const latestExecutionWorkObjectId = getLatestExecutionWorkObjectId(latestExecution);
  const latestExecutionProjectId = getLatestExecutionProjectId(latestExecution);

  const exactExecutionObject = latestExecutionWorkObjectId
    ? recentObjects.find((item) => item.id === latestExecutionWorkObjectId) || null
    : null;
  const sameKindObject =
    requestedKind && requestedKind !== "document"
      ? recentObjects.find((item) => item.objectKind === requestedKind) || null
      : null;
  const recentProjectObject =
    latestExecutionProjectId
      ? recentObjects.find((item) => item.projectId === latestExecutionProjectId) || null
      : null;
  const fallbackObject = exactExecutionObject || sameKindObject || recentProjectObject || recentObjects[0] || null;

  if (!fallbackObject || explicitNew) {
    return {
      mode: explicitNew ? "new_environment" : "fresh_start",
      reason: explicitNew ? "explicit_new_environment" : "no_recent_environment",
      activeWorkObject: null,
      activeProject: null,
      usedConversationHistory: false
    };
  }

  const shouldContinueObject =
    continuation ||
    /^(fais-le|fais le|do it|make it|vas-y|vas y|go ahead|continue)$/i.test(normalizedPrompt);
  const activeProject =
    fallbackObject.projectId
      ? projectStore?.getProject(fallbackObject.projectId) || null
      : latestExecutionProjectId
        ? projectStore?.getProject(latestExecutionProjectId) || null
        : null;

  return {
    mode: shouldContinueObject ? "continue_recent_environment" : "resume_recent_environment",
    reason: shouldContinueObject ? "follow_up_continuity" : "recent_environment_context",
    activeWorkObject: fallbackObject,
    activeProject,
    usedConversationHistory: true
  };
}

export default {
  resolveProjectContinuity
};
