import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(backendDir, "..");

dotenv.config({ path: path.join(backendDir, ".env") });

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

function normalizeRoutingMode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    ["core-only", "core-first", "local-only", "openrouter-only", "openrouter-first", "local-first"].includes(
      normalized
    )
  ) {
    return normalized;
  }

  return "local-only";
}

function firstDefined(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

const env = process.env;

const models = {
  defaultFree: firstDefined(env.DEFAULT_FREE_MODEL, env.LOCAL_DEFAULT_MODEL, "qwen2.5:7b"),
  fallback: firstDefined(
    env.FALLBACK_MODEL,
    env.DEFAULT_FREE_MODEL,
    env.LOCAL_DEFAULT_MODEL,
    "qwen2.5:7b"
  )
};

models.freeGeneral = firstDefined(
  env.FREE_GENERAL_MODEL,
  models.defaultFree,
  models.fallback
);
models.freeCode = firstDefined(
  env.FREE_CODE_MODEL,
  models.freeGeneral,
  models.defaultFree,
  models.fallback
);
models.freeReasoning = firstDefined(
  env.FREE_REASONING_MODEL,
  models.freeGeneral,
  models.defaultFree,
  models.fallback
);
models.freeFast = firstDefined(
  env.FREE_FAST_MODEL,
  models.freeGeneral,
  models.defaultFree,
  models.fallback
);
models.freeAgent = firstDefined(
  env.FREE_AGENT_MODEL,
  models.freeReasoning,
  models.freeGeneral,
  models.fallback
);
models.premiumGeneral = firstDefined(
  env.PREMIUM_GENERAL_MODEL,
  "qwen/qwen3.6-plus",
  models.freeGeneral,
  models.defaultFree,
  models.fallback
);
models.premiumReasoning = firstDefined(
  env.PREMIUM_REASONING_MODEL,
  "openai/gpt-5.4-mini",
  models.premiumGeneral,
  models.freeReasoning,
  models.defaultFree,
  models.fallback
);
models.premiumCode = firstDefined(
  env.PREMIUM_CODE_MODEL,
  "openai/gpt-5.3-codex",
  models.premiumGeneral,
  models.freeCode,
  models.defaultFree,
  models.fallback
);
models.premiumCreative = firstDefined(
  env.PREMIUM_CREATIVE_MODEL,
  "anthropic/claude-sonnet-4.6",
  models.premiumGeneral,
  models.defaultFree,
  models.fallback
);
models.premiumFast = firstDefined(
  env.PREMIUM_FAST_MODEL,
  models.premiumReasoning,
  models.premiumGeneral,
  models.defaultFree,
  models.fallback
);
models.premiumAgent = firstDefined(
  env.PREMIUM_AGENT_MODEL,
  models.premiumCreative,
  models.premiumReasoning,
  models.premiumGeneral,
  models.defaultFree,
  models.fallback
);

const localModels = {
  default: firstDefined(env.LOCAL_DEFAULT_MODEL, "qwen2.5:7b"),
  fallback: firstDefined(env.LOCAL_FALLBACK_MODEL, env.LOCAL_DEFAULT_MODEL, "qwen2.5:7b")
};

localModels.general = firstDefined(
  env.LOCAL_GENERAL_MODEL,
  localModels.default,
  localModels.fallback
);
localModels.code = firstDefined(
  env.LOCAL_CODE_MODEL,
  localModels.general,
  localModels.default,
  localModels.fallback
);
localModels.reasoning = firstDefined(
  env.LOCAL_REASONING_MODEL,
  localModels.general,
  localModels.default,
  localModels.fallback
);
localModels.fast = firstDefined(
  env.LOCAL_FAST_MODEL,
  localModels.general,
  localModels.default,
  localModels.fallback
);
localModels.agent = firstDefined(
  env.LOCAL_AGENT_MODEL,
  localModels.reasoning,
  localModels.general,
  localModels.fallback
);

const config = {
  appName: env.OPENROUTER_APP_NAME || "Hydria V1",
  port: parseInteger(env.PORT, 3001),
  strategy: {
    name: "free-first",
    enableMultiAnswer: parseBoolean(env.ENABLE_MULTI_ANSWER, true),
    maxCandidates: Math.max(1, parseInteger(env.MAX_CANDIDATES, 2)),
    enableJudge: parseBoolean(env.ENABLE_JUDGE, false),
    judgeMode: "heuristic",
    requestTimeoutMs: Math.max(5000, parseInteger(env.REQUEST_TIMEOUT_MS, 45000))
  },
  openrouter: {
    apiKey: env.OPENROUTER_API_KEY || "",
    referer: env.OPENROUTER_REFERER || "http://localhost:3001",
    enabled: Boolean(env.OPENROUTER_API_KEY),
    baseUrl: firstDefined(
      env.OPENROUTER_BASE_URL,
      "https://openrouter.ai/api/v1/chat/completions"
    ),
    models
  },
  externalHydria: {
    apiUrl: firstDefined(
      env.HYDRIA_API_URL,
      "https://app.hydria.click/api/v1/ask"
    ),
    coreAskUrl: firstDefined(
      env.HYDRIA_CORE_ASK_URL,
      "https://app.hydria.click/api/core/ask"
    ),
    coreStreamUrl: firstDefined(
      env.HYDRIA_CORE_STREAM_URL,
      env.HYDRIA_CORE_ASK_URL,
      "https://app.hydria.click/api/core/ask"
    ),
    capabilitiesUrl: firstDefined(
      env.HYDRIA_CAPABILITIES_URL,
      "https://app.hydria.click/api/v1/capabilities"
    ),
    interactionsUrl: firstDefined(
      env.HYDRIA_INTERACTIONS_URL,
      "https://app.hydria.click/api/v1/interactions"
    ),
    apiKey: env.HYDRIA_API_KEY || "",
    timeoutMs: Math.max(5000, parseInteger(env.HYDRIA_API_TIMEOUT_MS, 45000)),
    advisorEnabled: parseBoolean(env.HYDRIA_EXTERNAL_ADVISOR_ENABLED, true),
    advisorTimeoutMs: Math.max(
      3000,
      parseInteger(env.HYDRIA_EXTERNAL_ADVISOR_TIMEOUT_MS, 12000)
    ),
    controlEnabled: parseBoolean(env.HYDRIA_EXTERNAL_CONTROL_ENABLED, true),
    controlTimeoutMs: Math.max(
      180000,
      parseInteger(env.HYDRIA_EXTERNAL_CONTROL_TIMEOUT_MS, 180000)
    ),
    controlMaxActions: Math.max(
      1,
      parseInteger(env.HYDRIA_EXTERNAL_CONTROL_MAX_ACTIONS, 4)
    ),
    controlToken: env.HYDRIA_CONTROL_TOKEN || "",
    enabled: Boolean(env.HYDRIA_API_KEY)
  },
  crm: {
    apiUrl: firstDefined(env.CRM_API_URL, "http://127.0.0.1:4010/api").replace(/\/+$/, ""),
    publicApiUrl: firstDefined(env.CRM_PUBLIC_API_URL, "/crm-api").replace(/\/+$/, ""),
    webUrl: firstDefined(env.CRM_WEB_URL, "/crm/"),
    integrationSecret: firstDefined(
      env.CRM_INTEGRATION_SECRET,
      "hydria-crm-local-integration-secret-change-me"
    ),
    timeoutMs: Math.max(3000, parseInteger(env.CRM_API_TIMEOUT_MS, 15000))
  },
  hydriaCore: {
    enabled: parseBoolean(env.HYDRIA_CORE_ENABLED, false),
    baseUrl: firstDefined(env.HYDRIA_CORE_BASE_URL, "https://app.hydria.click/api/v1"),
    apiKey: env.HYDRIA_CORE_API_KEY || "",
    timeoutMs: Math.max(5000, parseInteger(env.HYDRIA_CORE_TIMEOUT_MS, 180000)),
    includeSources: parseBoolean(env.HYDRIA_CORE_INCLUDE_SOURCES, true),
    includeTrace: parseBoolean(env.HYDRIA_CORE_INCLUDE_TRACE, false),
    includeDiagnostics: parseBoolean(env.HYDRIA_CORE_INCLUDE_DIAGNOSTICS, false),
    maxInputChars: Math.max(2000, parseInteger(env.HYDRIA_CORE_MAX_INPUT_CHARS, 24000))
  },
  localLlm: {
    enabled: parseBoolean(env.LOCAL_LLM_ENABLED, true),
    providerType: firstDefined(env.LOCAL_LLM_PROVIDER, "ollama").toLowerCase(),
    baseUrl: firstDefined(env.LOCAL_LLM_BASE_URL, "http://127.0.0.1:11434"),
    apiKey: env.LOCAL_LLM_API_KEY || "",
    timeoutMs: Math.max(5000, parseInteger(env.LOCAL_LLM_TIMEOUT_MS, 120000)),
    modelsDir: firstDefined(env.OLLAMA_MODELS_DIR, ""),
    models: localModels
  },
  llm: {
    enabled: false,
    routingMode: normalizeRoutingMode(env.LLM_ROUTING_MODE)
  },
  paths: {
    rootDir,
    backendDir,
    frontendDir: path.join(rootDir, "frontend"),
    crmWebDistDir: path.join(rootDir, "crm", "apps", "web", "dist"),
    databaseFile: path.join(rootDir, "data", "hydria.sqlite"),
    generatedArtifactsDir: path.join(rootDir, "data", "generated"),
    generatedArtifactsIndex: path.join(rootDir, "data", "generated", "artifacts.json"),
    uploadTempDir: path.join(rootDir, "data", "uploads-temp"),
    schemaFile: path.join(backendDir, "db", "schema.sql"),
    curatedApiCatalog: path.join(rootDir, "data", "api-catalog", "curated-apis.json"),
    customApiCatalog: path.join(rootDir, "data", "api-catalog", "custom-apis.json")
  },
  attachments: {
    maxFiles: Math.max(1, parseInteger(env.MAX_ATTACHMENTS, 6)),
    maxFileSizeBytes:
      Math.max(1, parseInteger(env.MAX_ATTACHMENT_SIZE_MB, 15)) * 1024 * 1024,
    maxExtractCharsPerFile: Math.max(
      1000,
      parseInteger(env.MAX_ATTACHMENT_EXTRACT_CHARS, 12000)
    ),
    maxTotalExtractChars: Math.max(
      2000,
      parseInteger(env.MAX_TOTAL_ATTACHMENT_CHARS, 24000)
    ),
    enableOcr: parseBoolean(env.ENABLE_ATTACHMENT_OCR, true),
    ocrLanguages: firstDefined(env.OCR_LANGUAGES, "eng+fra")
  },
  web: {
    enabled: parseBoolean(env.ENABLE_WEB_ACCESS, true),
    maxSearchResults: Math.max(1, parseInteger(env.MAX_WEB_RESULTS, 5)),
    maxReadPages: Math.max(1, parseInteger(env.MAX_WEB_PAGES_PER_REQUEST, 2)),
    enableBrowserFetch: parseBoolean(env.ENABLE_BROWSER_FETCH, true)
  },
  tools: {
    enabled: parseBoolean(env.ENABLE_LOCAL_TOOLS, true),
    workspaceRoot: firstDefined(env.TOOLS_WORKSPACE_ROOT, rootDir),
    timeoutMs: Math.max(3000, parseInteger(env.TOOL_TIMEOUT_MS, 45000)),
    maxOutputChars: Math.max(1000, parseInteger(env.MAX_TOOL_OUTPUT_CHARS, 12000)),
    maxFilesScanned: Math.max(100, parseInteger(env.MAX_TOOL_FILES_SCANNED, 1200)),
    maxRelevantFiles: Math.max(1, parseInteger(env.MAX_TOOL_RELEVANT_FILES, 6)),
    enableBrowserPreview: parseBoolean(env.ENABLE_BROWSER_PREVIEW, true)
  },
  externalKeys: {
    gnews: env.GNEWS_API_KEY || "",
    alphaVantage: env.ALPHA_VANTAGE_API_KEY || "",
    omdb: env.OMDB_API_KEY || "",
    theSportsDb: env.THESPORTSDB_API_KEY || ""
  }
};

// OpenRouter is only active when no local or core backend is available.
if (config.localLlm.enabled || config.hydriaCore.enabled) {
  config.openrouter.enabled = false;
}
config.llm.enabled = config.hydriaCore.enabled || config.localLlm.enabled || config.openrouter.enabled;

export default config;
