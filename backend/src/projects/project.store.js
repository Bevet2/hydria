import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { normalizeProject } from "./project.types.js";

function ensureFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, items: [] }, null, 2));
  }
}

export class ProjectStore {
  constructor({ filePath }) {
    this.filePath = filePath;
    ensureFile(filePath);
  }

  readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return {
        version: parsed.version || 1,
        items: Array.isArray(parsed.items) ? parsed.items.map((item) => normalizeProject(item)) : []
      };
    } catch {
      return { version: 1, items: [] };
    }
  }

  writeState(state) {
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  async ensureProject({
    name,
    type = "internal",
    workspacePath = "",
    metadata = {},
    dimensions = [],
    internalCapabilities = [],
    globalProject = null
  } = {}) {
    const state = this.readState();
    const normalizedName = String(name || "").trim().toLowerCase();
    const expectedConversationId = String(metadata?.conversationId || "").trim();
    const existing = state.items.find((item) => {
      if (item.name.toLowerCase() !== normalizedName) {
        return false;
      }

      if (!expectedConversationId) {
        return true;
      }

      return String(item.metadata?.conversationId || "").trim() === expectedConversationId;
    });
    if (existing) {
      return existing;
    }

    const project = normalizeProject({
      id: randomUUID(),
      name,
      type,
      workspacePath,
      metadata,
      dimensions,
      internalCapabilities,
      globalProject
    });

    state.items.unshift(project);
    this.writeState(state);
    return project;
  }

  async updateProject(projectId, updater) {
    const state = this.readState();
    const index = state.items.findIndex((item) => item.id === projectId);
    if (index < 0) {
      return null;
    }
    const current = state.items[index];
    const next = normalizeProject({
      ...current,
      ...(typeof updater === "function" ? updater(current) : updater),
      lastUpdatedAt: new Date().toISOString()
    });
    state.items[index] = next;
    this.writeState(state);
    return next;
  }

  getProject(projectId) {
    return this.readState().items.find((item) => item.id === projectId) || null;
  }

  listProjects({ ids = [], userId = null, conversationId = null, limit = 100 } = {}) {
    const allowedIds = new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean));
    return this.readState().items
      .filter((item) => !allowedIds.size || allowedIds.has(item.id))
      .filter((item) =>
        userId ? Number(item.metadata?.userId || 0) === Number(userId) : true
      )
      .filter((item) =>
        conversationId
          ? String(item.metadata?.conversationId || "") === String(conversationId)
          : true
      )
      .sort((left, right) => new Date(right.lastUpdatedAt) - new Date(left.lastUpdatedAt))
      .slice(0, limit);
  }

  findByName(name = "") {
    const normalizedName = String(name || "").trim().toLowerCase();
    return this.readState().items.find((item) => item.name.toLowerCase() === normalizedName) || null;
  }
}

export default ProjectStore;
