import hydriaAutonomousBrain from "../src/core/HydriaAutonomousBrain.js";
import { createUser } from "../services/memory/historyService.js";

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveProjectId(response = {}) {
  return (
    response.project?.id ||
    response.activeWorkObject?.projectId ||
    response.workObject?.projectId ||
    response.activeProject?.id ||
    ""
  );
}

async function run() {
  const user = createUser(`continuity-${Date.now()}`);
  const prompts = [
    {
      step: "app",
      prompt: "Cree une application de recettes avec planning repas et liste de courses."
    },
    {
      step: "document",
      prompt: "Ajoute un document de cadrage produit pour ce projet."
    },
    {
      step: "dataset",
      prompt: "Ajoute un excel budget ingredients pour ce projet."
    },
    {
      step: "presentation",
      prompt: "Ajoute une presentation investisseurs courte pour ce projet."
    },
    {
      step: "dashboard",
      prompt: "Ajoute un dashboard simple pour suivre commandes, panier moyen et retention dans ce projet."
    },
    {
      step: "workflow",
      prompt: "Ajoute un workflow simple pour publier les recettes dans ce projet."
    },
    {
      step: "design",
      prompt: "Ajoute un wireframe simple de l ecran planner dans ce projet."
    }
  ];

  const results = [];
  let conversationId = null;
  let expectedProjectId = "";

  for (const item of prompts) {
    const response = await hydriaAutonomousBrain.processChat({
      userId: user.id,
      conversationId,
      prompt: item.prompt,
      attachments: []
    });

    conversationId = response.conversationId;
    const projectId = resolveProjectId(response);
    const activeKind =
      response.activeWorkObject?.objectKind ||
      response.activeWorkObject?.kind ||
      response.workObject?.objectKind ||
      "";

    expect(Boolean(response.success), `Step ${item.step} did not succeed`);
    expect(Boolean(conversationId), `Step ${item.step} did not keep a conversation`);
    expect(Boolean(projectId), `Step ${item.step} did not attach to a project`);

    if (!expectedProjectId) {
      expectedProjectId = projectId;
    }

    expect(
      String(projectId) === String(expectedProjectId),
      `Step ${item.step} created or selected a different project`
    );

    results.push({
      step: item.step,
      prompt: item.prompt,
      conversationId,
      projectId,
      activeKind,
      activeTitle: response.activeWorkObject?.title || "",
      primaryFile:
        response.activeWorkObject?.primaryFile ||
        response.activeWorkObject?.file?.path ||
        "",
      responseMode: response.qualityPass?.mode || response.responseMode || ""
    });
  }

  const project = hydriaAutonomousBrain.projectStore.getProject(expectedProjectId);
  const workObjects = hydriaAutonomousBrain.workObjectService.listForProject({
    projectId: expectedProjectId,
    userId: user.id
  });
  const kinds = [...new Set(workObjects.map((item) => item.objectKind || item.kind))];

  for (const expected of ["project", "document", "dataset", "presentation", "dashboard", "workflow", "design"]) {
    expect(kinds.includes(expected), `Missing ${expected} in the shared project`);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        conversationId,
        projectId: expectedProjectId,
        projectName: project?.name || "",
        workObjectKinds: kinds,
        workObjectCount: workObjects.length,
        results
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
  process.exit(1);
});
