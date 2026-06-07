import assert from "node:assert/strict";

process.env.HYDRIA_API_KEY = "test-api-key";
process.env.HYDRIA_INTERACTIONS_URL = "https://core.example/api/v1/interactions";

let captured = null;
global.fetch = async (url, init = {}) => {
  captured = { url: String(url), init };
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return String(name).toLowerCase() === "content-type" ? "application/json" : "";
      }
    },
    async text() {
      return JSON.stringify({
        object: "hydria.interaction_list",
        interactions: [
          {
            id: "int_1",
            scope: "workspace_action",
            sessionId: "11111111-1111-4111-8111-111111111111"
          }
        ]
      });
    }
  };
};

const { listExternalHydriaInteractions, getExternalHydriaStatus } = await import(
  "../services/hydria/externalHydriaApiClient.js"
);

const result = await listExternalHydriaInteractions({
  sessionId: "11111111-1111-4111-8111-111111111111",
  scope: "workspace_action",
  limit: 7
});

assert.equal(result.object, "hydria.interaction_list");
assert.equal(result.interactions.length, 1);
assert.equal(result.interactions[0].scope, "workspace_action");
assert.ok(captured.url.startsWith("https://core.example/api/v1/interactions?"));
assert.ok(captured.url.includes("sessionId=11111111-1111-4111-8111-111111111111"));
assert.ok(captured.url.includes("scope=workspace_action"));
assert.ok(captured.url.includes("limit=7"));
assert.equal(captured.init.headers.Authorization, "Bearer test-api-key");

const status = getExternalHydriaStatus();
assert.equal(status.interactionsEndpoint, "https://core.example/api/v1/interactions");

console.log("hydriaInteractionsClientGate ok");
