import { normalizePromptText } from "../core/promptNormalization.js";

function createWorkspaceFamily(id, definition = {}) {
  return {
    id,
    label: definition.label || id,
    description: definition.description || "",
    preferredShape: definition.preferredShape || "document",
    shapes: definition.shapes || [],
    objectKinds: definition.objectKinds || [],
    defaultSurfaces: definition.defaultSurfaces || ["preview", "edit", "structure"],
    defaultSurface:
      definition.defaultSurface ||
      definition.defaultSurfaces?.[0] ||
      "preview",
    runtimeMode: definition.runtimeMode || "rendered",
    continuityMode: definition.continuityMode || "object_first",
    capabilityFamilies: definition.capabilityFamilies || [],
    keywords: definition.keywords || [],
    scope: definition.scope || "project",
    implemented: definition.implemented !== false
  };
}

export const WORKSPACE_REGISTRY = [
  createWorkspaceFamily("document_knowledge", {
    label: "Document & Knowledge",
    description: "Rédaction, documentation, wiki, SOP, knowledge base.",
    preferredShape: "document",
    shapes: ["document"],
    objectKinds: ["document"],
    defaultSurfaces: ["preview", "edit", "structure"],
    runtimeMode: "rendered",
    continuityMode: "object_first",
    capabilityFamilies: ["writing", "documentation", "knowledge"],
    keywords: [
      "document",
      "documentation",
      "google docs",
      "word",
      "notion",
      "confluence",
      "wiki",
      "knowledge base",
      "sop",
      "spec",
      "specs",
      "technical documentation",
      "compte rendu",
      "compte-rendu",
      "memo",
      "brief",
      "notes"
    ]
  }),
  createWorkspaceFamily("data_spreadsheet", {
    label: "Data & Spreadsheet",
    description: "Tableurs, bases simples, reporting, calculs, data grids.",
    preferredShape: "spreadsheet",
    shapes: ["spreadsheet", "dataset"],
    objectKinds: ["dataset"],
    defaultSurfaces: ["data", "edit", "structure"],
    defaultSurface: "data",
    runtimeMode: "interactive",
    continuityMode: "object_first",
    capabilityFamilies: ["data", "reporting", "calculation"],
    keywords: [
      "excel",
      "spreadsheet",
      "google sheets",
      "airtable",
      "tableur",
      "worksheet",
      "workbook",
      "sheet",
      "csv",
      "xlsx",
      "data grid",
      "reporting",
      "calcul"
    ]
  }),
  createWorkspaceFamily("analytics_dashboard", {
    label: "Analytics & Dashboard",
    description: "KPI, analytics business, visualisation, dashboards.",
    preferredShape: "dashboard",
    shapes: ["dashboard"],
    objectKinds: ["dashboard"],
    defaultSurfaces: ["dashboard", "data", "edit", "structure"],
    defaultSurface: "dashboard",
    runtimeMode: "interactive",
    continuityMode: "object_first",
    capabilityFamilies: ["analytics", "visualization", "kpi"],
    keywords: [
      "dashboard",
      "analytics",
      "power bi",
      "tableau",
      "looker",
      "metabase",
      "kpi",
      "business analytics",
      "data visualization",
      "visualisation"
    ]
  }),
  createWorkspaceFamily("development", {
    label: "Development",
    description: "Code, debug, tests, repositories, IDE-like work.",
    preferredShape: "code_project",
    shapes: ["code_project", "project"],
    objectKinds: ["project", "code"],
    defaultSurfaces: ["live", "code", "edit", "structure"],
    defaultSurface: "live",
    runtimeMode: "live_runtime",
    continuityMode: "project_first",
    capabilityFamilies: ["development", "code", "debug", "testing"],
    keywords: [
      "development",
      "dev",
      "vs code",
      "vscode",
      "ide",
      "github",
      "gitlab",
      "debug",
      "tests",
      "testing",
      "terminal",
      "codebase"
    ]
  }),
  createWorkspaceFamily("app_builder", {
    label: "App Builder / Internal Tool",
    description: "Apps métier, CRUD tools, internal tools, interfaces utilisables.",
    preferredShape: "app",
    shapes: ["app", "code_project", "project"],
    objectKinds: ["project"],
    defaultSurfaces: ["live", "edit", "structure"],
    defaultSurface: "live",
    runtimeMode: "live_runtime",
    continuityMode: "project_first",
    capabilityFamilies: ["app_builder", "runtime", "interface"],
    keywords: [
      "app builder",
      "internal tool",
      "crud",
      "retool",
      "bubble",
      "flutterflow",
      "tool builder",
      "builder"
    ]
  }),
  createWorkspaceFamily("design", {
    label: "Design",
    description: "UI, UX, wireframes, design systems, layouts.",
    preferredShape: "design",
    shapes: ["design"],
    objectKinds: ["design"],
    defaultSurfaces: ["design", "edit", "structure"],
    defaultSurface: "design",
    runtimeMode: "interactive",
    continuityMode: "object_first",
    capabilityFamilies: ["design", "ux", "visual"],
    keywords: [
      "figma",
      "adobe xd",
      "sketch",
      "wireframe",
      "design system",
      "branding",
      "maquette",
      "ui ux",
      "layout editor"
    ]
  }),
  createWorkspaceFamily("presentation", {
    label: "Presentation",
    description: "Slides, pitch, meetings, storytelling.",
    preferredShape: "presentation",
    shapes: ["presentation"],
    objectKinds: ["presentation"],
    defaultSurfaces: ["presentation", "edit", "structure"],
    defaultSurface: "presentation",
    runtimeMode: "rendered",
    continuityMode: "object_first",
    capabilityFamilies: ["slides", "storytelling", "communication"],
    keywords: [
      "presentation",
      "slides",
      "powerpoint",
      "google slides",
      "gamma",
      "pitch",
      "storytelling",
      "deck",
      "diaporama"
    ]
  }),
  createWorkspaceFamily("project_management", {
    label: "Project Management",
    description: "Tâches, roadmap, suivi projet, kanban, timeline.",
    preferredShape: "project",
    shapes: ["project", "workflow", "spreadsheet", "dashboard"],
    objectKinds: ["project", "workflow", "dataset", "dashboard", "document"],
    defaultSurfaces: ["overview", "structure", "edit"],
    defaultSurface: "overview",
    runtimeMode: "hybrid",
    continuityMode: "project_first",
    capabilityFamilies: ["planning", "tasks", "roadmap"],
    keywords: [
      "jira",
      "asana",
      "trello",
      "clickup",
      "task manager",
      "roadmap",
      "kanban",
      "timeline",
      "backlog",
      "sprint",
      "resource planner"
    ]
  }),
  createWorkspaceFamily("strategy_planning", {
    label: "Strategy & Planning",
    description: "Réflexion haut niveau, benchmark, GTM, brainstorming.",
    preferredShape: "project",
    shapes: ["project", "document", "benchmark", "campaign", "presentation"],
    objectKinds: ["project", "document", "benchmark", "campaign", "presentation"],
    defaultSurfaces: ["overview", "preview", "edit", "structure"],
    defaultSurface: "overview",
    runtimeMode: "hybrid",
    continuityMode: "project_first",
    capabilityFamilies: ["strategy", "planning", "research"],
    keywords: [
      "strategy",
      "planning",
      "miro",
      "figjam",
      "brainstorm",
      "benchmark",
      "competitive analysis",
      "go to market",
      "gtm",
      "planning session"
    ]
  }),
  createWorkspaceFamily("workflow_automation", {
    label: "Workflow / Automation",
    description: "Process automation, integrations, orchestration flows.",
    preferredShape: "workflow",
    shapes: ["workflow"],
    objectKinds: ["workflow"],
    defaultSurfaces: ["workflow", "edit", "structure"],
    defaultSurface: "workflow",
    runtimeMode: "interactive",
    continuityMode: "object_first",
    capabilityFamilies: ["automation", "integration", "orchestration"],
    keywords: [
      "workflow",
      "automation",
      "n8n",
      "zapier",
      "make",
      "scheduled jobs",
      "event driven",
      "process automation"
    ]
  }),
  createWorkspaceFamily("ai_agent", {
    label: "AI / Agent",
    description: "Assistants, copilots, agent builders, orchestration cognitive.",
    preferredShape: "workflow",
    shapes: ["workflow", "project", "document"],
    objectKinds: ["workflow", "project", "document"],
    defaultSurfaces: ["workflow", "preview", "edit", "structure"],
    defaultSurface: "workflow",
    runtimeMode: "hybrid",
    continuityMode: "project_first",
    capabilityFamilies: ["agents", "copilot", "reasoning"],
    keywords: [
      "agent",
      "agents",
      "chatgpt",
      "claude",
      "copilot",
      "agent builder",
      "multi-agent",
      "automation cognitive"
    ]
  }),
  createWorkspaceFamily("crm_sales", {
    label: "CRM & Sales",
    description: "Leads, pipeline, suivi client, deals.",
    preferredShape: "app",
    shapes: ["app", "dashboard", "spreadsheet", "project"],
    objectKinds: ["project", "dashboard", "dataset", "document"],
    defaultSurfaces: ["live", "dashboard", "data", "edit"],
    defaultSurface: "live",
    runtimeMode: "interactive",
    continuityMode: "project_first",
    capabilityFamilies: ["crm", "sales", "pipeline"],
    keywords: [
      "crm",
      "sales",
      "lead",
      "leads",
      "pipeline",
      "deal",
      "hubspot",
      "salesforce",
      "pipedrive",
      "prospect"
    ]
  }),
  createWorkspaceFamily("operations", {
    label: "Operations",
    description: "Production, logistique, suivi terrain, opérations internes.",
    preferredShape: "project",
    shapes: ["project", "dashboard", "workflow", "spreadsheet", "app"],
    objectKinds: ["project", "dashboard", "workflow", "dataset", "document"],
    defaultSurfaces: ["overview", "dashboard", "workflow", "data"],
    defaultSurface: "overview",
    runtimeMode: "hybrid",
    continuityMode: "project_first",
    capabilityFamilies: ["operations", "logistics", "tracking"],
    keywords: [
      "operations",
      "ops",
      "erp",
      "production",
      "logistics",
      "logistique",
      "inventory",
      "stock",
      "field",
      "terrain"
    ]
  }),
  createWorkspaceFamily("finance", {
    label: "Finance",
    description: "Budgets, facturation, reporting, cashflow, finance ops.",
    preferredShape: "spreadsheet",
    shapes: ["spreadsheet", "dashboard", "app", "document", "project"],
    objectKinds: ["dataset", "dashboard", "project", "document"],
    defaultSurfaces: ["data", "dashboard", "edit", "structure"],
    defaultSurface: "data",
    runtimeMode: "hybrid",
    continuityMode: "project_first",
    capabilityFamilies: ["finance", "budgeting", "reporting"],
    keywords: [
      "finance",
      "budget",
      "budgeting",
      "facturation",
      "invoice",
      "invoicing",
      "expense",
      "expenses",
      "cashflow",
      "accounting",
      "forecast"
    ]
  }),
  createWorkspaceFamily("hr", {
    label: "HR",
    description: "Recrutement, employés, onboarding, ATS, people ops.",
    preferredShape: "project",
    shapes: ["project", "spreadsheet", "document", "dashboard", "app"],
    objectKinds: ["project", "dataset", "document", "dashboard"],
    defaultSurfaces: ["overview", "data", "edit", "structure"],
    defaultSurface: "overview",
    runtimeMode: "hybrid",
    continuityMode: "project_first",
    capabilityFamilies: ["hr", "people", "recruitment"],
    keywords: [
      "hr",
      "human resources",
      "ats",
      "recruitment",
      "recrutement",
      "employee",
      "employees",
      "hiring",
      "candidate",
      "onboarding"
    ]
  }),
  createWorkspaceFamily("file_storage", {
    label: "File & Storage",
    description: "Fichiers, stockage, bibliothèques, Drive-like workspace.",
    preferredShape: "project",
    shapes: ["project", "document", "image", "audio", "video"],
    objectKinds: ["project", "document", "image", "audio", "video", "dataset"],
    defaultSurfaces: ["overview", "preview", "structure"],
    defaultSurface: "overview",
    runtimeMode: "hybrid",
    continuityMode: "project_first",
    capabilityFamilies: ["files", "storage", "assets"],
    keywords: [
      "storage",
      "files",
      "fichiers",
      "google drive",
      "dropbox",
      "sharepoint",
      "folder",
      "folders",
      "asset library"
    ]
  }),
  createWorkspaceFamily("testing_qa", {
    label: "Testing / QA",
    description: "Tests, QA, validation, bug tracking, quality loops.",
    preferredShape: "workflow",
    shapes: ["workflow", "document", "dataset", "project"],
    objectKinds: ["workflow", "document", "dataset", "project"],
    defaultSurfaces: ["workflow", "preview", "edit", "structure"],
    defaultSurface: "workflow",
    runtimeMode: "interactive",
    continuityMode: "project_first",
    capabilityFamilies: ["testing", "qa", "validation"],
    keywords: [
      "qa",
      "quality assurance",
      "testing",
      "tests",
      "test plan",
      "test case",
      "bugs",
      "validation"
    ]
  }),
  createWorkspaceFamily("web_cms", {
    label: "Web & CMS",
    description: "Sites web, CMS, content surfaces, web publishing.",
    preferredShape: "app",
    shapes: ["app", "project", "document", "design"],
    objectKinds: ["project", "document", "design"],
    defaultSurfaces: ["live", "preview", "edit", "structure"],
    defaultSurface: "live",
    runtimeMode: "hybrid",
    continuityMode: "project_first",
    capabilityFamilies: ["web", "cms", "content"],
    keywords: [
      "cms",
      "wordpress",
      "webflow",
      "website",
      "site web",
      "landing page",
      "blog",
      "content management"
    ]
  }),
  createWorkspaceFamily("media", {
    label: "Media",
    description: "Images, vidéos, motion, assets marketing et contenu.",
    preferredShape: "image",
    shapes: ["image", "video", "campaign", "presentation"],
    objectKinds: ["image", "video", "campaign", "presentation"],
    defaultSurfaces: ["media", "video", "preview", "edit", "structure"],
    defaultSurface: "preview",
    runtimeMode: "rendered",
    continuityMode: "project_first",
    capabilityFamilies: ["media", "visual", "storytelling"],
    keywords: [
      "media",
      "premiere pro",
      "after effects",
      "canva",
      "animation",
      "storyboard",
      "content production",
      "visual campaign"
    ]
  }),
  createWorkspaceFamily("audio", {
    label: "Audio",
    description: "Musique, voix, podcast, son, DAW-like brief workspace.",
    preferredShape: "audio",
    shapes: ["audio"],
    objectKinds: ["audio"],
    defaultSurfaces: ["audio", "preview", "edit", "structure"],
    defaultSurface: "audio",
    runtimeMode: "rendered",
    continuityMode: "project_first",
    capabilityFamilies: ["audio", "music", "voice"],
    keywords: [
      "audio",
      "voice",
      "voiceover",
      "podcast",
      "music",
      "sound",
      "soundtrack",
      "ableton",
      "daw"
    ]
  }),
  createWorkspaceFamily("integration_api", {
    label: "Integration / API",
    description: "Connecteurs, backend API, webhooks, sync, Postman-like work.",
    preferredShape: "workflow",
    shapes: ["workflow", "code_project", "project", "dataset"],
    objectKinds: ["workflow", "project", "dataset", "document"],
    defaultSurfaces: ["workflow", "code", "data", "edit"],
    defaultSurface: "workflow",
    runtimeMode: "hybrid",
    continuityMode: "project_first",
    capabilityFamilies: ["integration", "api", "connectors"],
    keywords: [
      "api",
      "apis",
      "integration",
      "integrations",
      "connector",
      "connecteur",
      "postman",
      "webhook",
      "endpoint",
      "database",
      "sync"
    ]
  }),
  createWorkspaceFamily("knowledge_graph", {
    label: "Knowledge Graph / Data Structure",
    description: "Graphes de connaissance, ontologies, structures avancées.",
    preferredShape: "dataset",
    shapes: ["dataset", "document", "dashboard", "project"],
    objectKinds: ["dataset", "document", "dashboard", "project"],
    defaultSurfaces: ["data", "structure", "preview", "edit"],
    defaultSurface: "data",
    runtimeMode: "hybrid",
    continuityMode: "project_first",
    capabilityFamilies: ["graph", "ontology", "structure"],
    keywords: [
      "knowledge graph",
      "graph db",
      "ontology",
      "ontologie",
      "graph",
      "nodes",
      "edges",
      "relations",
      "semantic"
    ]
  })
];

const WORKSPACE_REGISTRY_BY_ID = new Map(
  WORKSPACE_REGISTRY.map((entry) => [entry.id, entry])
);

function normalizeWorkspacePrompt(value = "") {
  return normalizePromptText(value || "");
}

function familySupportsShape(family = null, shape = "") {
  if (!family) {
    return false;
  }
  const normalizedShape = String(shape || "").trim().toLowerCase();
  if (!normalizedShape || normalizedShape === "unknown") {
    return true;
  }
  return family.shapes.includes(normalizedShape);
}

function familySupportsObjectKind(family = null, objectKind = "") {
  if (!family) {
    return false;
  }
  const normalizedObjectKind = String(objectKind || "").trim().toLowerCase();
  if (!normalizedObjectKind) {
    return true;
  }
  return family.objectKinds.includes(normalizedObjectKind);
}

function scoreFamilyPromptMatch(family = null, normalizedPrompt = "") {
  if (!family || !normalizedPrompt) {
    return 0;
  }

  let score = 0;
  for (const keyword of family.keywords) {
    const normalizedKeyword = normalizeWorkspacePrompt(keyword);
    if (!normalizedKeyword) {
      continue;
    }

    if (normalizedPrompt.includes(normalizedKeyword)) {
      score += normalizedKeyword.includes(" ") ? 5 : 3;
    }
  }

  return score;
}

function familyFromShape(shape = "") {
  const normalizedShape = String(shape || "").trim().toLowerCase();

  const directMap = {
    document: "document_knowledge",
    spreadsheet: "data_spreadsheet",
    dataset: "data_spreadsheet",
    dashboard: "analytics_dashboard",
    code_project: "development",
    app: "app_builder",
    design: "design",
    presentation: "presentation",
    workflow: "workflow_automation",
    benchmark: "strategy_planning",
    campaign: "strategy_planning",
    image: "media",
    audio: "audio",
    video: "media",
    project: "project_management"
  };

  return directMap[normalizedShape] || "";
}

function familyFromObjectKind(objectKind = "", entryPath = "") {
  const normalizedKind = String(objectKind || "").trim().toLowerCase();
  const normalizedPath = String(entryPath || "").replace(/\\/g, "/").toLowerCase();

  if (normalizedKind === "dataset") {
    return "data_spreadsheet";
  }
  if (normalizedKind === "presentation") {
    return "presentation";
  }
  if (normalizedKind === "document") {
    return "document_knowledge";
  }
  if (normalizedKind === "dashboard") {
    return "analytics_dashboard";
  }
  if (normalizedKind === "workflow") {
    return "workflow_automation";
  }
  if (normalizedKind === "design") {
    return "design";
  }
  if (normalizedKind === "benchmark" || normalizedKind === "campaign") {
    return "strategy_planning";
  }
  if (normalizedKind === "image" || normalizedKind === "video") {
    return "media";
  }
  if (normalizedKind === "audio") {
    return "audio";
  }
  if (normalizedKind === "code") {
    return "development";
  }
  if (normalizedKind === "project") {
    if (/app\.config\.json$/i.test(normalizedPath)) {
      return "app_builder";
    }
    if (/workflow\.json$/i.test(normalizedPath)) {
      return "workflow_automation";
    }
    return "project_management";
  }

  return "";
}

export function listWorkspaceFamilies() {
  return WORKSPACE_REGISTRY.map((family) => ({
    ...family,
    keywords: [...family.keywords],
    shapes: [...family.shapes],
    objectKinds: [...family.objectKinds],
    defaultSurfaces: [...family.defaultSurfaces],
    capabilityFamilies: [...family.capabilityFamilies]
  }));
}

export function listPublicWorkspaceFamilies() {
  return WORKSPACE_REGISTRY.map(({ keywords, ...family }) => ({
    ...family,
    shapes: [...family.shapes],
    objectKinds: [...family.objectKinds],
    defaultSurfaces: [...family.defaultSurfaces],
    capabilityFamilies: [...family.capabilityFamilies]
  }));
}

export function getWorkspaceFamilyById(id = "") {
  return WORKSPACE_REGISTRY_BY_ID.get(String(id || "").trim()) || null;
}

export function resolveWorkspaceFamily({
  prompt = "",
  shape = "",
  objectKind = "",
  entryPath = "",
  workspaceFamilyId = ""
} = {}) {
  const existingFamily = getWorkspaceFamilyById(workspaceFamilyId);
  if (existingFamily) {
    return {
      ...existingFamily,
      resolution: "existing"
    };
  }

  const normalizedPrompt = normalizeWorkspacePrompt(prompt);
  let promptWinner = null;
  let promptWinnerScore = 0;

  for (const family of WORKSPACE_REGISTRY) {
    if (!familySupportsShape(family, shape) || !familySupportsObjectKind(family, objectKind)) {
      continue;
    }

    const score = scoreFamilyPromptMatch(family, normalizedPrompt);
    if (score > promptWinnerScore) {
      promptWinner = family;
      promptWinnerScore = score;
    }
  }

  if (promptWinner && promptWinnerScore >= 3) {
    return {
      ...promptWinner,
      resolution: "prompt",
      score: promptWinnerScore
    };
  }

  const byShapeId = familyFromShape(shape);
  if (byShapeId) {
    const family = getWorkspaceFamilyById(byShapeId);
    if (family) {
      return {
        ...family,
        resolution: "shape"
      };
    }
  }

  const byObjectKindId = familyFromObjectKind(objectKind, entryPath);
  if (byObjectKindId) {
    const family = getWorkspaceFamilyById(byObjectKindId);
    if (family) {
      return {
        ...family,
        resolution: "object_kind"
      };
    }
  }

  return {
    ...getWorkspaceFamilyById("document_knowledge"),
    resolution: "default"
  };
}

export default {
  WORKSPACE_REGISTRY,
  listWorkspaceFamilies,
  listPublicWorkspaceFamilies,
  getWorkspaceFamilyById,
  resolveWorkspaceFamily
};
