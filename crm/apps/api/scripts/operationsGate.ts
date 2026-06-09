import { PrismaClient } from "@prisma/client";

const baseUrl = process.env.CRM_API_URL || "http://localhost:4010/api";
const email = process.env.CRM_GATE_EMAIL || "admin@northstar.local";
const password = process.env.CRM_GATE_PASSWORD || "Northstar123!";
const suffix = Date.now();
let token = "";
let cleanupToken = "";
let primaryId = "";
let duplicateId = "";
let viewId = "";
let temporaryOrganizationId = "";
const prisma = new PrismaClient();

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function main() {
  const login = await request<{ token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  token = login.token;
  cleanupToken = token;
  const sharedEmail = `operations-gate-${suffix}@example.com`;

  const primary = await request<{ contact: { id: string } }>("/contacts", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Operations",
      lastName: `Primary ${suffix}`,
      email: sharedEmail,
      status: "lead"
    })
  });
  primaryId = primary.contact.id;
  const duplicate = await request<{ contact: { id: string } }>("/contacts", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Operations",
      lastName: `Duplicate ${suffix}`,
      email: sharedEmail,
      phone: "+33123456789",
      status: "lead"
    })
  });
  duplicateId = duplicate.contact.id;

  await request("/contacts/bulk", {
    method: "POST",
    body: JSON.stringify({
      ids: [primaryId, duplicateId],
      action: "UPDATE_STATUS",
      status: "qualified"
    })
  });

  const view = await request<{ view: { id: string } }>("/saved-views", {
    method: "POST",
    body: JSON.stringify({
      resource: "CONTACTS",
      name: `Operations gate ${suffix}`,
      filters: { status: "qualified", search: sharedEmail },
      isDefault: false
    })
  });
  viewId = view.view.id;

  const attachmentBody = new FormData();
  attachmentBody.append("entityType", "CONTACT");
  attachmentBody.append("entityId", duplicateId);
  attachmentBody.append("file", new Blob([`operations gate ${suffix}`], { type: "text/plain" }), "gate.txt");
  await request("/attachments", { method: "POST", body: attachmentBody });

  const duplicateGroups = await request<{ groups: Array<{ contacts: Array<{ id: string }> }> }>("/contacts/duplicates");
  const detected = duplicateGroups.groups.some((group) => {
    const ids = new Set(group.contacts.map((contact) => contact.id));
    return ids.has(primaryId) && ids.has(duplicateId);
  });
  if (!detected) throw new Error("Duplicate detection did not return the test contacts");

  await request("/contacts/merge", {
    method: "POST",
    body: JSON.stringify({ primaryId, duplicateIds: [duplicateId] })
  });
  duplicateId = "";

  const merged = await request<{ contact: { phone?: string | null; status: string } }>(`/contacts/${primaryId}`);
  if (merged.contact.phone !== "+33123456789" || merged.contact.status !== "qualified") {
    throw new Error("Merged contact did not preserve the expected values");
  }
  const attachments = await request<{ attachments: Array<{ originalName: string }> }>(
    `/attachments?entityType=CONTACT&entityId=${primaryId}`
  );
  if (!attachments.attachments.some((item) => item.originalName === "gate.txt")) {
    throw new Error("Attachment was not moved to the primary contact");
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
  const audit = await request<{ logs: Array<{ path: string }> }>("/audit-logs?limit=100");
  if (!audit.logs.some((log) => log.path === "/api/contacts/merge")) {
    throw new Error("Contact merge was not written to the audit log");
  }

  const backupResponse = await fetch(`${baseUrl}/backups/export`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!backupResponse.ok) throw new Error(`Backup export failed (${backupResponse.status})`);
  const backup = await backupResponse.json() as {
    schemaVersion: number;
    data: { contacts: Array<{ id: string }> };
    attachments: Array<{ originalName: string }>;
  };
  if (
    ![1, 2].includes(backup.schemaVersion) ||
    !backup.data.contacts.some((contact) => contact.id === primaryId) ||
    !backup.attachments.some((item) => item.originalName === "gate.txt")
  ) {
    throw new Error("Backup export is incomplete");
  }

  const adminToken = token;
  const registration = await request<{
    token: string;
    user: { organizationId: string };
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      organizationName: `Restore Gate ${suffix}`,
      firstName: "Restore",
      lastName: "Gate",
      email: `restore-gate-${suffix}@example.com`,
      password: "RestoreGate123!"
    })
  });
  token = registration.token;
  temporaryOrganizationId = registration.user.organizationId;
  const restoreContact = await request<{ contact: { id: string } }>("/contacts", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Backup",
      lastName: `Restore ${suffix}`,
      email: `restore-${suffix}@example.com`,
      status: "customer"
    })
  });
  const restoreAutomation = await request<{ rule: { id: string; name: string } }>("/automations", {
    method: "POST",
    body: JSON.stringify({
      name: `Restore automation ${suffix}`,
      trigger: "LEAD_CREATED",
      action: "CREATE_TASK",
      conditions: {},
      configuration: { title: "Review new lead" },
      active: true,
      priority: 100
    })
  });
  const restoreBackupResponse = await fetch(`${baseUrl}/backups/export`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!restoreBackupResponse.ok) throw new Error(`Restore backup export failed (${restoreBackupResponse.status})`);
  const restoreBackupText = await restoreBackupResponse.text();
  await request(`/contacts/${restoreContact.contact.id}`, { method: "DELETE" });
  await request(`/automations/${restoreAutomation.rule.id}`, { method: "DELETE" });
  const restoreBody = new FormData();
  restoreBody.append("confirmation", "RESTORE");
  restoreBody.append("file", new Blob([restoreBackupText], { type: "application/json" }), "restore.json");
  await request("/backups/restore", { method: "POST", body: restoreBody });
  const restoredContact = await request<{ contact: { id: string; status: string } }>(
    `/contacts/${restoreContact.contact.id}`
  );
  if (restoredContact.contact.status !== "customer") {
    throw new Error("Backup restore did not recreate the deleted contact");
  }
  const restoredAutomations = await request<{ rules: Array<{ id: string; name: string }> }>("/automations");
  if (!restoredAutomations.rules.some((rule) => rule.id === restoreAutomation.rule.id)) {
    throw new Error("Backup restore did not recreate the v2 automation data");
  }
  token = adminToken;

  console.log(JSON.stringify({
    ok: true,
    duplicateDetection: true,
    merge: true,
    bulkUpdate: true,
    savedView: true,
    attachment: true,
    audit: true,
    backup: true,
    restore: true
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (cleanupToken) {
      token = cleanupToken;
      if (duplicateId) await request(`/contacts/${duplicateId}`, { method: "DELETE" }).catch(() => undefined);
      if (primaryId) await request(`/contacts/${primaryId}`, { method: "DELETE" }).catch(() => undefined);
      if (viewId) await request(`/saved-views/${viewId}`, { method: "DELETE" }).catch(() => undefined);
    }
    if (temporaryOrganizationId) {
      await prisma.organization.delete({ where: { id: temporaryOrganizationId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });
