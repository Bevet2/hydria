import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { HttpError } from "./lib/http.js";
import { prisma } from "./lib/prisma.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { requestContext } from "./middleware/requestContext.js";
import { auditMutations } from "./services/audit.js";
import { sendOperationalAlert } from "./services/alerts.js";
import attachmentsRouter from "./routes/attachments.js";
import auditLogsRouter from "./routes/auditLogs.js";
import backupsRouter from "./routes/backups.js";
import authRouter from "./routes/auth.js";
import companiesRouter from "./routes/companies.js";
import contactsRouter from "./routes/contacts.js";
import customFieldsRouter from "./routes/customFields.js";
import dashboardRouter from "./routes/dashboard.js";
import pipelineRouter from "./routes/pipeline.js";
import leadsRouter from "./routes/leads.js";
import notificationsRouter from "./routes/notifications.js";
import productsRouter from "./routes/products.js";
import reportsRouter from "./routes/reports.js";
import searchRouter from "./routes/search.js";
import tasksRouter from "./routes/tasks.js";
import timelineRouter from "./routes/timeline.js";
import usersRouter from "./routes/users.js";
import hydriaIntegrationRouter from "./routes/hydriaIntegration.js";
import savedViewsRouter from "./routes/savedViews.js";
import automationsRouter from "./routes/automations.js";
import apiKeysRouter from "./routes/apiKeys.js";
import webhooksRouter from "./routes/webhooks.js";
import dataOperationsRouter from "./routes/dataOperations.js";
import integrationsRouter from "./routes/integrations.js";
import communicationsRouter from "./routes/communications.js";
import commercialRouter from "./routes/commercial.js";
import complianceRouter from "./routes/compliance.js";
import monitoringRouter from "./routes/monitoring.js";

export const app = express();

app.use(helmet());
app.use(requestContext);
const webOrigins = new Set(env.WEB_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean));
if (env.NODE_ENV !== "production") {
  for (const origin of [...webOrigins]) {
    try {
      const url = new URL(origin);
      if (url.hostname === "localhost") {
        url.hostname = "127.0.0.1";
        webOrigins.add(url.origin);
      } else if (url.hostname === "127.0.0.1") {
        url.hostname = "localhost";
        webOrigins.add(url.origin);
      }
    } catch {
      // Invalid origins are rejected by the CORS middleware.
    }
  }
}
app.use(cors({ origin: [...webOrigins] }));
app.use(express.json({
  limit: "2mb",
  verify: (req, _res, buffer) => {
    (req as express.Request).rawBody = Buffer.from(buffer);
  }
}));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(rateLimit({
  namespace: "api",
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === "production" ? 600 : 50_000
}));
app.use(auditMutations);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "northstar-crm-api" });
});
app.use("/api/auth", rateLimit({
  namespace: "auth",
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === "production" ? 100 : 1000
}), authRouter);
app.use("/api/integrations/hydria", hydriaIntegrationRouter);
app.use("/api/attachments", attachmentsRouter);
app.use("/api/audit-logs", auditLogsRouter);
app.use("/api/backups", backupsRouter);
app.use("/api/saved-views", savedViewsRouter);
app.use("/api/automations", automationsRouter);
app.use("/api/api-keys", apiKeysRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/data", dataOperationsRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/communications", communicationsRouter);
app.use("/api/commercial", commercialRouter);
app.use("/api/compliance", complianceRouter);
app.use("/api/monitoring", monitoringRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/pipeline", pipelineRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/products", productsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/search", searchRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/timeline", timelineRouter);
app.use("/api/custom-fields", customFieldsRouter);

app.use((_req, _res, next) => next(new HttpError("Route not found", 404)));
app.use(
  (
    error: Error | HttpError | ZodError,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const statusCode = error instanceof HttpError ? error.statusCode : error instanceof ZodError ? 400 : 500;
    const details = error instanceof HttpError
      ? error.details
      : error instanceof ZodError
        ? error.flatten()
        : undefined;
    if (statusCode >= 500) {
      console.error(error);
      void prisma.errorEvent.create({
        data: {
          organizationId: req.user?.organizationId,
          requestId: req.requestId || "unknown",
          method: req.method,
          path: req.originalUrl,
          statusCode,
          message: error.message,
          stack: env.NODE_ENV === "production" ? null : error.stack
        }
      }).catch(() => undefined);
      void sendOperationalAlert({
        title: "CRM API error",
        message: error.message,
        organizationId: req.user?.organizationId,
        metadata: { requestId: req.requestId, method: req.method, path: req.originalUrl, statusCode }
      }).catch(() => undefined);
    }
    res.status(statusCode).json({
      error: statusCode >= 500 && env.NODE_ENV === "production" ? "Internal server error" : error.message,
      ...(details ? { details } : {})
    });
  }
);
