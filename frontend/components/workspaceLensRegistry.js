const projectScope = (projectName, fallback) => (projectName ? `Project · ${projectName}` : fallback);

export const WORKSPACE_KIND_LENSES = Object.freeze({
  app: {
    label: "App",
    subtitle: "Use the app, edit it directly, then ask Hydria to extend or fix it.",
    helper: "Ask Hydria to add screens, flows, content or fixes to this app.",
    promptPlaceholder: "Ex: add a planner page, improve the recipe flow, fix the weekly view.",
    nextStep: "Next: add a view, flow or fix",
    priority: "delivery_first",
    scope: (projectName) => projectScope(projectName, "Interactive app")
  },
  project: {
    label: "Project",
    subtitle: "This project groups what you have created so far and keeps it evolving in one place.",
    helper: "Ask Hydria to add a new surface, continue the project or transform what is open.",
    promptPlaceholder: "Ex: add a dashboard, create a presentation, extend the current app.",
    nextStep: "Next: extend the project",
    priority: "iteration_first",
    scope: (projectName) => projectScope(projectName, "Project workspace")
  },
  dashboard: {
    label: "Dashboard",
    subtitle: "Operate the dashboard directly here, then ask Hydria to add metrics, views or filters.",
    helper: "Ask Hydria to add KPIs, views, filters or a new analytics panel to this dashboard.",
    promptPlaceholder: "Ex: add a churn KPI, add a weekly report view, keep the existing table.",
    nextStep: "Next: add metrics, views or filters",
    priority: "operations_first",
    scope: (projectName) => projectScope(projectName, "Standalone dashboard")
  },
  benchmark: {
    label: "Benchmark",
    subtitle: "Keep the competitive picture in the same project, then ask Hydria to refine the criteria, competitors or recommendations.",
    helper: "Ask Hydria to sharpen the benchmark, add proof, or derive a presentation or campaign from it.",
    promptPlaceholder: "Ex: add two stronger competitors, strengthen the recommendations, turn this into slides.",
    nextStep: "Next: refine the benchmark or derive another asset",
    priority: "review_first",
    scope: (projectName) => projectScope(projectName, "Benchmark")
  },
  campaign: {
    label: "Campaign",
    subtitle: "Shape the launch plan here, then ask Hydria to improve channels, assets or rollout.",
    helper: "Ask Hydria to add launch assets, sharpen the promise, or derive a teaser video from this campaign.",
    promptPlaceholder: "Ex: add a launch email, tighten the promise, create a teaser video from this campaign.",
    nextStep: "Next: improve channels, assets or rollout",
    priority: "review_first",
    scope: (projectName) => projectScope(projectName, "Campaign")
  },
  workflow: {
    label: "Workflow",
    subtitle: "Move through the flow visually, then ask Hydria to add steps, links or automations.",
    helper: "Ask Hydria to add a step, automate a branch or simplify the current workflow.",
    promptPlaceholder: "Ex: add an approval step, connect publish after review, simplify this flow.",
    nextStep: "Next: add a step or automation",
    priority: "operations_first",
    scope: (projectName) => projectScope(projectName, "Automation workflow")
  },
  design: {
    label: "Design",
    subtitle: "Work on the layout directly here, then ask Hydria to improve the wireframe or add screens.",
    helper: "Ask Hydria to improve the layout, add a frame or restructure the current design.",
    promptPlaceholder: "Ex: add a mobile frame, clean the hero layout, make this more premium.",
    nextStep: "Next: improve layout or frames",
    priority: "iteration_first",
    scope: (projectName) => projectScope(projectName, "Wireframe design")
  },
  presentation: {
    label: "Presentation",
    subtitle: "Review the slides here, then ask Hydria to sharpen the narrative or add missing slides.",
    helper: "Ask Hydria to improve the pitch, rewrite a slide or add a stronger closing section.",
    promptPlaceholder: "Ex: make slide 2 stronger, add investor traction, shorten the opening.",
    nextStep: "Next: improve slides or story",
    priority: "review_first",
    scope: (projectName) => projectScope(projectName, "Slide deck")
  },
  dataset: {
    label: "Spreadsheet",
    subtitle: "Edit the table directly here, then ask Hydria to add columns, summaries or transformations.",
    helper: "Ask Hydria to add columns, clean the data, compute totals or restructure the table.",
    promptPlaceholder: "Ex: add a total column, group values, clean this table and keep the rows.",
    nextStep: "Next: edit cells or transform data",
    priority: "iteration_first",
    scope: (projectName) => projectScope(projectName, "Data table")
  },
  image: {
    label: "Image",
    subtitle: "Review the visual inside the project, then ask Hydria to regenerate or refine the brief.",
    helper: "Ask Hydria to change the direction, keep the same concept, or generate a cleaner visual.",
    promptPlaceholder: "Ex: make this more premium, keep the same idea, generate a cleaner variant.",
    nextStep: "Next: refine the visual",
    priority: "review_first",
    scope: (projectName) => projectScope(projectName, "Visual asset")
  },
  audio: {
    label: "Audio",
    subtitle: "Keep the audio brief linked to the project, then ask Hydria to refine the script or cues.",
    helper: "Ask Hydria to change the voice, tighten the hook, or prepare a shorter cut.",
    promptPlaceholder: "Ex: make the hook shorter, keep the tone, add a stronger closing cue.",
    nextStep: "Next: refine the script or delivery",
    priority: "review_first",
    scope: (projectName) => projectScope(projectName, "Audio brief")
  },
  video: {
    label: "Video",
    subtitle: "Keep the storyboard in the project, then ask Hydria to refine scenes, timing or on-screen text.",
    helper: "Ask Hydria to improve the hook, tighten the scenes, or turn the current app into a launch video.",
    promptPlaceholder: "Ex: make scene 2 clearer, keep it under 60 seconds, add a stronger close.",
    nextStep: "Next: refine scenes or storyboard",
    priority: "review_first",
    scope: (projectName) => projectScope(projectName, "Video brief")
  },
  document: {
    label: "Document",
    subtitle: "Read and edit the document here, then ask Hydria to improve a section or transform it.",
    helper: "Ask Hydria to rewrite, strengthen or transform the current document.",
    promptPlaceholder: "Ex: improve the executive summary, make this clearer, turn this into slides.",
    nextStep: "Next: improve or transform the document",
    priority: "review_first",
    scope: (projectName) => projectScope(projectName, "Structured document")
  },
  creation: {
    label: "Workspace",
    subtitle: "Create something and it will open here immediately.",
    helper: "Tell Hydria what to create. It will open the result here automatically.",
    promptPlaceholder: "Ex: cree une application de cuisine, fais un excel, fais une presentation.",
    nextStep: "Next: create something",
    scope: () => "Nothing open yet"
  }
});

export const WORKSPACE_FAMILY_LENSES = Object.freeze({
  document_knowledge: {
    label: "Knowledge",
    subtitle: "Write, structure and connect knowledge directly in the project.",
    helper: "Ask Hydria to write, summarize, restructure or turn this knowledge into another project asset.",
    promptPlaceholder: "Ex: write a clearer spec, turn this into a wiki page, add an SOP from this document.",
    nextStep: "Next: write, structure or derive",
    priority: "review_first"
  },
  data_spreadsheet: {
    label: "Data",
    subtitle: "Work directly on the table, calculations and reporting logic here.",
    helper: "Ask Hydria to clean rows, add columns, compute summaries or derive a dashboard from this data.",
    promptPlaceholder: "Ex: add a margin column, clean duplicates, build a dashboard from this table.",
    nextStep: "Next: compute, clean or derive",
    priority: "iteration_first"
  },
  analytics_dashboard: {
    label: "Analytics",
    subtitle: "Operate KPIs, filters and views directly in the current analytics surface.",
    helper: "Ask Hydria to add charts, KPIs, comparisons or a decision view for this project.",
    promptPlaceholder: "Ex: add weekly retention, compare by segment, add an executive summary view.",
    nextStep: "Next: add signal or decision support",
    priority: "operations_first"
  },
  development: {
    label: "Development",
    subtitle: "Build, inspect and evolve code directly in the current project workspace.",
    helper: "Ask Hydria to add files, refactor, debug or extend the current codebase.",
    promptPlaceholder: "Ex: add auth, fix the API route, generate tests for this module.",
    nextStep: "Next: build, fix or extend",
    priority: "delivery_first"
  },
  app_builder: {
    label: "App Builder",
    subtitle: "Shape the product directly in live preview and keep extending the current app.",
    helper: "Ask Hydria to add views, flows, business logic or CRUD surfaces to the current app.",
    promptPlaceholder: "Ex: add a settings screen, create an onboarding flow, add CRUD for users.",
    nextStep: "Next: extend the app",
    priority: "delivery_first"
  },
  design: {
    label: "Design",
    subtitle: "Structure screens, flows and layout decisions directly in the design workspace.",
    helper: "Ask Hydria to improve hierarchy, add frames, tighten UX or derive screens from the app.",
    promptPlaceholder: "Ex: make the onboarding cleaner, add a mobile frame, align the hierarchy.",
    nextStep: "Next: refine layout or UX",
    priority: "iteration_first"
  },
  presentation: {
    label: "Presentation",
    subtitle: "Turn the current project into a stronger deck with a clearer story and proof.",
    helper: "Ask Hydria to sharpen the narrative, add slides, simplify the flow or derive slides from the app.",
    promptPlaceholder: "Ex: add investor proof, rewrite slide 2, turn the app flow into 3 clearer slides.",
    nextStep: "Next: sharpen story or proof",
    priority: "review_first"
  },
  project_management: {
    label: "Project Management",
    subtitle: "Keep roadmap, tasks and project continuity visible in one place.",
    helper: "Ask Hydria to add roadmap items, milestones, owners or a delivery plan.",
    promptPlaceholder: "Ex: add a 6-month roadmap, create milestones, turn this into a kanban.",
    nextStep: "Next: plan work or milestones",
    priority: "iteration_first"
  },
  strategy_planning: {
    label: "Strategy",
    subtitle: "Clarify direction, positioning and the next major choices for the project.",
    helper: "Ask Hydria to compare options, structure strategy, build a plan or challenge the current direction.",
    promptPlaceholder: "Ex: compare two launch options, build a GTM plan, structure the strategic narrative.",
    nextStep: "Next: decide or plan",
    priority: "review_first"
  },
  workflow_automation: {
    label: "Workflow",
    subtitle: "Build automations and operating flows directly in the current project.",
    helper: "Ask Hydria to add nodes, conditions, outputs or integrations to the current workflow.",
    promptPlaceholder: "Ex: add approval before publish, connect email after validation, simplify this flow.",
    nextStep: "Next: automate or simplify",
    priority: "operations_first"
  },
  ai_agent: {
    label: "AI / Agent",
    subtitle: "Coordinate copilots, automation and delegated work inside the same project.",
    helper: "Ask Hydria to create a specialist agent, add a review loop or automate a recurring cognitive task.",
    promptPlaceholder: "Ex: create a QA copilot, add a research agent, automate project follow-up.",
    nextStep: "Next: delegate or automate",
    priority: "iteration_first"
  },
  crm_sales: {
    label: "CRM & Sales",
    subtitle: "Run leads, accounts, opportunities, quotes, forecasts and follow-up in one sales workspace.",
    helper: "Ask Hydria to qualify or convert leads, update opportunities, prepare quotes, inspect forecasts or plan follow-up.",
    promptPlaceholder: "Ex: convert this lead, add products to the opportunity, prepare a quote, show the weighted forecast.",
    nextStep: "Next: qualify, sell or forecast",
    priority: "operations_first"
  },
  operations: {
    label: "Operations",
    subtitle: "Run the current operating system with clear queues, ownership and next actions.",
    helper: "Ask Hydria to add queues, operating dashboards, workflows or status views for this system.",
    promptPlaceholder: "Ex: add an incident queue, build an ops dashboard, create an intake workflow.",
    nextStep: "Next: operate or automate",
    priority: "operations_first"
  },
  finance: {
    label: "Finance",
    subtitle: "Work on budgets, reporting and finance workflows directly in the current project.",
    helper: "Ask Hydria to add forecasts, reporting views, controls or investor-facing finance assets.",
    promptPlaceholder: "Ex: add a monthly cash view, build a forecast, derive investor finance slides.",
    nextStep: "Next: report, plan or forecast",
    priority: "iteration_first"
  },
  hr: {
    label: "HR",
    subtitle: "Structure recruiting, team tracking and people workflows in one project.",
    helper: "Ask Hydria to add hiring stages, role scorecards, onboarding docs or staffing dashboards.",
    promptPlaceholder: "Ex: add a hiring pipeline, create onboarding docs, build a staffing dashboard.",
    nextStep: "Next: recruit or organize",
    priority: "iteration_first"
  },
  file_storage: {
    label: "Files",
    subtitle: "Keep project files, assets and references connected to the current work.",
    helper: "Ask Hydria to organize files, summarize assets, or connect the current project to references.",
    promptPlaceholder: "Ex: organize these files, attach a reference repo, summarize the uploaded assets.",
    nextStep: "Next: organize or connect",
    priority: "focus"
  },
  testing_qa: {
    label: "Testing",
    subtitle: "Check quality, scenarios and reliability inside the current project.",
    helper: "Ask Hydria to add test cases, QA scenarios, edge cases or validation flows.",
    promptPlaceholder: "Ex: add QA scenarios, generate test cases, validate edge cases for this app.",
    nextStep: "Next: validate or test",
    priority: "operations_first"
  },
  web_cms: {
    label: "Web & CMS",
    subtitle: "Shape pages, publishing flow and site content directly in the workspace.",
    helper: "Ask Hydria to add pages, CMS structure, publishing rules or landing content.",
    promptPlaceholder: "Ex: create a landing page, add CMS collections, build a content workflow.",
    nextStep: "Next: publish or structure content",
    priority: "delivery_first"
  },
  media: {
    label: "Media",
    subtitle: "Keep visual storytelling and content production linked to the same project.",
    helper: "Ask Hydria to derive visuals, campaign assets, storyboards or launch media from this project.",
    promptPlaceholder: "Ex: create a hero visual, derive a campaign asset, build a launch storyboard.",
    nextStep: "Next: produce or refine media",
    priority: "review_first"
  },
  audio: {
    label: "Audio",
    subtitle: "Keep voice, soundtrack and audio direction connected to the project.",
    helper: "Ask Hydria to refine script, pacing, cues or derive an audio asset from the current project.",
    promptPlaceholder: "Ex: tighten the voiceover, add cues, derive a 30-second audio version.",
    nextStep: "Next: script or score",
    priority: "review_first"
  },
  integration_api: {
    label: "Integrations",
    subtitle: "Connect APIs, services and back-office systems inside the same project.",
    helper: "Ask Hydria to add an API route, connector, payload map or integration workflow.",
    promptPlaceholder: "Ex: connect Stripe, add a webhook flow, map this payload to the CRM.",
    nextStep: "Next: connect or automate",
    priority: "operations_first"
  },
  knowledge_graph: {
    label: "Knowledge Graph",
    subtitle: "Structure entities, relationships and project memory in one connected system.",
    helper: "Ask Hydria to define entities, relations, schemas or derive structure from the current project.",
    promptPlaceholder: "Ex: map the entities, add relationships, build a graph from this knowledge base.",
    nextStep: "Next: connect or structure",
    priority: "iteration_first"
  }
});

export function createWorkspaceLens({
  kind = "creation",
  title = "Hydria",
  fileLabel = "",
  workspaceFamilyId = "",
  workspaceFamilyLabel = "",
  workspaceFamilyDescription = "",
  projectName = "",
  hasWorkObject = false
} = {}) {
  const current = WORKSPACE_KIND_LENSES[kind] || WORKSPACE_KIND_LENSES.project;
  const familyCurrent = WORKSPACE_FAMILY_LENSES[workspaceFamilyId] || null;
  const currentScope = typeof current.scope === "function" ? current.scope(projectName) : current.scope;
  const effectiveLabel = workspaceFamilyLabel || familyCurrent?.label || current.label;
  const effectiveSubtitle = workspaceFamilyDescription || familyCurrent?.subtitle || current.subtitle;
  const effectiveScope =
    workspaceFamilyLabel && projectName
      ? `${workspaceFamilyLabel} · ${projectName}`
      : workspaceFamilyLabel
        ? workspaceFamilyLabel
        : currentScope;

  return {
    kind,
    kindLabel: effectiveLabel,
    priorityLabel: effectiveLabel,
    prioritySubtitle: effectiveSubtitle,
    priority: familyCurrent?.priority || current.priority || "focus",
    promptPlaceholder: familyCurrent?.promptPlaceholder || current.promptPlaceholder,
    assistantTitle: "Hydria",
    assistantHelper: familyCurrent?.helper || current.helper,
    assistantStatus: hasWorkObject ? `Working on ${title}` : "Ready to create something new.",
    scopeLabel: fileLabel ? `${effectiveScope} · ${fileLabel}` : effectiveScope,
    nextStep: familyCurrent?.nextStep || current.nextStep,
    riskPosture: fileLabel || familyCurrent?.nextStep || current.nextStep,
    assistantRole: kind,
    interactionMode: kind,
    impactOutcome: null,
    usageScenario: null
  };
}
