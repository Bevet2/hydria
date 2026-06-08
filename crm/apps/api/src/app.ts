import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { HttpError } from "./lib/http.js";
import authRouter from "./routes/auth.js";
import companiesRouter from "./routes/companies.js";
import contactsRouter from "./routes/contacts.js";
import customFieldsRouter from "./routes/customFields.js";
import dashboardRouter from "./routes/dashboard.js";
import pipelineRouter from "./routes/pipeline.js";
import leadsRouter from "./routes/leads.js";
import productsRouter from "./routes/products.js";
import reportsRouter from "./routes/reports.js";
import searchRouter from "./routes/search.js";
import tasksRouter from "./routes/tasks.js";
import timelineRouter from "./routes/timeline.js";
import usersRouter from "./routes/users.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN.split(",").map((origin) => origin.trim()) }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "northstar-crm-api" });
});
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/pipeline", pipelineRouter);
app.use("/api/leads", leadsRouter);
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
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const details = error instanceof HttpError ? error.details : undefined;
    if (statusCode >= 500) console.error(error);
    res.status(statusCode).json({
      error: statusCode >= 500 && env.NODE_ENV === "production" ? "Internal server error" : error.message,
      ...(details ? { details } : {})
    });
  }
);
