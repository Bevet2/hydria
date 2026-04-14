import { BaseTool } from "./BaseTool.js";

export class CloneRepoTool extends BaseTool {
  constructor({ gitAgent }) {
    super({
      id: "clone_repo",
      label: "Clone Repository",
      description: "Clones a GitHub repository inside the runtime sandbox.",
      permissions: ["git:clone", "shell:run"]
    });

    this.gitAgent = gitAgent;
  }

  async execute({ repo, localPath = "" }) {
    const result = await this.gitAgent.cloneRepo(repo, localPath);

    return {
      providerId: this.id,
      sourceType: "tool",
      sourceName: this.label,
      capability: "github_clone",
      raw: result,
      normalized: result,
      summaryText: result.success
        ? `Repository cloned: ${result.repository.fullName} -> ${result.localPath}`
        : `Repository clone failed: ${result.stderr || result.stdout || "unknown error"}`,
      artifacts: []
    };
  }
}

export default CloneRepoTool;
