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
  const existingDocument = page.locator(".workspace-document-page-sheet").first();
  const existingSlides = page.locator(".workspace-presentation-preview-viewport").first();
  if (label === "Sheets" && (await isVisible(existingSheet))) {
    return;
  }
  if (label === "Docs" && (await isVisible(existingDocument))) {
    return;
  }
  if (label === "Slides" && (await isVisible(existingSlides))) {
    return;
  }

  const workspaceButton = page.getByRole("button", { name: new RegExp(`^${label}\\b`, "i") }).first();
  if (await isVisible(workspaceButton)) {
    await workspaceButton.click({ timeout: 5000 });
    await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  if (label === "Sheets" && !(await isVisible(existingSheet))) {
    const createSheet = page.locator('.workspace-launcher-card[data-workspace="sheets"]').first();
    if (await isVisible(createSheet)) {
      await createSheet.click({ timeout: 5000 });
      await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
  if (label === "Docs" && !(await isVisible(existingDocument))) {
    const createDocument = page.locator('.workspace-launcher-card[data-workspace="docs"]').first();
    if (await isVisible(createDocument)) {
      await createDocument.click({ timeout: 5000 });
      await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
  if (label === "Slides" && !(await isVisible(existingSlides))) {
    const createSlides = page.locator('.workspace-launcher-card[data-workspace="slides"]').first();
    if (await isVisible(createSlides)) {
      await createSlides.click({ timeout: 5000 });
      await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
}

async function waitForWorkspace(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

const scenarios = [
  {
    name: "chat-rich-message-renderer",
    tags: ["chat", "markdown", "actions"],
    run: async ({ page }) => {
      const result = await page.evaluate(async () => {
        const module = await import("/components/chatMessage.js");
        const node = module.renderChatMessage(
          {
            role: "assistant",
            content: [
              "## Result",
              "",
              "| Item | Value |",
              "| --- | --- |",
              "| Total | 42 |",
              "",
              "```js",
              "console.log('ok');",
              "```"
            ].join("\n")
          },
          {
            showActions: true,
            onRegenerateMessage: () => {}
          }
        );
        document.body.appendChild(node);
        const output = {
          heading: node.querySelector("h2")?.textContent || "",
          tableRows: node.querySelectorAll("table tr").length,
          hasCode: Boolean(node.querySelector("pre code")),
          actionLabels: [...node.querySelectorAll(".message-actions button")].map(
            (button) => button.textContent
          )
        };
        node.remove();
        return output;
      });
      assert.equal(result.heading, "Result");
      assert.equal(result.tableRows, 2);
      assert.equal(result.hasCode, true);
      assert.deepEqual(result.actionLabels, ["Copier", "Regenerer"]);
      return result;
    }
  },
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
    name: "docs-word-review-layout",
    tags: ["docs", "word", "review", "layout"],
    run: async ({ page, options }) => {
      await waitForWorkspace(page, options.baseUrl);
      await maybeOpenWorkspacePage(page, "Docs");
      const documentPage = page.locator(".workspace-document-page-sheet").first();
      await documentPage.waitFor({ state: "visible", timeout: 10000 });

      const menuBar = page.locator(".workspace-docs-menubar").first();
      assert.equal(await isVisible(menuBar), true, "Docs should expose a Word-style ribbon");
      assert.equal(
        await isVisible(page.locator(".workspace-docs-statusbar").first()),
        true,
        "Docs should expose pages, word count and zoom in a status bar"
      );

      const removedStaleValidationComments = await page.evaluate(() => {
        const staleNodes = Array.from(
          document.querySelectorAll('.workspace-docs-comment-anchor[data-docs-comment-text^="Commentaire de validation"]')
        );
        staleNodes.forEach((node) => node.replaceWith(...node.childNodes));
        const shell = document.querySelector(".workspace-document-preview-body-docs");
        shell?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "" }));
        return staleNodes.length;
      });
      if (removedStaleValidationComments) {
        await page.waitForTimeout(1200);
      }
      const initialDocumentSnapshot = await page.evaluate(() => {
        const shell = document.querySelector(".workspace-document-preview-body-docs");
        if (!shell) return "";
        const clone = shell.cloneNode(true);
        clone.querySelectorAll(
          ".workspace-docs-page-control-bar, .workspace-docs-page-header, .workspace-docs-page-footer, .workspace-docs-vertical-ruler, .workspace-docs-image-resize-handle"
        ).forEach((node) => node.remove());
        clone.querySelectorAll(".workspace-document-page-sheet").forEach((pageNode) => {
          pageNode.replaceWith(...Array.from(pageNode.childNodes));
        });
        clone.querySelectorAll("[contenteditable], [spellcheck], [data-placeholder]").forEach((node) => {
          node.removeAttribute("contenteditable");
          node.removeAttribute("spellcheck");
          node.removeAttribute("data-placeholder");
        });
        clone.querySelectorAll(".workspace-inline-editable").forEach((node) => {
          node.classList.remove("workspace-inline-editable");
        });
        return String(clone.innerHTML || "").trim();
      });
      const initialHeaderState = await page.evaluate(
        () => document.querySelector(".workspace-docs-page-meta")?.dataset.showHeaderFooter || "false"
      );
      const headerInitiallyVisible = initialHeaderState === "true";
      if (!headerInitiallyVisible) {
        await menuBar.getByRole("button", { name: "Mise en page", exact: true }).click();
        await page.getByRole("button", { name: /En-tetes et pieds de page/i }).click();
        await page.waitForFunction(
          () => document.querySelector(".workspace-docs-page-meta")?.dataset.showHeaderFooter === "true",
          undefined,
          { timeout: 5000 }
        );
      }
      await page.locator(".workspace-docs-page-header-text").first().waitFor({ state: "visible", timeout: 5000 });

      const typingMarker = `Hydria typing validation ${Date.now()}`;
      const typingTarget = page.locator(
        ".workspace-document-page-sheet h1, .workspace-document-page-sheet p, .workspace-document-page-sheet blockquote"
      ).first();
      await typingTarget.click({ force: true });
      await page.keyboard.type(typingMarker);
      assert.equal(
        await page.locator(".workspace-document-preview-body-docs").innerText().then((text) => text.includes(typingMarker)),
        true,
        "Docs should accept real keyboard input"
      );
      await page.waitForTimeout(900);
      await page.keyboard.type(" continued");
      assert.equal(
        await page.locator(".workspace-document-preview-body-docs").innerText().then(
          (text) => text.includes(`${typingMarker} continued`)
        ),
        true,
        "Docs should keep the caret after autosave"
      );

      await page.evaluate(() => {
        const paragraph =
          document.querySelector(".workspace-document-page-sheet p") ||
          document.querySelector(".workspace-document-page-sheet h1");
        if (!paragraph) throw new Error("No editable Docs paragraph found");
        // Always normalise to a flat text node so Range.setStart works regardless
        // of whether the editor wraps content in <span> or other inline elements.
        const existingText = String(paragraph.textContent || "").trim() || "Texte de revision Hydria";
        paragraph.textContent = existingText;
        paragraph.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: existingText }));
        const textNode = Array.from(paragraph.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
        if (!textNode) throw new Error("No text node available for comment selection");
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, Math.min(5, textNode.nodeValue?.length || 0));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        paragraph.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });

      await menuBar.getByRole("button", { name: "Révision", exact: true }).click();
      const validationComment = `Commentaire de validation ${Date.now()}`;
      page.once("dialog", (dialog) => dialog.accept(validationComment));
      await page.getByRole("button", { name: "Nouveau commentaire", exact: true }).click();
      await page.locator(".workspace-docs-review-pane").waitFor({ state: "visible", timeout: 5000 });
      const commentAnchor = page.locator(`.workspace-docs-comment-anchor[data-docs-comment-text="${validationComment}"]`);
      assert.equal(await commentAnchor.count(), 1, "A Docs comment should remain anchored to selected text");
      assert.match(
        (await page.locator(".workspace-docs-review-pane").innerText()) || "",
        new RegExp(validationComment),
        "The review pane should display the persisted comment"
      );

      const zoomValue = await page.locator(".workspace-docs-zoom-controls select").inputValue();
      const validationCard = page.locator(".workspace-docs-review-card", { hasText: validationComment });
      await validationCard.getByRole("button", { name: "Supprimer", exact: true }).click();
      await commentAnchor.waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
      await page.evaluate((snapshot) => {
        const shell = document.querySelector(".workspace-document-preview-body-docs");
        if (!shell) throw new Error("Docs shell unavailable during validation cleanup");
        shell.innerHTML = snapshot || "<p><br></p>";
        shell.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          inputType: "insertReplacementText",
          data: null
        }));
      }, initialDocumentSnapshot);
      await page.waitForTimeout(2500);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForWorkspace(page, options.baseUrl);
      await maybeOpenWorkspacePage(page, "Docs");
      await page.locator(".workspace-document-page-sheet").first().waitFor({ state: "visible", timeout: 10000 });
      const persistedState = await page.evaluate((marker) => {
        const shell = document.querySelector(".workspace-document-preview-body-docs");
        return {
          header: document.querySelector(".workspace-docs-page-meta")?.dataset.showHeaderFooter || "false",
          hasTypingMarker: String(shell?.innerText || "").includes(marker),
          validationComments: shell?.querySelectorAll(
            '.workspace-docs-comment-anchor[data-docs-comment-text^="Commentaire de validation"]'
          ).length || 0
        };
      }, typingMarker);
      assert.equal(
        persistedState.header,
        initialHeaderState,
        "The Docs visual gate should restore and persist the initial header/footer state"
      );
      assert.equal(persistedState.hasTypingMarker, false, "The Docs visual gate should remove typed validation text");
      assert.equal(persistedState.validationComments, 0, "The Docs visual gate should remove validation comments");
      return {
        headerEditable: true,
        keyboardInput: true,
        comments: 1,
        reviewPane: true,
        zoom: zoomValue
      };
    }
  },
  {
    name: "docs-context-format-page-break",
    tags: ["docs", "context-menu", "formatting", "pagination"],
    run: async ({ page, options }) => {
      await waitForWorkspace(page, options.baseUrl);
      await maybeOpenWorkspacePage(page, "Docs");
      await page.locator(".workspace-document-page-sheet").first().waitFor({ state: "visible", timeout: 10000 });

      const captureSnapshot = () =>
        page.evaluate(() => {
          const shell = document.querySelector(".workspace-document-preview-body-docs");
          if (!shell) return "";
          const clone = shell.cloneNode(true);
          clone.querySelectorAll(
            ".workspace-docs-page-control-bar, .workspace-docs-page-header, .workspace-docs-page-footer, .workspace-docs-vertical-ruler, .workspace-docs-image-resize-handle"
          ).forEach((node) => node.remove());
          clone.querySelectorAll(".workspace-document-page-sheet").forEach((pageNode) => {
            pageNode.replaceWith(...Array.from(pageNode.childNodes));
          });
          clone.querySelectorAll("[contenteditable], [spellcheck], [data-placeholder]").forEach((node) => {
            node.removeAttribute("contenteditable");
            node.removeAttribute("spellcheck");
            node.removeAttribute("data-placeholder");
          });
          clone.querySelectorAll(".workspace-inline-editable").forEach((node) => {
            node.classList.remove("workspace-inline-editable");
          });
          return String(clone.innerHTML || "").trim();
        });
      const restoreSnapshot = async (snapshot) => {
        await page.evaluate((html) => {
          const shell = document.querySelector(".workspace-document-preview-body-docs");
          if (!shell) throw new Error("Docs shell unavailable during pagination cleanup");
          shell.innerHTML = html || "<p><br></p>";
          shell.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "insertReplacementText",
            data: null
          }));
        }, snapshot);
        await page.waitForTimeout(2500);
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForWorkspace(page, options.baseUrl);
        await maybeOpenWorkspacePage(page, "Docs");
        await page.locator(".workspace-document-page-sheet").first().waitFor({ state: "visible", timeout: 10000 });
      };

      const originalSnapshot = await captureSnapshot();
      let formattingResult = null;
      let paginationResult = null;
      try {
        await page.evaluate(() => {
          const target = document.querySelector(
            ".workspace-document-page-sheet h1, .workspace-document-page-sheet p"
          );
          if (!target) throw new Error("No Docs text block available");
          let textNode = Array.from(target.childNodes).find(
            (node) => node.nodeType === Node.TEXT_NODE && String(node.nodeValue || "").length >= 4
          );
          if (!textNode) {
            target.textContent = "Hydria document validation";
            textNode = target.firstChild;
          }
          const range = document.createRange();
          range.setStart(textNode, 0);
          range.setEnd(textNode, 4);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
          target.dispatchEvent(new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 900,
            clientY: 500,
            button: 2
          }));
        });

        const contextMenu = page.locator(".workspace-docs-table-menu");
        await contextMenu.waitFor({ state: "visible", timeout: 5000 });
        assert.equal(
          await isVisible(contextMenu.locator(".workspace-docs-context-quickbar")),
          true,
          "The Docs context menu should expose direct Word-style formatting controls"
        );
        const sizeButton = contextMenu.locator("button").filter({ hasText: "Taille" }).first();
        await sizeButton.click({ timeout: 5000 });
        const sizeSubmenu = sizeButton.locator("xpath=..").locator(".workspace-docs-table-submenu");
        assert.equal(
          await isVisible(sizeSubmenu),
          true,
          "Clicking the font-size submenu should keep it open"
        );
        await sizeSubmenu.locator("button").filter({ hasText: /^24$/ }).click({ timeout: 5000 });
        await page.waitForTimeout(500);
        formattingResult = await page.evaluate(() => {
          const target = document.querySelector(
            ".workspace-document-page-sheet h1, .workspace-document-page-sheet p"
          );
          return {
            selectedTextSize:
              Array.from(target?.querySelectorAll("span") || []).find(
                (span) => String(span.textContent || "").length === 4
              )?.style.fontSize || ""
          };
        });
        assert.equal(
          formattingResult.selectedTextSize,
          "24px",
          "Font size should apply to the selected text from the context menu"
        );

        await restoreSnapshot(originalSnapshot);
        const pagesBefore = await page.locator(".workspace-document-page-sheet").count();
        const wordsBefore = (await page.locator(".workspace-docs-status-metrics").innerText()).match(/\d+\s+mots/)?.[0] || "";
        await page.evaluate(() => {
          const target = document.querySelector(
            ".workspace-document-page-sheet h1, .workspace-document-page-sheet p"
          );
          if (!target) throw new Error("No Docs text block available for page break");
          const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
          let textNode = walker.nextNode();
          while (textNode && !String(textNode.nodeValue || "").trim()) {
            textNode = walker.nextNode();
          }
          if (!textNode || String(textNode.nodeValue || "").length < 2) {
            target.textContent = "Hydria pagination validation";
            textNode = target.firstChild;
          }
          const range = document.createRange();
          range.setStart(textNode, Math.max(1, Math.floor(textNode.nodeValue.length / 2)));
          range.collapse(true);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        });
        const menuBar = page.locator(".workspace-docs-menubar").first();
        await menuBar.getByRole("button", { name: "Insertion", exact: true }).click();
        await page.getByRole("button", { name: "Saut de page", exact: true }).click();
        await page.waitForTimeout(900);
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForWorkspace(page, options.baseUrl);
        await maybeOpenWorkspacePage(page, "Docs");
        await page.locator(".workspace-document-page-sheet").first().waitFor({ state: "visible", timeout: 10000 });

        paginationResult = await page.evaluate((expectedPages) => {
          const shell = document.querySelector(".workspace-document-preview-body-docs");
          const pages = Array.from(shell?.querySelectorAll(":scope > .workspace-document-page-sheet") || []);
          return {
            pages: pages.length,
            expectedPages,
            breaks: shell?.querySelectorAll(":scope > .workspace-docs-page-break").length || 0,
            placeholders: /New page|Start writing on the next page/i.test(String(shell?.textContent || "")),
            strayBlocks:
              Array.from(shell?.children || []).filter(
                (node) =>
                  !node.matches(
                    ".workspace-document-page-sheet, .workspace-docs-page-break, .workspace-docs-page-meta"
                  )
              ).length
          };
        }, pagesBefore + 1);
        assert.equal(paginationResult.pages, paginationResult.expectedPages, "A page break should add one page");
        assert.equal(paginationResult.breaks, 1, "A page break should persist exactly once");
        assert.equal(paginationResult.placeholders, false, "A page break should not inject placeholder text");
        assert.equal(paginationResult.strayBlocks, 0, "All editable content should remain inside page sheets");
        assert.equal(
          (await page.locator(".workspace-docs-status-metrics").innerText()).includes(wordsBefore),
          true,
          "A page break should not change the document word count"
        );

        await page.evaluate(() => {
          const pageBreak = document.querySelector(".workspace-docs-page-break");
          if (!pageBreak) throw new Error("Persisted page break unavailable for context-menu removal");
          const rect = pageBreak.getBoundingClientRect();
          pageBreak.dispatchEvent(new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + 4,
            clientY: rect.top + 4,
            button: 2
          }));
        });
        const pageBreakMenu = page.locator(".workspace-docs-table-menu");
        await pageBreakMenu.waitFor({ state: "visible", timeout: 5000 });
        await pageBreakMenu
          .locator("button")
          .filter({ hasText: "Supprimer le saut de page" })
          .click({ timeout: 5000 });
        await page.waitForTimeout(500);
        assert.equal(
          await page.locator(".workspace-docs-page-break").count(),
          0,
          "The context menu should remove a page break"
        );
        assert.equal(
          await page.locator(".workspace-document-page-sheet").count(),
          pagesBefore,
          "Removing a page break should restore the previous page count"
        );
      } finally {
        await restoreSnapshot(originalSnapshot);
      }

      return {
        quickFormatting: formattingResult?.selectedTextSize || "",
        persistedPages: paginationResult?.pages || 0,
        persistedBreaks: paginationResult?.breaks || 0,
        contextRemoval: true
      };
    }
  },
  {
    name: "sheets-toolbar-context-menu-fullscreen",
    tags: ["sheets", "menus", "fullscreen"],
    run: async ({ page, options }) => {
      await waitForWorkspace(page, options.baseUrl);
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
      await page.locator("#workspace-title").click({ timeout: 5000 });
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
    name: "slides-presentation-smoke",
    tags: ["slides", "presentation", "workspace"],
    run: async ({ page, options }) => {
      await waitForWorkspace(page, options.baseUrl);
      await maybeOpenWorkspacePage(page, "Slides");
      const viewport = page.locator(".workspace-presentation-preview-viewport").first();
      await viewport.waitFor({ state: "visible", timeout: 12000 });

      const slideCards = page.locator(".workspace-presentation-preview-card");
      const slideCount = await slideCards.count();
      assert.ok(slideCount >= 1, "Presentation should render at least one slide thumbnail");

      // Verify the slide position counter is visible (e.g. "Slide 1 of N")
      const positionText = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll(".workspace-presentation-preview-viewport *"))
          .find((node) => /slide\s+\d+\s+of\s+\d+/i.test(node.textContent || ""));
        return el ? el.textContent.trim() : null;
      });
      assert.ok(positionText, "Slide position counter (Slide X of N) should be visible");
      assert.match(positionText, /slide\s+1\s+of\s+\d+/i, "First slide should be active by default");

      // Verify Slides / Notes tabs exist
      const tabsText = await page.evaluate(() => {
        const strip = document.querySelector(".workspace-code-tabs");
        return strip ? strip.textContent.trim() : null;
      });
      assert.ok(
        tabsText && /slides/i.test(tabsText) && /notes/i.test(tabsText),
        "Slides presentation toolbar should show Slides and Notes tabs"
      );

      // Navigate to the second slide if one exists
      let navigatedToSlide2 = false;
      if (slideCount >= 2) {
        await slideCards.nth(1).click({ timeout: 5000 });
        await page.waitForTimeout(600);
        const updatedPosition = await page.evaluate(() => {
          const el = Array.from(document.querySelectorAll(".workspace-presentation-preview-viewport *"))
            .find((node) => /slide\s+\d+\s+of\s+\d+/i.test(node.textContent || ""));
          return el ? el.textContent.trim() : null;
        });
        assert.match(
          updatedPosition || "",
          /slide\s+2\s+of\s+\d+/i,
          "Clicking slide thumbnail 2 should navigate to slide 2"
        );
        navigatedToSlide2 = true;
      }

      return {
        slideCount,
        positionText,
        tabsText,
        navigatedToSlide2
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

      const crmFrame = page.locator('iframe[title="Hydria CRM"]').first();
      const hasEmbeddedCrm = await isVisible(crmFrame);
      let embeddedCrmText = "";
      if (hasEmbeddedCrm) {
        const frameBody = page.frameLocator('iframe[title="Hydria CRM"]').locator("body");
        await frameBody.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
        embeddedCrmText = (await frameBody.innerText().catch(() => "")) || "";
      }

      const crmPageCheck = await page.evaluate(() => {
        const text = document.body.innerText || "";
        return {
          url: window.location.href,
          hasCrmHeading: /HYDRIA CRM WORKSPACE|HYDRIA CRM/i.test(text),
          hasCreateAction: /Open Hydria CRM|Create a CRM workspace|Create CRM workspace|Créer/i.test(text),
          hasSalesLanguage: /contacts|companies|deals|sales|pipeline|follow-up|CRM/i.test(text)
        };
      });
      crmPageCheck.hasEmbeddedCrm = hasEmbeddedCrm;
      crmPageCheck.embeddedCrmReady = /dashboard|leads|contacts|companies|pipeline|CRM/i.test(
        embeddedCrmText
      );

      assert.equal(crmPageCheck.hasCrmHeading, true, "CRM workspace page should render on direct navigation");
      assert.equal(
        crmPageCheck.hasCreateAction || crmPageCheck.hasEmbeddedCrm,
        true,
        "CRM workspace page should expose creation or the live CRM application"
      );
      assert.equal(
        crmPageCheck.hasSalesLanguage || crmPageCheck.embeddedCrmReady,
        true,
        "CRM workspace page should expose CRM sales work"
      );
      const crmShell = page.locator(".workspace-crm-preview-card").first();
      assert.equal(await isVisible(crmShell), true, "CRM should render inside the Hydria OS application shell");
      assert.equal(
        await crmShell.locator(".workspace-application-preview-tabs").count(),
        0,
        "CRM should not expose workspace shortcut tabs"
      );
      assert.equal(
        await isVisible(crmShell.getByRole("button", { name: "Full screen", exact: true })),
        true,
        "CRM should expose the full screen control"
      );
      await crmShell.getByRole("button", { name: "Full screen", exact: true }).click();
      assert.equal(
        await isVisible(page.locator(".workspace-crm-preview-card.is-expanded")),
        true,
        "CRM full screen should open"
      );
      await page.getByRole("button", { name: "Exit full screen", exact: true }).click();

      return crmPageCheck;
    }
  },
  {
    name: "hydria-core-chat-page",
    tags: ["chat", "core", "workspace"],
    run: async ({ page, options }) => {
      const baseUrl = String(options.baseUrl || "").replace(/\/+$/, "");
      await page.goto(`${baseUrl}/workspace/chat`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);

      const chatPage = page.locator(".core-chat-page").first();
      assert.equal(await isVisible(chatPage), true, "Hydria Core chat page should render");
      assert.equal(
        await isVisible(chatPage.locator(".core-chat-composer textarea")),
        true,
        "Hydria Core chat should expose a composer"
      );
      assert.equal(
        await isVisible(chatPage.getByRole("button", { name: "Send", exact: true })),
        true,
        "Hydria Core chat should expose a send action"
      );
      const navLabels = await page.locator("#workspace-switcher .workspace-switcher-chip").allInnerTexts();
      assert.match(navLabels[0] || "", /^Overview/i, "Overview should remain first in navigation");
      assert.match(navLabels[1] || "", /^Chat/i, "Chat should be placed between Overview and Docs");
      assert.match(navLabels[2] || "", /^Docs/i, "Docs should follow Chat");
      const composerHeight = await chatPage.locator(".core-chat-composer textarea").evaluate(
        (element) => element.getBoundingClientRect().height
      );
      assert.ok(composerHeight < 80, "The empty chat composer should stay compact");
      assert.equal(
        await isVisible(chatPage.getByRole("button", { name: "Importer des fichiers", exact: true })),
        true,
        "Hydria Core chat should expose file import"
      );
      let multipartUploadObserved = false;
      await page.route("**/api/hydria/chat/stream", async (route) => {
        const request = route.request();
        const contentType = request.headers()["content-type"] || "";
        const body = request.postDataBuffer()?.toString("utf8") || "";
        multipartUploadObserved =
          contentType.includes("multipart/form-data") &&
          body.includes("hydria-core-notes.txt") &&
          body.includes("Attachment integration test");
        await new Promise((resolve) => setTimeout(resolve, 900));
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: [
            'event: start\ndata: {"generationId":"visual-gate"}\n\n',
            'event: chunk\ndata: {"text":"Optimistic UI "}\n\n',
            'event: chunk\ndata: {"text":"test response"}\n\n',
            'event: done\ndata: {"answer":"Optimistic UI test response"}\n\n'
          ].join("")
        });
      });
      const optimisticPrompt = `Optimistic message ${Date.now()}`;
      await chatPage.locator(".core-chat-file-input").setInputFiles({
        name: "hydria-core-notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Attachment integration test")
      });
      assert.equal(
        await isVisible(chatPage.locator(".core-chat-attachment-chip", {
          hasText: "hydria-core-notes.txt"
        })),
        true,
        "Selected file should be previewed before sending"
      );
      await chatPage.locator(".core-chat-composer textarea").fill(optimisticPrompt);
      await chatPage.getByRole("button", { name: "Send", exact: true }).click();
      const optimisticBubble = chatPage.locator(".message.user.is-pending .message-bubble", {
        hasText: optimisticPrompt
      });
      await optimisticBubble.waitFor({ state: "visible", timeout: 250 });
      assert.equal(
        await isVisible(optimisticBubble),
        true,
        "The user message should appear before Hydria Core responds"
      );
      assert.equal(
        await isVisible(optimisticBubble.locator(".message-attachment", {
          hasText: "hydria-core-notes.txt"
        })),
        true,
        "The optimistic user message should retain its attachment"
      );
      await page.waitForTimeout(1100);
      assert.equal(
        multipartUploadObserved,
        true,
        "Hydria Core chat should send attachments as multipart form data"
      );
      await page.unroute("**/api/hydria/chat/stream");

      return {
        url: page.url(),
        messageCount: await chatPage.locator(".core-chat-thread .message").count(),
        composerHeight: Math.round(composerHeight)
      };
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
