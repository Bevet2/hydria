import fs from "node:fs/promises";
import path from "node:path";
import config from "../../config/hydria.config.js";

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "data"
]);

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
  ".env",
  ".sql",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".vue",
  ".svelte"
]);

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value = "", maxChars = 260) {
  const text = cleanText(value);
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

function isTextFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(extension)) {
    return true;
  }

  return /(^|[\\/])(package\.json|README\.md|Dockerfile|Makefile|vite\.config|tsconfig|eslint|prettier|server\.js)$/i.test(
    filePath
  );
}

function extractPromptTokens(prompt = "") {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "dans",
    "avec",
    "pour",
    "code",
    "project",
    "projet",
    "current",
    "app"
  ]);

  return [...new Set(
    normalizeText(prompt)
      .split(/[^a-z0-9_./-]+/)
      .filter((token) => token.length > 2 && !stopWords.has(token))
  )].slice(0, 8);
}

async function collectFiles(rootDir, currentDir = rootDir, bucket = []) {
  if (bucket.length >= config.tools.maxFilesScanned) {
    return bucket;
  }

  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (bucket.length >= config.tools.maxFilesScanned) {
      break;
    }

    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      await collectFiles(rootDir, absolutePath, bucket);
      continue;
    }

    if (!isTextFile(relativePath)) {
      continue;
    }

    bucket.push({
      absolutePath,
      relativePath
    });
  }

  return bucket;
}

function scoreFile(relativePath, tokens) {
  const normalizedPath = normalizeText(relativePath);
  let score = 0;

  if (/package\.json|readme|server|app|index|main|vite|tsconfig|docker/i.test(relativePath)) {
    score += 2;
  }

  for (const token of tokens) {
    if (normalizedPath.includes(token)) {
      score += 3;
    }
  }

  return score;
}

function extractMatchingLines(content, tokens) {
  const lines = String(content || "").split(/\r?\n/);
  const matches = [];

  for (const line of lines) {
    const normalizedLine = normalizeText(line);
    if (tokens.some((token) => normalizedLine.includes(token))) {
      matches.push(truncate(line, 220));
    }

    if (matches.length >= 3) {
      break;
    }
  }

  if (!matches.length) {
    const fallback = cleanText(lines.slice(0, 6).join(" "));
    if (fallback) {
      matches.push(truncate(fallback, 220));
    }
  }

  return matches;
}

async function readProjectManifests(rootDir, files) {
  const manifestFiles = files
    .filter((file) => /(^|[\\/])(package\.json|pyproject\.toml|requirements\.txt)$/i.test(file.relativePath))
    .slice(0, 4);
  const manifests = [];

  for (const file of manifestFiles) {
    try {
      const content = await fs.readFile(file.absolutePath, "utf8");
      manifests.push({
        path: file.relativePath,
        excerpt: truncate(content, 220)
      });
    } catch {
      continue;
    }
  }

  return manifests;
}

export async function inspectWorkspace(prompt = "") {
  const rootDir = config.tools.workspaceRoot;
  const tokens = extractPromptTokens(prompt);
  const files = await collectFiles(rootDir);
  const scoredFiles = files
    .map((file) => ({
      ...file,
      score: scoreFile(file.relativePath, tokens)
    }))
    .sort((left, right) => right.score - left.score || left.relativePath.localeCompare(right.relativePath))
    .slice(0, config.tools.maxRelevantFiles);

  const snippets = [];

  for (const file of scoredFiles) {
    try {
      const content = await fs.readFile(file.absolutePath, "utf8");
      snippets.push({
        path: file.relativePath,
        score: file.score,
        matches: extractMatchingLines(content, tokens)
      });
    } catch {
      continue;
    }
  }

  const manifests = await readProjectManifests(rootDir, files);
  const relevantFiles = snippets.map((item) => item.path);
  const summaryParts = [
    `Workspace root: ${rootDir}`,
    manifests.length
      ? `Project manifests: ${manifests.map((manifest) => manifest.path).join(", ")}`
      : "No standard project manifest detected.",
    relevantFiles.length
      ? `Relevant files: ${relevantFiles.join(", ")}`
      : "No relevant files matched the prompt strongly."
  ];

  for (const snippet of snippets.slice(0, 4)) {
    const preview = snippet.matches.slice(0, 2).join(" | ");
    if (preview) {
      summaryParts.push(`${snippet.path}: ${preview}`);
    }
  }

  return {
    providerId: "workspace_inspector",
    sourceType: "tool",
    sourceName: "Workspace Inspector",
    capability: "workspace_inspect",
    raw: {
      rootDir,
      fileCount: files.length,
      snippets
    },
    normalized: {
      rootDir,
      fileCount: files.length,
      projectManifests: manifests,
      relevantFiles,
      snippets
    },
    summaryText: summaryParts.join("\n")
  };
}
