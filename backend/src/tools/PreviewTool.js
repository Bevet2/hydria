import config from "../../config/hydria.config.js";
import { detectBrowserNeed } from "../runtime/browser.intent.js";
import { BaseTool } from "./BaseTool.js";

function extractUrls(prompt = "") {
  const matches = String(prompt || "").match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  return [...new Set(matches.map((url) => url.replace(/[),.;!?]+$/, "")))];
}

function inferPreviewUrl(prompt = "") {
  const explicit = extractUrls(prompt).find((url) => /localhost|127\.0\.0\.1/i.test(url));
  if (explicit) {
    return explicit;
  }

  if (/\b(hydria|this app|current app|ui|render|preview|frontend|page|screen|rendu|affichage)\b/i.test(prompt)) {
    return `http://localhost:${config.port}`;
  }

  return extractUrls(prompt)[0] || "";
}

export class PreviewTool extends BaseTool {
  constructor({ runtimeAdapter }) {
    super({
      id: "preview_inspector",
      label: "Preview Inspector",
      description: "Inspects a local preview URL, extracts visible content, links and can capture a screenshot.",
      permissions: ["browser:read", "network"]
    });
    this.runtimeAdapter = runtimeAdapter;
  }

  async execute({ prompt = "", conversationId = null, userId = null, sessionId = null } = {}) {
    const browserNeed = detectBrowserNeed(prompt);
    const url = browserNeed?.url || inferPreviewUrl(prompt);

    if (!url) {
      return {
        providerId: "preview_inspector",
        sourceType: "tool",
        sourceName: "Preview Inspector",
        capability: "inspect_preview",
        raw: {},
        normalized: {},
        summaryText: "No preview URL could be inferred from the request.",
        artifacts: []
      };
    }

    const navigation = await this.runtimeAdapter.navigateBrowser({
      url,
      sessionId
    });
    const extraction = await this.runtimeAdapter.extractBrowserContent({
      sessionId,
      selector: "body",
      maxChars: 3200
    });
    const links = await this.runtimeAdapter.listBrowserLinks({
      sessionId,
      limit: 12
    });

    let screenshotArtifact = null;
    if (config.tools.enableBrowserPreview) {
      screenshotArtifact = await this.runtimeAdapter.captureBrowserScreenshot({
        sessionId,
        title: `preview-${navigation.url.replace(/^https?:\/\//, "")}`,
        conversationId,
        userId
      });
    }

    const artifacts = screenshotArtifact ? [screenshotArtifact] : [];

    return {
      providerId: "preview_inspector",
      sourceType: "tool",
      sourceName: "Preview Inspector",
      capability: "inspect_preview",
      raw: {
        url: navigation.url,
        title: navigation.title,
        text: extraction.text,
        links: links.links
      },
      normalized: {
        url: navigation.url,
        title: navigation.title,
        excerpt: extraction.text,
        links: links.links.slice(0, 6)
      },
      summaryText: `${navigation.title || navigation.url} -> ${navigation.url} | ${String(extraction.text || "").slice(0, 320)}`,
      artifacts
    };
  }
}

export default PreviewTool;
