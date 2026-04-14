import { buildPresentedAnswer, shouldPreferPresentedAnswer } from "../../services/hydria/responsePresentationService.js";
import { sanitizeUserFacingAnswer } from "./userFacingFormatter.js";
import { buildExecutionResultAnswer } from "./executionResultPresenter.js";
import { buildSolutionLimitNote, buildSolutionSynthesis } from "./solutionSynthesizer.js";
import { buildDebugTraceSummary } from "./debugTraceFormatter.js";

function joinSections(parts = []) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasProjectDelivery(context = {}) {
  return (context.toolResults || []).some(
    (result) =>
      result?.capability === "project_scaffold" &&
      result?.normalized?.delivery
  );
}

export function buildFinalUserAnswer({ synthesis = {}, context = {} } = {}) {
  const presentedAnswer = buildPresentedAnswer(context);
  const baseAnswer = synthesis.finalAnswer || "";
  const executionAnswer = buildExecutionResultAnswer({ context, synthesis });
  const solutionAnswer = buildSolutionSynthesis({
    baseAnswer,
    context,
    synthesis
  });
  const shouldPreferToolPresentation = shouldPreferPresentedAnswer(context);
  const chosen =
    executionAnswer ||
    solutionAnswer ||
    (shouldPreferToolPresentation ? presentedAnswer : baseAnswer) ||
    presentedAnswer ||
    baseAnswer;
  const limitNote = executionAnswer ? "" : buildSolutionLimitNote(context);
  const finalAnswer = sanitizeUserFacingAnswer(joinSections([chosen, limitNote]));

  return {
    finalAnswer,
    mode: executionAnswer
      ? hasProjectDelivery(context)
        ? "delivery_result"
        : "execution_result"
      : solutionAnswer
      ? "solution_synthesis"
      : shouldPreferToolPresentation
        ? "tool_presentation"
        : "candidate_synthesis",
    debugTraceSummary: buildDebugTraceSummary({
      context,
      synthesis
    })
  };
}

export default {
  buildFinalUserAnswer
};
