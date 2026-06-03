import { createHash } from "node:crypto";
import config from "../../config/hydria.config.js";
import { AppError } from "../../utils/errors.js";
import { buildExecutionPlan } from "./planner.js";
import { askExternalHydria, askExternalHydriaCore } from "./externalHydriaApiClient.js";
import { generateDocumentArtifact } from "../artifacts/documentOrchestrator.js";
import {
  buildHydriaWorkspaceToolContract,
  buildWorkspaceContextFields,
  executeWorkspaceToolCalls,
  listHydriaWorkspaceTools,
  listWorkspaceToolsForWorkObject,
  normalizeWorkspaceToolCallsFromCore,
  synthesizeWorkspaceToolCallsFromPrompt
} from "./workspaceToolDispatcher.js";

const ALLOWED_ACTIONS = new Set([
  "reply",
  "create_artifact",
  "create_work_object",
  "update_work_object",
  "set_work_object_metadata"
]);
const WORKSPACE_ACTIONS = new Set(["workspace_tool_call"]);
const CONTROL_ACTIONS = new Set([...ALLOWED_ACTIONS, ...WORKSPACE_ACTIONS]);
const ACTIONS_ALLOWED_WITH_WORKSPACE_TOOL_CALL = new Set([
  "reply",
  "set_work_object_metadata"
]);

const GENERIC_FAILURE_PATTERN =
  /je n[' ]ai pas reussi|je n'ai pas reussi|reformule la question|failed to generate|could not generate/i;

function compact(value = "", maxChars = 1200) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trim()}...`;
}

function trimText(value = "", maxChars = 12000) {
  return String(value || "").slice(0, maxChars);
}

function stableUuidFromText(value = "") {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const chars = createHash("sha256").update(text).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function safeJsonParse(rawText = "") {
  const text = String(rawText || "").trim();
  if (!text) {
    return null;
  }

  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);

  try {
    return JSON.parse(objectMatch?.[0] || candidate);
  } catch {
    return null;
  }
}

function extractAnswer(result) {
  return (
    result?.answer ||
    result?.display?.primaryText ||
    result?.result?.answer ||
    result?.message ||
    ""
  );
}

function normalizeAction(rawAction = {}) {
  const type = String(rawAction.type || rawAction.action || "").trim();
  if (!ALLOWED_ACTIONS.has(type)) {
    return null;
  }

  return {
    type,
    title: compact(rawAction.title || "", 180),
    prompt: trimText(rawAction.prompt || rawAction.instruction || "", 4000),
    content: trimText(rawAction.content || "", 24000),
    workObjectId: compact(rawAction.workObjectId || rawAction.id || "", 160),
    entryPath: compact(rawAction.entryPath || rawAction.path || "", 260),
    note: compact(rawAction.note || rawAction.reason || "", 260),
    kind: compact(rawAction.kind || rawAction.objectKind || "document", 80),
    format: compact(rawAction.format || "", 24).toLowerCase(),
    documentType: compact(rawAction.documentType || "", 80),
    mode: compact(rawAction.mode || "replace", 40).toLowerCase(),
    status: compact(rawAction.status || "", 80),
    advice: trimText(rawAction.advice || rawAction.rationale || "", 2400),
    columns: Array.isArray(rawAction.columns)
      ? rawAction.columns.map((item) => compact(item, 80)).filter(Boolean).slice(0, 16)
      : [],
    sections: Array.isArray(rawAction.sections)
      ? rawAction.sections.map((item) => compact(item, 100)).filter(Boolean).slice(0, 12)
      : []
  };
}

function normalizeManifest(parsed = null) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const rawActions = Array.isArray(parsed.actions)
    ? parsed.actions
    : Array.isArray(parsed.commands)
      ? parsed.commands
      : [];
  const actions = rawActions
    .map(normalizeAction)
    .filter(Boolean)
    .slice(0, config.externalHydria.controlMaxActions);
  const workspaceToolCalls = normalizeWorkspaceToolCallsFromCore({
    proposedActions: rawActions,
    workspaceToolCalls:
      parsed.workspaceToolCalls ||
      parsed.workspace_tool_calls ||
      parsed.workspace_tool_call ||
      parsed.toolCalls ||
      []
  }).slice(0, config.externalHydria.controlMaxActions);

  return {
    reply: compact(parsed.reply || parsed.message || "", 1600),
    actions,
    workspaceToolCalls
  };
}

function normalizeProposedAction(rawAction = {}) {
  if (!rawAction || typeof rawAction !== "object") {
    return null;
  }

  const payload = rawAction.payload && typeof rawAction.payload === "object" ? rawAction.payload : {};
  return normalizeAction({
    type: rawAction.type,
    title: rawAction.title || payload.title,
    prompt: payload.instruction || payload.prompt || payload.content,
    content: payload.content || payload.initialContent || "",
    workObjectId: rawAction.target?.workObjectId || payload.workObjectId,
    entryPath: rawAction.target?.entryPath || payload.entryPath,
    note: rawAction.rationale || payload.note,
    kind: payload.kind,
    format: payload.format,
    documentType: payload.documentType,
    mode: payload.mode,
    status: payload.status,
    advice: payload.answerDraft || payload.advice,
    columns: payload.columns,
    sections: payload.sections
  });
}

function filterActionsForWorkspaceToolCalls(actions = [], workspaceToolCalls = []) {
  if (!workspaceToolCalls.length) {
    return actions;
  }

  return actions.filter((action) => ACTIONS_ALLOWED_WITH_WORKSPACE_TOOL_CALL.has(action.type));
}

function synthesizeLocalWorkspaceToolCalls({
  prompt = "",
  activeWorkObject = null,
  activeWorkObjectContent = ""
} = {}) {
  return synthesizeWorkspaceToolCallsFromPrompt({
    prompt,
    activeWorkObject,
    activeWorkObjectContent
  }).slice(0, config.externalHydria.controlMaxActions);
}

function mergeWorkspaceToolCalls(primary = [], fallback = []) {
  const seen = new Set();
  return [...primary, ...fallback]
    .filter(Boolean)
    .filter((call) => {
      const key = [
        call.target?.workObjectId || "",
        call.target?.entryPath || "",
        call.payload?.toolName || "",
        JSON.stringify(call.payload?.operations || [])
      ].join("|");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, config.externalHydria.controlMaxActions);
}

function makeWorkspaceToolCallsExecutable(calls = []) {
  return calls.map((call) => ({
    ...call,
    dryRun: false
  }));
}

function buildSystemPrompt() {
  const allTools = listHydriaWorkspaceTools();
  const sheetTools = allTools.filter((tool) => tool.startsWith("sheet.")).join(", ");
  const docTools = allTools.filter((tool) => tool.startsWith("doc.")).join(", ");
  const slideTools = allTools.filter((tool) => tool.startsWith("slide.")).join(", ");
  return [
    "You are Hydria Core controlling Hydria OS through a strict action manifest.",
    "Return JSON only. Do not return prose outside JSON.",
    "Hydria OS will validate and execute your allowed actions locally.",
    "Allowed actions:",
    "- reply: { type, content } for a message only.",
    "- create_artifact: { type, title, prompt, format, documentType, advice?, columns?, sections? }.",
    "- create_work_object: { type, kind, title, content, entryPath? }.",
    "- update_work_object: { type, workObjectId, entryPath?, content, mode: replace|append, note? }.",
    "- set_work_object_metadata: { type, workObjectId, title?, status? }.",
    "- workspace_tool_call: { type, target: { workObjectId, entryPath }, payload: { toolName, operations } }.",
    `Workspace tools available for Sheets: ${sheetTools}.`,
    `Workspace tools available for Documents: ${docTools}.`,
    `Workspace tools available for Slides: ${slideTools}.`,
    "Never invent workObjectId values. Use only ids present in Hydria state.",
    "If no safe action is possible, return {\"reply\":\"...\",\"actions\":[]}.",
    "Prefer concrete actions over generic advice when the user asks Hydria to create, update, or manipulate something."
  ].join("\n");
}

function buildHydriaState({
  prompt,
  userId,
  conversationId,
  projectId = "",
  activeWorkObject = null,
  activeWorkObjectContent = "",
  workObjectService = null
}) {
  const recentWorkObjects = workObjectService
    ? workObjectService.listForConversation({
        userId,
        conversationId,
        limit: 8
      })
    : [];
  const workspaceFields = buildWorkspaceContextFields({
    activeWorkObject,
    contentPreview: activeWorkObjectContent
  });

  return {
    user: {
      userId,
      conversationId,
      projectId
    },
    userRequest: compact(prompt, 1600),
    allowedActions: [...CONTROL_ACTIONS],
    localCapabilities: {
      artifactFormats: ["docx", "pdf", "pptx", "xlsx", "csv", "html", "md", "txt", "json", "image"],
      workObjectKinds: ["document", "presentation", "dataset", "dashboard", "workflow", "design", "project", "app"],
      workspaceTools: workspaceFields.workspaceTools,
      workspaceToolContract: buildHydriaWorkspaceToolContract({
        workspaceTools: workspaceFields.workspaceTools
      }),
      canCreateArtifacts: true,
      canCreateWorkObjects: true,
      canUpdateWorkObjects: true
    },
    activeWorkObject: activeWorkObject
      ? {
          id: activeWorkObject.id,
          title: activeWorkObject.title,
          kind: activeWorkObject.objectKind || activeWorkObject.kind,
          workspaceFamilyId: workspaceFields.workspaceFamilyId,
          primaryFile: activeWorkObject.file?.path || activeWorkObject.primaryFile || "",
          entryPath: activeWorkObject.file?.path || activeWorkObject.primaryFile || "",
          contentFormat: workspaceFields.contentFormat,
          contentPreview: compact(activeWorkObjectContent, 1200),
          workspaceTools: workspaceFields.workspaceTools
        }
      : null,
    recentWorkObjects: recentWorkObjects.map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.objectKind || item.kind,
      primaryFile: item.primaryFile || "",
      status: item.status || ""
    }))
  };
}

function buildPublicWorkspaceContext({
  prompt = "",
  userId,
  conversationId,
  projectId = "",
  activeWorkObject = null,
  activeWorkObjectContent = "",
  workObjectService = null
}) {
  const recentWorkObjects = workObjectService
    ? workObjectService.listForConversation({
        userId,
        conversationId,
        limit: 8
      })
    : [];
  const workspaceFields = buildWorkspaceContextFields({
    activeWorkObject,
    contentPreview: activeWorkObjectContent
  });
  const workspaceToolContract = buildHydriaWorkspaceToolContract({
    workspaceTools: workspaceFields.workspaceTools
  });
  const activeEntryPath = activeWorkObject?.file?.path || activeWorkObject?.primaryFile || activeWorkObject?.activeEntryPath || "";

  return {
    os: {
      name: "Hydria OS",
      role: "workspace_controller_bridge"
    },
    session: {
      userId: String(userId || ""),
      conversationId: String(conversationId || ""),
      projectId: String(projectId || "")
    },
    userRequest: compact(prompt, 1600),
    workspaceFamilyId: workspaceFields.workspaceFamilyId,
    contentFormat: workspaceFields.contentFormat,
    contentPreview: workspaceFields.contentPreview,
    workspaceTools: workspaceFields.workspaceTools,
    workspaceToolContract,
    activeWorkObject: activeWorkObject
      ? {
          id: activeWorkObject.id,
          title: activeWorkObject.title,
          kind: activeWorkObject.objectKind || activeWorkObject.kind,
          workspaceFamilyId: workspaceFields.workspaceFamilyId,
          entryPath: activeEntryPath,
          contentFormat: workspaceFields.contentFormat,
          contentPreview: workspaceFields.contentPreview,
          editable: true,
          workspaceTools: workspaceFields.workspaceTools
        }
      : undefined,
    recentWorkObjects: recentWorkObjects.map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.objectKind || item.kind,
      entryPath: item.primaryFile || item.activeEntryPath || "",
      editable: true
    })),
    capabilities: {
      actions: [...CONTROL_ACTIONS],
      artifactFormats: ["docx", "pdf", "pptx", "xlsx", "csv", "html", "md", "txt", "json", "image"],
      workObjectKinds: ["document", "presentation", "dataset", "dashboard", "workflow", "design", "project", "app"],
      workspaceTools: workspaceFields.workspaceTools,
      workspaceToolContract
    },
    controlContract: {
      responseMode: "return_actions_for_hydria_os_execution",
      acceptedActionTypes: [...CONTROL_ACTIONS],
      osExecutesReturnedActions: true,
      preferredActionType: "workspace_tool_call",
      directCallbackAvailable: Boolean(config.externalHydria.controlToken)
    },
    executionPolicy: {
      mode: "propose_only",
      requireConfirmation: false,
      hydriaOsExecutesReturnedActions: true
    }
  };
}

export function buildExternalHydriaWorkspaceContext(args = {}) {
  return buildPublicWorkspaceContext(args);
}

function buildQuestion(args) {
  return [
    "Hydria OS state:",
    JSON.stringify(buildHydriaState(args), null, 2),
    "",
    "Return one JSON object with this shape:",
    "{\"reply\":\"short optional text\",\"actions\":[{\"type\":\"create_artifact\",\"title\":\"...\",\"prompt\":\"...\",\"format\":\"xlsx\"}],\"workspaceToolCalls\":[{\"type\":\"workspace_tool_call\",\"target\":{\"workObjectId\":\"...\",\"entryPath\":\"table.csv\"},\"payload\":{\"toolName\":\"sheet.apply_formula\",\"operations\":[]}}]}"
  ].join("\n");
}

function buildActionAdvice(action) {
  const parts = [];
  if (action.advice) {
    parts.push(action.advice);
  }
  if (action.columns.length) {
    parts.push(`Columns: ${action.columns.join(", ")}`);
  }
  if (action.sections.length) {
    parts.push(`Sections: ${action.sections.join(", ")}`);
  }
  return parts.join("\n");
}

function assertWorkObjectAccess(workObject, userId) {
  if (!workObject) {
    throw new AppError("Work object not found", 404);
  }

  if (Number(workObject.userId || 0) && Number(workObject.userId) !== Number(userId)) {
    throw new AppError("Work object does not belong to this user", 403);
  }
}

function splitCsvLine(line = "") {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function serializeCsvCell(value = "") {
  const text = String(value || "");
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
}

function serializeCsvRows(rows = []) {
  return rows.map((row) => row.map(serializeCsvCell).join(",")).join("\n");
}

function normalizeLabel(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractRequestedColumnName(prompt = "") {
  const text = String(prompt || "").trim();
  const match =
    text.match(/(?:colonne|column|champ|field)\s+["'`“”]?([^"',.;:\n\r]+)/i) ||
    text.match(/(?:ajoute|add)\s+["'`“”]?([^"',.;:\n\r]+?)\s+(?:au|to)\s+(?:tableur|spreadsheet|csv|table)/i);

  if (!match?.[1]) {
    return "";
  }

  return match[1]
    .replace(/^(de|du|des|la|le|les|une|un|the|a|an)\s+/i, "")
    .replace(/\s+(au|dans|to|in)\s+.*$/i, "")
    .trim()
    .slice(0, 80);
}

function tryApplyDirectCsvUpdate({ content = "", prompt = "" } = {}) {
  const normalizedPrompt = normalizeLabel(prompt);
  if (!/\b(ajoute|add)\b/.test(normalizedPrompt) || !/\b(colonne|column|champ|field)\b/.test(normalizedPrompt)) {
    return null;
  }

  const columnName = extractRequestedColumnName(prompt);
  if (!columnName) {
    return null;
  }

  const rows = String(content || "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map(splitCsvLine);

  if (!rows.length) {
    return null;
  }

  const headers = rows[0];
  if (headers.some((header) => normalizeLabel(header) === normalizeLabel(columnName))) {
    return {
      content: serializeCsvRows(rows),
      note: `Column already present: ${columnName}`
    };
  }

  const nextRows = rows.map((row, index) => [
    ...row,
    index === 0 ? columnName : ""
  ]);

  return {
    content: serializeCsvRows(nextRows),
    note: `Added CSV column: ${columnName}`
  };
}

export async function requestExternalHydriaControl({
  prompt,
  userId,
  conversationId,
  projectId = "",
  activeWorkObject = null,
  activeWorkObjectContent = "",
  workObjectService = null
} = {}) {
  if (!config.externalHydria.enabled || !config.externalHydria.controlEnabled) {
    return {
      used: false,
      skippedReason: "not_configured",
      reply: "",
      actions: [],
      workspaceToolCalls: []
    };
  }

  const publicControl = await requestPublicHydriaControl({
    prompt,
    userId,
    conversationId,
    projectId,
    activeWorkObject,
    activeWorkObjectContent,
    workObjectService
  }).catch((error) => ({
    used: false,
    skippedReason: `public_api_failed:${error.message || "unknown"}`,
    reply: "",
    actions: [],
    workspaceToolCalls: [],
    raw: null
  }));

  if (publicControl.used) {
    return publicControl;
  }

  const localWorkspaceToolCalls = synthesizeLocalWorkspaceToolCalls({
    prompt,
    activeWorkObject,
    activeWorkObjectContent
  });
  if (localWorkspaceToolCalls.length) {
    return {
      used: true,
      skippedReason: "",
      reply: publicControl.reply || "",
      actions: [],
      workspaceToolCalls: makeWorkspaceToolCallsExecutable(localWorkspaceToolCalls),
      proposedActions: localWorkspaceToolCalls,
      raw: publicControl.raw || null,
      publicSkippedReason: publicControl.skippedReason || "",
      source: publicControl.skippedReason?.startsWith("public_api_failed")
        ? "hydria_os_local_workspace_fallback_after_public_api_failure"
        : "hydria_os_local_workspace_fallback_after_public_api"
    };
  }

  const result = await askExternalHydriaCore({
    mode: "local_model",
    system: buildSystemPrompt(),
    question: buildQuestion({
      prompt,
      userId,
      conversationId,
      projectId,
      activeWorkObject,
      activeWorkObjectContent,
      workObjectService
    }),
    timeoutMs: config.externalHydria.controlTimeoutMs
  });
  const answer = extractAnswer(result);

  if (!answer || GENERIC_FAILURE_PATTERN.test(answer)) {
    return {
      used: false,
      skippedReason: "low_quality",
      reply: "",
      actions: [],
      workspaceToolCalls: [],
      raw: result
    };
  }

  const manifest = normalizeManifest(safeJsonParse(answer));
  if (!manifest) {
    return {
      used: false,
      skippedReason: "invalid_manifest",
      reply: compact(answer, 1600),
      actions: [],
      workspaceToolCalls: [],
      raw: result
    };
  }

  const fallbackWorkspaceToolCalls = synthesizeLocalWorkspaceToolCalls({
      prompt,
      activeWorkObject,
      activeWorkObjectContent
  });
  const workspaceToolCalls = manifest.workspaceToolCalls.length
    ? manifest.workspaceToolCalls
    : fallbackWorkspaceToolCalls;

  return {
    used: true,
    skippedReason: "",
    reply: manifest.reply,
    actions: filterActionsForWorkspaceToolCalls(manifest.actions, workspaceToolCalls),
    workspaceToolCalls,
    raw: result
  };
}

export async function requestPublicHydriaControl({
  prompt,
  userId,
  conversationId,
  projectId = "",
  activeWorkObject = null,
  activeWorkObjectContent = "",
  workObjectService = null
} = {}) {
  if (!config.externalHydria.enabled || !config.externalHydria.controlEnabled) {
    return {
      used: false,
      skippedReason: "not_configured",
      reply: "",
      actions: [],
      workspaceToolCalls: []
    };
  }

  const result = await askExternalHydria({
    input: prompt,
    userId,
    projectId: projectId || activeWorkObject?.projectId || "",
    sessionId: stableUuidFromText(`hydria-os:${conversationId || ""}`),
    options: {
      includeSources: true,
      includeTrace: false,
      includeDiagnostics: false,
      includeProposedActions: true,
      workspaceToolMode: "return_workspace_tool_calls",
      controlSurface: "hydria_os"
    },
    workspaceContext: buildPublicWorkspaceContext({
      prompt,
      userId,
      conversationId,
      projectId,
      activeWorkObject,
      activeWorkObjectContent,
      workObjectService
    }),
    metadata: {
      source: "hydria_os",
      bridge: "external_hydria_control",
      userId: String(userId || ""),
      conversationId: String(conversationId || ""),
      projectId: String(projectId || activeWorkObject?.projectId || ""),
      activeWorkObjectId: activeWorkObject?.id || "",
      activeEntryPath:
        activeWorkObject?.file?.path ||
        activeWorkObject?.primaryFile ||
        activeWorkObject?.activeEntryPath ||
        ""
    },
    timeoutMs: config.externalHydria.controlTimeoutMs
  });
  const proposedActions = Array.isArray(result?.proposedActions) ? result.proposedActions : [];
  const actions = proposedActions.length
    ? proposedActions
        .map(normalizeProposedAction)
        .filter(Boolean)
        .filter((action) => action.type !== "reply")
        .slice(0, config.externalHydria.controlMaxActions)
    : [];
  const publicWorkspaceToolCalls = makeWorkspaceToolCallsExecutable(
    normalizeWorkspaceToolCallsFromCore(result)
  );
  const localWorkspaceToolCalls = synthesizeLocalWorkspaceToolCalls({
    prompt,
    activeWorkObject,
    activeWorkObjectContent
  });
  const shouldUseLocalFallback =
    !actions.length && !publicWorkspaceToolCalls.length && localWorkspaceToolCalls.length;
  const workspaceToolCalls = shouldUseLocalFallback
    ? makeWorkspaceToolCallsExecutable(localWorkspaceToolCalls)
    : publicWorkspaceToolCalls;

  if (!actions.length && !workspaceToolCalls.length) {
    return {
      used: false,
      skippedReason: "no_public_actions",
      reply: compact(result?.answer || "", 1600),
      actions: [],
      workspaceToolCalls: [],
      raw: result
    };
  }

  return {
    used: true,
    skippedReason: "",
    reply: compact(result?.answer || "", 1600),
    actions: filterActionsForWorkspaceToolCalls(actions, workspaceToolCalls),
    workspaceToolCalls,
    proposedActions: shouldUseLocalFallback ? localWorkspaceToolCalls : proposedActions,
    raw: result,
    source: shouldUseLocalFallback ? "public_api_v1_with_local_workspace_fallback" : "public_api_v1"
  };
}

export async function executeExternalHydriaActions({
  actions = [],
  userId,
  conversationId,
  prompt = "",
  projectId = "",
  workObjectService
} = {}) {
  if (!workObjectService) {
    throw new AppError("Work object service is required for Hydria control actions.", 500);
  }

  const normalizedActions = actions
    .map((action) => normalizeAction(action) || normalizeProposedAction(action))
    .filter(Boolean)
    .slice(0, config.externalHydria.controlMaxActions);
  const results = [];

  for (const action of normalizedActions) {
    if (action.type === "reply") {
      results.push({
        type: action.type,
        status: "completed",
        reply: action.content || action.prompt || action.note
      });
      continue;
    }

    if (action.type === "create_work_object") {
      const workObject = workObjectService.createBlankWorkObject({
        kind: action.kind || "document",
        title: action.title || "Hydria API object",
        userId,
        conversationId,
        projectId
      });
      let updated = workObject;
      if (action.content) {
        updated = await workObjectService.updateContent({
          workObjectId: workObject.id,
          entryPath: action.entryPath || workObject.primaryFile || "",
          content: action.content,
          note: action.note || "Created by Hydria Core API",
          actor: "hydria_core_api"
        });
      }

      results.push({
        type: action.type,
        status: "completed",
        workObject: updated
      });
      continue;
    }

    if (action.type === "update_work_object") {
      const current = workObjectService.get(action.workObjectId, {
        includeContent: true,
        entryPath: action.entryPath || ""
      });
      assertWorkObjectAccess(current, userId);

      if (!action.content && action.prompt) {
        const directCsvUpdate = /\.csv$/i.test(action.entryPath || current.primaryFile || "")
          ? tryApplyDirectCsvUpdate({
              content: current.file?.content || "",
              prompt: action.prompt
            })
          : null;

        if (directCsvUpdate) {
          const updated = await workObjectService.updateContent({
            workObjectId: action.workObjectId,
            entryPath: action.entryPath || current.primaryFile || "",
            content: directCsvUpdate.content,
            note: directCsvUpdate.note,
            actor: "hydria_core_api"
          });

          results.push({
            type: action.type,
            status: "completed",
            workObject: updated,
            finalAnswer: `J'ai mis a jour ${updated.title || "le tableur"}: ${directCsvUpdate.note}.`
          });
          continue;
        }

        const improved = await workObjectService.improveObject({
          workObjectId: action.workObjectId,
          entryPath: action.entryPath || current.primaryFile || "",
          prompt: action.prompt
        });

        results.push({
          type: action.type,
          status: "completed",
          workObject: improved.workObject,
          finalAnswer: improved.finalAnswer
        });
        continue;
      }

      const currentContent = current.file?.content || "";
      const nextContent =
        action.mode === "append"
          ? `${currentContent}${currentContent ? "\n\n" : ""}${action.content}`
          : action.content;
      const updated = await workObjectService.updateContent({
        workObjectId: action.workObjectId,
        entryPath: action.entryPath || current.primaryFile || "",
        content: nextContent,
        note: action.note || "Updated by Hydria Core API",
        actor: "hydria_core_api"
      });

      results.push({
        type: action.type,
        status: "completed",
        workObject: updated
      });
      continue;
    }

    if (action.type === "set_work_object_metadata") {
      const current = workObjectService.get(action.workObjectId);
      assertWorkObjectAccess(current, userId);
      const updated = workObjectService.updateMetadata({
        workObjectId: action.workObjectId,
        title: action.title || current.title,
        status: action.status || current.status,
        actor: "hydria_core_api"
      });

      results.push({
        type: action.type,
        status: "completed",
        workObject: updated
      });
      continue;
    }

    if (action.type === "create_artifact") {
      const actionAdvice = buildActionAdvice(action);
      const artifactPrompt = [
        action.prompt || prompt,
        action.format ? `Rends le fichier en ${action.format}.` : ""
      ]
        .filter(Boolean)
        .join("\n");
      const plan = buildExecutionPlan("artifact_generation", artifactPrompt);
      const forcedSections = action.sections.map((heading) => ({
        heading,
        goal: `Cover ${heading} with concrete details from the API control request.`
      }));
      const generationResult = await generateDocumentArtifact({
        userId,
        conversationId,
        prompt: artifactPrompt,
        plan,
        project: null,
        attachments: [],
        forcedSpec: {
          title: action.title,
          format: action.format,
          documentType: action.documentType,
          sections: forcedSections
        },
        externalAdviceOverride: actionAdvice
          ? {
              used: true,
              providerId: "hydria_core_vps",
              sourceName: "Hydria Core VPS",
              capability: "control_action",
              summaryText: actionAdvice
            }
          : null,
        skipExternalAdvice: !actionAdvice
      });
      const generatedFile = (generationResult.artifacts || []).find(
        (artifact) => artifact.type === "generated_file"
      );
      const workObject = generatedFile
        ? await workObjectService.registerGeneratedArtifact({
            userId,
            conversationId,
            prompt: artifactPrompt,
            artifact: generatedFile,
            sourceDocument: generationResult.sourceDocument,
            projectId
          })
        : null;

      results.push({
        type: action.type,
        status: "completed",
        finalAnswer: generationResult.finalAnswer,
        artifacts: generationResult.artifacts || [],
        workObject
      });
    }
  }

  return {
    executed: results.length,
    results
  };
}

export async function runExternalHydriaControl({
  prompt,
  userId,
  conversationId,
  activeWorkObject = null,
  activeWorkObjectContent = "",
  projectId = "",
  execute = true,
  confirmed = false,
  workObjectService
} = {}) {
  const control = await requestExternalHydriaControl({
    prompt,
    userId,
    conversationId,
    projectId,
    activeWorkObject,
    activeWorkObjectContent,
    workObjectService
  });

  const actionExecution = execute && (control.actions || []).length
    ? await executeExternalHydriaActions({
        actions: control.actions || [],
        userId,
        conversationId,
        prompt,
        projectId,
        workObjectService
      })
      : {
          executed: 0,
          results: []
        };
  const workspaceExecution = execute && (control.workspaceToolCalls || []).length
    ? await executeWorkspaceToolCalls({
        calls: control.workspaceToolCalls || [],
        userId,
        prompt,
        confirmed,
        activeWorkObject,
        workObjectService
      })
    : {
        executed: 0,
        results: []
      };
  const execution = {
    executed: actionExecution.executed + workspaceExecution.executed,
    results: [...actionExecution.results, ...workspaceExecution.results],
    workspaceToolResults: workspaceExecution.results
  };

  return {
    control,
    proposedActions: control.proposedActions || [],
    workspaceToolCalls: control.workspaceToolCalls || [],
    workspaceToolResults: workspaceExecution.results,
    execution
  };
}

export function listExternalHydriaControlActions() {
  return [...CONTROL_ACTIONS];
}

export default {
  buildExternalHydriaWorkspaceContext,
  executeExternalHydriaActions,
  executeWorkspaceToolCalls,
  listExternalHydriaControlActions,
  listHydriaWorkspaceTools,
  listWorkspaceToolsForWorkObject,
  requestPublicHydriaControl,
  requestExternalHydriaControl,
  runExternalHydriaControl
};
