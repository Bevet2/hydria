import http from "node:http";
import https from "node:https";
import config from "../config/hydria.config.js";

const target = new URL(config.crm.apiUrl);
const transport = target.protocol === "https:" ? https : http;
const targetBasePath = target.pathname.replace(/\/+$/, "");

export function proxyCrmApi(req, res) {
  const headers = { ...req.headers };
  delete headers.host;
  headers["x-forwarded-host"] = req.headers.host || "";
  headers["x-forwarded-proto"] = req.protocol || "http";

  const proxyRequest = transport.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      method: req.method,
      path: `${targetBasePath}${req.url.startsWith("/") ? req.url : `/${req.url}`}`,
      headers
    },
    (proxyResponse) => {
      res.status(proxyResponse.statusCode || 502);
      for (const [name, value] of Object.entries(proxyResponse.headers)) {
        if (value !== undefined) {
          res.setHeader(name, value);
        }
      }
      proxyResponse.pipe(res);
    }
  );

  proxyRequest.on("error", (error) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(503).json({
      error: "Hydria CRM API is unavailable.",
      details: error.message
    });
  });

  req.pipe(proxyRequest);
}

export default proxyCrmApi;
