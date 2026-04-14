import {
  detectTaskSubdomain,
  detectTaskType,
  inferLearningCategory,
  inferLearningTags,
  inferProjectType
} from "./learning.reuse.js";
import { seedContextStats } from "./learning.contextStats.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniqBy(items = [], keyBuilder) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = keyBuilder(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function summarizeStepTypes(steps = []) {
  return [...new Set((steps || []).map((step) => step.type).filter(Boolean))];
}

function buildSpecificContextLabel(context = {}) {
  const prompt = String(context.prompt || "").toLowerCase();
  const subdomain = detectTaskSubdomain(context);
  const taskType = detectTaskType(context);
  const parts = [];

  if (/\bnode\b/.test(prompt)) {
    parts.push("Node");
  }
  if (/\bexpress\b/.test(prompt)) {
    parts.push("Express");
  }
  if (/\breact\b/.test(prompt)) {
    parts.push("React");
  }
  if (/\bgithub\b/.test(prompt)) {
    parts.push("GitHub");
  }
  if (/\bdashboard\b/.test(prompt)) {
    parts.push("dashboard");
  }
  if (/\badmin\b/.test(prompt)) {
    parts.push("admin");
  }
  if (/\bjwt\b/.test(prompt)) {
    parts.push("JWT");
  }
  if (/\bauth\b/.test(prompt)) {
    parts.push("auth");
  }
  if (/\bapi\b/.test(prompt)) {
    parts.push("API");
  }
  if (/\bcontroller\b/.test(prompt) || /\bservice\b/.test(prompt)) {
    parts.push("service/controller");
  }

  const technologyLabel = parts.join("/");
  const focusLabel =
    subdomain && subdomain !== "general" && subdomain !== inferLearningCategory(context)
      ? `${subdomain} ${inferLearningCategory(context)}`
      : subdomain;

  return [technologyLabel, focusLabel, taskType !== "general" ? taskType : ""]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function buildSource(context = {}) {
  return {
    taskId: context.taskId || context.conversationId || "",
    repo: context.repo || "",
    project: context.project || "hydria",
    projectType: inferProjectType(context)
  };
}

function buildBaseItem({
  type,
  category,
  description,
  confidence,
  successRate,
  reusableFor,
  context
}) {
  return {
    type,
    category,
    description,
    confidence: clamp(confidence, 0, 1),
    usageCount: 0,
    successRate: clamp(successRate, 0, 1),
    reusableFor,
    projectType: inferProjectType(context),
    source: buildSource(context),
    createdAt: new Date().toISOString(),
    contextStats: seedContextStats(
      {
        domain: context.domain || context.classification || "general",
        subdomain: detectTaskSubdomain(context),
        taskType: detectTaskType(context)
      },
      clamp(successRate, 0, 1)
    )
  };
}

function extractFromGitResult(result = {}, context = {}) {
  const normalized = result.normalized || {};
  const patterns = normalized.patterns || [];
  const category = inferLearningCategory(context);

  return patterns.map((pattern) =>
    buildBaseItem({
      type: "pattern",
      category: pattern.category || category,
      description:
        pattern.description ||
        `${pattern.pattern_name} observed in ${pattern.source_repo} for ${buildSpecificContextLabel(context) || category} tasks`,
      confidence: Number(pattern.confidence || 0.72),
      successRate: Number(pattern.confidence || 0.72),
      reusableFor: [
        pattern.category || category,
        ...(Array.isArray(pattern.reusable_for) ? pattern.reusable_for : [pattern.reusable_for]).filter(Boolean)
      ],
      context: {
        ...context,
        repo: pattern.source_repo || context.repo,
        projectType: "external"
      }
    })
  );
}

function extractInternalLearnings(result = {}, context = {}) {
  const items = [];
  const plan = result.plan || {};
  const critiqueScore = Number(result.critique?.score || 0);
  const successRate = clamp(critiqueScore / 100, 0.2, 0.98);
  const category = inferLearningCategory(context);
  const subdomain = detectTaskSubdomain(context);
  const taskType = detectTaskType(context);
  const tags = inferLearningTags(context);
  const stepTypes = summarizeStepTypes(result.executionSteps || result.execution?.executionSteps || []);
  const specificLabel = buildSpecificContextLabel(context) || `${subdomain} ${category}`.trim();

  if (stepTypes.length && critiqueScore >= 60) {
    items.push(
      buildBaseItem({
        type: "strategy",
        category,
        description: `For ${specificLabel}, the execution flow ${stepTypes.join(" -> ")} produced a usable ${taskType} result.`,
        confidence: clamp(0.5 + stepTypes.length * 0.05 + critiqueScore / 200, 0.55, 0.94),
        successRate,
        reusableFor: tags,
        context
      })
    );
  }

  if (["coding", "artifact_generation", "compare", "complex_reasoning"].includes(context.classification) && stepTypes.length >= 2 && critiqueScore >= 55) {
    items.push(
      buildBaseItem({
        type: "pattern",
        category,
        description: `A ${specificLabel} ${context.classification} task worked best with a staged flow using ${stepTypes.join(", ")}.`,
        confidence: clamp(0.48 + critiqueScore / 180, 0.52, 0.9),
        successRate,
        reusableFor: tags,
        context
      })
    );
  }

  if (
    inferProjectType(context) === "internal" &&
    ["artifact_generation", "coding"].includes(context.classification) &&
    (result.artifacts || []).length
  ) {
    const artifact = (result.artifacts || [])[0];
    items.push(
      buildBaseItem({
        type: "template",
        category,
        description: `Reusable ${artifact.format || artifact.type || "artifact"} delivery template for ${specificLabel} tasks.`,
        confidence: clamp(0.42 + critiqueScore / 170, 0.5, 0.88),
        successRate,
        reusableFor: [...tags, artifact.format || artifact.type || "artifact"],
        context
      })
    );
  }

  if (critiqueScore > 0 && critiqueScore < 58) {
    const topIssue = (result.critique?.issues || [])[0] || "weak_grounding";
    items.push(
      buildBaseItem({
        type: "mistake",
        category,
        description: `Avoid repeating ${topIssue} on ${specificLabel} ${context.classification} tasks without stronger grounding.`,
        confidence: 0.68,
        successRate: clamp(1 - successRate, 0.2, 0.75),
        reusableFor: tags,
        context
      })
    );
  }

  return items;
}

function extractEvolutionLearnings(result = {}, context = {}) {
  const items = [];
  const comparison = result.comparison || {};
  const attempts = result.attempts || [];
  const category = inferLearningCategory(context);
  const specificLabel = buildSpecificContextLabel(context) || category;
  const tags = inferLearningTags(context);

  if (comparison.winner === "second" && result.strategy?.id) {
    items.push(
      buildBaseItem({
        type: "strategy",
        category,
        description: `Improvement strategy ${result.strategy.id} increased the score by ${comparison.delta || 0} points for ${specificLabel} ${context.classification} tasks.`,
        confidence: clamp(0.6 + Number(comparison.delta || 0) / 30, 0.62, 0.95),
        successRate: clamp((Number(result.retryCritique?.score || 0) || 0) / 100, 0.4, 0.98),
        reusableFor: [...tags, result.strategy.id],
        context
      })
    );
  }

  for (const attempt of attempts) {
    if ((attempt.comparison?.winner || "") === "first") {
      items.push(
      buildBaseItem({
        type: "mistake",
        category,
        description: `Retry strategy ${attempt.strategy?.id || "unknown"} did not improve ${specificLabel} ${context.classification} tasks.`,
        confidence: 0.72,
        successRate: 0.25,
        reusableFor: [...tags, attempt.strategy?.id || "retry"],
          context
        })
      );
    }
  }

  return items;
}

export function extractLearningFromTask(result = {}, context = {}) {
  const projectType = inferProjectType(context);

  let items = [];
  if (context.kind === "github_research" || projectType === "external") {
    items = extractFromGitResult(result, context);
  } else if (context.kind === "evolution") {
    items = extractEvolutionLearnings(result, context);
  } else {
    items = extractInternalLearnings(result, context);
  }

  return uniqBy(
    items.filter((item) => item.description),
    (item) => `${item.type}:${item.category}:${item.description}`
  );
}

export default {
  extractLearningFromTask
};
