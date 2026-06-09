import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function recordActivity(input: {
  organizationId: string;
  actorId?: string;
  type: ActivityType;
  subject: string;
  body?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  leadId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.activity.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      type: input.type,
      subject: input.subject,
      body: input.body,
      contactId: input.contactId,
      companyId: input.companyId,
      dealId: input.dealId,
      leadId: input.leadId,
      metadata: input.metadata
    }
  });
}
