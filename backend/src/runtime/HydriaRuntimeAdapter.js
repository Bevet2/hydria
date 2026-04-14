import { RuntimeAdapter } from "../types/contracts.js";
import { FileRuntimeAdapter } from "./FileRuntimeAdapter.js";
import { SecureShellRuntimeAdapter } from "./SecureShellRuntimeAdapter.js";
import { CredentialVault } from "./CredentialVault.js";
import { BrowserRuntimeAdapter } from "./runtime.browser.js";
import { runCommand, runMonitoredCommand } from "./commandRunner.js";
import baseConfig from "../../config/hydria.config.js";
import agenticConfig from "../config/agenticConfig.js";

export class HydriaRuntimeAdapter extends RuntimeAdapter {
  constructor({
    fileAdapter,
    shellAdapter,
    credentialVault,
    browserAdapter,
    sessionManager = null
  } = {}) {
    super();
    this.fileAdapter =
      fileAdapter ||
      new FileRuntimeAdapter({
        workspaceRoot: baseConfig.tools.workspaceRoot
      });
    this.shellAdapter =
      shellAdapter ||
      new SecureShellRuntimeAdapter({
        enabled: agenticConfig.shell.enabled,
        allowlist: agenticConfig.shell.allowlist,
        workspaceRoot: baseConfig.tools.workspaceRoot
      });
    this.credentialVault = credentialVault || new CredentialVault();
    this.browserAdapter =
      browserAdapter ||
      new BrowserRuntimeAdapter({
        enabled: agenticConfig.runtime.allowBrowser,
        sessionManager
      });
  }

  async listFiles(relativeDir = ".") {
    return this.fileAdapter.list(relativeDir);
  }

  async readFile(relativePath) {
    return this.fileAdapter.readText(relativePath);
  }

  async stat(relativePath) {
    return this.fileAdapter.stat(relativePath);
  }

  async runShell(command, args = [], options = {}) {
    return this.shellAdapter.run(command, args, options);
  }

  async runCommand({ command = "", cwd = "", timeoutMs = 120000, env = {} } = {}) {
    const parts = String(command || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return {
        success: false,
        error: "Missing command",
        output: ""
      };
    }

    if (process.platform === "win32" && parts[0] === "npm") {
      parts[0] = "npm.cmd";
    }

    const result = await runCommand(parts[0], parts.slice(1), {
      cwd,
      timeoutMs,
      env
    });

    return {
      success: result.success,
      output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
      error: result.error || "",
      durationMs: result.durationMs,
      exitCode: result.exitCode
    };
  }

  async runMonitoredCommand({
    command = "",
    cwd = "",
    timeoutMs = 8000,
    graceMs = 500,
    readyPatterns = [],
    env = {}
  } = {}) {
    const parts = String(command || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return {
        success: false,
        error: "Missing command",
        output: ""
      };
    }

    if (process.platform === "win32" && parts[0] === "npm") {
      parts[0] = "npm.cmd";
    }

    const result = await runMonitoredCommand(parts[0], parts.slice(1), {
      cwd,
      timeoutMs,
      graceMs,
      readyPatterns,
      env
    });

    return {
      success: result.success,
      output: result.output || "",
      error: result.error || "",
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      readyMatched: result.readyMatched,
      timedOutWhileRunning: result.timedOutWhileRunning
    };
  }

  async writeFile(relativePath, content = "") {
    return this.fileAdapter.writeText(relativePath, content);
  }

  async writeJsonFile(relativePath, value = {}) {
    return this.fileAdapter.writeJson(relativePath, value);
  }

  async copyFile(fromPath, toPath) {
    return this.fileAdapter.copy(fromPath, toPath);
  }

  async fileExists(relativePath) {
    return this.fileAdapter.exists(relativePath);
  }

  getCredential(key, fallback = "") {
    return this.credentialVault.get(key, fallback);
  }

  async navigateBrowser(input) {
    return this.browserAdapter.navigate(input);
  }

  async extractBrowserContent(input) {
    return this.browserAdapter.extract(input);
  }

  async listBrowserLinks(input) {
    return this.browserAdapter.listLinks(input);
  }

  async clickBrowser(input) {
    return this.browserAdapter.click(input);
  }

  async fillBrowser(input) {
    return this.browserAdapter.fill(input);
  }

  async captureBrowserScreenshot(input) {
    return this.browserAdapter.screenshot(input);
  }

  async closeBrowserSession(sessionId) {
    return this.browserAdapter.closeSession(sessionId);
  }

  async executeTool(toolId, input, context = {}) {
    return {
      toolId,
      input,
      context
    };
  }

  async describeEnvironment() {
    return {
      runtime: "hydria-runtime",
      shellEnabled: Boolean(this.shellAdapter),
      fileAccess: true,
      browserEnabled: Boolean(this.browserAdapter),
      credentials: "env-backed"
    };
  }
}

export default HydriaRuntimeAdapter;
