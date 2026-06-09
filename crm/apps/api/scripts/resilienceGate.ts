import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.CRM_API_URL || "http://localhost:4010/api";
const suffix = Date.now();
const organizationIds: string[] = [];

async function rawRequest(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function request<T>(path: string, token: string, init: RequestInit = {}) {
  const response = await rawRequest(path, token, init);
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function register(label: string) {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      organizationName: `Isolation ${label} ${suffix}`,
      firstName: label,
      lastName: "Admin",
      email: `isolation-${label.toLowerCase()}-${suffix}@example.com`,
      password: "IsolationGate123!"
    })
  });
  if (!response.ok) throw new Error(`Registration ${label} failed (${response.status}): ${await response.text()}`);
  const result = await response.json() as { token: string; user: { organizationId: string } };
  organizationIds.push(result.user.organizationId);
  return result;
}

async function main() {
  const [organizationA, organizationB] = await Promise.all([register("A"), register("B")]);
  const company = await request<{ company: { id: string } }>("/companies", organizationA.token, {
    method: "POST",
    body: JSON.stringify({ name: `Private Company ${suffix}`, domain: `private-${suffix}.example.com` })
  });

  const crossRead = await rawRequest(`/companies/${company.company.id}`, organizationB.token);
  if (crossRead.status !== 404) {
    throw new Error(`Cross-organization read returned ${crossRead.status} instead of 404`);
  }

  const crossRelation = await rawRequest("/contacts", organizationB.token, {
    method: "POST",
    body: JSON.stringify({
      firstName: "Cross",
      lastName: "Tenant",
      email: `cross-${suffix}@example.com`,
      companyId: company.company.id
    })
  });
  if (![400, 404].includes(crossRelation.status)) {
    throw new Error(`Cross-organization relation returned ${crossRelation.status} instead of 400/404`);
  }

  const samples = await Promise.all(Array.from({ length: 100 }, async (_, index) => {
    const startedAt = performance.now();
    const response = await rawRequest("/contacts?limit=25", index % 2 ? organizationA.token : organizationB.token);
    return { status: response.status, durationMs: performance.now() - startedAt };
  }));
  const failures = samples.filter((sample) => sample.status !== 200);
  if (failures.length) throw new Error(`${failures.length} concurrent CRM requests failed`);
  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  const p95Ms = durations[Math.ceil(durations.length * 0.95) - 1] || 0;
  if (p95Ms > 3_000) throw new Error(`Concurrent read p95 is too high (${p95Ms.toFixed(1)} ms)`);

  console.log(JSON.stringify({
    ok: true,
    tenantReadIsolation: true,
    tenantRelationIsolation: true,
    concurrentRequests: samples.length,
    p95Ms: Number(p95Ms.toFixed(1))
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  for (const organizationId of organizationIds) {
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});
