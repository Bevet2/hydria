export function buildReasoningCritiquePrompt({ prompt, domain, draft }) {
  return [
    `Task domain: ${domain || "general"}`,
    `Original task: ${prompt}`,
    "Review the draft answer. Identify what is missing, weak, vague, or risky.",
    "Return 3 short bullets only.",
    `Draft:\n${draft}`
  ].join("\n\n");
}

export function buildReasoningRefinePrompt({ prompt, domain, draft, critique }) {
  return [
    `Task domain: ${domain || "general"}`,
    `Original task: ${prompt}`,
    "Improve the draft using the critique. Keep the answer concrete, reliable, and concise.",
    `Draft:\n${draft}`,
    `Critique:\n${critique}`
  ].join("\n\n");
}

export default {
  buildReasoningCritiquePrompt,
  buildReasoningRefinePrompt
};
