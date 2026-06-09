const baseUrl = String(process.env.HYDRIA_GATE_BASE_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
const crmApiUrl = String(process.env.CRM_API_URL || "http://127.0.0.1:4010/api").replace(/\/+$/, "");

async function request(url, init = {}) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `${init.method || "GET"} ${url} failed (${response.status})`);
  }
  return payload;
}

const usersPayload = await request(`${baseUrl}/api/users`);
let user = usersPayload.users?.[0];
if (!user) {
  const created = await request(`${baseUrl}/api/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "crm-core-gate" })
  });
  user = created.user;
}

const conversationPayload = await request(`${baseUrl}/api/conversations`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    userId: user.id,
    title: "CRM Core integration gate"
  })
});
const marker = Date.now();
const email = `crm-core-gate-${marker}@example.com`;
const control = await request(`${baseUrl}/api/hydria/control`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    userId: user.id,
    conversationId: conversationPayload.conversation.id,
    workspaceFamilyId: "crm_sales",
    prompt: `Ajoute un prospect Core Gate Test email ${email}`,
    execute: true,
    confirmed: true
  })
});

const completed = (control.workspaceToolResults || []).find(
  (result) => result.status === "completed" && result.engine === "crm"
);
if (!completed?.record?.id || completed.entity !== "lead") {
  throw new Error(`CRM Core gate did not create the expected lead: ${JSON.stringify(control.workspaceToolResults)}`);
}

try {
  const session = await request(`${baseUrl}/api/hydria/crm/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: user.id })
  });
  const cleanup = await fetch(`${crmApiUrl}/leads/${completed.record.id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${session.token}` }
  });
  if (!cleanup.ok) {
    throw new Error(`Cleanup failed (${cleanup.status})`);
  }
} finally {
  console.log(JSON.stringify({
    success: true,
    source: control.control?.source || "",
    toolName: completed.toolName,
    entity: completed.entity,
    status: completed.status
  }, null, 2));
}
