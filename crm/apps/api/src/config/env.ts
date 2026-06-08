import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("8h"),
  API_PORT: z.coerce.number().int().positive().default(4010),
  WEB_ORIGIN: z.string().default("http://localhost:5174")
});

export const env = schema.parse(process.env);
