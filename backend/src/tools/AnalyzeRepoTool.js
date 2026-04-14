import { BaseTool } from "./BaseTool.js";

export class AnalyzeRepoTool extends BaseTool {
  constructor({ gitAgent }) {
    super({
      id: "analyze_repo",
      label: "Analyze Repository",
      description: "Analyzes a GitHub repository structure and extracts key paths.",
      permissions: ["network", "git:read"]
    });

    this.gitAgent = gitAgent;
  }

  async execute({ repo }) {
    const analysis = await this.gitAgent.analyzeRepository(repo, {
      prompt: `analyze ${repo}`
    });

    return {
      providerId: this.id,
      sourceType: "tool",
      sourceName: this.label,
      capability: "github_repo_analysis",
      raw: analysis,
      normalized: {
        repository: analysis.repository,
        confidence: analysis.confidence,
        analysisMode: analysis.analysisMode || "api",
        stack: analysis.stack,
        architecture: analysis.architecture,
        importantPaths: analysis.summary?.importantPaths || [],
        patterns: analysis.patterns || []
      },
      summaryText: `${analysis.repository.fullName} -> ${analysis.architecture?.summary || "limited architecture signal"}${analysis.patterns?.length ? ` | patterns: ${analysis.patterns.slice(0, 3).map((pattern) => pattern.pattern_name).join(", ")}` : ""}`,
      artifacts: []
    };
  }
}

export default AnalyzeRepoTool;
