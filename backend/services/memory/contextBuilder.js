import {
  buildAttachmentContextBlock,
  buildAttachmentModelMessages,
  selectRelevantAttachmentEvidence
} from "../attachments/attachmentService.js";
import { buildTaskPackContextBlock } from "../hydria/taskPackService.js";
import { getConversationHistory } from "./historyService.js";
import { getConversationSummary, getRelevantMemoryForPrompt } from "./memoryService.js";
import { getUserPreferences } from "./profileService.js";

function formatPreferenceBlock(preferences) {
  const entries = Object.entries(preferences);
  if (!entries.length) {
    return "";
  }

  return [
    "User preferences:",
    ...entries.map(([key, value]) => `- ${key}: ${value}`)
  ].join("\n");
}

function formatMemoryBlock(memories) {
  if (!memories.length) {
    return "";
  }

  return [
    "Relevant long-term memory:",
    ...memories.map(
      (memory) => `- [${memory.memory_type}] ${memory.content}`
    )
  ].join("\n");
}

function formatApiBlock(apiResults) {
  if (!apiResults.length) {
    return "";
  }

  return [
    "Useful API results:",
    ...apiResults.map(
      (result) =>
        `- ${result.sourceName} (${result.capability}): ${result.summaryText}`
    )
  ].join("\n");
}

function formatWebBlock(webResults) {
  if (!webResults.length) {
    return "";
  }

  const lines = [];

  for (const result of webResults) {
    if (result.searchResults?.length) {
      lines.push(`- Search query: ${result.normalized?.query || "web search"}`);
      for (const item of result.searchResults.slice(0, 5)) {
        lines.push(`  - ${item.title} | ${item.url} | ${item.snippet || ""}`.trim());
      }
    }

    if (result.pages?.length) {
      for (const page of result.pages.slice(0, 3)) {
        lines.push(`- Read page: ${page.title} | ${page.url} | ${page.excerpt || ""}`);
      }
    }
  }

  if (!lines.length) {
    return "";
  }

  return ["Useful web results:", ...lines].join("\n");
}

function formatToolBlock(toolResults) {
  if (!toolResults.length) {
    return "";
  }

  return [
    "Useful local tool results:",
    ...toolResults.map(
      (result) =>
        `- ${result.sourceName} (${result.capability}): ${result.summaryText}`
    )
  ].join("\n");
}

function formatAttachmentBlock(attachments) {
  return buildAttachmentContextBlock(attachments || []);
}

function formatAgenticMemoryBlock(agenticMemory) {
  if (!agenticMemory) {
    return "";
  }

  const sections = [];

  if (agenticMemory.workingMemory?.summary) {
    sections.push(`- working memory: ${agenticMemory.workingMemory.summary}`);
  }

  if (agenticMemory.midTerm?.length) {
    sections.push(
      ...agenticMemory.midTerm
        .slice(0, 2)
        .map((item) => `- mid-term: ${item.summary}`)
    );
  }

  if (agenticMemory.longTerm?.length) {
    sections.push(
      ...agenticMemory.longTerm
        .slice(0, 3)
        .map((item) => `- long-term: ${item.content}`)
    );
  }

  if (agenticMemory.errorPatterns?.length) {
    sections.push(
      ...agenticMemory.errorPatterns
        .slice(0, 2)
        .map((item) => `- prior error pattern: ${item.summary || item.outcome}`)
    );
  }

  if (agenticMemory.taskPatterns?.length) {
    sections.push(
      ...agenticMemory.taskPatterns
        .slice(0, 2)
        .map((item) => `- past task: ${item.summary || item.outcome || item.prompt}`)
    );
  }

  if (!sections.length) {
    return "";
  }

  return ["Agentic memory state:", ...sections].join("\n");
}

function formatRoutingBlock(routingResolution) {
  if (!routingResolution?.usedHistory || !routingResolution?.resolvedPrompt) {
    return "";
  }

  return [
    "Resolved conversational routing:",
    `- reason: ${routingResolution.reason || "follow_up"}`,
    `- previous prompt: ${routingResolution.previousPrompt || "-"}`,
    `- resolved request for tools and APIs: ${routingResolution.resolvedPrompt}`
  ].join("\n");
}

export function buildModelContext(
  userId,
  conversationId,
  prompt,
  {
    apiResults = [],
    webResults = [],
    toolResults = [],
    attachments = [],
    taskPack = null,
    routingResolution = null,
    agenticMemory = null
  } = {}
) {
  const recentMessages = getConversationHistory(conversationId, { limit: 8 });
  const summary = getConversationSummary(conversationId);
  const relevantMemory = getRelevantMemoryForPrompt(userId, prompt, { limit: 5 });
  const preferences = getUserPreferences(userId);
  const attachmentEvidence = selectRelevantAttachmentEvidence(attachments, prompt, {
    maxChunks: 6,
    maxChars: 7000
  });

  const systemSections = [
    "You are Hydria, a professional orchestration assistant. Be accurate, concise, and explicit about uncertainty. Attached files have already been opened and processed by the backend. Any extracted text, OCR output, or document content provided below is directly available to you. Use it as the file content. Do not claim that you cannot access the attachments. If extraction quality is weak, say that the extracted content is partial or noisy instead.",
    buildTaskPackContextBlock(taskPack),
    formatPreferenceBlock(preferences),
    summary ? `Conversation summary:\n${summary.content}` : "",
    formatMemoryBlock(relevantMemory),
    formatAgenticMemoryBlock(agenticMemory),
    formatRoutingBlock(routingResolution),
    formatAttachmentBlock(attachments),
    formatApiBlock(apiResults),
    formatWebBlock(webResults),
    formatToolBlock(toolResults)
  ].filter(Boolean);

  const messages = [
    {
      role: "system",
      content: systemSections.join("\n\n")
    },
    ...buildAttachmentModelMessages(attachments, attachmentEvidence)
  ];

  for (const message of recentMessages) {
    if (message.role === "tool") {
      messages.push({
        role: "system",
        content: `Tool result: ${message.content}`
      });
      continue;
    }

    messages.push({
      role:
        message.role === "assistant"
          ? "assistant"
          : message.role === "system"
            ? "system"
            : "user",
      content: message.content
    });
  }

  return {
    messages,
    memoryUsed: relevantMemory.map((memory) => ({
      id: memory.id,
      type: memory.memory_type,
      content: memory.content
    })),
    attachmentEvidenceUsed: attachmentEvidence.map((chunk) => ({
      attachmentId: chunk.attachmentId,
      filename: chunk.filename,
      sectionTitle: chunk.sectionTitle,
      score: Number(chunk.score.toFixed(2)),
      excerpt: chunk.text.slice(0, 240)
    })),
    preferencesUsed: preferences,
    summaryUsed: summary
      ? {
          id: summary.id,
          content: summary.content
        }
      : null
  };
}
