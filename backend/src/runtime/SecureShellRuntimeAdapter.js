import { runCommand } from "./commandRunner.js";

export class SecureShellRuntimeAdapter {
  constructor({ enabled = false, allowlist = [], workspaceRoot }) {
    this.enabled = enabled;
    this.allowlist = new Set(allowlist || []);
    this.workspaceRoot = workspaceRoot;
  }

  canRun(command) {
    return this.enabled && this.allowlist.has(String(command || "").toLowerCase());
  }

  async run(command, args = [], options = {}) {
    if (!this.enabled) {
      return {
        success: false,
        error: "Secure shell runtime is disabled."
      };
    }

    if (!this.canRun(command)) {
      return {
        success: false,
        error: `Command is not allowed by the runtime policy: ${command}`
      };
    }

    return runCommand(command, args, {
      cwd: options.cwd || this.workspaceRoot,
      timeoutMs: options.timeoutMs
    });
  }
}

export default SecureShellRuntimeAdapter;
