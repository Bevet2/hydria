import { BaseTool } from "./BaseTool.js";

function truncate(value = "", maxChars = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

export class KnowledgeSearchTool extends BaseTool {
  constructor({ knowledgeStore, maxHits = 4 }) {
    super({
      id: "knowledge_search",
      label: "Knowledge Search",
      description: "Searches locally ingested attachment knowledge.",
      permissions: ["knowledge:read"]
    });

    this.knowledgeStore = knowledgeStore;
    this.maxHits = maxHits;
  }

  async execute({
    prompt,
    userId,
    conversationId
  }) {
    const searchResult = await this.knowledgeStore.search(prompt, {
      userId,
      conversationId,
      limit: this.maxHits
    });

    const summaryText = searchResult.items.length
      ? searchResult.items
          .slice(0, this.maxHits)
          .map(
            (item) =>
              `${item.filename} / ${item.sectionTitle}: ${truncate(item.text, 220)}`
          )
          .join("\n")
      : "No strong local knowledge match was found for this request.";

    return {
      providerId: this.id,
      sourceType: "tool",
      sourceName: "Knowledge Search",
      capability: "knowledge_search",
      raw: searchResult,
      normalized: searchResult,
      summaryText,
      items: searchResult.items,
      artifacts: []
    };
  }
}

export default KnowledgeSearchTool;
