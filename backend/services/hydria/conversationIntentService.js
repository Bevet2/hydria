import { detectApiNeed } from "../apis/apiRouter.js";
import { isArtifactGenerationPrompt } from "../artifacts/generationIntentService.js";
import { detectTooling } from "../tools/toolRouter.js";
import { detectWebNeed } from "../web/webIntentService.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanPrompt(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasExplicitIntent(prompt = "", attachments = []) {
  const apiNeed = detectApiNeed(prompt);
  const webNeed = detectWebNeed(prompt, apiNeed);
  const toolNeed = detectTooling(prompt, "", attachments);

  return (
    Boolean(apiNeed) ||
    Boolean(webNeed) ||
    Boolean(toolNeed?.useTools) ||
    isArtifactGenerationPrompt(prompt) ||
    attachments.length > 0
  );
}

function tokenizePrompt(prompt = "") {
  return normalizeText(cleanPrompt(prompt)).split(/\s+/).filter(Boolean);
}

function extractLocationValue(prompt = "") {
  return cleanPrompt(prompt)
    .replace(/^(et\s+)?(?:a|à|au|aux|en|pour|sur)\s+/i, "")
    .replace(/^(ville|city)\s+/i, "")
    .replace(/[?.!,;]+$/g, "")
    .trim();
}

function extractSymbolValue(prompt = "") {
  const cleaned = cleanPrompt(prompt)
    .replace(/^\$/, "")
    .replace(/[?.!,;]+$/g, "")
    .trim();
  const candidates = cleaned.match(/[A-Za-z0-9.-]{2,10}/g) || [];
  const stopwords = new Set(["ET", "LE", "LA", "LES", "DE", "DU", "DES", "ACTION", "PRIX"]);
  const extracted = candidates
    .map((candidate) => candidate.toUpperCase())
    .filter((candidate) => !stopwords.has(candidate))
    .at(-1);

  return extracted || cleaned.toUpperCase();
}

function extractLanguageValue(prompt = "") {
  return cleanPrompt(prompt)
    .replace(/^(et\s+)?(?:en|to)\s+/i, "")
    .replace(/[?.!,;]+$/g, "")
    .trim();
}

function isLowInformationReply(prompt = "") {
  const cleaned = cleanPrompt(prompt);
  const tokens = tokenizePrompt(cleaned);

  if (!cleaned || cleaned.length > 32) {
    return false;
  }

  return tokens.length <= 3;
}

function isDiscourseReply(prompt = "") {
  const normalized = normalizeText(cleanPrompt(prompt)).replace(/\s+/g, " ");
  return /^(oui|ouais|ok|okay|yes|yep|go|continue|continuez|vas y|vas-y|vasy|daccord|d accord)$/i.test(
    normalized
  );
}

function isNegativeReply(prompt = "") {
  const normalized = normalizeText(cleanPrompt(prompt));
  return /^(non|no|nop|nope|annule|cancel|laisse|stop|pas besoin|non merci)$/i.test(
    normalized
  );
}

function looksLikeLocationValue(cleaned = "", normalized = "", tokens = []) {
  const location = extractLocationValue(cleaned);

  if (!location || location.length > 80 || tokens.length > 5) {
    return false;
  }

  if (isDiscourseReply(cleaned)) {
    return false;
  }

  if (hasExplicitIntent(cleaned)) {
    return false;
  }

  return !/\b(meteo|weather|forecast|temperature|prix|price|crypto|news|actualite|recherche|search|traduis|translate|url|compare|resume|debug|code)\b/.test(
    normalizeText(location)
  );
}

function looksLikeSymbolValue(cleaned = "", normalized = "", tokens = []) {
  const symbol = extractSymbolValue(cleaned);

  if (!symbol || symbol.length > 12 || tokens.length > 2) {
    return false;
  }

  if (isDiscourseReply(cleaned)) {
    return false;
  }

  if (hasExplicitIntent(cleaned)) {
    return false;
  }

  return /^[a-z0-9.\-]{1,10}$/i.test(symbol) && !/\s/.test(symbol) && normalized !== "action";
}

function looksLikeTopicValue(cleaned = "", normalized = "", tokens = []) {
  if (!cleaned || cleaned.length > 100 || tokens.length > 8) {
    return false;
  }

  if (isDiscourseReply(cleaned)) {
    return false;
  }

  if (hasExplicitIntent(cleaned)) {
    return false;
  }

  return !/^(oui|ok|go|merci|thanks)$/i.test(normalized);
}

function looksLikeSlotValue(prompt = "", action = {}) {
  const cleaned = cleanPrompt(prompt);
  const normalized = normalizeText(cleaned);
  const tokens = tokenizePrompt(cleaned);
  const slotType = action.slotType || action.slot;

  switch (slotType) {
    case "location":
      return looksLikeLocationValue(cleaned, normalized, tokens);
    case "symbol":
      return looksLikeSymbolValue(cleaned, normalized, tokens);
    case "topic":
    case "query":
    case "language":
      return looksLikeTopicValue(cleaned, normalized, tokens);
    default:
      return looksLikeTopicValue(cleaned, normalized, tokens);
  }
}

function extractSlotValue(prompt = "", action = {}) {
  const cleaned = cleanPrompt(prompt);
  const slotType = action.slotType || action.slot;

  switch (slotType) {
    case "location":
      return extractLocationValue(cleaned);
    case "symbol":
      return extractSymbolValue(cleaned);
    case "language":
      return extractLanguageValue(cleaned);
    default:
      return cleaned;
  }
}

function hasContextualCue(prompt = "") {
  const normalized = normalizeText(cleanPrompt(prompt)).replace(/\s+/g, " ");
  return /^(et|alors|sinon|du coup|pourquoi|comment|plus|moins|encore|resume|synthese|synthetise|synthesise|analyse|explique|detail|details|lequel|laquelle|recommande|et si|plutot|maintenant|vasy|vas y|vas-y|ok|okay|oui|continue|fais|fait)\b/.test(
    normalized
  );
}

function buildPreviousPrompt(latestExecution = null) {
  return cleanPrompt(
    latestExecution?.execution_plan?.basePrompt ||
      latestExecution?.execution_plan?.resolvedPrompt ||
      latestExecution?.execution_plan?.originalPrompt ||
      ""
  );
}

function canUseContextualContinuation(
  prompt = "",
  latestExecution = null,
  attachments = []
) {
  const cleaned = cleanPrompt(prompt);
  const tokens = tokenizePrompt(cleaned);
  const previousPrompt = buildPreviousPrompt(latestExecution);
  const previousClassification =
    latestExecution?.classification || latestExecution?.execution_plan?.classification || "";

  if (!cleaned || attachments.length || !previousPrompt || !previousClassification) {
    return false;
  }

  if (previousClassification === "simple_chat") {
    return false;
  }

  if (cleaned.length > 140 || tokens.length > 14 || /https?:\/\//i.test(cleaned)) {
    return false;
  }

  return hasContextualCue(cleaned) || isLowInformationReply(cleaned);
}

function buildContextualResolvedPrompt(prompt = "", latestExecution = null) {
  const previousPrompt = buildPreviousPrompt(latestExecution);
  const cleaned = cleanPrompt(prompt);

  if (!previousPrompt || !cleaned) {
    return "";
  }

  return `${previousPrompt}\n\nSuivi utilisateur: ${cleaned}`;
}

function applyTemplate(templatePrompt = "", values = {}) {
  return String(templatePrompt || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    cleanPrompt(values[key] || "")
  );
}

function resolvePendingAction(prompt, pendingActions = []) {
  const cleanedPrompt = cleanPrompt(prompt);
  if (!pendingActions.length || !cleanedPrompt) {
    return null;
  }

  for (const action of pendingActions) {
    if (action.kind === "slot_fill" && looksLikeSlotValue(cleanedPrompt, action)) {
      const slotValue = extractSlotValue(cleanedPrompt, action);

      return {
        resolvedPrompt: applyTemplate(action.templatePrompt, {
          [action.slot]: slotValue
        }),
        usedHistory: true,
        reason: `completed_${action.id}`
      };
    }

    if (
      action.kind === "direct_prompt" &&
      (isDiscourseReply(cleanedPrompt) ||
        isLowInformationReply(cleanedPrompt) ||
        (hasContextualCue(cleanedPrompt) && cleanedPrompt.length <= 96)) &&
      !isNegativeReply(cleanedPrompt)
    ) {
      return {
        resolvedPrompt: action.resolvedPrompt,
        usedHistory: true,
        reason: `accepted_${action.id}`
      };
    }
  }

  return null;
}

export function resolveConversationalRouting({
  prompt = "",
  attachments = [],
  latestExecution = null
}) {
  const cleanCurrentPrompt = cleanPrompt(prompt);

  if (!cleanCurrentPrompt) {
    return {
      resolvedPrompt: cleanCurrentPrompt,
      usedHistory: false,
      reason: ""
    };
  }

  if (hasExplicitIntent(cleanCurrentPrompt, attachments)) {
    return {
      resolvedPrompt: cleanCurrentPrompt,
      usedHistory: false,
      reason: ""
    };
  }

  const pendingActions = latestExecution?.execution_plan?.followUpActions || [];
  const pendingResolution = resolvePendingAction(cleanCurrentPrompt, pendingActions);

  if (pendingResolution) {
    return {
      ...pendingResolution,
      previousPrompt: latestExecution?.execution_plan?.originalPrompt || ""
    };
  }

  if (canUseContextualContinuation(cleanCurrentPrompt, latestExecution, attachments)) {
    return {
      resolvedPrompt: buildContextualResolvedPrompt(cleanCurrentPrompt, latestExecution),
      usedHistory: true,
      reason: `contextual_follow_up_${latestExecution?.classification || "previous_turn"}`,
      previousPrompt: latestExecution?.execution_plan?.originalPrompt || ""
    };
  }

  return {
    resolvedPrompt: cleanCurrentPrompt,
    usedHistory: false,
    reason: ""
  };
}
