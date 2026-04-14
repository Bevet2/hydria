import fs from "node:fs";
import path from "node:path";
import { ArtifactExporter } from "../artifacts/artifactExporter.js";
import { ProjectArchiveService } from "../artifacts/projectArchiveService.js";
import agenticConfig from "../config/agenticConfig.js";
import { runProjectBuild } from "./buildRunner.js";
import { runProjectTests } from "./testRunner.js";
import { runProjectInstall } from "./installRunner.js";
import { runProjectSmoke } from "./runRunner.js";
import { runProjectValidation } from "./validationRunner.js";
import { runProjectFixLoop } from "./fixLoop.js";
import { ProjectAutoFixer } from "./projectAutoFixer.js";
import { createRetryExecutionPolicy } from "./retryExecutionPolicy.js";
import { buildDeployPlan } from "./deployPlan.js";
import { buildMonitorPlan } from "./monitorPlan.js";
import { buildScaffoldTemplate } from "./scaffoldTemplates.js";
import { buildCommand, detectPackageManager, readPackageJson } from "./projectUtils.js";
import { callCodeModel } from "../../services/providers/llm/llmRouterService.js";
import { getProviderModelChain } from "../../services/registry/modelRegistry.js";

function safeProjectDirName(name = "hydria-project") {
  return String(name || "hydria-project")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "hydria-project";
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function reorderMainFiles(files = [], preferred = []) {
  const normalizedFiles = uniqueStrings(files);
  const prioritized = [
    ...preferred.filter((item) => normalizedFiles.includes(item)),
    ...normalizedFiles.filter((item) => !preferred.includes(item))
  ];
  return prioritized;
}

function displayProjectTitle(name = "") {
  return String(name || "hydria-project")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeJsonParse(value = "") {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return null;
  }
}

function extractJsonObject(value = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const fenced = raw.match(/```json\s*([\s\S]+?)```/i);
  if (fenced?.[1]) {
    return safeJsonParse(fenced[1]);
  }

  const direct = safeJsonParse(raw);
  if (direct) {
    return direct;
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return safeJsonParse(raw.slice(firstBrace, lastBrace + 1));
  }

  return null;
}

function sanitizeAppScenario(value = null, fallbackTitle = "Hydria App") {
  if (!value || typeof value !== "object") {
    return null;
  }

  const pages = Array.isArray(value.pages)
    ? value.pages
        .map((page, index) => {
          if (!page || typeof page !== "object") {
            return null;
          }

          const id =
            String(page.id || page.label || page.title || `page-${index + 1}`)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "") || `page-${index + 1}`;

          const cleaned = {
            ...page,
            id,
            label: String(page.label || page.title || `View ${index + 1}`).trim(),
            title: String(page.title || page.label || `View ${index + 1}`).trim(),
            intro: String(page.intro || page.summary || "A concrete working surface inside the app.").trim()
          };

          return cleaned;
        })
        .filter(Boolean)
        .slice(0, 6)
    : [];

  if (!pages.length) {
    return null;
  }

  return {
    title: String(value.title || fallbackTitle || "Hydria App").trim(),
    eyebrow: String(value.eyebrow || "App workspace").trim(),
    subtitle: String(
      value.subtitle || "A live multi-view app generated from the current project context."
    ).trim(),
    accentTitle: String(
      value.accentTitle ||
        "The app should feel usable immediately, with several concrete views instead of a blank shell."
    ).trim(),
    references: value.references && typeof value.references === "object" ? value.references : { repositories: [], patterns: [] },
    pages
  };
}

function buildGitResearchPrompt(gitResearch = null) {
  const repositories = gitResearch?.normalized?.repositories || [];
  const patterns = gitResearch?.normalized?.patterns || [];
  if (!repositories.length && !patterns.length) {
    return "";
  }

  const lines = [];
  if (repositories.length) {
    lines.push("Reference repositories:");
    repositories.slice(0, 4).forEach((repo) => {
      lines.push(`- ${repo.fullName}: ${repo.description || "Reference repository"}`);
    });
  }
  if (patterns.length) {
    lines.push("Reference patterns:");
    patterns.slice(0, 6).forEach((pattern) => {
      const label = pattern.label || pattern.name || pattern.category || "Pattern";
      const note = pattern.summary || pattern.description || pattern.example || "";
      lines.push(`- ${label}: ${note}`);
    });
  }
  return lines.join("\n");
}

async function generateAppScenarioWithLlm({
  projectName = "Hydria App",
  prompt = "",
  gitResearch = null
} = {}) {
  if (!prompt) {
    return null;
  }

  const buildMessages = (compact = false) => [
    {
      role: "system",
      content:
        "You design Hydria app blueprints. Return JSON only. Build a concrete multi-view app config that feels like a real product, not a generic note app or demo shell."
    },
    {
      role: "user",
      content: [
        `Project name: ${projectName}`,
        `User request: ${prompt}`,
        buildGitResearchPrompt(gitResearch),
        "Return a JSON object with keys: title, eyebrow, subtitle, accentTitle, pages.",
        compact ? "pages must contain exactly 4 entries." : "pages must contain 4 to 5 entries.",
        "Each page must include: id, label, title, intro.",
        "Use only fields that add product value.",
        compact
          ? "Keep it compact: max 3 stats, max 2 cards, max 3 checklist items, max 3 table rows, max 3 transactions."
          : "For rich pages, keep the content concise: max 4 stats, max 3 cards, max 4 table rows, max 3 checklist items.",
        "You may also include any of: stats, cards, checklist, tags, table, transactions, quickEntry, budgetBuckets.",
        "Make the pages domain-specific and different from each other.",
        "Avoid generic placeholders like 'Overview', 'Notes', 'Page 1' unless the prompt truly requires them.",
        "The result must be directly usable by Hydria as app.config.json."
      ]
        .filter(Boolean)
        .join("\n")
    }
  ];

  const tryGenerate = async (compact = false) => {
    const result = await callCodeModel(buildMessages(compact), {
      modelChain: getProviderModelChain("premium_code"),
      temperature: compact ? 0.1 : 0.15,
      maxTokens: compact ? 2200 : 2600
    });
    if (!result?.success) {
      return null;
    }
    return sanitizeAppScenario(extractJsonObject(result.content), projectName);
  };

  return (await tryGenerate(false)) || (await tryGenerate(true));
}

function buildGlobalProjectBlueprint({
  prompt = "",
  projectName = "",
  description = "",
  globalProjectContext = null
} = {}) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    projectName,
    prompt,
    description,
    projectMode: globalProjectContext?.projectMode || "global_project",
    dimensions: globalProjectContext?.dimensions || [],
    editableSurfaces: globalProjectContext?.editableSurfaces || [],
    seed: globalProjectContext?.seed || null,
    selectedCapabilities: (globalProjectContext?.selectedCapabilities || []).map((capability) => ({
      id: capability.id,
      label: capability.label,
      summary: capability.summary,
      reason: capability.reason,
      stages: capability.stages || []
    }))
  };
}

function buildProjectOverview({
  projectName = "",
  description = "",
  globalProjectContext = null
} = {}) {
  const dimensions = globalProjectContext?.dimensions || [];
  const capabilities = globalProjectContext?.selectedCapabilities || [];
  const seed = globalProjectContext?.seed || null;

  return [
    `# ${displayProjectTitle(projectName)}`,
    "",
    seed?.headline || description,
    "",
    seed?.promise || description,
    "",
    seed?.audience ? "## Audience" : "",
    seed?.audience ? `- ${seed.audience}` : "",
    "",
    seed?.problem ? "## Problem" : "",
    seed?.problem ? `- ${seed.problem}` : "",
    "",
    seed?.workstreams?.length ? "## Workstreams" : "",
    ...(seed?.workstreams || []).map((stream) => `- ${stream}`),
    "",
    seed?.recommendedObjects?.length ? "## Recommended objects in this project" : "",
    ...(seed?.recommendedObjects || []).map((item) => `- ${item}`),
    "",
    seed?.coreLoop?.length ? "## Core loop" : "",
    ...(seed?.coreLoop || []).map((item, index) => `${index + 1}. ${item}`),
    "",
    seed?.heroMoments?.length ? "## Hero moments" : "",
    ...(seed?.heroMoments || []).map((item) => `- ${item}`),
    "",
    seed?.kpis?.length ? "## Initial KPI set" : "",
    ...(seed?.kpis || []).map((item) => `- ${item}`),
    "",
    "## Project mode",
    `- ${globalProjectContext?.projectMode || "global_project"}`,
    "",
    dimensions.length ? "## Dimensions" : "",
    ...dimensions.map((dimension) => `- ${dimension}`),
    "",
    capabilities.length ? "## Internal capabilities selected" : "",
    ...capabilities.map(
      (capability) => `- ${capability.label}: ${capability.reason || capability.summary || ""}`
    ),
    "",
    globalProjectContext?.editableSurfaces?.length ? "## Editable surfaces" : "",
    ...(globalProjectContext?.editableSurfaces || []).map((surface) => `- ${surface}`),
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildStudioFiles(globalProjectContext = null) {
  const studioCapability = (globalProjectContext?.selectedCapabilities || []).find(
    (capability) => capability.id === "studio"
  );
  const seed = globalProjectContext?.seed || null;
  if (!studioCapability) {
    return [];
  }

  return [
    {
      path: "studio/creative-brief.md",
      content: [
        "# Creative Brief",
        "",
        "Story goal",
        `- ${seed?.promise || studioCapability.reason || studioCapability.summary}`,
        "",
        seed?.audience ? "Primary audience" : "",
        seed?.audience ? `- ${seed.audience}` : "",
        "",
        "Suggested pipeline",
        ...(studioCapability.stages || []).map((stage) => `- ${stage}`),
        ""
      ].join("\n")
    },
    {
      path: "studio/storyboard.json",
      content: JSON.stringify(
        {
          scenes: [],
          stages: studioCapability.stages || [],
          notes: "Fill this storyboard with scenes, beats and visual references.",
          narrativeGoal: seed?.headline || "",
          audience: seed?.audience || ""
        },
        null,
        2
      )
    },
    {
      path: "studio/visual-direction.md",
      content: [
        "# Visual Direction",
        "",
        "Use this file to define mood, references, shot style and export needs.",
        "",
        seed?.headline ? `Project intent: ${seed.headline}` : "",
        "",
        "## Focus",
        ...(studioCapability.strengths || []).map((item) => `- ${item}`),
        ""
      ].join("\n")
    }
  ];
}

function buildMusicFiles(globalProjectContext = null) {
  const musicCapability = (globalProjectContext?.selectedCapabilities || []).find(
    (capability) => capability.id === "music"
  );
  const seed = globalProjectContext?.seed || null;
  if (!musicCapability) {
    return [];
  }

  return [
    {
      path: "audio/audio-brief.md",
      content: [
        "# Audio Brief",
        "",
        "This project includes an audio dimension derived from Hydria Music.",
        "",
        seed?.promise ? `Core promise: ${seed.promise}` : "",
        "",
        "## Focus",
        ...(musicCapability.strengths || []).map((item) => `- ${item}`),
        "",
        "## Pipeline",
        ...(musicCapability.stages || []).map((stage) => `- ${stage}`),
        ""
      ].join("\n")
    },
    {
      path: "audio/track-plan.json",
      content: JSON.stringify(
        {
          cues: [],
          stages: musicCapability.stages || [],
          notes: "Use this file to define cues, tempo, references and export targets.",
          audience: seed?.audience || "",
          projectIntent: seed?.headline || ""
        },
        null,
        2
      )
    },
    {
      path: "audio/production-notes.md",
      content: [
        "# Production Notes",
        "",
        "Keep composition, lyric, generation and QC notes here.",
        ""
      ].join("\n")
    }
  ];
}

function buildDimensionFiles(globalProjectContext = null) {
  const dimensions = globalProjectContext?.dimensions || [];
  const seed = globalProjectContext?.seed || null;
  const files = [];

  files.push({
    path: "experience/project-map.md",
    content: [
      "# Project Map",
      "",
      seed?.headline || "Global project map",
      "",
      seed?.audience ? "## Audience" : "",
      seed?.audience ? `- ${seed.audience}` : "",
      "",
      seed?.problem ? "## Problem" : "",
      seed?.problem ? `- ${seed.problem}` : "",
      "",
      seed?.promise ? "## Promise" : "",
      seed?.promise ? `- ${seed.promise}` : "",
      "",
      seed?.workstreams?.length ? "## Workstreams" : "",
      ...(seed?.workstreams || []).map((item) => `- ${item}`),
      "",
      seed?.nextSteps?.length ? "## Next Hydria actions" : "",
      ...(seed?.nextSteps || []).map((item) => `- ${item}`),
      ""
    ]
      .filter(Boolean)
      .join("\n")
  });

  if (seed?.coreLoop?.length || seed?.heroMoments?.length) {
    files.push({
      path: "experience/user-flow.md",
      content: [
        "# User Flow",
        "",
        seed?.headline || displayProjectTitle(globalProjectContext?.projectName || ""),
        "",
        seed?.coreLoop?.length ? "## Core loop" : "",
        ...(seed?.coreLoop || []).map((item, index) => `${index + 1}. ${item}`),
        "",
        seed?.heroMoments?.length ? "## Hero moments" : "",
        ...(seed?.heroMoments || []).map((item) => `- ${item}`),
        ""
      ]
        .filter(Boolean)
        .join("\n")
    });
  }

  if (dimensions.includes("logic") || dimensions.includes("structure")) {
    files.push({
      path: "logic/architecture.md",
      content: [
        "# Architecture",
        "",
        seed?.promise || "Describe modules, boundaries and responsibilities here.",
        "",
        "## Suggested modules",
        ...(seed?.recommendedObjects || []).map((item) => `- ${item}`),
        ""
      ].join("\n")
    });
  }

  if (dimensions.includes("data")) {
    files.push({
      path: "data/data-model.json",
      content: JSON.stringify(
        {
          entities: [],
          relations: [],
          notes: "Add domain entities and relations here.",
          domain: seed?.theme || "generic_project"
        },
        null,
        2
      )
    });
  }

  if (seed?.kpis?.length) {
    files.push({
      path: "data/kpis.json",
      content: JSON.stringify(
        {
          northStar: seed.kpis[0] || "",
          kpis: seed.kpis.map((label) => ({
            id: String(label || "")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, ""),
            label,
            definition: "Refine this KPI inside the project based on the real operating model."
          }))
        },
        null,
        2
      )
    });
  }

  files.push({
    path: "content/project-brief.md",
    content: [
      "# Project Brief",
      "",
      seed?.headline || "Keep the narrative, positioning and key messages of the project here.",
      "",
      seed?.audience ? "## Audience" : "",
      seed?.audience ? seed.audience : "",
      "",
      seed?.problem ? "## Problem" : "",
      seed?.problem ? seed.problem : "",
      "",
      seed?.promise ? "## Promise" : "",
      seed?.promise ? seed.promise : "",
      ""
    ]
      .filter(Boolean)
      .join("\n")
  });

  if (seed?.launchPlan?.length) {
    files.push({
      path: "content/execution-plan.md",
      content: [
        "# Execution Plan",
        "",
        seed?.headline || displayProjectTitle(globalProjectContext?.projectName || ""),
        "",
        "## Next execution moves",
        ...(seed.launchPlan || []).map((item) => `- ${item}`),
        "",
        seed?.nextSteps?.length ? "## Immediate object additions" : "",
        ...(seed?.nextSteps || []).map((item) => `- ${item}`),
        ""
      ]
        .filter(Boolean)
        .join("\n")
    });
  }

  return files;
}

function buildGlobalProjectFiles({
  projectName = "",
  prompt = "",
  description = "",
  globalProjectContext = null,
  sourceWorkObject = null,
  sourceContent = ""
} = {}) {
  const normalizedPrompt = String(prompt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const blueprint = buildGlobalProjectBlueprint({
    prompt,
    projectName,
    description,
    globalProjectContext
  });
  const roadmapNeeded = /\b(roadmap|6 mois|6 month|6 months|timeline|jalon|milestone|produit)\b/.test(
    normalizedPrompt
  );
  const seed = globalProjectContext?.seed || null;
  const files = [
    {
      path: "project.blueprint.json",
      content: JSON.stringify(blueprint, null, 2)
    },
    {
      path: "experience/overview.md",
      content: buildProjectOverview({
        projectName,
        description,
        globalProjectContext
      })
    },
    ...(sourceWorkObject && sourceContent
      ? [
          {
            path: "content/source-work-object.md",
            content: sourceContent
          }
        ]
      : []),
    ...buildDimensionFiles(globalProjectContext),
    ...buildStudioFiles(globalProjectContext),
    ...buildMusicFiles(globalProjectContext)
  ];

  if (roadmapNeeded) {
    files.push({
      path: "experience/roadmap-6-months.md",
      content: [
        "# Roadmap produit sur 6 mois",
        "",
        "## Mois 1-2",
        `- ${seed?.nextSteps?.[0] || "Cadrage produit et validation terrain"}`,
        "- Prototype service et premiers retours utilisateurs",
        "",
        "## Mois 3-4",
        `- ${seed?.recommendedObjects?.[0] ? `Mise en place de ${seed.recommendedObjects[0]}` : "MVP operationnel"}`,
        "- Acquisition initiale et instrumentation produit",
        "",
        "## Mois 5-6",
        "- Optimisation retention et economies unitaires",
        `- ${seed?.recommendedObjects?.[1] ? `Extension avec ${seed.recommendedObjects[1]}` : "Extension des partenaires et iteration business"}`,
        ""
      ].join("\n")
    });
  }

  return {
    files,
    mainStructure: files.map((file) => file.path)
  };
}

function listWorkspaceFiles(rootPath, currentPath = rootPath, results = []) {
  if (!rootPath || !fs.existsSync(rootPath)) {
    return results;
  }

  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    if (["node_modules", ".git"].includes(entry.name)) {
      continue;
    }
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      listWorkspaceFiles(rootPath, absolutePath, results);
      continue;
    }
    results.push(relativePath);
  }
  return results;
}

function classifyDeliveryStatus({ install, run, validation, exportArtifact }) {
  if (run?.status === "failed") {
    return "run_failed";
  }
  if (validation?.status === "passed" && exportArtifact?.downloadUrl) {
    return "delivered";
  }
  if (exportArtifact?.downloadUrl) {
    return "exported";
  }
  if (run?.status === "passed" && validation?.status !== "passed") {
    return "validated";
  }
  if (install?.status === "passed") {
    return "installed";
  }
  return "scaffolded";
}

function summarizeStep(result = {}, fallbackStatus = "skipped") {
  return {
    status: result?.status || fallbackStatus,
    command: result?.command || "",
    durationMs: Number(result?.durationMs || 0),
    summary: String(result?.output || result?.error || "").slice(0, 600),
    analysis: result?.analysis || null
  };
}

function buildGitSupportFiles(gitResearch = null) {
  const repositories = gitResearch?.normalized?.repositories || [];
  const patterns = gitResearch?.normalized?.patterns || [];
  if (!repositories.length && !patterns.length) {
    return [];
  }

  return [
    {
      path: "references/github-patterns.md",
      content: [
        "# GitHub Patterns",
        "",
        gitResearch?.summaryText
          ? String(gitResearch.summaryText).slice(0, 4000)
          : "Reference patterns discovered from GitHub search to support this build.",
        "",
        repositories.length ? "## Reference repositories" : "",
        ...repositories.slice(0, 5).map((repo) => `- ${repo.fullName} (${repo.language || "unknown"})`),
        "",
        patterns.length ? "## Reused patterns" : "",
        ...patterns.slice(0, 8).map((pattern) => `- ${pattern.label || pattern.name || pattern.patternName || pattern}`),
        ""
      ]
        .filter(Boolean)
        .join("\n")
    },
    {
      path: "references/reference-repos.json",
      content: JSON.stringify(
        {
          repositories: repositories.slice(0, 5),
          patterns: patterns.slice(0, 8)
        },
        null,
        2
      )
    }
  ];
}

function buildDeliveryAnswer({
  projectName = "hydria-project",
  workspacePath = "",
  createdFiles = [],
  delivery = {},
  globalProject = null,
  gitSupport = null
} = {}) {
  const corrections = delivery.correctionsApplied || [];
  const exportBlock = delivery.export || {};
  const dimensions = globalProject?.dimensions || [];
  const capabilities = globalProject?.selectedCapabilities || [];
  const referenceRepos = gitSupport?.repositories || [];

  return [
    `J'ai cree le projet ${projectName}.`,
    globalProject?.summary ? globalProject.summary : "",
    "Statut",
    `- scaffold: ok`,
    `- install: ${delivery.install?.status || "skipped"}`,
    `- run: ${delivery.run?.status || "skipped"}`,
    `- validation: ${delivery.validation?.status || "skipped"}`,
    "Emplacement",
    `- ${workspacePath}`,
    exportBlock.downloadUrl ? "Export zip" : "",
    exportBlock.downloadUrl ? `- ${exportBlock.filename} -> ${exportBlock.downloadUrl}` : "",
    corrections.length ? "Corrections appliquees" : "",
    ...corrections.slice(0, 6).map((fix) => `- ${fix.summary}`),
    dimensions.length ? "Dimensions du projet" : "",
    ...dimensions.slice(0, 8).map((dimension) => `- ${dimension}`),
    capabilities.length ? "Capacites internes mobilisees" : "",
    ...capabilities.slice(0, 3).map((capability) => `- ${capability.label}`),
    referenceRepos.length ? "References GitHub utilisees" : "",
    ...referenceRepos.slice(0, 3).map((repo) => `- ${repo.fullName}`),
    createdFiles.length ? "Fichiers cles" : "",
    ...createdFiles.slice(0, 10).map((file) => `- ${file}`),
    delivery.nextCommand ? "Commande suivante" : "",
    delivery.nextCommand ? `- ${delivery.nextCommand}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export class ProjectBuilder {
  constructor({
    runtimeAdapter,
    sandboxRoot,
    sessionManager = null,
    artifactExporter = null
  }) {
    this.runtimeAdapter = runtimeAdapter;
    this.sandboxRoot = sandboxRoot;
    this.sessionManager = sessionManager;
    this.autoFixer = new ProjectAutoFixer({
      runtimeAdapter
    });
    this.artifactExporter =
      artifactExporter ||
      new ArtifactExporter({
        archiveService: new ProjectArchiveService({
          artifactRoot: agenticConfig.files.artifactExportRoot
        }),
        artifactRoot: agenticConfig.files.artifactExportRoot
      });
  }

  recordDeliveryAction(sessionId, payload = {}) {
    if (!sessionId || !this.sessionManager) {
      return;
    }

    this.sessionManager.appendAction(sessionId, {
      type: "project_delivery",
      at: new Date().toISOString(),
      ...payload
    });
    this.sessionManager.updateState(sessionId, {
      projectDelivery: {
        ...(this.sessionManager.getSession(sessionId)?.state?.projectDelivery || {}),
        ...payload
      }
    });
  }

  recordDeliveryError(sessionId, phase = "", result = null) {
    if (!sessionId || !this.sessionManager || !result || result.status !== "failed") {
      return;
    }

    this.sessionManager.recordError(sessionId, {
      stepId: `project:${phase}`,
      type: phase,
      error: result.output || result.error || `${phase} failed`
    });
  }

  createProjectWorkspace({ projectName = "hydria-project", projectId = "" } = {}) {
    const dirName = `${safeProjectDirName(projectName)}-${String(projectId || "workspace").slice(0, 8)}`;
    const workspacePath = path.join(this.sandboxRoot, dirName);
    fs.mkdirSync(workspacePath, { recursive: true });
    return workspacePath;
  }

  prepareProjectWorkspace(options = {}) {
    return this.createProjectWorkspace(options);
  }

  createProjectStructure({ workspacePath = "", directories = [] } = {}) {
    for (const directory of directories) {
      fs.mkdirSync(path.join(workspacePath, directory), { recursive: true });
    }
  }

  writeInitialFiles({ workspacePath = "", files = [] } = {}) {
    const createdFiles = [];

    for (const file of files) {
      const absolutePath = path.join(workspacePath, file.path);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, file.content, "utf8");
      createdFiles.push(file.path);
    }

    return createdFiles;
  }

  createProjectManifest({ workspacePath = "", manifest = {} } = {}) {
    const manifestPath = path.join(workspacePath, "hydria.manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    return manifestPath;
  }

  async scaffoldProject({
    project,
    prompt = "",
    executionIntent = null,
    sessionId = null,
    globalProjectContext = null,
    sourceWorkObject = null,
    sourceContent = "",
    supportContext = null
  } = {}) {
    const workspacePath =
      project?.workspacePath ||
      this.createProjectWorkspace({
        projectName: project?.name || "hydria-project",
        projectId: project?.id || "workspace"
      });
    const templateId = executionIntent?.scaffoldTemplate || "express_structured_api";
    const generatedAppScenario =
      templateId === "static_html_app"
        ? await generateAppScenarioWithLlm({
            projectName: project?.name || "Hydria Project",
            prompt,
            gitResearch: supportContext?.gitResearch || null
          })
        : null;
    const scaffold = buildScaffoldTemplate(
      templateId,
      safeProjectDirName(project?.name || "hydria-project"),
      {
        prompt,
        displayName: project?.name || "Hydria Project",
        gitResearch: supportContext?.gitResearch || null,
        generatedAppScenario
      }
    );
    const globalProjectFiles = buildGlobalProjectFiles({
      projectName: project?.name || "hydria-project",
      prompt,
      description: scaffold.description,
      globalProjectContext,
      sourceWorkObject,
      sourceContent
    });
    const gitSupportFiles = buildGitSupportFiles(supportContext?.gitResearch);

    this.createProjectStructure({
      workspacePath,
      directories: uniqueStrings([
        ...(scaffold.directories || []),
        ...globalProjectFiles.mainStructure.map((filePath) => path.dirname(filePath)),
        ...gitSupportFiles.map((file) => path.dirname(file.path))
      ])
    });
    const createdFiles = this.writeInitialFiles({
      workspacePath,
      files: [...(scaffold.files || []), ...globalProjectFiles.files, ...gitSupportFiles]
    });

    const manifestPath = this.createProjectManifest({
      workspacePath,
      manifest: {
        version: 1,
        generatedAt: new Date().toISOString(),
        projectId: project?.id || "",
        projectName: project?.name || "hydria-project",
        templateId,
        prompt,
        description: scaffold.description,
        mainStructure: uniqueStrings([
          ...(scaffold.mainStructure || []),
          ...globalProjectFiles.mainStructure,
          ...gitSupportFiles.map((file) => file.path)
        ]),
        globalProject: globalProjectContext || null,
        createdFiles,
        nextCommands: scaffold.nextCommands
      }
    });

    this.recordDeliveryAction(sessionId, {
      phase: "scaffold",
      status: "completed",
      workspacePath,
      createdFiles: createdFiles.length
    });

    return {
      success: true,
      action: "project_scaffold",
      templateId,
      projectName: project?.name || "hydria-project",
      workspacePath,
      createdFiles,
      mainStructure: uniqueStrings([
        ...(scaffold.mainStructure || []),
        ...globalProjectFiles.mainStructure,
        ...gitSupportFiles.map((file) => file.path)
      ]),
      nextCommands: scaffold.nextCommands,
      manifestPath,
      description: scaffold.description,
      globalProject: globalProjectContext || null,
      gitSupport: supportContext?.gitResearch?.normalized || null,
      sourceWorkObjectId: sourceWorkObject?.id || ""
    };
  }

  async executeDelivery({
    project,
    prompt = "",
    executionIntent = null,
    conversationId = null,
    userId = null,
    sessionId = null,
    globalProjectContext = null,
    activeWorkObject = null,
    activeWorkObjectContent = "",
    supportContext = null
  } = {}) {
    const scaffoldResult = await this.scaffoldProject({
      project,
      prompt,
      executionIntent,
      sessionId,
      globalProjectContext,
      sourceWorkObject: activeWorkObject,
      sourceContent: activeWorkObjectContent,
      supportContext
    });
    const workspacePath = scaffoldResult.workspacePath;
    const packageJson = readPackageJson(workspacePath);
    const isNodeProject = packageJson.exists;
    const packageManager = detectPackageManager(workspacePath);
    const policy = createRetryExecutionPolicy({ maxFixAttempts: 2 });

    let install = {
      status: "skipped",
      command: "",
      output: "",
      analysis: null
    };
    let run = {
      status: "skipped",
      command: "",
      output: "",
      analysis: null
    };
    let validation = {
      status: "skipped",
      build: { status: "skipped" },
      test: { status: "skipped" },
      readiness: {
        status: "skipped",
        issues: [],
        checks: {}
      }
    };
    let fixLoop = {
      attempts: [],
      correctionsApplied: [],
      issues: [],
      suggestedNextStep: isNodeProject ? "run_install" : "export_only"
    };
    const preflightCorrections = [];

    if (isNodeProject) {
      const envFix = await this.autoFixer.fixMissingEnv(workspacePath);
      if (envFix) {
        preflightCorrections.push(envFix);
        this.recordDeliveryAction(sessionId, {
          phase: "fix",
          status: "applied",
          attempt: 0,
          issue: "missing_env",
          fix: envFix.summary
        });
      }
      this.recordDeliveryAction(sessionId, {
        phase: "install",
        status: "running",
        packageManager
      });
      install = await runProjectInstall({
        runtimeAdapter: this.runtimeAdapter,
        workspacePath,
        packageManager
      });
      this.recordDeliveryError(sessionId, "install", install);
      this.recordDeliveryAction(sessionId, {
        phase: "install",
        status: install.status,
        command: install.command
      });

      const rerunInstall = async () => {
        const result = await runProjectInstall({
          runtimeAdapter: this.runtimeAdapter,
          workspacePath,
          packageManager
        });
        this.recordDeliveryError(sessionId, "install", result);
        this.recordDeliveryAction(sessionId, {
          phase: "install",
          status: result.status,
          command: result.command,
          retry: true
        });
        return result;
      };

      const runCommand = async () => {
        const result = await runProjectSmoke({
          runtimeAdapter: this.runtimeAdapter,
          workspacePath,
          packageManager
        });
        this.recordDeliveryError(sessionId, "run", result);
        this.recordDeliveryAction(sessionId, {
          phase: "run",
          status: result.status,
          command: result.command,
          retry: false
        });
        return result;
      };

      if (install.status === "passed") {
        run = await runCommand();
      }

      fixLoop = await runProjectFixLoop({
        policy,
        workspacePath,
        installResult: install,
        runResult: run,
        autoFixer: this.autoFixer,
        rerunInstall,
        rerunRun: async () => {
          const result = await runProjectSmoke({
            runtimeAdapter: this.runtimeAdapter,
            workspacePath,
            packageManager
          });
          this.recordDeliveryError(sessionId, "run", result);
          this.recordDeliveryAction(sessionId, {
            phase: "run",
            status: result.status,
            command: result.command,
            retry: true
          });
          return result;
        },
        onAttempt: async ({ attempt, analysis, fix }) => {
          this.recordDeliveryAction(sessionId, {
            phase: "fix",
            status: "applied",
            attempt,
            issue: analysis.type,
            fix: fix.summary
          });
        }
      });

      install = fixLoop.install || install;
      run = fixLoop.run || run;

      this.recordDeliveryAction(sessionId, {
        phase: "validate",
        status: "running"
      });
      validation = await runProjectValidation({
        runtimeAdapter: this.runtimeAdapter,
        workspacePath,
        packageManager,
        installResult: install,
        runResult: run,
        manifestPath: scaffoldResult.manifestPath,
        createdFiles: scaffoldResult.createdFiles
      });
      this.recordDeliveryAction(sessionId, {
        phase: "validate",
        status: validation.status
      });
    }

    this.recordDeliveryAction(sessionId, {
      phase: "export",
      status: "running"
    });
    const exportResult = await this.artifactExporter.exportProject({
      project,
      workspacePath,
      templateId: scaffoldResult.templateId,
      createdFiles: scaffoldResult.createdFiles,
      mainStructure: scaffoldResult.mainStructure,
      nextCommands: scaffoldResult.nextCommands,
      globalProject: scaffoldResult.globalProject,
      delivery: {
        status: classifyDeliveryStatus({
          install,
          run,
          validation,
          exportArtifact: null
        }),
        packageManager,
        install: summarizeStep(install),
        run: summarizeStep(run),
        validation: {
          status: validation.status,
          checks: validation.readiness?.checks || {},
          issues: validation.readiness?.issues || [],
          buildStatus: validation.build?.status || "skipped",
          testStatus: validation.test?.status || "skipped"
        },
        correctionsApplied: [...preflightCorrections, ...(fixLoop.correctionsApplied || [])]
      },
      conversationId,
      userId
    });
    this.recordDeliveryAction(sessionId, {
      phase: "export",
      status: "completed",
      artifactId: exportResult.artifact.id
    });

    const actualFiles = reorderMainFiles(listWorkspaceFiles(workspacePath), [
      "README.md",
      "project.blueprint.json",
      "experience/overview.md",
      "src/server.js",
      "src/app.js",
      "package.json",
      "studio/creative-brief.md",
      "studio/storyboard.json",
      "audio/audio-brief.md",
      "audio/track-plan.json",
      "hydria.manifest.json"
    ]);
    const delivery = {
      status: classifyDeliveryStatus({
        install,
        run,
        validation,
        exportArtifact: exportResult.artifact
      }),
      workspacePath,
      packageManager,
      install: summarizeStep(install),
      run: summarizeStep(run),
      validation: {
        status: validation.status,
        checks: validation.readiness?.checks || {},
        issues: validation.readiness?.issues || [],
        buildStatus: validation.build?.status || "skipped",
        testStatus: validation.test?.status || "skipped"
      },
      correctionsApplied: [...preflightCorrections, ...(fixLoop.correctionsApplied || [])],
      export: {
        artifactId: exportResult.artifact.id,
        downloadUrl: exportResult.artifact.downloadUrl,
        filename: exportResult.artifact.filename,
        sizeBytes: exportResult.artifact.sizeBytes
      },
      mainFiles: actualFiles.slice(0, 20),
      nextCommand:
        run.command ||
        scaffoldResult.nextCommands?.[0] ||
        globalProjectContext?.nextHydriaAction ||
        "",
      deliveryManifestPath: exportResult.manifestPath,
      logs: {
        install: install.output || "",
        run: run.output || ""
      }
    };

    const finalAnswer = buildDeliveryAnswer({
      projectName: scaffoldResult.projectName,
      workspacePath,
      createdFiles: delivery.mainFiles,
      delivery,
      globalProject: scaffoldResult.globalProject,
      gitSupport: scaffoldResult.gitSupport
    });

    return {
      ...scaffoldResult,
      action: "project_delivery",
      mainFiles: delivery.mainFiles,
      nextCommand: delivery.nextCommand,
      exportArtifactId: exportResult.artifact.id,
      exportDownloadUrl: exportResult.artifact.downloadUrl,
      exportFilename: exportResult.artifact.filename,
      deliveryManifestPath: exportResult.manifestPath,
      globalProject: scaffoldResult.globalProject,
      sourceWorkObjectId: scaffoldResult.sourceWorkObjectId || "",
      delivery,
      build: validation.build || { status: "skipped" },
      test: validation.test || { status: "skipped" },
      fixLoop,
      deployPlan: buildDeployPlan({ project }),
      monitorPlan: buildMonitorPlan({ project }),
      artifacts: [
        {
          type: "project_workspace",
          workspacePath,
          projectName: scaffoldResult.projectName
        },
        {
          type: "project_manifest",
          path: scaffoldResult.manifestPath
        },
        exportResult.artifact
      ],
      finalAnswer
    };
  }

  async run({ project, critique }) {
    if (!project?.workspacePath) {
      return {
        status: "skipped",
        delivery: null,
        build: { status: "skipped" },
        test: { status: "skipped" }
      };
    }

    const packageJson = readPackageJson(project.workspacePath);
    const packageManager = detectPackageManager(project.workspacePath);
    const build = await runProjectBuild({
      runtimeAdapter: this.runtimeAdapter,
      workspacePath: project.workspacePath,
      commands: packageJson.data?.scripts?.build ? [buildCommand(packageManager, "build")] : []
    });
    const test = await runProjectTests({
      runtimeAdapter: this.runtimeAdapter,
      workspacePath: project.workspacePath,
      commands: packageJson.data?.scripts?.test ? [buildCommand(packageManager, "test")] : []
    });

    return {
      status:
        build.status === "failed" || test.status === "failed"
          ? "needs_fix"
          : "completed",
      delivery: {
        packageManager,
        build,
        test
      },
      build,
      test,
      deployPlan: buildDeployPlan({ project }),
      monitorPlan: buildMonitorPlan({ project }),
      fixLoop: {
        issues: (critique?.score || 0) < 65 ? ["quality_below_target"] : [],
        suggestedNextStep: (critique?.score || 0) < 65 ? "run_fix_pass" : "ready_for_delivery"
      }
    };
  }
}

export default ProjectBuilder;
