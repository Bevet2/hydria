import type { AuthTokenType, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hashToken, randomToken } from "../lib/security.js";

export async function issueAuthToken(input: {
  organizationId: string;
  userId?: string;
  createdById?: string;
  email: string;
  role?: UserRole;
  type: AuthTokenType;
  ttlMs: number;
  metadata?: Prisma.InputJsonValue;
}) {
  const token = randomToken(32);
  await prisma.authToken.deleteMany({
    where: {
      organizationId: input.organizationId,
      email: input.email.toLowerCase(),
      type: input.type,
      usedAt: null
    }
  });
  const record = await prisma.authToken.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      createdById: input.createdById,
      email: input.email.toLowerCase(),
      role: input.role,
      type: input.type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + input.ttlMs),
      metadata: input.metadata
    }
  });
  return { token, record };
}

export function findUsableAuthToken(token: string, type: AuthTokenType) {
  return prisma.authToken.findFirst({
    where: {
      tokenHash: hashToken(token),
      type,
      usedAt: null,
      expiresAt: { gt: new Date() }
    }
  });
}
