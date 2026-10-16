// Private single-tenant production access gate for Hydria OS.
// Not a substitute for multi-user identity, roles, or tenant authorization.
import { createHash, timingSafeEqual } from "node:crypto";

export class ProductionConfigError extends Error {
  constructor(message) { super(message); this.name = "ProductionConfigError"; }
}
function equalsFixedTime(a, b) {
  const digest = (value) => createHash("sha256").update(String(value)).digest();
  return timingSafeEqual(digest(a), digest(b));
}
export function productionSettings(env = process.env) {
  const production = env.NODE_ENV === "production";
  if (!production) return { production: false };
  const username = String(env.HYDRIA_OS_ACCESS_USERNAME || "");
  const password = String(env.HYDRIA_OS_ACCESS_PASSWORD || "");
  const suppliedOrigin = String(env.HYDRIA_OS_PUBLIC_ORIGIN || "");
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(username)) {
    throw new ProductionConfigError("Production requires HYDRIA_OS_ACCESS_USERNAME (3–64 safe characters).");
  }
  if (password.length < 20 || password.length > 512 ||
      /^((password)|(change.?me)|(hydria123))/i.test(password)) {
    throw new ProductionConfigError("Production requires a strong HYDRIA_OS_ACCESS_PASSWORD (minimum 20 characters).");
  }
  let origin;
  try {
    const parsed = new URL(suppliedOrigin);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
        parsed.pathname !== "/" || parsed.search || parsed.hash ||
        !parsed.hostname || parsed.hostname === "localhost") throw Error("origin");
    origin = parsed.origin;
  } catch {
    throw new ProductionConfigError("Production requires HTTPS HYDRIA_OS_PUBLIC_ORIGIN (for example https://os.example.org).");
  }
  if (env.HYDRIA_OS_ACCESS_USERNAME === env.HYDRIA_OS_ACCESS_PASSWORD) {
    throw new ProductionConfigError("Hydria OS username and password must differ.");
  }
  return { production: true, username, password, origin };
}
function decodeBasicHeader(value = "") {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(String(value).trim());
  if (!match || match[1].length > 1200) return null;
  try {
    const bytes = Buffer.from(match[1], "base64");
    if (!bytes.length || bytes.length > 700 || bytes.toString("base64") !== match[1]) return null;
    const decoded = bytes.toString("utf8");
    if (!Buffer.from(decoded, "utf8").equals(bytes)) return null;
    const index = decoded.indexOf(":");
    if (index < 1) return null;
    return { username: decoded.slice(0, index), password: decoded.slice(index + 1) };
  } catch { return null; }
}
export function createProductionAccessGate(settings) {
  if (!settings.production) return (_req, _res, next) => next();
  const { username, password, origin } = settings;
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Vary", "Authorization");
    // Public to reverse-proxy/healthcheck only. No user content, DB status,
    // version, or environment variables may be exposed by this endpoint.
    if (req.path === "/livez" && req.method === "GET") return next();

    const auth = decodeBasicHeader(req.get("authorization"));
    const validUser = equalsFixedTime(auth?.username || "", username);
    const validPass = equalsFixedTime(auth?.password || "", password);
    if (!(auth && validUser && validPass)) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Hydria OS", charset="UTF-8"');
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    // Cross-site HTML forms can submit with HTTP Basic credentials. Block
    // mutating methods from unapproved origins even without CORS access.
    const method = String(req.method).toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const requestOrigin = req.get("origin");
      if (requestOrigin && requestOrigin !== origin) {
        return res.status(403).json({ success: false, error: "Request origin denied" });
      }
      const fetchSite = req.get("sec-fetch-site");
      if (fetchSite === "cross-site") {
        return res.status(403).json({ success: false, error: "Cross-site request denied" });
      }
    }
    return next();
  };
}
