import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PASSWORD_KEY_LENGTH = 64;
const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
// An absent account still runs the password KDF, avoiding an inexpensive
// username-existence oracle. Errors and responses stay identical.
const DUMMY_SALT = Buffer.from("d33f20dc18cb47b68a49afda2b10eb49", "hex");
const DUMMY_DIGEST = scryptSync("hydria-not-a-real-account", DUMMY_SALT, PASSWORD_KEY_LENGTH);

const hashToken = (token) => createHash("sha256").update(token, "utf8").digest("hex");
const validUserId = (value) => Number.isSafeInteger(value) && value > 0;

function derivePassword(password, salt) {
  return scryptSync(password, salt, PASSWORD_KEY_LENGTH);
}

export class IdentitySessionStore {
  constructor(database, { now = Date.now, sessionTtlMs = DEFAULT_SESSION_TTL_MS } = {}) {
    if (!database || typeof database.prepare !== "function") throw new TypeError("Database required");
    if (!Number.isSafeInteger(sessionTtlMs) || sessionTtlMs <= 0) {
      throw new RangeError("Session TTL must be positive");
    }
    this.database = database;
    this.now = now;
    this.sessionTtlMs = sessionTtlMs;
  }

  // Operator-only provisioning. Do not expose this via an unauthenticated
  // username-registration endpoint: legacy profiles do not prove ownership.
  setPassword(userId, password) {
    if (!validUserId(userId)) throw new TypeError("Existing user ID required");
    if (typeof password !== "string" || password.length < 12 || password.length > 256 ||
        !password.trim()) throw new TypeError("Password must be between 12 and 256 characters");
    const user = this.database.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) throw new RangeError("Account not found");
    const salt = randomBytes(16);
    const digest = derivePassword(password, salt);
    const timestamp = this.now();
    this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO hydria_user_credentials (user_id, password_salt, password_hash, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          password_salt = excluded.password_salt,
          password_hash = excluded.password_hash,
          updated_at = excluded.updated_at
      `).run(userId, salt.toString("hex"), digest.toString("hex"), timestamp);
      this.database.prepare("DELETE FROM hydria_identity_sessions WHERE user_id = ?").run(userId);
    })();
  }

  authenticate(username, password) {
    const validInput = typeof username === "string" && username.trim().length > 0 &&
      username.length <= 100 && typeof password === "string" && password.length <= 256;
    const account = validInput ? this.database.prepare(`
      SELECT u.id, u.username, c.password_salt, c.password_hash
        FROM users u
        JOIN hydria_user_credentials c ON c.user_id = u.id
       WHERE LOWER(u.username) = LOWER(?)
       LIMIT 1
    `).get(username.trim()) : null;
    const salt = account ? Buffer.from(account.password_salt, "hex") : DUMMY_SALT;
    const expected = account ? Buffer.from(account.password_hash, "hex") : DUMMY_DIGEST;
    const supplied = derivePassword(validInput ? password : "", salt);
    if (!validInput || !account || expected.length !== supplied.length ||
        !timingSafeEqual(expected, supplied)) return null;

    const token = randomBytes(32).toString("base64url");
    const createdAt = this.now();
    const expiresAt = createdAt + this.sessionTtlMs;
    this.database.transaction(() => {
      this.database.prepare("DELETE FROM hydria_identity_sessions WHERE expires_at <= ?").run(createdAt);
      this.database.prepare(`
        INSERT INTO hydria_identity_sessions (token_hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(hashToken(token), account.id, createdAt, expiresAt);
    })();
    return { token, user: { id: account.id, username: account.username }, expiresAt };
  }

  resolve(token) {
    if (typeof token !== "string" || !SESSION_TOKEN_PATTERN.test(token)) return null;
    const row = this.database.prepare(`
      SELECT u.id, u.username, s.expires_at
      FROM hydria_identity_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(hashToken(token), this.now());
    return row ? { id: row.id, username: row.username } : null;
  }

  revoke(token) {
    if (typeof token !== "string" || !SESSION_TOKEN_PATTERN.test(token)) return false;
    return this.database.prepare("DELETE FROM hydria_identity_sessions WHERE token_hash = ?")
      .run(hashToken(token)).changes > 0;
  }
}
