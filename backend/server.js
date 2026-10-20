import path from "node:path";
import express from "express";
import cors from "cors";
import { productionSettings, createProductionAccessGate } from "./middleware/osProductionAccess.js";
import { proxyCrmApi } from "./middleware/crmApiProxy.js";
import config from "./config/hydria.config.js";
import { initDatabase, db, closeDatabase } from "./db/sqlite.js";
import { executeDueFlowSchedules } from "./services/flow/flowScheduler.js";
import { AppError, normalizeError } from "./utils/errors.js";
import logger from "./utils/logger.js";
import healthRouter from "./routes/health.js";
import configRouter from "./routes/config.js";
import usersRouter from "./routes/users.js";
import conversationsRouter from "./routes/conversations.js";
import preferencesRouter from "./routes/preferences.js";
import memoryRouter from "./routes/memory.js";
import chatRouter from "./routes/chat.js";
import artifactsRouter from "./routes/artifacts.js";
import workObjectsRouter from "./routes/workObjects.js";
import projectsRouter from "./routes/projects.js";
import sheetsRouter from "./routes/sheets.js";
import docsRouter from "./routes/docs.js";
import canvasRouter from "./routes/canvas.js";
import flowsRouter from "./routes/flows.js";
import flowPublicationsRouter from "./routes/flowPublications.js";
import flowSourcesRouter from "./routes/flowSources.js";
import hydriaApiRouter from "./routes/hydriaApi.js";

// Fail closed before touching persistent data if production credentials or HTTPS origin are absent.
const osProduction = productionSettings();
initDatabase();

const app = express();

// The liveness endpoint is intentionally nonsensitive; readiness/API and all
// frontend pages require authentication in production.
app.use(createProductionAccessGate(osProduction));
app.get("/livez", (_req, res) => res.status(200).type("text/plain").send("ok"));
if (!osProduction.production) app.use(cors());
app.use("/crm-api", proxyCrmApi);
app.use(express.json({ limit: "10mb" }));

app.use("/api/health", healthRouter);
app.use("/api/config", configRouter);
app.use("/api/users", usersRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/chat", chatRouter);
app.use("/api/hydria", hydriaApiRouter);
app.use("/api/artifacts", artifactsRouter);
app.use("/api/work-objects", workObjectsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/sheets", sheetsRouter);
app.use("/api/docs", docsRouter);
app.use("/api/canvas", canvasRouter);
app.use("/api/flows", flowsRouter);
app.use("/api/flow-publications", flowPublicationsRouter);
app.use("/api/flow-sources", flowSourcesRouter);

app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(config.paths.frontendDir, "favicon.svg"));
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.status(204).end();
});

app.use(
  express.static(config.paths.frontendDir, {
    setHeaders: (res, filePath) => {
      if (/\.wasm$/i.test(filePath)) res.setHeader("Content-Type", "application/wasm");
      if (/\.(?:html|js|css|json|svg)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store");
      }
    }
  })
);

app.use(
  "/crm",
  express.static(config.paths.crmWebDistDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (/\.(?:html|js|css|json|svg)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store");
      }
    }
  })
);

function sendFrontendApp(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(config.paths.frontendDir, "index.html"));
}

app.get("/", sendFrontendApp);
app.get(/^\/workspace(?:\/[^/]+)?\/?$/, sendFrontendApp);
app.get(/^\/crm(?:\/.*)?$/, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(config.paths.crmWebDistDir, "index.html"));
});
app.get(/^\/share\/(?:chat|work)\/[^/]+\/?$/, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(config.paths.frontendDir, "share.html"));
});

app.use((req, res, next) => {
  next(new AppError("Route not found", 404));
});

app.use((error, req, res, next) => {
  const normalized = normalizeError(error);
  logger.error("Request failed", {
    path: req.path,
    statusCode: normalized.statusCode,
    error: normalized.message
  });

  res.status(normalized.statusCode || 500).json({
    success: false,
    error: normalized.message,
    details: normalized.details || null
  });
});

const server = app.listen(config.port, () => {
  logger.info(`Hydria listening on http://localhost:${config.port}`);
});
let scheduler;
if (process.env.HYDRIA_FLOW_CONNECTOR_TOKEN && process.env.HYDRIA_FLOW_SCHEDULER_ENABLED !== "false") {
  // One scheduler per backend process; deployments with multiple workers need
  // an external coordinator before enabling this interval in every instance.
  let scheduleTickRunning = false;
  scheduler = setInterval(async () => {
    if (scheduleTickRunning) return;
    scheduleTickRunning = true;
    try {
      for (const run of await executeDueFlowSchedules(db)) {
        logger.info("Scheduled Hydria flow", {
          flowKey: run.flowKey, status: run.status, outputRows: run.outputRows,
          ...(run.error ? { error: run.error } : {})
        });
      }
    } catch (error) {
      logger.error("Scheduled flow tick failed", { error: String(error?.message || error) });
    } finally {
      scheduleTickRunning = false;
    }
  }, 60_000);
  scheduler.unref();
}

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (scheduler) clearInterval(scheduler);
  logger.info("Hydria OS shutdown requested", { signal });
  const watchdog = setTimeout(() => process.exit(1), 10_000);
  watchdog.unref();
  server.close((err) => {
    try { closeDatabase(); }
    catch (closeError) {
      logger.error("SQLite shutdown failed", { error: String(closeError?.message || closeError) });
    }
    clearTimeout(watchdog);
    process.exit(err ? 1 : 0);
  });
}
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
