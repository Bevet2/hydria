import { BaseTool } from "./BaseTool.js";

export class SearchGitHubReposTool extends BaseTool {
  constructor({ gitAgent }) {
    super({
      id: "search_github_repos",
      label: "Search GitHub Repositories",
      description: "Searches public GitHub repositories with optional stars and language filters.",
      permissions: ["network", "git:read"]
    });

    this.gitAgent = gitAgent;
  }

  async execute({ prompt, query, filters = {} }) {
    const result = await this.gitAgent.findRelevantRepos(query || prompt, filters);
    const ranked = (result.items || []).slice(0, 5).map((repo) => ({
      fullName: repo.fullName,
      language: repo.language || "unknown",
      stars: repo.stars,
      description: repo.description || "",
      archived: repo.archived,
      discoverySource: repo.discoverySource || "github_api"
    }));

    return {
      providerId: this.id,
      sourceType: "tool",
      sourceName: this.label,
      capability: "github_repo_search",
      raw: result,
      normalized: {
        query: result.queryInfo?.primaryQuery || query || prompt || "",
        filters: result.filters || filters,
        fallbackUsed: Boolean(result.fallbackUsed),
        repositories: ranked,
        errors: result.errors || []
      },
      summaryText: ranked.length
        ? ranked
            .map(
              (repo) =>
                `${repo.fullName} | ${repo.language} | ${repo.stars} stars${repo.description ? ` | ${repo.description}` : ""}`
            )
            .join("\n")
        : "No matching GitHub repositories were found.",
      artifacts: []
    };
  }
}

export default SearchGitHubReposTool;
