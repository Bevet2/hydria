import { Prisma, type BackgroundJobType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function enqueueBackgroundJob(input: {
  organizationId: string;
  type: BackgroundJobType;
  payload: Record<string, unknown>;
  runAt?: Date;
  maxAttempts?: number;
}) {
  return prisma.backgroundJob.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      payload: input.payload as Prisma.InputJsonValue,
      runAt: input.runAt,
      maxAttempts: input.maxAttempts
    }
  });
}
