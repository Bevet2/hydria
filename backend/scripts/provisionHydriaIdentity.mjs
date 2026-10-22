// Provision or rotate credentials only for an existing Hydria user profile.
// The password is read on stdin, never from arguments or an environment variable.
import { initDatabase, db, closeDatabase } from "../db/sqlite.js";
import { IdentitySessionStore } from "../services/identity/identitySessionStore.js";

const username = process.argv[2];
if (typeof username !== "string" || !username.trim() || username.length > 100 || process.argv.length !== 3) {
  process.stderr.write("Usage: node provisionHydriaIdentity.mjs <existing-username> (password via stdin)\n");
  process.exitCode = 2;
} else if (process.stdin.isTTY) {
  process.stderr.write("Refusing an echoed TTY password. Pipe the secret through stdin using a hidden shell prompt.\n");
  process.exitCode = 2;
} else {
  try {
    let secret = "";
    for await (const chunk of process.stdin) {
      secret += chunk.toString("utf8");
      if (Buffer.byteLength(secret, "utf8") > 1024) throw new Error("Password input is too long");
    }
    const password = secret.replace(/\r?\n$/, "");
    initDatabase();
    const user = db.prepare("SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)")
      .get(username.trim());
    if (!user) throw new Error("Existing Hydria user profile not found");
    new IdentitySessionStore(db).setPassword(user.id, password);
    process.stdout.write(`Hydria credentials updated for ${user.username}; existing sessions revoked.\n`);
  } catch (error) {
    process.stderr.write(`Could not provision Hydria identity: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    try { closeDatabase(); } catch { /* SQLite was not initialized. */ }
  }
}
