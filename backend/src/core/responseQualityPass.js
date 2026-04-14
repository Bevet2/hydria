import {
  appendShortSourceNote,
  buildPresentedAnswer
} from "../../services/hydria/responsePresentationService.js";
import { buildFinalUserAnswer } from "../presentation/finalAnswerBuilder.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanAnswer(value = "") {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function splitSentences(value = "") {
  return cleanAnswer(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasListOrSections(value = "") {
  return /^[-*]\s/m.test(value) || /^\d+\.\s/m.test(value) || /^#+\s/m.test(value);
}

function looksVague(value = "") {
  return /\b(it depends|ca depend|cela depend|general guidance|pourriez-vous preciser|could you clarify|difficile a dire|hard to say|request is vague)\b/i.test(
    normalizeText(value)
  );
}

function ensureNumberedIdeas(value = "") {
  if (/^\d+\.\s/m.test(value) || /^[-*]\s/m.test(value)) {
    return value;
  }

  const sentences = splitSentences(value).slice(0, 6);
  if (sentences.length < 3) {
    return value;
  }

  return sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join("\n");
}

function compactSimpleChat(value = "", prompt = "") {
  if (hasListOrSections(value) && /\b(que peux tu faire|what can you do|capabilities|fonctionnalites|capacites)\b/i.test(prompt)) {
    return value;
  }

  let answer = cleanAnswer(value)
    .replace(/^(reponse directe|direct answer|recommendation|recommandation)\s*:?\s*/i, "")
    .replace(/^#+\s+/gm, "")
    .trim();

  const sentences = splitSentences(answer);
  if (sentences.length > 3 && !/\b(explique|explain|detail|details|pourquoi|why|comment)\b/i.test(prompt)) {
    answer = sentences.slice(0, 3).join(" ");
  }

  return answer;
}

function structureReasoning(value = "", language = "fr") {
  if (hasListOrSections(value)) {
    return cleanAnswer(value);
  }

  const sentences = splitSentences(value);
  if (sentences.length < 3) {
    return cleanAnswer(value);
  }

  const recommendation = sentences[0];
  const why = sentences.slice(1, 3);
  const caveat = sentences.slice(3, 4);

  return [
    language === "fr" ? "Recommandation" : "Recommendation",
    `- ${recommendation}`,
    language === "fr" ? "Pourquoi" : "Why",
    ...why.map((sentence) => `- ${sentence}`),
    caveat.length ? (language === "fr" ? "Limite" : "Caveat") : "",
    ...caveat.map((sentence) => `- ${sentence}`)
  ]
    .filter(Boolean)
    .join("\n");
}

function structureCoding(value = "", language = "fr") {
  if (
    hasListOrSections(value) &&
    /(diagnostic|diagnosis|verification|fix|correction|architecture recommandee|file structure|structure de fichiers|bonnes pratiques observees|amelioration proposee|prochaine etape)/i.test(
      value
    )
  ) {
    return cleanAnswer(value);
  }

  const sentences = splitSentences(value);
  if (sentences.length < 3) {
    return cleanAnswer(value);
  }

  return [
    language === "fr" ? "Diagnostic" : "Diagnosis",
    `- ${sentences[0]}`,
    language === "fr" ? "Correction concrete" : "Concrete fix",
    ...sentences.slice(1, 3).map((sentence) => `- ${sentence}`),
    language === "fr" ? "Verification" : "Verification",
    `- ${sentences[3] || (language === "fr" ? "Rejouer les checks et verifier le comportement en sortie." : "Replay the checks and verify the output behavior.")}`
  ].join("\n");
}

function structureGitHubResearch(value = "", language = "fr") {
  if (hasListOrSections(value) && /(repo|repository|pattern|recommend|recommand)/i.test(value)) {
    return cleanAnswer(value);
  }

  const sentences = splitSentences(value);
  if (sentences.length < 3) {
    return cleanAnswer(value);
  }

  return [
    language === "fr" ? "Patterns utiles" : "Useful patterns",
    ...sentences.slice(0, 3).map((sentence) => `- ${sentence}`),
    language === "fr" ? "Recommandation pour Hydria" : "Recommendation for Hydria",
    `- ${sentences[3] || sentences[0]}`
  ].join("\n");
}

export function inspectResponseQuality({ finalAnswer = "", context = {} } = {}) {
  const issues = [];
  const normalized = normalizeText(finalAnswer);
  const domain = context.domainProfile?.id || "simple_chat";

  if (!finalAnswer.trim()) {
    issues.push("missing_answer");
  }

  if (looksVague(finalAnswer)) {
    issues.push("vague_answer");
  }

  if (domain === "simple_chat" && /^#+\s/m.test(finalAnswer)) {
    issues.push("mechanical_simple_chat");
  }

  if (["coding", "reasoning", "github_research"].includes(domain) && !hasListOrSections(finalAnswer)) {
    issues.push("missing_structure");
  }

  if (domain === "simple_chat" && finalAnswer.length > 650) {
    issues.push("too_long_for_simple_chat");
  }

  if (["coding", "reasoning", "github_research"].includes(domain) && finalAnswer.length < 180) {
    issues.push("too_short_for_domain");
  }

  if (
    ["data_lookup", "reasoning", "github_research", "coding"].includes(domain) &&
    (context.apiResults?.length || context.webResults?.length || context.toolResults?.length) &&
    !/\b(source|sources|according to|selon|open-meteo|duckduckgo|github|stooq|mymemory)\b/.test(
      normalized
    )
  ) {
    issues.push("weak_source_signals");
  }

  return {
    domain,
    issues
  };
}

export function applyResponseQualityPass(synthesis = {}, context = {}) {
  if (!synthesis?.finalAnswer) {
    return {
      ...synthesis,
      qualityPass: {
        applied: false,
        domain: context.domainProfile?.id || "simple_chat",
        issues: ["missing_answer"]
      }
    };
  }

  const domain = context.domainProfile?.id || "simple_chat";
  const language = /\b(le|la|les|des|une|un|pour|avec|sans|bonjour|salut|merci|quel|quelle|comment)\b/i.test(
    normalizeText(context.prompt)
  )
    ? "fr"
    : "en";
  const finalBuilder = buildFinalUserAnswer({
    synthesis,
    context
  });
  const presentedAnswer = buildPresentedAnswer(context);
  let finalAnswer = cleanAnswer(finalBuilder.finalAnswer || synthesis.finalAnswer);
  const userFacingMode = finalBuilder.mode;

  if (userFacingMode === "delivery_result") {
    const qualityReport = inspectResponseQuality({
      finalAnswer,
      context
    });

    return {
      ...synthesis,
      finalAnswer,
      qualityPass: {
        applied: true,
        domain,
        issues: qualityReport.issues,
        mode: userFacingMode,
        debugTraceSummary: finalBuilder.debugTraceSummary
      }
    };
  }

  if (
    domain === "coding" &&
    presentedAnswer &&
    /\b(ui|ux|debug|routeur|router|rendu|preview|browser|localhost|bug|issue|fragile)\b/i.test(
      normalizeText(context.prompt)
    )
  ) {
    finalAnswer = presentedAnswer;
  } else if (domain === "simple_chat") {
    finalAnswer = compactSimpleChat(finalAnswer, context.prompt);
  } else if (domain === "reasoning") {
    finalAnswer = structureReasoning(finalAnswer, language);
  } else if (domain === "brainstorm") {
    finalAnswer = ensureNumberedIdeas(finalAnswer);
  } else if (domain === "github_research") {
    finalAnswer = structureGitHubResearch(finalAnswer, language);
  } else if (domain === "coding") {
    finalAnswer = structureCoding(finalAnswer, language);
  }

  if (
    !["solution_synthesis", "execution_result"].includes(finalBuilder.mode) &&
    domain !== "simple_chat" &&
    (context.apiResults?.length || context.webResults?.length || context.toolResults?.length)
  ) {
    finalAnswer = appendShortSourceNote(finalAnswer, context);
  }

  const qualityReport = inspectResponseQuality({
    finalAnswer,
    context
  });

  return {
    ...synthesis,
    finalAnswer,
    qualityPass: {
      applied: finalAnswer !== synthesis.finalAnswer || qualityReport.issues.length > 0,
      domain,
      issues: qualityReport.issues,
      mode: userFacingMode,
      debugTraceSummary: finalBuilder.debugTraceSummary
    }
  };
}

export default {
  applyResponseQualityPass,
  inspectResponseQuality
};
