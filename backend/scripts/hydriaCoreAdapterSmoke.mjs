import assert from "node:assert/strict";
import http from "node:http";

const receivedBodies = [];

const server = http.createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/api/v1/ask") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }

  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
  }
  const body = JSON.parse(raw);
  receivedBodies.push({
    authorization: request.headers.authorization || "",
    body
  });

  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      id: "11111111-1111-4111-8111-111111111111",
      object: "hydria.answer",
      createdAt: new Date().toISOString(),
      sessionId: "22222222-2222-4222-8222-222222222222",
      answer: "Core answer using workspace context.",
      language: "en",
      category: "technical_explanation",
      confidence: 88,
      sources: [],
      tools: {
        used: false,
        route: "not_needed",
        type: "none",
        intent: "direct",
        sourceCount: 0
      },
      models: {
        provider: "ollama",
        model: "qwen2.5:14b",
        specialistRole: "primary_reasoning",
        attempts: ["qwen2.5:14b"]
      },
      memory: {
        sessionId: "22222222-2222-4222-8222-222222222222",
        userGoal: "test",
        activeConstraints: [],
        contextTracked: true
      },
      quality: {
        passed: true,
        issues: [],
        retryUsed: false,
        durationMs: 12
      }
    })
  );
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

process.env.LLM_ROUTING_MODE = "core-only";
process.env.HYDRIA_CORE_ENABLED = "true";
process.env.HYDRIA_CORE_BASE_URL = `http://127.0.0.1:${port}/api/v1`;
process.env.HYDRIA_CORE_API_KEY = "test-key";
process.env.LOCAL_LLM_ENABLED = "false";
process.env.OPENROUTER_API_KEY = "";

try {
  const { callChatModel } = await import("../services/providers/llm/llmRouterService.js");
  const result = await callChatModel([
    {
      role: "system",
      content: "Workspace context: project=Demo Workspace, active file=README.md"
    },
    {
      role: "user",
      content: "Use the current workspace."
    }
  ]);

  assert.equal(result.success, true);
  assert.equal(result.provider, "hydria-core");
  assert.equal(result.content, "Core answer using workspace context.");
  assert.equal(receivedBodies.length, 1);
  assert.equal(receivedBodies[0].authorization, "Bearer test-key");
  assert.match(receivedBodies[0].body.input, /Workspace context/);
  assert.equal(receivedBodies[0].body.metadata.source, "hydria-os");

  console.log(
    JSON.stringify(
      {
        success: true,
        provider: result.provider,
        model: result.model,
        forwardedWorkspaceContext: /Workspace context/.test(receivedBodies[0].body.input)
      },
      null,
      2
    )
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
