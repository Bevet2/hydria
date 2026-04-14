function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function makePattern({
  patternName,
  category,
  description,
  confidence,
  sourceRepo,
  reusableFor
}) {
  return {
    pattern_name: patternName,
    category,
    description,
    confidence,
    source_repo: sourceRepo,
    reusable_for: reusableFor
  };
}

export function extractRepoPatterns(analysis = {}, taskContext = {}) {
  const patterns = [];
  const features = analysis.features || {};
  const repoName = analysis.repository?.fullName || "";
  const prompt = normalizeText(taskContext.prompt || "");

  if (features.hasLayeredBackend) {
    patterns.push(
      makePattern({
        patternName: "layered_backend",
        category: "backend_architecture",
        description:
          "Route and business logic are separated across route/controller/service style folders.",
        confidence: 0.9,
        sourceRepo: repoName,
        reusableFor: /auth|backend|api|node|express/.test(prompt)
          ? "node/express backend structure"
          : "modular backend services"
      })
    );
  }

  if (features.hasAuthModule) {
    patterns.push(
      makePattern({
        patternName: "auth_module_boundary",
        category: "authentication",
        description:
          "Authentication concerns are isolated into dedicated auth, middleware, and user-related modules.",
        confidence: 0.88,
        sourceRepo: repoName,
        reusableFor: "authentication, user sessions, access control"
      })
    );
  }

  if (features.hasFrontendStructure) {
    patterns.push(
      makePattern({
        patternName: "frontend_feature_structure",
        category: "frontend_architecture",
        description:
          "UI code is organized into pages, components, layouts, hooks, and sometimes stores.",
        confidence: 0.86,
        sourceRepo: repoName,
        reusableFor: /dashboard|admin|react|frontend/.test(prompt)
          ? "React admin/dashboard apps"
          : "frontend organization"
      })
    );
  }

  if (features.isMonorepo) {
    patterns.push(
      makePattern({
        patternName: "monorepo_split",
        category: "repository_structure",
        description:
          "Apps, packages, or libs are split into separate folders, making boundaries explicit.",
        confidence: 0.84,
        sourceRepo: repoName,
        reusableFor: "multi-package projects or shared libraries"
      })
    );
  }

  if (features.hasTests) {
    patterns.push(
      makePattern({
        patternName: "test_guardrails",
        category: "quality",
        description:
          "The repository includes explicit tests or dedicated test directories, indicating quality guardrails.",
        confidence: 0.8,
        sourceRepo: repoName,
        reusableFor: "regression safety and CI quality checks"
      })
    );
  }

  if (features.hasDocs) {
    patterns.push(
      makePattern({
        patternName: "docs_support",
        category: "documentation",
        description:
          "Documentation is separated into docs or README-driven guidance, which helps onboarding and maintenance.",
        confidence: 0.72,
        sourceRepo: repoName,
        reusableFor: "developer onboarding and architecture notes"
      })
    );
  }

  if (features.hasAgentModules) {
    patterns.push(
      makePattern({
        patternName: "agent_module_split",
        category: "agent_architecture",
        description:
          "Agent-related concerns are separated into dedicated agents, tools, memory, or runtime folders.",
        confidence: 0.9,
        sourceRepo: repoName,
        reusableFor: "autonomous agents and orchestrators"
      })
    );
  }

  if (features.hasGitHubIntegration) {
    patterns.push(
      makePattern({
        patternName: "github_integration_boundary",
        category: "github_automation",
        description:
          "GitHub-specific concerns are isolated through workflows, Octokit/Probot integrations, or dedicated automation modules.",
        confidence: 0.84,
        sourceRepo: repoName,
        reusableFor: "GitHub agents, GitHub apps, repository automation"
      })
    );
  }

  return patterns;
}

export function buildPatternSummary(patterns = []) {
  const grouped = new Map();

  for (const pattern of patterns) {
    const key = pattern.pattern_name;
    const existing = grouped.get(key) || {
      ...pattern,
      count: 0,
      source_repos: []
    };
    existing.count += 1;
    existing.confidence = Number(
      ((existing.confidence + pattern.confidence) / 2).toFixed(2)
    );
    if (!existing.source_repos.includes(pattern.source_repo)) {
      existing.source_repos.push(pattern.source_repo);
    }
    grouped.set(key, existing);
  }

  return [...grouped.values()]
    .sort((left, right) => right.count - left.count || right.confidence - left.confidence)
    .slice(0, 8);
}

export default {
  extractRepoPatterns,
  buildPatternSummary
};
