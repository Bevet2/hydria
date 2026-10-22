import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { IdentitySessionStore } from "../services/identity/identitySessionStore.js";

const directory = mkdtempSync(path.join(os.tmpdir(), "hydria-identity-server-"));
const database = new Database(path.join(directory, "hydria.sqlite"));
database.pragma("foreign_keys = ON");
database.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
database.prepare("INSERT INTO users (username, created_at, updated_at) VALUES ('integration', '2026', '2026')").run();
new IdentitySessionStore(database).setPassword(1, "Operator-provisioned-pass-482!");
database.close();

const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await new Promise((resolve) => reservation.once("listening", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));

const child = spawn(process.execPath, ["server.js"], {
  cwd: new URL("../", import.meta.url).pathname,
  env: {
    ...process.env,
    NODE_ENV: "test", PORT: String(port), HYDRIA_OS_DATA_DIR: directory,
    HYDRIA_FLOW_CONNECTOR_TOKEN: "", HYDRIA_FLOW_SCHEDULER_ENABLED: "false"
  },
  stdio: ["ignore", "pipe", "pipe"]
});
let stderr = "";
child.stderr.on("data", (data) => { stderr = (stderr + data.toString()).slice(-2_000); });
child.stdout.resume();
const base = `http://127.0.0.1:${port}`;

try {
  let ready = false;
  for (let trial = 0; trial < 80; trial += 1) {
    if (child.exitCode !== null) break;
    try {
      ready = (await fetch(`${base}/livez`, { signal: AbortSignal.timeout(500) })).status === 200;
      if (ready) break;
    } catch { /* Backend is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `Hydria backend failed to start: ${stderr}`);
  const response = await fetch(`${base}/api/identity/session`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "integration", password: "Operator-provisioned-pass-482!" })
  });
  assert.equal(response.status, 201, "The actual Hydria backend must mount the identity router");
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  const me = await fetch(`${base}/api/identity/session`, { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.deepEqual((await me.json()).user, { id: 1, username: "integration" });
  console.log("Hydria full backend: credential login and session lookup mounted and responding.");
} finally {
  child.kill("SIGTERM");
  if (child.exitCode === null) await new Promise((resolve) => child.once("exit", resolve));
  rmSync(directory, { recursive: true, force: true });
}
