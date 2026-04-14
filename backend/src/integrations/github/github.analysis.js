import fs from "node:fs";
import path from "node:path";
import { getFileContent, getLocalRepoStructure, getRepoStructure } from "./github.repo.js";
import { extractRepoPatterns } from "./repoPatternExtractor.js";

function safeParseJson(value = "") {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function truncate(value = "", maxChars = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

function safeReadLocalFile(filePath = "", maxChars = 24000) {
  try {
    return fs.readFileSync(filePath, "utf8").slice(0, maxChars);
  } catch {
    return "";
  }
}

function listPaths(items = [], regex) {
  return items.filter((item) => regex.test(item.path));
}

function hasPath(items = [], regex) {
  return items.some((item) => regex.test(item.path));
}

function topLevelDirectories(items = []) {
  return [...new Set(
    items
      .map((item) => item.path.split("/")[0])
      .filter(Boolean)
  )];
}

function selectKeyFiles(items = []) {
  const preferred = [
    /^README\.md$/i,
    /^package\.json$/i,
    /^tsconfig\.json$/i,
    /^requirements\.txt$/i,
    /^pyproject\.toml$/i,
    /^Cargo\.toml$/i,
    /^go\.mod$/i,
    /^Dockerfile$/i,
    /^docker-compose\.ya?ml$/i
  ];

  const selected = [];

  for (const regex of preferred) {
    const match = items.find((item) => regex.test(item.path));
    if (match) {
      selected.push(match.path);
    }
  }

  return selected.slice(0, 8);
}

function detectStackFromPackageJson(pkg = {}) {
  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };
  const dependencyNames = Object.keys(dependencies);
  const frameworks = [];

  if (dependencyNames.some((name) => /^express$|^fastify$|^koa$/.test(name))) {
    frameworks.push("node-backend");
  }
  if (dependencyNames.some((name) => /^react$|^next$|^@mui\//.test(name))) {
    frameworks.push("react");
  }
  if (dependencyNames.some((name) => /^vue$|^nuxt$/.test(name))) {
    frameworks.push("vue");
  }
  if (dependencyNames.some((name) => /passport|jsonwebtoken|next-auth|lucia|auth/i.test(name))) {
    frameworks.push("auth");
  }
  if (dependencyNames.some((name) => /octokit|probot|github/i.test(name))) {
    frameworks.push("github-integration");
  }
  if (dependencyNames.some((name) => /vitest|jest|playwright|cypress/i.test(name))) {
    frameworks.push("testing");
  }

  return {
    packageName: pkg.name || "",
    scripts: Object.keys(pkg.scripts || {}).slice(0, 8),
    dependencies: dependencyNames.slice(0, 20),
    frameworks
  };
}

export function detectRepoStack(analysis = {}) {
  const keyFiles = analysis.keyFiles || {};
  const structure = analysis.structure || {};
  const items = structure.items || [];
  const pkg = safeParseJson(keyFiles["package.json"] || "");
  const pkgStack = pkg ? detectStackFromPackageJson(pkg) : null;
  const languages = new Set();
  const frameworks = new Set(pkgStack?.frameworks || []);

  if (keyFiles["package.json"]) {
    languages.add("JavaScript/TypeScript");
  }
  if (keyFiles["requirements.txt"] || keyFiles["pyproject.toml"]) {
    languages.add("Python");
  }
  if (keyFiles["Cargo.toml"]) {
    languages.add("Rust");
  }
  if (keyFiles["go.mod"]) {
    languages.add("Go");
  }
  if (hasPath(items, /(^|\/)tsconfig\.json$/i)) {
    languages.add("TypeScript");
  }
  if (hasPath(items, /(^|\/)package\.json$/i)) {
    frameworks.add("npm");
  }
  if (hasPath(items, /(^|\/)(routes?|controllers?|services?|middlewares?)\//i)) {
    frameworks.add("layered-backend");
  }
  if (hasPath(items, /(^|\/)(components|pages|layouts|hooks|store|stores)\//i)) {
    frameworks.add("frontend-ui");
  }
  if (hasPath(items, /(^|\/)(agents|memory|runtime|tools)\//i)) {
    frameworks.add("agent-runtime");
  }

  return {
    languages: [...languages],
    frameworks: [...frameworks],
    scripts: pkgStack?.scripts || [],
    dependencies: pkgStack?.dependencies || []
  };
}

export function summarizeRepoArchitecture(analysis = {}) {
  const structure = analysis.structure || {};
  const items = structure.items || [];
  const topLevel = topLevelDirectories(items);
  const highlights = [];

  if (hasPath(items, /(^|\/)(routes?|controllers?|services?|middlewares?)\//i)) {
    highlights.push("layered backend structure");
  }
  if (hasPath(items, /(^|\/)(auth|session|user|users)\//i)) {
    highlights.push("dedicated auth or user boundary");
  }
  if (hasPath(items, /(^|\/)(components|pages|layouts|hooks|store|stores)\//i)) {
    highlights.push("frontend split into pages/components/layouts");
  }
  if (hasPath(items, /(^|\/)(apps|packages|libs)\//i)) {
    highlights.push("monorepo-like split across apps/packages");
  }
  if (hasPath(items, /(^|\/)(docs|documentation)\//i)) {
    highlights.push("separate documentation surface");
  }

  return {
    topLevelDirectories: topLevel.slice(0, 12),
    keyFiles: Object.keys(analysis.keyFiles || {}),
    summary:
      highlights.length > 0
        ? highlights.join(", ")
        : topLevel.length
          ? `top-level structure around ${topLevel.slice(0, 5).join(", ")}`
          : "limited structural signals"
  };
}

function buildFeatureMap(structure = {}, keyFiles = {}) {
  const items = structure.items || [];
  const topLevel = topLevelDirectories(items);

  return {
    hasReadme: Boolean(keyFiles["README.md"]),
    hasPackageJson: Boolean(keyFiles["package.json"]),
    hasDocs: hasPath(items, /(^|\/)(docs|documentation)\//i),
    hasSrc: topLevel.includes("src") || topLevel.includes("app"),
    hasTests: hasPath(items, /(^|\/)(__tests__|tests?|specs?)\//i),
    hasConfig: hasPath(items, /(^|\/)(tsconfig\.json|eslint|prettier|vite\.config|webpack|docker-compose|Dockerfile)/i),
    isMonorepo: hasPath(items, /(^|\/)(apps|packages|libs)\//i),
    hasLayeredBackend: hasPath(items, /(^|\/)(routes?|controllers?|services?|middlewares?)\//i),
    hasAuthModule: hasPath(items, /(^|\/)(auth|session|user|users)\//i),
    hasFrontendStructure: hasPath(items, /(^|\/)(components|pages|layouts|hooks|store|stores)\//i),
    hasAgentModules: hasPath(items, /(^|\/)(agents|memory|runtime|tools)\//i)
      || /(^|\/)(cli|commands)\//i.test(items.map((item) => item.path).join("\n")),
    hasGitHubIntegration:
      hasPath(items, /(^|\/)\.github\//i) ||
      /octokit|probot|github app|github webhook|github action/i.test(
        Object.values(keyFiles || {}).join("\n")
      )
  };
}

function estimateConfidence(analysis = {}) {
  const featureCount = Object.values(analysis.features || {}).filter(Boolean).length;
  const keyFileCount = Object.keys(analysis.keyFiles || {}).length;
  const itemCount = analysis.structure?.items?.length || 0;

  if (featureCount >= 5 && keyFileCount >= 2 && itemCount >= 20) {
    return "high";
  }
  if (featureCount >= 3 && itemCount >= 8) {
    return "medium";
  }
  return "low";
}

async function loadKeyFilesFromApi(client, repositoryFullName, filePaths = []) {
  const keyFiles = {};

  for (const filePath of filePaths) {
    try {
      const file = await getFileContent(client, repositoryFullName, filePath);
      keyFiles[file.path] = file.content;
    } catch {}
  }

  return keyFiles;
}

function loadKeyFilesFromLocal(localPath, filePaths = []) {
  const keyFiles = {};

  for (const filePath of filePaths) {
    const absolutePath = path.join(localPath, filePath);
    const content = safeReadLocalFile(absolutePath);
    if (content) {
      keyFiles[filePath] = content;
    }
  }

  return keyFiles;
}

function normalizeKeyFiles(keyFiles = {}) {
  const normalizedKeyFiles = {};
  for (const [filePath, content] of Object.entries(keyFiles)) {
    const name = filePath.split("/").pop();
    normalizedKeyFiles[name] = truncate(content, 2200);
  }

  return normalizedKeyFiles;
}

function buildRepositoryAnalysis({
  repository,
  structure,
  normalizedKeyFiles,
  taskContext = {},
  analysisMode = "api",
  localPath = ""
}) {
  const analysis = {
    repository,
    structure: {
      ref: structure.ref,
      truncated: structure.truncated,
      itemCount: structure.items.length,
      items: structure.items,
      topLevelDirectories: topLevelDirectories(structure.items)
    },
    keyFiles: normalizedKeyFiles,
    analysisMode,
    localPath: localPath || ""
  };

  analysis.features = buildFeatureMap(analysis.structure, normalizedKeyFiles);
  analysis.stack = detectRepoStack(analysis);
  analysis.architecture = summarizeRepoArchitecture(analysis);
  analysis.patterns = extractRepoPatterns(analysis, taskContext);
  analysis.summary = {
    description: repository.description || "",
    keyFiles: Object.keys(normalizedKeyFiles),
    importantPaths: listPaths(
      structure.items,
      /(^|\/)(src|app|pages|components|routes?|controllers?|services?|middlewares?|auth|docs|tests?|package\.json|README\.md)/i
    )
      .slice(0, 14)
      .map((item) => item.path)
  };
  analysis.confidence = estimateConfidence(analysis);
  analysis.limits = [];

  if (!analysis.features.hasReadme) {
    analysis.limits.push("README not available");
  }
  if (analysis.structure.truncated) {
    analysis.limits.push(
      analysisMode === "local_clone"
        ? "local repository scan hit the file limit"
        : "repository tree was truncated by the GitHub API"
    );
  }
  if (!analysis.summary.importantPaths.length) {
    analysis.limits.push("few structural files were detected");
  }
  if (analysisMode === "local_clone") {
    analysis.limits.push("analysis derived from a local shallow clone");
  }

  return analysis;
}

export async function analyzeRepository(client, repo, taskContext = {}) {
  const structure = await getRepoStructure(client, repo);
  const keyFilePaths = selectKeyFiles(structure.items || []);
  const keyFiles = await loadKeyFilesFromApi(
    client,
    structure.repository.fullName,
    keyFilePaths
  );

  return buildRepositoryAnalysis({
    repository: structure.repository,
    structure,
    normalizedKeyFiles: normalizeKeyFiles(keyFiles),
    taskContext,
    analysisMode: "api"
  });
}

export async function analyzeLocalRepository(localPath, repository = {}, taskContext = {}) {
  const structure = getLocalRepoStructure(localPath, repository);
  const keyFilePaths = selectKeyFiles(structure.items || []);
  const keyFiles = loadKeyFilesFromLocal(localPath, keyFilePaths);

  return buildRepositoryAnalysis({
    repository: structure.repository,
    structure,
    normalizedKeyFiles: normalizeKeyFiles(keyFiles),
    taskContext,
    analysisMode: "local_clone",
    localPath
  });
}

export default {
  analyzeRepository,
  analyzeLocalRepository,
  detectRepoStack,
  summarizeRepoArchitecture
};
