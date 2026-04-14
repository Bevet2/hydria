import { randomUUID } from "node:crypto";
import config from "../../config/hydria.config.js";
import { persistGeneratedArtifact } from "../artifacts/generationStorageService.js";
import { readWebUrl } from "../web/webReaderService.js";

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

async function captureScreenshot(url) {
  if (!config.tools.enableBrowserPreview) {
    return null;
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      channel: "chrome",
      headless: true
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 }
    });
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: Math.min(config.tools.timeoutMs, 30000)
    });
    await page.waitForTimeout(1200);
    const buffer = await page.screenshot({
      fullPage: true,
      type: "png"
    });
    await browser.close();

    return persistGeneratedArtifact({
      artifactId: randomUUID(),
      title: `preview-${url.replace(/^https?:\/\//, "")}`,
      format: "image",
      extension: "png",
      mimeType: "image/png",
      buffer,
      conversationId: null,
      userId: null
    });
  } catch {
    return null;
  }
}

export async function inspectPreview(prompt = "") {
  const url = inferPreviewUrl(prompt);

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

  const page = await readWebUrl(url);
  const screenshotArtifact = await captureScreenshot(url);
  const artifacts = screenshotArtifact ? [screenshotArtifact] : [];

  return {
    providerId: "preview_inspector",
    sourceType: "tool",
    sourceName: "Preview Inspector",
    capability: "inspect_preview",
    raw: {
      url,
      page
    },
    normalized: {
      url,
      title: page.title,
      excerpt: page.excerpt
    },
    summaryText: `${page.title || url} -> ${url} | ${page.excerpt || ""}`,
    artifacts
  };
}
