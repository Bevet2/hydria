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
  if (typeof payload === "string") {
    return payload;
  }
  return String(payload?.content || "");
}

async function run() {
  const user = createUser(`quality-${Date.now()}`);
  let conversationId = null;

  const projectResponse = await hydriaAutonomousBrain.processChat({
    userId: user.id,
    conversationId,
    prompt:
      "Cree un projet global pour une application de musique locale qui aide les artistes a raconter leur histoire et vendre des billets.",
    attachments: []
  });
  conversationId = projectResponse.conversationId;

  expect(projectResponse.activeWorkObject?.objectKind === "project", "Expected a project shell");
  expect(projectResponse.activeWorkObject?.primaryFile === "experience/overview.md", "Expected project overview to open by default");

  const projectContent = readActiveContent(projectResponse);
  expect(/artistes locaux/i.test(projectContent), "Project overview should mention local artists");
  expect(/vendre des billets|billetterie/i.test(projectContent), "Project overview should mention ticketing");
  expect(!/projet global pour une application/i.test(projectContent), "Project overview should not keep the raw generic prompt phrasing");

  const dashboardResponse = await hydriaAutonomousBrain.processChat({
    userId: user.id,
    conversationId,
    prompt: "Ajoute un dashboard pour ce projet.",
    attachments: []
  });
  expect(dashboardResponse.activeWorkObject?.objectKind === "dashboard", "Expected a dashboard");
  expect(!/\bce projet\b/i.test(dashboardResponse.activeWorkObject?.title || ""), "Dashboard title should not stay generic");
  const dashboardContent = readActiveContent(dashboardResponse);
  expect(/Tickets sold|Venue|Artist/i.test(dashboardContent), "Dashboard should contain local music metrics");

  const workflowResponse = await hydriaAutonomousBrain.processChat({
    userId: user.id,
    conversationId,
    prompt: "Ajoute un workflow pour onboarder un artiste local dans ce projet.",
    attachments: []
  });
  expect(workflowResponse.activeWorkObject?.objectKind === "workflow", "Expected a workflow");
  const workflowContent = readActiveContent(workflowResponse);
  expect(/Capture story|Launch event|Artist page live/i.test(workflowContent), "Workflow should contain artist onboarding stages");

  const designResponse = await hydriaAutonomousBrain.processChat({
    userId: user.id,
    conversationId,
    prompt: "Ajoute un wireframe de l ecran decouverte artistes pour ce projet.",
    attachments: []
  });
  expect(designResponse.activeWorkObject?.objectKind === "design", "Expected a design object");
  const designContent = readActiveContent(designResponse);
  expect(/City discovery|Artist page|Ticket CTA/i.test(designContent), "Design should contain local music wireframe content");

  const presentationResponse = await hydriaAutonomousBrain.processChat({
    userId: user.id,
    conversationId,
    prompt: "Ajoute une presentation partenaires pour ce projet.",
    attachments: []
  });
  expect(presentationResponse.activeWorkObject?.objectKind === "presentation", "Expected a presentation");
  const presentationContent = readActiveContent(presentationResponse);
  expect(/local music|artists|tickets|venues/i.test(presentationContent), "Presentation should contain music partnership content");

  console.log(
    JSON.stringify(
      {
        success: true,
        conversationId,
        projectId: projectResponse.project?.id || projectResponse.activeWorkObject?.projectId || "",
        projectTitle: projectResponse.activeWorkObject?.title || "",
        dashboardTitle: dashboardResponse.activeWorkObject?.title || "",
        workflowTitle: workflowResponse.activeWorkObject?.title || "",
        designTitle: designResponse.activeWorkObject?.title || "",
        presentationTitle: presentationResponse.activeWorkObject?.title || ""
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
