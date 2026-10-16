// Operational readiness checks, separate from the public process liveness.
// Data/driver errors must not be hidden behind a hard-coded "ready" response.
import fs from "node:fs";
import path from "node:path";

export function inspectOsReadiness({ database, dataDir, frontendDir } = {}) {
  const checks = {
    database: "unavailable",
    storage: "unavailable",
    frontend: "unavailable"
  };
  try {
    if (database?.prepare("SELECT 1 AS healthy").get()?.healthy === 1) {
      checks.database = "ready";
    }
  } catch { /* Errors deliberately summarized without paths or credentials. */ }
  try {
    fs.accessSync(dataDir, fs.constants.R_OK | fs.constants.W_OK);
    if (fs.statSync(dataDir).isDirectory()) checks.storage = "ready";
  } catch { /* Do not disclose full server paths in status output. */ }
  try {
    if (fs.statSync(path.join(frontendDir, "index.html")).isFile()) {
      checks.frontend = "ready";
    }
  } catch {}
  return { ready: Object.values(checks).every((value) => value === "ready"), checks };
}
