import { Router } from "express";
import config from "../config/hydria.config.js";
import agenticConfig from "../src/config/agenticConfig.js";
import HydriaBrainProvider from "../src/core/HydriaBrainProvider.js";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import { AppError } from "../utils/errors.js";
import {
  askExternalHydria,
  getExternalHydriaCapabilities,
  getExternalHydriaStatus
} from "../services/hydria/externalHydriaApiClient.js";
import {
  executeExternalHydriaActions,
  listExternalHydriaControlActions,
  runExternalHydriaControl
} from "../services/hydria/externalHydriaControlBridge.js";

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

  const activeWorkObject = workObjectService.get(workObjectId);
  if (!activeWorkObject) {
    throw new AppError("Work object not found.", 404);
  }

  return {
    activeWorkObject,
    activeWorkObjectContent: workObjectService.getPrimaryContent(activeWorkObject, entryPath)
  };
}

router.get("/status", (req, res) => {
  res.json({
    success: true,
    hydria: {
      ...getExternalHydriaStatus(),
      controlEnabled: config.externalHydria.controlEnabled,
      controlDirectEndpointReady: Boolean(config.externalHydria.controlToken)
    }
  });
});

router.get("/control/schema", (req, res) => {
  res.json({
    success: true,
    schema: {
      actions: listExternalHydriaControlActions(),
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

router.post("/ask", async (req, res, next) => {
  try {
    const result = await askExternalHydria({
      input: req.body?.input || req.body?.prompt || "",
      options: req.body?.options || {}
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

    const { activeWorkObject, activeWorkObjectContent } = getActiveWorkObject({
      workObjectId: req.body?.workObjectId || "",
      entryPath: req.body?.entryPath || ""
    });
    const result = await runExternalHydriaControl({
      prompt,
      userId,
      conversationId,
      projectId: req.body?.projectId || "",
      activeWorkObject,
      activeWorkObjectContent,
      execute: req.body?.execute !== false,
      workObjectService
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

    const execution = await executeExternalHydriaActions({
      actions: req.body?.actions || req.body?.proposedActions || [],
      userId,
      conversationId,
      prompt: req.body?.prompt || "",
      projectId: req.body?.projectId || "",
      workObjectService
    });

    res.json({
      success: true,
      execution
    });
  } catch (error) {
    next(error);
  }
});

export default router;
