import { Evaluator } from "../types/contracts.js";
import { EVAL_STATUSES } from "../types/primitives.js";
import { scoreExecution } from "./eval.scorer.js";

function truncate(text, maxChars = 220) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 3)}...`;
}

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isBrowserPrompt(prompt = "") {
  return /\b(browser|navigue|ouvre|navigate|visit|page|url|links?|liens?|localhost|visible|screen|screenshot|capture|preview)\b/i.test(
    normalizeText(prompt)
  );
}

function isDeliveryPrompt(prompt = "") {
  return /\b(scaffold|create|build|generate|g[eé]n[eé]re|cr[eé]e|fais|backend|api|project|projet|squelette|skeleton)\b/i.test(
    normalizeText(prompt)
  );
}

function countRepoMentions(answer = "") {
  const matches =
    String(answer || "").match(/\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b/g) || [];
  return [...new Set(matches)].length;
}

function isHydriaIdentityMismatch(prompt = "", answer = "") {
  const normalizedPrompt = normalizeText(prompt);
  if (
    !/\bhydria\b/.test(normalizedPrompt) ||
    !/\b(what is|what's|who are you|qui es tu|qu est|qu'est|explique|presente)\b/.test(
      normalizedPrompt
    )
  ) {
    return false;
  }

  const normalizedAnswer = normalizeText(answer);
  return /\b(musique|musical|partition|choeur|choral|instrument)\b/.test(normalizedAnswer);
}

function isHydriaIdentityGrounded(prompt = "", answer = "") {
  const normalizedPrompt = normalizeText(prompt);
  if (
    !/\bhydria\b/.test(normalizedPrompt) ||
    !/\b(what is|what's|who are you|qui es tu|qu est|qu'est|explique|presente)\b/.test(
      normalizedPrompt
    )
  ) {
    return false;
  }

  const normalizedAnswer = normalizeText(answer);
  return (
    /\b(orchestrateur|orchestrator)\b/.test(normalizedAnswer) &&
    /\b(local|modulaire|modular|agent|api|web|memoire|memory|outil|tool)\b/.test(
      normalizedAnswer
    )
  );
}

function buildImprovementPrompt({ classification = "simple_chat", issues = [] }) {
  if (classification === "coding") {
    return "Rewrite the answer with three explicit sections: Diagnosis, Concrete fix, Verification. Use the tool evidence already available. Remove vague clarification requests unless you are truly blocked.";
  }

  if (classification === "brainstorm") {
    return "Rewrite the answer as 5 diverse, concrete ideas with one short value proposition each, then end with one recommended starting point.";
  }

  if (["complex_reasoning", "compare", "hybrid_task"].includes(classification)) {
    return "Rewrite the answer with Recommendation, Why, Risks, and Next steps. Remove vague statements and make the conclusion explicit.";
  }

  if (issues.includes("identity_mismatch")) {
    return "Rewrite the answer so it stays strictly grounded in Hydria's real identity and capabilities.";
  }

  return "Rewrite the answer so it is more direct, more grounded, and better structured for the task.";
}

export class HeuristicEvaluator extends Evaluator {
  constructor({ logStore, minSuccessScore = 58 }) {
    super();
    this.logStore = logStore;
    this.minSuccessScore = minSuccessScore;
  }

  async evaluate({
    taskContext,
    plan,
    execution,
    synthesis
  }) {
    const classification = taskContext.classification || "simple_chat";
    const finalAnswer = synthesis?.finalAnswer || "";
    const trace = execution?.trace || [];
    const candidateCount = (execution?.candidates || []).length;
    const evidenceCount =
      (execution?.apiResults || []).length +
      (execution?.webResults || []).length +
      (execution?.toolResults || []).length;
    const failedSteps = trace.filter((step) => step.status === "failed").length;
    const learningUsed = execution?.learningUsed || [];
    const learningCreated = execution?.learningCreated || [];
    const learningUsedCount = learningUsed.length;
    const learningCreatedCount = learningCreated.length;
    const avgGenericityPenalty =
      learningUsed.reduce((sum, item) => sum + Number(item.genericityPenalty || 0), 0) /
        Math.max(learningUsedCount, 1);
    const avgContextualScore =
      learningUsed.reduce((sum, item) => sum + Number(item.contextualScore || 0), 0) /
        Math.max(learningUsedCount, 1);
    const strongLearningMatches = learningUsed.filter(
      (item) => ["strong", "medium"].includes(item.domainMatch)
    ).length;
    const improvementDelta = Number(execution?.improvementDelta || 0);
    const { score, dimensions } = scoreExecution({
      classification,
      domain: taskContext.domain || classification,
      prompt: taskContext.routingPrompt || taskContext.prompt,
      finalAnswer,
      plan,
      trace,
      candidateCount,
      evidenceCount,
      learningUsed,
      learningCreated,
      improvementDelta
    });

    const issues = [];
    const strengths = [];

    if (!finalAnswer) {
      issues.push("missing_final_answer");
    } else {
      strengths.push("final_answer_available");
    }

    if (failedSteps > 0) {
      issues.push("step_failures_detected");
    }

    if (!evidenceCount && ["data_lookup", "hybrid_task", "compare"].includes(classification)) {
      issues.push("weak_grounding");
    } else if (evidenceCount) {
      strengths.push("grounded_with_observations");
    }

    if (candidateCount > 1) {
      strengths.push("multiple_reasoning_candidates");
    }

    if (learningUsedCount > 0) {
      strengths.push("reused_validated_learnings");
    }

    if (strongLearningMatches > 0) {
      strengths.push("contextual_learning_match");
    }

    if (learningCreatedCount > 0) {
      strengths.push("captured_new_learnings");
    }

    if (improvementDelta > 0) {
      strengths.push("improved_after_retry");
    } else if (improvementDelta < 0) {
      issues.push("retry_regression");
    }

    if (dimensions.factuality < 14) {
      issues.push("hallucination_risk");
    }

    if (dimensions.usefulness < 12) {
      issues.push("too_vague");
    }

    if (dimensions.structure < 7 && classification !== "simple_chat") {
      issues.push("missing_structure");
    }

    if (dimensions.brevity < 4) {
      issues.push(finalAnswer.length < 140 ? "too_short" : "too_long");
    }

    if (dimensions.learning < 0 && ["coding", "github_research", "reasoning", "compare"].includes(taskContext.domain || classification)) {
      issues.push("learning_not_reused");
    }

    if (learningUsedCount > 0 && avgGenericityPenalty >= 4.8) {
      issues.push("generic_learning_reuse");
    }

    if (learningUsedCount > 0 && avgContextualScore < 2.2) {
      issues.push("weak_learning_match");
    }

    if (
      learningUsedCount > 0 &&
      ["coding", "github_research", "reasoning", "compare"].includes(taskContext.domain || classification) &&
      strongLearningMatches === 0
    ) {
      issues.push("reuse_not_domain_aligned");
    }

    if (
      classification === "data_lookup" &&
      finalAnswer.length >= 25 &&
      issues.includes("too_short")
    ) {
      issues.splice(issues.indexOf("too_short"), 1);
    }

    if (
      classification === "coding" &&
      /could you clarify|pourriez-vous preciser|demande est vague/i.test(finalAnswer)
    ) {
      issues.push("coding_answer_lacks_action");
    }

    if (
      classification === "coding" &&
      isDeliveryPrompt(taskContext.routingPrompt || taskContext.prompt) &&
      !execution?.projectDelivery &&
      !(execution?.artifacts || []).some((artifact) => artifact.type === "generated_file")
    ) {
      issues.push("delivery_not_executed");
    }

    if (
      classification === "simple_chat" &&
      /^#+\s/m.test(finalAnswer)
    ) {
      issues.push("simple_chat_too_mechanical");
    }

    if (
      taskContext.domain === "github_research" &&
      !/repo|repository|pattern|implementation|hydria/i.test(finalAnswer)
    ) {
      issues.push("github_answer_lacks_patterns");
    }

    if (taskContext.domain === "github_research" && countRepoMentions(finalAnswer) < 2) {
      issues.push("github_answer_lacks_repositories");
    }

    if (
      taskContext.domain === "github_research" &&
      !/recommandation finale|final recommendation|recommendation for hydria|recommandation pour hydria/i.test(
        finalAnswer
      )
    ) {
      issues.push("github_answer_lacks_recommendation");
    }

    if (
      taskContext.domain === "reasoning" &&
      !/recommendation|recommandation|why|pourquoi|risks|risques|next steps|prochaines etapes/i.test(
        finalAnswer
      )
    ) {
      issues.push("reasoning_answer_lacks_steps");
    }

    if (isHydriaIdentityMismatch(taskContext.routingPrompt || taskContext.prompt, finalAnswer)) {
      issues.push("identity_mismatch");
    }

    if (isHydriaIdentityGrounded(taskContext.routingPrompt || taskContext.prompt, finalAnswer)) {
      strengths.push("identity_grounded");
    }

    const weaknesses = [];
    if (issues.includes("hallucination_risk")) {
      weaknesses.push("grounding is too weak for the task");
    }
    if (issues.includes("too_vague")) {
      weaknesses.push("the answer is still too generic");
    }
    if (issues.includes("missing_structure")) {
      weaknesses.push("the response shape is not explicit enough");
    }
    if (issues.includes("coding_answer_lacks_action")) {
      weaknesses.push("the coding answer asks for clarification instead of acting on the evidence");
    }
    if (issues.includes("delivery_not_executed")) {
      weaknesses.push("the task looked executable, but no real delivery artifact was produced");
    }
    if (issues.includes("simple_chat_too_mechanical")) {
      weaknesses.push("the simple chat answer sounds too mechanical");
    }
    if (issues.includes("github_answer_lacks_patterns")) {
      weaknesses.push("the GitHub research answer does not extract actionable patterns");
    }
    if (issues.includes("github_answer_lacks_repositories")) {
      weaknesses.push("the GitHub research answer does not name enough concrete repositories");
    }
    if (issues.includes("github_answer_lacks_recommendation")) {
      weaknesses.push("the GitHub research answer does not end with a usable recommendation");
    }
    if (issues.includes("reasoning_answer_lacks_steps")) {
      weaknesses.push("the reasoning answer does not make its steps explicit");
    }
    if (issues.includes("learning_not_reused")) {
      weaknesses.push("the answer did not reuse any validated learning despite a reusable domain");
    }
    if (issues.includes("generic_learning_reuse")) {
      weaknesses.push("the reused learning was too generic for the current task");
    }
    if (issues.includes("weak_learning_match")) {
      weaknesses.push("the reused learning did not match the current task context strongly enough");
    }
    if (issues.includes("reuse_not_domain_aligned")) {
      weaknesses.push("the reused learning was not aligned with the task domain");
    }
    if (issues.includes("retry_regression")) {
      weaknesses.push("the retry strategy made the result worse instead of better");
    }
    if (
      isBrowserPrompt(taskContext.routingPrompt || taskContext.prompt) &&
      !/liens principaux|main links|aucun lien visible|no visible links|boutons visibles|visible controls|titre|title|contenu visible|visible content/i.test(
        finalAnswer
      )
    ) {
      issues.push("browser_answer_lacks_visible_elements");
      weaknesses.push("the browser answer does not clearly report what was visible on the page");
    }

    const missingElements = [];
    if (classification === "coding" && !/diagnostic|diagnosis|fix|correction|verification/i.test(finalAnswer)) {
      missingElements.push("diagnosis_fix_verification_sections");
    }
    if (
      ["complex_reasoning", "compare", "hybrid_task"].includes(classification) &&
      !/recommendation|recommandation|why|pourquoi|next steps|prochaines etapes/i.test(finalAnswer)
    ) {
      missingElements.push("explicit_reasoning_sections");
    }
    if (classification === "brainstorm" && !/^(\d+\.|- )/m.test(finalAnswer)) {
      missingElements.push("diverse_enumerated_ideas");
    }
    if (taskContext.domain === "github_research" && !/repo|repository/i.test(finalAnswer)) {
      missingElements.push("named_repositories_or_patterns");
    }
    if (
      taskContext.domain === "github_research" &&
      !/recommandation finale|final recommendation|recommendation for hydria|recommandation pour hydria/i.test(
        finalAnswer
      )
    ) {
      missingElements.push("explicit_final_recommendation");
    }

    const status =
      score >= this.minSuccessScore
        ? EVAL_STATUSES[0]
        : finalAnswer
          ? EVAL_STATUSES[1]
          : EVAL_STATUSES[2];

    const report = {
      status,
      score,
      issues,
      strengths,
      weaknesses,
      missingElements,
      dimensions,
      needsRetry: score < this.minSuccessScore,
      improvementPrompt: buildImprovementPrompt({
        classification,
        issues
      }),
      summary:
        status === "success"
          ? "Execution looks usable and grounded enough."
          : status === "partial"
            ? "Execution produced a partial result but still needs a stronger rewrite or better grounding."
            : "Execution failed to produce a usable autonomous result."
    };

    if (this.logStore) {
      await this.logStore.append({
        timestamp: new Date().toISOString(),
        prompt: truncate(taskContext.routingPrompt || taskContext.prompt),
        classification: taskContext.classification,
        score,
        status,
        issues,
        strengths
      });
    }

    return report;
  }
}

export default HeuristicEvaluator;
