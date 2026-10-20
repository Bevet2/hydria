// Keep the disposable server and probes in one process/network environment.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
const scripts = process.argv.slice(2);
if (!scripts.length) throw Error("Provide one or more backend script names");
if (scripts.some(name => !/^[a-zA-Z0-9-]+$/.test(name))) throw Error("Invalid script name");
const cwd = path.resolve(import.meta.dirname, "..");
const root = path.resolve(cwd, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "hydria-local-validation-"));
const port = process.env.HYDRIA_VALIDATION_PORT || "3381";
const base = `http://127.0.0.1:${port}`;
const log = fs.openSync(path.join(temp, "server.log"), "w");
const child = spawn(process.execPath, ["server.js"], { cwd, stdio: ["ignore", log, log], env: {
  ...process.env, NODE_ENV: "test", PORT: port, HYDRIA_OS_DATA_DIR: path.join(temp, "data"),
  LOCAL_LLM_ENABLED: "false", HYDRIA_FLOW_CONNECTOR_TOKEN: "ci-flow-results-token"
} });
let failures = 0;
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null) throw Error("Server exited: " + fs.readFileSync(path.join(temp, "server.log"), "utf8"));
    try { if ((await fetch(base + "/livez")).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw Error("Local validation server did not start");
  await fetch(base + "/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "validation-owner" }) });
  for (const script of scripts) {
    console.log("RUN", script);
    // Match CI's repository-root working directory, including browser fixtures.
    const run = spawn(process.execPath, [path.join(cwd, `scripts/${script}.mjs`)], { cwd: root, stdio: "inherit", env: {
      ...process.env, HYDRIA_VISUAL_BASE_URL: base, HYDRIA_BUGHUNT_BASE_URL: base, HYDRIA_GATE_BASE_URL: base,
      HYDRIA_TEST_ORIGIN: base,
      HYDRIA_BUGHUNT_STRICT: "1"
    } });
    const watchdog = setTimeout(() => run.kill("SIGTERM"), 600_000);
    await once(run, "exit"); clearTimeout(watchdog);
    if (run.exitCode !== 0) failures++;
    console.log(run.exitCode === 0 ? "PASS" : "FAIL", script);
  }
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await once(child, "exit");
  }
  fs.closeSync(log);
  console.log("Validation log:", path.join(temp, "server.log"));
}
process.exitCode = failures ? 1 : 0;
