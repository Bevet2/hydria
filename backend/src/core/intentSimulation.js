import { inferEnvironmentObjectKind } from "./environmentPlanner.js";

function normalizeShape(shape = "") {
  return String(shape || "").trim().toLowerCase();
}

function isEnvironmentShape(shape = "") {
  return [
    "document",
    "presentation",
    "spreadsheet",
    "dataset",
    "dashboard",
    "workflow",
    "design"
  ].includes(normalizeShape(shape));
}

function isProjectShape(shape = "") {
  return ["project", "app", "code_project"].includes(normalizeShape(shape));
}

function toObjectKind(shape = "") {
  const normalized = normalizeShape(shape);
  if (["spreadsheet", "dataset"].includes(normalized)) {
    return "dataset";
  }
  if (isProjectShape(normalized)) {
    return "project";
  }
  return inferEnvironmentObjectKind(normalized);
}

function createCandidate(action, options = {}) {
  return {
    action,
    readyToAct: options.readyToAct !== false,
    targetKind: options.targetKind || "",
    score: 0.25,
    reasons: [],
    strategyHint: options.strategyHint || "fast_grounded_response"
  };
}

function pushReason(candidate, message, delta = 0) {
  candidate.reasons.push(message);
  candidate.score += delta;
}

function buildCandidates({
  intentProfile = null,
  executionIntent = null,
  activeWorkObject = null,
  projectContext = null,
  latestExecution = null
} = {}) {
  const requestedShape = normalizeShape(intentProfile?.requestedShape?.shape || "");
  const targetKind = toObjectKind(requestedShape);
  const activeKind = String(activeWorkObject?.objectKind || activeWorkObject?.kind || "").trim().toLowerCase();
  const ambiguityLevel = intentProfile?.ambiguity?.level || "low";
  const candidates = [];

  if (isProjectShape(requestedShape) || executionIntent?.scaffoldTemplate || projectContext?.isProjectTask) {
    candidates.push(
      createCandidate("project_scaffold", {
        targetKind: "project",
        strategyHint: "direct_project_execution"
      })
    );
  }

  if (isEnvironmentShape(requestedShape)) {
    candidates.push(
      createCandidate("environment_create", {
        targetKind,
        strategyHint: "direct_environment_creation"
      })
    );
  }

  if (activeWorkObject) {
    candidates.push(
      createCandidate("environment_update", {
        targetKind: activeKind || targetKind,
        strategyHint: "targeted_environment_update"
      })
    );
  }

  if (activeWorkObject && targetKind && activeKind && targetKind !== activeKind) {
    candidates.push(
      createCandidate("environment_transform", {
        targetKind,
        strategyHint: "environment_transformation"
      })
    );
  }

  if (ambiguityLevel === "high") {
    candidates.push(
      createCandidate("clarify_before_execution", {
        targetKind: activeKind || targetKind,
        strategyHint: "structured_reasoning",
        readyToAct: false
      })
    );
  }

  if (intentProfile?.actionMode === "analyze") {
    candidates.push(
      createCandidate("answer_only", {
        targetKind: activeKind || targetKind,
        strategyHint: "structured_reasoning",
        readyToAct: false
      })
    );
  }

  if (!candidates.length) {
    candidates.push(
      createCandidate("answer_only", {
        targetKind: activeKind || targetKind,
        strategyHint: "fast_grounded_response",
        readyToAct: false
      })
    );
  }

  return candidates;
}

function scoreCandidate(candidate, {
  intentProfile = null,
  executionIntent = null,
  activeWorkObject = null,
  projectContext = null,
  latestExecution = null
} = {}) {
  const requestedShape = normalizeShape(intentProfile?.requestedShape?.shape || "");
  const targetKind = toObjectKind(requestedShape);
  const activeKind = String(activeWorkObject?.objectKind || activeWorkObject?.kind || "").trim().toLowerCase();
  const ambiguityLevel = intentProfile?.ambiguity?.level || "low";
  const actionMode = intentProfile?.actionMode || "ask";
  const continuationSignals = Boolean(intentProfile?.continuationSignals);
  const explicitNewEnvironment = Boolean(intentProfile?.explicitNewEnvironment);
  const rawAction = executionIntent?.action || "none";
  const previousAction = latestExecution?.execution_plan?.agentic?.executionIntent?.action || "";

  if (candidate.action === rawAction) {
    pushReason(candidate, "matches the initial action inference", 0.24);
  }

  if (candidate.targetKind && targetKind && candidate.targetKind === targetKind) {
    pushReason(candidate, "matches the requested environment kind", 0.2);
  }

  if (candidate.action === "project_scaffold" && (isProjectShape(requestedShape) || projectContext?.isProjectTask)) {
    pushReason(candidate, "fits a project-level environment", 0.22);
  }

  if (candidate.action === "environment_create" && isEnvironmentShape(requestedShape)) {
    pushReason(candidate, "fits direct environment creation", 0.18);
  }

  if (candidate.action === "environment_update") {
    if (!activeWorkObject) {
      pushReason(candidate, "cannot update without an active object", -0.35);
    } else if (explicitNewEnvironment) {
      pushReason(candidate, "explicit new environment should not overwrite the current object", -0.28);
    } else if (continuationSignals || actionMode === "modify") {
      pushReason(candidate, "prompt asks to continue or improve the current object", 0.2);
    } else {
      pushReason(candidate, "current object exists and can be improved in place", 0.08);
    }
  }

  if (candidate.action === "environment_transform") {
    if (!activeWorkObject) {
      pushReason(candidate, "cannot transform without a source object", -0.35);
    } else if (targetKind && activeKind && targetKind !== activeKind) {
      pushReason(candidate, "requested target differs from the current object kind", 0.26);
    } else {
      pushReason(candidate, "transform is not necessary if the target matches the current kind", -0.18);
    }
  }

  if (candidate.action === "clarify_before_execution") {
    if (ambiguityLevel === "high") {
      pushReason(candidate, "prompt remains ambiguous enough to justify clarification", 0.24);
    } else {
      pushReason(candidate, "clarification is not necessary here", -0.18);
    }
  }

  if (candidate.action === "answer_only") {
    if (actionMode === "analyze") {
      pushReason(candidate, "prompt is analytical and should stay in reasoning mode", 0.28);
    } else {
      pushReason(candidate, "non-execution fallback remains available", 0.04);
    }
  }

  if (ambiguityLevel === "high" && candidate.readyToAct) {
    pushReason(candidate, "high ambiguity lowers confidence in direct execution", -0.12);
  }

  if (actionMode === "analyze" && candidate.readyToAct) {
    pushReason(candidate, "analytical intent should not jump into environment execution too early", -0.3);
  }

  if (executionIntent?.followUpAction || previousAction) {
    if (candidate.action === rawAction) {
      pushReason(candidate, "keeps continuity with the previous action", 0.08);
    }
    if (
      previousAction === "project_scaffold" &&
      candidate.action === "project_scaffold"
    ) {
      pushReason(candidate, "follows the previous project execution context", 0.08);
    }
  }

  candidate.score = Math.max(0, Math.min(1, Number(candidate.score.toFixed(3))));
  return candidate;
}

export function simulateIntentRoutes({
  prompt = "",
  intentProfile = null,
  executionIntent = null,
  activeWorkObject = null,
  projectContext = null,
  latestExecution = null
} = {}) {
  const candidates = buildCandidates({
    intentProfile,
    executionIntent,
    activeWorkObject,
    projectContext,
    latestExecution
  }).map((candidate) =>
    scoreCandidate(candidate, {
      prompt,
      intentProfile,
      executionIntent,
      activeWorkObject,
      projectContext,
      latestExecution
    })
  );

  const ranked = [...candidates].sort((left, right) => right.score - left.score);
  const executableRanked = ranked.filter((candidate) => candidate.readyToAct);
  const primaryCandidate = ranked[0] || null;
  const bestExecutable = executableRanked[0] || null;

  return {
    primaryCandidate,
    bestExecutable,
    candidates: ranked,
    summary: primaryCandidate
      ? `${primaryCandidate.action} selected first with score ${primaryCandidate.score}`
      : "no candidate"
  };
}

export function arbitrateExecutionIntent(rawExecutionIntent = {}, simulation = null) {
  const bestExecutable = simulation?.bestExecutable || null;
  if (!bestExecutable) {
    return rawExecutionIntent;
  }

  if (bestExecutable.score < 0.5 && rawExecutionIntent?.action === "none") {
    return {
      ...rawExecutionIntent,
      simulationSummary: simulation?.summary || ""
    };
  }

  const rawScore = Number(rawExecutionIntent?.confidence || 0);
  const shouldOverride =
    rawExecutionIntent?.action === "none" ||
    (bestExecutable.action !== rawExecutionIntent?.action &&
      bestExecutable.score >= rawScore + 0.08);

  if (!shouldOverride) {
    return {
      ...rawExecutionIntent,
      simulationSummary: simulation?.summary || ""
    };
  }

  return {
    ...rawExecutionIntent,
    readyToAct: bestExecutable.readyToAct,
    confidence: Math.max(rawScore, bestExecutable.score),
    action: bestExecutable.action,
    reason: `simulated:${bestExecutable.reasons[0] || bestExecutable.action}`,
    targetObjectKind: bestExecutable.targetKind || rawExecutionIntent?.targetObjectKind || "",
    continuesCurrentObject: bestExecutable.action === "environment_update",
    requiresNewObject: ["project_scaffold", "environment_create", "environment_transform"].includes(
      bestExecutable.action
    ),
    simulationSummary: simulation?.summary || ""
  };
}

export default {
  simulateIntentRoutes,
  arbitrateExecutionIntent
};
