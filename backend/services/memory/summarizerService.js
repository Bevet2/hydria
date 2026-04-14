function compactText(text, maxLength = 180) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength - 1)}…`;
}

export function shouldSummarizeConversation(messages) {
  const totalLength = messages.reduce(
    (sum, message) => sum + String(message.content || "").length,
    0
  );

  return messages.length >= 12 || totalLength >= 5000;
}

export function createConversationSummary(messages) {
  const userMessages = messages.filter((message) => message.role === "user");
  const assistantMessages = messages.filter(
    (message) => message.role === "assistant"
  );
  const recentUserIntents = userMessages.slice(-4).map((message) => compactText(message.content));
  const recentAssistantOutputs = assistantMessages
    .slice(-2)
    .map((message) => compactText(message.content));

  const parts = [
    `Conversation length: ${messages.length} messages.`,
    recentUserIntents.length
      ? `Recent user intents: ${recentUserIntents.join(" | ")}`
      : "Recent user intents: none recorded.",
    recentAssistantOutputs.length
      ? `Recent assistant outputs: ${recentAssistantOutputs.join(" | ")}`
      : "Recent assistant outputs: none recorded."
  ];

  return parts.join("\n");
}

