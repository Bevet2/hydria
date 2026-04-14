import { randomUUID } from "node:crypto";
import { persistGeneratedArtifact } from "../../services/artifacts/generationStorageService.js";

function truncate(value = "", maxChars = 260) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

export class BrowserRuntimeAdapter {
  constructor({ enabled = true, sessionManager = null }) {
    this.enabled = enabled;
    this.sessionManager = sessionManager;
    this.liveSessions = new Map();
  }

  async createLiveSession(sessionId) {
    if (!this.enabled) {
      throw new Error("Browser runtime is disabled.");
    }

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      channel: "chrome",
      headless: true
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 }
    });
    const page = await context.newPage();

    const live = {
      browser,
      context,
      page,
      currentUrl: "",
      title: ""
    };

    this.liveSessions.set(sessionId, live);
    return live;
  }

  async resolveSession(sessionId = null) {
    if (!sessionId) {
      const ephemeralId = `ephemeral:${randomUUID()}`;
      return {
        persistent: false,
        sessionKey: ephemeralId,
        ...(await this.createLiveSession(ephemeralId))
      };
    }

    const existing = this.liveSessions.get(sessionId);
    if (existing) {
      return {
        persistent: true,
        sessionKey: sessionId,
        ...existing
      };
    }

    const created = await this.createLiveSession(sessionId);
    return {
      persistent: true,
      sessionKey: sessionId,
      ...created
    };
  }

  async cleanupSession(resolved) {
    if (resolved?.persistent) {
      return;
    }

    try {
      await resolved?.context?.close();
    } catch {}

    try {
      await resolved?.browser?.close();
    } catch {}

    if (resolved?.sessionKey) {
      this.liveSessions.delete(resolved.sessionKey);
    }
  }

  async withPage(url, sessionId, handler) {
    const resolved = await this.resolveSession(sessionId);

    try {
      if (url) {
        await resolved.page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });
        await resolved.page.waitForTimeout(800);
      }

      const payload = await handler(resolved.page);
      const finalUrl = resolved.page.url();
      const finalTitle = await resolved.page.title();

      if (resolved.persistent && sessionId) {
        const live = this.liveSessions.get(sessionId);
        if (live) {
          live.currentUrl = finalUrl;
          live.title = finalTitle;
        }

        this.sessionManager?.updateState(sessionId, {
          browser: {
            currentUrl: finalUrl,
            title: finalTitle,
            lastActionAt: new Date().toISOString()
          }
        });
      }

      return {
        ...payload,
        currentUrl: finalUrl,
        title: finalTitle
      };
    } finally {
      await this.cleanupSession(resolved);
    }
  }

  async navigate({ url, sessionId = null }) {
    const result = await this.withPage(url, sessionId, async (page) => ({
      url: page.url(),
      title: await page.title(),
      text: truncate(await page.locator("body").innerText(), 2400)
    }));

    this.sessionManager?.appendAction(sessionId, {
      type: "browser_navigate",
      url: result.url,
      title: result.title,
      at: new Date().toISOString()
    });

    return result;
  }

  async extract({
    url = "",
    sessionId = null,
    selector = "body",
    maxChars = 4000
  }) {
    const result = await this.withPage(url, sessionId, async (page) => {
      const locator = page.locator(selector).first();
      const text = await locator.innerText().catch(async () => page.locator("body").innerText());
      const html = await locator.innerHTML().catch(async () => page.locator("body").innerHTML());

      return {
        url: page.url(),
        selector,
        text: truncate(text, maxChars),
        html: truncate(html, Math.min(maxChars * 2, 8000))
      };
    });

    this.sessionManager?.appendAction(sessionId, {
      type: "browser_extract",
      url: result.url,
      selector,
      at: new Date().toISOString()
    });

    return result;
  }

  async listLinks({ url = "", sessionId = null, limit = 20 }) {
    const result = await this.withPage(url, sessionId, async (page) => {
      const links = await page.locator("a[href]").evaluateAll((elements, maxItems) =>
        elements.slice(0, maxItems).map((element) => ({
          text: (element.textContent || "").trim(),
          href: element.href
        })), limit);
      const controls = await page
        .locator("button, [role='button'], input[type='submit'], input[type='button']")
        .evaluateAll((elements, maxItems) =>
          elements.slice(0, maxItems).map((element) => ({
            text:
              (element.textContent || "").trim() ||
              element.getAttribute("aria-label") ||
              element.getAttribute("value") ||
              "",
            tag: element.tagName.toLowerCase()
          })), limit)
        .catch(() => []);
      const filteredControls = controls
        .filter((item) => item.text && item.text.length <= 24)
        .filter((item) => !/\bmessages?\b/i.test(item.text))
        .filter(
          (item, index, all) =>
            all.findIndex(
              (candidate) =>
                candidate.text === item.text && candidate.tag === item.tag
            ) === index
        );

      return {
        url: page.url(),
        links: links.filter((item) => item.href),
        controls: filteredControls
      };
    });

    this.sessionManager?.appendAction(sessionId, {
      type: "browser_links",
      url: result.url,
      count: result.links.length,
      at: new Date().toISOString()
    });

    return result;
  }

  async click({ url = "", sessionId = null, selector, waitMs = 1200 }) {
    if (!selector) {
      throw new Error("Browser click requires a selector.");
    }

    const result = await this.withPage(url, sessionId, async (page) => {
      await page.locator(selector).first().click({
        timeout: 12000
      });
      await page.waitForTimeout(waitMs);
      return {
        url: page.url(),
        selector,
        text: truncate(await page.locator("body").innerText(), 2600)
      };
    });

    this.sessionManager?.appendAction(sessionId, {
      type: "browser_click",
      url: result.url,
      selector,
      at: new Date().toISOString()
    });

    return result;
  }

  async fill({
    url = "",
    sessionId = null,
    selector,
    value = "",
    submit = false,
    submitSelector = ""
  }) {
    if (!selector) {
      throw new Error("Browser fill requires a selector.");
    }

    const result = await this.withPage(url, sessionId, async (page) => {
      await page.locator(selector).first().fill(String(value || ""), {
        timeout: 12000
      });

      if (submitSelector) {
        await page.locator(submitSelector).first().click({
          timeout: 12000
        });
      } else if (submit) {
        await page.locator(selector).first().press("Enter");
      }

      await page.waitForTimeout(1200);
      return {
        url: page.url(),
        selector,
        value: truncate(String(value || ""), 180),
        text: truncate(await page.locator("body").innerText(), 2600)
      };
    });

    this.sessionManager?.appendAction(sessionId, {
      type: "browser_fill",
      url: result.url,
      selector,
      submit: Boolean(submit || submitSelector),
      at: new Date().toISOString()
    });

    return result;
  }

  async screenshot({
    url = "",
    title = "browser-preview",
    conversationId = null,
    userId = null,
    sessionId = null
  }) {
    const artifact = await this.withPage(url, sessionId, async (page) => {
      const buffer = await page.screenshot({
        fullPage: true,
        type: "png"
      });

      return persistGeneratedArtifact({
        artifactId: randomUUID(),
        title,
        format: "image",
        extension: "png",
        mimeType: "image/png",
        buffer,
        conversationId,
        userId
      });
    });

    this.sessionManager?.appendAction(sessionId, {
      type: "browser_screenshot",
      url: artifact.downloadUrl || url,
      artifactId: artifact.id,
      at: new Date().toISOString()
    });

    return artifact;
  }

  async closeSession(sessionId) {
    const live = this.liveSessions.get(sessionId);
    if (!live) {
      return false;
    }

    try {
      await live.context?.close();
    } catch {}

    try {
      await live.browser?.close();
    } catch {}

    this.liveSessions.delete(sessionId);
    return true;
  }
}

export default BrowserRuntimeAdapter;
