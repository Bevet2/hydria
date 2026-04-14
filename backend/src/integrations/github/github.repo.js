import fs from "node:fs";
import path from "node:path";
import { normalizeRepoRef, normalizeRepository } from "./github.types.js";
import { runCommand } from "../../runtime/commandRunner.js";

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function safeRepoDirName(fullName = "") {
  return String(fullName || "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "coverage",
  "vendor",
  ".venv",
  "venv"
]);

const TEXT_FILE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".yml",
  ".yaml",
  ".toml",
  ".ini",
  ".env",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".php",
  ".css",
  ".scss",
  ".html",
  ".sql",
  ".sh"
]);

function isTextFile(filePath = "") {
  const extension = path.extname(filePath).toLowerCase();
  return TEXT_FILE_EXTENSIONS.has(extension) || !extension;
}

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeQuery(query = "") {
  return normalizeText(query)
    .split(/[^a-z0-9_.-]+/)
    .filter((token) => token.length >= 3);
}

function readTextFile(filePath = "", maxChars = 24000) {
  try {
    return fs.readFileSync(filePath, "utf8").slice(0, maxChars);
  } catch {
    return "";
  }
}

function walkDirectory(rootPath, currentPath, collector, limit = 2500) {
  if (collector.length >= limit) {
    return;
  }

  const entries = fs.readdirSync(currentPath, {
    withFileTypes: true
  });

  for (const entry of entries) {
    if (collector.length >= limit) {
      break;
    }

    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      collector.push({
        path: relativePath,
        type: "tree",
        size: 0,
        url: ""
      });
      walkDirectory(rootPath, absolutePath, collector, limit);
      continue;
    }

    const stats = fs.statSync(absolutePath);
    collector.push({
      path: relativePath,
      type: "blob",
      size: Number(stats.size || 0),
      url: ""
    });
  }
}

export async function getRepoMetadata(client, repo) {
  const repoRef = normalizeRepoRef(repo);
  const data = await client.request(`/repos/${repoRef.fullName}`);
  return normalizeRepository(data);
}

function buildFallbackRepositoryMetadata(repo) {
  const repoRef = normalizeRepoRef(repo);
  return {
    id: 0,
    fullName: repoRef.fullName,
    name: repoRef.name,
    owner: repoRef.owner,
    private: false,
    htmlUrl: `https://github.com/${repoRef.fullName}`,
    description: "",
    language: "",
    stars: null,
    forks: 0,
    openIssues: 0,
    defaultBranch: "main",
    updatedAt: null,
    pushedAt: null,
    archived: false,
    topics: [],
    license: "",
    size: 0,
    hasIssues: true,
    visibility: "public"
  };
}

export async function getRepoStructure(client, repo, options = {}) {
  const metadata = await getRepoMetadata(client, repo);
  const branch = options.ref || metadata.defaultBranch;
  const data = await client.request(
    `/repos/${metadata.fullName}/git/trees/${encodeURIComponent(branch)}`,
    {
      searchParams: {
        recursive: 1
      }
    }
  );

  const items = (data.tree || []).map((item) => ({
    path: item.path,
    type: item.type,
    size: Number(item.size || 0),
    url: item.url
  }));

  return {
    repository: metadata,
    ref: branch,
    truncated: Boolean(data.truncated),
    items
  };
}

export async function getFileContent(client, repo, filePath, options = {}) {
  const metadata = await getRepoMetadata(client, repo);
  const ref = options.ref || metadata.defaultBranch;
  const data = await client.request(
    `/repos/${metadata.fullName}/contents/${filePath.replace(/^\/+/, "")}`,
    {
      searchParams: {
        ref
      }
    }
  );

  const encoded = String(data.content || "").replace(/\n/g, "");
  const content =
    data.encoding === "base64"
      ? Buffer.from(encoded, "base64").toString("utf8")
      : String(data.content || "");

  return {
    repository: metadata,
    path: data.path,
    name: data.name,
    size: Number(data.size || 0),
    sha: data.sha,
    content,
    ref
  };
}

export async function cloneRepository(client, repo, localRoot, options = {}) {
  let metadata;
  try {
    metadata = await getRepoMetadata(client, repo);
  } catch {
    metadata = buildFallbackRepositoryMetadata(repo);
  }
  ensureDirectory(localRoot);
  const targetDir =
    options.localPath || path.join(localRoot, safeRepoDirName(metadata.fullName));

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    return {
      success: true,
      repository: metadata,
      localPath: targetDir,
      reused: true
    };
  }

  ensureDirectory(path.dirname(targetDir));
  const cloneUrl = `https://github.com/${metadata.fullName}.git`;
  const result = await runCommand("git", ["clone", "--depth", "1", cloneUrl, targetDir], {
    cwd: localRoot,
    timeoutMs: 120000
  });

  return {
    success: result.success,
    repository: metadata,
    localPath: targetDir,
    command: result.command,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    reused: false
  };
}

export function getLocalRepoStructure(localPath, repository = {}, options = {}) {
  const items = [];
  walkDirectory(localPath, localPath, items, options.limit || 2500);
  const repoMetadata =
    typeof repository === "string"
      ? buildFallbackRepositoryMetadata(repository)
      : repository.fullName
        ? repository
        : buildFallbackRepositoryMetadata(
            repository.fullName || `${repository.owner || ""}/${repository.name || ""}`.replace(
              /^\/+|\/+$/g,
              ""
            )
          );

  return {
    repository: repoMetadata,
    ref: repository.defaultBranch || "main",
    truncated: items.length >= (options.limit || 2500),
    items,
    localPath
  };
}

function scoreLocalCodeMatch(filePath = "", content = "", queryTokens = []) {
  const normalizedPath = normalizeText(filePath);
  const normalizedContent = normalizeText(content);
  let score = 0;

  for (const token of queryTokens) {
    if (normalizedPath.includes(token)) {
      score += 5;
    }
    if (normalizedContent.includes(token)) {
      score += 3;
    }
  }

  if (/auth|login|session|token|jwt/.test(normalizedPath) && queryTokens.some((token) => /auth|login|session|token|jwt/.test(token))) {
    score += 4;
  }
  if (/agent|planner|executor|memory|runtime/.test(normalizedPath) && queryTokens.some((token) => /agent|planner|executor|memory|runtime/.test(token))) {
    score += 4;
  }
  if (/dashboard|admin|layout|component/.test(normalizedPath) && queryTokens.some((token) => /dashboard|admin|layout|component/.test(token))) {
    score += 4;
  }

  return score;
}

export function searchLocalRepositoryCode(localPath, query = "", options = {}) {
  if (!fs.existsSync(localPath)) {
    return {
      totalCount: 0,
      items: [],
      query,
      errors: [
        {
          message: `Local repository path not found: ${localPath}`
        }
      ],
      fallbackUsed: true
    };
  }

  const repoRef = normalizeRepoRef(options.repo || "");
  const structure = getLocalRepoStructure(localPath, {
    fullName: repoRef.fullName,
    owner: repoRef.owner,
    name: repoRef.name
  });
  const queryTokens = tokenizeQuery(query);
  const items = [];

  for (const item of structure.items) {
    if (item.type !== "blob" || !isTextFile(item.path) || item.size > 250000) {
      continue;
    }

    const absolutePath = path.join(localPath, item.path);
    const content = readTextFile(absolutePath, 16000);
    const score = scoreLocalCodeMatch(item.path, content, queryTokens);
    if (score <= 0) {
      continue;
    }

    items.push({
      name: path.basename(item.path),
      path: item.path,
      htmlUrl: repoRef.fullName
        ? `https://github.com/${repoRef.fullName}/blob/${options.ref || "main"}/${item.path}`
        : "",
      repository: {
        fullName: repoRef.fullName,
        owner: repoRef.owner,
        name: repoRef.name
      },
      score,
      snippet: content
        .split(/\r?\n/)
        .find((line) => queryTokens.some((token) => normalizeText(line).includes(token))) || ""
    });
  }

  return {
    totalCount: items.length,
    items: items
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit || 8),
    query,
    errors: [],
    fallbackUsed: true
  };
}
