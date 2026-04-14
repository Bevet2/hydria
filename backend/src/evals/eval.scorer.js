function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function countSuccessfulSteps(trace = []) {
  return trace.filter((step) => step.status === "success").length;
}

function countFailedSteps(trace = []) {
  return trace.filter((step) => step.status === "failed").length;
}

function hasStructuredMarkers(answer = "") {
  return /^[-*]\s/m.test(answer) || /^\d+\.\s/m.test(answer) || /^#+\s/m.test(answer);
}

function hasUsefulSectionLabels(answer = "") {
  return /\b(diagnostic|diagnosis|correction|fix|verification|recommandation|recommendation|comparison|comparaison|pourquoi|why|risks|risques|next steps|prochaines etapes|patterns|relevant repos)\b/i.test(
    answer
  );
}

function hasSourceSignal(answer = "") {
  return /\b(source|sources|according to|selon|open-meteo|github|stooq|mymemory|duckduckgo|browser automation)\b/i.test(
    normalizeText(answer)
  );
}

function isBrowserPrompt(prompt = "") {
  return /\b(browser|navigue|ouvre|navigate|visit|page|url|links?|liens?|localhost|visible|screen|screenshot|capture|preview)\b/i.test(
    normalizeText(prompt)
  );
}

function looksLikeDirectLookupAnswer(answer = "") {
  return /\b(traduction|translation|prix|price|cours|quote|meteo|weather|temperature|actuellement|currently|titre|title|liens|links|contenu visible|visible content|aucun lien visible|no visible links|boutons visibles|visible controls)\b/i.test(
    normalizeText(answer)
  ) || /[-+]?\d/.test(answer);
}

function countRepoMentions(answer = "") {
  const matches =
    String(answer || "").match(/\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b/g) || [];
  return [...new Set(matches)].length;
}

function hasGitHubResearchSignals(answer = "") {
  return /\b(pattern|patterns|architecture|stack|recommendation|recommandation|repo|repository|repositories|why they were kept|pourquoi ils ont ete retenus)\b/i.test(
    String(answer || "")
  );
}

function isVague(answer = "") {
  return /\b(it depends|ca depend|cela depend|general guidance|could you clarify|pourriez-vous preciser|request is vague|hard to say|difficile a dire)\b/i.test(
    normalizeText(answer)
  );
}

function hasHydriaIdentityMismatch(prompt = "", answer = "") {
  const normalizedPrompt = normalizeText(prompt);
  const normalizedAnswer = normalizeText(answer);
  if (
    !/\bhydria\b/.test(normalizedPrompt) ||
    !/\b(what is|what's|who are you|qui es tu|qu est|qu'est|explique|presente)\b/.test(
      normalizedPrompt
    )
  ) {
    return false;
  }

  return /\b(musique|musical|partition|choeur|choral|instrument)\b/.test(normalizedAnswer);
}

function hasHydriaIdentityGrounded(prompt = "", answer = "") {
  const normalizedPrompt = normalizeText(prompt);
  const normalizedAnswer = normalizeText(answer);
  if (
    !/\bhydria\b/.test(normalizedPrompt) ||
    !/\b(what is|what's|who are you|qui es tu|qu est|qu'est|explique|presente)\b/.test(
      normalizedPrompt
    )
  ) {
    return false;
  }

  return (
    /\b(orchestrateur|orchestrator)\b/.test(normalizedAnswer) &&
    /\b(local|modulaire|modular|agent|api|web|memoire|memory|outil|tool)\b/.test(
      normalizedAnswer
    )
  );
}

function scoreFactuality({
  classification,
  domain,
  prompt,
  finalAnswer,
  evidenceCount
}) {
  let score = evidenceCount > 0 ? 16 : 10;
  const normalized = normalizeText(finalAnswer);

  if (/\b(source|sources|according to|selon|open-meteo|github|stooq|duckduckgo|mymemory)\b/.test(normalized)) {
    score += 8;
  }

  if (classification === "data_lookup" && hasSourceSignal(finalAnswer) && looksLikeDirectLookupAnswer(finalAnswer)) {
    score += 4;
  }

  if (domain === "github_research" && countRepoMentions(finalAnswer) >= 2) {
    score += 4;
  }

  if (
    ["data_lookup", "hybrid_task", "compare", "reasoning", "coding"].includes(classification) &&
    /\b(i do not have access|je n'ai pas acces|no internet access|can't browse|cannot browse)\b/.test(
      normalized
    )
  ) {
    score -= 14;
  }

  if (hasHydriaIdentityMismatch(prompt, finalAnswer)) {
    score -= 18;
  }

  if (hasHydriaIdentityGrounded(prompt, finalAnswer)) {
    score += 8;
  }

  return clamp(score, 0, 30);
}

function scoreClarity({ classification, prompt, finalAnswer }) {
  const length = finalAnswer.trim().length;
  const normalized = normalizeText(finalAnswer);
  let score = 8;

  if (length >= 45) {
    score += 6;
  }

  if (length > 120 && length < 900) {
    score += 4;
  }

  if (classification === "simple_chat" && length > 650 && !/\b(explique|explain|details|detail)\b/i.test(prompt)) {
    score -= 6;
  }

  if (classification === "data_lookup") {
    if (length >= 25 && length <= 700) {
      score += 5;
    } else if (length < 25) {
      score -= 6;
    } else if (length > 1000 && !/\b(analyse|analyze|analysis|explique|explain|pourquoi|why)\b/i.test(prompt)) {
      score -= 4;
    }

    if (
      isBrowserPrompt(prompt) &&
      /\b(titre|title|liens principaux|main links|aucun lien visible|no visible links|boutons visibles|visible controls|contenu visible|visible content)\b/.test(
        normalized
      )
    ) {
      score += 4;
    }
  } else if (classification !== "simple_chat" && length < 170) {
    score -= 5;
  }

  if (isVague(finalAnswer)) {
    score -= 5;
  }

  return clamp(score, 0, 20);
}

function scoreUsefulness({ classification, prompt, finalAnswer, trace }) {
  const normalized = normalizeText(finalAnswer);
  const repoMentions = countRepoMentions(finalAnswer);
  let score = 8;

  if (
    classification === "coding" &&
    /\b(diagnostic|diagnosis|fix|correction|verification|patch|file|router|routeur|bug|issue)\b/.test(
      normalized
    )
  ) {
    score += 10;
  }

  if (
    classification === "coding" &&
    /\b(could you clarify|pourriez-vous preciser|demande est vague)\b/.test(normalized) &&
    trace.length > 0
  ) {
    score -= 10;
  }

  if (
    classification === "brainstorm" &&
    /^(\d+\.|- )/m.test(finalAnswer)
  ) {
    score += 8;
  }

  if (
    classification === "data_lookup" &&
    hasSourceSignal(finalAnswer) &&
    looksLikeDirectLookupAnswer(finalAnswer)
  ) {
    score += 8;
  }

  if (
    classification === "data_lookup" &&
    isBrowserPrompt(prompt) &&
    /\b(liens principaux|main links|aucun lien visible|no visible links|boutons visibles|visible controls|titre|title|contenu visible|visible content)\b/.test(
      normalized
    )
  ) {
    score += 8;
  }

  if (
    classification === "simple_chat" &&
    /\b(hydria|api|web|fichiers|files|outils|tools)\b/.test(normalized)
  ) {
    score += 6;
  }

  if (hasGitHubResearchSignals(finalAnswer)) {
    score += 4;
  }

  if (repoMentions >= 2) {
    score += 4;
  }

  if (
    ["complex_reasoning", "compare", "hybrid_task"].includes(classification) &&
    /\b(recommandation|recommendation|why|pourquoi|next steps|prochaines etapes|risks|risques)\b/.test(
      normalized
    )
  ) {
    score += 8;
  }

  if (isVague(finalAnswer)) {
    score -= 6;
  }

  return clamp(score, 0, 25);
}

function scoreStructure({ classification, finalAnswer }) {
  let score = 3;

  if (classification === "github_research") {
    if (hasStructuredMarkers(finalAnswer)) {
      score += 6;
    }

    if (
      /\b(meilleurs repos|best repositories|architecture detectee|detected architecture|patterns reutilisables|reusable patterns|recommandation finale|final recommendation)\b/i.test(
        finalAnswer
      )
    ) {
      score += 7;
    } else {
      score -= 3;
    }

    return clamp(score, 0, 15);
  }

  if (classification === "data_lookup") {
    if (hasStructuredMarkers(finalAnswer)) {
      score += 5;
    }

    if (hasSourceSignal(finalAnswer) || /\n/.test(finalAnswer)) {
      score += 4;
    }

    return clamp(score, 0, 15);
  }

  if (hasStructuredMarkers(finalAnswer)) {
    score += 6;
  }

  if (hasUsefulSectionLabels(finalAnswer)) {
    score += 6;
  }

  if (classification === "simple_chat" && /^#+\s/m.test(finalAnswer)) {
    score -= 5;
  }

  if (classification !== "simple_chat" && !hasStructuredMarkers(finalAnswer)) {
    score -= 4;
  }

  return clamp(score, 0, 15);
}

function scoreBrevity({ classification, prompt, finalAnswer }) {
  const length = finalAnswer.trim().length;
  let score = 6;

  if (classification === "github_research") {
    if (length >= 260 && length <= 2600) {
      score += 4;
    } else if (length < 220) {
      score -= 5;
    } else if (length > 3200) {
      score -= 4;
    }
  } else if (classification === "data_lookup") {
    if (length >= 30 && length <= 700) {
      score += 4;
    } else if (length < 20) {
      score -= 5;
    } else if (length > 1100 && !/\b(analyse|analyze|analysis|explique|explain|pourquoi|why)\b/i.test(prompt)) {
      score -= 4;
    }
  } else if (classification === "simple_chat") {
    if (length >= 40 && length <= 420) {
      score += 4;
    } else if (length > 700) {
      score -= 5;
    }
  } else if (classification === "brainstorm") {
    if (length >= 220 && length <= 1800) {
      score += 4;
    } else if (length < 160) {
      score -= 4;
    }
  } else {
    if (length >= 160 && length <= 2200) {
      score += 4;
    } else if (length < 140) {
      score -= 5;
    }
  }

  if (/\b(court|bref|brief|short)\b/i.test(prompt) && length > 900) {
    score -= 4;
  }

  return clamp(score, 0, 10);
}

function scoreExecutionQuality(trace = [], plan = {}) {
  const successSteps = countSuccessfulSteps(trace);
  const failedSteps = countFailedSteps(trace);
  const planDepth = plan?.steps?.length || 0;
  return clamp(successSteps * 2 + Math.min(planDepth, 4) - failedSteps * 4, 0, 10);
}

function average(values = []) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function scoreLearningValue({
  learningUsed = [],
  learningCreated = [],
  improvementDelta = 0,
  classification = "simple_chat",
  domain = ""
}) {
  const effectiveDomain = domain || classification;
  let score = 0;
  const learningUsedCount = learningUsed.length;
  const learningCreatedCount = learningCreated.length;
  const avgFinalScore = average(learningUsed.map((item) => item.finalScore));
  const avgContextualScore = average(learningUsed.map((item) => item.contextualScore));
  const avgGenericityPenalty = average(learningUsed.map((item) => item.genericityPenalty));
  const strongDomainMatches = learningUsed.filter(
    (item) => item.domainMatch === "strong" || item.domainMatch === "medium"
  ).length;
  const internalMatches = learningUsed.filter((item) => item.projectType === "internal").length;
  const externalMatches = learningUsed.filter((item) => item.projectType === "external").length;

  if (learningUsedCount > 0) {
    score += Math.min(learningUsedCount * 2, 4);
    if (avgFinalScore >= 18) {
      score += 3;
    } else if (avgFinalScore >= 12) {
      score += 2;
    } else {
      score -= 2;
    }

    if (avgContextualScore >= 4.5) {
      score += 2;
    } else if (avgContextualScore < 2) {
      score -= 2;
    }

    if (strongDomainMatches > 0) {
      score += Math.min(strongDomainMatches, 2);
    } else {
      score -= 2;
    }

    if (avgGenericityPenalty >= 5) {
      score -= 4;
    } else if (avgGenericityPenalty >= 3.5) {
      score -= 2;
    } else if (avgGenericityPenalty <= 2.2) {
      score += 1;
    }

    if (effectiveDomain === "github_research" && externalMatches > 0) {
      score += 1;
    }

    if (["coding", "reasoning", "compare"].includes(effectiveDomain) && internalMatches > 0) {
      score += 1;
    }
  } else if (["coding", "github_research", "reasoning", "compare"].includes(effectiveDomain)) {
    score -= 3;
  }

  if (learningCreatedCount > 0) {
    score += Math.min(learningCreatedCount, 3);
  }

  if (improvementDelta > 0) {
    score += Math.min(4, Math.round(improvementDelta / 2));
  }

  return clamp(score, -4, 10);
}

export function scoreExecution({
  classification = "simple_chat",
  domain = "",
  prompt = "",
  finalAnswer = "",
  plan = {},
  trace = [],
  candidateCount = 0,
  evidenceCount = 0,
  learningUsed = [],
  learningCreated = [],
  improvementDelta = 0
}) {
  const effectiveDomain = domain || classification;
  const factuality = scoreFactuality({
    classification: effectiveDomain,
    domain: effectiveDomain,
    prompt,
    finalAnswer,
    evidenceCount: evidenceCount + Math.min(candidateCount, 2)
  });
  const clarity = scoreClarity({
    classification: effectiveDomain,
    prompt,
    finalAnswer
  });
  const usefulness = scoreUsefulness({
    classification: effectiveDomain,
    prompt,
    finalAnswer,
    trace
  });
  const structure = scoreStructure({
    classification: effectiveDomain,
    finalAnswer
  });
  const brevity = scoreBrevity({
    classification: effectiveDomain,
    prompt,
    finalAnswer
  });
  const executionQuality = scoreExecutionQuality(trace, plan);
  const learning = scoreLearningValue({
    learningUsed,
    learningCreated,
    improvementDelta,
    classification: effectiveDomain,
    domain: effectiveDomain
  });
  const identity = hasHydriaIdentityGrounded(prompt, finalAnswer)
    ? 5
    : hasHydriaIdentityMismatch(prompt, finalAnswer)
      ? -10
      : 0;

  const score = clamp(
    factuality +
      clarity +
      usefulness +
      structure +
      brevity +
      executionQuality +
      learning +
      identity,
    0,
    100
  );

  return {
    score,
    dimensions: {
      factuality,
      clarity,
      usefulness,
      structure,
      brevity,
      executionQuality,
      learning,
      identity
    }
  };
}

export default {
  scoreExecution
};
