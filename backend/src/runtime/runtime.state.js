import { readJsonFile, writeJsonFile } from "../../utils/durableFiles.js";
import fs from "node:fs";
import path from "node:path";

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createDefaultState() {
  return {
    version: 1,
    sessions: {}
  };
}

export class RuntimeStateStore {
  constructor({ filePath }) {
    this.filePath = filePath;
    ensureDirectory(filePath);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(createDefaultState(), null, 2));
    }
  }

  readState() {
    try {
      const parsed = readJsonFile(this.filePath);
      return {
        version: parsed.version || 1,
        sessions: parsed.sessions || {}
      };
    } catch (error) {
      throw error;
    }
  }

  writeState(nextState) {
    writeJsonFile(this.filePath, nextState);
  }

  createSession(session) {
    const state = this.readState();
    state.sessions[session.id] = session;
    this.writeState(state);
    return session;
  }

  updateSession(sessionId, updater) {
    const state = this.readState();
    const session = state.sessions[sessionId];

    if (!session) {
      return null;
    }

    const nextSession =
      typeof updater === "function"
        ? updater(session)
        : {
            ...session,
            ...updater
          };

    state.sessions[sessionId] = nextSession;
    this.writeState(state);
    return nextSession;
  }

  getSession(sessionId) {
    return this.readState().sessions[sessionId] || null;
  }
}

export default RuntimeStateStore;
