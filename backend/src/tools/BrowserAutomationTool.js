import { detectBrowserNeed } from "../runtime/browser.intent.js";
import BaseTool from "./BaseTool.js";

function summarizeLinks(links = []) {
  return links
    .slice(0, 6)
    .map((link) => `${link.text || link.href} -> ${link.href}`)
    .join(" | ");
}

function summarizeControls(controls = []) {
  return controls
    .slice(0, 6)
    .map((control) => `${control.text} [${control.tag}]`)
    .join(" | ");
}

export class BrowserAutomationTool extends BaseTool {
  constructor({ runtimeAdapter }) {
    super({
      id: "browser_automation",
      label: "Browser Automation",
      description: "Navigates, inspects, clicks, fills forms, lists links and captures screenshots with the runtime browser session.",
      permissions: ["browser", "network"]
    });
    this.runtimeAdapter = runtimeAdapter;
  }

  async execute(input = {}) {
    const browserNeed = input.browserNeed || detectBrowserNeed(input.prompt || "") || {};
    const action = input.action || browserNeed.action || "inspect";
    const url = input.url || browserNeed.url || "";
    const sessionId = input.sessionId || null;
    const selector = input.selector || browserNeed.selector || "";
    const value = input.value || browserNeed.value || "";

    if (!url && !sessionId) {
      return {
        success: false,
        providerId: this.id,
        sourceType: "tool",
        sourceName: this.label,
        capability: "browser_automation",
        summaryText: "No browser target URL or active session was provided.",
        artifacts: []
      };
    }

    let result;
    let artifacts = [];

    if (action === "click") {
      result = await this.runtimeAdapter.clickBrowser({
        url,
        sessionId,
        selector
      });
    } else if (action === "fill") {
      result = await this.runtimeAdapter.fillBrowser({
        url,
        sessionId,
        selector,
        value,
        submit: Boolean(input.submit)
      });
    } else if (action === "links") {
      result = await this.runtimeAdapter.listBrowserLinks({
        url,
        sessionId,
        limit: input.limit || 20
      });
    } else if (action === "screenshot") {
      const artifact = await this.runtimeAdapter.captureBrowserScreenshot({
        url,
        sessionId,
        title: input.title || "browser-capture",
        conversationId: input.conversationId || null,
        userId: input.userId || null
      });
      artifacts = artifact ? [artifact] : [];
      result = {
        url,
        artifactId: artifact?.id || null
      };
    } else {
      const navigation = await this.runtimeAdapter.navigateBrowser({
        url,
        sessionId
      });
      const extraction = await this.runtimeAdapter.extractBrowserContent({
        sessionId,
        selector: selector || "body",
        maxChars: input.maxChars || 3600
      });
      const links = await this.runtimeAdapter.listBrowserLinks({
        sessionId,
        limit: input.limit || 12
      });
      result = {
        ...navigation,
        text: extraction.text,
        links: links.links
      };
    }

    const summaryText =
      action === "links"
        ? summarizeLinks(result.links || []) ||
          summarizeControls(result.controls || []) ||
          `No visible links were detected on ${result.url || url || "the active page"}`
        : action === "screenshot"
          ? `Browser screenshot captured for ${url || "active session"}`
          : `${result.title || result.currentUrl || result.url || url} | ${String(result.text || summarizeLinks(result.links || []) || "").slice(0, 320)}`;

    return {
      success: true,
      providerId: this.id,
      sourceType: "tool",
      sourceName: this.label,
      capability: `browser_${action}`,
      raw: result,
      normalized: result,
      summaryText,
      artifacts
    };
  }
}

export default BrowserAutomationTool;
