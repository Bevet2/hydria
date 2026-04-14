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
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return {
        version: parsed.version || 1,
        sessions: parsed.sessions || {}
      };
    } catch {
      return createDefaultState();
    }
  }

  writeState(nextState) {
    fs.writeFileSync(this.filePath, JSON.stringify(nextState, null, 2));
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
