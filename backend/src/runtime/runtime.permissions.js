export class RuntimePermissions {
  constructor({
    allowNetwork = true,
    allowBrowser = true,
    allowShell = false,
    allowGitClone = true,
    toolAllowlist = [],
    browserActionAllowlist = ["inspect", "links", "click", "fill", "screenshot"]
  } = {}) {
    this.allowNetwork = allowNetwork;
    this.allowBrowser = allowBrowser;
    this.allowShell = allowShell;
    this.allowGitClone = allowGitClone;
    this.toolAllowlist = toolAllowlist;
    this.browserActionAllowlist = browserActionAllowlist;
  }

  check(tool, input = {}) {
    const permissions = tool?.permissions || [];
    const denied = [];

    if (
      Array.isArray(this.toolAllowlist) &&
      this.toolAllowlist.length &&
      tool?.id &&
      !this.toolAllowlist.includes(tool.id)
    ) {
      denied.push("tool:not_allowed");
    }

    for (const permission of permissions) {
      if (permission === "network" && !this.allowNetwork) {
        denied.push(permission);
      }

      if ((permission === "browser" || permission.startsWith("browser:")) && !this.allowBrowser) {
        denied.push(permission);
      }

      if ((permission === "shell:run" || permission.startsWith("shell:")) && !this.allowShell) {
        denied.push(permission);
      }

      if ((permission === "git:clone" || permission.startsWith("git:")) && !this.allowGitClone) {
        denied.push(permission);
      }
    }

    if (tool?.id === "browser_automation") {
      const requestedAction = String(input.action || input.browserNeed?.action || "inspect");
      if (
        Array.isArray(this.browserActionAllowlist) &&
        this.browserActionAllowlist.length &&
        !this.browserActionAllowlist.includes(requestedAction)
      ) {
        denied.push(`browser_action:${requestedAction}`);
      }
    }

    return {
      allowed: denied.length === 0,
      denied
    };
  }
}

export default RuntimePermissions;
