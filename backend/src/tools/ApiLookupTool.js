import { detectApiNeed, resolve as resolveApi } from "../../services/apis/apiRouter.js";
import BaseTool from "./BaseTool.js";

export class ApiLookupTool extends BaseTool {
  constructor() {
    super({
      id: "api_lookup",
      label: "API Lookup",
      description: "Calls the existing Hydria API routing layer for structured external data.",
      permissions: ["network"],
      inputSchema: {
        prompt: "string",
        classification: "string?",
        apiNeed: "object?"
      },
      outputSchema: {
        success: "boolean",
        providerId: "string?",
        capability: "string?",
        summaryText: "string?"
      }
    });
  }

  async execute(input = {}) {
    const prompt = input.prompt || input.query || "";
    const classification = input.classification || "data_lookup";
    const apiNeed = input.apiNeed || detectApiNeed(prompt);

    const result = await resolveApi(prompt, classification, apiNeed);
    return result.success
      ? result
      : {
          success: false,
          providerId: this.definition.id,
          sourceType: "tool",
          sourceName: this.definition.label,
          capability: apiNeed?.capability || "api_lookup",
          summaryText: result.error || "API lookup failed.",
          error: result.error,
          attempts: result.attempts || []
        };
  }
}

export default ApiLookupTool;
