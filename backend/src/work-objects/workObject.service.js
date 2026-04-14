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

function buildBlankWorkspaceFiles(kind = "document", title = "Hydria Workspace", workspaceFamilyId = "") {
  const safeTitle = String(title || "Hydria Workspace").trim() || "Hydria Workspace";
  const headline = safeTitle.replace(/[#\\n]+/g, "").trim();

  if (kind === "dataset") {
    return {
      sourceFormat: "csv",
      primaryPath: "table.csv",
      files: [
        {
          path: "table.csv",
          content: "Item,Value\\n"
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
    return {
      sourceFormat: "md",
      primaryPath: "slides.md",
      files: [
        {
          path: "slides.md",
          content: `# ${headline}\\n\\n## Slide 1 - ${headline}\\n\\n- Main point\\n- Key message\\n`
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
            `<h1>${headline}</h1>\n` +
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
    ensureDirectory(rootDir);
  }

  list(options = {}) {
    return this.listForConversation(options);
  }

  listForConversation({ userId = null, conversationId = null, limit = 30 } = {}) {
    return this.store
      .list({ userId, conversationId, limit })
      .map((item) => compactWorkObject(item));
  }

  listForProject({ projectId = "", userId = null, limit = 50 } = {}) {
    if (!projectId) {
      return [];
    }

    const scoped = this.store.list({ projectId, userId, limit });
    if (scoped.length || !userId) {
      return scoped.map((item) => compactWorkObject(item));
    }

    return this.store
      .list({ projectId, userId: null, limit })
      .map((item) => compactWorkObject(item));
  }

  createBlankWorkObject({
    kind = "document",
    title = "",
    userId = null,
    conversationId = null,
    projectId = "",
    workspaceFamilyId = ""
  } = {}) {
    const objectId = this.store.createId();
    const safeTitle = title || `New ${kind}`;
    const slug = `${safeWorkObjectSlug(safeTitle)}-${objectId.slice(0, 8)}`;
    const workspacePath = path.join(this.rootDir, slug);
    ensureDirectory(workspacePath);

    const { files, primaryPath, sourceFormat } = buildBlankWorkspaceFiles(
      kind,
      safeTitle,
      workspaceFamilyId
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
        workspaceFamilyId
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

  get(workObjectId, { includeContent = false, entryPath = "" } = {}) {
    const workObject = this.store.get(String(workObjectId || ""));
    if (!workObject) {
      return null;
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

  async updateContent({
    workObjectId,
    entryPath = "",
    content = "",
    note = "",
    actor = "user"
  } = {}) {
    const current = this.readContent({
      workObjectId,
      entryPath
    });
    const absolutePath = safeResolveWithin(current.workObject.workspacePath, current.entryPath);
    fs.writeFileSync(absolutePath, String(content || ""), "utf8");
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
          type: "content_update",
          at: new Date().toISOString(),
          actor,
          entryPath: current.entryPath,
          note
        }
      ].slice(-25)
    }));

    return compactWorkObject(updated, {
      entryPath: current.entryPath,
      content: String(content || "")
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
