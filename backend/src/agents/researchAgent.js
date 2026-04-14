import { BaseAgent } from "./BaseAgent.js";

function truncate(value = "", maxChars = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

function buildResearchSummary(query = "", items = []) {
  if (!items.length) {
    return `No strong local knowledge hits were found for: ${query}`;
  }

  return [
    `Local research context for: ${query}`,
    ...items.slice(0, 4).map(
      (item) =>
        `- ${item.filename || item.docId || "knowledge"} | ${item.sectionTitle || "section"} | ${truncate(item.excerpt || item.text || "", 180)}`
    )
  ].join("\n");
}

export class ResearchAgent extends BaseAgent {
  constructor({ knowledgeStore }) {
    super({
      id: "research_agent",
      label: "Research Agent",
      role: "knowledge retrieval and local research context building"
    });

    this.knowledgeStore = knowledgeStore;
  }

  async execute({
    prompt,
    userId,
    conversationId,
    webNeed = null,
    classification = "simple_chat"
  } = {}) {
    const query = webNeed?.query || prompt || "";
    const search = await this.knowledgeStore.search(query, {
      userId,
      conversationId,
      limit: 4
    });

    return {
      success: true,
      providerId: this.id,
      sourceType: "tool",
      sourceName: "Research Agent",
      capability: "research_context",
      raw: {
        query,
        search
      },
      normalized: {
        query,
        totalMatches: search.totalMatches,
        topHits: search.items.map((item) => ({
          filename: item.filename,
          sectionTitle: item.sectionTitle,
          score: item.score
        }))
      },
      summaryText: buildResearchSummary(query, search.items),
      artifacts: [],
      classification
    };
  }
}

export default ResearchAgent;

