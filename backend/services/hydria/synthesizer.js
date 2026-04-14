import { judgeCandidates } from "./judgeService.js";
import { buildLocalFallbackAnswer } from "./localFallbackService.js";
import { buildStructuredFallbackFromCandidates } from "./qualityBoostService.js";
import {
  appendShortSourceNote,
  buildPresentedAnswer,
  shouldPreferPresentedAnswer
} from "./responsePresentationService.js";

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.type}:${candidate.provider || candidate.model || ""}:${candidate.content || candidate.summaryText || ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildSources(candidates) {
  return candidates.map((candidate) => ({
    type: candidate.type,
    provider: candidate.provider || candidate.sourceName || "unknown",
    model: candidate.model || null,
    capability: candidate.capability || null
  }));
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectLanguage(prompt = "") {
  return /\b(le|la|les|des|une|un|pour|avec|sans|resume|compar|pourquoi|comment|strategie|etapes|liste|tableau|cours|action|traduis|traduction|idee|idees|projet)\b/.test(
    normalizeText(prompt)
  )
    ? "fr"
    : "en";
}

function looksLikeEnglish(text = "") {
  return /\b(the|with|source|analysis|evidence|direct answer|trading around|according to|next steps)\b/i.test(
    String(text || "")
  );
}

function hasMeaningfulDifference(primaryText, secondaryText) {
  const primary = normalizeText(primaryText);
  const secondary = normalizeText(secondaryText);
  if (!primary || !secondary) {
    return false;
  }

  return primary !== secondary && !primary.includes(secondary) && !secondary.includes(primary);
}

function truncateText(text, maxChars = 260) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 3)}...`;
}

function groupAttachmentEvidence(evidence = []) {
  const grouped = new Map();

  for (const item of evidence) {
    const existing = grouped.get(item.filename) || [];
    existing.push(item);
    grouped.set(item.filename, existing);
  }

  return [...grouped.entries()].map(([filename, items]) => ({
    filename,
    items: items.sort((left, right) => right.score - left.score)
  }));
}

function buildAttachmentFallback(context) {
  const groupedEvidence = groupAttachmentEvidence(context.attachmentEvidenceUsed || []);
  const attachmentNames = (context.attachments || []).map((attachment) => attachment.originalName);
  const language = detectLanguage(context.prompt);

  if (!groupedEvidence.length) {
    return language === "fr"
      ? `Hydria a traite les fichiers joints mais aucune reponse modele exploitable n'etait disponible. Fichiers traites: ${attachmentNames.join(", ")}.`
      : `Hydria processed the attached files but no usable model answer was available. Processed attachments: ${attachmentNames.join(", ")}.`;
  }

  const lines = groupedEvidence.slice(0, 4).flatMap(({ filename, items }) =>
    items.slice(0, 2).map(
      (item, index) =>
        `- ${index === 0 ? filename : `${filename} (additional evidence)`} | ${item.sectionTitle}: ${truncateText(item.excerpt || item.text, 260)}`
    )
  );

  if (language === "fr") {
    return [
      "Hydria renvoie les extraits les plus pertinents car aucune synthese modele fiable n'etait disponible.",
      "Preuves extraites:",
      ...lines
    ].join("\n");
  }

  return [
    "Hydria is returning the most relevant extracted evidence because no reliable model synthesis was available.",
    "Extracted evidence:",
    ...lines
  ].join("\n");
}

function buildGenericFailure(context, judge = null) {
  const presentedAnswer = buildPresentedAnswer(context);
  if (presentedAnswer) {
    return {
      finalAnswer: presentedAnswer,
      sources: [],
      selectedCandidates: [],
      judge
    };
  }

  const localFallback = buildLocalFallbackAnswer(context);
  if (localFallback) {
    return {
      finalAnswer: localFallback,
      sources: [],
      selectedCandidates: [],
      judge
    };
  }

  const structuredFallback = buildStructuredFallbackFromCandidates([], context);
  if (structuredFallback) {
    return {
      finalAnswer: structuredFallback,
      sources: [],
      selectedCandidates: [],
      judge
    };
  }

  if (context.attachments?.length) {
    return {
      finalAnswer: buildAttachmentFallback(context),
      sources: [],
      selectedCandidates: [],
      judge
    };
  }

  const language = detectLanguage(context.prompt);
  return {
    finalAnswer:
      language === "fr"
        ? "Hydria n'a pas pu produire de reponse finale exploitable. Ajoute une source concrete, un fichier, une URL, une API ou reessaie quand le quota free est disponible."
        : "Hydria could not produce a usable final answer. Add a concrete source, file, URL, API, or retry when the free quota is available.",
    sources: [],
    selectedCandidates: [],
    judge
  };
}

export function synthesizeAnswers(candidates, context = {}) {
  const validCandidates = dedupeCandidates(
    (candidates || []).filter(
      (candidate) =>
        candidate &&
        (candidate.content || candidate.summaryText) &&
        candidate.success !== false
    )
  );

  if (!validCandidates.length) {
    return buildGenericFailure(context, {
      usedJudge: false,
      mode: "heuristic",
      score: 0,
      confidence: "low",
      decision: "fallback",
      issues: ["no_candidates"],
      candidateEvaluations: []
    });
  }

  const gitAgentCandidate = validCandidates.find(
    (candidate) =>
      candidate.type === "tool" &&
      (candidate.provider === "git_agent" || candidate.sourceName === "Git Agent")
  );

  if (
    gitAgentCandidate &&
    (
      context.domainProfile?.id === "github_research" ||
      /\b(github|repo|repos|repository|repositories|open source|code examples?)\b/i.test(
        String(context.prompt || "")
      )
    )
  ) {
    return {
      finalAnswer: gitAgentCandidate.summaryText || gitAgentCandidate.content,
      sources: buildSources(validCandidates),
      selectedCandidates: validCandidates,
      judge: {
        usedJudge: false,
        mode: "heuristic",
        score: 72,
        confidence: "medium",
        decision: "prefer_git_agent",
        issues: [],
        candidateEvaluations: []
      }
    };
  }

  const judge = judgeCandidates(validCandidates, context);
  const ranked = judge.rankedCandidates;

  if (!ranked.length) {
    return buildGenericFailure(context, judge);
  }

  const evidenceCandidates = ranked.filter((candidate) =>
    ["api", "web", "tool"].includes(candidate.type)
  );
  const llmCandidates = ranked.filter((candidate) => candidate.type === "llm");
  const sources = buildSources(ranked);
  const presentedAnswer = buildPresentedAnswer(context);

  if (judge.shouldUseStructuredFallback && evidenceCandidates.length) {
    const structuredFallback = buildStructuredFallbackFromCandidates(
      evidenceCandidates,
      context
    );
    const finalAnswer =
      context.classification === "compare"
        ? ((context.webResults?.length ? presentedAnswer || structuredFallback : structuredFallback || presentedAnswer) ||
          (evidenceCandidates[0].summaryText || evidenceCandidates[0].content))
        : context.classification === "coding" && context.toolResults?.length
          ? presentedAnswer || structuredFallback || (evidenceCandidates[0].summaryText || evidenceCandidates[0].content)
        : presentedAnswer || structuredFallback || (evidenceCandidates[0].summaryText || evidenceCandidates[0].content);

    return {
      finalAnswer,
      sources,
      selectedCandidates: ranked,
      judge
    };
  }

  if (ranked.length === 1) {
    const candidate = ranked[0];
    const baseText = candidate.content || candidate.summaryText;
    const finalAnswer =
      candidate.type === "llm" && evidenceCandidates.length
        ? appendShortSourceNote(baseText, context)
        : candidate.type !== "llm"
          ? (context.classification === "compare"
              ? (context.webResults?.length
                  ? presentedAnswer || buildStructuredFallbackFromCandidates(ranked, context)
                  : buildStructuredFallbackFromCandidates(ranked, context) || presentedAnswer)
              : context.classification === "coding" && context.toolResults?.length
                ? presentedAnswer || buildStructuredFallbackFromCandidates(ranked, context)
              : presentedAnswer || buildStructuredFallbackFromCandidates(ranked, context)) ||
            baseText
          : baseText;

    return {
      finalAnswer,
      sources,
      selectedCandidates: ranked,
      judge
    };
  }

  if (evidenceCandidates.length && llmCandidates.length) {
    const primaryLlm = llmCandidates[0];
    const promptLanguage = detectLanguage(context.prompt);
    if (presentedAnswer && shouldPreferPresentedAnswer(context)) {
      return {
        finalAnswer: presentedAnswer,
        sources,
        selectedCandidates: ranked,
        judge
      };
    }

    if (
      presentedAnswer &&
      promptLanguage === "fr" &&
      looksLikeEnglish(primaryLlm.content) &&
      ["data_lookup", "hybrid_task"].includes(context.classification)
    ) {
      return {
        finalAnswer: presentedAnswer,
        sources,
        selectedCandidates: ranked,
        judge
      };
    }

    if (judge.score >= 58 && !judge.shouldUseStructuredFallback) {
      return {
        finalAnswer: appendShortSourceNote(primaryLlm.content, context),
        sources,
        selectedCandidates: ranked,
        judge
      };
    }

    return {
      finalAnswer:
        presentedAnswer ||
        appendShortSourceNote(primaryLlm.content, context) ||
        buildStructuredFallbackFromCandidates(evidenceCandidates, context) ||
        primaryLlm.content,
      sources,
      selectedCandidates: ranked,
      judge
    };
  }

  const primary = ranked[0];
  const secondary = ranked[1];
  const primaryText = primary.content || primary.summaryText;
  const secondaryText = secondary?.content || secondary?.summaryText || "";
  const language = detectLanguage(context.prompt);

  const combined =
    judge.shouldCombine &&
    secondary &&
    hasMeaningfulDifference(primaryText, secondaryText)
      ? `${primaryText}\n\n${language === "fr" ? "Angle complementaire" : "Additional angle"}:\n${secondaryText}`
      : primaryText;

  return {
    finalAnswer: combined,
    sources,
    selectedCandidates: ranked,
    judge
  };
}
