import { normalizePromptText } from "./promptNormalization.js";
import { resolveRequestedShape } from "./creationShape.js";

function normalizeText(value = "") {
  return normalizePromptText(value);
}

function isPoliteExecutionRequest(prompt = "") {
  const normalized = normalizeText(prompt);
  const politeLead =
    /^(peux[- ]?tu|peux[- ]?vous|can you|could you|est[- ]?ce que tu peux|est[- ]?ce que vous pouvez)\b/.test(
      normalized
    );
  if (!politeLead) {
    return false;
  }

  const explicitHowOrExplain =
    /\b(comment|how|explique|explain|guide|guidance|aide moi a|help me (?:to )?)\b/.test(
      normalized
    );
  if (explicitHowOrExplain) {
    return false;
  }

  return /\b(scaffold|create|build|generate|write|implement|make|ship|produce|code|program|develop|craft|creer|cree|fais|construis|genere|ecris|code|programme|developpe|fabrique|produis|realise|monte|lance)\b/.test(
    normalized
  );
}

function looksLikeAdviceOrQuestion(prompt = "") {
  const normalized = normalizeText(prompt);
  if (isPoliteExecutionRequest(normalized)) {
    return false;
  }
  return /^(comment|how|pourquoi|why|peux[- ]?tu|peux[- ]?vous|can you|could you|explique|explain)\b/.test(
    normalized
  );
}

function hasStrongActionSignal(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(scaffold|create|build|generate|write|implement|make|ship|produce|code|program|develop|craft|transform|convert|evolve|creer|cree|fais|construis|genere|ecris|code|programme|fabrique|produis|realise|monte|developpe|lance|transforme|convertis|evolue)\b/.test(
    normalized
  );
}

function hasEnvironmentCreateSignal(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(create|build|generate|make|write|produce|draft|code|program|develop|creer|cree|fais|construis|genere|ecris|code|programme|developpe|produis|fabrique|realise)\b/.test(
    normalized
  );
}

function hasEnvironmentUpdateSignal(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(add|improve|update|edit|refine|continue|complete|fix|adjust|modify|ajoute|ameliore|modifie|mets a jour|corrige|complete|poursuis|continue|garde|conserve|enrichis?)\b/.test(
    normalized
  );
}

function hasEnvironmentTransformSignal(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(transform|convert|evolve|turn)\b|\b(transforme|convertis|fais.*devenir|evolue|passe.*en)\b/.test(
    normalized
  );
}

function hasExecutionObject(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(project|projet|workspace|experience|pitch|presentation|narratif|narrative|story|storytelling|music|musique|audio|visuel|visual|files|fichiers|squelette|skeleton|scaffold|app|application|dashboard|ui|interface|tool|widget|api|backend|frontend|auth|jwt|signup|login|route|routes|controller|service|module|modules)\b/.test(
    normalized
  );
}

function isShortExecutionFollowUp(prompt = "") {
  const normalized = normalizeText(prompt);
  return /^(fais-le|fais le|build it|do it|make it|construct it|construis-le|construis le|genere-les|genere les|genere-le|genere le|cree-les|cree les|cree-le|cree le|scaffold-le|scaffold le|ecris-le|ecris le|maintenant|vas-y|vas y|go ahead|do it now)$/.test(
    normalized
  );
}

function isEnvironmentShape(shape = "") {
  return [
    "spreadsheet",
    "dataset",
    "presentation",
    "document",
    "dashboard",
    "workflow",
    "design",
    "benchmark",
    "campaign",
    "image",
    "audio",
    "video"
  ].includes(String(shape || "").trim().toLowerCase());
}

function isProjectShape(shape = "") {
  return ["project", "app", "code_project"].includes(
    String(shape || "").trim().toLowerCase()
  );
}

function shapeToObjectKind(shape = "") {
  const normalized = String(shape || "").trim().toLowerCase();
  if (["spreadsheet", "dataset"].includes(normalized)) {
    return "dataset";
  }
  if (["project", "app", "code_project"].includes(normalized)) {
    return "project";
  }
  return normalized;
}

function inferScaffoldTemplate(prompt = "", projectContext = null) {
  const normalized = normalizeText(prompt);
  const requestedShape = resolveRequestedShape(prompt);

  if (
    ["spreadsheet", "presentation", "document", "dataset", "dashboard", "workflow", "design", "benchmark", "campaign", "image", "audio", "video"].includes(
      requestedShape.shape
    )
  ) {
    return null;
  }

  if (
    requestedShape.shape === "project" ||
    (projectContext?.isProjectTask &&
      /\b(project|projet|workspace|experience|platform|plateforme|systeme|system)\b/.test(
        normalized
      ))
  ) {
    return "global_multidimensional_project";
  }

  if (/\b(auth|authentication|jwt|signup|login|signin|token)\b/.test(normalized)) {
    return "node_express_jwt_auth";
  }

  if (
    /\b(app|application|dashboard|frontend|ui|interface|landing page|page web|tool|widget)\b/.test(normalized) &&
    !/\b(api|backend|auth|jwt|route|controller|service|database)\b/.test(normalized)
  ) {
    return "static_html_app";
  }

  if (/\b(express|node)\b/.test(normalized) && /\b(api|backend|route|controller|service|project|projet|scaffold|squelette)\b/.test(normalized)) {
    return "express_structured_api";
  }

  if (/\b(api|backend|route|controller|service)\b/.test(normalized)) {
    return "express_structured_api";
  }

  if (
    projectContext?.isProjectTask ||
    /\b(project|projet|workspace|experience|campaign|brand)\b/.test(normalized)
  ) {
    return "global_multidimensional_project";
  }

  return null;
}

function buildExecutionPromptFromLatest(latestExecution = null) {
  const plan = latestExecution?.execution_plan || {};
  return (
    plan.basePrompt ||
    plan.resolvedPrompt ||
    plan.originalPrompt ||
    ""
  );
}

function getPreviousExecutionIntent(latestExecution = null) {
  return latestExecution?.execution_plan?.agentic?.executionIntent || null;
}

function getPreviousRequestedShape(latestExecution = null) {
  const previousIntent = getPreviousExecutionIntent(latestExecution);
  if (previousIntent?.requestedShape) {
    return previousIntent.requestedShape;
  }

  const previousEnvironmentId = String(
    latestExecution?.execution_plan?.agentic?.environmentPlan?.id || ""
  ).trim();
  if (previousEnvironmentId === "global_project") {
    return "project";
  }
  if (previousEnvironmentId === "app_environment") {
    return "app";
  }
  if (["document", "presentation", "dashboard", "workflow", "design"].includes(previousEnvironmentId)) {
    return previousEnvironmentId;
  }
  if (previousEnvironmentId === "dataset") {
    return "dataset";
  }

  return "";
}

function hasPreviousExecutableContext(latestExecution = null) {
  const previousPrompt = buildExecutionPromptFromLatest(latestExecution);
  if (!previousPrompt) {
    return false;
  }

  const previousClassification = latestExecution?.classification || "";
  return (
    ["coding", "artifact_generation", "compare", "complex_reasoning"].includes(previousClassification) ||
    hasExecutionObject(previousPrompt)
  );
}

export function resolveExecutionIntent({
  prompt = "",
  resolvedPrompt = "",
  latestExecution = null,
  classification = "",
  projectContext = null,
  activeWorkObject = null
} = {}) {
  const promptToUse = resolvedPrompt || prompt;
  const requestedShape = resolveRequestedShape(promptToUse);
  const actionSignal = hasStrongActionSignal(promptToUse);
  const createSignal = hasEnvironmentCreateSignal(promptToUse);
  const updateSignal = hasEnvironmentUpdateSignal(promptToUse);
  const transformSignal = hasEnvironmentTransformSignal(promptToUse);
  const executableTargetSignal =
    requestedShape.executable ||
    hasExecutionObject(promptToUse) ||
    Boolean(projectContext?.isProjectTask);
  const explicitAction =
    actionSignal &&
    executableTargetSignal &&
    !looksLikeAdviceOrQuestion(promptToUse);
  const followUpAction = isShortExecutionFollowUp(promptToUse) && hasPreviousExecutableContext(latestExecution);
  const previousPrompt = followUpAction ? buildExecutionPromptFromLatest(latestExecution) : "";
  const executionPrompt = followUpAction ? previousPrompt : promptToUse;
  const previousAction = getPreviousExecutionIntent(latestExecution)?.action || "";
  const previousRequestedShape = getPreviousRequestedShape(latestExecution);
  const requestedObjectKind = shapeToObjectKind(requestedShape.shape);
  const activeObjectKind = shapeToObjectKind(
    activeWorkObject?.objectKind || activeWorkObject?.kind || ""
  );
  const activeProjectShell = activeObjectKind === "project" && isEnvironmentShape(requestedShape.shape);
  const targetKindDiffers =
    Boolean(activeObjectKind) &&
    Boolean(requestedObjectKind) &&
    requestedObjectKind !== activeObjectKind;
  const followUpProjectAction =
    followUpAction &&
    (previousAction === "project_scaffold" || isProjectShape(previousRequestedShape));
  const followUpEnvironmentAction =
    followUpAction &&
    !followUpProjectAction &&
    (["environment_create", "environment_transform", "environment_update"].includes(previousAction) ||
      isEnvironmentShape(previousRequestedShape));
  const scaffoldTemplate = inferScaffoldTemplate(executionPrompt, projectContext);
  const inferredProjectExecution =
    Boolean(scaffoldTemplate) &&
    (Boolean(projectContext?.isProjectTask) || isProjectShape(requestedShape.shape)) &&
    (actionSignal || followUpProjectAction) &&
    !looksLikeAdviceOrQuestion(promptToUse);
  const projectReadyToAct =
    Boolean(scaffoldTemplate) &&
    (explicitAction ||
      inferredProjectExecution ||
      followUpProjectAction ||
      (classification === "artifact_generation" &&
        Boolean(projectContext?.isProjectTask) &&
        isProjectShape(requestedShape.shape)));
  const environmentUpdateReady =
    Boolean(activeWorkObject) &&
    updateSignal &&
    !looksLikeAdviceOrQuestion(promptToUse) &&
    (!requestedObjectKind || requestedObjectKind === activeObjectKind || activeObjectKind === "project");
  const environmentTransformReady =
    isEnvironmentShape(requestedShape.shape) &&
    !looksLikeAdviceOrQuestion(promptToUse) &&
    Boolean(activeWorkObject) &&
    !activeProjectShell &&
    (transformSignal || targetKindDiffers);
  const environmentCreateReady =
    isEnvironmentShape(requestedShape.shape) &&
    !looksLikeAdviceOrQuestion(promptToUse) &&
    (
      createSignal ||
      followUpEnvironmentAction ||
      activeProjectShell ||
      (classification === "artifact_generation" && !activeWorkObject)
    );

  let action = "none";
  let reason = "not_ready";
  let readyToAct = false;

  if (projectReadyToAct) {
    action = "project_scaffold";
    reason = followUpProjectAction
      ? "follow_up_project_execution_request"
      : explicitAction
        ? "explicit_project_execution_request"
        : inferredProjectExecution
          ? "inferred_project_execution"
          : "project_execution_ready";
    readyToAct = true;
  } else if (environmentTransformReady) {
    action = "environment_transform";
    reason = transformSignal
      ? "explicit_environment_transform"
      : "target_environment_differs_from_current";
    readyToAct = true;
  } else if (environmentUpdateReady) {
    action = "environment_update";
    reason = "update_current_environment";
    readyToAct = true;
  } else if (environmentCreateReady) {
    action = "environment_create";
    reason = followUpEnvironmentAction
      ? "follow_up_environment_creation"
      : "direct_environment_creation";
    readyToAct = true;
  }

  const confidence = !readyToAct
    ? 0.2
    : action === "project_scaffold"
      ? followUpProjectAction
        ? 0.9
        : explicitAction
          ? 0.96
          : inferredProjectExecution
            ? 0.88
            : 0.82
      : action === "environment_transform"
        ? 0.92
        : action === "environment_update"
          ? 0.89
          : followUpEnvironmentAction
            ? 0.86
            : 0.91;

  return {
    readyToAct,
    confidence,
    action,
    reason,
    executionPrompt,
    scaffoldTemplate,
    requestedShape: requestedShape.shape,
    targetObjectKind: requestedObjectKind || "",
    planState: readyToAct ? "ready" : "analysis",
    explicitAction,
    followUpAction,
    followUpProjectAction,
    followUpEnvironmentAction,
    continuesCurrentObject: action === "environment_update",
    requiresNewObject: ["project_scaffold", "environment_create", "environment_transform"].includes(action)
  };
}

export function shouldExecute(taskContext = {}, strategyDecision = {}, planState = "") {
  if (!taskContext?.readyToAct) {
    return false;
  }

  if (planState === "ready") {
    return true;
  }

  if (strategyDecision?.enableProjectBuilder && taskContext.confidence >= 0.8) {
    return true;
  }

  return false;
}

export default {
  resolveExecutionIntent,
  shouldExecute
};
