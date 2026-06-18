import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().optional()
);
const optionalUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().url().optional()
);
const publicWebUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().url().default("http://localhost:3001/crm")
);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("8h"),
  SESSION_EXPIRES_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  API_PORT: z.coerce.number().int().positive().default(4010),
  WEB_ORIGIN: z.string().default("http://localhost:3001"),
  PUBLIC_WEB_URL: publicWebUrl,
  SECRET_ENCRYPTION_KEY: optionalString.pipe(z.string().min(16).optional()),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  MICROSOFT_CLIENT_ID: optionalString,
  MICROSOFT_CLIENT_SECRET: optionalString,
  OAUTH_REDIRECT_URL: optionalUrl,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  TRANSACTIONAL_EMAIL_URL: optionalUrl,
  TRANSACTIONAL_EMAIL_TOKEN: optionalString,
  ALERT_WEBHOOK_URL: optionalUrl,
  MAIL_FROM: z.string().email().default("no-reply@northstar.local"),
  JOB_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).max(300_000).default(5000),
  INTEGRATION_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(1440).default(15),
  BACKUP_DIR: z.string().default("./storage/backups"),
  ATTACHMENT_DIR: z.string().default("./storage/attachments"),
  HYDRIA_INTEGRATION_SECRET: z
    .string()
    .min(16)
    .default("hydria-crm-local-integration-secret-change-me")
});

export const env = schema.parse(process.env);
