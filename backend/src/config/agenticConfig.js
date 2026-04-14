import fs from "node:fs";
import path from "node:path";
import baseConfig from "../../config/hydria.config.js";

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseList(value, fallback = []) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstDefined(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

function resolveGitHubToken(env) {
  return firstDefined(
    env.HYDRIA_GITHUB_TOKEN,
    env.GITHUB_TOKEN,
    env.HYDRIA,
    env.hydria
  );
}

const env = process.env;
const dataDir = path.join(baseConfig.paths.rootDir, "data", "agentic");

fs.mkdirSync(dataDir, { recursive: true });

const agenticConfig = {
  enabled: parseBoolean(env.HYDRIA_AGENTIC_ENABLED, true),
  useLegacyFallback: parseBoolean(env.HYDRIA_AGENTIC_USE_LEGACY_FALLBACK, false),
  maxPlanSteps: Math.max(3, parseInteger(env.HYDRIA_AGENTIC_MAX_PLAN_STEPS, 8)),
  maxMemoryHits: Math.max(1, parseInteger(env.HYDRIA_AGENTIC_MAX_MEMORY_HITS, 4)),
  maxKnowledgeHits: Math.max(1, parseInteger(env.HYDRIA_AGENTIC_MAX_KNOWLEDGE_HITS, 4)),
  enableCritic: parseBoolean(env.HYDRIA_AGENTIC_ENABLE_CRITIC, true),
  enableKnowledgeIngestion: parseBoolean(
    env.HYDRIA_AGENTIC_ENABLE_KNOWLEDGE_INGESTION,
    true
  ),
  enableKnowledgeSearch: parseBoolean(
    env.HYDRIA_AGENTIC_ENABLE_KNOWLEDGE_SEARCH,
    true
  ),
  enableTaskMemory: parseBoolean(env.HYDRIA_AGENTIC_ENABLE_TASK_MEMORY, true),
  enableAutonomousArtifacts: parseBoolean(
    env.HYDRIA_AGENTIC_ENABLE_AUTONOMOUS_ARTIFACTS,
    true
  ),
  minCriticScoreForSuccess: Math.max(
    1,
    parseInteger(env.HYDRIA_AGENTIC_MIN_CRITIC_SCORE, 58)
  ),
  dataDir,
  files: {
    memoryStore: path.join(dataDir, "memory-store.json"),
    knowledgeStore: path.join(dataDir, "knowledge-store.json"),
    learningStore: path.join(dataDir, "learning-store.json"),
    patternLibrary: path.join(dataDir, "pattern-library.json"),
    projectStore: path.join(dataDir, "project-store.json"),
    workObjectStore: path.join(dataDir, "work-object-store.json"),
    workObjectRoot: path.join(dataDir, "work-objects"),
    artifactExportRoot: path.join(dataDir, "artifacts"),
    evalLog: path.join(dataDir, "eval-log.jsonl"),
    toolLog: path.join(dataDir, "tool-usage.jsonl"),
    benchmarkLog: path.join(dataDir, "benchmark-log.jsonl"),
    runtimeState: path.join(dataDir, "runtime-state.json"),
    runtimeWorkObjectState: path.join(dataDir, "runtime-work-object-state.json"),
    evolutionFeedback: path.join(dataDir, "evolution-feedback.json"),
    realworldBenchmark: path.join(dataDir, "realworld-benchmark.json")
  },
  github: {
    enabled: parseBoolean(env.HYDRIA_GITHUB_ENABLED, true),
    token: resolveGitHubToken(env),
    apiBaseUrl:
      env.HYDRIA_GITHUB_API_BASE_URL || "https://api.github.com",
    maxRepoResults: Math.max(
      1,
      parseInteger(env.HYDRIA_GITHUB_MAX_REPO_RESULTS, 8)
    ),
    maxCodeResults: Math.max(
      1,
      parseInteger(env.HYDRIA_GITHUB_MAX_CODE_RESULTS, 8)
    ),
    maxAnalyzedRepos: Math.max(
      1,
      parseInteger(env.HYDRIA_GITHUB_MAX_ANALYZED_REPOS, 3)
    ),
    minStars: Math.max(0, parseInteger(env.HYDRIA_GITHUB_MIN_STARS, 25)),
    cloneRoot: path.join(dataDir, "github-clones")
  },
  runtime: {
    enabled: parseBoolean(env.HYDRIA_RUNTIME_ENABLED, true),
    maxActionsPerSession: Math.max(
      1,
      parseInteger(env.HYDRIA_RUNTIME_MAX_ACTIONS_PER_SESSION, 24)
    ),
    maxStepRetries: Math.max(
      0,
      Math.min(3, parseInteger(env.HYDRIA_RUNTIME_MAX_STEP_RETRIES, 1))
    ),
    persistSessions: parseBoolean(env.HYDRIA_RUNTIME_PERSIST_SESSIONS, true),
    sandboxRoot: path.join(
      baseConfig.paths.rootDir,
      firstDefined(env.HYDRIA_RUNTIME_SANDBOX_DIR, "data/agentic/sandbox")
    ),
    allowShell: parseBoolean(env.HYDRIA_RUNTIME_ALLOW_SHELL, false),
    allowNetwork: parseBoolean(env.HYDRIA_RUNTIME_ALLOW_NETWORK, true),
    allowBrowser: parseBoolean(env.HYDRIA_RUNTIME_ALLOW_BROWSER, true),
    allowGitClone: parseBoolean(env.HYDRIA_RUNTIME_ALLOW_GIT_CLONE, true),
    toolAllowlist: parseList(env.HYDRIA_RUNTIME_TOOL_ALLOWLIST, []),
    browserActionAllowlist: parseList(
      env.HYDRIA_RUNTIME_BROWSER_ACTION_ALLOWLIST,
      ["inspect", "links", "click", "fill", "screenshot"]
    )
  },
  memory: {
    shortTermLimit: Math.max(
      4,
      parseInteger(env.HYDRIA_MEMORY_SHORT_TERM_LIMIT, 18)
    ),
    midTermLimit: Math.max(
      4,
      parseInteger(env.HYDRIA_MEMORY_MID_TERM_LIMIT, 36)
    ),
    longTermLimit: Math.max(
      12,
      parseInteger(env.HYDRIA_MEMORY_LONG_TERM_LIMIT, 120)
    ),
    taskOutcomeLimit: Math.max(
      20,
      parseInteger(env.HYDRIA_MEMORY_TASK_OUTCOME_LIMIT, 160)
    ),
    consolidateEveryTurns: Math.max(
      2,
      parseInteger(env.HYDRIA_MEMORY_CONSOLIDATE_EVERY_TURNS, 6)
    )
  },
  knowledge: {
    chunkSize: Math.max(250, parseInteger(env.HYDRIA_KNOWLEDGE_CHUNK_SIZE, 900)),
    chunkOverlap: Math.max(
      40,
      parseInteger(env.HYDRIA_KNOWLEDGE_CHUNK_OVERLAP, 140)
    ),
    maxChunksPerDocument: Math.max(
      4,
      parseInteger(env.HYDRIA_KNOWLEDGE_MAX_CHUNKS_PER_DOCUMENT, 24)
    ),
    maxSearchHits: Math.max(
      1,
      parseInteger(env.HYDRIA_KNOWLEDGE_MAX_SEARCH_HITS, 6)
    )
  },
  learning: {
    enabled: parseBoolean(env.HYDRIA_LEARNING_ENABLED, true),
    maxRelevant: Math.max(1, parseInteger(env.HYDRIA_LEARNING_MAX_RELEVANT, 4)),
    minConfidence: Math.max(
      0,
      Math.min(1, Number.parseFloat(env.HYDRIA_LEARNING_MIN_CONFIDENCE || "0.45"))
    ),
    maxItems: Math.max(50, parseInteger(env.HYDRIA_LEARNING_MAX_ITEMS, 400))
  },
  evals: {
    enabled: parseBoolean(env.HYDRIA_EVALS_ENABLED, true),
    benchmarkEnabled: parseBoolean(env.HYDRIA_EVALS_BENCHMARK_ENABLED, true),
    minImprovementDelta: Math.max(
      1,
      parseInteger(env.HYDRIA_EVALS_MIN_IMPROVEMENT_DELTA, 4)
    )
  },
  evolution: {
    enabled: parseBoolean(env.HYDRIA_EVOLUTION_ENABLED, true),
    retryBelowScore: Math.max(
      1,
      parseInteger(env.HYDRIA_EVOLUTION_RETRY_BELOW_SCORE, 62)
    ),
    maxRetries: Math.max(0, Math.min(3, parseInteger(env.HYDRIA_EVOLUTION_MAX_RETRIES, 3)))
  },
  internalCapabilities: {
    enabled: parseBoolean(env.HYDRIA_INTERNAL_CAPABILITIES_ENABLED, true),
    studioRoots: parseList(env.HYDRIA_STUDIO_ROOTS, [
      "F:\\hydria-studio",
      "F:\\hydria-studio\\"
    ]),
    musicRoots: parseList(env.HYDRIA_MUSIC_ROOTS, [
      "F:\\hydria music",
      "F:\\hydria-music"
    ])
  },
  shell: {
    enabled: parseBoolean(env.HYDRIA_AGENTIC_ENABLE_SHELL, false),
    allowlist: parseList(env.HYDRIA_AGENTIC_SHELL_ALLOWLIST, [
      "node",
      "npm",
      "git",
      "python",
      "python3"
    ])
  }
};

fs.mkdirSync(agenticConfig.github.cloneRoot, { recursive: true });
fs.mkdirSync(agenticConfig.runtime.sandboxRoot, { recursive: true });
fs.mkdirSync(agenticConfig.files.workObjectRoot, { recursive: true });
fs.mkdirSync(agenticConfig.files.artifactExportRoot, { recursive: true });

export default agenticConfig;
