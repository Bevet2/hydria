import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";

export type TokenPayload = {
  sub: string;
  organizationId: string;
  role: UserRole;
  email: string;
  sessionId?: string;
};

export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

export function signMfaChallengeToken(userId: string) {
  return jwt.sign({ sub: userId, purpose: "mfa" }, env.JWT_SECRET, { expiresIn: "5m" });
}

export function verifyMfaChallengeToken(token: string) {
  const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; purpose: string };
  if (payload.purpose !== "mfa") throw new Error("Invalid MFA challenge");
  return payload;
}
