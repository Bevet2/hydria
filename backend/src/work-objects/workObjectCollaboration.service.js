import { createHash, randomUUID } from "node:crypto";
import { AppError } from "../../utils/errors.js";

function sessionKey(workObjectId = "", entryPath = "") {
  return `${String(workObjectId || "")}::${String(entryPath || "").replace(/\\/g, "/")}`;
}

function contentHash(content = "") {
  return createHash("sha256").update(String(content || "")).digest("hex").slice(0, 16);
}

function transformPosition(position, operation, affinity = "start") {
  const start = Number(operation.index || 0);
  const removed = Math.max(0, Number(operation.deleteCount || 0));
  const inserted = String(operation.insert || "").length;
  const end = start + removed;
  if (position <= start) return position;
  if (position >= end) return position + inserted - removed;
  return affinity === "end" ? start + inserted : start;
}

function transformTextOperation(operation, previousOperations = []) {
  let start = Math.max(0, Number(operation.index || 0));
  let end = start + Math.max(0, Number(operation.deleteCount || 0));
  for (const previous of previousOperations) {
    if (previous.kind !== "text.splice") continue;
    start = transformPosition(start, previous, "start");
    end = transformPosition(end, previous, "end");
  }
  return {
    ...operation,
    index: Math.max(0, start),
    deleteCount: Math.max(0, end - start),
    insert: String(operation.insert || "")
  };
}

function applyTextOperation(content, operation) {
  const source = String(content || "");
  const index = Math.max(0, Math.min(source.length, Number(operation.index || 0)));
  const deleteCount = Math.max(
    0,
    Math.min(source.length - index, Number(operation.deleteCount || 0))
  );
  return `${source.slice(0, index)}${String(operation.insert || "")}${source.slice(
    index + deleteCount
  )}`;
}

function applySheetCells(content, operation) {
  let workbook;
  try {
    workbook = JSON.parse(String(content || ""));
  } catch {
    throw new AppError("Cell collaboration requires a structured Hydria sheet", 409);
  }
  if (!Array.isArray(workbook.sheets)) {
    throw new AppError("Cell collaboration requires a structured Hydria sheet", 409);
  }
  for (const change of operation.changes || []) {
    const sheet =
      workbook.sheets.find((item) => String(item.id) === String(change.sheetId)) ||
      workbook.sheets[0];
    if (!sheet) continue;
    const rowIndex = Math.max(0, Number(change.rowIndex || 0));
    const columnIndex = Math.max(0, Number(change.columnIndex || 0));
    if (rowIndex === 0) {
      sheet.columns = Array.isArray(sheet.columns) ? sheet.columns : [];
      while (sheet.columns.length <= columnIndex) sheet.columns.push("");
      sheet.columns[columnIndex] = String(change.value || "");
      continue;
    }
    sheet.rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    while (sheet.rows.length < rowIndex) sheet.rows.push([]);
    const row = Array.isArray(sheet.rows[rowIndex - 1]) ? sheet.rows[rowIndex - 1] : [];
    while (row.length <= columnIndex) row.push("");
    row[columnIndex] = String(change.value || "");
    sheet.rows[rowIndex - 1] = row;
  }
  return JSON.stringify(workbook, null, 2);
}

export default class WorkObjectCollaborationService {
  constructor({ workObjectService, runtimeService = null, events = null } = {}) {
    this.workObjectService = workObjectService;
    this.runtimeService = runtimeService;
    this.events = events;
    this.sessions = new Map();
  }

  getSession(workObjectId, entryPath) {
    const key = sessionKey(workObjectId, entryPath);
    let session = this.sessions.get(key);
    if (!session) {
      const current = this.workObjectService.readContent({ workObjectId, entryPath });
      session = {
        key,
        workObjectId: String(workObjectId),
        entryPath: current.entryPath,
        content: current.content,
        version: 0,
        persistedRevision: Number(current.workObject.revision || 1),
        operations: [],
        flushTimer: null,
        flushing: null,
        dirty: false
      };
      this.sessions.set(key, session);
    }
    return session;
  }

  state({ workObjectId, entryPath, actorUserId = null, shareToken = "" } = {}) {
    const workObject = this.workObjectService.get(workObjectId);
    if (!workObject) throw new AppError("Work object not found", 404);
    this.workObjectService.assertAccess(
      workObject,
      { actorUserId, shareToken },
      "viewer"
    );
    const session = this.getSession(workObjectId, entryPath);
    return {
      version: session.version,
      content: session.content,
      contentHash: contentHash(session.content),
      persistedRevision: session.persistedRevision
    };
  }

  reset({
    workObjectId,
    entryPath = "",
    content = "",
    revision = null,
    preserveVersion = false
  } = {}) {
    const resolvedEntryPath =
      String(entryPath || "").replace(/\\/g, "/") ||
      this.workObjectService.readContent({ workObjectId, entryPath }).entryPath;
    const candidateKeys = [
      sessionKey(workObjectId, entryPath),
      sessionKey(workObjectId, resolvedEntryPath)
    ];
    let session = candidateKeys
      .map((key) => this.sessions.get(key))
      .find(Boolean);
    if (!session) return null;
    if (session.flushTimer) clearTimeout(session.flushTimer);
    session.flushTimer = null;
    session.content = String(content || "");
    session.persistedRevision = Number(revision || session.persistedRevision || 1);
    session.operations = [];
    session.dirty = false;
    if (!preserveVersion) session.version += 1;
    if (session.key !== sessionKey(workObjectId, resolvedEntryPath)) {
      this.sessions.delete(session.key);
      session.key = sessionKey(workObjectId, resolvedEntryPath);
      session.entryPath = resolvedEntryPath;
      this.sessions.set(session.key, session);
    }
    return session;
  }

  apply({
    workObjectId,
    entryPath,
    actorUserId = null,
    shareToken = "",
    clientId = "",
    baseVersion = 0,
    operation = null
  } = {}) {
    const workObject = this.workObjectService.get(workObjectId);
    if (!workObject) throw new AppError("Work object not found", 404);
    this.workObjectService.assertAccess(
      workObject,
      { actorUserId, shareToken },
      "editor"
    );
    if (!operation || typeof operation !== "object") {
      throw new AppError("A collaboration operation is required", 400);
    }
    const session = this.getSession(workObjectId, entryPath);
    const existingOperation = session.operations.find(
      (item) => String(item.id) === String(operation.id || "")
    );
    if (existingOperation) {
      return {
        version: session.version,
        operation: existingOperation,
        content: session.content,
        contentHash: contentHash(session.content),
        persistedRevision: session.persistedRevision
      };
    }
    const normalizedBase = Math.max(0, Number(baseVersion || 0));
    const intervening = session.operations.filter(
      (item) => Number(item.version) > normalizedBase
    );
    let appliedOperation = {
      ...operation,
      id: String(operation.id || randomUUID()),
      clientId: String(clientId || ""),
      actorUserId: Number(actorUserId || 0),
      baseVersion: normalizedBase,
      createdAt: new Date().toISOString()
    };

    if (appliedOperation.kind === "text.splice") {
      appliedOperation = transformTextOperation(appliedOperation, intervening);
      session.content = applyTextOperation(session.content, appliedOperation);
    } else if (appliedOperation.kind === "sheet.cells") {
      session.content = applySheetCells(session.content, appliedOperation);
    } else if (appliedOperation.kind === "content.replace") {
      if (intervening.length) {
        throw new AppError("The document changed while this replacement was pending", 409, {
          version: session.version,
          content: session.content,
          contentHash: contentHash(session.content)
        });
      }
      session.content = String(appliedOperation.content || "");
    } else {
      throw new AppError(`Unsupported collaboration operation: ${appliedOperation.kind}`, 400);
    }

    session.version += 1;
    session.dirty = true;
    appliedOperation.version = session.version;
    session.operations.push(appliedOperation);
    session.operations = session.operations.slice(-300);
    this.scheduleFlush(session);
    this.events?.emit(`work-object:${session.workObjectId}`, {
      type: "operation",
      workObjectId: session.workObjectId,
      entryPath: session.entryPath,
      version: session.version,
      operation: appliedOperation,
      content: session.content,
      contentHash: contentHash(session.content)
    });
    return {
      version: session.version,
      operation: appliedOperation,
      content: session.content,
      contentHash: contentHash(session.content),
      persistedRevision: session.persistedRevision
    };
  }

  scheduleFlush(session) {
    if (session.flushTimer) clearTimeout(session.flushTimer);
    session.flushTimer = setTimeout(() => {
      session.flushTimer = null;
      this.flush(session).catch(() => undefined);
    }, 650);
  }

  async flush(sessionOrInput) {
    const session =
      sessionOrInput?.key
        ? sessionOrInput
        : this.getSession(sessionOrInput.workObjectId, sessionOrInput.entryPath);
    if (session.flushing) return session.flushing;
    if (!session.dirty) {
      return {
        version: session.version,
        persistedRevision: session.persistedRevision,
        contentHash: contentHash(session.content)
      };
    }
    session.flushing = (async () => {
      const contentAtStart = session.content;
      const versionAtStart = session.version;
      let updated;
      try {
        updated = await this.workObjectService.updateContent({
          workObjectId: session.workObjectId,
          entryPath: session.entryPath,
          content: contentAtStart,
          note: "Collaborative edit",
          actor: "collaboration",
          expectedRevision: session.persistedRevision
        });
      } catch (error) {
        if (Number(error?.statusCode || error?.status) === 409) {
          const current = this.workObjectService.readContent({
            workObjectId: session.workObjectId,
            entryPath: session.entryPath
          });
          const currentWorkObject = this.workObjectService.get(session.workObjectId);
          this.reset({
            workObjectId: session.workObjectId,
            entryPath: current.entryPath,
            content: current.content,
            revision: currentWorkObject?.revision
          });
          this.events?.emit(`work-object:${session.workObjectId}`, {
            type: "collaboration_conflict",
            workObjectId: session.workObjectId,
            entryPath: current.entryPath,
            version: session.version,
            revision: currentWorkObject?.revision || null,
            contentHash: contentHash(current.content)
          });
        }
        throw error;
      }
      session.persistedRevision = Number(updated.revision || session.persistedRevision);
      session.dirty =
        session.version !== versionAtStart || session.content !== contentAtStart;
      this.runtimeService?.syncPersistedUpdate({
        workObjectId: session.workObjectId,
        entryPath: session.entryPath,
        content: contentAtStart,
        revision: updated.revision
      });
      this.events?.emit(`work-object:${session.workObjectId}`, {
        type: "content",
        source: "collaboration",
        revision: updated.revision,
        entryPath: session.entryPath,
        actorUserId: null,
        version: versionAtStart,
        contentHash: contentHash(contentAtStart),
        workObject: updated
      });
      if (session.dirty) this.scheduleFlush(session);
      return {
        version: session.version,
        persistedRevision: session.persistedRevision,
        contentHash: contentHash(session.content),
        workObject: updated
      };
    })();
    try {
      return await session.flushing;
    } finally {
      session.flushing = null;
    }
  }
}
