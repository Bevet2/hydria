import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "./errors.js";

export function atomicWriteFile(file, content) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(file)}.${randomUUID()}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
    // Persist the rename on POSIX; Windows does not permit opening directories.
    if (process.platform !== "win32") {
      const dir = fs.openSync(directory, "r");
      try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
    }
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
  }
}

export function readJsonFile(file, { allowArray = false } = {}) {
  try {
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!state || typeof state !== "object" || (!allowArray && Array.isArray(state))) throw Error("Invalid state");
    return state;
  } catch {
    throw new AppError("Persistent data is unreadable. Restore a verified backup before writing.", 503);
  }
}

export function writeJsonFile(file, state) {
  if (fs.existsSync(file)) {
    // Never turn a broken catalog into an empty one, including direct writes.
    const previous = readJsonFile(file, { allowArray: Array.isArray(state) });
    atomicWriteFile(file + ".previous", JSON.stringify(previous, null, 2));
  }
  atomicWriteFile(file, JSON.stringify(state, null, 2));
}
