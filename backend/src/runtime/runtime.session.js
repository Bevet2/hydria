import { randomUUID } from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}

export class RuntimeSessionManager {
  constructor({ stateStore, maxActionsPerSession = 24, persistSessions = true }) {
    this.stateStore = stateStore;
    this.maxActionsPerSession = maxActionsPerSession;
    this.persistSessions = persistSessions;
  }

  startSession({
    userId,
    conversationId,
    prompt,
    classification = null
  }) {
    const session = {
      id: randomUUID(),
      userId,
      conversationId,
      prompt,
      classification,
      status: "running",
      startedAt: nowIso(),
      updatedAt: nowIso(),
      actionCount: 0,
      actions: [],
      state: {
        steps: {},
        errors: [],
        retries: [],
        recoveries: [],
        rollbacks: []
      }
    };

    if (this.persistSessions) {
      this.stateStore.createSession(session);
    }

    return session;
  }

  appendAction(sessionId, action) {
    if (!this.persistSessions) {
      return null;
    }

    return this.stateStore.updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: nowIso(),
      actionCount: Number(session.actionCount || 0) + 1,
      actions: [...(session.actions || []), action].slice(-this.maxActionsPerSession)
    }));
  }

  updateState(sessionId, patch = {}) {
    if (!this.persistSessions) {
      return null;
    }

    return this.stateStore.updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: nowIso(),
      state: {
        ...(session.state || {}),
        ...patch
      }
    }));
  }

  recordStepStart(sessionId, step = {}) {
    if (!this.persistSessions) {
      return null;
    }

    return this.stateStore.updateSession(sessionId, (session) => {
      const currentSteps = session.state?.steps || {};
      const current = currentSteps[step.id] || {
        id: step.id,
        type: step.type,
        purpose: step.purpose,
        attempts: 0
      };

      return {
        ...session,
        updatedAt: nowIso(),
        state: {
          ...(session.state || {}),
          steps: {
            ...currentSteps,
            [step.id]: {
              ...current,
              type: step.type,
              purpose: step.purpose,
              provider: step.provider || current.provider || null,
              status: "running",
              startedAt: current.startedAt || nowIso(),
              lastAttemptAt: nowIso()
            }
          }
        }
      };
    });
  }

  recordStepRetry(sessionId, step = {}, reason = "") {
    if (!this.persistSessions) {
      return null;
    }

    return this.stateStore.updateSession(sessionId, (session) => {
      const currentSteps = session.state?.steps || {};
      const current = currentSteps[step.id] || {
        id: step.id,
        type: step.type,
        purpose: step.purpose,
        attempts: 0
      };

      return {
        ...session,
        updatedAt: nowIso(),
        state: {
          ...(session.state || {}),
          steps: {
            ...currentSteps,
            [step.id]: {
              ...current,
              attempts: Number(current.attempts || 0) + 1,
              lastRetryAt: nowIso(),
              lastRetryReason: reason || current.lastRetryReason || ""
            }
          },
          retries: [
            ...(session.state?.retries || []),
            {
              stepId: step.id,
              type: step.type,
              reason,
              at: nowIso()
            }
          ].slice(-this.maxActionsPerSession)
        }
      };
    });
  }

  recordStepResult(sessionId, step = {}, result = {}) {
    if (!this.persistSessions) {
      return null;
    }

    return this.stateStore.updateSession(sessionId, (session) => {
      const currentSteps = session.state?.steps || {};
      const current = currentSteps[step.id] || {
        id: step.id,
        type: step.type,
        purpose: step.purpose,
        attempts: 0
      };

      return {
        ...session,
        updatedAt: nowIso(),
        state: {
          ...(session.state || {}),
          steps: {
            ...currentSteps,
            [step.id]: {
              ...current,
              ...result,
              completedAt: nowIso()
            }
          }
        }
      };
    });
  }

  recordError(sessionId, error = {}) {
    if (!this.persistSessions) {
      return null;
    }

    return this.stateStore.updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: nowIso(),
      state: {
        ...(session.state || {}),
        errors: [
          ...(session.state?.errors || []),
          {
            ...error,
            at: nowIso()
          }
        ].slice(-this.maxActionsPerSession)
      }
    }));
  }

  recordRecovery(sessionId, recovery = {}) {
    if (!this.persistSessions) {
      return null;
    }

    return this.stateStore.updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: nowIso(),
      state: {
        ...(session.state || {}),
        recoveries: [
          ...(session.state?.recoveries || []),
          recovery
        ].slice(-this.maxActionsPerSession)
      }
    }));
  }

  recordRollback(sessionId, rollback = {}) {
    if (!this.persistSessions) {
      return null;
    }

    return this.stateStore.updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: nowIso(),
      state: {
        ...(session.state || {}),
        rollbacks: [
          ...(session.state?.rollbacks || []),
          rollback
        ].slice(-this.maxActionsPerSession)
      }
    }));
  }

  completeSession(sessionId, patch = {}) {
    if (!this.persistSessions) {
      return null;
    }

    return this.stateStore.updateSession(sessionId, (session) => ({
      ...session,
      ...patch,
      updatedAt: nowIso(),
      completedAt: nowIso(),
      status: patch.status || "completed"
    }));
  }

  getSession(sessionId) {
    return this.persistSessions ? this.stateStore.getSession(sessionId) : null;
  }
}

export default RuntimeSessionManager;
