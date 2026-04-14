import { detectWebNeed } from "../../services/web/webIntentService.js";
import { resolveWeb } from "../../services/web/webRouter.js";
import BaseTool from "./BaseTool.js";

export class WebSearchTool extends BaseTool {
  constructor() {
    super({
      id: "web_search",
      label: "Web Research",
      description: "Uses the existing web routing layer to search the web or read URLs.",
      permissions: ["network", "browser"],
      inputSchema: {
        prompt: "string",
        classification: "string?",
        webNeed: "object?"
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
    const webNeed = input.webNeed || detectWebNeed(prompt, input.apiNeed || null);

    const result = await resolveWeb(prompt, classification, webNeed);
    return result.success
      ? result
      : {
          success: false,
          providerId: this.definition.id,
          sourceType: "tool",
          sourceName: this.definition.label,
          capability: webNeed?.capability || "web_search",
          summaryText: result.error || "Web research failed.",
          error: result.error,
          attempts: result.attempts || []
        };
  }
}

export default WebSearchTool;
