import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { z } from "zod";
import { env } from "../config/env.js";

export type TokenPayload = {
  sub: string;
  organizationId: string;
  role: UserRole;
  email: string;
  sessionId: string;
};

const issuer = "hydria-crm";
const accessAudience = "hydria-crm-api";
const mfaAudience = "hydria-crm-mfa";
const accessClaims = z.object({
  purpose: z.literal("access"),
  sub: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER", "VIEWER"]),
  email: z.string().email(),
  sessionId: z.string().uuid()
});

export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(accessClaims.parse({ ...payload, purpose: "access" }), env.JWT_SECRET, {
    algorithm: "HS256", issuer, audience: accessAudience,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string) {
  return accessClaims.parse(jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"], issuer, audience: accessAudience
  }));
}

export function signMfaChallengeToken(userId: string) {
  return jwt.sign({ sub: userId, purpose: "mfa" }, env.JWT_SECRET, {
    algorithm: "HS256", issuer, audience: mfaAudience, expiresIn: "5m"
  });
}

export function verifyMfaChallengeToken(token: string) {
  return z.object({ sub: z.string().uuid(), purpose: z.literal("mfa") }).parse(
    jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"], issuer, audience: mfaAudience })
  );
}
