import type { CustomEntityType, WorkspaceEntityType } from "@prisma/client";
import { HttpError } from "./http.js";
import { prisma } from "./prisma.js";

async function assertScopedRecord(
  label: string,
  id: string | null | undefined,
  lookup: () => Promise<{ id: string } | null>
) {
  if (!id) {
    return;
  }
  if (!(await lookup())) {
    throw new HttpError(`${label} not found`, 404);
  }
}

export function assertUserInOrganization(organizationId: string, userId?: string | null) {
  return assertScopedRecord("User", userId, () =>
    prisma.user.findFirst({
      where: { id: userId!, organizationId },
      select: { id: true }
    })
  );
}

export function assertCompanyInOrganization(organizationId: string, companyId?: string | null) {
  return assertScopedRecord("Company", companyId, () =>
    prisma.company.findFirst({
      where: { id: companyId!, organizationId },
      select: { id: true }
    })
  );
}

export function assertContactInOrganization(organizationId: string, contactId?: string | null) {
  return assertScopedRecord("Contact", contactId, () =>
    prisma.contact.findFirst({
      where: { id: contactId!, organizationId },
      select: { id: true }
    })
  );
}

export function assertDealInOrganization(organizationId: string, dealId?: string | null) {
  return assertScopedRecord("Deal", dealId, () =>
    prisma.deal.findFirst({
      where: { id: dealId!, organizationId },
      select: { id: true }
    })
  );
}

export function assertLeadInOrganization(organizationId: string, leadId?: string | null) {
  return assertScopedRecord("Lead", leadId, () =>
    prisma.lead.findFirst({
      where: { id: leadId!, organizationId },
      select: { id: true }
    })
  );
}

export function assertStageInOrganization(organizationId: string, stageId?: string | null) {
  return assertScopedRecord("Pipeline stage", stageId, () =>
    prisma.pipelineStage.findFirst({
      where: { id: stageId!, organizationId },
      select: { id: true }
    })
  );
}

export async function assertCrmRelations(
  organizationId: string,
  relations: {
    ownerId?: string | null;
    assignedToId?: string | null;
    companyId?: string | null;
    contactId?: string | null;
    dealId?: string | null;
    leadId?: string | null;
    stageId?: string | null;
  }
) {
  await Promise.all([
    assertUserInOrganization(organizationId, relations.ownerId),
    assertUserInOrganization(organizationId, relations.assignedToId),
    assertCompanyInOrganization(organizationId, relations.companyId),
    assertContactInOrganization(organizationId, relations.contactId),
    assertDealInOrganization(organizationId, relations.dealId),
    assertLeadInOrganization(organizationId, relations.leadId),
    assertStageInOrganization(organizationId, relations.stageId)
  ]);
}

export async function assertCustomFieldEntityInOrganization(
  organizationId: string,
  entityType: CustomEntityType,
  entityId: string
) {
  if (entityType === "CONTACT") {
    await assertContactInOrganization(organizationId, entityId);
    return;
  }
  if (entityType === "COMPANY") {
    await assertCompanyInOrganization(organizationId, entityId);
    return;
  }
  if (entityType === "DEAL") {
    await assertDealInOrganization(organizationId, entityId);
    return;
  }
  await assertLeadInOrganization(organizationId, entityId);
}

export async function assertWorkspaceEntityInOrganization(
  organizationId: string,
  entityType: WorkspaceEntityType,
  entityId: string
) {
  if (entityType === "EMAIL") {
    await assertScopedRecord("Email message", entityId, () =>
      prisma.emailMessage.findFirst({
        where: { id: entityId, organizationId },
        select: { id: true }
      })
    );
    return;
  }
  if (entityType === "CONTACT") {
    await assertContactInOrganization(organizationId, entityId);
    return;
  }
  if (entityType === "COMPANY") {
    await assertCompanyInOrganization(organizationId, entityId);
    return;
  }
  if (entityType === "DEAL") {
    await assertDealInOrganization(organizationId, entityId);
    return;
  }
  await assertLeadInOrganization(organizationId, entityId);
}
