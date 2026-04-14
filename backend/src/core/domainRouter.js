import { resolveRequestedShape } from "./creationShape.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function wantsAnalysis(prompt = "") {
  return /\b(analyse|analyze|analysis|explique|explain|pourquoi|why|recommande|recommend|strategie|strategy|tradeoff|impact)\b/.test(
    normalizeText(prompt)
  );
}

function isBuildArchitecturePrompt(prompt = "") {
  return /\b(create|build|cree|scaffold|implement|propose|architecture|design|structure|backend|frontend|dashboard|auth|jwt|node|express|react|admin)\b/.test(
    normalizeText(prompt)
  );
}

export function resolveDomainProfile({
  prompt = "",
  classification = "simple_chat",
  taskPack = null,
  gitHubNeed = null,
  browserNeed = null,
  apiNeed = null,
  webNeed = null,
  attachments = []
} = {}) {
  const normalized = normalizeText(prompt);
  const requestedShape = resolveRequestedShape(prompt);
  const artifactShape = requestedShape.shape;

  let id = "simple_chat";
  let reason = "default conversational routing";

  if (
    classification === "artifact_generation" &&
    ["spreadsheet", "dataset"].includes(artifactShape)
  ) {
    id = "data_workspace";
    reason = "data workspace requested";
  } else if (
    classification === "artifact_generation" &&
    artifactShape === "presentation"
  ) {
    id = "presentation_builder";
    reason = "presentation environment requested";
  } else if (
    classification === "artifact_generation" &&
    artifactShape === "dashboard"
  ) {
    id = "dashboard_workspace";
    reason = "dashboard environment requested";
  } else if (
    classification === "artifact_generation" &&
    artifactShape === "workflow"
  ) {
    id = "workflow_workspace";
    reason = "workflow environment requested";
  } else if (
    classification === "artifact_generation" &&
    artifactShape === "design"
  ) {
    id = "design_workspace";
    reason = "design environment requested";
  } else if (classification === "artifact_generation") {
    id = "document_workspace";
    reason = taskPack?.id === "artifact_studio" ? "artifact studio routing" : "document environment requested";
  } else if (classification === "coding" && isBuildArchitecturePrompt(prompt)) {
    id = "coding";
    reason = "build or architecture prompt";
  } else if (
    gitHubNeed ||
    /\b(github|repo|repository|repositories|open source|pattern|patterns|implementation pattern)\b/.test(
      normalized
    )
  ) {
    id = "github_research";
    reason = "github intent detected";
  } else if (classification === "data_lookup" && (apiNeed || webNeed || browserNeed)) {
    id = "data_lookup";
    reason = "lookup or factual routing";
  } else if (classification === "coding") {
    id = "coding";
    reason = "coding classification";
  } else if (classification === "brainstorm") {
    id = "brainstorm";
    reason = "brainstorm classification";
  } else if (
    ["complex_reasoning", "compare", "hybrid_task"].includes(classification) ||
    ((apiNeed || webNeed || attachments.length) && wantsAnalysis(prompt))
  ) {
    id = "reasoning";
    reason = "analytical task detected";
  } else if (
    classification === "data_lookup" &&
    browserNeed &&
    !wantsAnalysis(prompt)
  ) {
    id = "simple_chat";
    reason = "browser lookup without analytical depth";
  }

  const profiles = {
    simple_chat: {
      id: "simple_chat",
      label: "Simple Chat",
      primaryAgent: "executor_agent",
      strategy: "fast-grounded",
      responseStyle: "natural concise grounded",
      reasoningDepth: "low",
      maxLlmPasses: 1,
      useResearchAgent: false,
      useApiAgent: false,
      useGitAgent: false
    },
    coding: {
      id: "coding",
      label: "Coding",
      primaryAgent: "executor_agent",
      strategy: "structured-debug",
      responseStyle: "diagnosis fix verification",
      reasoningDepth: "medium",
      maxLlmPasses: 2,
      useResearchAgent: true,
      useApiAgent: false,
      useGitAgent: false
    },
    document_workspace: {
      id: "document_workspace",
      label: "Document Workspace",
      primaryAgent: "executor_agent",
      strategy: "artifact-studio",
      responseStyle: "structured artifact with visible sections and direct usability",
      reasoningDepth: "medium",
      maxLlmPasses: 3,
      useResearchAgent: Boolean(webNeed),
      useApiAgent: Boolean(apiNeed),
      useGitAgent: false
    },
    presentation_builder: {
      id: "presentation_builder",
      label: "Presentation Builder",
      primaryAgent: "executor_agent",
      strategy: "slides-storytelling",
      responseStyle: "slides narrative structure and investor-ready clarity",
      reasoningDepth: "medium",
      maxLlmPasses: 3,
      useResearchAgent: Boolean(webNeed),
      useApiAgent: Boolean(apiNeed),
      useGitAgent: false
    },
    data_workspace: {
      id: "data_workspace",
      label: "Data Workspace",
      primaryAgent: "executor_agent",
      strategy: "table-first-grounded",
      responseStyle: "structured data surface with concrete rows columns and calculations",
      reasoningDepth: "medium",
      maxLlmPasses: 3,
      useResearchAgent: Boolean(webNeed),
      useApiAgent: Boolean(apiNeed),
      useGitAgent: false
    },
    dashboard_workspace: {
      id: "dashboard_workspace",
      label: "Dashboard Workspace",
      primaryAgent: "executor_agent",
      strategy: "analytics-surface",
      responseStyle: "operational dashboard with kpis widgets filters and actions",
      reasoningDepth: "medium",
      maxLlmPasses: 3,
      useResearchAgent: true,
      useApiAgent: Boolean(apiNeed),
      useGitAgent: false
    },
    workflow_workspace: {
      id: "workflow_workspace",
      label: "Workflow Workspace",
      primaryAgent: "executor_agent",
      strategy: "automation-surface",
      responseStyle: "node-based flow with triggers steps outputs and links",
      reasoningDepth: "medium",
      maxLlmPasses: 3,
      useResearchAgent: true,
      useApiAgent: Boolean(apiNeed),
      useGitAgent: false
    },
    design_workspace: {
      id: "design_workspace",
      label: "Design Workspace",
      primaryAgent: "executor_agent",
      strategy: "wireframe-surface",
      responseStyle: "visual layout with frames blocks hierarchy and clarity",
      reasoningDepth: "medium",
      maxLlmPasses: 3,
      useResearchAgent: true,
      useApiAgent: false,
      useGitAgent: false
    },
    github_research: {
      id: "github_research",
      label: "GitHub Research",
      primaryAgent: "git_agent",
      strategy: "repo-pattern-analysis",
      responseStyle: "repos patterns recommendation",
      reasoningDepth: "medium",
      maxLlmPasses: 1,
      useResearchAgent: true,
      useApiAgent: false,
      useGitAgent: true
    },
    data_lookup: {
      id: "data_lookup",
      label: "Data Lookup",
      primaryAgent: "executor_agent",
      strategy: "facts-first",
      responseStyle: "answer facts clearly with units sources and direct interpretation",
      reasoningDepth: "low",
      maxLlmPasses: 1,
      useResearchAgent: Boolean(webNeed),
      useApiAgent: Boolean(apiNeed),
      useGitAgent: false
    },
    reasoning: {
      id: "reasoning",
      label: "Reasoning",
      primaryAgent: "planner_agent",
      strategy: "stepwise-grounded",
      responseStyle: "recommendation reasoning risks next-steps",
      reasoningDepth: "high",
      maxLlmPasses: 2,
      useResearchAgent: true,
      useApiAgent: Boolean(apiNeed),
      useGitAgent: false
    },
    brainstorm: {
      id: "brainstorm",
      label: "Brainstorm",
      primaryAgent: "planner_agent",
      strategy: "diverse-ideas",
      responseStyle: "diverse ideas prioritization",
      reasoningDepth: "medium",
      maxLlmPasses: 2,
      useResearchAgent: false,
      useApiAgent: false,
      useGitAgent: false
    }
  };

  return {
    ...profiles[id],
    reason
  };
}

export function tunePlanForDomain(plan = {}, domainProfile = null) {
  if (!domainProfile || !Array.isArray(plan.steps)) {
    return plan;
  }

  let llmSeen = 0;
  const steps = [];

  for (const step of plan.steps) {
    if (step.type === "llm") {
      llmSeen += 1;
      if (llmSeen > domainProfile.maxLlmPasses) {
        continue;
      }
    }

    if (domainProfile.id === "simple_chat" && ["knowledge", "research_agent", "api_agent"].includes(step.type)) {
      continue;
    }

    if (domainProfile.id === "github_research" && step.type === "web") {
      continue;
    }

    steps.push(step);
  }

  return {
    ...plan,
    domainProfile,
    steps
  };
}

export default {
  resolveDomainProfile,
  tunePlanForDomain
};
