const CLIENT_ID_KEY = "hydria.collaboration.client-id";
const QUEUE_KEY = "hydria.collaboration.offline-queue";

function createId() {
  return globalThis.crypto?.randomUUID?.() ||
    `collab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "") || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function parseSheet(content = "") {
  try {
    const parsed = JSON.parse(String(content || ""));
    return parsed?.kind === "hydria-sheet" && Array.isArray(parsed.sheets)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function sheetStructureSignature(workbook = {}) {
  return JSON.stringify({
    ...workbook,
    sheets: (workbook.sheets || []).map((sheet) => ({
      ...sheet,
      columns: undefined,
      rows: undefined
    }))
  });
}

function diffSheetCells(previousContent = "", nextContent = "") {
  const previous = parseSheet(previousContent);
  const next = parseSheet(nextContent);
  if (!previous || !next) return null;
  if (sheetStructureSignature(previous) !== sheetStructureSignature(next)) return null;
  if (previous.sheets.length !== next.sheets.length) return null;

  const changes = [];
  for (let sheetIndex = 0; sheetIndex < next.sheets.length; sheetIndex += 1) {
    const before = previous.sheets[sheetIndex];
    const after = next.sheets[sheetIndex];
    if (String(before.id) !== String(after.id)) return null;
    const width = Math.max(before.columns?.length || 0, after.columns?.length || 0);
    for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
      const beforeValue = String(before.columns?.[columnIndex] || "");
      const afterValue = String(after.columns?.[columnIndex] || "");
      if (beforeValue !== afterValue) {
        changes.push({
          sheetId: after.id,
          rowIndex: 0,
          columnIndex,
          value: afterValue
        });
      }
    }
    const height = Math.max(before.rows?.length || 0, after.rows?.length || 0);
    for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
      const beforeRow = before.rows?.[rowIndex] || [];
      const afterRow = after.rows?.[rowIndex] || [];
      const rowWidth = Math.max(beforeRow.length, afterRow.length);
      for (let columnIndex = 0; columnIndex < rowWidth; columnIndex += 1) {
        const beforeValue = String(beforeRow[columnIndex] || "");
        const afterValue = String(afterRow[columnIndex] || "");
        if (beforeValue !== afterValue) {
          changes.push({
            sheetId: after.id,
            rowIndex: rowIndex + 1,
            columnIndex,
            value: afterValue
          });
        }
      }
    }
  }
  return changes.length ? changes : [];
}

export function collaborationClientId() {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = createId();
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

export function buildCollaborationOperation(
  previousContent = "",
  nextContent = "",
  { sheet = false } = {}
) {
  const previous = String(previousContent || "");
  const next = String(nextContent || "");
  if (previous === next) return null;

  if (sheet) {
    const changes = diffSheetCells(previous, next);
    if (Array.isArray(changes) && changes.length) {
      return { id: createId(), kind: "sheet.cells", changes };
    }
    if (Array.isArray(changes)) return null;
  }

  let prefix = 0;
  const sharedLength = Math.min(previous.length, next.length);
  while (prefix < sharedLength && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous[previous.length - suffix - 1] === next[next.length - suffix - 1]
  ) {
    suffix += 1;
  }
  return {
    id: createId(),
    kind: "text.splice",
    index: prefix,
    deleteCount: previous.length - prefix - suffix,
    insert: next.slice(prefix, next.length - suffix)
  };
}

export function applyCollaborationOperation(content = "", operation = {}) {
  if (operation.kind === "text.splice") {
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
  if (operation.kind === "sheet.cells") {
    const workbook = parseSheet(content);
    if (!workbook) return String(content || "");
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
      } else {
        sheet.rows = Array.isArray(sheet.rows) ? sheet.rows : [];
        while (sheet.rows.length < rowIndex) sheet.rows.push([]);
        const row = Array.isArray(sheet.rows[rowIndex - 1])
          ? sheet.rows[rowIndex - 1]
          : [];
        while (row.length <= columnIndex) row.push("");
        row[columnIndex] = String(change.value || "");
        sheet.rows[rowIndex - 1] = row;
      }
    }
    return JSON.stringify(workbook, null, 2);
  }
  if (operation.kind === "content.replace") {
    return String(operation.content || "");
  }
  return String(content || "");
}

export function queueCollaborationOperation(item = {}) {
  const queue = readJson(QUEUE_KEY, []);
  queue.push({ ...item, queuedAt: new Date().toISOString() });
  writeJson(QUEUE_KEY, queue.slice(-500));
  return queue.length;
}

export function collaborationQueueSize() {
  return readJson(QUEUE_KEY, []).length;
}

export async function replayCollaborationOperations(send) {
  const queue = readJson(QUEUE_KEY, []);
  if (!queue.length) return { sent: 0, remaining: 0 };
  const remaining = [];
  let sent = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    try {
      await send(item);
      sent += 1;
    } catch (error) {
      remaining.push(item);
      if (!navigator.onLine || Number(error?.status || 0) >= 500) {
        remaining.push(...queue.slice(index + 1));
        break;
      }
    }
  }
  writeJson(QUEUE_KEY, remaining);
  return { sent, remaining: remaining.length };
}
