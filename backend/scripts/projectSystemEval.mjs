import hydriaAutonomousBrain from "../src/core/HydriaAutonomousBrain.js";
import { createUser } from "../services/memory/historyService.js";

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readActiveContent(response = {}) {
  const workObject = response.activeWorkObject;
  if (!workObject?.id) {
    return "";
  }
  const payload = hydriaAutonomousBrain.workObjectService.readContent({
    workObjectId: workObject.id,
    entryPath: workObject.primaryFile || ""
  });
  return typeof payload === "string" ? payload : String(payload?.content || "");
}

async function run() {
  const user = createUser(`system-${Date.now()}`);
  let conversationId = null;

  const projectResponse = await hydriaAutonomousBrain.processChat({
    userId: user.id,
    conversationId,
    prompt:
      "Cree un projet global pour une plateforme locale d entraide entre voisins avec organisation des taches, documents et suivi d activite.",
    attachments: []
  });
  conversationId = projectResponse.conversationId;

  expect(projectResponse.activeWorkObject?.objectKind === "project", "Expected a project shell");
  expect(projectResponse.project?.id, "Expected a linked project");
  expect(projectResponse.activeWorkObject?.projectId === projectResponse.project.id, "Project shell should link to the same project");

  const projectContent = readActiveContent(projectResponse);
  expect(/entraide|voisins|taches|suivi/i.test(projectContent), "Project overview should keep the user domain");

  const prompts = [
    {
      prompt: "Ajoute un dashboard pour ce projet.",
      kind: "dashboard",
      primaryFile: "dashboard.json"
    },
    {
      prompt: "Ajoute un workflow pour gerer l attribution des demandes dans ce projet.",
      kind: "workflow",
      primaryFile: "workflow.json"
    },
    {
      prompt: "Ajoute un wireframe de l ecran principal pour ce projet.",
      kind: "design",
      primaryFile: "wireframe.json"
    },
    {
      prompt: "Ajoute une presentation courte pour presenter ce projet.",
      kind: "presentation",
      primaryFile: "slides.md"
    },
    {
      prompt: "Ajoute un document de cadrage pour ce projet.",
      kind: "document",
      primaryFile: "content.md"
    }
  ];

  const results = [];

  for (const step of prompts) {
    const response = await hydriaAutonomousBrain.processChat({
      userId: user.id,
      conversationId,
      prompt: step.prompt,
      attachments: []
    });
    const workObject = response.activeWorkObject || {};
    expect(workObject.objectKind === step.kind, `Expected ${step.kind} for prompt: ${step.prompt}`);
    expect(workObject.projectId === projectResponse.project.id, `Expected ${step.kind} to stay attached to the same project`);
    expect(workObject.primaryFile === step.primaryFile, `Expected ${step.kind} to open on ${step.primaryFile}`);
    results.push({
      prompt: step.prompt,
      title: workObject.title,
      kind: workObject.objectKind,
      projectId: workObject.projectId
    });
  }

  const projectObjects = hydriaAutonomousBrain.workObjectService.listForProject({
    projectId: projectResponse.project.id,
    userId: user.id,
    limit: 20
  });

  expect(projectObjects.length >= 6, "Expected a project shell plus linked objects in the same project");

  console.log(
    JSON.stringify(
      {
        success: true,
        conversationId,
        projectId: projectResponse.project.id,
        projectTitle: projectResponse.project.name,
        linkedKinds: [...new Set(projectObjects.map((item) => item.objectKind))],
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
