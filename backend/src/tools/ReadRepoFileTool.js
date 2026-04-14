import { BaseTool } from "./BaseTool.js";

function truncate(value = "", maxChars = 260) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

export class ReadRepoFileTool extends BaseTool {
  constructor({ gitAgent }) {
    super({
      id: "read_repo_file",
      label: "Read Repository File",
      description: "Reads a file from a GitHub repository via the contents API.",
      permissions: ["network", "git:read"]
    });

    this.gitAgent = gitAgent;
  }

  async execute({ repo, path }) {
    const result = await this.gitAgent.readRepoFile(repo, path);

    return {
      providerId: this.id,
      sourceType: "tool",
      sourceName: this.label,
      capability: "github_read_file",
      raw: result,
      normalized: {
        repository: result.repository,
        path: result.path,
        size: result.size
      },
      summaryText: `${result.repository.fullName}:${result.path} -> ${truncate(result.content, 260)}`,
      artifacts: []
    };
  }
}

export default ReadRepoFileTool;
