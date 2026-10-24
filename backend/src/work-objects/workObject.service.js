import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  getGeneratedArtifactById,
  persistExternalGeneratedArtifact,
  persistGeneratedArtifact
} from "../../services/artifacts/generationStorageService.js";
import { renderGeneratedArtifact } from "../../services/artifacts/generators/generatorRegistry.js";
import { WorkObjectStore } from "./workObject.store.js";
import {
  inferEntryKind,
  inferWorkObjectKind,
  isEditableTextPath,
  normalizeWorkObjectEntry,
  safeWorkObjectSlug
} from "./workObject.types.js";
import {
  buildWorkObjectAssetUrl,
  buildWorkObjectSurfaceModel,
  inferEntrySurfaceType
} from "../workspace/universalSurfaceService.js";
import { resolveWorkspaceFamily } from "../workspaces/workspaceRegistry.js";
import { AppError } from "../../utils/errors.js";
import { atomicWriteFile, readJsonFile } from "../../utils/durableFiles.js";
import { withKeyedLock } from "../../utils/keyedLock.js";
import { invalidExplicitActorId } from "../security/actorScope.js";

const WORK_OBJECT_ROLES = new Set(["viewer", "commenter", "editor"]);
const recoveredCatalogs = new Set();

function normalizeWorkObjectSharing(workObject = {}) {
  const sharing =
    workObject.metadata?.sharing && typeof workObject.metadata.sharing === "object"
      ? workObject.metadata.sharing
      : {};
  return {
    ownerUserId: Number(sharing.ownerUserId || workObject.userId || 0),
    visibility: sharing.visibility === "link" ? "link" : "private",
    defaultRole: WORK_OBJECT_ROLES.has(sharing.defaultRole)
      ? sharing.defaultRole
      : "viewer",
    shareToken: String(sharing.shareToken || ""),
    shares: Array.isArray(sharing.shares)
      ? sharing.shares
          .map((share) => ({
            userId: Number(share?.userId || 0),
            role: WORK_OBJECT_ROLES.has(share?.role) ? share.role : "viewer"
          }))
          .filter((share) => share.userId)
      : []
  };
}

function roleAllows(actualRole = "", requiredRole = "viewer") {
  const rank = { viewer: 1, commenter: 2, editor: 3, owner: 4 };
  return Number(rank[actualRole] || 0) >= Number(rank[requiredRole] || 0);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toRelativePath(filePath = "") {
  return String(filePath || "").replace(/\\/g, "/");
}

function safeResolveWithin(rootPath = "", relativePath = "") {
  const normalized = toRelativePath(relativePath);
  const absolutePath = path.resolve(rootPath, normalized);
  const relativeCheck = path.relative(rootPath, absolutePath);

  if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
    throw new Error("Invalid work object path");
  }

  return absolutePath;
}

function previewContent(content = "", maxChars = 180) {
  return String(content || "").replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function guessContentType(filePath = "") {
  const normalized = filePath.toLowerCase();
  if (normalized.endsWith(".json")) {
    return "application/json";
  }
  if (normalized.endsWith(".geojson")) {
    return "application/geo+json";
  }
  if (normalized.endsWith(".js") || normalized.endsWith(".mjs") || normalized.endsWith(".cjs")) {
    return "text/javascript";
  }
  if (normalized.endsWith(".css")) {
    return "text/css";
  }
  if (normalized.endsWith(".md")) {
    return "text/markdown";
  }
  if (normalized.endsWith(".html")) {
    return "text/html";
  }
  if (normalized.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (normalized.endsWith(".csv")) {
    return "text/csv";
  }
  if (normalized.endsWith(".png")) {
    return "image/png";
  }
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalized.endsWith(".gif")) {
    return "image/gif";
  }
  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }
  if (normalized.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (normalized.endsWith(".wav")) {
    return "audio/wav";
  }
  if (normalized.endsWith(".ogg")) {
    return "audio/ogg";
  }
  return "text/plain";
}

function listWorkspaceEntries(rootPath, currentPath = rootPath, entries = []) {
  if (!rootPath || !fs.existsSync(rootPath)) {
    return entries;
  }

  const diskEntries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const diskEntry of diskEntries) {
    if (["node_modules", ".git"].includes(diskEntry.name)) {
      continue;
    }

    const absolutePath = path.join(currentPath, diskEntry.name);
    const relativePath = toRelativePath(path.relative(rootPath, absolutePath));

    if (diskEntry.isDirectory()) {
      listWorkspaceEntries(rootPath, absolutePath, entries);
      continue;
    }

    const stats = fs.statSync(absolutePath);
    let contentPreview = "";
    if (isEditableTextPath(relativePath)) {
      try {
        contentPreview = previewContent(fs.readFileSync(absolutePath, "utf8"));
      } catch {
        contentPreview = "";
      }
    }

    entries.push(
      normalizeWorkObjectEntry({
        id: relativePath,
        path: relativePath,
        label: relativePath,
        kind: inferEntryKind(relativePath, "project"),
        editable: isEditableTextPath(relativePath),
        primary: false,
        contentType: guessContentType(relativePath),
        preview: contentPreview,
        sizeBytes: stats.size,
        lastModifiedAt: stats.mtime.toISOString()
      })
    );
  }

  return entries;
}

function choosePrimaryEntryPath(entries = [], preferredPaths = []) {
  for (const preferredPath of preferredPaths) {
    const normalized = toRelativePath(preferredPath);
    const match = entries.find((entry) => entry.path === normalized);
    if (match) {
      return match.path;
    }
  }

  return (
    entries.find((entry) => entry.editable && entry.primary)?.path ||
    entries.find((entry) => entry.path === "README.md")?.path ||
    entries.find((entry) => /^(src\/)?(server|app|index)\.(js|ts|mjs|cjs)$/i.test(entry.path))?.path ||
    entries.find((entry) => entry.path === "package.json")?.path ||
    entries.find((entry) => entry.editable)?.path ||
    entries[0]?.path ||
    ""
  );
}

function buildProjectEntries({
  workspacePath = "",
  primaryPaths = []
} = {}) {
  const entries = listWorkspaceEntries(workspacePath).map((entry) => ({
    ...entry,
    kind: inferEntryKind(entry.path, "project")
  }));
  const primaryEntryPath = choosePrimaryEntryPath(entries, primaryPaths);

  return entries.map((entry) => ({
    ...entry,
    primary: entry.path === primaryEntryPath
  }));
}

function summarizeProjectDelivery(project = {}, delivery = null) {
  if (!delivery) {
    return project.globalProject?.summary || `Projet ${project.name || "hydria-project"} pret dans le workspace.`;
  }

  const dimensions = project.dimensions?.length
    ? `dimensions ${project.dimensions.join(", ")}`
    : "";
  const capabilities = project.internalCapabilities?.length
    ? `capacites ${project.internalCapabilities.join(", ")}`
    : "";

  return [
    project.globalProject?.summary || `Projet ${project.name || "hydria-project"} livre.`,
    `install ${delivery.install?.status || "skipped"}`,
    `run ${delivery.run?.status || "skipped"}`,
    `validation ${delivery.validation?.status || "skipped"}`,
    dimensions,
    capabilities
  ].join(" | ");
}

function summarizeGeneratedObject({ title = "", kind = "document", format = "" } = {}) {
  return `Objet ${kind} ${title || "Hydria"} pret a modifier (source ${String(format || "md").toUpperCase()}).`;
}

function buildBlankWorkspaceFiles(kind = "document", title = "Hydria Workspace", workspaceFamilyId = "", workspacePageSlug = "") {
  const safeTitle = String(title || "Hydria Workspace").trim() || "Hydria Workspace";
  const headline = safeTitle.replace(/[#\\n]+/g, "").trim();

  const jsonFile = (primaryPath, model) => ({
    sourceFormat: "json", primaryPath,
    files: [{ path: primaryPath, content: JSON.stringify(model, null, 2) }]
  });

  if (kind === "video" && workspaceFamilyId === "media") {
    return jsonFile("timeline.json", {
      kind: "hydria-video-timeline", version: 1, title: headline,
      resolution: "1920x1080", fps: 30,
      clips: [
        { id: "clip-1", title: "Ouverture", durationSeconds: 5, script: "Présenter le sujet", visual: "Plan d'ouverture", voiceover: "" }
      ]
    });
  }
  if (kind === "audio" && workspaceFamilyId === "audio") {
    return jsonFile("session.json", {
      kind: "hydria-audio-timeline", version: 1, title: headline,
      sampleRate: 48000,
      clips: [
        { id: "clip-1", title: "Introduction", durationSeconds: 6, script: "Texte de la narration", voiceover: "Voix principale" }
      ]
    });
  }
  if (kind === "design" && workspaceFamilyId === "cad_3d") {
    return jsonFile("scene.json", {
      kind: "hydria-cad-scene", version: 1, title: headline, units: "m",
      objects: [{ id: "object-1", type: "box", name: "Volume initial", position: [0, 0, 0], size: [4, 3, 3] }],
      frames: [{ id: "frame-1", name: "Plan de travail", blocks: [{ id: "block-1", label: "Volume initial", x: 90, y: 90, w: 200, h: 130 }] }]
    });
  }
  if (kind === "dataset" && workspaceFamilyId === "geospatial") {
    return jsonFile("features.geojson", {
      type: "FeatureCollection", name: headline, crs: { type: "name", properties: { name: "EPSG:4326" } },
      features: [{ type: "Feature", properties: { name: "Point de départ" }, geometry: { type: "Point", coordinates: [2.3522, 48.8566] } }]
    });
  }
  if (kind === "workflow" && workspaceFamilyId === "project_management") {
    return jsonFile("workflow.json", {
      title: headline, objective: "Organiser les tâches et jalons du projet", trigger: "manual",
      stages: [
        { id: "task-1", label: "À faire", owner: "Équipe", note: "Définir le périmètre" },
        { id: "task-2", label: "En cours", owner: "Équipe", note: "Travaux prioritaires" },
        { id: "task-3", label: "Terminé", owner: "Équipe", note: "Valider les livrables" }
      ],
      links: [{ id: "link-1", from: "task-1", to: "task-2" }, { id: "link-2", from: "task-2", to: "task-3" }],
      automations: []
    });
  }
  if (kind === "workflow" && workspaceFamilyId === "integration_api") {
    return jsonFile("workflow.json", {
      title: headline, objective: "Définir les données et permissions d'une intégration", trigger: "manual",
      stages: [
        { id: "source-1", label: "Source API", owner: "Intégration", note: "Définir endpoint et méthode, sans identifiants en clair" },
        { id: "transform-1", label: "Mapper les champs", owner: "Hydria", note: "Définir le schéma cible" },
        { id: "target-1", label: "Destination", owner: "Hydria", note: "Confirmer avant les écritures externes" }
      ],
      links: [{ id: "link-1", from: "source-1", to: "transform-1" }, { id: "link-2", from: "transform-1", to: "target-1" }],
      automations: []
    });
  }
  if (kind === "project" && workspaceFamilyId === "web_cms") {
    return {
      sourceFormat: "html", primaryPath: "index.html", files: [
        { path: "index.html", content: `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${headline.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title><link rel="stylesheet" href="styles.css"></head><body><main><p>Hydria Sites</p><h1>Votre nouveau site</h1><p>Modifiez ce contenu dans Code Studio puis prévisualisez.</p><a href="#contact">Nous contacter</a><section id="contact"><h2>Contact</h2><p>Personnalisez cette section.</p></section></main></body></html>` },
        { path: "styles.css", content: "body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#f8fafc;color:#111827}main{max-width:900px;margin:10vh auto;padding:32px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.1}a{color:#2563eb}section{margin-top:6rem}" }
      ]
    };
  }
  if (kind === "project" && workspaceFamilyId === "app_builder" && workspacePageSlug === "forms") {
    return {
      sourceFormat: "html", primaryPath: "index.html", files: [
        { path: "index.html", content: `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Formulaire Hydria</title><style>body{font:16px/1.5 system-ui;background:#f7f8fb;color:#1f2937;margin:0;padding:3rem 1rem}form{max-width:520px;margin:auto;background:white;padding:2rem;border:1px solid #e2e8f0;border-radius:12px}label{display:block;margin:1rem 0}input,textarea{display:block;width:100%;box-sizing:border-box;padding:.75rem;border:1px solid #94a3b8;border-radius:6px;font:inherit}button{background:#2563eb;color:white;border:0;padding:.8rem 1.2rem;border-radius:6px}</style></head><body><form><h1>Votre formulaire</h1><p>Aperçu local — réponses non collectées.</p><label>Nom<input name="name" required maxlength="100"></label><label>Message<textarea name="message" required maxlength="2000"></textarea></label><button type="submit">Tester le formulaire</button><output role="status"></output></form><script>document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();document.querySelector('output').textContent='Aperçu validé. Aucune donnée transmise.'})</script></body></html>` }
      ]
    };
  }

  if (kind === "dataset" && ["operations", "testing_qa"].includes(workspaceFamilyId)) {
    const columns = workspaceFamilyId === "operations"
      ? ["Référence", "Article", "Stock", "Seuil", "Emplacement"]
      : ["ID", "Scénario", "Résultat", "Priorité", "Anomalie"];
    const rows = workspaceFamilyId === "operations"
      ? [["SKU-001", "Produit exemple", "25", "10", "Entrepôt A"]]
      : [["QA-001", "Ouverture du workspace", "À tester", "Haute", ""]];
    return jsonFile("table.csv", {
      kind: "hydria-sheet", version: 1, activeSheetId: "sheet-1", namedRanges: [],
      sheets: [{ id: "sheet-1", name: "Registre", columns, rows: [columns, ...rows],
        columnWidths: {}, rowHeights: {}, merges: [], cellFormats: {}, cellNotes: {},
        dataValidations: {}, conditionalFormats: [], tables: [], pivotTables: [],
        charts: [], sparklines: [], slicers: [], filterQuery: "", filterColumnIndex: -1,
        tableFilters: {}, sort: null, hidden: false, protected: false, protectedRanges: [],
        zoomLevel: 1, showGridlines: true, frozenRows: 1, frozenColumns: 0 }]
    });
  }

  if (kind === "dataset") {
    return {
      sourceFormat: "csv",
      primaryPath: "table.csv",
      files: [
        {
          path: "table.csv",
          content: JSON.stringify(
            {
              kind: "hydria-sheet",
              version: 1,
              activeSheetId: "sheet-1",
              namedRanges: [],
              sheets: [
                {
                  id: "sheet-1",
                  name: "Sheet 1",
                  columns: [""],
                  rows: [[""]],
                  columnWidths: {},
                  rowHeights: {},
                  merges: [],
                  cellFormats: {},
                  cellNotes: {},
                  dataValidations: {},
                  conditionalFormats: [],
                  tables: [],
                  pivotTables: [],
                  charts: [],
                  sparklines: [],
                  slicers: [],
                  filterQuery: "",
                  filterColumnIndex: -1,
                  tableFilters: {},
                  sort: null,
                  hidden: false,
                  protected: false,
                  protectedRanges: [],
                  zoomLevel: 1,
                  showGridlines: true,
                  frozenRows: 0,
                  frozenColumns: 0
                }
              ]
            },
            null,
            2
          )
        },
        {
          path: "spec.json",
          content: JSON.stringify(
            {
              title: safeTitle,
              format: "csv",
              documentType: "spreadsheet",
              audience: "workspace user",
              tone: "structured and operational"
            },
            null,
            2
          )
        }
      ]
    };
  }

  if (kind === "presentation") {
    const slideMeta = JSON.stringify({
      layout: "title",
      theme: "product",
      background: "#ffffff",
      transition: "none",
      notes: "Open with the main promise, then let Hydria refine the deck.",
      image: "",
      cta: "Clarify the next action",
      elements: [
        {
          id: "title",
          type: "title",
          text: headline,
          x: 7,
          y: 10,
          w: 80,
          h: 22,
          fontSize: 34,
          bold: true,
          color: "#111827",
          fill: "transparent",
          stroke: "transparent",
          align: "left"
        },
        {
          id: "body",
          type: "text",
          text: "- Main point\n- Key message\n- Next action",
          x: 7,
          y: 40,
          w: 58,
          h: 28,
          fontSize: 22,
          color: "#374151",
          fill: "transparent",
          stroke: "transparent",
          align: "left"
        },
        {
          id: "cta",
          type: "shape",
          shape: "callout",
          text: "Clarify the next action",
          x: 62,
          y: 74,
          w: 30,
          h: 12,
          fontSize: 14,
          bold: true,
          color: "#0f172a",
          fill: "#dbeafe",
          stroke: "#93c5fd",
          align: "center"
        }
      ]
    });
    return {
      sourceFormat: "md",
      primaryPath: "slides.md",
      files: [
        {
          path: "slides.md",
          content:
            `# ${headline}\n\n` +
            `## Slide 1 - ${headline}\n` +
            `<!-- hydria-slide: ${slideMeta} -->\n\n` +
            `- Main point\n- Key message\n- Next action\n`
        }
      ]
    };
  }

  if (kind === "dashboard") {
    return {
      sourceFormat: "json",
      primaryPath: "dashboard.json",
      files: [
        {
          path: "dashboard.json",
          content: JSON.stringify(
            {
              title: headline,
              summary: "Dashboard workspace ready for KPIs, charts and tables.",
              filters: ["This week", "This month"],
              metrics: [
                { label: "Primary KPI", value: "0", delta: "+0%" },
                { label: "Secondary KPI", value: "0", delta: "+0%" }
              ],
              charts: [
                {
                  id: "chart-1",
                  kind: "line",
                  title: "Trend",
                  points: [
                    { label: "Week 1", value: 0 },
                    { label: "Week 2", value: 0 }
                  ]
                }
              ],
              widgets: [],
              table: {
                columns: ["Metric", "Value"],
                rows: [["Primary KPI", "0"]]
              }
            },
            null,
            2
          )
        }
      ]
    };
  }

  if (kind === "workflow" && workspaceFamilyId === "data_flow") {
    return {
      sourceFormat: "json",
      primaryPath: "workflow.json",
      files: [{
        path: "workflow.json",
        content: JSON.stringify({
          kind: "hydria-dataflow",
          version: 1,
          title: headline,
          objective: "Explore, transform and export structured data.",
          trigger: "manual",
          stages: [
            { id: "source-1", type: "input.table", kind: "input.table", label: "Table source", x: 85, y: 180, config: { data: '[{"city":"Paris","sales":10},{"city":"Lyon","sales":7},{"city":"Paris","sales":5}]' } },
            { id: "filter-1", type: "transform.filter", kind: "transform.filter", label: "Row filter", x: 375, y: 180, config: { column: "sales", operator: "gte", value: "7" } },
            { id: "output-1", type: "output.table", kind: "output.table", label: "Table output", x: 690, y: 180, config: {} }
          ],
          links: [
            { id: "link-1", from: "source-1", to: "filter-1", toPort: 0 },
            { id: "link-2", from: "filter-1", to: "output-1", toPort: 0 }
          ]
        }, null, 2)
      }]
    };
  }

  if (kind === "workflow") {
    return {
      sourceFormat: "json",
      primaryPath: "workflow.json",
      files: [
        {
          path: "workflow.json",
          content: JSON.stringify(
            {
              title: headline,
              objective: "Automation flow ready to be defined.",
              trigger: "manual",
              stages: [
                { id: "step-1", label: "Start", owner: "Hydria", note: "Describe the first step." }
              ],
              links: [],
              automations: []
            },
            null,
            2
          )
        }
      ]
    };
  }

  if (kind === "design" && workspaceFamilyId === "canvas_board") {
    return {
      sourceFormat: "json",
      primaryPath: "canvas.json",
      files: [
        {
          path: "canvas.json",
          content: JSON.stringify(
            {
              title: headline,
              brief: "Canvas workspace ready for notes, ideas and quick visual organization.",
              palette: [
                { name: "Warm note", value: "#f6d365" },
                { name: "Mint note", value: "#c7f0d8" },
                { name: "Ink", value: "#1f2937" }
              ],
              components: ["Sticky note", "Text block", "Shape"],
              frames: [
                {
                  id: "frame-1",
                  name: "Main canvas",
                  goal: "Drop ideas, cluster them and shape the next steps.",
                  blocks: [
                    {
                      id: "block-1",
                      label: "Kickoff",
                      body: "Drop the first idea here.",
                      kind: "note",
                      color: "#f6d365",
                      x: 84,
                      y: 88,
                      w: 240,
                      h: 150
                    },
                    {
                      id: "block-2",
                      label: "Next action",
                      body: "Capture the next concrete move.",
                      kind: "text",
                      color: "#c7f0d8",
                      x: 372,
                      y: 136,
                      w: 250,
                      h: 132
                    }
                  ]
                }
              ]
            },
            null,
            2
          )
        }
      ]
    };
  }

  if (kind === "design") {
    return {
      sourceFormat: "json",
      primaryPath: "wireframe.json",
      files: [
        {
          path: "wireframe.json",
          content: JSON.stringify(
            {
              title: headline,
              brief: "Wireframe workspace ready for layout exploration.",
              palette: [
                { name: "Primary", value: "#d5b16a" },
                { name: "Neutral", value: "#f4efe8" }
              ],
              components: ["Header", "Card", "CTA"],
              frames: [
                {
                  id: "frame-1",
                  name: "Main screen",
                  goal: "Define the main layout.",
                  blocks: [
                    { id: "block-1", label: "Hero", x: 60, y: 60, w: 220, h: 60 }
                  ]
                }
              ]
            },
            null,
            2
          )
        }
      ]
    };
  }

  if (kind === "code") {
    return {
      sourceFormat: "js",
      primaryPath: "index.js",
      files: [
        {
          path: "index.js",
          content: `// ${headline}\\n// Start coding here.\\n\\nconsole.log(\"${headline} ready\");\\n`
        }
      ]
    };
  }

  if (kind === "project" && workspaceFamilyId === "crm_sales") {
    const crmConfig = {
      title: headline,
      description: "Original open source sales CRM for leads, accounts, opportunities, quotes and forecasts.",
      theme: "light",
      navigation: ["Dashboard", "Leads", "Contacts", "Companies", "Pipeline", "Products & Quotes", "Tasks", "Reports"],
      api: {
        baseUrl: "/crm-api",
        authentication: "JWT",
        capabilities: ["lead-conversion", "forecasting", "product-catalog", "quotes", "global-search", "reports"]
      },
      pages: [
        { id: "dashboard", title: "Dashboard", blocks: ["metrics", "pipeline", "activity"] },
        { id: "leads", title: "Leads", blocks: ["qualification", "conversion", "activity"] },
        { id: "contacts", title: "Contacts", blocks: ["search", "table", "detail"] },
        { id: "companies", title: "Companies", blocks: ["filters", "table", "detail"] },
        { id: "pipeline", title: "Pipeline", blocks: ["kanban", "forecast", "deal-detail"] },
        { id: "products", title: "Products & Quotes", blocks: ["catalog", "line-items", "quotes"] },
        { id: "tasks", title: "Tasks", blocks: ["queue", "calendar"] },
        { id: "reports", title: "Reports", blocks: ["funnel", "conversion", "owner-forecast"] }
      ]
    };
    return {
      sourceFormat: "json",
      primaryPath: "app.config.json",
      files: [
        {
          path: "app.config.json",
          content: JSON.stringify(crmConfig, null, 2)
        },
        {
          path: "index.html",
          content:
            `<!DOCTYPE html>\n<html lang="fr">\n<head>\n` +
            `  <meta charset="UTF-8" />\n` +
            `  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n` +
            `  <title>${headline}</title>\n` +
            `  <link rel="stylesheet" href="styles.css" />\n` +
            `</head>\n<body>\n` +
            `  <main class="crm-shell">\n` +
            `    <aside><strong>${headline}</strong>${crmConfig.navigation
              .map((item, index) => `<button class="${index === 0 ? "active" : ""}">${item}</button>`)
              .join("")}</aside>\n` +
            `    <section><header><div><small>Sales workspace</small><h1>Dashboard</h1></div><button class="primary">New deal</button></header>` +
            `<div class="metrics"><article><span>Weighted forecast</span><strong>EUR 0</strong></article><article><span>Active leads</span><strong>0</strong></article><article><span>Tasks due</span><strong>0</strong></article></div>` +
            `<div class="board"><article><h2>Pipeline & forecast</h2><p>Qualify leads, move opportunities and track team commitments.</p></article><article><h2>Quotes & activity</h2><p>Products, proposals, notes, calls and updates appear here.</p></article></div>` +
            `</section>\n  </main>\n</body>\n</html>\n`
        },
        {
          path: "styles.css",
          content:
            `*{box-sizing:border-box}body{margin:0;background:#f5f7f6;color:#17211f;font-family:Inter,system-ui,sans-serif}` +
            `.crm-shell{min-height:100vh;display:grid;grid-template-columns:220px 1fr}` +
            `aside{padding:28px 18px;background:#16211f;color:#f7fbfa;display:flex;flex-direction:column;gap:8px}` +
            `aside strong{font-size:20px;margin-bottom:22px}button{border:0;border-radius:6px;padding:11px 12px;background:transparent;color:inherit;text-align:left}` +
            `aside button.active{background:#29413c}.primary{background:#167d68;color:white;padding:11px 16px}` +
            `section{padding:32px}header{display:flex;justify-content:space-between;align-items:center}h1{margin:4px 0 24px}` +
            `.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.metrics article,.board article{padding:20px;background:white;border:1px solid #e1e8e5;border-radius:8px}` +
            `.metrics span{display:block;color:#6a7773}.metrics strong{display:block;margin-top:12px;font-size:26px}.board{display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-top:14px}` +
            `@media(max-width:760px){.crm-shell{grid-template-columns:1fr}aside{display:none}.metrics,.board{grid-template-columns:1fr}section{padding:20px}}`
        },
        {
          path: "README.md",
          content:
            `# ${headline}\n\nThis Hydria workspace is linked to the full React, Express and Prisma implementation in the repository \`crm/\` directory.\n`
        }
      ]
    };
  }

  if (kind === "project") {
    return {
      sourceFormat: "json",
      primaryPath: "app.config.json",
      files: [
        {
          path: "app.config.json",
          content: JSON.stringify(
            {
              title: headline,
              description: "App builder workspace ready for screens and logic.",
              theme: "light",
              pages: [
                { id: "home", title: "Home", blocks: ["hero", "cta"] }
              ]
            },
            null,
            2
          )
        },
        {
          path: "index.html",
          content: `<!DOCTYPE html>\\n<html>\\n<head>\\n  <meta charset=\\"UTF-8\\" />\\n  <meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1.0\\" />\\n  <title>${headline}</title>\\n  <link rel=\\"stylesheet\\" href=\\"styles.css\\" />\\n</head>\\n<body>\\n  <main class=\\"app-shell\\">\\n    <h1>${headline}</h1>\\n    <p>Start shaping the app here.</p>\\n  </main>\\n</body>\\n</html>\\n`
        },
        {
          path: "styles.css",
          content: "body{font-family:system-ui, sans-serif; padding:40px; background:#f5f2ed; color:#1f2937;}\\n.app-shell{max-width:720px; margin:0 auto; background:#fff; border-radius:16px; padding:32px; box-shadow:0 18px 40px rgba(0,0,0,0.08);}\\n"
        }
      ]
    };
  }

  if (workspaceFamilyId === "document_knowledge") {
    return {
      sourceFormat: "html",
      primaryPath: "document.html",
      files: [
        {
          path: "document.html",
          content:
            `<h1>document</h1>\n` +
            `<p>Start writing here.</p>\n` +
            `<p>Add sections, tables, images, or project assets.</p>\n`
        }
      ]
    };
  }

  return {
    sourceFormat: "md",
    primaryPath: "document.md",
    files: [
      {
        path: "document.md",
        content: `# ${headline}\\n\\nStart writing here.\\n`
      }
    ]
  };
}

function buildImprovementAnswer({ workObject = null, entryPath = "", prompt = "" } = {}) {
  const title = workObject?.title || "l'objet";
  const kind = String(workObject?.kind || workObject?.objectKind || "document").toLowerCase();
  const target = entryPath || workObject?.activeEntryPath || workObject?.primaryFile || "";

  if (kind === "project") {
    return [
      `J'ai mis a jour ${title}.`,
      target ? `- fichier modifie -> ${target}` : "",
      "- le projet courant reste ouvert et pret pour la suite."
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (kind === "presentation") {
    return [
      `J'ai mis a jour ${title}.`,
      target ? `- slide source modifiee -> ${target}` : "",
      "- la presentation reste sur le meme objet et peut encore etre enrichie."
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (kind === "dataset") {
    return [
      `J'ai mis a jour ${title}.`,
      target ? `- table modifiee -> ${target}` : "",
      "- la grille reste editable sur le meme objet."
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (["dashboard", "workflow", "design", "benchmark", "campaign", "audio", "video", "image"].includes(kind)) {
    const noun =
      kind === "dashboard"
        ? "surface"
        : kind === "workflow"
          ? "workflow"
          : kind === "design"
            ? "wireframe"
            : kind === "benchmark"
              ? "benchmark"
              : kind === "campaign"
                ? "campaign"
                : kind === "audio"
                  ? "audio brief"
                  : kind === "video"
                    ? "video brief"
                    : "visual";
    return [
      `J'ai mis a jour ${title}.`,
      target ? `- source modifiee -> ${target}` : "",
      `- le meme ${noun} reste actif et pret a etre ajuste.`
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `J'ai mis a jour ${title}.`,
    target ? `- contenu modifie -> ${target}` : "",
    "- le meme objet reste actif pour la suite."
  ]
    .filter(Boolean)
    .join("\n");
}

function inferEffectiveWorkObjectKind(workObject = {}) {
  const storedKind = workObject.kind || workObject.objectKind || "document";
  const activePath =
    workObject.activeEntryPath ||
    workObject.primaryFile ||
    workObject.entries?.find((entry) => entry.primary)?.path ||
    workObject.entries?.[0]?.path ||
    "";
  const normalizedPath = String(activePath || "").replace(/\\/g, "/").toLowerCase();

  if (normalizedPath.endsWith("dashboard.json")) {
    return "dashboard";
  }
  if (normalizedPath.endsWith("benchmark.json")) {
    return "benchmark";
  }
  if (normalizedPath.endsWith("campaign.json")) {
    return "campaign";
  }
  if (normalizedPath.endsWith("workflow.json")) {
    return "workflow";
  }
  if (normalizedPath.endsWith("wireframe.json")) {
    return "design";
  }
  if (normalizedPath.endsWith("audio.json")) {
    return "audio";
  }
  if (normalizedPath.endsWith("video.json")) {
    return "video";
  }
  if (normalizedPath.endsWith("image-brief.md") || normalizedPath.endsWith("preview.svg")) {
    return "image";
  }

  return storedKind;
}

function deriveWorkspaceFamilyRecord({
  prompt = "",
  kind = "",
  entryPath = "",
  environmentPlan = null,
  metadata = {}
} = {}) {
  const workspaceFamily = resolveWorkspaceFamily({
    prompt,
    shape: environmentPlan?.requestedShape || "",
    objectKind: kind,
    entryPath,
    workspaceFamilyId:
      environmentPlan?.workspaceFamilyId ||
      metadata?.workspaceFamilyId ||
      ""
  });

  return {
    workspaceFamilyId: workspaceFamily?.id || "",
    workspaceFamilyLabel: workspaceFamily?.label || "",
    workspaceFamilyDescription: workspaceFamily?.description || ""
  };
}

function isPreviewableGeneratedAsset(artifact = {}) {
  const mimeType = String(artifact?.mimeType || "").toLowerCase();
  const format = String(artifact?.format || "").toLowerCase();
  const extension = String(artifact?.extension || "").toLowerCase();
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("video/") ||
    ["image", "svg", "png", "jpg", "jpeg", "webp", "gif", "mp3", "wav", "ogg", "mp4", "webm", "mov"].includes(
      format
    ) ||
    ["svg", "png", "jpg", "jpeg", "webp", "gif", "mp3", "wav", "ogg", "mp4", "webm", "mov"].includes(
      extension
    )
  );
}

function buildPreviewAssetFilename(artifact = {}) {
  const extension = String(artifact?.extension || artifact?.format || "")
    .replace(/^\.+/, "")
    .trim()
    .toLowerCase();
  return extension ? `preview.${extension}` : "";
}

function compactWorkObject(workObject = {}, contentPayload = null) {
  const effectiveKind = inferEffectiveWorkObjectKind(workObject);
  const clientEntries = (workObject.entries || []).map((entry) => ({
    ...entry,
    surfaceType: inferEntrySurfaceType(
      entry.path,
      entry.contentType,
      effectiveKind
    ),
    assetUrl: buildWorkObjectAssetUrl(workObject.id, entry.path),
    previewable: Boolean(entry.path)
  }));
  const activeEntry =
    clientEntries.find((entry) => entry.path === workObject.activeEntryPath) ||
    clientEntries.find((entry) => entry.primary) ||
    null;
  const editableFiles = clientEntries
    .filter((entry) => entry.editable)
    .map((entry) => entry.path);
  const workspaceFamily = deriveWorkspaceFamilyRecord({
    prompt: workObject.metadata?.prompt || "",
    kind: effectiveKind,
    entryPath: activeEntry?.path || workObject.activeEntryPath || "",
    environmentPlan: workObject.metadata?.environmentPlan || null,
    metadata: workObject.metadata || {}
  });
  const surfaceModel = buildWorkObjectSurfaceModel({
    workObject: {
      ...workObject,
      kind: effectiveKind,
      entries: clientEntries
    },
    entryPath: contentPayload?.entryPath || activeEntry?.path || workObject.activeEntryPath
  });

  return {
    ...workObject,
    kind: effectiveKind,
    entries: clientEntries,
    type: effectiveKind,
    objectKind: effectiveKind,
    primaryFile: activeEntry?.path || "",
    primaryEntry: activeEntry,
    editableFiles,
    links: workObject.links || {},
    nextActionHint:
      workObject.metadata?.nextCommand ||
      (effectiveKind === "dataset"
        ? "Open the table and edit rows or columns directly."
        : effectiveKind === "presentation"
          ? "Open the deck and refine the slides."
          : effectiveKind === "dashboard"
            ? "Open the dashboard and refine the metrics, charts or table."
            : effectiveKind === "benchmark"
              ? "Open the benchmark and refine the competitor set, criteria or recommendations."
              : effectiveKind === "campaign"
                ? "Open the campaign and refine the channels, assets or launch sequence."
            : effectiveKind === "workflow"
              ? "Open the workflow and adjust the trigger, steps or automation rules."
              : effectiveKind === "design"
                ? "Open the design surface and refine the frames, components or style tokens."
                : effectiveKind === "audio"
                  ? "Open the audio brief and refine the script, cues or delivery variants."
                  : effectiveKind === "video"
                    ? "Open the video brief and refine the scenes, storyboard or narration."
                    : effectiveKind === "image"
                      ? "Open the visual asset and refine the brief or generated preview."
          : effectiveKind === "project" && surfaceModel?.defaultSurface === "live"
            ? "Open the live preview and keep shaping the app."
            : editableFiles.length
              ? `Modifiez ${editableFiles[0]} puis demandez a Hydria de l'ameliorer.`
              : ""),
    projectDimensions: workObject.metadata?.projectDimensions || [],
    internalCapabilities: workObject.metadata?.internalCapabilities || [],
    globalProject: workObject.metadata?.globalProject || null,
    intentProfile: workObject.metadata?.intentProfile || null,
    environmentPlan: workObject.metadata?.environmentPlan || null,
    environmentSimulation: workObject.metadata?.environmentSimulation || null,
    businessSimulation: workObject.metadata?.businessSimulation || null,
    productPlanSimulation: workObject.metadata?.productPlanSimulation || null,
    impactSimulation: workObject.metadata?.impactSimulation || null,
    usageScenarioSimulation: workObject.metadata?.usageScenarioSimulation || null,
    previewAssetPath: workObject.metadata?.previewAssetPath || "",
    previewAssetUrl: workObject.metadata?.previewAssetPath
      ? buildWorkObjectAssetUrl(workObject.id, workObject.metadata.previewAssetPath)
      : "",
    workspaceFamilyId: workspaceFamily.workspaceFamilyId,
    workspaceFamilyLabel: workspaceFamily.workspaceFamilyLabel,
    workspaceFamilyDescription: workspaceFamily.workspaceFamilyDescription,
    defaultSurface: surfaceModel?.defaultSurface || null,
    availableSurfaces: surfaceModel?.availableSurfaces || [],
    surfaceModel,
    file: contentPayload
      ? {
          path: contentPayload.entryPath,
          content: contentPayload.content
        }
      : null
  };
}

export class WorkObjectService {
  constructor({
    filePath,
    storeFilePath,
    rootDir,
    brainProvider = null,
    artifactExporter = null,
    projectStore = null
  }) {
    this.store = new WorkObjectStore({
      filePath: filePath || storeFilePath
    });
    this.rootDir = rootDir;
    this.brainProvider = brainProvider;
    this.artifactExporter = artifactExporter;
    this.projectStore = projectStore;
    this.presence = new Map();
    ensureDirectory(rootDir);
    const catalogKey = path.resolve(this.store.filePath);
    if (!recoveredCatalogs.has(catalogKey)) {
      // A crash between the source rename and catalog commit is recoverable.
      for (const object of this.store.readState().items) {
        if (!object.workspacePath) continue;
        const journalPath = path.join(object.workspacePath, ".hydria-pending-save.json");
        if (!fs.existsSync(journalPath)) continue;
        const journal = readJsonFile(journalPath);
        if (typeof journal.entryPath !== "string" || typeof journal.previousContent !== "string" ||
            typeof journal.historyId !== "string") throw new AppError("Invalid save journal; restore a verified backup", 503);
        if (!(object.history || []).some(entry => entry.id === journal.historyId)) {
          atomicWriteFile(safeResolveWithin(object.workspacePath, journal.entryPath), journal.previousContent);
        }
        fs.rmSync(journalPath);
      }
      recoveredCatalogs.add(catalogKey);
    }
  }

  list(options = {}) {
    return this.listForConversation(options);
  }

  listForConversation({ userId = null, conversationId = null, limit = 30 } = {}) {
    if (invalidExplicitActorId(userId)) return [];
    return this.store
      .readState()
      .items
      .filter((item) => {
        if (userId == null) {
          return true;
        }
        const access = this.resolveAccess(item, { actorUserId: userId });
        return access.allowed;
      })
      .filter((item) =>
        conversationId ? Number(item.conversationId) === Number(conversationId) : true
      )
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      .slice(0, limit)
      .map((item) => compactWorkObject(item));
  }

  resolveAccess(workObject, { actorUserId = null, shareToken = "" } = {}) {
    if (!workObject) {
      return { allowed: false, role: "" };
    }
    const sharing = normalizeWorkObjectSharing(workObject);
    if (actorUserId && Number(sharing.ownerUserId) === Number(actorUserId)) {
      return { allowed: true, role: "owner" };
    }
    const directShare = sharing.shares.find(
      (share) => actorUserId && Number(share.userId) === Number(actorUserId)
    );
    if (directShare) {
      return { allowed: true, role: directShare.role };
    }
    if (
      sharing.visibility === "link" &&
      shareToken &&
      sharing.shareToken &&
      sharing.shareToken === String(shareToken)
    ) {
      return { allowed: true, role: sharing.defaultRole };
    }
    return { allowed: !actorUserId && !shareToken, role: "owner" };
  }

  assertAccess(workObject, access = {}, requiredRole = "viewer") {
    const resolved = this.resolveAccess(workObject, access);
    if (!resolved.allowed || !roleAllows(resolved.role, requiredRole)) {
      throw new AppError("You do not have permission for this work object", 403, {
        requiredRole,
        actualRole: resolved.role || null
      });
    }
    return resolved;
  }

  listForProject({ projectId = "", userId = null, limit = 50 } = {}) {
    if (!projectId) {
      return [];
    }
    // Never retry a user-scoped lookup as an unrestricted query: that leaks
    // private project documents when the caller owns no object in the project.
    if (invalidExplicitActorId(userId)) return [];
    return this.store
      .list({ projectId, userId: null, limit: Number.MAX_SAFE_INTEGER })
      .filter((item) => userId == null || this.resolveAccess(item, { actorUserId: userId }).allowed)
      .slice(0, limit)
      .map((item) => compactWorkObject(item));
  }

  createBlankWorkObject({
    kind = "document",
    title = "",
    userId = null,
    conversationId = null,
    projectId = "",
    workspaceFamilyId = "",
    metadata = {}
  } = {}) {
    const objectId = this.store.createId();
    const safeTitle = title || `New ${kind}`;
    const slug = `${safeWorkObjectSlug(safeTitle)}-${objectId.slice(0, 8)}`;
    const workspacePath = path.join(this.rootDir, slug);
    ensureDirectory(workspacePath);

    const { files, primaryPath, sourceFormat } = buildBlankWorkspaceFiles(
      kind,
      safeTitle,
      workspaceFamilyId,
      metadata?.workspacePageSlug || ""
    );
    files.forEach((file) => {
      const targetPath = safeResolveWithin(workspacePath, file.path);
      ensureDirectory(path.dirname(targetPath));
      fs.writeFileSync(targetPath, String(file.content || ""), "utf8");
    });

    const entries = listWorkspaceEntries(workspacePath).map((entry) => ({
      ...entry,
      kind: inferEntryKind(entry.path, kind)
    }));
    const primaryEntryPath = choosePrimaryEntryPath(entries, [primaryPath]);
    const normalizedEntries = entries.map((entry) => ({
      ...entry,
      primary: entry.path === primaryEntryPath
    }));

    const workObject = this.store.save({
      id: objectId,
      userId: Number(userId || 0),
      conversationId: Number(conversationId || 0),
      projectId: String(projectId || ""),
      title: safeTitle,
      kind,
      status: "ready",
      workspacePath,
      sourcePath: path.join(workspacePath, primaryEntryPath || primaryPath || ""),
      sourceFormat,
      entries: normalizedEntries,
      activeEntryPath: primaryEntryPath || primaryPath || "",
      metadata: {
        ...(metadata && typeof metadata === "object" ? metadata : {}),
        sharing: {
          ownerUserId: Number(userId || 0),
          visibility: "private",
          defaultRole: "viewer",
          shareToken: "",
          shares: []
        },
        workspaceFamilyId:
          workspaceFamilyId ||
          (metadata && typeof metadata === "object" ? metadata.workspaceFamilyId : "") ||
          ""
      },
      summary: summarizeGeneratedObject({ title: safeTitle, kind, format: sourceFormat })
    });

    return compactWorkObject(workObject);
  }

  listByProject({
    projectId = "",
    userId = null,
    conversationId = null,
    limit = 100
  } = {}) {
    const normalizedProjectId = String(projectId || "").trim();
    if (!normalizedProjectId) {
      return [];
    }

    return this.store
      .readState()
      .items.filter((item) => (userId ? Number(item.userId) === Number(userId) : true))
      .filter((item) =>
        conversationId ? Number(item.conversationId) === Number(conversationId) : true
      )
      .filter(
        (item) =>
          item.projectId === normalizedProjectId ||
          item.links?.projectId === normalizedProjectId ||
          item.id === normalizedProjectId
      )
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      .slice(0, limit)
      .map((item) => compactWorkObject(item));
  }

  get(workObjectId, { includeContent = false, entryPath = "", actorUserId } = {}) {
    // An explicitly scoped lookup must never fall back to the private-pilot
    // unscoped access path, including for null, zero and malformed IDs.
    if (actorUserId !== undefined && (actorUserId == null || invalidExplicitActorId(actorUserId))) {
      throw new AppError("Invalid verified actor identity", 403);
    }
    const workObject = this.store.get(String(workObjectId || ""));
    if (!workObject) {
      return null;
    }

    if (actorUserId !== undefined) {
      this.assertAccess(workObject, { actorUserId }, "viewer");
    }

    if (!includeContent && !entryPath) {
      return compactWorkObject(workObject);
    }

    const contentPayload = this.readContent({
      workObjectId: workObject.id,
      entryPath: entryPath || workObject.activeEntryPath
    });

    return compactWorkObject(contentPayload.workObject, contentPayload);
  }

  getSharedByToken(shareToken = "", { includeContent = false, entryPath = "" } = {}) {
    const token = String(shareToken || "").trim();
    if (!token) {
      return null;
    }
    const workObject =
      this.store
        .readState()
        .items.find(
          (item) =>
            normalizeWorkObjectSharing(item).visibility === "link" &&
            normalizeWorkObjectSharing(item).shareToken === token
        ) || null;
    if (!workObject) {
      return null;
    }
    return this.get(workObject.id, { includeContent, entryPath });
  }

  searchContent({ userId = null, query = "", kind = "", limit = 30 } = {}) {
    if (invalidExplicitActorId(userId)) return [];
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) {
      return [];
    }

    const results = [];
    for (const workObject of this.store.readState().items) {
      if (kind && workObject.kind !== kind) {
        continue;
      }
      if (!this.resolveAccess(workObject, { actorUserId: userId }).allowed) {
        continue;
      }
      if (workObject.status === "trashed") {
        continue;
      }

      const titleHaystack = [workObject.title, workObject.summary, ...(workObject.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (titleHaystack.includes(needle)) {
        results.push({
          ...compactWorkObject(workObject),
          match: { entryPath: "", snippet: previewContent(workObject.summary || workObject.title, 220) }
        });
      }

      for (const entry of workObject.entries || []) {
        if (results.length >= limit || !entry.editable) {
          break;
        }
        try {
          const absolutePath = safeResolveWithin(workObject.workspacePath, entry.path);
          const content = fs.readFileSync(absolutePath, "utf8");
          const index = content.toLowerCase().indexOf(needle);
          if (index < 0) {
            continue;
          }
          const start = Math.max(0, index - 80);
          results.push({
            ...compactWorkObject(workObject),
            match: {
              entryPath: entry.path,
              snippet: content.slice(start, start + 260).replace(/\s+/g, " ").trim()
            }
          });
        } catch {
          // Ignore unreadable entries and continue searching the library.
        }
      }
      if (results.length >= limit) {
        break;
      }
    }

    const seen = new Set();
    return results
      .filter((result) => {
        const key = `${result.id}:${result.match.entryPath}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);
  }

  updateSharing({
    workObjectId = "",
    actorUserId = null,
    visibility,
    defaultRole,
    shares
  } = {}) {
    const current = this.store.get(String(workObjectId || ""));
    if (!current) {
      return null;
    }
    this.assertAccess(current, { actorUserId }, "owner");
    const existing = normalizeWorkObjectSharing(current);
    const nextVisibility = visibility === "link" ? "link" : "private";
    const nextRole = WORK_OBJECT_ROLES.has(defaultRole) ? defaultRole : existing.defaultRole;
    const nextShares = Array.isArray(shares)
      ? shares
          .map((share) => ({
            userId: Number(share?.userId || 0),
            role: WORK_OBJECT_ROLES.has(share?.role) ? share.role : "viewer"
          }))
          .filter((share) => share.userId && share.userId !== existing.ownerUserId)
      : existing.shares;
    const sharing = {
      ...existing,
      visibility: nextVisibility,
      defaultRole: nextRole,
      shareToken:
        nextVisibility === "link" ? existing.shareToken || randomUUID() : existing.shareToken,
      shares: nextShares
    };
    const updated = this.store.update(current.id, (workObject) => ({
      ...workObject,
      metadata: { ...(workObject.metadata || {}), sharing },
      revision: Number(workObject.revision || 1) + 1,
      history: [
        ...(workObject.history || []),
        {
          type: "sharing_update",
          at: new Date().toISOString(),
          actor: `user:${actorUserId || "unknown"}`,
          visibility: sharing.visibility,
          defaultRole: sharing.defaultRole
        }
      ].slice(-25)
    }));
    return compactWorkObject(updated);
  }

  trash({ workObjectId = "", actorUserId = null, expectedRevision } = {}) {
    const current = this.store.get(String(workObjectId || ""));
    if (!current) return null;
    this.assertAccess(current, { actorUserId }, "editor");
    if (current.status === "trashed") {
      throw new AppError("Work object is already in the trash", 409);
    }
    return this.updateMetadata({
      workObjectId: current.id,
      status: "trashed",
      metadata: { trashedAt: new Date().toISOString(), previousStatus: current.status },
      actor: `user:${actorUserId || "unknown"}`,
      actorUserId: actorUserId ?? undefined,
      expectedRevision
    });
  }

  restoreFromTrash({ workObjectId = "", actorUserId = null, expectedRevision } = {}) {
    const current = this.store.get(String(workObjectId || ""));
    if (!current) return null;
    this.assertAccess(current, { actorUserId }, "editor");
    if (current.status !== "trashed") {
      throw new AppError("Work object is not in the trash", 409);
    }
    return this.updateMetadata({
      workObjectId: current.id,
      status: current.metadata?.previousStatus || "ready",
      metadata: { trashedAt: null },
      actor: `user:${actorUserId || "unknown"}`,
      actorUserId: actorUserId ?? undefined,
      expectedRevision
    });
  }

  deletePermanently({ workObjectId = "", actorUserId = null } = {}) {
    const current = this.store.get(String(workObjectId || ""));
    if (!current) return null;
    this.assertAccess(current, { actorUserId }, "owner");
    if (current.status !== "trashed") {
      throw new AppError("Move the work object to trash before deleting it permanently", 409);
    }
    const absoluteRoot = path.resolve(this.rootDir);
    const absoluteWorkspace = path.resolve(current.workspacePath);
    const relative = path.relative(absoluteRoot, absoluteWorkspace);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !relative) {
      throw new AppError("Invalid work object workspace path", 400);
    }
    fs.rmSync(absoluteWorkspace, { recursive: true, force: true });
    this.presence.delete(current.id);
    return compactWorkObject(this.store.delete(current.id));
  }

  updateAnnotations({
    workObjectId = "",
    actorUserId = null,
    shareToken = "",
    annotations = []
  } = {}) {
    const current = this.store.get(String(workObjectId || ""));
    if (!current) return null;
    this.assertAccess(current, { actorUserId, shareToken }, "commenter");
    const normalized = Array.isArray(annotations)
      ? annotations.slice(-250).map((annotation) => ({
          ...annotation,
          id: String(annotation?.id || randomUUID()),
          type: ["comment", "suggestion"].includes(annotation?.type)
            ? annotation.type
            : "comment",
          authorUserId: Number(annotation?.authorUserId || actorUserId || 0),
          updatedAt: new Date().toISOString()
        }))
      : [];
    return this.updateMetadata({
      workObjectId: current.id,
      metadata: { annotations: normalized },
      actor: `user:${actorUserId || "unknown"}`
    });
  }

  touchPresence({
    workObjectId = "",
    actorUserId = null,
    name = "",
    entryPath = "",
    cursor = null
  } = {}) {
    const current = this.store.get(String(workObjectId || ""));
    if (!current) return null;
    this.assertAccess(current, { actorUserId }, "viewer");
    const now = Date.now();
    const entries = this.presence.get(current.id) || new Map();
    entries.set(String(actorUserId || "anonymous"), {
      userId: Number(actorUserId || 0),
      name: String(name || `User ${actorUserId || ""}`).trim(),
      entryPath: toRelativePath(entryPath),
      cursor: cursor && typeof cursor === "object" ? cursor : null,
      lastSeenAt: new Date(now).toISOString()
    });
    this.presence.set(current.id, entries);
    return this.listPresence(current.id);
  }

  listPresence(workObjectId = "") {
    const cutoff = Date.now() - 30_000;
    const entries = this.presence.get(String(workObjectId || "")) || new Map();
    for (const [key, presence] of entries.entries()) {
      if (new Date(presence.lastSeenAt).getTime() < cutoff) {
        entries.delete(key);
      }
    }
    return [...entries.values()];
  }

  leavePresence({ workObjectId = "", actorUserId = null } = {}) {
    const entries = this.presence.get(String(workObjectId || ""));
    entries?.delete(String(actorUserId || "anonymous"));
    return this.listPresence(workObjectId);
  }

  updateMetadata({
    workObjectId = "",
    title = "",
    status = "",
    metadata = null,
    actor = "user",
    actorUserId,
    expectedRevision
  } = {}) {
    const current = this.store.get(String(workObjectId || ""));
    if (!current) {
      return null;
    }

    if (actorUserId !== undefined) {
      if (actorUserId == null || invalidExplicitActorId(actorUserId)) {
        throw new AppError("Invalid verified actor identity", 403);
      }
      this.assertAccess(current, { actorUserId }, "editor");
    }
    if (expectedRevision !== undefined && Number(expectedRevision) !== Number(current.revision || 1)) {
      throw new AppError("Work object changed; reload before editing", 409, {
        currentRevision: Number(current.revision || 1)
      });
    }

    const nextTitle = String(title ?? current.title ?? "").trim() || current.title || "Untitled";
    const nextStatus = String(status || current.status || "ready").trim() || "ready";
    const updated = this.store.update(current.id, (workObject) => ({
      ...workObject,
      title: nextTitle,
      status: nextStatus,
      metadata: {
        ...(workObject.metadata || {}),
        ...(metadata && typeof metadata === "object" ? metadata : {})
      },
      revision: Number(workObject.revision || 1) + 1,
      history: [
        ...(workObject.history || []),
        {
          type: "metadata_update",
          at: new Date().toISOString(),
          actor,
          title: nextTitle,
          metadata:
            metadata && typeof metadata === "object"
              ? metadata
              : undefined
        }
      ].slice(-25)
    }));

    return compactWorkObject(updated);
  }

  buildContext(workObject = null, entryPath = "") {
    if (!workObject) {
      return "";
    }

    const selectedPath =
      entryPath || workObject.selectedPath || workObject.activeEntryPath || "";
    const stored = this.store.get(workObject.id) || workObject;
    const targetPath =
      selectedPath ||
      stored.activeEntryPath ||
      stored.entries.find((entry) => entry.primary)?.path ||
      "";
    let excerpt = "";

    if (targetPath) {
      try {
        excerpt = this.readContent({
          workObjectId: stored.id,
          entryPath: targetPath
        }).content.slice(0, 2400);
      } catch {
        excerpt = "";
      }
    }

    return [
      `Active work object: ${stored.title} (${stored.kind})`,
      targetPath ? `Selected entry: ${targetPath}` : "",
      stored.summary ? `Summary: ${stored.summary}` : "",
      excerpt ? `Current content excerpt:\n${excerpt}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  getPrimaryContent(workObject = null, entryPath = "") {
    if (!workObject) {
      return "";
    }

    const stored = this.store.get(workObject.id) || workObject;
    const targetPath =
      entryPath ||
      workObject.selectedPath ||
      stored.activeEntryPath ||
      stored.entries.find((entry) => entry.primary)?.path ||
      stored.entries.find((entry) => entry.editable)?.path ||
      "";

    if (!targetPath) {
      return "";
    }

    try {
      return this.readContent({
        workObjectId: stored.id,
        entryPath: targetPath
      }).content;
    } catch {
      return "";
    }
  }

  async materializeGeneratedPreviewAsset({
    objectRoot = "",
    artifactId = "",
    kind = "document",
    entries = []
  } = {}) {
    if (!objectRoot || !artifactId) {
      return {
        entries,
        previewAssetPath: ""
      };
    }

    const generatedArtifact = await getGeneratedArtifactById(artifactId);
    if (!generatedArtifact || !isPreviewableGeneratedAsset(generatedArtifact)) {
      return {
        entries,
        previewAssetPath: ""
      };
    }

    const previewFilename = buildPreviewAssetFilename(generatedArtifact);
    if (!previewFilename) {
      return {
        entries,
        previewAssetPath: ""
      };
    }

    const absolutePreviewPath = path.join(objectRoot, previewFilename);
    fs.copyFileSync(generatedArtifact.absolutePath, absolutePreviewPath);
    const stats = fs.statSync(absolutePreviewPath);
    const entryKind =
      kind === "image" || kind === "audio" || kind === "video"
        ? kind
        : inferEntryKind(previewFilename, kind);

    const nextEntries = [
      ...entries.filter((entry) => entry.path !== previewFilename),
      normalizeWorkObjectEntry({
        id: previewFilename,
        path: previewFilename,
        label: previewFilename,
        kind: entryKind,
        editable: false,
        primary: false,
        contentType: guessContentType(previewFilename),
        preview: previewFilename,
        sizeBytes: stats.size,
        lastModifiedAt: stats.mtime.toISOString()
      })
    ];

    return {
      entries: nextEntries,
      previewAssetPath: previewFilename
    };
  }

  registerProjectDelivery({
    userId,
    conversationId,
    project,
    delivery = null,
    prompt = "",
    sourceWorkObjectId = "",
    intentProfile = null,
    environmentPlan = null,
    environmentSimulation = null,
    businessSimulation = null,
    productPlanSimulation = null
    ,
    impactSimulation = null,
    usageScenarioSimulation = null
  } = {}) {
    if (!project?.id || !project.workspacePath) {
      return null;
    }

    const existing = this.store
      .list({ userId, conversationId, limit: 100 })
      .find((item) => item.projectId === project.id);
    const preferredMainFiles = (delivery?.mainFiles || []).filter(
      (filePath) => !/^\.env/i.test(String(filePath || ""))
    );
    const isGlobalProjectShell =
      project.globalProject?.projectMode === "global_project" &&
      !preferredMainFiles.some((filePath) => /(^|\/)app\.config\.json$/i.test(String(filePath || "")));
    const primaryPaths = [
      ...(isGlobalProjectShell
        ? [
            "experience/overview.md",
            "experience/project-map.md",
            "content/project-brief.md",
            "project.blueprint.json",
            "README.md"
          ]
        : [
            "app.config.json",
            "index.html",
            "public/index.html",
            "dist/index.html",
            "README.md",
            "project.blueprint.json",
            "experience/overview.md"
          ]),
      "studio/creative-brief.md",
      "audio/audio-brief.md",
      "src/server.js",
      "src/app.js",
      "src/index.js",
      "package.json",
      "hydria.manifest.json",
      ...preferredMainFiles
    ];
    const entries = buildProjectEntries({
      workspacePath: project.workspacePath,
      primaryPaths
    });
    const activeEntryPath = choosePrimaryEntryPath(entries, primaryPaths);
    const workspaceFamily = deriveWorkspaceFamilyRecord({
      prompt,
      kind: "project",
      entryPath: activeEntryPath,
      environmentPlan,
      metadata: existing?.metadata || {}
    });

    const next = this.store.upsert({
      ...(existing || {}),
      id: existing?.id,
      userId,
      conversationId,
      projectId: project.id,
      artifactId: delivery?.export?.artifactId || existing?.artifactId || "",
      title: project.name,
      kind: "project",
      status: delivery?.status || project.status || "scaffolded",
      workspacePath: project.workspacePath,
      sourcePath: project.workspacePath,
      sourceFormat: "workspace",
      export: delivery?.export || existing?.export || null,
      links: {
        ...(existing?.links || {}),
        projectId: project.id,
        artifactIds: [
          ...new Set(
            [
              ...(existing?.links?.artifactIds || []),
              delivery?.export?.artifactId || existing?.artifactId || ""
            ].filter(Boolean)
          )
        ],
        sourceWorkObjectId:
          sourceWorkObjectId || existing?.links?.sourceWorkObjectId || "",
        linkedLearningIds: existing?.links?.linkedLearningIds || [],
        linkedPatternIds: existing?.links?.linkedPatternIds || [],
        linkedMemoryIds: existing?.links?.linkedMemoryIds || []
      },
      projectType: project.type || "internal",
      activeEntryPath,
      tags: [
        "project",
        "workspace",
        project.type || "internal",
        workspaceFamily.workspaceFamilyId,
        ...(project.dimensions || []),
        ...(project.internalCapabilities || [])
      ].filter(Boolean),
      entries,
      revision: existing?.revision || 1,
      metadata: {
        ...(existing?.metadata || {}),
        prompt,
        intentProfile,
        environmentPlan,
        environmentSimulation,
        businessSimulation,
        productPlanSimulation,
        impactSimulation,
        usageScenarioSimulation,
        workspaceFamilyId: workspaceFamily.workspaceFamilyId,
        workspaceFamilyLabel: workspaceFamily.workspaceFamilyLabel,
        workspaceFamilyDescription: workspaceFamily.workspaceFamilyDescription,
        nextCommand: delivery?.nextCommand || existing?.metadata?.nextCommand || "",
        delivery,
        mainFiles: delivery?.mainFiles || [],
        deliveryManifestPath: delivery?.deliveryManifestPath || "",
        projectDimensions: project.dimensions || [],
        internalCapabilities: project.internalCapabilities || [],
        globalProject: project.globalProject || null
      },
      history: [
        ...(existing?.history || []),
        {
          type: "delivery",
          at: new Date().toISOString(),
          status: delivery?.status || "ready"
        }
      ].slice(-20),
      summary: summarizeProjectDelivery(project, delivery)
    });

    if (this.projectStore && project.id) {
      this.projectStore.updateProject(project.id, {
        activeWorkObjectId: next.id,
        workObjectIds: [
          ...new Set(
            [
              ...(project.workObjectIds || []),
              next.id,
              sourceWorkObjectId || ""
            ].filter(Boolean)
          )
        ],
        artifactIds: [
          ...new Set(
            [
              ...(project.artifactIds || []),
              delivery?.export?.artifactId || ""
            ].filter(Boolean)
          )
        ]
      });
    }

    return compactWorkObject(next);
  }

  async registerGeneratedArtifact({
    userId,
    conversationId,
    prompt = "",
    artifact = null,
    sourceDocument = null,
    existingWorkObjectId = "",
    sourceWorkObjectId = "",
    projectId = "",
    intentProfile = null,
    environmentPlan = null,
    environmentSimulation = null,
    businessSimulation = null,
    productPlanSimulation = null
    ,
    impactSimulation = null,
    usageScenarioSimulation = null
  } = {}) {
    if (!artifact?.id || !sourceDocument?.content) {
      return null;
    }

    const existing = existingWorkObjectId
      ? this.store.get(existingWorkObjectId)
      : this.store.list({ userId, conversationId, limit: 100 }).find((item) => item.artifactId === artifact.id);

    const objectId = existing?.id || randomUUID();
    const objectRoot = path.join(
      this.rootDir,
      existing?.id || `${safeWorkObjectSlug(sourceDocument.title || artifact.title || "work-object")}-${String(objectId).slice(0, 8)}`
    );
    ensureDirectory(objectRoot);

    const sourceFilename = sourceDocument.filename || "content.md";
    const sourcePath = path.join(objectRoot, sourceFilename);
    const specPath = path.join(objectRoot, "spec.json");

    fs.writeFileSync(sourcePath, sourceDocument.content, "utf8");
    fs.writeFileSync(specPath, JSON.stringify(sourceDocument.spec || {}, null, 2), "utf8");

    const entries = [
      normalizeWorkObjectEntry({
        id: sourceFilename,
        path: sourceFilename,
        label: sourceFilename,
        kind: inferEntryKind(sourceFilename, sourceDocument.kind || "document"),
        editable: true,
        primary: true,
        contentType: guessContentType(sourceFilename),
        preview: previewContent(sourceDocument.content),
        sizeBytes: Buffer.byteLength(sourceDocument.content, "utf8"),
        lastModifiedAt: new Date().toISOString()
      }),
      normalizeWorkObjectEntry({
        id: "spec.json",
        path: "spec.json",
        label: "spec.json",
        kind: "dataset",
        editable: true,
        primary: false,
        contentType: "application/json",
        preview: previewContent(JSON.stringify(sourceDocument.spec || {})),
        sizeBytes: Buffer.byteLength(JSON.stringify(sourceDocument.spec || {}, null, 2), "utf8"),
        lastModifiedAt: new Date().toISOString()
      })
    ];

    const kind =
      sourceDocument.kind ||
      inferWorkObjectKind({
        format: artifact.format,
        classification: artifact.format === "json" ? "coding" : ""
      });
    const previewAssetSync = await this.materializeGeneratedPreviewAsset({
      objectRoot,
      artifactId: artifact.id,
      kind,
      entries
    });
    const nextEntries = previewAssetSync.entries || entries;
    const previewAssetPath = previewAssetSync.previewAssetPath || "";
    const workspaceFamily = deriveWorkspaceFamilyRecord({
      prompt,
      kind,
      entryPath: sourceFilename,
      environmentPlan,
      metadata: existing?.metadata || {}
    });

    const next = this.store.upsert({
      ...(existing || {}),
      id: existing?.id || undefined,
      userId,
      conversationId,
      projectId: existing?.projectId || projectId || "",
      artifactId: artifact.id,
      title: sourceDocument.title || artifact.title || "Hydria object",
      kind,
      status: "ready",
      workspacePath: objectRoot,
      sourcePath,
      sourceFormat: sourceDocument.format || "md",
      export: {
        artifactId: artifact.id,
        downloadUrl: artifact.downloadUrl,
        filename: artifact.filename,
        mimeType: artifact.mimeType
      },
      links: {
        ...(existing?.links || {}),
        projectId: existing?.projectId || projectId || "",
        artifactIds: [
          ...new Set([...(existing?.links?.artifactIds || []), artifact.id].filter(Boolean))
        ],
        sourceWorkObjectId:
          sourceWorkObjectId ||
          existing?.links?.sourceWorkObjectId ||
          "",
        linkedLearningIds: existing?.links?.linkedLearningIds || [],
        linkedPatternIds: existing?.links?.linkedPatternIds || [],
        linkedMemoryIds: existing?.links?.linkedMemoryIds || []
      },
      projectType: existing?.projectType || "internal",
      activeEntryPath: sourceFilename,
      tags: [...new Set([
        kind,
        artifact.format,
        sourceDocument.kind,
        workspaceFamily.workspaceFamilyId
      ].filter(Boolean))],
      entries: nextEntries,
      revision: existing ? Number(existing.revision || 1) + 1 : 1,
      metadata: {
        ...(existing?.metadata || {}),
        prompt,
        intentProfile,
        environmentPlan,
        environmentSimulation,
        businessSimulation,
        productPlanSimulation,
        impactSimulation,
        usageScenarioSimulation,
        workspaceFamilyId: workspaceFamily.workspaceFamilyId,
        workspaceFamilyLabel: workspaceFamily.workspaceFamilyLabel,
        workspaceFamilyDescription: workspaceFamily.workspaceFamilyDescription,
        sourceWorkObjectId:
          sourceWorkObjectId ||
          existing?.metadata?.sourceWorkObjectId ||
          "",
        spec: sourceDocument.spec || {},
        sourceFormat: sourceDocument.format || "md",
        sourceFilename,
        generation: {
          format: artifact.format || "",
          spec: sourceDocument.spec || {},
          prompt
        },
        previewAssetPath
      },
      history: [
        ...(existing?.history || []),
        {
          type: "artifact_generation",
          at: new Date().toISOString(),
          artifactId: artifact.id,
          prompt
        }
      ].slice(-20),
      summary: summarizeGeneratedObject({
        title: sourceDocument.title || artifact.title,
        kind,
        format: artifact.format
      })
    });

    if (this.projectStore && (next.projectId || projectId)) {
      const linkedProjectId = next.projectId || projectId;
      const linkedProject = this.projectStore.getProject(linkedProjectId);
      if (linkedProject) {
        this.projectStore.updateProject(linkedProjectId, {
          activeWorkObjectId: next.id,
          workObjectIds: [
            ...new Set(
              [
                ...(linkedProject.workObjectIds || []),
                next.id,
                sourceWorkObjectId || ""
              ].filter(Boolean)
            )
          ],
          artifactIds: [
            ...new Set(
              [
                ...(linkedProject.artifactIds || []),
                artifact.id || ""
              ].filter(Boolean)
            )
          ]
        });
      }
    }

    return compactWorkObject(next);
  }

  async refreshProjectExport(workObject = {}) {
    if (!this.artifactExporter || !workObject?.workspacePath) {
      return null;
    }

    const project =
      (workObject.projectId && this.projectStore?.getProject(workObject.projectId)) || {
        id: workObject.projectId || "",
        name: workObject.title,
        currentVersion: `0.1.${workObject.revision || 1}`
      };

    const createdFiles = (workObject.entries || []).map((entry) => entry.path);
    const exportResult = await this.artifactExporter.exportProject({
      project,
      workspacePath: workObject.workspacePath,
      templateId: workObject.metadata?.templateId || "",
      createdFiles,
      mainStructure: workObject.metadata?.mainFiles || createdFiles,
      nextCommands: workObject.metadata?.nextCommand
        ? [workObject.metadata.nextCommand]
        : [],
      delivery: workObject.metadata?.delivery || {
        status: workObject.status || "updated"
      },
      conversationId: workObject.conversationId,
      userId: workObject.userId
    });

    if (this.projectStore && workObject.projectId) {
      this.projectStore.updateProject(workObject.projectId, {
        exportArtifact: {
          artifactId: exportResult.artifact.id,
          downloadUrl: exportResult.artifact.downloadUrl,
          filename: exportResult.artifact.filename,
          format: exportResult.artifact.format
        }
      });
    }

    return {
      artifactId: exportResult.artifact.id,
      downloadUrl: exportResult.artifact.downloadUrl,
      filename: exportResult.artifact.filename,
      mimeType: exportResult.artifact.mimeType,
      sizeBytes: exportResult.artifact.sizeBytes,
      format: exportResult.artifact.format,
      manifestPath: exportResult.manifestPath
    };
  }

  async refreshGeneratedArtifactExport(workObject = {}, content = "") {
    const generation = workObject.metadata?.generation || {};
    const format = String(generation.format || workObject.export?.format || "md").toLowerCase();
    const prompt = generation.prompt || workObject.metadata?.prompt || "";
    const spec = generation.spec || {};

    if (["md", "txt", "html", "json", "csv", "svg", "image"].includes(format)) {
      const extension = format === "image" ? "svg" : format;
      const absolutePath = path.join(workObject.workspacePath, `rendered.${extension}`);
      fs.writeFileSync(absolutePath, String(content || ""), "utf8");
      const stat = fs.statSync(absolutePath);
      const artifact = await persistExternalGeneratedArtifact({
        artifactId: randomUUID(),
        title: workObject.title,
        format,
        extension,
        mimeType: guessContentType(absolutePath),
        absolutePath,
        sizeBytes: stat.size,
        conversationId: workObject.conversationId,
        userId: workObject.userId
      });

      return {
        artifactId: artifact.id,
        downloadUrl: artifact.downloadUrl,
        filename: artifact.filename,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        format: artifact.format
      };
    }

    const rendered = await renderGeneratedArtifact({
      format,
      title: workObject.title,
      markdown: String(content || ""),
      spec,
      prompt
    });
    const artifact = await persistGeneratedArtifact({
      artifactId: randomUUID(),
      title: workObject.title,
      format: rendered.format,
      extension: rendered.extension,
      mimeType: rendered.mimeType,
      buffer: rendered.buffer,
      conversationId: workObject.conversationId,
      userId: workObject.userId
    });

    return {
      artifactId: artifact.id,
      downloadUrl: artifact.downloadUrl,
      filename: artifact.filename,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
      format: artifact.format
    };
  }

  readContent({ workObjectId, entryPath = "" } = {}) {
    const workObject = this.store.get(String(workObjectId || ""));
    if (!workObject) {
      throw new Error("Work object not found");
    }

    const targetPath =
      toRelativePath(entryPath) ||
      workObject.activeEntryPath ||
      workObject.entries.find((entry) => entry.primary)?.path ||
      "";

    const entry = workObject.entries.find((candidate) => candidate.path === targetPath);
    if (!entry) {
      throw new Error("Work object entry not found");
    }

    if (!entry.editable) {
      throw new Error("Selected work object entry is not editable");
    }

    const absolutePath = safeResolveWithin(workObject.workspacePath, targetPath);
    const content = fs.readFileSync(absolutePath, "utf8");

    return {
      workObject,
      entryPath: targetPath,
      content
    };
  }

  createFile({
    workObjectId = "",
    entryPath = "",
    content = "",
    actorUserId = null,
    expectedRevision = null
  } = {}) {
    const stored = this.store.get(String(workObjectId || ""));
    if (!stored) throw new AppError("Work object not found", 404);
    if (!Number.isSafeInteger(Number(actorUserId)) || Number(actorUserId) <= 0) {
      throw new AppError("A valid acting user is required to create files", 403);
    }
    this.assertAccess(stored, { actorUserId }, "editor");
    if (stored.status === "trashed") throw new AppError("Restore the work object before creating files", 409);
    if (!["project", "code"].includes(stored.kind)) {
      throw new AppError("File creation is available for project/code workspaces only", 409);
    }
    if (expectedRevision != null && Number(expectedRevision) !== Number(stored.revision || 1)) {
      throw new AppError("This work object was modified by another collaborator", 409);
    }
    const entry = String(entryPath || "").replace(/\\/g, "/").trim();
    const segments = entry.split("/");
    if (!entry || entry.length > 240 || entry.startsWith("/") || /^[a-z]:/i.test(entry) ||
      segments.length > 12 || segments.some((item) => !item || item === "." || item === ".." ||
        [".git", ".hydria-history", "node_modules"].includes(item.toLowerCase()) ||
        item.toLowerCase().startsWith(".env") ||
        /[\x00-\x1f<>:"|?*]/.test(item))) {
      throw new AppError("Invalid project file path", 400);
    }
    if (!isEditableTextPath(entry)) throw new AppError("Only editable text file extensions can be created", 400);
    if ((stored.entries || []).some((item) => item.path.toLowerCase() === entry.toLowerCase())) {
      throw new AppError("A file already exists at that path", 409);
    }
    const textContent = String(content ?? "");
    if (Buffer.byteLength(textContent, "utf8") > 1_000_000) {
      throw new AppError("New files are limited to 1 MB", 413);
    }
    const root = path.resolve(stored.workspacePath);
    const destination = safeResolveWithin(root, entry);
    if (fs.existsSync(destination)) throw new AppError("File already exists on disk", 409);
    let cursor = root;
    for (const segment of segments.slice(0, -1)) {
      cursor = path.join(cursor, segment);
      if (fs.existsSync(cursor) && (fs.lstatSync(cursor).isSymbolicLink() || !fs.statSync(cursor).isDirectory())) {
        throw new AppError("Unsafe project directory", 400);
      }
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, textContent, { encoding: "utf8", flag: "wx" });
    try {
      const updated = this.store.update(stored.id, (record) => ({
        ...record,
        activeEntryPath: entry,
        revision: Number(record.revision || 1) + 1,
        status: "updated",
        entries: [...(record.entries || []), normalizeWorkObjectEntry({
          id: entry,
          path: entry,
          label: entry,
          kind: inferEntryKind(entry, record.kind),
          editable: true,
          primary: !(record.entries || []).length,
          contentType: guessContentType(entry),
          preview: previewContent(textContent),
          sizeBytes: Buffer.byteLength(textContent, "utf8"),
          lastModifiedAt: new Date().toISOString()
        })],
        history: [...(record.history || []), {
          id: randomUUID(),
          type: "file_create",
          at: new Date().toISOString(),
          actor: `user:${actorUserId}`,
          entryPath: entry
        }].slice(-25)
      }));
      return compactWorkObject(updated, { entryPath: entry, content: textContent });
    } catch (error) {
      fs.unlinkSync(destination);
      throw error;
    }
  }

  moveFile({
    workObjectId = "",
    from = "",
    to = "",
    actorUserId = null,
    shareToken = "",
    expectedRevision = null
  } = {}) {
    const current = this.store.get(String(workObjectId || ""));
    if (!current) throw new AppError("Work object not found", 404);
    if (!Number.isSafeInteger(Number(actorUserId)) || Number(actorUserId) <= 0) {
      throw new AppError("A valid acting user is required for file moves", 403);
    }
    this.assertAccess(current, { actorUserId, shareToken }, "editor");
    if (current.status === "trashed") throw new AppError("Restore the work object before changing its files", 409);
    // Native Docs/Sheets/Slides and other typed objects have canonical file paths.
    // Restrict physical moves to project/code workspaces until their respective
    // internal references can be migrated together.
    if (!["project", "code"].includes(current.kind)) {
      throw new AppError("File moves are available for project/code workspaces only", 409);
    }
    if (expectedRevision != null && Number(expectedRevision) !== Number(current.revision || 1)) {
      throw new AppError("This work object was modified by another collaborator", 409);
    }
    const validatePath = (value) => {
      const raw = String(value || "").replace(/\\/g, "/").trim();
      if (!raw || raw.length > 240 || raw.startsWith("/") || /^[a-z]:/i.test(raw) || raw.includes("\0")) {
        throw new AppError("Invalid workspace file path", 400);
      }
      const pieces = raw.split("/");
      if (pieces.some((piece) => !piece || piece === "." || piece === ".." ||
        [".git", ".hydria-history", "node_modules"].includes(piece.toLowerCase()) ||
        piece.toLowerCase().startsWith(".env"))) {
        throw new AppError("Reserved or unsafe workspace file path", 400);
      }
      return pieces.join("/");
    };
    const source = validatePath(from), destination = validatePath(to);
    if (source === destination) throw new AppError("Source and destination paths are identical", 400);
    const entry = (current.entries || []).find((candidate) => candidate.path === source);
    if (!entry || !entry.editable) throw new AppError("Editable source file not found", 404);
    if ((current.entries || []).some((candidate) => candidate.path.toLowerCase() === destination.toLowerCase())) {
      throw new AppError("A file already exists at the destination", 409);
    }
    if (!isEditableTextPath(destination)) {
      throw new AppError("Destination must have an editable file extension", 400);
    }
    const root = path.resolve(current.workspacePath);
    const sourceAbsolute = safeResolveWithin(root, source);
    const destinationAbsolute = safeResolveWithin(root, destination);
    // Source symlink ancestors are unsafe too, even if the leaf is a regular file.
    let sourceCursor = root;
    for (const segment of source.split("/")) {
      sourceCursor = path.join(sourceCursor, segment);
      if (fs.existsSync(sourceCursor) && fs.lstatSync(sourceCursor).isSymbolicLink()) {
        throw new AppError("Source contains a symbolic link", 400);
      }
    }
    if (!fs.existsSync(sourceAbsolute) || !fs.statSync(sourceAbsolute).isFile()) {
      throw new AppError("Source is not a regular file", 400);
    }
    if (fs.existsSync(destinationAbsolute)) throw new AppError("Destination already exists on disk", 409);
    // Prevent following symlink directories out of the work-object sandbox.
    const segments = destination.split("/").slice(0, -1);
    let parent = root;
    for (const segment of segments) {
      parent = path.join(parent, segment);
      if (fs.existsSync(parent) && (!fs.statSync(parent).isDirectory() || fs.lstatSync(parent).isSymbolicLink())) {
        throw new AppError("Destination directory is not safe", 400);
      }
    }
    fs.mkdirSync(path.dirname(destinationAbsolute), { recursive: true });
    fs.renameSync(sourceAbsolute, destinationAbsolute);
    try {
      const updated = this.store.update(current.id, (record) => ({
        ...record,
        sourcePath: record.sourcePath === sourceAbsolute ? destinationAbsolute : record.sourcePath,
        activeEntryPath: record.activeEntryPath === source ? destination : record.activeEntryPath,
        revision: Number(record.revision || 1) + 1,
        status: "updated",
        entries: (record.entries || []).map((item) =>
          item.path === source ? normalizeWorkObjectEntry({
            ...item, id: destination, path: destination, label: destination,
            kind: inferEntryKind(destination, record.kind),
            contentType: guessContentType(destination),
            lastModifiedAt: new Date().toISOString()
          }) : item
        ),
        metadata: {
          ...(record.metadata || {}),
          previewAssetPath: record.metadata?.previewAssetPath === source ? destination : record.metadata?.previewAssetPath
        },
        history: [...(record.history || []).map((item) =>
          item.entryPath === source ? { ...item, entryPath: destination } : item
        ), {
          id: randomUUID(),
          type: "file_move",
          at: new Date().toISOString(),
          actor: `user:${actorUserId || "unknown"}`,
          from: source,
          to: destination
        }].slice(-25)
      }));
      return compactWorkObject(updated);
    } catch (error) {
      // Metadata must never point at a file that did not move successfully.
      fs.renameSync(destinationAbsolute, sourceAbsolute);
      throw error;
    }
  }

  resolveAsset({ workObjectId, entryPath = "" } = {}) {
    const workObject = this.store.get(String(workObjectId || ""));
    if (!workObject) {
      throw new Error("Work object not found");
    }

    const targetPath = toRelativePath(entryPath);
    const entry = workObject.entries.find((candidate) => candidate.path === targetPath);
    if (!entry) {
      throw new Error("Work object asset not found");
    }

    const absolutePath = safeResolveWithin(workObject.workspacePath, targetPath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error("Work object asset missing on disk");
    }

    return {
      workObject,
      entry,
      absolutePath
    };
  }

  async updateContent(options = {}) {
    return withKeyedLock(`${path.resolve(this.store.filePath)}:${options.workObjectId}`,
      () => this.updateContentLocked(options));
  }

  async updateContentLocked({
    workObjectId,
    entryPath = "",
    content = "",
    note = "",
    actor = "user",
    actorUserId = null,
    shareToken = "",
    expectedRevision = null
  } = {}) {
    const stored = this.store.get(String(workObjectId || ""));
    if (!stored) {
      throw new AppError("Work object not found", 404);
    }
    this.assertAccess(stored, { actorUserId, shareToken }, "editor");
    if (
      expectedRevision !== null &&
      expectedRevision !== undefined &&
      Number(expectedRevision) !== Number(stored.revision || 1)
    ) {
      throw new AppError("This work object was modified by another collaborator", 409, {
        expectedRevision: Number(expectedRevision),
        currentRevision: Number(stored.revision || 1),
        workObject: compactWorkObject(stored)
      });
    }
    const current = this.readContent({
      workObjectId,
      entryPath
    });
    const absolutePath = safeResolveWithin(current.workObject.workspacePath, current.entryPath);
    const historyId = randomUUID();
    const historyDirectory = path.join(current.workObject.workspacePath, ".hydria-history");
    ensureDirectory(historyDirectory);
    const historyFilename = `${String(current.workObject.revision || 1).padStart(6, "0")}-${historyId}.snapshot`;
    const historyAbsolutePath = safeResolveWithin(historyDirectory, historyFilename);
    atomicWriteFile(historyAbsolutePath, current.content);
    const journalPath = path.join(current.workObject.workspacePath, ".hydria-pending-save.json");
    atomicWriteFile(journalPath, JSON.stringify({
      entryPath: current.entryPath, historyId, previousContent: current.content
    }));
    atomicWriteFile(absolutePath, String(content || ""));
    let committed = false;
    try {
    const stats = fs.statSync(absolutePath);

    const exportArtifact =
      current.workObject.kind === "project"
        ? await this.refreshProjectExport(current.workObject)
        : await this.refreshGeneratedArtifactExport(current.workObject, String(content || ""));
    const updatedPrimaryEntries = current.workObject.entries.map((entry) =>
      entry.path === current.entryPath
        ? normalizeWorkObjectEntry({
            ...entry,
            editable: true,
            primary: true,
            preview: previewContent(content),
            sizeBytes: stats.size,
            lastModifiedAt: stats.mtime.toISOString()
          })
        : normalizeWorkObjectEntry({
            ...entry,
            primary: false
          })
    );
    const previewAssetSync =
      current.workObject.kind === "project"
        ? {
            entries: updatedPrimaryEntries,
            previewAssetPath: current.workObject.metadata?.previewAssetPath || ""
          }
        : await this.materializeGeneratedPreviewAsset({
            objectRoot: current.workObject.workspacePath,
            artifactId: exportArtifact?.artifactId || "",
            kind: current.workObject.kind,
            entries: updatedPrimaryEntries
          });

    const updated = this.store.update(current.workObject.id, (workObject) => ({
      ...workObject,
      activeEntryPath: current.entryPath,
      revision: Number(workObject.revision || 1) + 1,
      status: "updated",
      export: exportArtifact
        ? {
            artifactId: exportArtifact.artifactId,
            downloadUrl: exportArtifact.downloadUrl,
            filename: exportArtifact.filename,
            mimeType: exportArtifact.mimeType,
            sizeBytes: exportArtifact.sizeBytes,
            format: exportArtifact.format
          }
        : workObject.export,
      entries: previewAssetSync.entries || updatedPrimaryEntries,
      metadata: {
        ...(workObject.metadata || {}),
        previewAssetPath:
          previewAssetSync.previewAssetPath || workObject.metadata?.previewAssetPath || ""
      },
      history: [
        ...(workObject.history || []),
        {
          id: historyId,
          type: "content_update",
          at: new Date().toISOString(),
          actor,
          entryPath: current.entryPath,
          note,
          previousRevision: Number(workObject.revision || 1),
          snapshotPath: toRelativePath(path.relative(workObject.workspacePath, historyAbsolutePath))
        }
      ].slice(-25)
    }));

    // Catalog rename is the commit point. Recovery uses the committed history ID.
    committed = true;
    fs.rmSync(journalPath, { force: true });
    return compactWorkObject(updated, {
      entryPath: current.entryPath,
      content: String(content || "")
    });
    } catch (error) {
      // Failed rendering/catalog writes must not leave an unacknowledged edit.
      if (!committed) {
        atomicWriteFile(absolutePath, current.content);
        fs.rmSync(journalPath, { force: true });
      }
      throw error;
    }
  }

  listHistory(workObjectId = "") {
    const workObject = this.store.get(String(workObjectId || ""));
    if (!workObject) {
      return null;
    }

    return [...(workObject.history || [])]
      .reverse()
      .map((entry, index) => ({
        ...entry,
        id: entry.id || `legacy-${index}`,
        revision:
          entry.previousRevision ||
          Math.max(1, Number(workObject.revision || 1) - index - 1),
        restorable: Boolean(entry.snapshotPath)
      }));
  }

  readHistorySnapshot(workObjectId = "", historyId = "") {
    const workObject = this.store.get(String(workObjectId || ""));
    if (!workObject) {
      return null;
    }
    const entry = (workObject.history || []).find(
      (candidate) => String(candidate.id || "") === String(historyId || "")
    );
    if (!entry?.snapshotPath) {
      return null;
    }
    const snapshotPath = safeResolveWithin(workObject.workspacePath, entry.snapshotPath);
    if (!fs.existsSync(snapshotPath)) {
      return null;
    }
    return {
      entry: {
        ...entry,
        revision: entry.previousRevision || 1
      },
      content: fs.readFileSync(snapshotPath, "utf8")
    };
  }

  async restoreHistory({
    workObjectId = "",
    historyId = "",
    actor = "user"
  } = {}) {
    const workObject = this.store.get(String(workObjectId || ""));
    if (!workObject) {
      return null;
    }

    const historyEntry = (workObject.history || []).find(
      (entry) => String(entry.id || "") === String(historyId || "")
    );
    if (!historyEntry?.snapshotPath || !historyEntry.entryPath) {
      return null;
    }

    const snapshotPath = safeResolveWithin(
      workObject.workspacePath,
      historyEntry.snapshotPath
    );
    if (!fs.existsSync(snapshotPath)) {
      return null;
    }

    return this.updateContent({
      workObjectId: workObject.id,
      entryPath: historyEntry.entryPath,
      content: fs.readFileSync(snapshotPath, "utf8"),
      note: `Restored revision ${historyEntry.previousRevision || ""}`.trim(),
      actor
    });
  }

  async updateTextContent(workObjectId, entryPath = "", content = "", note = "", actor = "user") {
    return this.updateContent({
      workObjectId,
      entryPath,
      content,
      note,
      actor
    });
  }

  async improveObject({
    workObjectId,
    prompt = "",
    entryPath = ""
  } = {}) {
    const current = this.readContent({
      workObjectId,
      entryPath
    });

    if (!this.brainProvider) {
      throw new Error("Work object improvement is not available");
    }

    const formatInstruction = current.entryPath.endsWith(".json")
      ? "Return valid JSON only. Preserve the existing top-level structure unless the instruction clearly requires a change."
      : current.entryPath.endsWith(".csv")
        ? "Return valid CSV only. Preserve a clean tabular structure."
        : current.entryPath.endsWith(".md")
          ? "Return Markdown only. Preserve headings and structure where possible."
          : "Return only the updated content in the same format as the current entry.";

    const completion = await this.brainProvider.generate(
      [
        {
          role: "system",
          content:
            `You improve an existing Hydria work object. ${formatInstruction} Do not wrap the result in code fences and do not add commentary.`
        },
        {
          role: "user",
          content: [
            `Work object: ${current.workObject.title} (${current.workObject.kind})`,
            `Entry: ${current.entryPath}`,
            `Instruction: ${prompt || "Improve the current work object while preserving its intent."}`,
            "",
            "Current content:",
            current.content
          ].join("\n")
        }
      ],
      {
        kind:
          current.workObject.kind === "project" ||
          /\.(json|js|mjs|cjs|ts|tsx|jsx|html|css|scss)$/i.test(current.entryPath)
          ? "code"
          : "general",
        options: {
          maxTokens: 1600
        }
      }
    );

    if (!completion.success) {
      throw new Error(completion.error || "Unable to improve work object");
    }

    const updated = await this.updateContent({
      workObjectId,
      entryPath: current.entryPath,
      content: completion.content,
      note: prompt || "Improved by Hydria",
      actor: "hydria"
    });

    return {
      finalAnswer: buildImprovementAnswer({
        workObject: updated,
        entryPath: current.entryPath,
        prompt
      }),
      workObject: updated
    };
  }
}

export default WorkObjectService;
