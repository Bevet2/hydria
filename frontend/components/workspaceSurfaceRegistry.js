export const WORKSPACE_ROUTE_PREFIX = "/workspace/";

export const WORKSPACE_PAGES = Object.freeze([
  {
    slug: "chat",
    kind: "project",
    family: "ai_agent",
    label: "Chat",
    title: "Chat",
    description: "Talk directly with Hydria Core.",
    hint: "Open chat"
  },
  {
    slug: "docs",
    kind: "document",
    family: "document_knowledge",
    label: "Docs",
    title: "Documents",
    description: "Write, structure and refine documents in a focused page.",
    hint: "Create a document"
  },
  {
    slug: "sheets",
    kind: "dataset",
    family: "data_spreadsheet",
    label: "Sheets",
    title: "Spreadsheets",
    description: "Work with tables, formulas and structured data in a dedicated page.",
    hint: "Create a spreadsheet"
  },
  {
    slug: "slides",
    kind: "presentation",
    family: "presentation",
    label: "Slides",
    title: "Presentations",
    description: "Build and edit presentations without mixing them with other workspaces.",
    hint: "Create a presentation"
  },
  {
    slug: "dashboard",
    kind: "dashboard",
    family: "analytics_dashboard",
    label: "Dashboard",
    title: "Dashboards",
    description: "Review metrics, charts and operational signals on their own page.",
    hint: "Create a dashboard"
  },
  {
    slug: "crm",
    kind: "project",
    family: "crm_sales",
    label: "Hydria CRM",
    title: "Hydria CRM",
    description: "Manage contacts, companies, deals and sales follow-up directly in Hydria CRM.",
    hint: "Open Hydria CRM"
  },
  {
    slug: "automation",
    kind: "workflow",
    family: "workflow_automation",
    label: "Automation",
    title: "Automations",
    description: "Design workflows, stages and triggers in a dedicated environment.",
    hint: "Create an automation"
  },
  {
    slug: "app-builder",
    kind: "project",
    family: "app_builder",
    label: "App Builder",
    title: "App Builder",
    description: "Build and preview applications in a workspace reserved for the product.",
    hint: "Create an application"
  },
  {
    slug: "whiteboard",
    kind: "design",
    family: "design",
    label: "Whiteboard",
    title: "Whiteboards",
    description: "Explore layouts, frames and visual ideas on a dedicated canvas.",
    hint: "Create a whiteboard"
  },
  {
    slug: "code",
    kind: "code",
    family: "development",
    label: "Code Studio",
    title: "Code Studio",
    description: "Inspect and edit project code in a focused development page.",
    hint: "Open a code workspace"
  }
]);

export const WORKSPACE_FAMILY_LABELS = Object.freeze({
  document_knowledge: "Document & Knowledge",
  data_spreadsheet: "Data & Spreadsheet",
  analytics_dashboard: "Analytics & Dashboard",
  development: "Development",
  app_builder: "App Builder",
  design: "Design",
  presentation: "Presentation",
  project_management: "Project Management",
  strategy_planning: "Strategy & Planning",
  workflow_automation: "Workflow & Automation",
  ai_agent: "AI & Agents",
  crm_sales: "CRM & Sales",
  operations: "Operations",
  finance: "Finance",
  hr: "HR",
  file_storage: "Files & Storage",
  testing_qa: "Testing & QA",
  web_cms: "Web & CMS",
  media: "Media",
  audio: "Audio",
  integration_api: "Integrations & API",
  knowledge_graph: "Knowledge Graph"
});

export const WORKSPACE_OBJECT_KIND_LABELS = Object.freeze({
  project: "Project",
  document: "Document",
  dataset: "Spreadsheet",
  dashboard: "Dashboard",
  workflow: "Workflow",
  design: "Design",
  presentation: "Presentation",
  benchmark: "Benchmark",
  campaign: "Campaign",
  image: "Image",
  audio: "Audio",
  video: "Video",
  code: "Code"
});

export function workspacePageFromSlug(slug = "") {
  return WORKSPACE_PAGES.find((page) => page.slug === String(slug || "").trim()) || null;
}

export function workspacePageFromFamily(family = "") {
  const normalizedFamily = String(family || "").trim().toLowerCase();
  return WORKSPACE_PAGES.find((page) => page.family === normalizedFamily) || null;
}

export function parseWorkspacePagePath(pathname = globalThis.window?.location?.pathname || "/") {
  const normalizedPath = String(pathname || "/").replace(/\/+$/, "") || "/";
  if (normalizedPath === "/" || !normalizedPath.startsWith(WORKSPACE_ROUTE_PREFIX)) {
    return null;
  }
  return workspacePageFromSlug(decodeURIComponent(normalizedPath.slice(WORKSPACE_ROUTE_PREFIX.length)));
}

export function workspacePagePath(page = null) {
  return page ? `${WORKSPACE_ROUTE_PREFIX}${page.slug}` : "/";
}

export function formatWorkspaceFamilyLabel(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (WORKSPACE_FAMILY_LABELS[normalized]) {
    return WORKSPACE_FAMILY_LABELS[normalized];
  }
  if (/[A-Z&]/.test(normalized) || normalized.includes(" / ")) {
    return normalized;
  }
  return normalized
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function formatWorkspaceObjectKindLabel(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (WORKSPACE_OBJECT_KIND_LABELS[normalized]) {
    return WORKSPACE_OBJECT_KIND_LABELS[normalized];
  }
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
}

export function resolveWorkspacePageForWorkObject(
  workObject = null,
  { files = [], isCodeLikePath = () => false } = {}
) {
  if (!workObject) {
    return null;
  }

  const kind = String(workObject.objectKind || workObject.kind || "").toLowerCase();
  const family = String(
    workObject.workspaceFamilyId ||
      workObject.metadata?.workspaceFamilyId ||
      workObject.environmentPlan?.workspaceFamilyId ||
      ""
  ).toLowerCase();
  const fileText = [
    ...files,
    workObject.primaryFile,
    workObject.primaryEntry?.path
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (kind === "dataset" || /\.(csv|tsv|xlsx|xlsm|xls)\b/i.test(fileText)) {
    return workspacePageFromSlug("sheets");
  }
  if (kind === "presentation" || /(^|\/)slides\.md\b/i.test(fileText) || /\.pptx\b/i.test(fileText)) {
    return workspacePageFromSlug("slides");
  }
  if (kind === "dashboard") {
    return workspacePageFromSlug("dashboard");
  }
  if (family === "crm_sales") {
    return workspacePageFromSlug("crm");
  }
  if (kind === "workflow") {
    return workspacePageFromSlug("automation");
  }
  if (kind === "design") {
    return workspacePageFromSlug("whiteboard");
  }
  if (kind === "code") {
    return workspacePageFromSlug("code");
  }
  if (kind === "project" && family === "app_builder") {
    return workspacePageFromSlug("app-builder");
  }
  if (
    kind === "project" &&
    (family === "development" || family === "integration_api" || isCodeLikePath(workObject.primaryFile))
  ) {
    return workspacePageFromSlug("code");
  }
  if (kind === "document") {
    return workspacePageFromSlug("docs");
  }

  return workspacePageFromFamily(family) || workspacePageFromSlug("docs");
}
