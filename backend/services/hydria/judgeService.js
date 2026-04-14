function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value = "") {
  return normalizeText(value)
    .split(/[^a-z0-9_+-]+/i)
    .filter((token) => token.length > 2);
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function buildEvidenceCorpus(context = {}) {
  return normalizeText(
    [
      ...(context.attachments || []).map(
        (attachment) => `${attachment.originalName} ${attachment.excerpt || ""}`
      ),
      ...(context.attachmentEvidenceUsed || []).map(
        (item) => `${item.filename} ${item.sectionTitle} ${item.excerpt || ""}`
      ),
      ...(context.apiResults || []).map(
        (result) => `${result.sourceName} ${result.summaryText || ""}`
      )
    ].join("\n")
  );
}

function hasUnsupportedSecurityClaims(text, context) {
  if (context.classification !== "coding") {
    return false;
  }

  const normalized = normalizeText(text);
  if (
    !/(xss|cross site scripting|sql injection|template injection|command injection|\brce\b|remote code execution)/i.test(
      normalized
    )
  ) {
    return false;
  }

  const evidenceCorpus = buildEvidenceCorpus(context);
  return !/(innerhtml|outerhtml|document\.|html|sql|query|select |insert |update |delete |exec\(|eval\(|script|dangerouslysetinnerhtml|template|render|shell|spawn|child_process|execfile)/i.test(
    evidenceCorpus
  );
}

function detectExpectedHeadings(context = {}) {
  const language = /\b(le|la|les|des|une|un|pour|avec|sans|resume|compar|pourquoi|comment|strategie|etapes|liste|tableau)\b/.test(
    normalizeText(context.prompt)
  )
    ? "fr"
    : "en";

  const byClassification = {
    coding: language === "fr" ? ["diagnostic", "correction", "verification"] : ["diagnosis", "fix", "verification"],
    summarize: language === "fr" ? ["resume", "points", "reserve"] : ["summary", "key points", "caveat"],
    compare: language === "fr" ? ["recommandation", "comparaison", "criteres"] : ["recommendation", "comparison", "criteria"],
    hybrid_task: language === "fr" ? ["reponse", "preuve", "analyse"] : ["direct answer", "evidence", "analysis"],
    data_lookup: language === "fr" ? ["reponse", "faits", "source"] : ["direct answer", "facts", "sources"],
    complex_reasoning: language === "fr" ? ["recommandation", "pourquoi", "risques", "prochaines etapes"] : ["recommendation", "why", "risks", "next steps"]
  };

  const packSpecific = {
    document_intelligence: language === "fr" ? ["fichier", "document", "preuve"] : ["document", "file", "evidence"],
    research_analyst: language === "fr" ? ["source", "lien", "url"] : ["source", "url", "link"],
    comparison_analyst: language === "fr" ? ["recommandation", "comparaison"] : ["recommendation", "comparison"],
    strategy_advisor: language === "fr" ? ["recommandation", "risques", "prochaines etapes"] : ["recommendation", "risks", "next steps"],
    data_grounded_answer: language === "fr" ? ["reponse", "faits", "donnees"] : ["direct answer", "facts", "data"]
  };

  return unique([
    ...(byClassification[context.classification] || []),
    ...(packSpecific[context.taskPack?.id] || [])
  ]);
}

function scorePromptCoverage(text, context) {
  const promptTokens = new Set(tokenize(context.prompt));
  const responseTokens = new Set(tokenize(text));
  const matched = [...promptTokens].filter((token) => responseTokens.has(token)).length;

  if (!promptTokens.size) {
    return 0;
  }

  return Math.min(18, Math.round((matched / promptTokens.size) * 18));
}

function scoreStructure(text, context, candidate) {
  const normalized = normalizeText(text);
  const expectedHeadings = detectExpectedHeadings(context);
  let score = 0;

  if (/\n/.test(text)) {
    score += 4;
  }

  if (/^[-*]\s/m.test(text) || /^\d+\.\s/m.test(text)) {
    score += 3;
  }

  if (/:\s*\n/.test(text) || /:\s*$/.test(text) || /^#+\s/m.test(text)) {
    score += 3;
  }

  const matchedHeadings = expectedHeadings.filter((heading) =>
    normalized.includes(heading)
  ).length;
  score += Math.min(8, matchedHeadings * 2);

  if (candidate.type !== "llm") {
    score = Math.min(score, 8);
  }

  return score;
}

function scoreGrounding(candidate, text, context) {
  const normalized = normalizeText(text);
  let score = 0;

  if (candidate.type === "api") {
    score += 12;
  } else if (candidate.type === "web") {
    score += 14;
  } else if (candidate.type === "tool") {
    score += 15;
  } else if (candidate.type === "llm") {
    score += 6;
  }

  if (/(https?:\/\/|www\.|source|sources|url|lien|according to|selon)/i.test(normalized)) {
    score += 6;
  }

  if (context.attachments?.length) {
    const mentionCount = context.attachments.filter((attachment) =>
      normalized.includes(normalizeText(attachment.originalName))
    ).length;
    score += Math.min(8, mentionCount * 2);
  }

  if (
    (context.apiResults || []).length &&
    candidate.type === "llm" &&
    /(price|weather|source|quote|result|donnee|data|api|temperature|vent|rain|pluie)/i.test(
      normalized
    )
  ) {
    score += 4;
  }

  if (
    (context.attachmentEvidenceUsed || []).length &&
    /(section|document|fichier|file|page|chunk)/i.test(normalized)
  ) {
    score += 3;
  }

  return score;
}

function scoreTaskPackFit(text, context) {
  const normalized = normalizeText(text);

  switch (context.taskPack?.id) {
    case "coding_copilot":
      return /(fix|patch|verification|diagnostic|debug|root cause|cause racine)/i.test(normalized)
        ? 8
        : 0;
    case "document_intelligence":
      return /(document|fichier|file|section|page|extrait|evidence|preuve)/i.test(normalized)
        ? 8
        : 0;
    case "research_analyst":
      return /(source|url|link|article|publication|according to|selon)/i.test(normalized)
        ? 8
        : 0;
    case "comparison_analyst":
      return /(recommend|recommand|better|tradeoff|strength|weakness|criteria|critere)/i.test(normalized)
        ? 8
        : 0;
    case "strategy_advisor":
      return /(recommend|recommand|risks|tradeoff|next steps|roadmap|plan d'action)/i.test(normalized)
        ? 8
        : 0;
    case "data_grounded_answer":
      return /(source|unit|metric|fact|timestamp|date|price|forecast|quote|score|temperature|vent|rain|pluie)/i.test(
        normalized
      )
        ? 8
        : 0;
    default:
      return 4;
  }
}

function scoreDirectness(text, context) {
  const firstLine = String(text || "").trim().split(/\n+/)[0] || "";

  if (!firstLine) {
    return 0;
  }

  if (
    ["data_lookup", "hybrid_task", "compare", "complex_reasoning"].includes(
      context.classification
    ) &&
    /(direct answer|reponse directe|recommendation|recommandation|diagnosis|diagnostic|summary|resume|a paris|in paris)/i.test(
      firstLine
    )
  ) {
    return 8;
  }

  if (firstLine.length <= 220) {
    return 4;
  }

  return 1;
}

function detectIssues(candidate, text, context) {
  const normalized = normalizeText(text);
  const issues = [];
  const attachmentsAvailable =
    (context.attachments || []).length > 0 &&
    (context.attachmentEvidenceUsed || []).length > 0;
  const evidenceHeavy =
    ["data_lookup", "hybrid_task"].includes(context.classification) ||
    ["research_analyst", "data_grounded_answer"].includes(context.taskPack?.id);

  if (
    /(cannot access|can't access|i cannot access|je ne peux pas acceder|je ne peux pas analyser les fichiers joints|as an ai, i cannot)/i.test(
      normalized
    )
  ) {
    issues.push("claims_it_cannot_access_inputs");
  }

  if (
    candidate.type === "llm" &&
    (context.plan?.apiNeed || context.plan?.webNeed) &&
    /(i do not have access|i don't have access|i do not have real-time data|i don't have real-time data|je n'ai pas acces|je n'ai pas de donnees en temps reel|cannot browse|can't browse|no internet access|pas d'acces a internet|pas acces aux donnees)/i.test(
      normalized
    )
  ) {
    issues.push("ignores_available_external_access");
  }

  if (hasUnsupportedSecurityClaims(text, context)) {
    issues.push("unsupported_security_claim");
  }

  if (attachmentsAvailable && candidate.type === "llm") {
    const mentionsAttachment = context.attachments.some((attachment) =>
      normalized.includes(normalizeText(attachment.originalName))
    );
    if (!mentionsAttachment && !/(document|fichier|file|section|page|piece jointe|attachment)/i.test(normalized)) {
      issues.push("ignores_attachment_evidence");
    }
  }

  if (
    evidenceHeavy &&
    candidate.type === "llm" &&
    !/(source|sources|url|lien|selon|according to|api|web|open-meteo|binance|coincap)/i.test(
      normalized
    )
  ) {
    issues.push("weak_source_grounding");
  }

  if (candidate.type === "llm" && normalizeText(text).length < 120) {
    issues.push("too_short");
  }

  if (candidate.type === "llm" && !scoreStructure(text, context, candidate)) {
    issues.push("weak_structure");
  }

  if (/it depends|ca depend|cela depend|hard to say|difficile a dire|maybe|peut etre/i.test(normalized)) {
    issues.push("too_generic");
  }

  if (
    context.classification === "compare" &&
    !/(compare|compar|better|tradeoff|strength|weakness|recommend|recommand)/i.test(
      normalized
    )
  ) {
    issues.push("missing_comparison_shape");
  }

  return unique(issues);
}

function detectStrengths(candidate, text, context) {
  const normalized = normalizeText(text);
  const strengths = [];

  if (candidate.type !== "llm") {
    strengths.push("grounded_source");
  }

  if (scoreStructure(text, context, candidate) >= 6) {
    strengths.push("structured");
  }

  if (/(source|sources|url|lien|according to|selon|open-meteo|binance|coincap)/i.test(normalized)) {
    strengths.push("source_citations");
  }

  if (context.attachments?.some((attachment) => normalized.includes(normalizeText(attachment.originalName)))) {
    strengths.push("uses_attachments");
  }

  if (scorePromptCoverage(text, context) >= 8) {
    strengths.push("relevant");
  }

  return unique(strengths);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function buildConfidence(score) {
  if (score >= 82) {
    return "high";
  }

  if (score >= 64) {
    return "medium";
  }

  return "low";
}

function buildGlobalIssues(evaluations, context) {
  const issues = [];
  const accepted = evaluations.filter((evaluation) => !evaluation.rejected);
  const llmAccepted = accepted.filter((evaluation) => evaluation.candidate.type === "llm");
  const nonLlmAccepted = accepted.filter((evaluation) => evaluation.candidate.type !== "llm");

  if (!accepted.length) {
    issues.push("no_candidate_survived_judge");
  }

  if (
    (context.attachments || []).length &&
    !accepted.some((evaluation) => evaluation.strengths.includes("uses_attachments"))
  ) {
    issues.push("attachment_evidence_underused");
  }

  if (
    ["research_analyst", "data_grounded_answer"].includes(context.taskPack?.id) &&
    !nonLlmAccepted.length &&
    !accepted.some((evaluation) => evaluation.strengths.includes("source_citations"))
  ) {
    issues.push("limited_source_citations");
  }

  if (llmAccepted.length && llmAccepted.every((evaluation) => evaluation.score < 64)) {
    issues.push("llm_candidates_weak");
  }

  return unique(issues);
}

function formatDecision(bestEvaluation, secondEvaluation) {
  if (!bestEvaluation) {
    return "fallback";
  }

  if (bestEvaluation.score < 60) {
    return "fallback";
  }

  if (
    secondEvaluation &&
    !secondEvaluation.rejected &&
    Math.abs(bestEvaluation.score - secondEvaluation.score) <= 8
  ) {
    return "combine";
  }

  return "select_best";
}

export function judgeCandidates(candidates = [], context = {}) {
  const evaluations = candidates.map((candidate, index) => {
    const text = String(candidate.content || candidate.summaryText || "");
    const issues = detectIssues(candidate, text, context);
    const strengths = detectStrengths(candidate, text, context);
    const rawScore =
      scorePromptCoverage(text, context) +
      scoreStructure(text, context, candidate) +
      scoreGrounding(candidate, text, context) +
      scoreTaskPackFit(text, context) +
      scoreDirectness(text, context);

    const penalty =
      (issues.includes("claims_it_cannot_access_inputs") ? 36 : 0) +
      (issues.includes("ignores_available_external_access") ? 30 : 0) +
      (issues.includes("unsupported_security_claim") ? 28 : 0) +
      (issues.includes("ignores_attachment_evidence") ? 12 : 0) +
      (issues.includes("weak_source_grounding") ? 10 : 0) +
      (issues.includes("too_short") ? 6 : 0) +
      (issues.includes("weak_structure") ? 6 : 0) +
      (issues.includes("too_generic") ? 8 : 0) +
      (issues.includes("missing_comparison_shape") ? 8 : 0);

    const score = clampScore(rawScore + (candidate.type === "llm" ? 12 : 18) - penalty);
    const rejected =
      issues.includes("claims_it_cannot_access_inputs") ||
      issues.includes("ignores_available_external_access") ||
      issues.includes("unsupported_security_claim");

    return {
      index,
      candidate,
      score,
      confidence: buildConfidence(score),
      issues,
      strengths,
      rejected
    };
  });

  const rankedEvaluations = [...evaluations].sort((left, right) => right.score - left.score);
  const acceptedEvaluations = rankedEvaluations.filter((evaluation) => !evaluation.rejected);
  const bestEvaluation = acceptedEvaluations[0] || rankedEvaluations[0] || null;
  const secondEvaluation = acceptedEvaluations[1] || rankedEvaluations[1] || null;
  const issues = buildGlobalIssues(rankedEvaluations, context);
  const hasNonLlmAccepted = acceptedEvaluations.some(
    (evaluation) => evaluation.candidate.type !== "llm"
  );

  return {
    usedJudge: true,
    mode: "heuristic",
    score: bestEvaluation?.score || 0,
    confidence: bestEvaluation?.confidence || "low",
    decision: formatDecision(bestEvaluation, secondEvaluation),
    issues,
    shouldUseStructuredFallback:
      !bestEvaluation ||
      bestEvaluation.score < 60 ||
      issues.includes("attachment_evidence_underused") ||
      (issues.includes("llm_candidates_weak") && !hasNonLlmAccepted),
    shouldCombine:
      formatDecision(bestEvaluation, secondEvaluation) === "combine",
    rankedCandidates: acceptedEvaluations.map((evaluation) => evaluation.candidate),
    candidateEvaluations: rankedEvaluations.map((evaluation) => ({
      index: evaluation.index,
      type: evaluation.candidate.type,
      provider: evaluation.candidate.provider || evaluation.candidate.sourceName || "unknown",
      model: evaluation.candidate.model || null,
      purpose: evaluation.candidate.purpose || evaluation.candidate.capability || null,
      score: evaluation.score,
      confidence: evaluation.confidence,
      issues: evaluation.issues,
      strengths: evaluation.strengths,
      rejected: evaluation.rejected
    }))
  };
}
