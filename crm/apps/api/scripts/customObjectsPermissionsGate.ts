import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.CRM_API_URL || "http://localhost:4010/api";
const suffix = Date.now();
let organizationId = "";

async function raw(token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function request<T>(token: string, path: string, init: RequestInit = {}) {
  const response = await raw(token, path, init);
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function main() {
  const registration = await request<{
    token: string;
    user: { organizationId: string };
  }>("", "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      organizationName: `Permissions Gate ${suffix}`,
      firstName: "Admin",
      lastName: "Owner",
      email: `permissions-admin-${suffix}@example.com`,
      password: "Permissions123!"
    })
  });
  const adminToken = registration.token;
  organizationId = registration.user.organizationId;

  const memberEmail = `permissions-member-${suffix}@example.com`;
  const member = await request<{ user: { id: string } }>(adminToken, "/users", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Restricted",
      lastName: "Member",
      email: memberEmail,
      password: "Permissions123!",
      role: "MEMBER"
    })
  });
  const team = await request<{ team: { id: string } }>(adminToken, "/users/teams", {
    method: "POST",
    body: JSON.stringify({
      name: "Restricted sales",
      permissionPolicy: {
        objects: {
          tickets: { read: true, write: false },
          contacts: { read: true, write: true },
          customObjects: { read: true, write: true }
        },
        properties: {
          contacts: ["status"]
        }
      }
    })
  });
  await request(adminToken, `/users/${member.user.id}/permissions`, {
    method: "PATCH",
    body: JSON.stringify({ teamId: team.team.id, permissionPolicy: {} })
  });

  const definition = await request<{ definition: { id: string } }>(adminToken, "/custom-objects", {
    method: "POST",
    body: JSON.stringify({
      key: `installation_${suffix}`,
      name: "Installation",
      pluralName: "Installations",
      fields: [
        { key: "serial", label: "Serial number", type: "text", required: true }
      ]
    })
  });

  const login = await request<{ token: string }>("", "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: memberEmail, password: "Permissions123!" })
  });
  const record = await request<{ record: { id: string } }>(
    login.token,
    `/custom-objects/${definition.definition.id}/records`,
    {
      method: "POST",
      body: JSON.stringify({
        displayName: "Primary installation",
        values: { serial: `SER-${suffix}` }
      })
    }
  );
  if (!record.record.id) throw new Error("Custom object record was not created");

  const deniedTicket = await raw(login.token, "/tickets", {
    method: "POST",
    body: JSON.stringify({ subject: "Must be denied" })
  });
  if (deniedTicket.status !== 403) {
    throw new Error(`Object write permission was not enforced (${deniedTicket.status})`);
  }

  const contact = await request<{ contact: { id: string } }>(adminToken, "/contacts", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Permission",
      lastName: "Target",
      email: `permission-target-${suffix}@example.com`,
      status: "prospect"
    })
  });
  const deniedProperty = await raw(login.token, `/contacts/${contact.contact.id}`, {
    method: "PATCH",
    body: JSON.stringify({ email: `forbidden-${suffix}@example.com` })
  });
  if (deniedProperty.status !== 403) {
    throw new Error(`Property permission was not enforced (${deniedProperty.status})`);
  }
  await request(login.token, `/contacts/${contact.contact.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "customer" })
  });

  console.log(JSON.stringify({
    success: true,
    customObjects: true,
    teamPermissions: true,
    propertyPermissions: true
  }));
}

main()
  .finally(async () => {
    if (organizationId) {
      await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
