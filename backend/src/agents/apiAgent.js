import { BaseAgent } from "./BaseAgent.js";

function summarizeApiCandidates(candidates = [], apiNeed = null) {
  if (!candidates.length) {
    return apiNeed
      ? `No suitable API candidates were found for ${apiNeed.category || apiNeed.capability || "this request"}.`
      : "No suitable API candidates were found.";
  }

  return [
    "API candidates selected for this request:",
    ...candidates.slice(0, 4).map(
      (candidate) =>
        `- ${candidate.name} [${candidate.category}] (${candidate.pricing}) -> ${candidate.capabilities.join(", ")}`
    )
  ].join("\n");
}

export class ApiAgent extends BaseAgent {
  constructor({ apiRegistryService }) {
    super({
      id: "api_agent",
      label: "API Agent",
      role: "api registry lookup and API strategy selection"
    });

    this.apiRegistryService = apiRegistryService;
  }

  async execute({
    prompt,
    classification,
    apiNeed = null
  } = {}) {
    const candidates = apiNeed
      ? this.apiRegistryService.list({
          category: apiNeed.category || "",
          capability: apiNeed.capability || "",
          enabledOnly: true
        })
      : this.apiRegistryService.list({
          query: prompt,
          enabledOnly: true
        });

    return {
      success: true,
      providerId: this.id,
      sourceType: "tool",
      sourceName: "API Agent",
      capability: "api_strategy",
      raw: {
        prompt,
        classification,
        apiNeed,
        candidates
      },
      normalized: {
        apiNeed,
        candidates: candidates.slice(0, 6).map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          category: candidate.category,
          pricing: candidate.pricing,
          capabilities: candidate.capabilities
        }))
      },
      summaryText: summarizeApiCandidates(candidates, apiNeed),
      artifacts: []
    };
  }
}

export default ApiAgent;

