import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { IdentitySessionStore } from "../services/identity/identitySessionStore.js";

const directory = mkdtempSync(path.join(os.tmpdir(), "hydria-auth-provision-"));
const file = path.join(directory, "hydria.sqlite");
const db = new Database(file);
db.pragma("foreign_keys = ON");
db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
db.prepare("INSERT INTO users (username, created_at, updated_at) VALUES ('arnaud', '2026', '2026')").run();
const provisionScript = new URL("./provisionHydriaIdentity.mjs", import.meta.url).pathname;
const execute = (name, password) => spawnSync(process.execPath, [provisionScript, name], {
  input: password, encoding: "utf8", timeout: 8_000,
  env: { ...process.env, HYDRIA_OS_DATA_DIR: directory }
});

try {
  const missing = execute("someone-else", "Long-input-secret-password!\n");
  assert.notEqual(missing.status, 0, "An unknown user must not create an authenticated account");
  assert.equal(db.prepare("SELECT count(*) AS count FROM hydria_user_credentials").get().count, 0);

  const result = execute("arnaud", "Long-input-secret-password!\n");
  assert.equal(result.status, 0, `The operator must be able to provision an existing profile: ${result.stderr}`);
  assert.doesNotMatch(result.stdout + result.stderr, /Long-input-secret-password!/,
    "Neither stdout nor stderr may expose the password");
  const store = new IdentitySessionStore(db);
  assert.equal(store.authenticate("arnaud", "Long-input-secret-password!")?.user.id, 1);
  const session = store.authenticate("arnaud", "Long-input-secret-password!");
  assert.ok(session);
  const rotation = execute("arnaud", "New-different-password-42!\n");
  assert.equal(rotation.status, 0);
  assert.equal(store.resolve(session.token), null, "Operator rotation revokes existing sessions");
  assert.equal(store.authenticate("arnaud", "Long-input-secret-password!"), null);
  assert.equal(store.authenticate("arnaud", "New-different-password-42!")?.user.id, 1);
  console.log("Hydria identity operator provisioning: existing accounts only; password hidden; rotation revokes sessions.");
} finally {
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
