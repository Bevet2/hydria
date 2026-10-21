import http from "node:http";
import https from "node:https";
import config from "../config/hydria.config.js";

// Headers describing a single transport hop must not leak across proxies.
// Connection can nominate additional hop-by-hop headers, so parse its tokens too.
const HOP_HEADERS = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "proxy-connection", "te", "trailer", "transfer-encoding", "upgrade"
]);
const SPOOFABLE_FORWARDING_HEADERS = new Set([
  "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-for",
  "x-real-ip"
]);

function stripHopHeaders(input, extra = []) {
  const blocked = new Set([...HOP_HEADERS, ...extra]);
  const connection = String(input?.connection || "");
  for (const token of connection.split(",")) {
    if (token.trim()) blocked.add(token.trim().toLowerCase());
  }
  return Object.fromEntries(
    Object.entries(input || {}).filter(([name, value]) =>
      value !== undefined && !blocked.has(name.toLowerCase()))
  );
}

export function createCrmApiProxy({
  apiUrl = config.crm.apiUrl,
  timeoutMs = config.crm.timeoutMs,
  publicOrigin = process.env.HYDRIA_OS_PUBLIC_ORIGIN || ""
} = {}) {
  const target = new URL(apiUrl);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("CRM_API_URL must use HTTP or HTTPS");
  }
  if (target.username || target.password) {
    throw new Error("CRM_API_URL must not embed credentials");
  }
  const transport = target.protocol === "https:" ? https : http;
  const targetBasePath = target.pathname.replace(/\/+$/, "");
  const deadlineMs = Math.max(50, Number(timeoutMs) || 15000);
  const origin = publicOrigin ? new URL(publicOrigin) : null;

  return function proxyCrmApi(req, res) {
    const headers = stripHopHeaders(req.headers, SPOOFABLE_FORWARDING_HEADERS);
    delete headers.host;
    // Never pass the OS gateway's shared HTTP Basic secret to the CRM.
    if (/^Basic\s+/i.test(String(headers.authorization || ""))) {
      delete headers.authorization;
    }
    headers["x-forwarded-host"] = origin?.host || req.headers.host || "";
    headers["x-forwarded-proto"] = origin?.protocol.replace(/:$/, "") || req.protocol || "http";
    headers["x-forwarded-for"] = req.socket?.remoteAddress || "";

    let clientGone = false;
    let timedOut = false;
    let finished = false;
    const outgoing = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      method: req.method,
      path: targetBasePath + (req.url.startsWith("/") ? req.url : "/" + req.url),
      headers
    }, (upstream) => {
      if (clientGone || res.headersSent) {
        upstream.destroy();
        return;
      }
      res.status(upstream.statusCode || 502);
      for (const [name, value] of Object.entries(stripHopHeaders(upstream.headers))) {
        res.setHeader(name, value);
      }
      upstream.on("error", () => {
        // The upstream may disconnect after headers and an incomplete body.
        if (!res.writableEnded) res.destroy();
      });
      upstream.pipe(res);
    });

    const clear = () => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      req.off("aborted", onClientAbort);
    };
    const onClientAbort = () => {
      clientGone = true;
      outgoing.destroy();
      clear();
    };
    const deadline = setTimeout(() => {
      timedOut = true;
      outgoing.destroy(new Error("CRM upstream timeout"));
    }, deadlineMs);
    deadline.unref?.();

    req.once("aborted", onClientAbort);
    res.once("close", () => {
      if (!res.writableEnded) {
        clientGone = true;
        outgoing.destroy();
      }
      clear();
    });
    res.once("finish", clear);
    outgoing.on("error", () => {
      if (clientGone || res.writableEnded || res.destroyed) return;
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.status(timedOut ? 504 : 503).json({
        error: timedOut ? "Hydria CRM API timed out." : "Hydria CRM API is unavailable."
      });
    });

    req.pipe(outgoing);
  };
}

export const proxyCrmApi = createCrmApiProxy();
export default proxyCrmApi;
