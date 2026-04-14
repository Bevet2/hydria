import fs from "node:fs";
import path from "node:path";

function normalizePath(value = "") {
  return String(value || "").replace(/\//g, "\\").trim();
}

function firstExistingPath(candidates = []) {
  for (const candidate of candidates) {
    const resolved = normalizePath(candidate);
    if (resolved && fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return "";
}

function safeRead(relativePath = "") {
  try {
    return fs.readFileSync(relativePath, "utf8");
  } catch {
    return "";
  }
}

function readTopLevelStructure(rootPath = "") {
  if (!rootPath || !fs.existsSync(rootPath)) {
    return [];
  }

  try {
    return fs
      .readdirSync(rootPath, { withFileTypes: true })
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file"
      }));
  } catch {
    return [];
  }
}

function existingRelativeFiles(rootPath = "", files = []) {
  return files.filter((relativeFile) =>
    fs.existsSync(path.join(rootPath, relativeFile))
  );
}

function extractStages(fileContent = "", fallbackStages = []) {
  const matches = new Set();
  const patterns = [
    /\b(worldbuilding|characters|plot-arcs|chapters|scenes|storyboard|image-prompts|export)\b/gi,
    /\b(brief|composition|lyrics|generation|analysis|stems|dj_edit|qc|export)\b/gi
  ];

  for (const pattern of patterns) {
    for (const match of fileContent.matchAll(pattern)) {
      matches.add(String(match[1] || match[0]).toLowerCase());
    }
  }

  return matches.size ? [...matches] : fallbackStages;
}

function buildStudioCapability(rootPath = "") {
  const knownFiles = existingRelativeFiles(rootPath, [
    "README.md",
    "backend/src/services/pipelineOrchestrator.ts",
    "backend/src/services/visualPreflightService.ts",
    "backend/src/services/visualReviewService.ts",
    "backend/src/services/projectService.ts",
    "backend/src/services/exportService.ts",
    "backend/src/utils/promptBuilder.ts",
    "backend/src/utils/scenePagePlanner.ts"
  ]);
  const pipelineSource = safeRead(
    path.join(rootPath, "backend/src/services/pipelineOrchestrator.ts")
  );

  return {
    id: "studio",
    label: "Hydria Studio",
    available: Boolean(rootPath),
    sourcePath: rootPath,
    type: "internal_capability",
    modality: "narrative_visual",
    topLevelStructure: readTopLevelStructure(rootPath),
    keyFiles: knownFiles,
    strengths: [
      "storytelling",
      "worldbuilding",
      "creative_guidance",
      "storyboard",
      "visual_prompting",
      "export_bundle"
    ],
    dimensions: ["text", "narrative", "visual", "presentation"],
    stages: extractStages(pipelineSource, [
      "worldbuilding",
      "characters",
      "plot-arcs",
      "chapters",
      "scenes",
      "storyboard",
      "image-prompts",
      "export"
    ]),
    summary:
      "Capacite interne issue de hydria-studio pour structurer un projet narratif, visuel et presentable."
  };
}

function buildMusicCapability(rootPath = "") {
  const knownFiles = existingRelativeFiles(rootPath, [
    "README.md",
    "backend/app/orchestration/pipeline.py",
    "backend/app/agents/registry.py",
    "backend/app/integrations/music_generation.py",
    "backend/app/integrations/mock_audio_provider.py",
    "backend/app/api/routes/projects.py",
    "backend/app/storage/paths.py"
  ]);
  const pipelineSource = safeRead(
    path.join(rootPath, "backend/app/orchestration/pipeline.py")
  );

  return {
    id: "music",
    label: "Hydria Music",
    available: Boolean(rootPath),
    sourcePath: rootPath,
    type: "internal_capability",
    modality: "audio",
    topLevelStructure: readTopLevelStructure(rootPath),
    keyFiles: knownFiles,
    strengths: [
      "audio_briefing",
      "composition",
      "lyrics",
      "generation",
      "stems",
      "quality_control",
      "audio_export"
    ],
    dimensions: ["audio", "narrative", "data"],
    stages: extractStages(pipelineSource, [
      "brief",
      "composition",
      "lyrics",
      "generation",
      "analysis",
      "stems",
      "dj_edit",
      "qc",
      "export"
    ]),
    summary:
      "Capacite interne issue de hydria music pour preparer un projet audio, ses cues et son export."
  };
}

export class InternalCapabilityDiscovery {
  constructor({
    studioRoots = [],
    musicRoots = []
  } = {}) {
    this.studioRoots = studioRoots;
    this.musicRoots = musicRoots;
    this.cache = null;
  }

  discover() {
    if (this.cache) {
      return this.cache;
    }

    const studioRoot = firstExistingPath(this.studioRoots);
    const musicRoot = firstExistingPath(this.musicRoots);

    this.cache = [
      buildStudioCapability(studioRoot),
      buildMusicCapability(musicRoot)
    ].filter((capability) => capability.available);

    return this.cache;
  }

  listCapabilities() {
    return this.discover();
  }

  getCapability(capabilityId = "") {
    return this.discover().find((capability) => capability.id === capabilityId) || null;
  }
}

export default InternalCapabilityDiscovery;
