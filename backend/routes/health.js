import { Router } from "express";
import config from "../config/hydria.config.js";
import { db } from "../db/sqlite.js";
import { inspectOsReadiness } from "../services/operations/readiness.js";

const router = Router();

router.get("/", (req, res) => {
  const readiness = inspectOsReadiness({database:db,dataDir:config.paths.dataDir,frontendDir:config.paths.frontendDir});
  res.status(readiness.ready ? 200 : 503).json({
    success: true,
    status: readiness.ready ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      database: readiness.checks.database,
      storage: readiness.checks.storage,
      frontend: readiness.checks.frontend,
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


// Authenticated readiness endpoint for container / reverse-proxy health.
// The public /livez intentionally remains just a process liveness check.
router.get("/ready", (_req, res) => {
  const readiness = inspectOsReadiness({
    database: db,
    dataDir: config.paths.dataDir,
    frontendDir: config.paths.frontendDir
  });
  res.setHeader("Cache-Control", "no-store");
  res.status(readiness.ready ? 200 : 503).json({
    success: readiness.ready, status: readiness.ready ? "ready" : "unavailable",
    checks: readiness.checks
  });
});

export default router;
