import { BaseTool } from "./BaseTool.js";

export class SearchGitHubCodeTool extends BaseTool {
  constructor({ gitAgent }) {
    super({
      id: "search_github_code",
      label: "Search GitHub Code",
      description: "Searches code across GitHub repositories.",
      permissions: ["network", "git:read"]
    });

    this.gitAgent = gitAgent;
  }

  async execute({ prompt, query, repo = "" }) {
    const result = await this.gitAgent.locateCode(query || prompt, repo);

    return {
      providerId: this.id,
      sourceType: "tool",
      sourceName: this.label,
      capability: "github_code_search",
      raw: result,
      normalized: {
        query: result.query || query || prompt || "",
        totalCount: result.totalCount,
        fallbackUsed: Boolean(result.fallbackUsed),
        items: result.items.slice(0, 6).map((item) => ({
          repository: item.repository.fullName,
          path: item.path,
          htmlUrl: item.htmlUrl,
          snippet: item.snippet || ""
        })),
        errors: result.errors || []
      },
      summaryText: result.items.length
        ? result.items
            .slice(0, 5)
            .map((item) => `${item.repository.fullName}:${item.path}`)
            .join("\n")
        : "No matching GitHub code results were found.",
      artifacts: []
    };
  }
}

export default SearchGitHubCodeTool;
