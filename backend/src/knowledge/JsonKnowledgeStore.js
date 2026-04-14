import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { KnowledgeStore } from "../types/contracts.js";
import { buildKnowledgeEntriesFromAttachments } from "./attachmentKnowledgeLoader.js";
import agenticConfig from "../config/agenticConfig.js";
import { chunkKnowledgeEntry } from "./knowledge.chunker.js";
import { buildIndexedKnowledgeEntry } from "./knowledge.index.js";
import { searchKnowledgeIndex } from "./knowledge.search.js";

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function defaultState() {
  return {
    version: 1,
    chunks: []
  };
}

function normalizeKnowledgeRecord(entry = {}) {
  return {
    docId: entry.docId || entry.id || `${entry.source || "record"}:${entry.filename || entry.title || "item"}`,
    userId: entry.userId || null,
    conversationId: entry.conversationId || null,
    attachmentId: entry.attachmentId || null,
    filename: entry.filename || entry.title || "record",
    kind: entry.kind || "text",
    contentFamily: entry.contentFamily || "document",
    parser: entry.parser || entry.source || "generic",
    sectionTitle: entry.sectionTitle || entry.title || "Section",
    text: entry.text || "",
    excerpt: entry.excerpt || String(entry.text || "").slice(0, 320),
    metadata: entry.metadata || {}
  };
}

export class JsonKnowledgeStore extends KnowledgeStore {
  constructor({ filePath }) {
    super();
    this.filePath = filePath;
    ensureDirectory(this.filePath);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(defaultState(), null, 2));
    }
  }

  readState() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch {
      return defaultState();
    }
  }

  writeState(state) {
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  async ingestRecords(records = []) {
    const state = this.readState();
    const baseEntries = records.map(normalizeKnowledgeRecord);
    const entries = baseEntries.flatMap((entry) =>
      chunkKnowledgeEntry(entry, {
        chunkSize: agenticConfig.knowledge.chunkSize,
        chunkOverlap: agenticConfig.knowledge.chunkOverlap,
        maxChunksPerDocument: agenticConfig.knowledge.maxChunksPerDocument
      })
    );

    const existingKeys = new Set(
      state.chunks.map(
        (entry) => `${entry.userId}:${entry.conversationId}:${entry.filename}:${entry.sectionTitle}:${entry.text}`
      )
    );

    const inserted = [];

    for (const entry of entries) {
      const key = `${entry.userId}:${entry.conversationId}:${entry.filename}:${entry.sectionTitle}:${entry.text}`;
      if (existingKeys.has(key)) {
        continue;
      }

      inserted.push({
        id: randomUUID(),
        ...buildIndexedKnowledgeEntry(entry),
        indexedAt: new Date().toISOString()
      });
      existingKeys.add(key);
    }

    if (inserted.length) {
      state.chunks = [...inserted, ...state.chunks].slice(0, 5000);
      this.writeState(state);
    }

    return {
      inserted: inserted.length,
      totalChunks: state.chunks.length
    };
  }

  async ingestAttachments({ userId, conversationId, attachments = [] }) {
    const records = buildKnowledgeEntriesFromAttachments({
      userId,
      conversationId,
      attachments
    });

    return this.ingestRecords(records);
  }

  async ingestWebResults({ userId, conversationId, webResults = [] }) {
    const records = [];

    for (const result of webResults) {
      for (const page of result.pages || []) {
        records.push({
          docId: page.url,
          userId,
          conversationId,
          filename: page.title || page.url,
          kind: "text",
          contentFamily: "document",
          parser: result.providerId || "web",
          sectionTitle: page.title || "Web page",
          text: page.excerpt || page.content || result.summaryText || "",
          metadata: {
            url: page.url,
            sourceType: "web_page"
          }
        });
      }

      for (const item of result.searchResults || []) {
        records.push({
          docId: item.url,
          userId,
          conversationId,
          filename: item.title || item.url,
          kind: "text",
          contentFamily: "document",
          parser: result.providerId || "web_search",
          sectionTitle: item.title || "Search result",
          text: item.snippet || result.summaryText || item.url || "",
          metadata: {
            url: item.url,
            sourceType: "web_search_result"
          }
        });
      }

      if (!(result.pages || []).length && !(result.searchResults || []).length && result.summaryText) {
        records.push({
          docId: `${result.providerId || "web"}:${result.capability || "summary"}`,
          userId,
          conversationId,
          filename: result.sourceName || "Web summary",
          kind: "text",
          contentFamily: "document",
          parser: result.providerId || "web_summary",
          sectionTitle: result.capability || "Web summary",
          text: result.summaryText,
          metadata: {
            sourceType: "web_summary"
          }
        });
      }
    }

    return this.ingestRecords(records);
  }

  async ingestGitHubResults({ userId, conversationId, gitResult = null }) {
    const records = [];
    const raw = gitResult?.raw || {};
    const normalized = gitResult?.normalized || {};

    for (const repository of normalized.repositories || []) {
      records.push({
        docId: repository.fullName,
        userId,
        conversationId,
        filename: repository.fullName,
        kind: "text",
        contentFamily: "technical",
        parser: "github_repo_search",
        sectionTitle: "Repository candidate",
        text: [
          repository.fullName,
          repository.description || "",
          repository.language ? `Language: ${repository.language}` : "",
          Number.isFinite(repository.stars) ? `Stars: ${repository.stars}` : ""
        ]
          .filter(Boolean)
          .join("\n"),
        metadata: {
          repository: repository.fullName,
          htmlUrl: repository.htmlUrl || "",
          sourceType: "github_repo_search"
        }
      });
    }

    for (const structure of raw.repoAnalyses || []) {
      records.push({
        docId: structure.repository.fullName,
        userId,
        conversationId,
        filename: structure.repository.fullName,
        kind: "code",
        contentFamily: "technical",
        parser: "github_structure",
        sectionTitle: "Repository structure",
        text: (structure.items || []).slice(0, 120).map((item) => item.path).join("\n"),
        metadata: {
          repository: structure.repository.fullName,
          sourceType: "github_repo"
        }
      });
    }

    for (const snippet of raw.readmeSnippets || []) {
      records.push({
        docId: `${snippet.repo}:README.md`,
        userId,
        conversationId,
        filename: `${snippet.repo}/README.md`,
        kind: "text",
        contentFamily: "document",
        parser: "github_readme",
        sectionTitle: "README",
        text: snippet.excerpt,
        metadata: {
          repository: snippet.repo,
          sourceType: "github_readme"
        }
      });
    }

    for (const codeMatch of raw.codeMatches || []) {
      records.push({
        docId: `${codeMatch.repository.fullName}:${codeMatch.path}`,
        userId,
        conversationId,
        filename: `${codeMatch.repository.fullName}/${codeMatch.path}`,
        kind: "code",
        contentFamily: "technical",
        parser: "github_code_search",
        sectionTitle: codeMatch.path,
        text: codeMatch.htmlUrl || codeMatch.path,
        metadata: {
          repository: codeMatch.repository.fullName,
          sourceType: "github_code"
        }
      });
    }

    if ((normalized.patterns || []).length) {
      records.push({
        docId: `${raw.query || "github"}:patterns`,
        userId,
        conversationId,
        filename: "github-patterns.txt",
        kind: "text",
        contentFamily: "technical",
        parser: "github_patterns",
        sectionTitle: "Observed repository patterns",
        text: normalized.patterns
          .map((pattern) => `${pattern.pattern}: ${pattern.count}`)
          .join("\n"),
        metadata: {
          query: raw.query || "",
          sourceType: "github_patterns"
        }
      });
    }

    return this.ingestRecords(records);
  }

  async search(query, { userId = null, conversationId = null, limit = 4 } = {}) {
    const state = this.readState();
    const scopedChunks = state.chunks
      .filter((entry) => (userId ? Number(entry.userId) === Number(userId) : true))
      .filter((entry) =>
        conversationId ? Number(entry.conversationId) === Number(conversationId) : true
      );
    const matches = searchKnowledgeIndex(scopedChunks, query, {
      limit: Math.min(limit, agenticConfig.knowledge.maxSearchHits)
    });

    return {
      query: matches.query,
      totalMatches: matches.totalMatches,
      items: matches.items
    };
  }

  async getStats() {
    const state = this.readState();
    return {
      totalChunks: state.chunks.length
    };
  }
}

export default JsonKnowledgeStore;
