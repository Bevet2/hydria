import hydriaAutonomousBrain from "../src/core/HydriaAutonomousBrain.js";
import { createUser } from "../services/memory/historyService.js";

async function run() {
  const user = createUser("agentic-smoke");
  const prompts = [
    "salut",
    "fais un excel avec les numeros de 1 a 100",
    "ajoute une colonne double dans ce meme tableau",
    "compare sqlite et postgresql pour une app locale"
  ];

  const results = [];
  let conversationId = null;

  for (const prompt of prompts) {
    const response = await hydriaAutonomousBrain.processChat({
      userId: user.id,
      conversationId,
      prompt,
      attachments: []
    });
    conversationId = response.conversationId;
    results.push({
      prompt,
      classification: response.classification,
      success: response.success,
      finalAnswer: String(response.finalAnswer || "").slice(0, 220),
      criticScore: response.eval?.score || 0,
      activeKind:
        response.activeWorkObject?.objectKind ||
        response.activeWorkObject?.kind ||
        "",
      projectId:
        response.project?.id ||
        response.activeWorkObject?.projectId ||
        "",
      modelsUsed: response.modelsUsed,
      apisUsed: response.apisUsed,
      toolsUsed: response.toolsUsed
    });
  }

  console.log(JSON.stringify({ success: true, results }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
  process.exit(1);
});
