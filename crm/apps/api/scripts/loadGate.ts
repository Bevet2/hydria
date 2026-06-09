import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.CRM_API_URL || "http://localhost:4010/api";
const organizationCount = Number(process.env.CRM_LOAD_ORGS || 8);
const recordsPerOrganization = Number(process.env.CRM_LOAD_RECORDS || 50);
const requestCount = Number(process.env.CRM_LOAD_REQUESTS || 500);
const concurrency = Number(process.env.CRM_LOAD_CONCURRENCY || 50);
const suffix = Date.now();
const organizations: Array<{ id: string; token: string; marker: string }> = [];

async function request<T>(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${await response.text()}`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function register(index: number) {
  const marker = `load-${suffix}-${index}`;
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      organizationName: `Load Organization ${index} ${suffix}`,
      firstName: "Load",
      lastName: `Admin ${index}`,
      email: `${marker}@example.com`,
      password: "LoadGate123!"
    })
  });
  if (!response.ok) throw new Error(`Registration ${index} failed (${response.status})`);
  const data = await response.json() as { token: string; user: { organizationId: string } };
  return { id: data.user.organizationId, token: data.token, marker };
}

async function seedOrganization(organization: { token: string; marker: string }) {
  for (let offset = 0; offset < recordsPerOrganization; offset += 10) {
    await Promise.all(Array.from({ length: Math.min(10, recordsPerOrganization - offset) }, async (_, inner) => {
      const index = offset + inner;
      await Promise.all([
        request("/companies", organization.token, {
          method: "POST",
          body: JSON.stringify({ name: `${organization.marker} company ${index}`, domain: `${organization.marker}-${index}.example.com` })
        }),
        request("/leads", organization.token, {
          method: "POST",
          body: JSON.stringify({
            firstName: "Load",
            lastName: `Lead ${index}`,
            email: `${organization.marker}-lead-${index}@example.com`,
            source: "load-gate",
            status: "NEW",
            rating: index % 3 === 0 ? "HOT" : "WARM"
          })
        }),
        request("/tasks", organization.token, {
          method: "POST",
          body: JSON.stringify({ title: `${organization.marker} task ${index}`, priority: "MEDIUM", status: "TODO" })
        })
      ]);
    }));
  }
}

async function main() {
  organizations.push(...await Promise.all(Array.from({ length: organizationCount }, (_, index) => register(index))));
  await Promise.all(organizations.map(seedOrganization));

  for (const organization of organizations) {
    const search = await request<{ results: Array<{ label: string }> }>(
      `/search?q=${encodeURIComponent(organization.marker)}`,
      organization.token
    );
    if (!search.results.length) throw new Error(`Organization ${organization.marker} cannot read its seeded data`);
    if (search.results.some((result) => !result.label.toLowerCase().includes(organization.marker))) {
      throw new Error(`Cross-organization search leak detected for ${organization.marker}`);
    }
  }

  const routes = ["/dashboard", "/companies?limit=50", "/leads?limit=50", "/tasks", "/products/quotes"];
  const samples: Array<{ status: number; durationMs: number }> = [];
  let nextIndex = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextIndex < requestCount) {
      const index = nextIndex++;
      const organization = organizations[index % organizations.length]!;
      const startedAt = performance.now();
      const response = await fetch(`${baseUrl}${routes[index % routes.length]}`, {
        headers: { authorization: `Bearer ${organization.token}` }
      });
      samples.push({ status: response.status, durationMs: performance.now() - startedAt });
    }
  }));
  const failures = samples.filter((sample) => sample.status !== 200);
  if (failures.length) throw new Error(`${failures.length}/${samples.length} concurrent requests failed`);
  const durations = samples.map((sample) => sample.durationMs).sort((left, right) => left - right);
  const percentile = (ratio: number) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * ratio) - 1)] || 0;
  const p95Ms = percentile(0.95);
  if (p95Ms > 5000) throw new Error(`Load gate p95 is too high (${p95Ms.toFixed(1)} ms)`);
  console.log(JSON.stringify({
    ok: true,
    organizations: organizationCount,
    recordsPerOrganization,
    seededRecords: organizationCount * recordsPerOrganization * 3,
    concurrentRequests: requestCount,
    concurrency,
    p50Ms: Number(percentile(0.5).toFixed(1)),
    p95Ms: Number(p95Ms.toFixed(1)),
    p99Ms: Number(percentile(0.99).toFixed(1))
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  for (const organization of organizations) {
    await prisma.organization.delete({ where: { id: organization.id } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});
