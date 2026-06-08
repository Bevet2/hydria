import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

function parseCliArgs(argv = []) {
  const options = {
    baseUrl: process.env.HYDRIA_VISUAL_BASE_URL || "http://localhost:3001",
    headless: process.env.HYDRIA_VISUAL_HEADLESS !== "0",
    list: false,
    scenarioPatterns: String(process.env.HYDRIA_VISUAL_SCENARIOS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    screenshotDir: process.env.HYDRIA_VISUAL_SCREENSHOT_DIR || ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[index + 1] || "";
      index += 1;
      return value;
    };
    if (arg === "--headed") {
      options.headless = false;
    } else if (arg === "--headless") {
      options.headless = true;
    } else if (arg === "--list") {
      options.list = true;
    } else if (arg === "--base-url") {
      options.baseUrl = readValue();
    } else if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--scenario" || arg === "--grep") {
      options.scenarioPatterns.push(...readValue().split(",").map((value) => value.trim()).filter(Boolean));
    } else if (arg.startsWith("--scenario=")) {
      options.scenarioPatterns.push(...arg.slice("--scenario=".length).split(",").map((value) => value.trim()).filter(Boolean));
    } else if (arg.startsWith("--grep=")) {
      options.scenarioPatterns.push(...arg.slice("--grep=".length).split(",").map((value) => value.trim()).filter(Boolean));
    } else if (arg === "--screenshot-dir") {
      options.screenshotDir = readValue();
    } else if (arg.startsWith("--screenshot-dir=")) {
      options.screenshotDir = arg.slice("--screenshot-dir=".length);
    }
  }

  options.scenarioPatterns = [...new Set(options.scenarioPatterns)];
  return options;
}

function matchesScenario({ name = "", tags = [] }, patterns = []) {
  if (!patterns.length) {
    return true;
  }
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.toLowerCase();
    return (
      name.toLowerCase().includes(normalizedPattern) ||
      tags.some((tag) => tag.toLowerCase().includes(normalizedPattern))
    );
  });
}

function sanitizeFileName(value = "") {
  return String(value).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "scenario";
}

async function maybeCaptureFailure(page, options, scenarioName) {
  if (!options.screenshotDir) {
    return "";
  }
  const targetDir = path.resolve(process.cwd(), options.screenshotDir);
  await fs.mkdir(targetDir, { recursive: true });
  const screenshotPath = path.join(targetDir, `${sanitizeFileName(scenarioName)}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function countLocator(locator) {
  try {
    return await locator.count();
  } catch {
    return 0;
  }
}

async function isVisible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function maybeOpenWorkspacePage(page, label) {
  const existingSheet = page.locator(".workspace-sheet-cell-input").first();
  if (label === "Sheets" && (await isVisible(existingSheet))) {
    return;
  }

  const workspaceButton = page.getByRole("button", { name: new RegExp(`^${label}\\b`, "i") }).first();
  if (await isVisible(workspaceButton)) {
    await workspaceButton.click({ timeout: 5000 });
    await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
}

async function waitForWorkspace(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

const scenarios = [
  {
    name: "shared-icons",
    tags: ["shared", "docs", "sheets"],
    run: async ({ page }) => {
      const sharedIconCheck = await page.evaluate(async () => {
        const module = await import("/components/workspaceSharedCommands.js");
        return ["bold", "italic", "underline", "strikethrough", "alignJustify", "table", "chart", "page", "list"].map((name) => {
          const node = module.createWorkspaceIconNode(name, { label: name });
          return { name, hasSvg: Boolean(node.querySelector("svg")) };
        });
      });
      assert.deepEqual(
        sharedIconCheck.filter((item) => !item.hasSvg),
        [],
        "Shared command icons should render as SVG nodes"
      );
      return { sharedIcons: sharedIconCheck.length };
    }
  },
  {
    name: "docs-shared-menu-definitions",
    tags: ["docs", "menus", "shared"],
    run: async ({ page }) => {
      const docsMenuDisplay = await page.evaluate(() => {
        const probe = document.createElement("button");
        probe.className = "workspace-docs-table-menu-item";
        document.body.appendChild(probe);
        const display = getComputedStyle(probe).display;
        probe.remove();
        return display;
      });
      assert.equal(docsMenuDisplay, "grid", "Docs context menu actions should use the shared icon layout");

      const docsSharedMenuCheck = await page.evaluate(async () => {
        const module = await import("/components/workspaceSharedCommands.js");
        const formatItems = module.createWorkspaceDocumentPageFormatMenuItems();
        const formatFields = module.createWorkspaceDocumentFormatFieldItems();
        const viewItems = module.createWorkspaceDocumentViewMenuItems({ isFullscreen: false });
        const button = module.createWorkspaceMenuActionButton(formatItems[0], {
          actionClassName: "workspace-docs-menu-action",
          iconClassName: "workspace-docs-menu-action-icon",
          labelClassName: "workspace-docs-menu-action-label",
          metaClassName: "workspace-docs-menu-action-meta",
          createIconNode: module.createWorkspaceIconNode,
          resolveIconName: module.getWorkspaceCommandIcon
        });
        document.body.appendChild(button);
        const result = {
          formatCount: formatItems.length,
          formatFieldIds: formatFields.map((item) => item.fieldId),
          viewCount: viewItems.length,
          hasIcon: Boolean(button.querySelector(".workspace-docs-menu-action-icon svg")),
          label: button.querySelector(".workspace-docs-menu-action-label")?.textContent || ""
        };
        button.remove();
        return result;
      });

      assert.ok(docsSharedMenuCheck.formatCount >= 3, "Docs page format menu should come from shared definitions");
      assert.deepEqual(
        docsSharedMenuCheck.formatFieldIds,
        ["fontFamily", "fontSize", "alignment", "textColor", "highlightColor"],
        "Docs format fields should come from shared definitions"
      );
      assert.ok(docsSharedMenuCheck.viewCount >= 3, "Docs view menu should come from shared definitions");
      assert.equal(docsSharedMenuCheck.hasIcon, true, "Docs shared menu action should render a shared icon");
      assert.match(docsSharedMenuCheck.label, /En-tetes|Headers/i, "Docs shared menu action should preserve its label");
      return { docsMenuDisplay, docsSharedMenuCheck };
    }
  },
  {
    name: "shared-command-adapters",
    tags: ["adapters", "docs", "sheets", "shared"],
    run: async ({ page }) => {
      const adapterCheck = await page.evaluate(async () => {
        const module = await import("/components/workspaceSharedCommands.js");
        const docsCalls = [];
        const sheetsCalls = [];
        const docsExecutor = module.createWorkspaceCommandExecutor(
          "docs",
          module.createDocsWorkspaceCommandAdapter({
            runInlineCommand: (...args) => docsCalls.push(["runInlineCommand", ...args]),
            runInlineCommandFromContextMenu: (...args) => docsCalls.push(["runInlineCommandFromContextMenu", ...args.slice(0, 1)]),
            runInlineCommandWithSelection: (...args) => docsCalls.push(["runInlineCommandWithSelection", ...args.slice(0, 2)]),
            toggleActiveBlockStyle: (...args) => docsCalls.push(["toggleActiveBlockStyle", ...args]),
            toggleActiveBlockUnderline: () => docsCalls.push(["toggleActiveBlockUnderline"]),
            toggleActiveBlockStrikethrough: () => docsCalls.push(["toggleActiveBlockStrikethrough"]),
            applyBlockFontSize: (...args) => docsCalls.push(["applyBlockFontSize", ...args]),
            applyBlockFontFamily: (...args) => docsCalls.push(["applyBlockFontFamily", ...args]),
            applyBlockTextColor: (...args) => docsCalls.push(["applyBlockTextColor", ...args]),
            applyBlockHighlightColor: (...args) => docsCalls.push(["applyBlockHighlightColor", ...args]),
            applyBlockAlignment: (...args) => docsCalls.push(["applyBlockAlignment", ...args]),
            resetActiveBlockFormatting: () => docsCalls.push(["resetActiveBlockFormatting"])
          })
        );
        const sheetsExecutor = module.createWorkspaceCommandExecutor(
          "sheets",
          module.createSheetWorkspaceCommandAdapter({
            toggleSelectedTextStyle: (...args) => sheetsCalls.push(["toggleSelectedTextStyle", ...args]),
            adjustSelectedFontSize: (...args) => sheetsCalls.push(["adjustSelectedFontSize", ...args]),
            setSelectedFontSize: (...args) => sheetsCalls.push(["setSelectedFontSize", ...args]),
            setSelectedFontFamily: (...args) => sheetsCalls.push(["setSelectedFontFamily", ...args]),
            setSelectedTextColor: (...args) => sheetsCalls.push(["setSelectedTextColor", ...args]),
            setSelectedFillColor: (...args) => sheetsCalls.push(["setSelectedFillColor", ...args]),
            setSelectedHorizontalAlign: (...args) => sheetsCalls.push(["setSelectedHorizontalAlign", ...args]),
            setSelectedVerticalAlign: (...args) => sheetsCalls.push(["setSelectedVerticalAlign", ...args]),
            clearSelectedFormatting: (...args) => sheetsCalls.push(["clearSelectedFormatting", ...args])
          })
        );

        docsExecutor("bold");
        docsExecutor("textColor", { value: "#111111" });
        docsExecutor("alignJustify");
        sheetsExecutor("bold");
        sheetsExecutor("fontSize", { delta: 1 });
        sheetsExecutor("fontSize", { value: "14" });
        sheetsExecutor("fillColor", { value: "#fff2cc" });
        sheetsExecutor("alignBottom");

        return { docsCalls, sheetsCalls };
      });

      assert.deepEqual(
        adapterCheck.docsCalls.map((call) => call[0]),
        ["runInlineCommand", "runInlineCommandWithSelection", "applyBlockAlignment"],
        "Docs adapter should route shared commands to Docs operations"
      );
      assert.deepEqual(
        adapterCheck.sheetsCalls,
        [
          ["toggleSelectedTextStyle", "bold"],
          ["adjustSelectedFontSize", 1],
          ["setSelectedFontSize", 14],
          ["setSelectedFillColor", "#fff2cc"],
          ["setSelectedVerticalAlign", "bottom"]
        ],
        "Sheets adapter should route shared commands to Sheets operations"
      );
      return {
        docsCalls: adapterCheck.docsCalls.length,
        sheetsCalls: adapterCheck.sheetsCalls.length
      };
    }
  },
  {
    name: "shared-context-menu-helper",
    tags: ["menus", "docs", "sheets", "shared"],
    run: async ({ page }) => {
      const sharedContextMenuCheck = await page.evaluate(async () => {
        const module = await import("/components/workspaceSharedCommands.js");
        const root = document.createElement("div");
        root.className = "workspace-sheet-context-menu";
        root.hidden = true;
        root.setAttribute("role", "menu");
        const api = module.createWorkspaceContextMenu({
          root,
          controllerOptions: {
            submenuClassName: "workspace-sheet-context-submenu",
            itemOpenClassName: "is-open",
            removeRootOnClose: true
          },
          renderOptions: {
            itemClassName: "workspace-sheet-context-item",
            submenuClassName: "workspace-sheet-context-submenu",
            actionOptions: {
              actionClassName: "workspace-sheet-context-action",
              labelClassName: "workspace-sheet-context-label",
              metaClassName: "workspace-sheet-context-meta",
              chevronClassName: "workspace-sheet-context-chevron",
              createIconNode: module.createWorkspaceIconNode,
              resolveIconName: module.getWorkspaceCommandIcon
            }
          }
        });
        api.open([{ label: "Parent", icon: "table", items: [{ label: "Child", icon: "insert" }] }], {
          clientX: 24,
          clientY: 24,
          appendTo: document.body
        });
        const result = {
          isOpen: !root.hidden && root.isConnected,
          hasSubmenu: Boolean(root.querySelector(".workspace-sheet-context-submenu")),
          position: getComputedStyle(root).position
        };
        api.close();
        return result;
      });

      assert.equal(sharedContextMenuCheck.isOpen, true, "Shared context menu helper should open the root menu");
      assert.equal(sharedContextMenuCheck.hasSubmenu, true, "Shared context menu helper should render submenus");
      assert.equal(sharedContextMenuCheck.position, "fixed", "Shared context menus should use fixed positioning");
      return sharedContextMenuCheck;
    }
  },
  {
    name: "docs-context-menu-helper",
    tags: ["docs", "menus"],
    run: async ({ page }) => {
      const docsContextMenuCheck = await page.evaluate(async () => {
        const module = await import("/components/workspaceSharedCommands.js");
        const root = document.createElement("div");
        root.className = "workspace-docs-table-menu";
        root.hidden = true;
        root.setAttribute("role", "menu");
        const api = module.createWorkspaceContextMenu({
          root,
          controllerOptions: {
            submenuClassName: "workspace-docs-table-submenu",
            itemOpenClassName: "is-open",
            removeRootOnClose: true
          },
          renderOptions: {
            itemClassName: "workspace-docs-table-menu-row",
            submenuClassName: "workspace-docs-table-submenu",
            actionOptions: {
              actionClassName: "workspace-docs-table-menu-item",
              iconClassName: "workspace-docs-table-menu-icon",
              labelClassName: "workspace-docs-table-menu-text",
              metaClassName: "workspace-docs-table-menu-meta",
              chevronClassName: "workspace-docs-table-menu-chevron",
              createIconNode: module.createWorkspaceIconNode,
              resolveIconName: module.getWorkspaceCommandIcon
            }
          }
        });
        api.open([{ label: "Structure", icon: "text", items: [{ label: "Heading", icon: "text" }] }], {
          clientX: 32,
          clientY: 32,
          appendTo: document.body
        });
        const result = {
          isOpen: !root.hidden && root.isConnected,
          hasIcon: Boolean(root.querySelector(".workspace-docs-table-menu-icon svg")),
          hasSubmenu: Boolean(root.querySelector(".workspace-docs-table-submenu")),
          position: getComputedStyle(root).position
        };
        api.close();
        return result;
      });

      assert.equal(docsContextMenuCheck.isOpen, true, "Docs context menu should open through the shared helper");
      assert.equal(docsContextMenuCheck.hasIcon, true, "Docs context menu should render shared icons");
      assert.equal(docsContextMenuCheck.hasSubmenu, true, "Docs context menu should render nested submenus");
      assert.equal(docsContextMenuCheck.position, "fixed", "Docs context menu should use fixed positioning");
      return docsContextMenuCheck;
    }
  },
  {
    name: "sheets-toolbar-context-menu-fullscreen",
    tags: ["sheets", "menus", "fullscreen"],
    run: async ({ page }) => {
      await maybeOpenWorkspacePage(page, "Sheets");
      await page.locator(".workspace-sheet-cell-input").first().waitFor({ state: "visible", timeout: 10000 });

      const sheetToolbarSvgCount = await countLocator(page.locator(".workspace-sheet-toolbar-icon svg"));
      assert.ok(sheetToolbarSvgCount > 0, "Sheets toolbar should render shared SVG icons");

      const firstCell = page.locator(".workspace-sheet-cell-input").first();
      assert.equal(await isVisible(firstCell), true, "A Sheets cell should be visible for context menu testing");
      await firstCell.click({ timeout: 5000 });
      const secondCell = page.locator(".workspace-sheet-cell-input").nth(1);
      await page.keyboard.down("Shift");
      await secondCell.click({ timeout: 5000 });
      await page.keyboard.up("Shift");
      await secondCell.click({ button: "right", timeout: 5000 });

      const sheetContextMenu = page.locator(".workspace-sheet-context-menu").first();
      await sheetContextMenu.waitFor({ state: "visible", timeout: 5000 });
      const selectedCellCount = await page.locator(".workspace-sheet-cell-input.is-selected, .workspace-sheet-cell-input.is-range-selected").count();
      assert.ok(selectedCellCount >= 2, "Right-clicking inside a selected Sheets range should preserve the range selection");
      const menuText = await sheetContextMenu.textContent();
      assert.match(menuText || "", /Copier|Copy|Couper|Cut|Coller|Paste/i, "Sheets context menu should expose clipboard actions");
      await page.mouse.click(4, 4);
      await page.waitForFunction(
        () =>
          !Array.from(document.querySelectorAll(".workspace-sheet-context-menu")).some(
            (menu) => menu.isConnected && !menu.hidden && getComputedStyle(menu).display !== "none"
          ),
        undefined,
        { timeout: 5000 }
      );

      const sheetFullscreenButton = page.getByRole("button", { name: /full screen/i }).first();
      assert.equal(await isVisible(sheetFullscreenButton), true, "Sheets full screen button should be visible");
      await sheetFullscreenButton.click();
      const overlay = page.locator(".workspace-sheet-modal-overlay").first();
      await overlay.waitFor({ state: "visible", timeout: 5000 });
      const overlayBox = await overlay.boundingBox();
      assert.ok(
        overlayBox && overlayBox.width >= 900 && overlayBox.height >= 500,
        "Sheets full screen overlay should occupy a large viewport area"
      );
      await page.getByRole("button", { name: /exit full screen/i }).first().click();
      await overlay.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});

      return {
        sheetToolbarSvgCount,
        contextMenu: "opened-and-closed",
        selectedCellCount,
        fullscreenOverlay: {
          width: Math.round(overlayBox?.width || 0),
          height: Math.round(overlayBox?.height || 0)
        }
      };
    }
  },
  {
    name: "crm-workspace-page",
    tags: ["crm", "workspace"],
    run: async ({ page, options }) => {
      const baseUrl = String(options.baseUrl || "").replace(/\/+$/, "");
      await page.goto(`${baseUrl}/workspace/crm`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);

      const crmPageCheck = await page.evaluate(() => {
        const text = document.body.innerText || "";
        return {
          url: window.location.href,
          hasCrmHeading: /CRM WORKSPACE|CRM/i.test(text),
          hasCreateAction: /Create a CRM workspace|Create CRM workspace|Créer/i.test(text),
          hasSalesLanguage: /contacts|companies|deals|sales|pipeline|follow-up|CRM/i.test(text)
        };
      });

      assert.equal(crmPageCheck.hasCrmHeading, true, "CRM workspace page should render on direct navigation");
      assert.equal(crmPageCheck.hasCreateAction, true, "CRM workspace page should expose a create action");
      assert.equal(crmPageCheck.hasSalesLanguage, true, "CRM workspace page should describe CRM sales work");

      return crmPageCheck;
    }
  }
];

async function runScenario(scenario, context) {
  const startedAt = Date.now();
  try {
    const details = await scenario.run(context);
    return {
      name: scenario.name,
      ok: true,
      durationMs: Date.now() - startedAt,
      details: details || {}
    };
  } catch (error) {
    const screenshotPath = await maybeCaptureFailure(context.page, context.options, scenario.name).catch(() => "");
    return {
      name: scenario.name,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error?.message || String(error),
      screenshotPath
    };
  }
}

const options = parseCliArgs(process.argv.slice(2));
const selectedScenarios = scenarios.filter((scenario) => matchesScenario(scenario, options.scenarioPatterns));

if (options.list) {
  console.log(
    JSON.stringify(
      {
        scenarios: scenarios.map(({ name, tags }) => ({ name, tags }))
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (!selectedScenarios.length) {
  console.error(`No visual workspace scenarios matched: ${options.scenarioPatterns.join(", ")}`);
  process.exit(1);
}

const browser = await chromium.launch({ headless: options.headless });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const browserErrors = [];
const results = [];

page.on("pageerror", (error) => {
  browserErrors.push(error.message);
});

page.on("console", (message) => {
  if (message.type() === "error") {
    browserErrors.push(message.text());
  }
});

try {
  await waitForWorkspace(page, options.baseUrl);

  for (const scenario of selectedScenarios) {
    results.push(await runScenario(scenario, { page, options }));
  }

  if (browserErrors.length) {
    results.push({
      name: "browser-console-clean",
      ok: false,
      durationMs: 0,
      error: browserErrors.join("\n")
    });
  }
} finally {
  await browser.close();
}

const failedScenarios = results.filter((result) => !result.ok);
console.log(
  JSON.stringify(
    {
      ok: failedScenarios.length === 0,
      baseUrl: options.baseUrl,
      headless: options.headless,
      selectedScenarios: selectedScenarios.map((scenario) => scenario.name),
      results
    },
    null,
    2
  )
);

if (failedScenarios.length) {
  process.exitCode = 1;
}
