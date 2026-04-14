import path from "node:path";
import express from "express";
import cors from "cors";
import config from "./config/hydria.config.js";
import { initDatabase } from "./db/sqlite.js";
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

initDatabase();

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/config", configRouter);
app.use("/api/users", usersRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/chat", chatRouter);
app.use("/api/artifacts", artifactsRouter);
app.use("/api/work-objects", workObjectsRouter);
app.use("/api/projects", projectsRouter);

app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(config.paths.frontendDir, "favicon.svg"));
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.status(204).end();
});

app.use(
  express.static(config.paths.frontendDir, {
    setHeaders: (res, filePath) => {
      if (/\.(?:html|js|css|json|svg)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store");
      }
    }
  })
);

app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(config.paths.frontendDir, "index.html"));
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

app.listen(config.port, () => {
  logger.info(`Hydria listening on http://localhost:${config.port}`);
});
