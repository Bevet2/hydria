import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { normalizeWorkObject } from "./workObject.types.js";
import { readJsonFile, writeJsonFile } from "../../utils/durableFiles.js";

function ensureFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    writeJsonFile(filePath, { version: 1, items: [] });
  }
}

export class WorkObjectStore {
  constructor({ filePath }) {
    this.filePath = filePath;
    ensureFile(filePath);
  }

  readState() {
      const parsed = readJsonFile(this.filePath);
      if (!Array.isArray(parsed.items)) throw new Error("Invalid work object catalog; restore a verified backup");
      return {
        version: parsed.version || 1,
        items: Array.isArray(parsed.items)
          ? parsed.items.map((item) => normalizeWorkObject(item))
          : []
      };
  }

  writeState(state) {
    writeJsonFile(this.filePath, state);
  }

  createId() {
    return randomUUID();
  }

  list({ userId = null, conversationId = null, projectId = null, limit = 20 } = {}) {
    return this.readState().items
      .filter((item) => (userId ? Number(item.userId) === Number(userId) : true))
      .filter((item) =>
        conversationId ? Number(item.conversationId) === Number(conversationId) : true
      )
      .filter((item) => (projectId ? String(item.projectId) === String(projectId) : true))
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      .slice(0, limit);
  }

  get(workObjectId) {
    return this.readState().items.find((item) => item.id === workObjectId) || null;
  }

  findByLink({ projectId = "", artifactId = "", sourceWorkObjectId = "" } = {}) {
    return (
      this.readState().items.find(
        (item) =>
          (projectId && item.projectId === projectId) ||
          (artifactId && item.artifactId === artifactId) ||
          (sourceWorkObjectId && item.links?.sourceWorkObjectId === sourceWorkObjectId)
      ) || null
    );
  }

  upsert(input = {}) {
    return this.save(input);
  }

  save(workObject) {
    const state = this.readState();
    const normalized = normalizeWorkObject({
      ...workObject,
      id: workObject.id || this.createId(),
      updatedAt: new Date().toISOString()
    });
    const index = state.items.findIndex((item) => item.id === normalized.id);
    if (index >= 0) {
      state.items[index] = normalized;
    } else {
      state.items.unshift(normalized);
    }
    this.writeState(state);
    return normalized;
  }

  update(workObjectId, updater) {
    const current = this.get(workObjectId);
    if (!current) {
      return null;
    }

    const next =
      typeof updater === "function"
        ? updater(current)
        : {
            ...current,
            ...updater
          };

    return this.save({
      ...current,
      ...next,
      id: current.id,
      createdAt: current.createdAt
    });
  }

  delete(workObjectId) {
    const state = this.readState();
    const index = state.items.findIndex((item) => item.id === workObjectId);
    if (index < 0) {
      return null;
    }

    const [removed] = state.items.splice(index, 1);
    this.writeState(state);
    return removed;
  }
}

export default WorkObjectStore;
