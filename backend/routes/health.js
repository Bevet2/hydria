import { Router } from "express";
import config from "../config/hydria.config.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: "ready",
      llm: config.llm.enabled ? config.llm.routingMode : "disabled",
      hydriaCore: config.hydriaCore.enabled
        ? config.hydriaCore.apiKey
          ? "configured"
          : "missing_api_key"
        : "disabled",
      localLlm: config.localLlm.enabled ? "configured" : "not_configured",
      openrouter: config.openrouter.enabled ? "configured" : "not_configured",
      hydriaExternal: config.externalHydria.enabled ? "configured" : "not_configured"
    }
  });
});

export default router;
