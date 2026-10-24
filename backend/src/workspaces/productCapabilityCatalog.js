// Product delivery claims are deliberately separate from runtime routing.
// A visible page or a passing unit gate never implies commercial parity.
// Review this catalog whenever a workspace, feature or acceptance gate changes.
export const MATURITY_LEVELS = Object.freeze([
  "idea", "declared", "prototype", "functional", "hardened", "production", "parity_targeted"
]);

const reviewDate = "2026-10-24";

function family(maturity, routes = [], code = [], tests = [], nextGap = "") {
  return {
    maturity,
    routes,
    evidence: { code, tests, deployment: null },
    nextGap,
    reviewedAt: reviewDate
  };
}

// All 26 registry families and the two ArtCraft-specific frontend families.
// 'functional' means a useful bounded journey, not a fully finished suite.
export const FAMILY_DELIVERY = Object.freeze({
  document_knowledge: family("functional", ["docs", "pdf", "knowledge", "office-engines"],
    ["frontend/components/workspacePanel.js", "frontend/components/pdfCraftWorkbench.js", "frontend/components/officeSuiteWorkbench.js", "backend/services/office/officeEngines.js"],
    ["backend/scripts/osExportSmoke.mjs", "backend/scripts/osPdfCraftGate.mjs", "backend/scripts/osOfficeEngineGate.mjs"],
    "Complex DOCX/PDF fidelity, unified Drive lifecycle, per-user permissions and tested native binaries"),
  data_spreadsheet: family("functional", ["sheets"],
    ["frontend/components/workspacePanel.js", "frontend/components/spreadsheetDefinitions.js"],
    ["backend/scripts/collaborationFormulaGate.mjs"],
    "Large XLSX, pivot tables, cross-sheet compatibility and formula licensing"),
  analytics_dashboard: family("functional", ["dashboard"],
    ["frontend/components/workspacePanel.js", "frontend/components/flowDashboardView.js"],
    ["backend/scripts/flowDashboardGate.mjs"],
    "Live data connections, visual filters and durable dashboard layouts"),
  development: family("prototype", ["code"],
    ["frontend/components/workspacePanel.js"],
    ["backend/scripts/osEditorWorkbenchGate.mjs"],
    "Isolated terminal, Git, debugger and complete end-to-end developer workflows"),
  app_builder: family("prototype", ["app-builder", "forms"],
    ["frontend/components/workspacePanel.js"],
    ["backend/scripts/osEditorWorkbenchGate.mjs"],
    "Publication, access control, environments, migrations and rollback"),
  canvas_board: family("prototype", ["whiteboard"],
    ["frontend/components/workspaceCanvasPanel.js"],
    ["backend/scripts/osCanvasKeyboardGate.mjs"],
    "Collaborative editing, grouping, resizing and media export corpus"),
  design: family("declared", [], [], [], "Dedicated general-purpose design workflow; FigCraft is catalogued separately"),
  presentation: family("functional", ["slides"],
    ["frontend/components/workspacePanel.js"],
    ["backend/scripts/osExportSmoke.mjs"],
    "PPTX round-trip, master layouts, object animations and fidelity"),
  project_management: family("prototype", ["projects"],
    ["backend/src/work-objects/workObject.service.js", "frontend/components/workspacePanel.js"],
    ["backend/scripts/osSuiteExpansionGate.mjs"], "Kanban, Gantt, dependencies and resource allocation remain to implement"),
  strategy_planning: family("declared", [], [], [], "Dedicated planning objects and end-to-end workflows"),
  data_flow: family("functional", ["flows"],
    ["frontend/components/workspaceFlowManager.js", "backend/routes/flows.js"],
    ["backend/scripts/dataFlowGate.mjs", "backend/scripts/flowSchedulerGate.mjs"],
    "Large datasets, operational recovery, ACL and connected dashboard refresh"),
  workflow_automation: family("prototype", ["automation"],
    ["frontend/components/workspacePanel.js"],
    ["backend/scripts/osWorkspaceWorkflowRoutingGate.mjs"],
    "Production triggers, secret isolation, retries and observability"),
  ai_agent: family("functional", ["chat"],
    ["frontend/components/workspacePanel.js", "backend/routes/hydriaApi.js"],
    ["backend/scripts/osActionConsentGate.mjs", "backend/scripts/hydriaCoreAdapterSmoke.mjs"],
    "Live Core integration, agent benchmarks, quotas and end-user ACL"),
  crm_sales: family("functional", ["crm"],
    ["backend/middleware/crmApiProxy.js", "crm"],
    ["backend/scripts/crmProxyGate.mjs", "backend/scripts/crmCoreIntegrationGate.mjs"],
    "OS identity federation, commercial feature corpus and customer acceptance"),
  operations: family("prototype", ["erp"],
    ["backend/src/work-objects/workObject.service.js", "frontend/components/workspacePanel.js"],
    ["backend/scripts/osSuiteExpansionGate.mjs"], "Currently an editable inventory register; procurement, manufacturing and accounting transactions are not connected"),
  finance: family("declared", [], [], [], "Standalone accounting and finance journeys beyond CRM invoices"),
  hr: family("declared", [], [], [], "Hiring and employee lifecycle with a dedicated user interface"),
  file_storage: family("functional", ["drive"],
    ["frontend/components/hydriaDriveWorkspace.js"],
    ["backend/scripts/osDriveWorkspaceGate.mjs", "backend/scripts/osDriveTrashGate.mjs"],
    "Universal work-object lifecycle, user permissions, sharing and quotas"),
  testing_qa: family("prototype", ["qa"], ["backend/src/work-objects/workObject.service.js"],
    ["backend/scripts/osSuiteExpansionGate.mjs"], "Register exists; test execution and issue lifecycle remain to connect"),
  web_cms: family("prototype", ["sites"], ["backend/src/work-objects/workObject.service.js"],
    ["backend/scripts/osSuiteExpansionGate.mjs"], "Live local preview exists; publication, deployment and rollback not available"),
  media: family("prototype", ["video"], ["frontend/components/mediaTimelineWorkbench.js"],
    ["backend/scripts/osMediaTimelineGate.mjs", "backend/scripts/osSuiteExpansionGate.mjs"], "Storyboard timeline only; no footage import, compositing, generation engine or encoded video export"),
  audio: family("prototype", ["audio"], ["frontend/components/mediaTimelineWorkbench.js"],
    ["backend/scripts/osMediaTimelineGate.mjs", "backend/scripts/osSuiteExpansionGate.mjs"], "Cue timeline only; voice engine, waveform, mixdown and playable output remain"),
  integration_api: family("prototype", ["integrations"], ["backend/src/work-objects/workObject.service.js"],
    ["backend/scripts/osSuiteExpansionGate.mjs"], "Connector diagrams only; no credential vault, signed webhook or executed sync"),
  knowledge_graph: family("declared", [], [], [], "Ontology editor, graph queries and import/export validation"),
  cad_3d: family("prototype", ["3d"], ["frontend/components/spatialStudioWorkbench.js"],
    ["backend/scripts/osSpatialStudioGate.mjs"], "Isometric box viewer only; no mesh editing, parametric CAD or 3D model exports"),
  geospatial: family("prototype", ["gis"], ["frontend/components/spatialStudioWorkbench.js"],
    ["backend/scripts/osSpatialStudioGate.mjs"], "GeoJSON point/map preview only; no basemap, CRS conversion or full GIS toolchain"),
  artcraft_photo: family("prototype", ["photo"],
    ["frontend/components/artCraftWorkspaces.js", "frontend/components/photoCraftProjectLibrary.js"],
    ["backend/scripts/osArtCraftGate.mjs", "backend/scripts/osDrivePhotoProjectsGate.mjs"],
    "WASM target deployment, fidelity corpus and third-party isolation"),
  artcraft_fig: family("prototype", ["fig"],
    ["frontend/components/artCraftWorkspaces.js", "frontend/components/figCraftDriveLibrary.js"],
    ["backend/scripts/osArtCraftGate.mjs", "backend/scripts/osDriveDesignAssetsGate.mjs"],
    "WASM performance, fidelity, multi-user safety and deployment"
  )
});

function capability(id, label, workspaceFamilyId, maturity, suites, nextGap, evidence = {}) {
  return {
    id, label, workspaceFamilyId, maturity, suites,
    evidence: {
      code: evidence.code || [],
      tests: evidence.tests || [],
      deployment: null
    },
    nextGap,
    reviewedAt: reviewDate
  };
}

// Product capabilities rather than competing-brand workspaces. One editor can
// satisfy several suites, but a planned capability is never counted as shipped.
export const PRODUCT_CAPABILITIES = Object.freeze([
  capability("document_editing", "Docs & rich text", "document_knowledge", "functional", ["Microsoft 365", "Google Workspace"],
    "DOCX corpus, pagination and canonical Drive", {code:["frontend/components/workspacePanel.js"], tests:["backend/scripts/osExportSmoke.mjs"]}),
  capability("spreadsheets", "Sheets & formulas", "data_spreadsheet", "functional", ["Microsoft 365", "Google Workspace"],
    "Large spreadsheets and license strategy", {code:["frontend/components/spreadsheetDefinitions.js"], tests:["backend/scripts/collaborationFormulaGate.mjs"]}),
  capability("presentations", "Slides", "presentation", "functional", ["Microsoft 365", "Google Workspace"],
    "PowerPoint fidelity and animations", {code:["frontend/components/workspacePanel.js"], tests:["backend/scripts/osExportSmoke.mjs"]}),
  capability("native_drive", "Hydria Drive", "file_storage", "functional", ["Microsoft 365", "Google Workspace"],
    "Universal ownership, ACL, work-object trash and external backup", {code:["frontend/components/hydriaDriveWorkspace.js"], tests:["backend/scripts/osDriveWorkspaceGate.mjs"]}),
  capability("analytics", "Dashboards & KPIs", "analytics_dashboard", "functional", ["Power BI", "Tableau", "Looker"],
    "Live data and layout/fidelity tests", {code:["frontend/components/flowDashboardView.js"], tests:["backend/scripts/flowDashboardGate.mjs"]}),
  capability("etl", "Flow Manager", "data_flow", "functional", ["KNIME", "Alteryx"],
    "Advanced joins, streaming and role-scoped sources", {code:["frontend/components/workspaceFlowManager.js"], tests:["backend/scripts/dataFlowGate.mjs"]}),
  capability("crm", "Sales & customer records", "crm_sales", "functional", ["Salesforce", "HubSpot"],
    "Unified OS permissions and field acceptance", {code:["crm"], tests:["backend/scripts/crmProxyGate.mjs"]}),
  capability("automations", "Workflow automation", "workflow_automation", "prototype", ["Power Automate", "n8n", "Make"],
    "Triggers, secrets, retries and logs", {code:["frontend/components/workspacePanel.js"], tests:["backend/scripts/osWorkspaceWorkflowRoutingGate.mjs"]}),
  capability("whiteboard", "Whiteboard", "canvas_board", "prototype", ["Miro", "Microsoft Whiteboard"],
    "Interactions and shared document access", {code:["frontend/components/workspaceCanvasPanel.js"], tests:["backend/scripts/osCanvasKeyboardGate.mjs"]}),
  capability("app_building", "App Builder", "app_builder", "prototype", ["Power Apps", "Retool"],
    "Real app deployments and permissioned data models", {code:["frontend/components/workspacePanel.js"], tests:["backend/scripts/osEditorWorkbenchGate.mjs"]}),
  capability("code_editing", "Code Studio", "development", "prototype", ["VS Code", "JetBrains"],
    "Git, terminal, debug and execution isolation", {code:["frontend/components/workspacePanel.js"], tests:["backend/scripts/osEditorWorkbenchGate.mjs"]}),
  capability("ai_chat", "Hydria Chat & assistants", "ai_agent", "functional", ["ChatGPT", "Claude", "Copilot"],
    "Real Core connectivity and full task evaluation", {code:["backend/routes/hydriaApi.js"], tests:["backend/scripts/hydriaCoreAdapterSmoke.mjs"]}),
  capability("photo_editing", "Photo Studio", "artcraft_photo", "prototype", ["Adobe Photoshop", "Affinity Photo"],
    "WASM deployment and layered format fidelity", {code:["frontend/components/artCraftWorkspaces.js"], tests:["backend/scripts/osArtCraftGate.mjs"]}),
  capability("ui_design", "Design Studio", "artcraft_fig", "prototype", ["Figma", "Adobe XD"],
    "Design component fidelity and editor isolation", {code:["frontend/components/figCraftDriveLibrary.js"], tests:["backend/scripts/osArtCraftGate.mjs"]}),
  capability("pdf_editing", "PDF Studio", "document_knowledge", "functional", ["Adobe Acrobat"],
    "Complex PDF corpus and cross-user Drive history", {code:["frontend/components/pdfCraftWorkbench.js"], tests:["backend/scripts/osPdfCraftGate.mjs"]}),
  capability("knowledge", "Knowledge & wiki", "document_knowledge", "idea", ["OneNote", "Loop", "Notion", "Confluence"], "Block/wiki knowledge views and backlinks"),
  capability("projects", "Projects & planning", "project_management", "prototype", ["Microsoft Planner", "Project", "Jira", "ClickUp"], "Workflow planning without Kanban/Gantt or resource management", {code:["backend/src/work-objects/workObject.service.js"], tests:["backend/scripts/osSuiteExpansionGate.mjs"]}),
  capability("forms", "Forms", "app_builder", "prototype", ["Microsoft Forms", "Google Forms"], "Local form preview only, without response collection", {code:["backend/src/work-objects/workObject.service.js"], tests:["backend/scripts/osSuiteExpansionGate.mjs"]}),
  capability("lists_databases", "Lists & databases", "data_spreadsheet", "idea", ["Microsoft Lists", "Airtable"], "Typed linked data collections"),
  capability("mail", "Mail", "integration_api", "idea", ["Outlook", "Gmail"], "Account connectors, drafts and user-scoped access"),
  capability("calendar", "Calendar", "integration_api", "idea", ["Outlook Calendar", "Google Calendar"], "Account connectors, scheduling and ACL"),
  capability("bookings", "Bookings", "integration_api", "idea", ["Microsoft Bookings"], "Availability and appointment flows"),
  capability("team_collaboration", "Team communication", "ai_agent", "idea", ["Microsoft Teams", "Google Meet", "Slack"], "Realtime sessions after multi-user ACL"),
  capability("video_generation", "Text/image-to-video generation", "media", "idea", ["Sora", "Veo", "Runway"], "Evaluate open-weight models and safe compute adapters"),
  capability("video_timeline", "Video editing timeline", "media", "prototype", ["CapCut", "Premiere Pro", "DaVinci Resolve"], "Editorial timeline exists; no media tracks, sync or verified MP4 export", {code:["frontend/components/mediaTimelineWorkbench.js"], tests:["backend/scripts/osMediaTimelineGate.mjs"]}),
  capability("voice_synthesis", "Voice synthesis", "audio", "idea", ["ElevenLabs", "Voice Studio"], "Audible voices, licensing and local/remote engines"),
  capability("audio_timeline", "Audio multitrack studio", "audio", "prototype", ["Audition", "Audacity", "SoundCraft"], "Cue timeline exists; tracks, mixing, effects and lossless export missing", {code:["frontend/components/mediaTimelineWorkbench.js"], tests:["backend/scripts/osMediaTimelineGate.mjs"]}),
  capability("vector_editor", "Vector Studio", "design", "idea", ["Illustrator", "Affinity Designer"], "Vector import/edit/export fidelity"),
  capability("motion_effects", "Motion & compositing", "media", "idea", ["After Effects", "Fusion"], "Keyframes, compositing and render queue"),
  capability("publishing", "Desktop publishing", "design", "idea", ["InDesign", "Publisher"], "Page design and print output"),
  capability("raw_photo", "RAW photography", "artcraft_photo", "idea", ["Lightroom", "Capture One"], "Non-destructive RAW processing"),
  capability("procurement_inventory", "Procurement & stock", "operations", "prototype", ["Odoo", "SAP"], "Editable inventory register only; no supply chain transactions", {code:["backend/src/work-objects/workObject.service.js"], tests:["backend/scripts/osSuiteExpansionGate.mjs"]}),
  capability("accounting", "Accounting & finance", "finance", "idea", ["ERPNext", "Odoo"], "Accounting ledgers and reconciliations"),
  capability("people_ops", "People & HR", "hr", "idea", ["Workday", "SAP SuccessFactors"], "Private employee lifecycle and payroll integrations"),
  capability("cms", "Web publishing", "web_cms", "prototype", ["WordPress", "Webflow"], "Static website source and preview only; no publishing or rollback", {code:["backend/src/work-objects/workObject.service.js"], tests:["backend/scripts/osSuiteExpansionGate.mjs"]}),
  capability("qa_management", "QA management", "testing_qa", "prototype", ["TestRail", "Jira"], "Test register exists; no execution harness or defect lifecycle", {code:["backend/src/work-objects/workObject.service.js"], tests:["backend/scripts/osSuiteExpansionGate.mjs"]}),
  capability("knowledge_graph", "Ontology & graph", "knowledge_graph", "idea", ["Neo4j", "PoolParty"], "Ontology structure, graph queries and validation"),
  capability("cad_3d", "3D & CAD", "cad_3d", "prototype", ["Blender", "AutoCAD"], "Isometric volumes; real CAD operations, model export and performance corpus absent", {code:["frontend/components/spatialStudioWorkbench.js"], tests:["backend/scripts/osSpatialStudioGate.mjs"]}),
  capability("geospatial", "Geospatial studio", "geospatial", "prototype", ["QGIS", "ArcGIS"], "Local GeoJSON preview and point editing; no basemap/CRS tools", {code:["frontend/components/spatialStudioWorkbench.js"], tests:["backend/scripts/osSpatialStudioGate.mjs"]})
]);

export function getWorkspaceDelivery(id) {
  const entry = FAMILY_DELIVERY[id];
  return entry ? structuredClone(entry) : null;
}

export function listProductCapabilityCoverage() {
  return {
    reviewedAt: reviewDate,
    maturityLevels: [...MATURITY_LEVELS],
    warning: "A route or test file is not a deployment or commercial-parity certificate.",
    families: Object.entries(FAMILY_DELIVERY).map(([id, entry]) => ({ id, ...structuredClone(entry) })),
    capabilities: structuredClone(PRODUCT_CAPABILITIES)
  };
}
