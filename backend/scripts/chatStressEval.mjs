import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.HYDRIA_BASE_URL || "http://localhost:3001/api";
const outputDir = path.resolve(process.cwd(), "..", "data", "test-results");

const scenarios = [
  {
    name: "weather_forecast_followup",
    prompts: ["quel temps fait il aujourd'hui a paris", "vasy", "et a lyon ?"]
  },
  {
    name: "finance_followup",
    prompts: ["quel est le cours de l'action", "AAPL", "fais une analyse rapide"]
  },
  {
    name: "crypto_followup",
    prompts: ["prix du btc", "et l'eth ?", "fais une analyse rapide"]
  },
  {
    name: "translation_followup",
    prompts: ['traduis "hello world" en espagnol', "et en allemand"]
  },
  {
    name: "compare_followup",
    prompts: [
      "Compare React, Vue et Svelte pour un MVP SaaS. Recommande un choix.",
      "pourquoi ce choix ?",
      "et si je veux la vitesse de dev max ?"
    ]
  },
  {
    name: "web_search_followup",
    prompts: [
      "search the web for local multi agent orchestration best practices",
      "fais une synthese actionnable en francais"
    ]
  },
  {
    name: "url_summary",
    prompts: ["resume cette url https://example.com"]
  },
  {
    name: "complex_reasoning",
    prompts: [
      "Je veux lancer un SaaS B2B IA en 60 jours avec 3000 euros. Donne un plan realiste, les risques majeurs et les compromis."
    ]
  },
  {
    name: "coding_audit",
    prompts: ["inspect le projet hydria et donne 3 risques techniques concrets avec action corrective"]
  },
  {
    name: "simple_chat",
    prompts: ["salut", "j'aime les reponses courtes et precises, retiens le", "ok alors presente toi en une phrase"]
  }
];

async function postJson(route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      success: false,
      status: response.status,
      raw: text
    };
  }

  return parsed;
}

function normalizeAnswer(answer = "") {
  return String(answer || "").replace(/\s+/g, " ").trim();
}

function summarizeTurn(result = {}, prompt = "") {
  return {
    prompt,
    classification: result.classification || "",
    route: result.routing?.resolvedPrompt || prompt,
    taskPack: result.taskPack?.id || result.taskPack?.label || "",
    tools: result.toolsUsed || [],
    apis: result.apisUsed || [],
    models: result.modelsUsed || [],
    judge: result.judge?.decision || "",
    answer: normalizeAnswer(result.finalAnswer),
    followUps: (result.followUpActions || []).map((action) => action.id)
  };
}

async function runScenario(userId, scenario) {
  const conversation = (
    await postJson("/conversations", {
      userId,
      title: scenario.name
    })
  ).conversation;
  const turns = [];

  for (const prompt of scenario.prompts) {
    const result = await postJson("/chat", {
      userId,
      conversationId: conversation.id,
      prompt
    });

    turns.push(summarizeTurn(result, prompt));
  }

  return {
    scenario: scenario.name,
    conversationId: conversation.id,
    turns
  };
}

function printSummary(results = []) {
  for (const item of results) {
    console.log(`\n=== ${item.scenario} ===`);
    item.turns.forEach((turn, index) => {
      console.log(`${index + 1}. ${turn.prompt}`);
      console.log(
        `   class=${turn.classification} route=${JSON.stringify(turn.route)} judge=${turn.judge} apis=${turn.apis.join(",") || "-"} tools=${turn.tools.join(",") || "-"}`
      );
      console.log(`   answer=${turn.answer.slice(0, 220)}`);
    });
  }
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const user = (
    await postJson("/users", {
      username: `eval-${Date.now()}`
    })
  ).user;

  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(user.id, scenario));
  }

  const payload = {
    createdAt: new Date().toISOString(),
    baseUrl,
    userId: user.id,
    results
  };

  const latestFile = path.join(outputDir, "chat-stress-latest.json");
  const datedFile = path.join(
    outputDir,
    `chat-stress-${payload.createdAt.replace(/[:.]/g, "-")}.json`
  );

  await fs.writeFile(latestFile, JSON.stringify(payload, null, 2));
  await fs.writeFile(datedFile, JSON.stringify(payload, null, 2));

  console.log(`Saved latest results to ${latestFile}`);
  console.log(`Saved dated results to ${datedFile}`);
  printSummary(results);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
