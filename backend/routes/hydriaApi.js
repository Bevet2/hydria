import { Router } from "express";
import config from "../config/hydria.config.js";
import agenticConfig from "../src/config/agenticConfig.js";
import HydriaBrainProvider from "../src/core/HydriaBrainProvider.js";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import { AppError } from "../utils/errors.js";
import { getUserById } from "../services/memory/historyService.js";
import {
  createCrmLiveWorkObject,
  createCrmSession,
  executeCrmWorkspaceToolCalls,
  getCrmStatus,
  getCrmWorkspaceContext
} from "../services/crm/crmIntegrationClient.js";
import {
  askExternalHydria,
  getExternalHydriaCapabilities,
  getExternalHydriaStatus,
  listExternalHydriaInteractions
} from "../services/hydria/externalHydriaApiClient.js";
import {
  buildExternalHydriaWorkspaceContext,
  executeExternalHydriaActions,
  listExternalHydriaControlActions,
  runExternalHydriaControl
} from "../services/hydria/externalHydriaControlBridge.js";
import {
  buildHydriaWorkspaceToolContract,
  executeWorkspaceToolCalls,
  listHydriaWorkspaceTools,
  normalizeWorkspaceToolCallsFromCore
} from "../services/hydria/workspaceToolDispatcher.js";

const router = Router();
const workObjectService = new WorkObjectService({
  filePath: agenticConfig.files.workObjectStore,
  rootDir: agenticConfig.files.workObjectRoot,
  brainProvider: new HydriaBrainProvider()
});

function extractBearerToken(value = "") {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || String(value || "").trim();
}

function assertControlToken(req) {
  if (!config.externalHydria.controlToken) {
    throw new AppError("Hydria control token is not configured.", 403);
  }

  const token =
    extractBearerToken(req.headers.authorization) ||
    String(req.headers["x-hydria-control-token"] || "").trim();

  if (token !== config.externalHydria.controlToken) {
    throw new AppError("A valid Hydria control token is required.", 401);
  }
}

function getActiveWorkObject({ workObjectId = "", entryPath = "" } = {}) {
  if (!workObjectId) {
    return {
      activeWorkObject: null,
      activeWorkObjectContent: ""
    };
  }

  const activeWorkObject = workObjectService.get(workObjectId, {
    includeContent: true,
    entryPath
  });
  if (!activeWorkObject) {
    throw new AppError("Work object not found.", 404);
  }

  return {
    activeWorkObject,
    activeWorkObjectContent:
      activeWorkObject.file?.content || workObjectService.getPrimaryContent(activeWorkObject, entryPath)
  };
}

function isCrmWorkspace(body = {}, activeWorkObject = null) {
  const requestedFamily = String(
    body.workspaceFamilyId ||
      body.workspaceContext?.workspaceFamilyId ||
      body.workspaceContext?.activeWorkObject?.workspaceFamilyId ||
      ""
  ).toLowerCase();
  const activeFamily = String(
    activeWorkObject?.workspaceFamilyId ||
      activeWorkObject?.metadata?.workspaceFamilyId ||
      ""
  ).toLowerCase();
  return requestedFamily === "crm_sales" || activeFamily === "crm_sales";
}

function requireHydriaUser(userId) {
  const user = getUserById(userId);
  if (!user) {
    throw new AppError("Hydria user not found.", 404);
  }
  return user;
}

router.get("/status", (req, res) => {
  res.json({
    success: true,
    hydria: {
      ...getExternalHydriaStatus(),
      controlEnabled: config.externalHydria.controlEnabled,
      controlLocalExchangeEndpointReady: Boolean(
        config.externalHydria.enabled && config.externalHydria.controlEnabled
      ),
      controlDirectEndpointReady: Boolean(config.externalHydria.controlToken)
    }
  });
});

router.get("/crm/status", async (req, res, next) => {
  try {
    res.json({
      success: true,
      crm: await getCrmStatus()
    });
  } catch (error) {
    next(error);
  }
});

router.post("/crm/session", async (req, res, next) => {
  try {
    const user = requireHydriaUser(req.body?.userId);
    const session = await createCrmSession(user);
    res.json({
      success: true,
      ...session
    });
  } catch (error) {
    next(error);
  }
});

router.get("/control/schema", (req, res) => {
  res.json({
    success: true,
    schema: {
      actions: listExternalHydriaControlActions(),
      workspaceTools: listHydriaWorkspaceTools(),
      workspaceToolContract: buildHydriaWorkspaceToolContract({
        workspaceTools: listHydriaWorkspaceTools()
      }),
      directEndpoint: "/api/hydria/actions",
      localExchangeEndpoint: "/api/hydria/control",
      directEndpointRequiresToken: true
    }
  });
});

router.get("/capabilities", async (req, res, next) => {
  try {
    const capabilities = await getExternalHydriaCapabilities();

    res.json({
      success: true,
      capabilities
    });
  } catch (error) {
    next(error);
  }
});

router.get("/interactions", async (req, res, next) => {
  try {
    const result = await listExternalHydriaInteractions({
      sessionId: req.query?.sessionId || "",
      scope: req.query?.scope || "",
      limit: req.query?.limit || 100
    });

    res.json({
      success: true,
      result,
      interactions: Array.isArray(result?.interactions) ? result.interactions : []
    });
  } catch (error) {
    next(error);
  }
});

router.post("/ask", async (req, res, next) => {
  try {
    const body = req.body || {};
    const input = body.input || body.prompt || "";
    let workspaceContext =
      body.workspaceContext && typeof body.workspaceContext === "object"
        ? body.workspaceContext
        : null;

    if (!workspaceContext && body.workObjectId) {
      const { activeWorkObject, activeWorkObjectContent } = getActiveWorkObject({
        workObjectId: body.workObjectId,
        entryPath: body.entryPath || ""
      });
      workspaceContext = buildExternalHydriaWorkspaceContext({
        prompt: input,
        userId: body.userId || "",
        conversationId: body.conversationId || body.sessionId || "",
        projectId: body.projectId || "",
        activeWorkObject,
        activeWorkObjectContent,
        workObjectService
      });
    }

    const metadata = body.metadata && typeof body.metadata === "object"
      ? { ...body.metadata }
      : {};
    if (!metadata.source) {
      metadata.source = "hydria_os";
    }
    if (body.workObjectId && !metadata.activeWorkObjectId) {
      metadata.activeWorkObjectId = String(body.workObjectId);
    }
    if (body.entryPath && !metadata.activeEntryPath) {
      metadata.activeEntryPath = String(body.entryPath);
    }

    const result = await askExternalHydria({
      input,
      options: body.options || {},
      workspaceContext,
      sessionId: body.sessionId || (body.conversationId ? `hydria-os:${body.conversationId}` : ""),
      userId: body.userId || "",
      projectId: body.projectId || "",
      metadata
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    next(error);
  }
});

router.post("/control", async (req, res, next) => {
  try {
    const userId = req.body?.userId;
    const conversationId = req.body?.conversationId;
    const prompt = req.body?.prompt || req.body?.input || "";

    if (!userId || !conversationId) {
      throw new AppError("userId and conversationId are required for Hydria control.", 400);
    }

    if (!prompt) {
      throw new AppError("prompt is required for Hydria control.", 400);
    }

    const current = getActiveWorkObject({
      workObjectId: req.body?.workObjectId || "",
      entryPath: req.body?.entryPath || ""
    });
    let activeWorkObject = current.activeWorkObject;
    let activeWorkObjectContent = current.activeWorkObjectContent;
    let workspaceToolExecutor;

    if (isCrmWorkspace(req.body, activeWorkObject)) {
      const user = requireHydriaUser(userId);
      const crmContext = await getCrmWorkspaceContext(user);
      activeWorkObjectContent = crmContext.contentPreview;
      activeWorkObject = createCrmLiveWorkObject({
        contentPreview: activeWorkObjectContent
      });
      workspaceToolExecutor = (options) =>
        executeCrmWorkspaceToolCalls({
          calls: options.calls,
          user,
          prompt: options.prompt,
          confirmed: options.confirmed
        });
    }

    const result = await runExternalHydriaControl({
      prompt,
      userId,
      conversationId,
      projectId: req.body?.projectId || "",
      activeWorkObject,
      activeWorkObjectContent,
      execute: req.body?.execute !== false,
      confirmed: req.body?.confirmed === true,
      workObjectService,
      workspaceToolExecutor
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

router.post("/actions", async (req, res, next) => {
  try {
    assertControlToken(req);

    const userId = req.body?.userId;
    const conversationId = req.body?.conversationId;
    if (!userId || !conversationId) {
      throw new AppError("userId and conversationId are required for Hydria actions.", 400);
    }

    const actionInput = req.body?.actions || req.body?.proposedActions || [];
    const explicitWorkspaceCalls =
      req.body?.workspaceToolCalls ||
      req.body?.workspace_tool_calls ||
      req.body?.workspace_tool_call;
    const workspaceToolCalls = normalizeWorkspaceToolCallsFromCore(
      explicitWorkspaceCalls !== undefined
        ? { workspaceToolCalls: explicitWorkspaceCalls }
        : { proposedActions: req.body?.proposedActions || actionInput }
    );
    const crmWorkspaceToolCalls = workspaceToolCalls.filter((call) =>
      String(call?.payload?.toolName || "").startsWith("crm.")
    );
    const localWorkspaceToolCalls = workspaceToolCalls.filter((call) =>
      !String(call?.payload?.toolName || "").startsWith("crm.")
    );
    const safeActionInput = workspaceToolCalls.length
      ? (Array.isArray(actionInput) ? actionInput : []).filter((action) =>
          ["reply", "set_work_object_metadata"].includes(String(action?.type || action?.action || ""))
        )
      : actionInput;
    const execution = await executeExternalHydriaActions({
      actions: safeActionInput,
      userId,
      conversationId,
      prompt: req.body?.prompt || "",
      projectId: req.body?.projectId || "",
      workObjectService
    });
    const workspaceExecution = localWorkspaceToolCalls.length
      ? await executeWorkspaceToolCalls({
          calls: localWorkspaceToolCalls,
          userId,
          prompt: req.body?.prompt || "",
          confirmed: req.body?.confirmed === true,
          workObjectService
        })
      : {
          executed: 0,
          results: []
        };
    const crmExecution = crmWorkspaceToolCalls.length
      ? await executeCrmWorkspaceToolCalls({
          calls: crmWorkspaceToolCalls,
          user: requireHydriaUser(userId),
          prompt: req.body?.prompt || "",
          confirmed: req.body?.confirmed === true
        })
      : {
          executed: 0,
          results: []
        };
    const combinedExecution = {
      executed: execution.executed + workspaceExecution.executed + crmExecution.executed,
      results: [...execution.results, ...workspaceExecution.results, ...crmExecution.results],
      workspaceToolResults: [...workspaceExecution.results, ...crmExecution.results]
    };

    res.json({
      success: true,
      execution: combinedExecution,
      workspaceToolCalls
    });
  } catch (error) {
    next(error);
  }
});

export default router;
