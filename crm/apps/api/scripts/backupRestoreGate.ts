import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.CRM_API_URL || "http://localhost:4010/api";
const suffix = Date.now();
const organizations: string[] = [];

async function request<T>(token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function register(label: string) {
  const emailLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const result = await request<{
    token: string;
    user: { organizationId: string; organization: { slug: string } };
  }>("", "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      organizationName: `${label} ${suffix}`,
      firstName: "Backup",
      lastName: "Admin",
      email: `${emailLabel}-${suffix}@example.com`,
      password: "BackupGate123!"
    })
  });
  organizations.push(result.user.organizationId);
  return result;
}

async function main() {
  const source = await register("Source");
  const created = await request<{ ticket: { id: string; subject: string } }>(
    source.token,
    "/tickets",
    {
      method: "POST",
      body: JSON.stringify({
        subject: `Restore validation ${suffix}`,
        description: "This ticket must survive a cross-environment restore.",
        priority: "HIGH"
      })
    }
  );
  await request(source.token, `/tickets/${created.ticket.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: "Backup verification message", public: true })
  });

  const exportResponse = await fetch(`${baseUrl}/backups/export`, {
    headers: { authorization: `Bearer ${source.token}` }
  });
  if (!exportResponse.ok) throw new Error(`Backup export failed (${exportResponse.status})`);
  const snapshot = await exportResponse.json() as {
    schemaVersion: number;
    organization: { slug: string };
    data: Record<string, unknown[]>;
  };
  if (snapshot.schemaVersion !== 4 || !snapshot.data.tickets?.length) {
    throw new Error("Backup v4 does not contain support ticket data");
  }

  await prisma.organization.delete({ where: { id: source.user.organizationId } });
  organizations.splice(organizations.indexOf(source.user.organizationId), 1);
  const target = await register("Restore target");
  snapshot.organization.slug = target.user.organization.slug;
  const form = new FormData();
  form.append("confirmation", "RESTORE");
  form.append(
    "file",
    new Blob([JSON.stringify(snapshot)], { type: "application/json" }),
    "cross-environment-backup.json"
  );
  await request(target.token, "/backups/restore", { method: "POST", body: form });
  const restored = await request<{
    tickets: Array<{ subject: string; _count?: { messages: number } }>;
  }>(
    target.token,
    `/tickets?search=${encodeURIComponent(created.ticket.subject)}`
  );
  if (!restored.tickets.some((ticket) => ticket.subject === created.ticket.subject)) {
    throw new Error("Separate-environment restore did not recreate the support ticket");
  }

  console.log(JSON.stringify({
    success: true,
    schemaVersion: snapshot.schemaVersion,
    separateOrganization: true,
    ticketsRestored: restored.tickets.length
  }));
}

main()
  .finally(async () => {
    for (const organizationId of organizations.reverse()) {
      await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
