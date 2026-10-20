import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { ExternalServiceError } from "../../utils/errors.js";

function denied(message = "The web reader only permits public Internet addresses.") {
  return new ExternalServiceError(message, "browser_fetch", 400);
}
export async function resolvePublicUrl(value, resolve = lookup) {
  let url;
  try { url = new URL(value); } catch { throw denied("Invalid web URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      !["", "80", "443"].includes(url.port)) throw denied();
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw denied();
  const addresses = ipaddr.isValid(host)
    ? [{ address: host, family: ipaddr.parse(host).kind() === "ipv6" ? 6 : 4 }]
    : await resolve(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => {
    try { return ipaddr.process(address).range() !== "unicast"; } catch { return true; }
  })) throw denied();
  return { url, address: addresses[0] };
}

function readResponse(url, address, { headers, signal, maxBytes }) {
  return new Promise((resolve, reject) => {
    // Pin the connection to the validated address: no second DNS lookup/rebinding.
    const request = (url.protocol === "https:" ? https : http).request(url, {
      method: "GET", signal,
      headers: { ...headers, "Accept-Encoding": "identity" },
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      }
    }, response => {
      const status = response.statusCode || 502;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.destroy();
        resolve({ status, location });
        return;
      }
      if ((response.headers["content-encoding"] || "identity") !== "identity" ||
          Number(response.headers["content-length"] || 0) > maxBytes) {
        response.destroy();
        reject(new ExternalServiceError("Web response exceeds supported limits.", "browser_fetch", 413));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on("data", chunk => {
        size += chunk.length;
        if (size > maxBytes) {
          response.destroy(new ExternalServiceError("Web response exceeds the byte limit.", "browser_fetch", 413));
        } else chunks.push(chunk);
      });
      response.on("end", () => resolve({ status, headers: response.headers, buffer: Buffer.concat(chunks) }));
      response.on("error", reject);
      response.on("aborted", () => reject(new ExternalServiceError("Web response was interrupted.", "browser_fetch", 502)));
    });
    request.on("error", reject);
    request.end();
  });
}

export async function fetchPublicPage(value, {
  headers = {}, timeoutMs = 15000, maxBytes = 2_000_000,
  resolve = lookup, request = readResponse
} = {}) {
  const signal = AbortSignal.timeout(Math.min(Math.max(100, timeoutMs), 45000));
  let current = value;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const { url, address } = await resolvePublicUrl(current, resolve);
    signal.throwIfAborted();
    const response = await request(url, address, { headers, signal, maxBytes });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.location || redirects === 5) throw denied("Too many or invalid web redirects.");
      current = new URL(response.location, url).href;
      // Custom credentials never follow a redirect.
      headers = Object.fromEntries(Object.entries(headers).filter(([key]) => ["accept", "user-agent"].includes(key.toLowerCase())));
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new ExternalServiceError(`Browser fetch returned ${response.status}`, "browser_fetch", response.status);
    }
    return { url: url.href, status: response.status, contentType: response.headers["content-type"] || "", buffer: response.buffer };
  }
}
