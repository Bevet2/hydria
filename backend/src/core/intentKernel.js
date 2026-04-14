import { normalizePromptText } from "./promptNormalization.js";
import { resolveRequestedShape } from "./creationShape.js";
import { resolveWorkspaceFamily } from "../workspaces/workspaceRegistry.js";

function normalizeText(value = "") {
  return normalizePromptText(value);
}

function has(pattern, value = "") {
  return pattern.test(value);
}

function inferUserExpertise(prompt = "", attachments = []) {
  const normalized = normalizeText(prompt);

  if (
    has(
      /\b(simplement|debutant|beginner|je debute|je connais pas|sans code|explique simplement|for a beginner)\b/,
      normalized
    )
  ) {
    return "beginner";
  }

  if (
    attachments.some((attachment) => ["code", "config", "spreadsheet", "data"].includes(attachment.kind)) ||
    has(
      /\b(jwt|middleware|typescript|schema|migration|orchestration|runtime|workflow|multi-agent|sql|api|deployment|docker|architecture)\b/,
      normalized
    )
  ) {
    return "advanced";
  }

  return "intermediate";
}

function inferActionMode(prompt = "", requestedShape = { shape: "unknown" }, activeWorkObject = null) {
  const normalized = normalizeText(prompt);
  const hasCreate =
    has(/\b(create|build|generate|make|write|draft|produce|creer|cree|fais|construis|genere|ecris|produis|fabrique|transforme en)\b/, normalized);
  const hasModify =
    has(/\b(add|improve|update|edit|refine|continue|complete|fix|adjust|modify|ajoute|ameliore|modifie|mets a jour|corrige|complete|poursuis|continue)\b/, normalized);
  const hasAnalysis =
    has(/\b(compare|analyse|analyze|explain|explique|why|pourquoi|audit|review|cherche|recherche|trouve|find|search|look for)\b/, normalized);
  const hasRepositoryResearchSignals =
    has(/\b(github|repo|repos|repository|repositories|open source|template|starter|boilerplate|base|pattern|patterns)\b/, normalized);

  if (hasModify && activeWorkObject) {
    return "modify";
  }

  if ((hasAnalysis && !hasCreate) || (hasRepositoryResearchSignals && !hasCreate)) {
    return "analyze";
  }

  if (hasCreate || requestedShape.shape !== "unknown") {
    return "create";
  }

  return "ask";
}

function inferPrimaryObjective(prompt = "", requestedShape = { shape: "unknown" }, actionMode = "ask") {
  const normalized = normalizeText(prompt);

  if (actionMode === "modify") {
    return "improve the current environment";
  }

  if (requestedShape.shape === "spreadsheet" || requestedShape.shape === "dataset") {
    return has(/\b(numbers?|numeros?|num[eé]ros?|1\s*a\s*100|1\s*to\s*100)\b/, normalized)
      ? "create a visible spreadsheet with concrete rows of data"
      : "create a spreadsheet or data grid that can be edited directly";
  }

  if (requestedShape.shape === "presentation") {
    return "create a slide-based presentation with a clear storyline";
  }

  if (requestedShape.shape === "dashboard") {
    return "create an interactive analytics dashboard with metrics, charts and table";
  }

  if (requestedShape.shape === "workflow") {
    return "create a node-based workflow environment that can be manipulated";
  }

  if (requestedShape.shape === "design") {
    return "create a wireframe or design environment with editable layout blocks";
  }

  if (requestedShape.shape === "document") {
    return "create a structured document with sections and direct editing";
  }

  if (requestedShape.shape === "app" || requestedShape.shape === "code_project") {
    return "create a runnable application environment, not just a code snippet";
  }

  if (requestedShape.shape === "project") {
    return "create a persistent project environment with linked objects and execution context";
  }

  return actionMode === "analyze"
    ? "understand, compare or explain the problem clearly"
    : "understand the real need and produce the right environment";
}

function inferHiddenConstraints(prompt = "", requestedShape = { shape: "unknown" }) {
  const normalized = normalizeText(prompt);
  const constraints = [];
  const workspaceFamily = resolveWorkspaceFamily({
    prompt,
    shape: requestedShape.shape,
    workspaceFamilyId: requestedShape.workspaceFamilyId || ""
  });

  if (requestedShape.shape === "spreadsheet" || requestedShape.shape === "dataset") {
    constraints.push("must render as a table or data grid, not as plain text");
    constraints.push("must remain directly editable after creation");
  }

  if (requestedShape.shape === "presentation") {
    constraints.push("must be structured as multiple slides");
    constraints.push("must render as a presentation, not as a document");
  }

  if (requestedShape.shape === "dashboard") {
    constraints.push("must expose metrics, charts and filters in one coherent surface");
  }

  if (requestedShape.shape === "workflow") {
    constraints.push("must expose steps and connections as an interactive flow");
  }

  if (requestedShape.shape === "design") {
    constraints.push("must expose layout frames and blocks visually");
  }

  if (requestedShape.shape === "app" || requestedShape.shape === "code_project") {
    constraints.push("must produce a runnable environment, not a generic template answer");
    constraints.push("must surface live preview when runtime is available");
  }

  if (workspaceFamily?.id === "workflow_automation") {
    constraints.push("must expose a visible automation flow, not just prose");
  }

  if (workspaceFamily?.id === "media" || workspaceFamily?.id === "audio") {
    constraints.push("must stay linked to the current project so it can be derived from existing assets");
  }

  if (has(/\b(simple|simplement|clean|propre|clear|lisible)\b/, normalized)) {
    constraints.push("must stay clear and usable for the target user");
  }

  return [...new Set(constraints)];
}

function inferImpliedNeeds(requestedShape = { shape: "unknown" }, actionMode = "ask") {
  const needs = ["persistence", "direct_editing", "clear_default_surface"];
  const workspaceFamily = resolveWorkspaceFamily({
    shape: requestedShape.shape,
    workspaceFamilyId: requestedShape.workspaceFamilyId || ""
  });

  if (actionMode === "modify") {
    needs.push("continuity_with_current_object");
  }

  if (["app", "code_project", "project"].includes(requestedShape.shape)) {
    needs.push("execution_runtime", "project_shell", "delivery_visibility");
  }

  if (["dashboard", "workflow", "design", "presentation", "spreadsheet", "dataset"].includes(requestedShape.shape)) {
    needs.push("specialized_surface", "interactive_preview");
  }

  if (requestedShape.shape === "document") {
    needs.push("structured_sections");
  }

  if (workspaceFamily?.continuityMode === "project_first") {
    needs.push("project_level_continuity");
  }

  if (["media", "audio", "strategy_planning", "project_management"].includes(workspaceFamily?.id || "")) {
    needs.push("derived_objects_inside_same_project");
  }

  return [...new Set(needs)];
}

function inferAmbiguity(prompt = "", requestedShape = { shape: "unknown" }, actionMode = "ask") {
  const normalized = normalizeText(prompt);
  const reasons = [];

  if (requestedShape.shape === "unknown") {
    reasons.push("requested format is not explicit");
  }

  if (normalized.length < 18) {
    reasons.push("prompt is very short");
  }

  if (has(/\b(fais-le|fais le|do it|make it|vas-y|vas y)\b/, normalized)) {
    reasons.push("request depends on previous context");
  }

  if (!reasons.length && actionMode !== "ask") {
    return {
      level: "low",
      reasons: []
    };
  }

  return {
    level: reasons.length >= 2 ? "high" : reasons.length === 1 ? "medium" : "low",
    reasons
  };
}

export function extractIntentProfile({
  prompt = "",
  attachments = [],
  classification = "simple_chat",
  activeWorkObject = null
} = {}) {
  const normalizedPrompt = normalizeText(prompt);
  const requestedShape = resolveRequestedShape(prompt);
  const workspaceFamily = resolveWorkspaceFamily({
    prompt,
    shape: requestedShape.shape,
    objectKind: activeWorkObject?.objectKind || activeWorkObject?.kind || "",
    workspaceFamilyId:
      requestedShape.workspaceFamilyId ||
      activeWorkObject?.workspaceFamilyId ||
      activeWorkObject?.metadata?.workspaceFamilyId ||
      ""
  });
  const userExpertise = inferUserExpertise(prompt, attachments);
  const actionMode = inferActionMode(prompt, requestedShape, activeWorkObject);
  const ambiguity = inferAmbiguity(prompt, requestedShape, actionMode);
  const hiddenConstraints = inferHiddenConstraints(prompt, requestedShape);
  const impliedNeeds = inferImpliedNeeds(requestedShape, actionMode);
  const primaryObjective = inferPrimaryObjective(prompt, requestedShape, actionMode);
  const explicitNewEnvironment =
    /\b(new|another|nouveau|nouvelle|autre|from scratch|different)\b/.test(normalizedPrompt);
  const continuationSignals =
    /\b(this|current|ce|cet|cette|ceci|same|continue|poursuis|add|ajoute|improve|ameliore|modifie|mets a jour)\b/.test(
      normalizedPrompt
    );
  const summaryTarget =
    workspaceFamily?.label ||
    (requestedShape.shape !== "unknown" ? requestedShape.shape : "environment");

  return {
    prompt: String(prompt || "").trim(),
    normalizedPrompt,
    classification,
    requestedShape,
    workspaceFamily,
    actionMode,
    userExpertise,
    ambiguity,
    hiddenConstraints,
    impliedNeeds,
    primaryObjective,
    explicitNewEnvironment,
    continuationSignals,
    activeObjectKind: activeWorkObject?.objectKind || activeWorkObject?.kind || "",
    summary: `${actionMode} ${summaryTarget} for ${userExpertise} user`
  };
}

export default {
  extractIntentProfile
};
