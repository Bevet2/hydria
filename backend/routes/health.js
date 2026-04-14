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
      localLlm: config.localLlm.enabled ? "configured" : "not_configured",
      openrouter: config.openrouter.enabled ? "configured" : "not_configured"
    }
  });
});

export default router;
