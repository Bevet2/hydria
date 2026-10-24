export const WORKSPACE_ROUTE_PREFIX = "/workspace/";

export const WORKSPACE_PAGES = Object.freeze([
  {
    slug: "chat",
    kind: "project",
    family: "ai_agent",
    label: "Chat",
    title: "Chat",
    description: "Échangez avec Hydria Core.",
    hint: "Open chat"
  },
  {
    slug: "drive",
    kind: "virtual",
    family: "file_storage",
    label: "Drive",
    title: "Hydria Drive",
    description: "Retrouvez et ouvrez les documents et projets de vos workspaces.",
    hint: "Ouvrir votre bibliothèque"
  },
  {
    slug: "docs",
    kind: "document",
    family: "document_knowledge",
    label: "Docs",
    title: "Documents",
    description: "Rédigez et mettez en forme vos documents.",
    hint: "Créer un document"
  },
  {
    slug: "sheets",
    kind: "dataset",
    family: "data_spreadsheet",
    label: "Sheets",
    title: "Tableurs",
    description: "Analysez vos données, formules et tableaux.",
    hint: "Créer un tableur"
  },
  {
    slug: "slides",
    kind: "presentation",
    family: "presentation",
    label: "Slides",
    title: "Présentations",
    description: "Composez et présentez vos diapositives.",
    hint: "Créer une présentation"
  },
  {
    slug: "dashboard",
    kind: "dashboard",
    family: "analytics_dashboard",
    label: "Dashboard",
    title: "Tableaux de bord",
    description: "Suivez vos indicateurs et graphiques.",
    hint: "Créer un tableau de bord"
  },
  {
    slug: "crm",
    kind: "project",
    family: "crm_sales",
    label: "Hydria CRM",
    title: "Hydria CRM",
    description: "Gérez vos contacts, entreprises et opportunités.",
    hint: "Open Hydria CRM"
  },
  {
    slug: "automation",
    kind: "workflow",
    family: "workflow_automation",
    label: "Automation",
    title: "Automations",
    description: "Configurez vos étapes et déclencheurs.",
    hint: "Create an automation"
  },
  {
    slug: "flows",
    kind: "workflow",
    family: "data_flow",
    label: "Flow Manager",
    title: "Flux de données",
    description: "Préparez et transformez vos données avec des flux visuels.",
    hint: "Créer un flux de données"
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
    family: "canvas_board",
    label: "Whiteboard",
    title: "Whiteboards",
    description: "Explore layouts, frames and visual ideas on a dedicated canvas.",
    hint: "Create a whiteboard"
  },
  {
    slug: "photo",
    kind: "virtual",
    family: "artcraft_photo",
    label: "Photo Studio",
    title: "Hydria Photo",
    description: "Retouchez des images dans PhotoCraft et conservez vos exports dans Drive.",
    hint: "Ouvrir PhotoCraft"
  },
  {
    slug: "fig",
    kind: "virtual",
    family: "artcraft_fig",
    label: "Design Studio",
    title: "Hydria Design",
    description: "Prototypage d'interfaces avec le moteur libre FigCraft Web.",
    hint: "Ouvrir FigCraft"
  },
  {
    slug: "pdf",
    kind: "virtual",
    family: "document_knowledge",
    label: "PDF Studio",
    title: "PDF Studio",
    description: "Ouvrez et éditez des PDF avec le moteur libre ArtCraft PdfCraft.",
    hint: "Ouvrir l'éditeur PDF"
  },
  {
    slug: "code",
    kind: "code",
    family: "development",
    label: "Code Studio",
    title: "Code Studio",
    description: "Inspect and edit project code in a focused development page.",
    hint: "Open a code workspace"
  },
  {
    slug: "projects", kind: "workflow", family: "project_management", label: "Projects",
    title: "Hydria Projects", description: "Planifiez les tâches, jalons et dépendances de vos projets.", hint: "Créer un plan de projet"
  },
  {
    slug: "knowledge", kind: "document", family: "document_knowledge", label: "Knowledge",
    title: "Hydria Knowledge", description: "Centralisez les procédures, notes et bases de connaissance.", hint: "Créer une page de connaissance"
  },
  {
    slug: "forms", kind: "project", family: "app_builder", label: "Forms",
    title: "Hydria Forms", description: "Créez un formulaire personnalisable dans App Builder.", hint: "Créer un formulaire"
  },
  {
    slug: "video", kind: "video", family: "media", label: "Video Studio",
    title: "Hydria Video Studio", description: "Construisez un storyboard et une timeline vidéo sauvegardés dans Hydria.", hint: "Créer un projet vidéo"
  },
  {
    slug: "audio", kind: "audio", family: "audio", label: "Audio Studio",
    title: "Hydria Audio Studio", description: "Préparez les voix, segments et pistes audio sur une timeline.", hint: "Créer un projet audio"
  },
  {
    slug: "3d", kind: "design", family: "cad_3d", label: "3D / CAD",
    title: "Hydria 3D Studio", description: "Organisez un projet de modélisation et ses objets géométriques.", hint: "Créer une scène 3D"
  },
  {
    slug: "gis", kind: "dataset", family: "geospatial", label: "GIS",
    title: "Hydria GIS", description: "Préparez et contrôlez vos objets et coordonnées géographiques.", hint: "Créer un jeu géospatial"
  },
  {
    slug: "erp", kind: "dataset", family: "operations", label: "ERP",
    title: "Hydria ERP", description: "Suivez achats, stocks et opérations, liés aux données Hydria.", hint: "Créer un registre de stock"
  },
  {
    slug: "sites", kind: "project", family: "web_cms", label: "Sites",
    title: "Hydria Sites", description: "Créez et prévisualisez un site dans votre espace de code.", hint: "Créer un site"
  },
  {
    slug: "integrations", kind: "workflow", family: "integration_api", label: "Integrations",
    title: "Hydria Integrations", description: "Modélisez vos connecteurs, API et synchronisations.", hint: "Créer une intégration"
  },
  {
    slug: "qa", kind: "dataset", family: "testing_qa", label: "QA",
    title: "Hydria QA", description: "Suivez cas de test, résultats et anomalies.", hint: "Créer un registre de tests"
  }
]);

export const WORKSPACE_FAMILY_LABELS = Object.freeze({
  document_knowledge: "Document & Knowledge",
  data_spreadsheet: "Data & Spreadsheet",
  analytics_dashboard: "Analytics & Dashboard",
  development: "Development",
  app_builder: "App Builder",
  design: "Design",
  canvas_board: "Canvas & Whiteboard",
  presentation: "Presentation",
  project_management: "Project Management",
  strategy_planning: "Strategy & Planning",
  workflow_automation: "Workflow & Automation",
  data_flow: "Data Flow & ETL",
  ai_agent: "AI & Agents",
  crm_sales: "CRM & Sales",
  operations: "Operations",
  finance: "Finance",
  hr: "HR",
  file_storage: "Files & Storage",
  artcraft_photo: "Photo & Image Editing",
  artcraft_fig: "Interface Design",
  testing_qa: "Testing & QA",
  web_cms: "Web & CMS",
  media: "Media",
  audio: "Audio",
  integration_api: "Integrations & API",
  knowledge_graph: "Knowledge Graph",
  cad_3d: "3D & CAD",
  geospatial: "Geospatial & GIS"
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
  try {
    return workspacePageFromSlug(decodeURIComponent(normalizedPath.slice(WORKSPACE_ROUTE_PREFIX.length)));
  } catch {
    // Malformed percent-encoded URLs should not crash the entire workspace shell.
    return null;
  }
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
  const preferredSlug = String(workObject.metadata?.workspacePageSlug || "").trim().toLowerCase();
  const preferredPage = workspacePageFromSlug(preferredSlug);
  if (preferredPage && preferredPage.family === family && preferredPage.kind === kind) {
    return preferredPage;
  }
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
  if (kind === "video") return workspacePageFromSlug("video");
  if (kind === "audio") return workspacePageFromSlug("audio");
  if (family === "cad_3d") return workspacePageFromSlug("3d");
  if (family === "geospatial") return workspacePageFromSlug("gis");
  if (family === "operations") return workspacePageFromSlug("erp");
  if (family === "project_management") return workspacePageFromSlug("projects");
  if (family === "testing_qa") return workspacePageFromSlug("qa");
  if (family === "web_cms") return workspacePageFromSlug("sites");
  if (family === "integration_api") return workspacePageFromSlug("integrations");
  if (family === "crm_sales") {
    return workspacePageFromSlug("crm");
  }
  if (kind === "workflow") {
    return family === "data_flow"
      ? workspacePageFromSlug("flows")
      : workspacePageFromSlug("automation");
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
