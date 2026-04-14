function truncate(value = "", maxChars = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

export function summarizeConversationWindow(events = []) {
  const summaryParts = [];

  for (const event of events.slice(-6)) {
    const role = event.role === "assistant" ? "assistant" : "user";
    summaryParts.push(`${role}: ${truncate(event.content, 140)}`);
  }

  return summaryParts.join(" | ");
}

export function buildMemoryRecallSummary(memoryRecall = {}) {
  const lines = [];

  if (memoryRecall.workingMemory?.summary) {
    lines.push(`working: ${memoryRecall.workingMemory.summary}`);
  }

  if (memoryRecall.midTerm?.length) {
    lines.push(
      `mid: ${memoryRecall.midTerm
        .slice(0, 2)
        .map((item) => item.summary)
        .join(" | ")}`
    );
  }

  if (memoryRecall.longTerm?.length) {
    lines.push(
      `long: ${memoryRecall.longTerm
        .slice(0, 2)
        .map((item) => item.content)
        .join(" | ")}`
    );
  }

  if (memoryRecall.strategicMemory?.length) {
    lines.push(
      `strategic: ${memoryRecall.strategicMemory
        .slice(0, 2)
        .map((item) => item.content)
        .join(" | ")}`
    );
  }

  if (memoryRecall.projectMemory?.length) {
    lines.push(
      `project: ${memoryRecall.projectMemory
        .slice(0, 2)
        .map((item) => item.content)
        .join(" | ")}`
    );
  }

  if (memoryRecall.patternMemory?.length) {
    lines.push(
      `patterns: ${memoryRecall.patternMemory
        .slice(0, 2)
        .map((item) => item.content)
        .join(" | ")}`
    );
  }

  if (memoryRecall.errorPatterns?.length) {
    lines.push(
      `errors: ${memoryRecall.errorPatterns
        .slice(0, 2)
        .map((item) => item.summary || item.outcome)
        .join(" | ")}`
    );
  }

  return lines.join("\n");
}

export default {
  summarizeConversationWindow,
  buildMemoryRecallSummary
};
